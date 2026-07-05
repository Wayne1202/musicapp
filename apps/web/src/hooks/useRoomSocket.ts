"use client";

import { useEffect, useReducer, useRef } from "react";
import { SocketEvents } from "@musicapp/shared";
import type { RoomDTO } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

interface RoomSocketState {
  room: RoomDTO | null;
  connected: boolean;
  error: string | null;
}

type Action =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "room_state"; room: RoomDTO }
  | { type: "merge"; patch: Partial<RoomDTO> }
  | { type: "error"; message: string };

const HEARTBEAT_INTERVAL_MS = 25_000;

function reducer(state: RoomSocketState, action: Action): RoomSocketState {
  switch (action.type) {
    case "connected":
      return { ...state, connected: true, error: null };
    case "disconnected":
      return { ...state, connected: false };
    case "room_state":
      return { ...state, room: action.room, error: null };
    case "merge":
      return state.room ? { ...state, room: { ...state.room, ...action.patch } } : state;
    case "error":
      return { ...state, error: action.message };
    default:
      return state;
  }
}

/**
 * Owns the Socket.IO connection for a room: joins on connect, keeps `room` in sync with
 * every real-time event, and rejoins automatically after a reconnect.
 */
export function useRoomSocket(roomId: string | null, sessionId: string | null) {
  const [state, dispatch] = useReducer(reducer, { room: null, connected: false, error: null });
  const joined = useRef(false);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId || !sessionId) return;

    const socket = getSocket();

    const stopHeartbeat = () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };

    const join = () => {
      dispatch({ type: "connected" });
      socket.emit(SocketEvents.JOIN_ROOM, { roomId, sessionId });
      joined.current = true;

      stopHeartbeat();
      heartbeatInterval.current = setInterval(() => {
        socket.emit(SocketEvents.HEARTBEAT);
      }, HEARTBEAT_INTERVAL_MS);
    };

    const onDisconnect = () => {
      dispatch({ type: "disconnected" });
      joined.current = false;
      stopHeartbeat();
    };

    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);

    socket.on(SocketEvents.ROOM_STATE, ({ room }) => dispatch({ type: "room_state", room }));
    socket.on(SocketEvents.USER_JOINED, ({ onlineUsers }) => dispatch({ type: "merge", patch: { onlineUsers } }));
    socket.on(SocketEvents.USER_LEFT, ({ onlineUsers }) => dispatch({ type: "merge", patch: { onlineUsers } }));
    socket.on(SocketEvents.SONG_ADDED, ({ queue }) => dispatch({ type: "merge", patch: { queue } }));
    socket.on(SocketEvents.QUEUE_UPDATED, ({ queue }) => dispatch({ type: "merge", patch: { queue } }));
    socket.on(SocketEvents.SONG_CHANGED, ({ playbackState, queue }) =>
      dispatch({ type: "merge", patch: { playbackState, queue } }),
    );
    socket.on(SocketEvents.PLAYBACK_STARTED, ({ playbackState }) => dispatch({ type: "merge", patch: { playbackState } }));
    socket.on(SocketEvents.PLAYBACK_PAUSED, ({ playbackState }) => dispatch({ type: "merge", patch: { playbackState } }));
    socket.on(SocketEvents.PLAYBACK_SEEKED, ({ playbackState }) => dispatch({ type: "merge", patch: { playbackState } }));
    socket.on(SocketEvents.ERROR, ({ message }) => dispatch({ type: "error", message }));

    if (socket.connected) {
      join();
    } else {
      socket.connect();
    }

    return () => {
      stopHeartbeat();
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
      socket.off(SocketEvents.ROOM_STATE);
      socket.off(SocketEvents.USER_JOINED);
      socket.off(SocketEvents.USER_LEFT);
      socket.off(SocketEvents.SONG_ADDED);
      socket.off(SocketEvents.QUEUE_UPDATED);
      socket.off(SocketEvents.SONG_CHANGED);
      socket.off(SocketEvents.PLAYBACK_STARTED);
      socket.off(SocketEvents.PLAYBACK_PAUSED);
      socket.off(SocketEvents.PLAYBACK_SEEKED);
      socket.off(SocketEvents.ERROR);
      socket.disconnect();
      joined.current = false;
    };
  }, [roomId, sessionId]);

  return state;
}
