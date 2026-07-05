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
  updatedAt: string;
}

export interface RoomDTO {
  id: string;
  code: string;
  name: string;
  repeatQueue: boolean;
  createdAt: string;
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

export interface AddSongRequest {
  url: string;
}

export interface AddSongResponse {
  /** Null when the song started playing immediately instead of being queued (nothing was playing). */
  queueItem: QueueItemDTO | null;
}

export interface MoveQueueItemRequest {
  direction: "up" | "down";
}

export interface SetRepeatQueueRequest {
  enabled: boolean;
}

export interface QueueMutationResponse {
  queue: QueueItemDTO[];
}
