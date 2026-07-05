"use client";

const DISPLAY_NAME_KEY = "musicapp:displayName";

export function getStoredDisplayName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
}

export function storeDisplayName(name: string) {
  window.localStorage.setItem(DISPLAY_NAME_KEY, name);
}

export interface RoomSession {
  sessionId: string;
  displayName: string;
}

function sessionKey(roomCode: string) {
  return `musicapp:session:${roomCode.toUpperCase()}`;
}

export function getRoomSession(roomCode: string): RoomSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(sessionKey(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomSession;
  } catch {
    return null;
  }
}

export function setRoomSession(roomCode: string, session: RoomSession) {
  window.localStorage.setItem(sessionKey(roomCode), JSON.stringify(session));
}

export function clearRoomSession(roomCode: string) {
  window.localStorage.removeItem(sessionKey(roomCode));
}
