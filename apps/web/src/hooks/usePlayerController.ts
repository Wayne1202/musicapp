"use client";

import { useEffect, useRef, useState } from "react";
import type { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { toast } from "sonner";
import type { PlaybackStateDTO } from "@musicapp/shared";
import { projectPlaybackPosition } from "@/lib/playback";
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

  const handlePlayPauseTap = () => {
    if (!hasInteracted) handleStart();
    else togglePlay();
  };

  const handleSeek = (value: number[]) => setLiveTime(value[0]);
  const handleSeekCommit = (value: number[]) => seek(value[0]);

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
