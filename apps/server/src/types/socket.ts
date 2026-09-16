import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  KaraokeClientToServerEvents,
  KaraokeServerToClientEvents,
  ServerToClientEvents,
} from "@musicapp/shared";

export interface SocketData {
  roomId: string;
  sessionId: string;
  displayName: string;
  // Karaoke-specific identity, set on JOIN_KARAOKE_ROOM — kept separate from the listening-room
  // roomId/sessionId above since one socket connection could (in principle) touch both features.
  karaokeRoomId?: string;
  karaokeMemberId?: string;
}

// Both the listening-room and karaoke event maps live on the one shared `io` instance (see
// PROJECT_KARAOKE.md — karaoke reuses the existing Socket.IO server rather than standing up a
// second one), so TypedServer/TypedSocket need to type both.
type CombinedClientToServerEvents = ClientToServerEvents & KaraokeClientToServerEvents;
type CombinedServerToClientEvents = ServerToClientEvents & KaraokeServerToClientEvents;

export type TypedServer = Server<CombinedClientToServerEvents, CombinedServerToClientEvents, Record<string, never>, SocketData>;
export type TypedSocket = Socket<CombinedClientToServerEvents, CombinedServerToClientEvents, Record<string, never>, SocketData>;
