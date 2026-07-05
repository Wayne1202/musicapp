import type { ChatMessageDTO, PlaybackStateDTO, QueueChangeReason, QueueItemDTO, RoomDTO, UserSessionDTO } from "./types";

// Event name constants shared by client and server so both sides stay in sync.
export const SocketEvents = {
  // --- Client -> Server ---
  JOIN_ROOM: "join_room",
  HEARTBEAT: "heartbeat",
  PLAYBACK_PLAY: "playback_play",
  PLAYBACK_PAUSE: "playback_pause",
  PLAYBACK_SEEK: "playback_seek",
  PLAYBACK_SYNC_REQUEST: "playback_sync_request",
  SONG_ENDED: "song_ended",
  SKIP_SONG: "skip_song",
  TYPING: "typing",
  SEND_MESSAGE: "send_message",

  // --- Server -> Client ---
  ROOM_STATE: "room_state",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  SONG_ADDED: "song_added",
  QUEUE_UPDATED: "queue_updated",
  SONG_CHANGED: "song_changed",
  PLAYBACK_STARTED: "playback_started",
  PLAYBACK_PAUSED: "playback_paused",
  PLAYBACK_SEEKED: "playback_seeked",
  USER_TYPING: "user_typing",
  MESSAGE_RECEIVED: "message_received",
  ERROR: "error_event",
} as const;

export interface JoinRoomPayload {
  roomId: string;
  sessionId: string;
}

export interface PlaybackActionPayload {
  roomId: string;
  timestamp: number;
}

export interface SkipSongPayload {
  roomId: string;
}

export interface RoomStatePayload {
  room: RoomDTO;
}

export interface UserJoinedPayload {
  user: UserSessionDTO;
  onlineUsers: UserSessionDTO[];
}

export interface UserLeftPayload {
  sessionId: string;
  onlineUsers: UserSessionDTO[];
}

export interface SongAddedPayload {
  queueItem: QueueItemDTO;
  queue: QueueItemDTO[];
}

export interface QueueUpdatedPayload {
  queue: QueueItemDTO[];
  reason?: QueueChangeReason;
}

export interface SongChangedPayload {
  playbackState: PlaybackStateDTO;
  queue: QueueItemDTO[];
}

export interface PlaybackStartedPayload {
  playbackState: PlaybackStateDTO;
}

export interface PlaybackPausedPayload {
  playbackState: PlaybackStateDTO;
}

export interface PlaybackSeekedPayload {
  playbackState: PlaybackStateDTO;
}

export interface ErrorEventPayload {
  message: string;
}

export interface TypingPayload {
  roomId: string;
  isTyping: boolean;
}

export interface UserTypingPayload {
  sessionId: string;
  displayName: string;
  isTyping: boolean;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

export interface MessageReceivedPayload {
  message: ChatMessageDTO;
}

// Typed maps for use with socket.io-client's generic Socket<ListenEvents, EmitEvents>.
export interface ServerToClientEvents {
  [SocketEvents.ROOM_STATE]: (payload: RoomStatePayload) => void;
  [SocketEvents.USER_JOINED]: (payload: UserJoinedPayload) => void;
  [SocketEvents.USER_LEFT]: (payload: UserLeftPayload) => void;
  [SocketEvents.SONG_ADDED]: (payload: SongAddedPayload) => void;
  [SocketEvents.QUEUE_UPDATED]: (payload: QueueUpdatedPayload) => void;
  [SocketEvents.SONG_CHANGED]: (payload: SongChangedPayload) => void;
  [SocketEvents.PLAYBACK_STARTED]: (payload: PlaybackStartedPayload) => void;
  [SocketEvents.PLAYBACK_PAUSED]: (payload: PlaybackPausedPayload) => void;
  [SocketEvents.PLAYBACK_SEEKED]: (payload: PlaybackSeekedPayload) => void;
  [SocketEvents.USER_TYPING]: (payload: UserTypingPayload) => void;
  [SocketEvents.MESSAGE_RECEIVED]: (payload: MessageReceivedPayload) => void;
  [SocketEvents.ERROR]: (payload: ErrorEventPayload) => void;
}

export interface ClientToServerEvents {
  [SocketEvents.JOIN_ROOM]: (payload: JoinRoomPayload) => void;
  [SocketEvents.HEARTBEAT]: () => void;
  [SocketEvents.PLAYBACK_PLAY]: (payload: PlaybackActionPayload) => void;
  [SocketEvents.PLAYBACK_PAUSE]: (payload: PlaybackActionPayload) => void;
  [SocketEvents.PLAYBACK_SEEK]: (payload: PlaybackActionPayload) => void;
  [SocketEvents.PLAYBACK_SYNC_REQUEST]: (payload: { roomId: string }) => void;
  [SocketEvents.SONG_ENDED]: (payload: SkipSongPayload) => void;
  [SocketEvents.SKIP_SONG]: (payload: SkipSongPayload) => void;
  [SocketEvents.TYPING]: (payload: TypingPayload) => void;
  [SocketEvents.SEND_MESSAGE]: (payload: SendMessagePayload) => void;
}
