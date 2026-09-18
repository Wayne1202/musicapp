import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  KaraokeClientToServerEvents,
  KaraokeServerToClientEvents,
  ServerToClientEvents,
} from "@musicapp/shared";

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

export type AppSocket = Socket<
  ServerToClientEvents & KaraokeServerToClientEvents,
  ClientToServerEvents & KaraokeClientToServerEvents
>;

let socket: AppSocket | null = null;

/** Lazily creates a single shared socket connection for the whole tab. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
