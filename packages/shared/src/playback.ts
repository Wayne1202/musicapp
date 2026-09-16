/** The minimal shape projectPlaybackPosition actually reads — both PlaybackStateDTO (listening
 *  room) and KaraokeRoomDTO (karaoke, see karaoke.ts) satisfy this without needing to share a
 *  common base type or carry fields they don't use (KaraokeRoomDTO has no roomId/
 *  currentAddedById/currentAddedByName, which PlaybackStateDTO has but this function never
 *  touches). */
export interface ProjectablePlaybackState {
  isPlaying: boolean;
  currentVideoId: string | null;
  currentTimestamp: number;
  updatedAt: string;
}

/**
 * Projects the server's last-known playback position forward to "now" using wall-clock time
 * elapsed since `updatedAt`. Mirrors the server's own projection so a freshly joined client
 * (or one recovering from a socket reconnect) seeks to the right spot immediately.
 */
export function projectPlaybackPosition(state: ProjectablePlaybackState): number {
  if (!state.isPlaying || !state.currentVideoId) return state.currentTimestamp;
  const elapsedSeconds = (Date.now() - new Date(state.updatedAt).getTime()) / 1000;
  return state.currentTimestamp + Math.max(0, elapsedSeconds);
}
