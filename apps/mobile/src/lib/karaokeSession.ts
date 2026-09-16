import AsyncStorage from "@react-native-async-storage/async-storage";

// Mirrors src/lib/session.ts's pattern exactly, for the separate karaoke guest identity
// (KaraokeMember, not UserSession — see PROJECT_KARAOKE.md).
export interface KaraokeRoomSession {
  memberId: string;
  displayName: string;
  role: "SINGER" | "LISTENER";
}

function karaokeSessionKey(roomCode: string) {
  return `musicapp.karaoke.session.${roomCode.toUpperCase()}`;
}

export async function getKaraokeRoomSession(roomCode: string): Promise<KaraokeRoomSession | null> {
  const raw = await AsyncStorage.getItem(karaokeSessionKey(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KaraokeRoomSession;
  } catch {
    return null;
  }
}

export async function setKaraokeRoomSession(roomCode: string, session: KaraokeRoomSession): Promise<void> {
  await AsyncStorage.setItem(karaokeSessionKey(roomCode), JSON.stringify(session));
}

export async function clearKaraokeRoomSession(roomCode: string): Promise<void> {
  await AsyncStorage.removeItem(karaokeSessionKey(roomCode));
}
