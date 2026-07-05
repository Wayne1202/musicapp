"use client";

import YouTube from "react-youtube";
import type { PlayerController } from "@/hooks/usePlayerController";

/**
 * The actual (invisible) YouTube IFrame Player — rendered once per room, shared by both
 * NowPlaying's full card and the mobile bottom mini-player bar via the same PlayerController,
 * so both surfaces drive one real player instead of each trying to own their own.
 *
 * Positioned off-screen at a tiny size — deliberately never `display: none` or
 * `visibility: hidden`, since browsers (especially mobile ones) throttle or fully mute audio
 * in iframes hidden that way. Off-screen positioning keeps it "active" from the browser's
 * perspective, which is what lets playback survive tab switches and backgrounding, the same
 * way Spotify Web behaves.
 */
export function PlayerEngine({ controller }: { controller: PlayerController }) {
  return (
    <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden>
      <YouTube
        opts={{
          height: "2",
          width: "2",
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        }}
        onReady={controller.onPlayerReady}
        onEnd={controller.onPlayerEnd}
        onError={controller.onPlayerError}
      />
    </div>
  );
}
