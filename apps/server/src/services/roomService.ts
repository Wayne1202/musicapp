import { generateRoomCode } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { isSessionConsideredOnline, serializeRoom, serializeSession } from "./serializers";
import type { RoomDTO, UserSessionDTO } from "@musicapp/shared";

const roomInclude = {
  playbackState: true,
  queueItems: { include: { addedBy: true } },
  sessions: true,
} as const;

async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique room code, please retry");
}

export async function createRoom(
  roomName: string,
  displayName: string,
): Promise<{ room: RoomDTO; session: UserSessionDTO }> {
  const code = await generateUniqueRoomCode();

  const created = await prisma.room.create({
    data: {
      code,
      name: roomName,
      playbackState: { create: {} },
      sessions: { create: { displayName, isOnline: true } },
    },
    include: roomInclude,
  });

  // Creator automatically becomes host.
  const session = created.sessions[0];
  const room = await prisma.room.update({
    where: { id: created.id },
    data: { hostSessionId: session.id },
    include: roomInclude,
  });

  return { room: serializeRoom(room), session: serializeSession(session) };
}

export async function joinRoomByCode(
  code: string,
  displayName: string,
): Promise<{ room: RoomDTO; session: UserSessionDTO }> {
  const existingRoom = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!existingRoom) {
    throw new HttpError(404, `Room "${code}" not found`);
  }
  if (existingRoom.status === "ENDED") {
    throw new HttpError(410, "This room has ended");
  }

  const session = await prisma.userSession.create({
    data: { roomId: existingRoom.id, displayName, isOnline: true },
  });

  // Joining an empty room (no current host, e.g. everyone left) makes you the new host.
  if (!existingRoom.hostSessionId) {
    await prisma.room.updateMany({
      where: { id: existingRoom.id, hostSessionId: null },
      data: { hostSessionId: session.id },
    });
  }

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: existingRoom.id },
    include: roomInclude,
  });

  return { room: serializeRoom(room), session: serializeSession(session) };
}

/** Reconnect path (existing session, no new REST join call): claims host if the room is
 *  currently host-less, e.g. the host's tab reconnects after everyone else had left too. */
export async function becomeHostIfNone(roomId: string, sessionId: string): Promise<void> {
  await prisma.room.updateMany({
    where: { id: roomId, hostSessionId: null },
    data: { hostSessionId: sessionId },
  });
}

export async function transferHost(roomId: string, targetSessionId: string): Promise<UserSessionDTO> {
  const target = await prisma.userSession.findFirst({
    where: { id: targetSessionId, roomId, isOnline: true },
  });
  if (!target) throw new HttpError(404, "Target user is not online in this room");

  await prisma.room.update({ where: { id: roomId }, data: { hostSessionId: targetSessionId } });
  return serializeSession(target);
}

/** Called after a disconnecting session has been marked offline. Promotes the
 *  earliest-joined still-online user to host if — and only if — the departing session was
 *  the host; returns the new host (or null if the room is now empty / departer wasn't host). */
export async function reassignHostOnDisconnect(
  roomId: string,
  departingSessionId: string,
  onlineUsers: UserSessionDTO[],
): Promise<UserSessionDTO | null> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { hostSessionId: true } });
  if (!room || room.hostSessionId !== departingSessionId) return null;

  const nextHost = onlineUsers[0] ?? null;
  await prisma.room.update({ where: { id: roomId }, data: { hostSessionId: nextHost?.id ?? null } });
  return nextHost;
}

export async function endRoom(roomId: string): Promise<void> {
  await prisma.room.update({ where: { id: roomId }, data: { status: "ENDED" } });
}

export async function setQueueLock(roomId: string, locked: boolean): Promise<void> {
  await prisma.room.update({ where: { id: roomId }, data: { queueLocked: locked } });
}

export async function updateRoomSettings(
  roomId: string,
  patch: Partial<{
    queueAddPermission: "ANYONE" | "HOST_ONLY";
    skipMode: "ANYONE" | "HOST_ONLY" | "VOTE";
    autoShuffle: boolean;
    chatEnabled: boolean;
    reactionsEnabled: boolean;
    allowGuestReorder: boolean;
    autoplayFallback: boolean;
  }>,
): Promise<void> {
  await prisma.room.update({ where: { id: roomId }, data: patch });
}

export async function getRoomDTOById(roomId: string): Promise<RoomDTO> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomInclude });
  if (!room) throw new HttpError(404, "Room not found");
  return serializeRoom(room);
}

/** Raw Room record (not the DTO) for callers that only need settings/host fields to run a
 *  permission check — e.g. permissions.ts — without paying for the full include. */
export async function getRoomRecord(roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new HttpError(404, "Room not found");
  return room;
}

export async function getRoomIdByCode(code: string): Promise<string | null> {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  return room?.id ?? null;
}

export async function getSessionById(sessionId: string) {
  return prisma.userSession.findUnique({ where: { id: sessionId } });
}

export async function setSessionOnlineStatus(sessionId: string, isOnline: boolean) {
  return prisma.userSession.update({
    where: { id: sessionId },
    data: { isOnline, lastSeenAt: new Date() },
  });
}

export async function getOnlineUsers(roomId: string): Promise<UserSessionDTO[]> {
  const sessions = await prisma.userSession.findMany({
    where: { roomId, isOnline: true },
    orderBy: { createdAt: "asc" },
  });
  return sessions.filter(isSessionConsideredOnline).map(serializeSession);
}
