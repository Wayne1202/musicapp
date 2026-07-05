"use client";

import { useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { SocketEvents } from "@musicapp/shared";
import type { ChatMessageDTO, RoomDTO } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

interface RoomSocketState {
  room: RoomDTO | null;
  connected: boolean;
  error: string | null;
  messages: ChatMessageDTO[];
  /** sessionId -> displayName, for users currently typing in the add-song box. */
  typingUsers: Record<string, string>;
}

type Action =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "room_state"; room: RoomDTO }
  | { type: "merge"; patch: Partial<RoomDTO> }
  | { type: "error"; message: string }
  | { type: "message_received"; message: ChatMessageDTO }
  | { type: "typing"; sessionId: string; displayName: string; isTyping: boolean };

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
    case "message_received":
      return { ...state, messages: [...state.messages, action.message] };
    case "typing": {
      const typingUsers = { ...state.typingUsers };
      if (action.isTyping) {
        typingUsers[action.sessionId] = action.displayName;
      } else {
        delete typingUsers[action.sessionId];
      }
      return { ...state, typingUsers };
    }
    default:
      return state;
  }
}

/**
 * Owns the Socket.IO connection for a room: joins on connect, keeps `room` (and chat/typing
 * state) in sync with every real-time event, rejoins automatically after a reconnect, and
 * surfaces social events (joins/leaves/queue changes/song changes) as toasts.
 */
export function useRoomSocket(roomId: string | null, sessionId: string | null) {
  const [state, dispatch] = useReducer(reducer, {
    room: null,
    connected: false,
    error: null,
    messages: [],
    typingUsers: {},
  });
  const joined = useRef(false);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Read inside socket callbacks without re-subscribing every render.
  const roomRef = useRef<RoomDTO | null>(null);
  roomRef.current = state.room;

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

    socket.on(SocketEvents.USER_JOINED, ({ user, onlineUsers }) => {
      dispatch({ type: "merge", patch: { onlineUsers } });
      if (user.id !== sessionId) toast(`${user.displayName} joined the room`);
    });

    socket.on(SocketEvents.USER_LEFT, ({ sessionId: leftSessionId, onlineUsers }) => {
      const leftUser = roomRef.current?.onlineUsers.find((u) => u.id === leftSessionId);
      dispatch({ type: "merge", patch: { onlineUsers } });
      if (leftSessionId !== sessionId) toast(`${leftUser?.displayName ?? "Someone"} left the room`);
    });

    socket.on(SocketEvents.SONG_ADDED, ({ queueItem, queue }) => {
      dispatch({ type: "merge", patch: { queue } });
      if (queueItem.addedById !== sessionId) toast.success(`${queueItem.addedByName} added a song`);
    });

    socket.on(SocketEvents.QUEUE_UPDATED, ({ queue, reason }) => {
      dispatch({ type: "merge", patch: { queue } });
      if (!reason) return;
      if (reason.type === "cleared") toast.success(`${reason.actorName} cleared the queue`);
      else if (reason.type === "shuffled") toast.success(`${reason.actorName} shuffled the queue`);
      else if (reason.type === "removed") {
        toast.success(reason.songTitle ? `${reason.actorName} removed "${reason.songTitle}"` : `${reason.actorName} removed a song`);
      }
      // "moved" / "reordered" are frequent (dragging) and low-signal — no toast for those.
    });

    socket.on(SocketEvents.SONG_CHANGED, ({ playbackState, queue }) => {
      dispatch({ type: "merge", patch: { playbackState, queue } });
      if (playbackState.currentTitle) toast(`Now playing: ${playbackState.currentTitle}`);
    });

    socket.on(SocketEvents.PLAYBACK_STARTED, ({ playbackState }) => dispatch({ type: "merge", patch: { playbackState } }));
    socket.on(SocketEvents.PLAYBACK_PAUSED, ({ playbackState }) => dispatch({ type: "merge", patch: { playbackState } }));
    socket.on(SocketEvents.PLAYBACK_SEEKED, ({ playbackState }) => dispatch({ type: "merge", patch: { playbackState } }));

    socket.on(SocketEvents.USER_TYPING, ({ sessionId: typingSessionId, displayName, isTyping }) => {
      dispatch({ type: "typing", sessionId: typingSessionId, displayName, isTyping });
    });

    socket.on(SocketEvents.MESSAGE_RECEIVED, ({ message }) => dispatch({ type: "message_received", message }));

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
      socket.off(SocketEvents.USER_TYPING);
      socket.off(SocketEvents.MESSAGE_RECEIVED);
      socket.off(SocketEvents.ERROR);
      socket.disconnect();
      joined.current = false;
    };
  }, [roomId, sessionId]);

  return state;
}
