"use client";

import YouTube from "react-youtube";
import type { YouTubeEvent } from "react-youtube";

/**
 * Same hidden-2x2px trick as apps/web/src/components/room/PlayerEngine.tsx (see its comment for
 * why) — the backing track's actual YouTube IFrame Player, one instance per karaoke room view.
 */
export function KaraokePlayerEngine({ onReady }: { onReady: (event: YouTubeEvent) => void }) {
  return (
    <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden>
      <YouTube
        opts={{
          height: "2",
          width: "2",
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        }}
        onReady={onReady}
      />
    </div>
  );
}
