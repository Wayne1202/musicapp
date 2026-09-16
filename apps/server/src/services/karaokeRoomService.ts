import { extractYouTubeVideoId, generateRoomCode } from "@musicapp/shared";
import type { KaraokeMemberDTO, KaraokeRoomDTO, SelectKaraokeSongRequest } from "@musicapp/shared";
import type { KaraokeMember, KaraokeRoom } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { fetchYouTubeMetadata } from "./youtube/videos";

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

type KaraokeRoomWithMembers = KaraokeRoom & { members: KaraokeMember[] };

export function serializeKaraokeRoom(room: KaraokeRoomWithMembers): KaraokeRoomDTO {
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
    include: { members: true },
  });

  const member = created.members[0];
  const room = await prisma.karaokeRoom.update({
    where: { id: created.id },
    data: { singerMemberId: member.id },
    include: { members: true },
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
    include: { members: true },
  });

  return { room: serializeKaraokeRoom(room), member: serializeKaraokeMember(member) };
}

export async function getKaraokeRoomDTOById(roomId: string): Promise<KaraokeRoomDTO> {
  const room = await prisma.karaokeRoom.findUnique({ where: { id: roomId }, include: { members: true } });
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
    include: { members: true },
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
    include: { members: true },
  });
  return serializeKaraokeRoom(room);
}

export async function setKaraokeMic(roomId: string, micOn: boolean): Promise<KaraokeRoomDTO> {
  const room = await prisma.karaokeRoom.update({
    where: { id: roomId },
    data: { micOn },
    include: { members: true },
  });
  return serializeKaraokeRoom(room);
}

export async function endKaraokeSession(roomId: string): Promise<KaraokeRoomDTO> {
  const room = await prisma.karaokeRoom.update({
    where: { id: roomId },
    data: { status: "ENDED", isPlaying: false, micOn: false, endedAt: new Date() },
    include: { members: true },
  });
  return serializeKaraokeRoom(room);
}
