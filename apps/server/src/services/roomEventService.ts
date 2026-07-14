import type { RoomEventType } from "@prisma/client";
import type { ChatMessageDTO, RoomEventDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { sendSystemMessage } from "./chatService";

function buildMessage(type: RoomEventType, actorName: string | null, targetName: string | null): string {
  switch (type) {
    case "JOINED":
      return `${actorName ?? "Someone"} joined`;
    case "LEFT":
      return `${actorName ?? "Someone"} left`;
    case "HOST_TRANSFERRED":
      return `${targetName ?? "Someone"} became host`;
    case "QUEUE_LOCKED":
      return `${actorName ?? "The host"} locked the queue`;
    case "QUEUE_UNLOCKED":
      return `${actorName ?? "The host"} unlocked the queue`;
    case "VOTE_SKIP_PASSED":
      return targetName ? `Vote passed — skipped "${targetName}"` : "Vote passed — song skipped";
    case "ROOM_ENDED":
      return actorName ? `${actorName} ended the room` : "Room ended automatically after sitting empty for an hour";
  }
}

/**
 * Records a durable room-history entry (persisted `RoomEvent` row) and, by default, mirrors it
 * into the chat stream as a `SYSTEM` message, so history and chat don't need two separate copies
 * of the same "what happened" logic. Pass `postToChat: false` for events that are too frequent
 * to show in chat (JOINED/LEFT fire on every reconnect, not just first entry) but still belong
 * in the durable history log — Room History stays complete either way. Caller is responsible for
 * broadcasting the returned message over `MESSAGE_RECEIVED` when one comes back (mirrors how
 * every other chat-producing code path already works).
 */
export async function recordRoomEvent(
  roomId: string,
  type: RoomEventType,
  payload: { actorName?: string | null; targetName?: string | null; postToChat?: boolean } = {},
): Promise<{ message: ChatMessageDTO | null }> {
  const actorName = payload.actorName ?? null;
  const targetName = payload.targetName ?? null;
  const postToChat = payload.postToChat ?? true;

  await prisma.roomEvent.create({ data: { roomId, type, actorName, targetName } });
  const message = postToChat ? await sendSystemMessage(roomId, buildMessage(type, actorName, targetName)) : null;
  return { message };
}

export async function getRoomEvents(roomId: string, limit = 50): Promise<RoomEventDTO[]> {
  const events = await prisma.roomEvent.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return events.map((event) => ({
    id: event.id,
    roomId: event.roomId,
    type: event.type,
    actorName: event.actorName,
    targetName: event.targetName,
    summary: buildMessage(event.type, event.actorName, event.targetName),
    createdAt: event.createdAt.toISOString(),
  }));
}
