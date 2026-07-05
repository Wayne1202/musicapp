import type { PlaybackStateDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { serializePlaybackState } from "./serializers";
import { popNextQueueItem } from "./queueService";

/**
 * Projects the stored playback state forward to "now". The DB only stores the timestamp
 * as of its last update (`updatedAt`); if the song is currently playing we add the elapsed
 * wall-clock time so any client reading this gets an accurate live position.
 */
export function projectToNow(state: PlaybackStateDTO): PlaybackStateDTO {
  if (!state.isPlaying || !state.currentVideoId) return state;
  const elapsedSeconds = (Date.now() - new Date(state.updatedAt).getTime()) / 1000;
  return {
    ...state,
    currentTimestamp: state.currentTimestamp + Math.max(0, elapsedSeconds),
    updatedAt: new Date().toISOString(),
  };
}

export async function getLivePlaybackState(roomId: string): Promise<PlaybackStateDTO> {
  const state = await prisma.playbackState.findUnique({ where: { roomId } });
  if (!state) throw new HttpError(404, "Room has no playback state");
  return projectToNow(serializePlaybackState(state));
}

export async function startPlaybackIfIdle(
  roomId: string,
  song: { videoId: string; title: string; thumbnail: string; duration: number },
): Promise<PlaybackStateDTO> {
  const state = await prisma.playbackState.update({
    where: { roomId },
    data: {
      currentVideoId: song.videoId,
      currentTitle: song.title,
      currentThumbnail: song.thumbnail,
      currentDuration: song.duration,
      currentTimestamp: 0,
      isPlaying: true,
    },
  });
  return serializePlaybackState(state);
}

export async function play(roomId: string, timestamp: number): Promise<PlaybackStateDTO> {
  const state = await prisma.playbackState.update({
    where: { roomId },
    data: { isPlaying: true, currentTimestamp: timestamp },
  });
  return serializePlaybackState(state);
}

export async function pause(roomId: string, timestamp: number): Promise<PlaybackStateDTO> {
  const state = await prisma.playbackState.update({
    where: { roomId },
    data: { isPlaying: false, currentTimestamp: timestamp },
  });
  return serializePlaybackState(state);
}

export async function seek(roomId: string, timestamp: number): Promise<PlaybackStateDTO> {
  const state = await prisma.playbackState.update({
    where: { roomId },
    data: { currentTimestamp: timestamp },
  });
  return serializePlaybackState(state);
}

/** Advances to the next queued song. Returns the new playback state and whether a song was found. */
export async function advanceToNextSong(
  roomId: string,
): Promise<{ playbackState: PlaybackStateDTO; hasSong: boolean }> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { repeatQueue: true } });
  const next = await popNextQueueItem(roomId, { recycle: room?.repeatQueue ?? false });

  const state = await prisma.playbackState.update({
    where: { roomId },
    data: next
      ? {
          currentVideoId: next.videoId,
          currentTitle: next.title,
          currentThumbnail: next.thumbnail,
          currentDuration: next.duration,
          currentTimestamp: 0,
          isPlaying: true,
        }
      : {
          currentVideoId: null,
          currentTitle: null,
          currentThumbnail: null,
          currentDuration: 0,
          currentTimestamp: 0,
          isPlaying: false,
        },
  });

  return { playbackState: serializePlaybackState(state), hasSong: Boolean(next) };
}
