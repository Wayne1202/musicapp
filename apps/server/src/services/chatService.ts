import type { ChatMessageDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";

const MAX_MESSAGE_LENGTH = 500;
const HISTORY_LIMIT = 50;

function serializeChatMessage(message: {
  id: string;
  roomId: string;
  sessionId: string;
  displayName: string;
  content: string;
  createdAt: Date;
}): ChatMessageDTO {
  return {
    id: message.id,
    roomId: message.roomId,
    sessionId: message.sessionId,
    displayName: message.displayName,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getRecentMessages(roomId: string, limit = HISTORY_LIMIT): Promise<ChatMessageDTO[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return messages.reverse().map(serializeChatMessage);
}

export async function sendMessage(
  roomId: string,
  sessionId: string,
  displayName: string,
  content: string,
): Promise<ChatMessageDTO> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new HttpError(400, "Message can't be empty");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `Message can't be longer than ${MAX_MESSAGE_LENGTH} characters`);
  }

  const message = await prisma.chatMessage.create({
    data: { roomId, sessionId, displayName, content: trimmed },
  });
  return serializeChatMessage(message);
}
