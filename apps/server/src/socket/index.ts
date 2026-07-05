import { SocketEvents } from "@musicapp/shared";
import type {
  JoinRoomPayload,
  PlaybackActionPayload,
  SkipSongPayload,
} from "@musicapp/shared";
import {
  getRoomDTOById,
  getOnlineUsers,
  getSessionById,
  setSessionOnlineStatus,
} from "../services/roomService";
import { getQueue } from "../services/queueService";
import { advanceToNextSong, getLivePlaybackState, pause, play, seek } from "../services/playbackService";
import { logger } from "../lib/logger";
import type { TypedServer, TypedSocket } from "../types/socket";

// Every client in a room independently detects "song ended" / may click skip at the same
// moment, which would each try to advance the queue. Debounce per room so a burst of these
// within a short window only advances once.
const lastAdvanceAtByRoom = new Map<string, number>();
const ADVANCE_DEBOUNCE_MS = 2000;

function shouldAdvance(roomId: string): boolean {
  const now = Date.now();
  const last = lastAdvanceAtByRoom.get(roomId) ?? 0;
  if (now - last < ADVANCE_DEBOUNCE_MS) return false;
  lastAdvanceAtByRoom.set(roomId, now);
  return true;
}

export function registerSocketHandlers(io: TypedServer) {
  io.on("connection", (socket: TypedSocket) => {
    socket.on(SocketEvents.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      try {
        const session = await getSessionById(payload.sessionId);
        if (!session || session.roomId !== payload.roomId) {
          socket.emit(SocketEvents.ERROR, { message: "Invalid session for this room" });
          return;
        }

        socket.data.roomId = payload.roomId;
        socket.data.sessionId = payload.sessionId;
        await socket.join(payload.roomId);
        await setSessionOnlineStatus(payload.sessionId, true);

        const room = await getRoomDTOById(payload.roomId);
        socket.emit(SocketEvents.ROOM_STATE, { room });

        const onlineUsers = await getOnlineUsers(payload.roomId);
        socket.to(payload.roomId).emit(SocketEvents.USER_JOINED, {
          user: {
            id: session.id,
            displayName: session.displayName,
            roomId: session.roomId,
            createdAt: session.createdAt.toISOString(),
          },
          onlineUsers,
        });
      } catch (err) {
        logger.error("socket", "join_room failed", err);
        socket.emit(SocketEvents.ERROR, { message: "Failed to join room" });
      }
    });

    // Refreshes lastSeenAt while genuinely connected, so getOnlineUsers can distinguish a
    // truly-gone session from one whose graceful `disconnect` never fired (e.g. the server
    // process was killed) without waiting indefinitely.
    socket.on(SocketEvents.HEARTBEAT, async () => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      try {
        await setSessionOnlineStatus(sessionId, true);
      } catch (err) {
        logger.error("socket", "heartbeat failed", err);
      }
    });

    socket.on(SocketEvents.PLAYBACK_PLAY, (payload: PlaybackActionPayload) =>
      handlePlaybackAction(socket, payload, play, SocketEvents.PLAYBACK_STARTED),
    );

    socket.on(SocketEvents.PLAYBACK_PAUSE, (payload: PlaybackActionPayload) =>
      handlePlaybackAction(socket, payload, pause, SocketEvents.PLAYBACK_PAUSED),
    );

    socket.on(SocketEvents.PLAYBACK_SEEK, (payload: PlaybackActionPayload) =>
      handlePlaybackAction(socket, payload, seek, SocketEvents.PLAYBACK_SEEKED),
    );

    socket.on(SocketEvents.PLAYBACK_SYNC_REQUEST, async ({ roomId }: { roomId: string }) => {
      try {
        const playbackState = await getLivePlaybackState(roomId);
        socket.emit(SocketEvents.PLAYBACK_STARTED, { playbackState });
      } catch (err) {
        logger.error("socket", "playback_sync_request failed", err);
      }
    });

    const handleAdvance = async (payload: SkipSongPayload) => {
      if (!shouldAdvance(payload.roomId)) return;
      try {
        const { playbackState } = await advanceToNextSong(payload.roomId);
        const queue = await getQueue(payload.roomId);
        io.to(payload.roomId).emit(SocketEvents.SONG_CHANGED, { playbackState, queue });
      } catch (err) {
        logger.error("socket", "advance song failed", err);
        socket.emit(SocketEvents.ERROR, { message: "Failed to advance to next song" });
      }
    };

    socket.on(SocketEvents.SONG_ENDED, handleAdvance);
    socket.on(SocketEvents.SKIP_SONG, handleAdvance);

    socket.on("disconnect", async () => {
      const { roomId, sessionId } = socket.data;
      if (!roomId || !sessionId) return;

      try {
        // Another tab/connection for the same session may still be open; only mark
        // offline if no other sockets in this room belong to the same session.
        const socketsInRoom = await io.in(roomId).fetchSockets();
        const stillConnected = socketsInRoom.some((s) => s.data.sessionId === sessionId);
        if (stillConnected) return;

        await setSessionOnlineStatus(sessionId, false);
        const onlineUsers = await getOnlineUsers(roomId);
        io.to(roomId).emit(SocketEvents.USER_LEFT, { sessionId, onlineUsers });
      } catch (err) {
        logger.error("socket", "disconnect handling failed", err);
      }
    });
  });
}

async function handlePlaybackAction(
  socket: TypedSocket,
  payload: PlaybackActionPayload,
  action: (roomId: string, timestamp: number) => ReturnType<typeof play>,
  eventName: typeof SocketEvents.PLAYBACK_STARTED | typeof SocketEvents.PLAYBACK_PAUSED | typeof SocketEvents.PLAYBACK_SEEKED,
) {
  try {
    const playbackState = await action(payload.roomId, payload.timestamp);
    socket.nsp.to(payload.roomId).emit(eventName, { playbackState });
  } catch (err) {
    logger.error("socket", `${eventName} failed`, err);
    socket.emit(SocketEvents.ERROR, { message: "Playback update failed" });
  }
}
