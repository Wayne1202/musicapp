import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  KaraokeClientToServerEvents,
  KaraokeServerToClientEvents,
  ServerToClientEvents,
} from "@musicapp/shared";

export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

// One shared socket connection covers both the listening-room and karaoke event sets (same
// server-side io instance — see apps/server/src/types/socket.ts's identical combined typing).
export type AppSocket = Socket<ServerToClientEvents & KaraokeServerToClientEvents, ClientToServerEvents & KaraokeClientToServerEvents>;

let socket: AppSocket | null = null;

/** Lazily creates a single shared socket connection for the whole app. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
