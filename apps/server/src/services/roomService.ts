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

  const room = await prisma.room.create({
    data: {
      code,
      name: roomName,
      playbackState: { create: {} },
      sessions: { create: { displayName, isOnline: true } },
    },
    include: roomInclude,
  });

  const session = room.sessions[0];
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

  const session = await prisma.userSession.create({
    data: { roomId: existingRoom.id, displayName, isOnline: true },
  });

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: existingRoom.id },
    include: roomInclude,
  });

  return { room: serializeRoom(room), session: serializeSession(session) };
}

export async function getRoomDTOById(roomId: string): Promise<RoomDTO> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomInclude });
  if (!room) throw new HttpError(404, "Room not found");
  return serializeRoom(room);
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
