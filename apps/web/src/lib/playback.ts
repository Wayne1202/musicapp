import type { PlaybackStateDTO } from "@musicapp/shared";

/**
 * Projects the server's last-known playback position forward to "now" using wall-clock time
 * elapsed since `updatedAt`. Mirrors the server's own projection so a freshly joined client
 * (or one recovering from a socket reconnect) seeks to the right spot immediately.
 */
export function projectPlaybackPosition(state: PlaybackStateDTO): number {
  if (!state.isPlaying || !state.currentVideoId) return state.currentTimestamp;
  const elapsedSeconds = (Date.now() - new Date(state.updatedAt).getTime()) / 1000;
  return state.currentTimestamp + Math.max(0, elapsedSeconds);
}
