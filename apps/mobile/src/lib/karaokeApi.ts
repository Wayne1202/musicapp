import type {
  CreateKaraokeRoomRequest,
  CreateKaraokeRoomResponse,
  JoinKaraokeRoomRequest,
  JoinKaraokeRoomResponse,
  KaraokeRoomDTO,
  SelectKaraokeSongRequest,
} from "@musicapp/shared";
import { API_URL, ApiError } from "@/lib/api";

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

export function createKaraokeRoom(payload: CreateKaraokeRoomRequest) {
  return request<CreateKaraokeRoomResponse>("/api/karaoke-rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function joinKaraokeRoom(code: string, payload: JoinKaraokeRoomRequest) {
  return request<JoinKaraokeRoomResponse>(`/api/karaoke-rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getKaraokeRoom(code: string) {
  return request<{ room: KaraokeRoomDTO }>(`/api/karaoke-rooms/${encodeURIComponent(code)}`);
}

export function selectKaraokeSong(roomId: string, memberId: string, payload: SelectKaraokeSongRequest) {
  return request<{ room: KaraokeRoomDTO }>(`/api/karaoke-rooms/${roomId}/song`, {
    method: "POST",
    headers: { "x-session-id": memberId },
    body: JSON.stringify(payload),
  });
}
