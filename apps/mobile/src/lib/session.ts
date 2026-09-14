import AsyncStorage from "@react-native-async-storage/async-storage";

// Not expo-secure-store: this is a guest display name + generated session id, not a credential,
// and AsyncStorage (unlike SecureStore) works uniformly on iOS/Android/web.
const DISPLAY_NAME_KEY = "musicapp.displayName";

export async function getStoredDisplayName(): Promise<string> {
  return (await AsyncStorage.getItem(DISPLAY_NAME_KEY)) ?? "";
}

export async function storeDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(DISPLAY_NAME_KEY, name);
}

export interface RoomSession {
  sessionId: string;
  displayName: string;
}

function sessionKey(roomCode: string) {
  return `musicapp.session.${roomCode.toUpperCase()}`;
}

export async function getRoomSession(roomCode: string): Promise<RoomSession | null> {
  const raw = await AsyncStorage.getItem(sessionKey(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomSession;
  } catch {
    return null;
  }
}

export async function setRoomSession(roomCode: string, session: RoomSession): Promise<void> {
  await AsyncStorage.setItem(sessionKey(roomCode), JSON.stringify(session));
}

export async function clearRoomSession(roomCode: string): Promise<void> {
  await AsyncStorage.removeItem(sessionKey(roomCode));
}
