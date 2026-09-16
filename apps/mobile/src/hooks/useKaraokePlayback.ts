import { useEffect, useRef, useState } from "react";
import type { YoutubeIframeRef } from "react-native-youtube-iframe";
import { PLAYER_STATES } from "react-native-youtube-iframe";
import { projectPlaybackPosition, type KaraokeRoomDTO } from "@musicapp/shared";
import { DRIFT_CHECK_INTERVAL_MS, DRIFT_THRESHOLD_SECONDS, TICK_INTERVAL_MS, safeSeekTo } from "@/lib/youtubeSync";

export interface KaraokePlaybackController {
  playerRef: React.MutableRefObject<YoutubeIframeRef | null>;
  hasInteracted: boolean;
  hasSong: boolean;
  videoId: string | null;
  shouldPlay: boolean;
  handleStart: () => void;
  onReady: () => void;
  onChangeState: (state: PLAYER_STATES) => void;
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
 * entirely server-side — see karaokeRoomService.startKaraokeSinging), so there's no
 * usePlaybackActions equivalent to wire up here.
 */
export function useKaraokePlayback(room: KaraokeRoomDTO | null): KaraokePlaybackController {
  const playerRef = useRef<YoutubeIframeRef | null>(null);
  const appliedVideoId = useRef<string | null>(null);
  const pendingSeekTarget = useRef<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const hasSong = Boolean(room?.currentVideoId);
  const videoId = room?.currentVideoId ?? null;
  const shouldPlay = hasInteracted && Boolean(room?.isPlaying) && hasSong;

  useEffect(() => {
    if (!room || !hasInteracted) return;

    const target = projectPlaybackPosition(room);

    if (room.currentVideoId !== appliedVideoId.current) {
      appliedVideoId.current = room.currentVideoId;
      pendingSeekTarget.current = room.currentVideoId ? target : null;
      return;
    }

    const player = playerRef.current;
    if (!player) return;

    (async () => {
      let current = 0;
      try {
        current = await player.getCurrentTime();
      } catch {
        // ignore, fall back to 0
      }
      if (Math.abs(current - target) > 1.5) {
        safeSeekTo(player, target);
      }
    })();
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
            safeSeekTo(player, target);
          }
        } catch {
          // ignore, try again next tick
        }
      })();
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [room, hasInteracted]);

  const handleStart = () => {
    setHasInteracted(true);
    if (room?.currentVideoId) {
      appliedVideoId.current = room.currentVideoId;
      pendingSeekTarget.current = projectPlaybackPosition(room);
    }
  };

  const onReady = () => {
    if (room?.currentVideoId && appliedVideoId.current === null) {
      appliedVideoId.current = room.currentVideoId;
      pendingSeekTarget.current = projectPlaybackPosition(room);
    }
  };

  const onChangeState = (state: PLAYER_STATES) => {
    if (state === PLAYER_STATES.VIDEO_CUED || state === PLAYER_STATES.UNSTARTED) {
      if (pendingSeekTarget.current !== null) {
        const target = pendingSeekTarget.current;
        pendingSeekTarget.current = null;
        if (playerRef.current) safeSeekTo(playerRef.current, target);
      }
    }
  };

  return { playerRef, hasInteracted, hasSong, videoId, shouldPlay, handleStart, onReady, onChangeState };
}
