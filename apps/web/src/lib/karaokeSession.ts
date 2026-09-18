"use client";

// Mirrors src/lib/session.ts's pattern exactly, for the separate karaoke guest identity
// (KaraokeMember, not UserSession — see PROJECT_KARAOKE.md).
export interface KaraokeRoomSession {
  memberId: string;
  displayName: string;
  role: "SINGER" | "LISTENER";
}

function karaokeSessionKey(roomCode: string) {
  return `musicapp:karaoke:session:${roomCode.toUpperCase()}`;
}

export function getKaraokeRoomSession(roomCode: string): KaraokeRoomSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(karaokeSessionKey(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KaraokeRoomSession;
  } catch {
    return null;
  }
}

export function setKaraokeRoomSession(roomCode: string, session: KaraokeRoomSession) {
  window.localStorage.setItem(karaokeSessionKey(roomCode), JSON.stringify(session));
}

export function clearKaraokeRoomSession(roomCode: string) {
  window.localStorage.removeItem(karaokeSessionKey(roomCode));
}
