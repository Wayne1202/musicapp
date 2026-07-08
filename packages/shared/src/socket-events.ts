import type {
  ChatMessageDTO,
  PlaybackStateDTO,
  PresenceActivity,
  PresenceStateDTO,
  PresenceStatus,
  QueueChangeReason,
  QueueItemDTO,
  ReactionEmoji,
  RoomDTO,
  UpdateRoomSettingsRequest,
  UserSessionDTO,
  VoteSkipStateDTO,
} from "./types";

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
  SEND_MESSAGE: "send_message",
  TRANSFER_HOST: "transfer_host",
  END_ROOM: "end_room",
  UPDATE_ROOM_SETTINGS: "update_room_settings",
  SET_QUEUE_LOCK: "set_queue_lock",
  VOTE_SKIP_START: "vote_skip_start",
  VOTE_SKIP_CAST: "vote_skip_cast",
  PRESENCE_UPDATE: "presence_update",
  SEND_REACTION: "send_reaction",

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
  MESSAGE_RECEIVED: "message_received",
  HOST_CHANGED: "host_changed",
  ROOM_ENDED: "room_ended",
  VOTE_SKIP_UPDATE: "vote_skip_update",
  VOTE_SKIP_RESOLVED: "vote_skip_resolved",
  PRESENCE_CHANGED: "presence_changed",
  PRESENCE_SNAPSHOT: "presence_snapshot",
  REACTION_RECEIVED: "reaction_received",
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

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

export interface MessageReceivedPayload {
  message: ChatMessageDTO;
}

export interface TransferHostPayload {
  roomId: string;
  targetSessionId: string;
}

export interface EndRoomPayload {
  roomId: string;
}

export interface HostChangedPayload {
  hostSessionId: string;
  hostName: string;
}

export interface RoomEndedPayload {
  roomId: string;
}

export interface UpdateRoomSettingsPayload {
  roomId: string;
  settings: UpdateRoomSettingsRequest;
}

export interface SetQueueLockPayload {
  roomId: string;
  locked: boolean;
}

export interface VoteSkipStartPayload {
  roomId: string;
}

export interface VoteSkipCastPayload {
  roomId: string;
}

export interface VoteSkipUpdatePayload {
  vote: VoteSkipStateDTO;
}

export interface VoteSkipResolvedPayload {
  passed: boolean;
}

export interface PresenceUpdatePayload {
  roomId: string;
  status?: PresenceStatus;
  activity?: PresenceActivity;
}

export interface PresenceChangedPayload {
  presence: PresenceStateDTO;
}

export interface PresenceSnapshotPayload {
  presence: PresenceStateDTO[];
}

export interface SendReactionPayload {
  roomId: string;
  emoji: ReactionEmoji;
}

export interface ReactionReceivedPayload {
  id: string;
  sessionId: string;
  displayName: string;
  emoji: ReactionEmoji;
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
  [SocketEvents.MESSAGE_RECEIVED]: (payload: MessageReceivedPayload) => void;
  [SocketEvents.HOST_CHANGED]: (payload: HostChangedPayload) => void;
  [SocketEvents.ROOM_ENDED]: (payload: RoomEndedPayload) => void;
  [SocketEvents.VOTE_SKIP_UPDATE]: (payload: VoteSkipUpdatePayload) => void;
  [SocketEvents.VOTE_SKIP_RESOLVED]: (payload: VoteSkipResolvedPayload) => void;
  [SocketEvents.PRESENCE_CHANGED]: (payload: PresenceChangedPayload) => void;
  [SocketEvents.PRESENCE_SNAPSHOT]: (payload: PresenceSnapshotPayload) => void;
  [SocketEvents.REACTION_RECEIVED]: (payload: ReactionReceivedPayload) => void;
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
  [SocketEvents.SEND_MESSAGE]: (payload: SendMessagePayload) => void;
  [SocketEvents.TRANSFER_HOST]: (payload: TransferHostPayload) => void;
  [SocketEvents.END_ROOM]: (payload: EndRoomPayload) => void;
  [SocketEvents.UPDATE_ROOM_SETTINGS]: (payload: UpdateRoomSettingsPayload) => void;
  [SocketEvents.SET_QUEUE_LOCK]: (payload: SetQueueLockPayload) => void;
  [SocketEvents.VOTE_SKIP_START]: (payload: VoteSkipStartPayload) => void;
  [SocketEvents.VOTE_SKIP_CAST]: (payload: VoteSkipCastPayload) => void;
  [SocketEvents.PRESENCE_UPDATE]: (payload: PresenceUpdatePayload) => void;
  [SocketEvents.SEND_REACTION]: (payload: SendReactionPayload) => void;
}
