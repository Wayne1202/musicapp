"use client";

import { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { Pause, Play, SkipForward } from "lucide-react";
import { toast } from "sonner";
import type { PlaybackStateDTO } from "@musicapp/shared";
import { projectPlaybackPosition } from "@/lib/playback";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/utils";
import { usePlaybackActions } from "@/hooks/usePlaybackActions";

interface NowPlayingProps {
  roomId: string;
  playbackState: PlaybackStateDTO | null;
}

const TICK_INTERVAL_MS = 500;
const DRIFT_CHECK_INTERVAL_MS = 5000;
const DRIFT_THRESHOLD_SECONDS = 1.5;

/**
 * Renders the YouTube IFrame Player at a tiny size, positioned off-screen — deliberately never
 * `display: none` or `visibility: hidden`, since browsers (especially mobile ones) throttle or
 * fully mute audio in iframes hidden that way. Positioning off-screen instead keeps it "active"
 * from the browser's perspective, which is what lets playback survive tab switches and
 * backgrounding, the same way Spotify Web behaves.
 */
export function NowPlaying({ roomId, playbackState }: NowPlayingProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const appliedVideoId = useRef<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [liveTime, setLiveTime] = useState(0);
  const { play, pause, seek, skip, songEnded } = usePlaybackActions(roomId);

  const hasSong = Boolean(playbackState?.currentVideoId);

  // Apply server-authoritative state (song changes, play/pause/seek from any client) to the player.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playbackState || !hasInteracted) return;

    const apply = async () => {
      const target = projectPlaybackPosition(playbackState);

      if (playbackState.currentVideoId !== appliedVideoId.current) {
        appliedVideoId.current = playbackState.currentVideoId;
        if (playbackState.currentVideoId) {
          await player.loadVideoById(playbackState.currentVideoId, target);
          if (!playbackState.isPlaying) await player.pauseVideo();
        } else {
          await player.stopVideo();
        }
        return;
      }

      const current = await player.getCurrentTime().catch(() => 0);
      if (Math.abs(current - target) > 1.5) {
        await player.seekTo(target, true);
      }
      if (playbackState.isPlaying) {
        await player.playVideo();
      } else {
        await player.pauseVideo();
      }
    };

    apply().catch(() => {});
  }, [playbackState, hasInteracted]);

  // Locally ticking progress bar between server updates, plus a periodic drift check: buffering
  // or network hiccups can leave the actual player behind the server-projected position even
  // when no new socket event has arrived to trigger the apply-effect above.
  useEffect(() => {
    if (!playbackState?.isPlaying) {
      setLiveTime(playbackState ? projectPlaybackPosition(playbackState) : 0);
      return;
    }

    let msSinceDriftCheck = 0;

    const interval = setInterval(() => {
      setLiveTime(projectPlaybackPosition(playbackState));

      msSinceDriftCheck += TICK_INTERVAL_MS;
      if (msSinceDriftCheck < DRIFT_CHECK_INTERVAL_MS) return;
      msSinceDriftCheck = 0;

      const player = playerRef.current;
      if (!hasInteracted || !player || appliedVideoId.current !== playbackState.currentVideoId) return;

      player
        .getCurrentTime()
        .then((current: number) => {
          const target = projectPlaybackPosition(playbackState);
          if (Math.abs(current - target) > DRIFT_THRESHOLD_SECONDS) {
            player.seekTo(target, true);
          }
        })
        .catch(() => {});
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playbackState, hasInteracted]);

  // Deliberately synchronous (no async/await): mobile browsers only honor "this was triggered
  // by a real tap" for a very short window, and yielding to a microtask before calling into the
  // player can be enough to lose it, silently breaking audio on some mobile browsers.
  const handleStart = () => {
    setHasInteracted(true);
    const player = playerRef.current;
    if (!player || !playbackState?.currentVideoId) return;
    appliedVideoId.current = playbackState.currentVideoId;
    const target = projectPlaybackPosition(playbackState);
    player.loadVideoById(playbackState.currentVideoId, target);
    if (!playbackState.isPlaying) player.pauseVideo();
  };

  const togglePlay = async () => {
    const player = playerRef.current;
    if (!player || !playbackState) return;
    const current = await player.getCurrentTime().catch(() => liveTime);
    if (playbackState.isPlaying) {
      pause(current);
    } else {
      play(current);
    }
  };

  const handleSeek = (value: number[]) => {
    setLiveTime(value[0]);
  };

  const handleSeekCommit = (value: number[]) => {
    seek(value[0]);
  };

  const duration = playbackState?.currentDuration ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden>
        <YouTube
          opts={{
            height: "2",
            width: "2",
            playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
          }}
          onReady={(event: YouTubeEvent) => {
            playerRef.current = event.target;
          }}
          onEnd={() => songEnded()}
          onError={(event: YouTubeEvent<number>) => {
            toast.error("That video can't be played (removed, private, or embedding disabled) — skipping.");
            skip();
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-lg bg-secondary shadow-lg sm:h-32 sm:w-32">
          {playbackState?.currentThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={playbackState.currentThumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">No song</div>
          )}
          {!hasInteracted && hasSong && (
            <button
              onClick={handleStart}
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Slider
              value={[Math.min(liveTime, duration || liveTime)]}
              max={duration || 1}
              step={1}
              disabled={!hasSong}
              onValueChange={handleSeek}
              onValueCommit={handleSeekCommit}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatDuration(liveTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="secondary"
              disabled={!hasSong}
              onClick={togglePlay}
              className="h-12 w-12 sm:h-10 sm:w-10"
            >
              {playbackState?.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={!hasSong}
              onClick={skip}
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
