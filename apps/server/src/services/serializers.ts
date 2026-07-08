import type { PlaybackState, QueueItem, RecentlyPlayedItem, Room, UserSession } from "@prisma/client";
import type { PlaybackStateDTO, QueueItemDTO, RecentlyPlayedItemDTO, RoomDTO, UserSessionDTO } from "@musicapp/shared";

// If a session's heartbeat hasn't refreshed `lastSeenAt` within this window, treat it as
// offline even if `isOnline` is still true — covers the case where the server process was
// killed (not gracefully stopped) and never got to run the socket `disconnect` handler.
const ONLINE_STALE_MS = 60_000;

export function isSessionConsideredOnline(session: UserSession): boolean {
  return session.isOnline && Date.now() - session.lastSeenAt.getTime() < ONLINE_STALE_MS;
}

export function serializeSession(session: UserSession): UserSessionDTO {
  return {
    id: session.id,
    displayName: session.displayName,
    roomId: session.roomId,
    createdAt: session.createdAt.toISOString(),
  };
}

export function serializeQueueItem(item: QueueItem & { addedBy: UserSession }): QueueItemDTO {
  return {
    id: item.id,
    roomId: item.roomId,
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail,
    duration: item.duration,
    addedById: item.addedById,
    addedByName: item.addedBy.displayName,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
  };
}

export function serializePlaybackState(state: PlaybackState): PlaybackStateDTO {
  return {
    roomId: state.roomId,
    currentVideoId: state.currentVideoId,
    currentTitle: state.currentTitle,
    currentThumbnail: state.currentThumbnail,
    currentDuration: state.currentDuration,
    currentTimestamp: state.currentTimestamp,
    isPlaying: state.isPlaying,
    currentAddedById: state.currentAddedById,
    currentAddedByName: state.currentAddedByName,
    updatedAt: state.updatedAt.toISOString(),
  };
}

export function serializeRecentlyPlayedItem(item: RecentlyPlayedItem): RecentlyPlayedItemDTO {
  return {
    id: item.id,
    roomId: item.roomId,
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail,
    duration: item.duration,
    addedByName: item.addedByName,
    playedAt: item.playedAt.toISOString(),
  };
}

type RoomWithRelations = Room & {
  playbackState: PlaybackState | null;
  queueItems: (QueueItem & { addedBy: UserSession })[];
  sessions: UserSession[];
};

export function serializeRoom(room: RoomWithRelations): RoomDTO {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    repeatQueue: room.repeatQueue,
    createdAt: room.createdAt.toISOString(),
    status: room.status,
    hostSessionId: room.hostSessionId,
    settings: {
      queueAddPermission: room.queueAddPermission,
      skipMode: room.skipMode,
      repeatQueue: room.repeatQueue,
      autoShuffle: room.autoShuffle,
      chatEnabled: room.chatEnabled,
      reactionsEnabled: room.reactionsEnabled,
      allowGuestReorder: room.allowGuestReorder,
      queueLocked: room.queueLocked,
    },
    playbackState: room.playbackState ? serializePlaybackState(room.playbackState) : null,
    queue: room.queueItems
      .sort((a, b) => a.position - b.position)
      .map(serializeQueueItem),
    onlineUsers: room.sessions.filter(isSessionConsideredOnline).map(serializeSession),
  };
}
