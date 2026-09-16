import type { YoutubeIframeRef } from "react-native-youtube-iframe";

// Shared by usePlayerController.ts (listening room) and useKaraokePlayback.ts (karaoke backing
// track) — both drift-correct a react-native-youtube-iframe player against a server timestamp
// the same way, just from different DTOs (PlaybackStateDTO vs. KaraokeRoomDTO, which is shaped
// identically on purpose — see packages/shared/src/karaoke.ts).

export const TICK_INTERVAL_MS = 500;
export const DRIFT_CHECK_INTERVAL_MS = 5000;
export const DRIFT_THRESHOLD_SECONDS = 1.5;

/** `seekTo`'s type says it returns void (fire-and-forget), but the underlying WebView bridge
 *  call can still throw synchronously if the webview ref isn't fully ready yet — don't trust a
 *  WebView-bridged call to be resilient in every player state (see also getCurrentTime()'s own
 *  try/catches at each call site). */
export function safeSeekTo(player: YoutubeIframeRef, seconds: number) {
  try {
    player.seekTo(seconds, true);
  } catch {
    // ignore; the next drift check will retry
  }
}
