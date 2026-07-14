// Core domain types shared between the server and the web client.

export interface UserSessionDTO {
  id: string;
  displayName: string;
  roomId: string;
  createdAt: string;
}

export interface QueueItemDTO {
  id: string;
  roomId: string;
  videoId: string;
  title: string;
  thumbnail: string;
  /** Duration in seconds. */
  duration: number;
  addedById: string;
  addedByName: string;
  position: number;
  createdAt: string;
}

export interface PlaybackStateDTO {
  roomId: string;
  currentVideoId: string | null;
  currentTitle: string | null;
  currentThumbnail: string | null;
  /** Duration in seconds. 0 if unknown. */
  currentDuration: number;
  /** Playback position in seconds at the time of `updatedAt`. */
  currentTimestamp: number;
  isPlaying: boolean;
  currentAddedById: string | null;
  currentAddedByName: string | null;
  updatedAt: string;
}

export interface RecentlyPlayedItemDTO {
  id: string;
  roomId: string;
  videoId: string;
  title: string;
  thumbnail: string;
  /** Duration in seconds. */
  duration: number;
  addedByName: string | null;
  playedAt: string;
}

export type ChatMessageKind = "USER" | "SYSTEM";

export interface ChatMessageDTO {
  id: string;
  roomId: string;
  /** Null for SYSTEM messages ("Alex joined", "Ben became host", ...). */
  sessionId: string | null;
  displayName: string;
  content: string;
  type: ChatMessageKind;
  createdAt: string;
}

export type RoomStatus = "ACTIVE" | "ENDED";
export type QueueAddPermission = "ANYONE" | "HOST_ONLY";
export type SkipMode = "ANYONE" | "HOST_ONLY" | "VOTE";

export interface RoomSettingsDTO {
  queueAddPermission: QueueAddPermission;
  skipMode: SkipMode;
  repeatQueue: boolean;
  autoShuffle: boolean;
  chatEnabled: boolean;
  reactionsEnabled: boolean;
  allowGuestReorder: boolean;
  queueLocked: boolean;
  /** When the queue runs dry, play a random trending-music track instead of going idle.
   *  No-ops server-side if YOUTUBE_API_KEY isn't configured. */
  autoplayFallback: boolean;
}

export interface UpdateRoomSettingsRequest {
  queueAddPermission?: QueueAddPermission;
  skipMode?: SkipMode;
  autoShuffle?: boolean;
  chatEnabled?: boolean;
  reactionsEnabled?: boolean;
  allowGuestReorder?: boolean;
  autoplayFallback?: boolean;
}

export interface RoomDTO {
  id: string;
  code: string;
  name: string;
  repeatQueue: boolean;
  createdAt: string;
  status: RoomStatus;
  hostSessionId: string | null;
  settings: RoomSettingsDTO;
  playbackState: PlaybackStateDTO | null;
  queue: QueueItemDTO[];
  onlineUsers: UserSessionDTO[];
}

export interface CreateRoomRequest {
  roomName: string;
  displayName: string;
}

export interface CreateRoomResponse {
  room: RoomDTO;
  session: UserSessionDTO;
}

export interface JoinRoomRequest {
  displayName: string;
}

export interface JoinRoomResponse {
  room: RoomDTO;
  session: UserSessionDTO;
}

/** Exactly one of `url` / `videoId` must be present. `videoId` is the search-result path —
 *  title/thumbnail/duration are already known from the search response, passed along as a hint
 *  so the server doesn't need to re-fetch metadata it was just given. */
export interface AddSongRequest {
  url?: string;
  videoId?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
}

export interface AddSongResponse {
  /** Null when the song started playing immediately instead of being queued (nothing was playing). */
  queueItem: QueueItemDTO | null;
}

export interface SearchResultDTO {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  /** Duration in seconds. */
  duration: number;
}

export interface SearchSongsResponse {
  results: SearchResultDTO[];
}

export interface MoveQueueItemRequest {
  direction: "up" | "down";
}

export interface ReorderQueueRequest {
  orderedItemIds: string[];
}

export interface SetRepeatQueueRequest {
  enabled: boolean;
}

/** Describes what just happened to the queue, so listeners can show an accurate toast
 *  instead of a generic "queue updated" message. */
export interface QueueChangeReason {
  type: "removed" | "moved" | "cleared" | "shuffled" | "reordered";
  actorName: string;
  songTitle?: string;
}

export interface QueueMutationResponse {
  queue: QueueItemDTO[];
  reason?: QueueChangeReason;
}

export interface RecentlyPlayedResponse {
  items: RecentlyPlayedItemDTO[];
}

export interface ChatHistoryResponse {
  messages: ChatMessageDTO[];
}

export type RoomEventKind =
  | "JOINED"
  | "LEFT"
  | "HOST_TRANSFERRED"
  | "QUEUE_LOCKED"
  | "QUEUE_UNLOCKED"
  | "VOTE_SKIP_PASSED"
  | "ROOM_ENDED";

export interface RoomEventDTO {
  id: string;
  roomId: string;
  type: RoomEventKind;
  actorName: string | null;
  targetName: string | null;
  /** Pre-rendered human-readable text ("Alex joined"), built server-side once so the client
   *  doesn't need its own copy of the same type -> sentence mapping. */
  summary: string;
  createdAt: string;
}

/** Merged, time-sorted room history feed: structured events (joins/leaves/host transfers/...)
 *  interleaved with songs played, so the UI can render one chronological list. */
export type RoomHistoryEntryDTO =
  | { kind: "event"; at: string; event: RoomEventDTO }
  | { kind: "song"; at: string; song: RecentlyPlayedItemDTO };

export interface RoomHistoryResponse {
  entries: RoomHistoryEntryDTO[];
}

/** Ephemeral vote-to-skip state — not persisted, mirrors the in-memory state the server keeps
 *  per room while a vote is active. */
export interface VoteSkipStateDTO {
  initiatorId: string;
  initiatorName: string;
  votes: string[];
  required: number;
  totalOnline: number;
  expiresAt: string;
}

export type PresenceStatus = "online" | "away";
export type PresenceActivity = "idle" | "typing_chat" | "adding_song" | "editing_queue";

export interface PresenceStateDTO {
  sessionId: string;
  displayName: string;
  status: PresenceStatus;
  activity: PresenceActivity;
}

export const REACTION_EMOJIS = ["❤️", "🔥", "👏", "😂", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
