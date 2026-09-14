"use client";

import { useEffect, useRef, useState } from "react";
import type { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { toast } from "sonner";
import { projectPlaybackPosition, type PlaybackStateDTO } from "@musicapp/shared";
import { usePlaybackActions } from "@/hooks/usePlaybackActions";

const TICK_INTERVAL_MS = 500;
const DRIFT_CHECK_INTERVAL_MS = 5000;
const DRIFT_THRESHOLD_SECONDS = 1.5;

export interface PlayerController {
  hasInteracted: boolean;
  liveTime: number;
  hasSong: boolean;
  handleStart: () => void;
  togglePlay: () => void;
  /** Single entry point for any play/pause tap, whether or not the player has been unlocked
   *  yet — used by both NowPlaying's button and the mobile bottom bar's, so neither has to
   *  know about the unlock-gating nuance itself. */
  handlePlayPauseTap: () => void;
  skip: () => void;
  handleSeek: (value: number[]) => void;
  handleSeekCommit: (value: number[]) => void;
  onPlayerReady: (event: YouTubeEvent) => void;
  onPlayerEnd: () => void;
  onPlayerError: (event: YouTubeEvent<number>) => void;
}

/**
 * Owns the single YouTube player instance for a room and all the state/logic around driving
 * it (sync-on-event, periodic drift correction, the mobile-audio-unlock gate, seek/skip). Called
 * once per room view (in RoomView) so the actual player is shared correctly between the full
 * NowPlaying card and the mobile bottom mini-player bar — both are otherwise-independent UI
 * surfaces that need to control the exact same player, not two separate ones.
 */
export function usePlayerController(roomId: string | null, playbackState: PlaybackStateDTO | null): PlayerController {
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

      // Plain `await`, not `.catch()` chained onto the call: react-youtube's `getCurrentTime()`
      // doesn't reliably return a real Promise in every player state, so chaining `.then`/`.catch`
      // directly onto its return value can throw "not a function" before the chain even attaches.
      let current = 0;
      try {
        current = await player.getCurrentTime();
      } catch {
        // ignore, fall back to 0
      }
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

      (async () => {
        try {
          const current = await player.getCurrentTime();
          const target = projectPlaybackPosition(playbackState);
          if (Math.abs(current - target) > DRIFT_THRESHOLD_SECONDS) {
            player.seekTo(target, true);
          }
        } catch {
          // ignore, try again next tick
        }
      })();
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

  const togglePlay = () => {
    if (!playerRef.current || !playbackState) return;
    // `liveTime` (kept in sync by the ticking effect above, same value the progress bar
    // displays) instead of querying the player directly — react-youtube's `getCurrentTime()`
    // doesn't reliably return a Promise in every player state, which made every toggle throw
    // an uncaught "not a function" past the first click and silently drop the action.
    if (playbackState.isPlaying) {
      pause(liveTime);
    } else {
      play(liveTime);
    }
  };

  // Unlocking (handleStart) only loads/syncs the player to whatever the room's current state
  // already is — it doesn't act on the user's actual intent. Without also calling the intended
  // action here, a first tap on a control that promises something (a "Pause" icon, a drag to a
  // new position) would silently do only the unlock and nothing else, then require a *second*
  // tap to actually work. Both control paths below unlock-then-act so the very first touch
  // always does what it visibly claims to do.
  const handlePlayPauseTap = () => {
    if (!hasInteracted) handleStart();
    togglePlay();
  };

  const handleSeek = (value: number[]) => setLiveTime(value[0]);
  const handleSeekCommit = (value: number[]) => {
    if (!hasInteracted) handleStart();
    seek(value[0]);
  };

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
  };
  const onPlayerEnd = () => songEnded();
  const onPlayerError = () => {
    toast.error("That video can't be played (removed, private, or embedding disabled) — skipping.");
    skip();
  };

  return {
    hasInteracted,
    liveTime,
    hasSong,
    handleStart,
    togglePlay,
    handlePlayPauseTap,
    skip,
    handleSeek,
    handleSeekCommit,
    onPlayerReady,
    onPlayerEnd,
    onPlayerError,
  };
}
