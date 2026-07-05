import type {
  AddSongResponse,
  ChatHistoryResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  QueueMutationResponse,
  RecentlyPlayedResponse,
  RoomDTO,
} from "@musicapp/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export function createRoom(payload: CreateRoomRequest) {
  return request<CreateRoomResponse>("/api/rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function joinRoom(code: string, payload: JoinRoomRequest) {
  return request<JoinRoomResponse>(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRoom(code: string) {
  return request<{ room: RoomDTO }>(`/api/rooms/${encodeURIComponent(code)}`);
}

export function addSong(roomId: string, sessionId: string, url: string) {
  return request<AddSongResponse>(`/api/rooms/${roomId}/queue`, {
    method: "POST",
    headers: { "x-session-id": sessionId },
    body: JSON.stringify({ url }),
  });
}

export function removeFromQueue(roomId: string, sessionId: string, itemId: string) {
  return request<QueueMutationResponse>(`/api/rooms/${roomId}/queue/${itemId}`, {
    method: "DELETE",
    headers: { "x-session-id": sessionId },
  });
}

export function moveQueueItem(roomId: string, sessionId: string, itemId: string, direction: "up" | "down") {
  return request<QueueMutationResponse>(`/api/rooms/${roomId}/queue/${itemId}/move`, {
    method: "PATCH",
    headers: { "x-session-id": sessionId },
    body: JSON.stringify({ direction }),
  });
}

export function reorderQueue(roomId: string, sessionId: string, orderedItemIds: string[]) {
  return request<QueueMutationResponse>(`/api/rooms/${roomId}/queue/reorder`, {
    method: "PUT",
    headers: { "x-session-id": sessionId },
    body: JSON.stringify({ orderedItemIds }),
  });
}

export function clearQueue(roomId: string, sessionId: string) {
  return request<QueueMutationResponse>(`/api/rooms/${roomId}/queue/clear`, {
    method: "POST",
    headers: { "x-session-id": sessionId },
  });
}

export function shuffleQueue(roomId: string, sessionId: string) {
  return request<QueueMutationResponse>(`/api/rooms/${roomId}/queue/shuffle`, {
    method: "POST",
    headers: { "x-session-id": sessionId },
  });
}

export function setRepeatQueue(roomId: string, sessionId: string, enabled: boolean) {
  return request<{ room: RoomDTO }>(`/api/rooms/${roomId}/repeat`, {
    method: "PATCH",
    headers: { "x-session-id": sessionId },
    body: JSON.stringify({ enabled }),
  });
}

export function getRecentlyPlayed(roomId: string) {
  return request<RecentlyPlayedResponse>(`/api/rooms/${roomId}/recently-played`);
}

export function getChatHistory(roomId: string) {
  return request<ChatHistoryResponse>(`/api/rooms/${roomId}/messages`);
}
