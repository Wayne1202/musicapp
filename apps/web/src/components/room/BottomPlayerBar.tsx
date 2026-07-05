"use client";

import { Pause, Play, SkipForward } from "lucide-react";
import type { PlaybackStateDTO } from "@musicapp/shared";
import type { PlayerController } from "@/hooks/usePlayerController";
import { Button } from "@/components/ui/button";

/**
 * Sticky mini-player visible only on phones (sm:hidden) — keeps play/pause/skip reachable
 * without scrolling back up to the full NowPlaying card while browsing the queue or chat.
 * Drives the exact same PlayerController/player instance as NowPlaying, not a second one.
 */
export function BottomPlayerBar({
  playbackState,
  controller,
}: {
  playbackState: PlaybackStateDTO | null;
  controller: PlayerController;
}) {
  if (!controller.hasSong || !playbackState) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-card/95 px-3 backdrop-blur sm:hidden"
      style={{ paddingTop: "0.625rem", paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      {playbackState.currentThumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={playbackState.currentThumbnail} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
      )}
      <p className="min-w-0 w-0 flex-1 truncate text-sm font-medium">{playbackState.currentTitle}</p>
      <Button
        size="icon"
        variant="secondary"
        className="h-10 w-10 shrink-0"
        onClick={controller.handlePlayPauseTap}
        aria-label={playbackState.isPlaying ? "Pause" : "Play"}
      >
        {playbackState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={controller.skip} aria-label="Skip">
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  );
}
