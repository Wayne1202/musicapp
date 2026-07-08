"use client";

import { useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { SocketEvents } from "@musicapp/shared";
import type { ChatMessageDTO, PresenceStateDTO, RoomDTO, VoteSkipStateDTO } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

interface RoomSocketState {
  room: RoomDTO | null;
  connected: boolean;
  error: string | null;
  messages: ChatMessageDTO[];
  /** sessionId -> presence, for everyone currently in the room. */
  presence: Record<string, PresenceStateDTO>;
  roomEnded: boolean;
  vote: VoteSkipStateDTO | null;
}

type Action =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "room_state"; room: RoomDTO }
  | { type: "merge"; patch: Partial<RoomDTO> }
  | { type: "error"; message: string }
  | { type: "message_received"; message: ChatMessageDTO }
  | { type: "presence_changed"; presence: PresenceStateDTO }
  | { type: "presence_snapshot"; presence: PresenceStateDTO[] }
  | { type: "room_ended" }
  | { type: "vote_update"; vote: VoteSkipStateDTO }
  | { type: "vote_resolved" };

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
    case "presence_changed":
      return { ...state, presence: { ...state.presence, [action.presence.sessionId]: action.presence } };
    case "presence_snapshot": {
      const presence: Record<string, PresenceStateDTO> = {};
      for (const entry of action.presence) presence[entry.sessionId] = entry;
      return { ...state, presence };
    }
    case "room_ended":
      return { ...state, roomEnded: true };
    case "vote_update":
      return { ...state, vote: action.vote };
    case "vote_resolved":
      return { ...state, vote: null };
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
    presence: {},
    roomEnded: false,
    vote: null,
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

    socket.on(SocketEvents.PRESENCE_CHANGED, ({ presence }) => dispatch({ type: "presence_changed", presence }));
    socket.on(SocketEvents.PRESENCE_SNAPSHOT, ({ presence }) => dispatch({ type: "presence_snapshot", presence }));

    socket.on(SocketEvents.MESSAGE_RECEIVED, ({ message }) => dispatch({ type: "message_received", message }));

    socket.on(SocketEvents.HOST_CHANGED, ({ hostSessionId, hostName }) => {
      dispatch({ type: "merge", patch: { hostSessionId } });
      toast(`${hostName} is now the host`);
    });

    socket.on(SocketEvents.ROOM_ENDED, () => {
      dispatch({ type: "room_ended" });
    });

    socket.on(SocketEvents.VOTE_SKIP_UPDATE, ({ vote }) => dispatch({ type: "vote_update", vote }));
    socket.on(SocketEvents.VOTE_SKIP_RESOLVED, ({ passed }) => {
      dispatch({ type: "vote_resolved" });
      toast(passed ? "Vote passed — song skipped" : "Vote to skip didn't reach a majority");
    });

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
      socket.off(SocketEvents.PRESENCE_CHANGED);
      socket.off(SocketEvents.PRESENCE_SNAPSHOT);
      socket.off(SocketEvents.MESSAGE_RECEIVED);
      socket.off(SocketEvents.HOST_CHANGED);
      socket.off(SocketEvents.ROOM_ENDED);
      socket.off(SocketEvents.VOTE_SKIP_UPDATE);
      socket.off(SocketEvents.VOTE_SKIP_RESOLVED);
      socket.off(SocketEvents.ERROR);
      socket.disconnect();
      joined.current = false;
    };
  }, [roomId, sessionId]);

  return state;
}
