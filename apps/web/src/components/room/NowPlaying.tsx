"use client";

import { useEffect, useState } from "react";
import { Crown, Pause, Play, SkipForward } from "lucide-react";
import type { PlaybackStateDTO } from "@musicapp/shared";
import type { PlayerController } from "@/hooks/usePlayerController";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/utils";

interface NowPlayingProps {
  playbackState: PlaybackStateDTO | null;
  controller: PlayerController;
  hostSessionId?: string | null;
}

export function NowPlaying({ playbackState, controller, hostSessionId }: NowPlayingProps) {
  const [artworkLoaded, setArtworkLoaded] = useState(false);

  // Fade the artwork in fresh on every song change instead of an instant swap.
  useEffect(() => {
    setArtworkLoaded(false);
  }, [playbackState?.currentVideoId]);

  const duration = playbackState?.currentDuration ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary shadow-lg sm:h-32 sm:w-32">
          {playbackState?.currentThumbnail ? (
            <>
              {!artworkLoaded && <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={playbackState.currentVideoId}
                src={playbackState.currentThumbnail}
                alt=""
                onLoad={() => setArtworkLoaded(true)}
                className={`h-full w-full object-cover transition-opacity duration-300 ${
                  artworkLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">No song</div>
          )}
          {!controller.hasInteracted && controller.hasSong && (
            <button
              onClick={controller.handleStart}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-white transition hover:bg-black/70"
            >
              <Play className="h-10 w-10" />
            </button>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Now playing</p>
            <h2 className="line-clamp-2 text-lg font-semibold">
              {playbackState?.currentTitle ?? "Nothing playing yet — add a song below"}
            </h2>
            {playbackState?.currentAddedByName && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Added by {playbackState.currentAddedByName}
                {hostSessionId && playbackState.currentAddedById === hostSessionId && (
                  <Crown className="h-3 w-3 text-amber-400" aria-label="Host" />
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Slider
              value={[Math.min(controller.liveTime, duration || controller.liveTime)]}
              max={duration || 1}
              step={1}
              disabled={!controller.hasSong}
              onValueChange={controller.handleSeek}
              onValueCommit={controller.handleSeekCommit}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatDuration(controller.liveTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="secondary"
              disabled={!controller.hasSong}
              onClick={controller.handlePlayPauseTap}
              aria-label={playbackState?.isPlaying ? "Pause" : "Play"}
              className="h-12 w-12 sm:h-10 sm:w-10"
            >
              {playbackState?.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={!controller.hasSong}
              onClick={controller.skip}
              aria-label="Skip"
              className="h-12 w-12 sm:h-10 sm:w-10"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
