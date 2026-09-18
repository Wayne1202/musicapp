import { extractYouTubeVideoId, generateRoomCode } from "@musicapp/shared";
import type {
  AddKaraokeQueueItemRequest,
  KaraokeMemberDTO,
  KaraokeQueueItemDTO,
  KaraokeRoomDTO,
  SelectKaraokeSongRequest,
} from "@musicapp/shared";
import type { KaraokeMember, KaraokeQueueItem, KaraokeRoom, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { fetchYouTubeMetadata } from "./youtube/videos";

// Reused by every read that needs the room's members+queue together, so every call site stays
// in sync if the include shape ever needs to change (it's easy to forget one `include: { members
// true }` site otherwise).
const roomInclude = {
  members: true,
  queue: { orderBy: { position: "asc" } },
} satisfies Prisma.KaraokeRoomInclude;

type KaraokeRoomWithRelations = KaraokeRoom & { members: KaraokeMember[]; queue: KaraokeQueueItem[] };

// Same in-heartbeat-staleness idea as apps/server/src/services/serializers.ts's
// isSessionConsideredOnline, mirrored here for karaoke members.
const ONLINE_STALE_MS = 60_000;

function isMemberConsideredOnline(member: KaraokeMember): boolean {
  return member.isOnline && Date.now() - member.lastSeenAt.getTime() < ONLINE_STALE_MS;
}

export function serializeKaraokeMember(member: KaraokeMember): KaraokeMemberDTO {
  return {
    id: member.id,
    roomId: member.roomId,
    displayName: member.displayName,
    role: member.role,
    isOnline: isMemberConsideredOnline(member),
    createdAt: member.createdAt.toISOString(),
  };
}

export function serializeKaraokeQueueItem(item: KaraokeQueueItem): KaraokeQueueItemDTO {
  return {
    id: item.id,
    roomId: item.roomId,
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail,
    duration: item.duration,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
  };
}

export function serializeKaraokeRoom(room: KaraokeRoomWithRelations): KaraokeRoomDTO {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    singerMemberId: room.singerMemberId,
    currentVideoId: room.currentVideoId,
    currentTitle: room.currentTitle,
    currentThumbnail: room.currentThumbnail,
    currentDuration: room.currentDuration,
    currentTimestamp: room.currentTimestamp,
    isPlaying: room.isPlaying,
    micOn: room.micOn,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    endedAt: room.endedAt?.toISOString() ?? null,
    queue: room.queue.map(serializeKaraokeQueueItem),
    members: room.members.map(serializeKaraokeMember),
  };
}

async function generateUniqueKaraokeRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const existing = await prisma.karaokeRoom.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique karaoke room code, please retry");
}

export async function createKaraokeRoom(
  displayName: string,
): Promise<{ room: KaraokeRoomDTO; member: KaraokeMemberDTO }> {
  const code = await generateUniqueKaraokeRoomCode();

  const created = await prisma.karaokeRoom.create({
    data: {
      code,
      members: { create: { displayName, role: "SINGER", isOnline: true } },
    },
    include: roomInclude,
  });

  const member = created.members[0];
  const room = await prisma.karaokeRoom.update({
    where: { id: created.id },
    data: { singerMemberId: member.id },
    include: roomInclude,
  });

  return { room: serializeKaraokeRoom(room), member: serializeKaraokeMember(member) };
}

export async function joinKaraokeRoom(
  code: string,
  displayName: string,
): Promise<{ room: KaraokeRoomDTO; member: KaraokeMemberDTO }> {
  const existingRoom = await prisma.karaokeRoom.findUnique({ where: { code: code.toUpperCase() } });
  if (!existingRoom) {
    throw new HttpError(404, `Karaoke room "${code}" not found`);
  }
  if (existingRoom.status === "ENDED") {
    throw new HttpError(410, "This karaoke room has ended");
  }

  const member = await prisma.karaokeMember.create({
    data: { roomId: existingRoom.id, displayName, role: "LISTENER", isOnline: true },
  });

  const room = await prisma.karaokeRoom.findUniqueOrThrow({
    where: { id: existingRoom.id },
    include: roomInclude,
  });

  return { room: serializeKaraokeRoom(room), member: serializeKaraokeMember(member) };
}

export async function getKaraokeRoomDTOById(roomId: string): Promise<KaraokeRoomDTO> {
  const room = await prisma.karaokeRoom.findUnique({ where: { id: roomId }, include: roomInclude });
  if (!room) throw new HttpError(404, "Karaoke room not found");
  return serializeKaraokeRoom(room);
}

export async function getKaraokeRoomIdByCode(code: string): Promise<string | null> {
  const room = await prisma.karaokeRoom.findUnique({ where: { code: code.toUpperCase() } });
  return room?.id ?? null;
}

/** Raw record for permission checks (is this member the singer?) without the members include. */
export async function getKaraokeRoomRecord(roomId: string): Promise<KaraokeRoom> {
  const room = await prisma.karaokeRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new HttpError(404, "Karaoke room not found");
  return room;
}

export async function getKaraokeMemberById(memberId: string): Promise<KaraokeMember | null> {
  return prisma.karaokeMember.findUnique({ where: { id: memberId } });
}

export async function setKaraokeMemberOnlineStatus(memberId: string, isOnline: boolean) {
  return prisma.karaokeMember.update({
    where: { id: memberId },
    data: { isOnline, lastSeenAt: new Date() },
  });
}

export async function getOnlineKaraokeMembers(roomId: string): Promise<KaraokeMemberDTO[]> {
  const members = await prisma.karaokeMember.findMany({
    where: { roomId, isOnline: true },
    orderBy: { createdAt: "asc" },
  });
  return members.filter(isMemberConsideredOnline).map(serializeKaraokeMember);
}

export function isSinger(room: Pick<KaraokeRoom, "singerMemberId">, memberId: string): boolean {
  return room.singerMemberId === memberId;
}

/** Singer picks the backing track. Resets playback to the start, matching how the listening
 *  room "starts" a freshly-selected song — the singer then explicitly starts singing/mic
 *  separately (see startKaraokeSinging/setKaraokeMic below), so this alone doesn't set isPlaying. */
export async function selectKaraokeSong(
  roomId: string,
  request: SelectKaraokeSongRequest,
): Promise<KaraokeRoomDTO> {
  const videoId = request.videoId?.trim() || (request.url ? extractYouTubeVideoId(request.url) : null);
  if (!videoId) {
    throw new HttpError(400, "Could not resolve a YouTube video ID from that url/videoId");
  }

  const metadata =
    request.title && request.thumbnail !== undefined && request.duration !== undefined
      ? { title: request.title, thumbnail: request.thumbnail, duration: request.duration }
      : await fetchYouTubeMetadata(videoId);

  const room = await prisma.karaokeRoom.update({
    where: { id: roomId },
    data: {
      currentVideoId: videoId,
      currentTitle: metadata.title,
      currentThumbnail: metadata.thumbnail,
      currentDuration: metadata.duration,
      currentTimestamp: 0,
      isPlaying: false,
    },
    include: roomInclude,
  });

  return serializeKaraokeRoom(room);
}

/** Starts the backing track from 0 and moves the room to SINGING. `currentTimestamp: 0` plus
 *  `updatedAt` (auto) becomes the timeline origin every listener's projectPlaybackPosition()
 *  projects forward from — see docs/karaoke-audio.md. */
export async function startKaraokeSinging(roomId: string): Promise<KaraokeRoomDTO> {
  const current = await getKaraokeRoomRecord(roomId);
  if (!current.currentVideoId) {
    throw new HttpError(400, "Select a song before starting");
  }

  const room = await prisma.karaokeRoom.update({
    where: { id: roomId },
    data: { status: "SINGING", isPlaying: true, currentTimestamp: 0 },
    include: roomInclude,
  });
  return serializeKaraokeRoom(room);
}

export async function setKaraokeMic(roomId: string, micOn: boolean): Promise<KaraokeRoomDTO> {
  const room = await prisma.karaokeRoom.update({
    where: { id: roomId },
    data: { micOn },
    include: roomInclude,
  });
  return serializeKaraokeRoom(room);
}

export async function endKaraokeSession(roomId: string): Promise<KaraokeRoomDTO> {
  const room = await prisma.karaokeRoom.update({
    where: { id: roomId },
    data: { status: "ENDED", isPlaying: false, micOn: false, endedAt: new Date() },
    include: roomInclude,
  });
  return serializeKaraokeRoom(room);
}

/** Promotes the earliest-queued song into the current-song slot (removing it from the queue),
 *  matching selectKaraokeSong's currentTimestamp:0 reset. If the room is already SINGING, keeps
 *  playing immediately (isPlaying:true) rather than making the singer hit "Start Singing" again
 *  for every song — that gate only matters for the very first song, before SINGING begins. */
export async function advanceKaraokeQueue(roomId: string): Promise<KaraokeRoomDTO> {
  const current = await getKaraokeRoomRecord(roomId);
  const next = await prisma.karaokeQueueItem.findFirst({
    where: { roomId },
    orderBy: { position: "asc" },
  });
  if (!next) {
    throw new HttpError(400, "The queue is empty — add a song first");
  }

  // Run as a transaction so a crash between the two writes can't leave the song both "current"
  // and still sitting in the queue. Re-fetch afterward rather than trust either write's own
  // returned `queue` snapshot, which reflects the state *before* the sibling write in the batch.
  await prisma.$transaction([
    prisma.karaokeRoom.update({
      where: { id: roomId },
      data: {
        currentVideoId: next.videoId,
        currentTitle: next.title,
        currentThumbnail: next.thumbnail,
        currentDuration: next.duration,
        currentTimestamp: 0,
        isPlaying: current.status === "SINGING",
      },
    }),
    prisma.karaokeQueueItem.delete({ where: { id: next.id } }),
  ]);

  return getKaraokeRoomDTOById(roomId);
}

/** Appends a song to the singer's queue. If nothing is currently loaded (fresh room, or the
 *  current song was never set), immediately promotes this one into the current-song slot instead
 *  of leaving it queued behind an empty "now playing" — there's nothing to be "next" after. */
export async function addKaraokeQueueItem(
  roomId: string,
  request: AddKaraokeQueueItemRequest,
): Promise<KaraokeRoomDTO> {
  const videoId = request.videoId?.trim() || (request.url ? extractYouTubeVideoId(request.url) : null);
  if (!videoId) {
    throw new HttpError(400, "Could not resolve a YouTube video ID from that url/videoId");
  }

  const metadata =
    request.title && request.thumbnail !== undefined && request.duration !== undefined
      ? { title: request.title, thumbnail: request.thumbnail, duration: request.duration }
      : await fetchYouTubeMetadata(videoId);

  const room = await getKaraokeRoomRecord(roomId);
  const lastItem = await prisma.karaokeQueueItem.findFirst({ where: { roomId }, orderBy: { position: "desc" } });
  const position = (lastItem?.position ?? -1) + 1;

  await prisma.karaokeQueueItem.create({
    data: {
      roomId,
      videoId,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      position,
    },
  });

  if (!room.currentVideoId) {
    return advanceKaraokeQueue(roomId);
  }
  return getKaraokeRoomDTOById(roomId);
}

/** Singer removing a song they haven't gotten to yet. */
export async function removeKaraokeQueueItem(roomId: string, itemId: string): Promise<KaraokeRoomDTO> {
  await prisma.karaokeQueueItem.deleteMany({ where: { id: itemId, roomId } });
  return getKaraokeRoomDTOById(roomId);
}
