"use client";

import { useEffect, useRef, useState } from "react";
import type { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { projectPlaybackPosition, type KaraokeRoomDTO } from "@musicapp/shared";

const TICK_INTERVAL_MS = 500;
// Tighter than the listening room's usePlayerController (5000ms/1.5s): karaoke's backing track
// has to feel simultaneous with the singer's live WebRTC voice, which arrives in ~100-300ms — a
// 1.5s-slack drift window reads as audible lyrics/voice latency in a way it never did for casual
// listening. Still can't be perfect: each listener's own video buffering varies independently.
const DRIFT_CHECK_INTERVAL_MS = 1500;
const DRIFT_THRESHOLD_SECONDS = 0.6;

export interface KaraokePlaybackController {
  hasInteracted: boolean;
  hasSong: boolean;
  handleStart: () => void;
  onPlayerReady: (event: YouTubeEvent) => void;
}

/**
 * Backing-track playback for the karaoke room — both the singer and every listener run this,
 * each independently loading and drift-correcting the same YouTube video against the room's
 * server timestamp (projectPlaybackPosition, reused verbatim from the listening room's sync
 * strategy since KaraokeRoomDTO is shaped identically — see docs/karaoke-audio.md). No audio
 * ever crosses the network here; only the singer's live mic does, over WebRTC
 * (useKaraokeWebRTC.ts) — this hook is backing-track-only.
 *
 * Deliberately much smaller than usePlayerController.ts: karaoke has no play/pause/seek/skip
 * transport controls for MVP (only the singer's one-shot "Start Singing" action, handled
 * entirely server-side — see karaokeRoomService.startKaraokeSinging).
 */
export function useKaraokePlayback(room: KaraokeRoomDTO | null): KaraokePlaybackController {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const appliedVideoId = useRef<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const hasSong = Boolean(room?.currentVideoId);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !room || !hasInteracted) return;

    const apply = async () => {
      const target = projectPlaybackPosition(room);

      if (room.currentVideoId !== appliedVideoId.current) {
        appliedVideoId.current = room.currentVideoId;
        if (room.currentVideoId) {
          await player.loadVideoById(room.currentVideoId, target);
          if (!room.isPlaying) await player.pauseVideo();
        } else {
          await player.stopVideo();
        }
        return;
      }

      let current = 0;
      try {
        current = await player.getCurrentTime();
      } catch {
        // ignore, fall back to 0
      }
      if (Math.abs(current - target) > DRIFT_THRESHOLD_SECONDS) {
        await player.seekTo(target, true);
      }
      if (room.isPlaying) {
        await player.playVideo();
      } else {
        await player.pauseVideo();
      }
    };

    apply().catch(() => {});
  }, [room, hasInteracted]);

  useEffect(() => {
    if (!room?.isPlaying) return;

    let msSinceDriftCheck = 0;
    const interval = setInterval(() => {
      msSinceDriftCheck += TICK_INTERVAL_MS;
      if (msSinceDriftCheck < DRIFT_CHECK_INTERVAL_MS) return;
      msSinceDriftCheck = 0;

      const player = playerRef.current;
      if (!hasInteracted || !player || appliedVideoId.current !== room.currentVideoId) return;

      (async () => {
        try {
          const current = await player.getCurrentTime();
          const target = projectPlaybackPosition(room);
          if (Math.abs(current - target) > DRIFT_THRESHOLD_SECONDS) {
            player.seekTo(target, true);
          }
        } catch {
          // ignore, try again next tick
        }
      })();
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [room, hasInteracted]);

  // Deliberately synchronous, same rationale as usePlayerController's handleStart: mobile
  // browsers only honor "this was triggered by a real tap" for a short window.
  const handleStart = () => {
    setHasInteracted(true);
    const player = playerRef.current;
    if (!player || !room?.currentVideoId) return;
    appliedVideoId.current = room.currentVideoId;
    const target = projectPlaybackPosition(room);
    player.loadVideoById(room.currentVideoId, target);
    if (!room.isPlaying) player.pauseVideo();
  };

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
  };

  return { hasInteracted, hasSong, handleStart, onPlayerReady };
}
