import type { PlaybackStateDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { serializePlaybackState } from "./serializers";
import { popNextQueueItem, shuffleQueue } from "./queueService";
import { recordPlayed } from "./recentlyPlayedService";

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
  song: {
    videoId: string;
    title: string;
    thumbnail: string;
    duration: number;
    addedById?: string | null;
    addedByName?: string | null;
  },
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
      currentAddedById: song.addedById ?? null,
      currentAddedByName: song.addedByName ?? null,
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
  const [room, outgoing] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId }, select: { repeatQueue: true, autoShuffle: true } }),
    prisma.playbackState.findUnique({ where: { roomId } }),
  ]);

  // Snapshot the song that's about to be replaced into recently-played history, before it's
  // gone for good (skip if the room was idle — nothing was actually playing).
  if (outgoing?.currentVideoId) {
    await recordPlayed(roomId, {
      videoId: outgoing.currentVideoId,
      title: outgoing.currentTitle ?? "",
      thumbnail: outgoing.currentThumbnail ?? "",
      duration: outgoing.currentDuration,
      addedByName: outgoing.currentAddedByName,
    });
  }

  const next = await popNextQueueItem(roomId, { recycle: room?.repeatQueue ?? false });

  // Auto-shuffle keeps repeat playback from settling into the same fixed rotation: reshuffle
  // the remaining order every time a song gets recycled to the back of the queue.
  if (room?.repeatQueue && room.autoShuffle) {
    await shuffleQueue(roomId);
  }

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
          currentAddedById: next.addedById,
          currentAddedByName: next.addedByName,
        }
      : {
          currentVideoId: null,
          currentTitle: null,
          currentThumbnail: null,
          currentDuration: 0,
          currentTimestamp: 0,
          isPlaying: false,
          currentAddedById: null,
          currentAddedByName: null,
        },
  });

  return { playbackState: serializePlaybackState(state), hasSong: Boolean(next) };
}
