import { useEffect, useRef, useState } from "react";
import type { YoutubeIframeRef } from "react-native-youtube-iframe";
import { PLAYER_STATES } from "react-native-youtube-iframe";
import { projectPlaybackPosition, type PlaybackStateDTO } from "@musicapp/shared";
import { usePlaybackActions } from "@/hooks/usePlaybackActions";
import { toast } from "@/lib/toast";

const TICK_INTERVAL_MS = 500;
const DRIFT_CHECK_INTERVAL_MS = 5000;
const DRIFT_THRESHOLD_SECONDS = 1.5;

/** `seekTo`'s type says it returns void (fire-and-forget), but the underlying WebView bridge
 *  call can still throw synchronously if the webview ref isn't fully ready yet — same defensive
 *  reasoning as the getCurrentTime() try/catches below: don't trust a WebView-bridged call to be
 *  resilient in every player state. */
function safeSeekTo(player: YoutubeIframeRef, seconds: number) {
  try {
    player.seekTo(seconds, true);
  } catch {
    // ignore; the next drift check will retry
  }
}

export interface PlayerController {
  playerRef: React.MutableRefObject<YoutubeIframeRef | null>;
  hasInteracted: boolean;
  liveTime: number;
  hasSong: boolean;
  videoId: string | null;
  /** Drives the YoutubeIframe `play` prop directly (it's a controlled component, unlike
   *  react-youtube's imperative playVideo()/pauseVideo() on the web app). */
  shouldPlay: boolean;
  handleStart: () => void;
  togglePlay: () => void;
  handlePlayPauseTap: () => void;
  skip: () => void;
  handleSeek: (value: number) => void;
  handleSeekCommit: (value: number) => void;
  onReady: () => void;
  onChangeState: (state: PLAYER_STATES) => void;
  onError: (error: string) => void;
}

/**
 * Mobile counterpart to apps/web's usePlayerController. Same architecture (server-authoritative
 * sync, local ticking progress bar + periodic drift correction, the tap-to-unlock gate) but
 * adapted to react-native-youtube-iframe's API, which is a *controlled* component (a `play`
 * boolean prop) rather than react-youtube's imperative playVideo()/pauseVideo() calls — so unlike
 * the web version, this controller never calls play/pause on the player directly; it only derives
 * `shouldPlay` for the component to pass through, and imperatively drives seeking (the one thing
 * that has no prop-based equivalent) via the ref.
 */
export function usePlayerController(roomId: string | null, playbackState: PlaybackStateDTO | null): PlayerController {
  const playerRef = useRef<YoutubeIframeRef | null>(null);
  const appliedVideoId = useRef<string | null>(null);
  // Queued seek target for a video that just changed — applied once the player reports the new
  // video is cued/ready, since (unlike react-youtube's loadVideoById) there's no atomic
  // "load this video starting at this position" call here.
  const pendingSeekTarget = useRef<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [liveTime, setLiveTime] = useState(0);
  const { play, pause, seek, skip, songEnded } = usePlaybackActions(roomId);

  const hasSong = Boolean(playbackState?.currentVideoId);
  const videoId = playbackState?.currentVideoId ?? null;
  const shouldPlay = hasInteracted && Boolean(playbackState?.isPlaying) && hasSong;

  // Apply server-authoritative state (song changes, play/pause/seek from any client) to the
  // player: queue a seek for video changes (applied on the next "video cued" state), or seek
  // immediately if the drift on the current video is too large (e.g. another client seeked).
  useEffect(() => {
    if (!playbackState || !hasInteracted) return;

    const target = projectPlaybackPosition(playbackState);

    if (playbackState.currentVideoId !== appliedVideoId.current) {
      appliedVideoId.current = playbackState.currentVideoId;
      pendingSeekTarget.current = playbackState.currentVideoId ? target : null;
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
  }, [playbackState, hasInteracted]);

  // Locally ticking progress bar between server updates, plus a periodic drift check.
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
            safeSeekTo(player, target);
          }
        } catch {
          // ignore, try again next tick
        }
      })();
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playbackState, hasInteracted]);

  const handleStart = () => {
    setHasInteracted(true);
    if (playbackState?.currentVideoId) {
      appliedVideoId.current = playbackState.currentVideoId;
      pendingSeekTarget.current = projectPlaybackPosition(playbackState);
    }
  };

  const togglePlay = () => {
    if (!playbackState) return;
    if (playbackState.isPlaying) {
      pause(liveTime);
    } else {
      play(liveTime);
    }
  };

  const handlePlayPauseTap = () => {
    if (!hasInteracted) handleStart();
    togglePlay();
  };

  const handleSeek = (value: number) => setLiveTime(value);
  const handleSeekCommit = (value: number) => {
    if (!hasInteracted) handleStart();
    seek(value);
  };

  const onReady = () => {
    // A freshly-mounted player for an already-playing room: seek to the live position once ready.
    if (playbackState?.currentVideoId && appliedVideoId.current === null) {
      appliedVideoId.current = playbackState.currentVideoId;
      pendingSeekTarget.current = projectPlaybackPosition(playbackState);
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
    if (state === PLAYER_STATES.ENDED) songEnded();
  };

  const onError = () => {
    toast.error("That video can't be played (removed, private, or embedding disabled) — skipping.");
    skip();
  };

  return {
    playerRef,
    hasInteracted,
    liveTime,
    hasSong,
    videoId,
    shouldPlay,
    handleStart,
    togglePlay,
    handlePlayPauseTap,
    skip,
    handleSeek,
    handleSeekCommit,
    onReady,
    onChangeState,
    onError,
  };
}
