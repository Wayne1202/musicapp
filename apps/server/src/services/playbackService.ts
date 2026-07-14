import type { PlaybackStateDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { serializePlaybackState } from "./serializers";
import { popNextQueueItem, shuffleQueue } from "./queueService";
import { recordPlayed } from "./recentlyPlayedService";
import { pickRandomFallback } from "./fallbackPlaylistService";

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

/**
 * Starts a random fallback song if the room is sitting idle with an empty queue — covers the
 * case advanceToNextSong doesn't: a room that never had anything playing in the first place
 * (fresh room, or everything got cleared) rather than one whose queue just ran dry mid-play.
 * Called on JOIN_ROOM so a room starts playing the moment someone's actually there to hear it,
 * not eagerly on room creation before anyone's connected.
 *
 * Race-safe: the update is conditioned on `currentVideoId: null` still being true at write time
 * (`updateMany`'s `count` tells us whether we won), so two people joining at the same instant
 * can't both start a fallback song.
 */
export async function playFallbackIfIdle(roomId: string): Promise<PlaybackStateDTO | null> {
  const [room, state, queueCount] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId }, select: { autoplayFallback: true } }),
    prisma.playbackState.findUnique({ where: { roomId } }),
    prisma.queueItem.count({ where: { roomId } }),
  ]);
  if (!room?.autoplayFallback || state?.currentVideoId || queueCount > 0) return null;

  const fallback = await pickRandomFallback(null);
  if (!fallback) return null;

  const result = await prisma.playbackState.updateMany({
    where: { roomId, currentVideoId: null },
    data: {
      currentVideoId: fallback.videoId,
      currentTitle: fallback.title,
      currentThumbnail: fallback.thumbnail,
      currentDuration: fallback.duration,
      currentTimestamp: 0,
      isPlaying: true,
      currentAddedById: null,
      currentAddedByName: null,
    },
  });
  if (result.count === 0) return null; // lost the race, or someone added a real song in the meantime

  return serializePlaybackState(await prisma.playbackState.findUniqueOrThrow({ where: { roomId } }));
}

/** Advances to the next queued song. Returns the new playback state, whether a song was found,
 *  and whether that song came from the trending-music fallback pool rather than the real queue. */
export async function advanceToNextSong(
  roomId: string,
): Promise<{ playbackState: PlaybackStateDTO; hasSong: boolean; usedFallback: boolean }> {
  const [room, outgoing] = await Promise.all([
    prisma.room.findUnique({
      where: { id: roomId },
      select: { repeatQueue: true, autoShuffle: true, autoplayFallback: true },
    }),
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

  // Real queue is source of truth; only reach for a fallback song when it's genuinely empty.
  // Fallback songs have no attribution (currentAddedById/Name stay null) since nobody queued
  // them — NowPlaying's "Added by" line already hides itself when that's null.
  let songToPlay: { videoId: string; title: string; thumbnail: string; duration: number; addedById: string | null; addedByName: string | null } | null =
    next
      ? { videoId: next.videoId, title: next.title, thumbnail: next.thumbnail, duration: next.duration, addedById: next.addedById, addedByName: next.addedByName }
      : null;

  let usedFallback = false;
  if (!songToPlay && room?.autoplayFallback) {
    const fallback = await pickRandomFallback(outgoing?.currentVideoId);
    if (fallback) {
      songToPlay = { ...fallback, addedById: null, addedByName: null };
      usedFallback = true;
    }
  }

  const state = await prisma.playbackState.update({
    where: { roomId },
    data: songToPlay
      ? {
          currentVideoId: songToPlay.videoId,
          currentTitle: songToPlay.title,
          currentThumbnail: songToPlay.thumbnail,
          currentDuration: songToPlay.duration,
          currentTimestamp: 0,
          isPlaying: true,
          currentAddedById: songToPlay.addedById,
          currentAddedByName: songToPlay.addedByName,
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

  return { playbackState: serializePlaybackState(state), hasSong: Boolean(songToPlay), usedFallback };
}
