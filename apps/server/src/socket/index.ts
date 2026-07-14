import { SocketEvents, canChangeRoomSettings, canSkipInstantly, isHost } from "@musicapp/shared";
import type {
  EndRoomPayload,
  JoinRoomPayload,
  PlaybackActionPayload,
  PresenceActivity,
  PresenceStateDTO,
  PresenceStatus,
  PresenceUpdatePayload,
  SendMessagePayload,
  SendReactionPayload,
  SetQueueLockPayload,
  SkipSongPayload,
  TransferHostPayload,
  UpdateRoomSettingsPayload,
  VoteSkipCastPayload,
  VoteSkipStartPayload,
  VoteSkipStateDTO,
} from "@musicapp/shared";
import {
  becomeHostIfNone,
  endRoom,
  getRoomDTOById,
  getRoomRecord,
  getOnlineUsers,
  getSessionById,
  reassignHostOnDisconnect,
  setQueueLock,
  setSessionOnlineStatus,
  transferHost,
  updateRoomSettings,
} from "../services/roomService";
import { getQueue } from "../services/queueService";
import { advanceToNextSong, getLivePlaybackState, pause, play, seek } from "../services/playbackService";
import { sendMessage, sendSystemMessage } from "../services/chatService";
import { recordRoomEvent } from "../services/roomEventService";
import { assertValidReaction, isReactionAllowed } from "../services/reactionService";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { HttpError } from "../lib/http-error";
import type { TypedServer, TypedSocket } from "../types/socket";

// Ephemeral per-room presence (status + activity: typing in chat, adding a song, editing the
// queue). Not persisted — same tier as lastAdvanceAtByRoom below — a snapshot is handed to
// each new joiner via PRESENCE_SNAPSHOT since there's nothing in the DB to read it back from.
const presenceByRoom = new Map<string, Map<string, PresenceStateDTO>>();
const presenceIdleTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const PRESENCE_IDLE_TIMEOUT_MS = 4000;

function getRoomPresence(roomId: string): Map<string, PresenceStateDTO> {
  let room = presenceByRoom.get(roomId);
  if (!room) {
    room = new Map();
    presenceByRoom.set(roomId, room);
  }
  return room;
}

function setPresence(
  roomId: string,
  sessionId: string,
  displayName: string,
  patch: { status?: PresenceStatus; activity?: PresenceActivity },
): PresenceStateDTO {
  const room = getRoomPresence(roomId);
  const current = room.get(sessionId) ?? { sessionId, displayName, status: "online" as const, activity: "idle" as const };
  const next: PresenceStateDTO = { ...current, displayName, ...patch };
  room.set(sessionId, next);
  return next;
}

function clearPresence(roomId: string, sessionId: string) {
  presenceByRoom.get(roomId)?.delete(sessionId);
  const timeout = presenceIdleTimeouts.get(sessionId);
  if (timeout) {
    clearTimeout(timeout);
    presenceIdleTimeouts.delete(sessionId);
  }
}

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

// Auto-ends a room that's sat with zero online users for this long, instead of leaving
// abandoned rooms ACTIVE forever. In-memory, same tier as every other per-room timer in this
// file — resets on a server restart, an accepted trade-off given the single-instance
// deployment (see CLAUDE.md). Scheduled when the last person disconnects, cancelled the moment
// anyone (re)joins.
const AUTO_END_EMPTY_ROOM_MS = 60 * 60 * 1000; // 1 hour
const roomEmptyTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function cancelAutoEnd(roomId: string) {
  const timeout = roomEmptyTimeouts.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    roomEmptyTimeouts.delete(roomId);
  }
}

function scheduleAutoEnd(io: TypedServer, roomId: string) {
  cancelAutoEnd(roomId);
  roomEmptyTimeouts.set(
    roomId,
    setTimeout(async () => {
      roomEmptyTimeouts.delete(roomId);
      try {
        // Re-check on fire — someone may have rejoined without cancelAutoEnd racing ahead of
        // this callback, or the room may have already been ended some other way.
        const [room, onlineUsers] = await Promise.all([getRoomRecord(roomId), getOnlineUsers(roomId)]);
        if (room.status !== "ACTIVE" || onlineUsers.length > 0) return;

        await endRoom(roomId);
        const { message } = await recordRoomEvent(roomId, "ROOM_ENDED", {});
        if (message) io.to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
        io.to(roomId).emit(SocketEvents.ROOM_ENDED, { roomId });
      } catch (err) {
        logger.error("socket", "auto-end empty room failed", err);
      }
    }, AUTO_END_EMPTY_ROOM_MS),
  );
}

// Ephemeral vote-to-skip state, one active vote per room at a time — same in-memory tier as
// presence/advance-debounce above (acceptable given the single-instance deployment, see
// CLAUDE.md). `timeout` auto-resolves the vote as failed if it never reaches a majority.
interface VoteSkipState {
  initiatorId: string;
  initiatorName: string;
  votes: Set<string>;
  expiresAt: number;
  timeout: ReturnType<typeof setTimeout>;
}
const voteSkipByRoom = new Map<string, VoteSkipState>();
const VOTE_SKIP_TIMEOUT_MS = 30_000;

function requiredVotes(onlineCount: number): number {
  return Math.floor(onlineCount / 2) + 1;
}

async function serializeVote(roomId: string, vote: VoteSkipState): Promise<VoteSkipStateDTO> {
  const onlineUsers = await getOnlineUsers(roomId);
  return {
    initiatorId: vote.initiatorId,
    initiatorName: vote.initiatorName,
    votes: Array.from(vote.votes),
    required: requiredVotes(onlineUsers.length),
    totalOnline: onlineUsers.length,
    expiresAt: new Date(vote.expiresAt).toISOString(),
  };
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
        socket.data.displayName = session.displayName;
        await socket.join(payload.roomId);
        await setSessionOnlineStatus(payload.sessionId, true);
        // Reconnect path: if the room currently has no host (e.g. everyone had left), this
        // joiner claims it. New-room-creation and join-by-code already set a host directly.
        await becomeHostIfNone(payload.roomId, payload.sessionId);
        cancelAutoEnd(payload.roomId);

        const room = await getRoomDTOById(payload.roomId);
        socket.emit(SocketEvents.ROOM_STATE, { room });

        setPresence(payload.roomId, payload.sessionId, session.displayName, { status: "online", activity: "idle" });
        socket.emit(SocketEvents.PRESENCE_SNAPSHOT, {
          presence: Array.from(getRoomPresence(payload.roomId).values()),
        });

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

        // Recorded for Room History but not mirrored into chat — join/leave on every
        // reconnect (page refresh, tab reopen) made the chat stream unusably noisy; the
        // existing USER_JOINED toast already covers this moment for anyone watching live.
        await recordRoomEvent(payload.roomId, "JOINED", { actorName: session.displayName, postToChat: false });
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

    const advanceQueue = async (roomId: string) => {
      const { playbackState, usedFallback } = await advanceToNextSong(roomId);
      const queue = await getQueue(roomId);
      io.to(roomId).emit(SocketEvents.SONG_CHANGED, { playbackState, queue });
      if (usedFallback) {
        const message = await sendSystemMessage(roomId, "Queue's empty — playing something while you add more 🎲");
        io.to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
      }
    };

    const resolveVote = async (roomId: string, passed: boolean) => {
      const vote = voteSkipByRoom.get(roomId);
      if (!vote) return;
      clearTimeout(vote.timeout);
      voteSkipByRoom.delete(roomId);

      if (passed) {
        const outgoing = await getLivePlaybackState(roomId);
        await advanceQueue(roomId);
        const { message } = await recordRoomEvent(roomId, "VOTE_SKIP_PASSED", {
          targetName: outgoing.currentTitle ?? undefined,
        });
        if (message) io.to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
      } else {
        const message = await sendSystemMessage(roomId, "Vote to skip didn't reach a majority");
        io.to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
      }
      io.to(roomId).emit(SocketEvents.VOTE_SKIP_RESOLVED, { passed });
    };

    socket.on(SocketEvents.VOTE_SKIP_START, async (payload: VoteSkipStartPayload) => {
      const { sessionId, displayName } = socket.data;
      if (!sessionId || !displayName) return;
      try {
        const existing = voteSkipByRoom.get(payload.roomId);
        if (existing) {
          io.to(payload.roomId).emit(SocketEvents.VOTE_SKIP_UPDATE, {
            vote: await serializeVote(payload.roomId, existing),
          });
          return;
        }

        const vote: VoteSkipState = {
          initiatorId: sessionId,
          initiatorName: displayName,
          votes: new Set([sessionId]),
          expiresAt: Date.now() + VOTE_SKIP_TIMEOUT_MS,
          timeout: setTimeout(() => {
            resolveVote(payload.roomId, false).catch((err) => logger.error("socket", "vote timeout resolve failed", err));
          }, VOTE_SKIP_TIMEOUT_MS),
        };
        voteSkipByRoom.set(payload.roomId, vote);

        const message = await sendSystemMessage(payload.roomId, `${displayName} started a vote to skip`);
        io.to(payload.roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });

        const serialized = await serializeVote(payload.roomId, vote);
        io.to(payload.roomId).emit(SocketEvents.VOTE_SKIP_UPDATE, { vote: serialized });
        if (vote.votes.size >= serialized.required) await resolveVote(payload.roomId, true);
      } catch (err) {
        logger.error("socket", "vote_skip_start failed", err);
        socket.emit(SocketEvents.ERROR, { message: "Failed to start vote" });
      }
    });

    socket.on(SocketEvents.VOTE_SKIP_CAST, async (payload: VoteSkipCastPayload) => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      try {
        const vote = voteSkipByRoom.get(payload.roomId);
        if (!vote) return;
        if (vote.votes.has(sessionId)) return; // no duplicate votes

        vote.votes.add(sessionId);
        const serialized = await serializeVote(payload.roomId, vote);
        io.to(payload.roomId).emit(SocketEvents.VOTE_SKIP_UPDATE, { vote: serialized });
        if (vote.votes.size >= serialized.required) await resolveVote(payload.roomId, true);
      } catch (err) {
        logger.error("socket", "vote_skip_cast failed", err);
        socket.emit(SocketEvents.ERROR, { message: "Failed to cast vote" });
      }
    });

    // Natural end-of-video, reported by any client's player — not a volitional "skip" action,
    // so no permission gate and no "X skipped a song" system message.
    socket.on(SocketEvents.SONG_ENDED, async (payload: SkipSongPayload) => {
      if (!shouldAdvance(payload.roomId)) return;
      try {
        await advanceQueue(payload.roomId);
      } catch (err) {
        logger.error("socket", "advance song failed", err);
        socket.emit(SocketEvents.ERROR, { message: "Failed to advance to next song" });
      }
    });

    // Explicit skip button — gated by the room's skipMode (host-only / vote / anyone).
    socket.on(SocketEvents.SKIP_SONG, async (payload: SkipSongPayload) => {
      const { sessionId, displayName } = socket.data;
      if (!sessionId || !displayName) return;
      try {
        const room = await getRoomRecord(payload.roomId);
        if (!canSkipInstantly(room, sessionId)) {
          socket.emit(SocketEvents.ERROR, {
            message: "Only the host can skip right now — start a vote to skip instead.",
          });
          return;
        }
        if (!shouldAdvance(payload.roomId)) return;
        await advanceQueue(payload.roomId);
        const message = await sendSystemMessage(payload.roomId, `${displayName} skipped a song`);
        io.to(payload.roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
      } catch (err) {
        logger.error("socket", "skip song failed", err);
        socket.emit(SocketEvents.ERROR, { message: "Failed to advance to next song" });
      }
    });

    socket.on(SocketEvents.TRANSFER_HOST, async (payload: TransferHostPayload) => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      try {
        const room = await getRoomRecord(payload.roomId);
        if (!isHost(room, sessionId)) {
          socket.emit(SocketEvents.ERROR, { message: "Only the host can transfer host" });
          return;
        }
        const newHost = await transferHost(payload.roomId, payload.targetSessionId);
        io.to(payload.roomId).emit(SocketEvents.HOST_CHANGED, {
          hostSessionId: newHost.id,
          hostName: newHost.displayName,
        });
        const { message } = await recordRoomEvent(payload.roomId, "HOST_TRANSFERRED", {
          targetName: newHost.displayName,
        });
        if (message) io.to(payload.roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Failed to transfer host";
        if (!(err instanceof HttpError)) logger.error("socket", "transfer_host failed", err);
        socket.emit(SocketEvents.ERROR, { message: errMessage });
      }
    });

    socket.on(SocketEvents.END_ROOM, async (payload: EndRoomPayload) => {
      const { sessionId, displayName } = socket.data;
      if (!sessionId) return;
      try {
        const room = await getRoomRecord(payload.roomId);
        if (!isHost(room, sessionId)) {
          socket.emit(SocketEvents.ERROR, { message: "Only the host can end the room" });
          return;
        }
        await endRoom(payload.roomId);
        const { message } = await recordRoomEvent(payload.roomId, "ROOM_ENDED", { actorName: displayName });
        if (message) io.to(payload.roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
        io.to(payload.roomId).emit(SocketEvents.ROOM_ENDED, { roomId: payload.roomId });
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Failed to end room";
        if (!(err instanceof HttpError)) logger.error("socket", "end_room failed", err);
        socket.emit(SocketEvents.ERROR, { message: errMessage });
      }
    });

    socket.on(SocketEvents.UPDATE_ROOM_SETTINGS, async (payload: UpdateRoomSettingsPayload) => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      try {
        const room = await getRoomRecord(payload.roomId);
        if (!canChangeRoomSettings(room, sessionId)) {
          socket.emit(SocketEvents.ERROR, { message: "Only the host can change room settings" });
          return;
        }
        await updateRoomSettings(payload.roomId, payload.settings);
        const updatedRoom = await getRoomDTOById(payload.roomId);
        io.to(payload.roomId).emit(SocketEvents.ROOM_STATE, { room: updatedRoom });
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Failed to update room settings";
        if (!(err instanceof HttpError)) logger.error("socket", "update_room_settings failed", err);
        socket.emit(SocketEvents.ERROR, { message: errMessage });
      }
    });

    socket.on(SocketEvents.SET_QUEUE_LOCK, async (payload: SetQueueLockPayload) => {
      const { sessionId, displayName } = socket.data;
      if (!sessionId) return;
      try {
        const room = await getRoomRecord(payload.roomId);
        if (!isHost(room, sessionId)) {
          socket.emit(SocketEvents.ERROR, { message: "Only the host can lock or unlock the queue" });
          return;
        }
        await setQueueLock(payload.roomId, payload.locked);
        const updatedRoom = await getRoomDTOById(payload.roomId);
        io.to(payload.roomId).emit(SocketEvents.ROOM_STATE, { room: updatedRoom });

        const { message } = await recordRoomEvent(payload.roomId, payload.locked ? "QUEUE_LOCKED" : "QUEUE_UNLOCKED", {
          actorName: displayName,
        });
        if (message) io.to(payload.roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Failed to update the queue lock";
        if (!(err instanceof HttpError)) logger.error("socket", "set_queue_lock failed", err);
        socket.emit(SocketEvents.ERROR, { message: errMessage });
      }
    });

    socket.on(SocketEvents.PRESENCE_UPDATE, ({ roomId, status, activity }: PresenceUpdatePayload) => {
      const { sessionId, displayName } = socket.data;
      if (!sessionId || !displayName) return;

      const state = setPresence(roomId, sessionId, displayName, {
        ...(status ? { status } : {}),
        ...(activity ? { activity } : {}),
      });
      socket.to(roomId).emit(SocketEvents.PRESENCE_CHANGED, { presence: state });

      const existingTimeout = presenceIdleTimeouts.get(sessionId);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Safety net matching the old typing-indicator behavior: if a client goes silent mid-activity
      // (closed tab, lost connection) without explicitly clearing it, fall back to idle instead of
      // leaving "X is typing…" / "X is editing the queue…" stuck forever.
      if (activity && activity !== "idle") {
        presenceIdleTimeouts.set(
          sessionId,
          setTimeout(() => {
            const idleState = setPresence(roomId, sessionId, displayName, { activity: "idle" });
            socket.to(roomId).emit(SocketEvents.PRESENCE_CHANGED, { presence: idleState });
            presenceIdleTimeouts.delete(sessionId);
          }, PRESENCE_IDLE_TIMEOUT_MS),
        );
      }
    });

    socket.on(SocketEvents.SEND_REACTION, async (payload: SendReactionPayload) => {
      const { sessionId, displayName } = socket.data;
      if (!sessionId || !displayName) return;
      try {
        assertValidReaction(payload.emoji);
        if (!isReactionAllowed(sessionId)) return;

        const room = await getRoomRecord(payload.roomId);
        if (!room.reactionsEnabled) return;

        io.to(payload.roomId).emit(SocketEvents.REACTION_RECEIVED, {
          id: randomUUID(),
          sessionId,
          displayName,
          emoji: payload.emoji,
        });
      } catch (err) {
        if (!(err instanceof HttpError)) logger.error("socket", "send_reaction failed", err);
      }
    });

    socket.on(SocketEvents.SEND_MESSAGE, async ({ roomId, content }: SendMessagePayload) => {
      const { sessionId, displayName } = socket.data;
      if (!sessionId || !displayName) return;
      try {
        const room = await getRoomRecord(roomId);
        if (!room.chatEnabled) {
          socket.emit(SocketEvents.ERROR, { message: "Chat is disabled for this room" });
          return;
        }
        const message = await sendMessage(roomId, sessionId, displayName, content);
        io.to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message });
      } catch (err) {
        // HttpError messages here are validation feedback (e.g. "message too long") that's
        // fine to show as-is; anything else is unexpected and worth logging server-side too.
        const errMessage = err instanceof Error ? err.message : "Failed to send message";
        if (!(err instanceof HttpError)) logger.error("socket", "send_message failed", err);
        socket.emit(SocketEvents.ERROR, { message: errMessage });
      }
    });

    socket.on("disconnect", async () => {
      const { roomId, sessionId } = socket.data;
      if (!roomId || !sessionId) return;

      // Captured synchronously, before any await, so it reflects the instant this socket
      // actually dropped — used below to detect a reconnect that raced ahead of us.
      const disconnectedAt = new Date();

      try {
        // Another tab/connection for the same session may still be open; only mark
        // offline if no other sockets in this room belong to the same session.
        const socketsInRoom = await io.in(roomId).fetchSockets();
        const stillConnected = socketsInRoom.some((s) => s.data.sessionId === sessionId);
        if (stillConnected) return;

        // A page refresh tears down this socket and immediately opens a new one, which
        // races this handler's disconnect-detection against the new socket's join_room.
        // If a fresh join/heartbeat already landed after we detected the disconnect, that
        // reconnect is authoritative — writing "offline" now would incorrectly clobber it
        // (this is what caused online counts to briefly show 0 right after a reload).
        const session = await getSessionById(sessionId);
        if (session && session.lastSeenAt > disconnectedAt) return;

        await setSessionOnlineStatus(sessionId, false);
        clearPresence(roomId, sessionId);
        const onlineUsers = await getOnlineUsers(roomId);
        io.to(roomId).emit(SocketEvents.USER_LEFT, { sessionId, onlineUsers });
        if (onlineUsers.length === 0) scheduleAutoEnd(io, roomId);

        const activeVote = voteSkipByRoom.get(roomId);
        if (activeVote) {
          activeVote.votes.delete(sessionId);
          if (onlineUsers.length === 0) {
            clearTimeout(activeVote.timeout);
            voteSkipByRoom.delete(roomId);
          } else {
            const serialized = await serializeVote(roomId, activeVote);
            io.to(roomId).emit(SocketEvents.VOTE_SKIP_UPDATE, { vote: serialized });
            if (activeVote.votes.size >= serialized.required) await resolveVote(roomId, true);
          }
        }

        // Recorded for Room History but not mirrored into chat — same reasoning as JOINED above.
        await recordRoomEvent(roomId, "LEFT", { actorName: socket.data.displayName, postToChat: false });

        const newHost = await reassignHostOnDisconnect(roomId, sessionId, onlineUsers);
        if (newHost) {
          io.to(roomId).emit(SocketEvents.HOST_CHANGED, { hostSessionId: newHost.id, hostName: newHost.displayName });
          const { message: hostMessage } = await recordRoomEvent(roomId, "HOST_TRANSFERRED", {
            targetName: newHost.displayName,
          });
          if (hostMessage) io.to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, { message: hostMessage });
        }
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
