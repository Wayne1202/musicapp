import type { RoomRecapDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { getRecentlyPlayed } from "./recentlyPlayedService";

/**
 * Builds the "session recap" shown when a room ends — entirely from data already tracked for
 * other reasons, no new writes: RecentlyPlayedItem (songs actually finished), UserSession
 * (everyone who ever joined, online or not), Room.createdAt (session length). See
 * RoomRecapDTO's own comment for why reactions aren't part of this.
 */
export async function getRoomRecap(roomId: string): Promise<RoomRecapDTO | null> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { name: true, code: true, createdAt: true },
  });
  if (!room) return null;

  const [playedSongs, totalListeners, playbackState] = await Promise.all([
    getRecentlyPlayed(roomId),
    prisma.userSession.count({ where: { roomId } }),
    prisma.playbackState.findUnique({ where: { roomId } }),
  ]);

  // A song only lands in RecentlyPlayedItem once it *finishes* (advanceToNextSong) — a room
  // ended mid-song would otherwise show a hollow "0 songs" recap even after a real listening
  // session, so fold in whatever was still playing at end-of-room too.
  const songs = playbackState?.currentVideoId
    ? [
        {
          id: `now-playing-${playbackState.roomId}`,
          roomId,
          videoId: playbackState.currentVideoId,
          title: playbackState.currentTitle ?? "Untitled",
          thumbnail: playbackState.currentThumbnail ?? "",
          duration: playbackState.currentDuration,
          addedByName: playbackState.currentAddedByName,
          playedAt: playbackState.updatedAt.toISOString(),
        },
        ...playedSongs,
      ]
    : playedSongs;

  const contributions = new Map<string, number>();
  for (const song of songs) {
    if (!song.addedByName) continue;
    contributions.set(song.addedByName, (contributions.get(song.addedByName) ?? 0) + 1);
  }
  let topContributor: { name: string; songCount: number } | null = null;
  for (const [name, songCount] of contributions) {
    if (!topContributor || songCount > topContributor.songCount) topContributor = { name, songCount };
  }

  const durationMinutes = Math.max(1, Math.round((Date.now() - room.createdAt.getTime()) / 60_000));

  return {
    roomName: room.name,
    roomCode: room.code,
    songsPlayed: songs.length,
    totalListeners,
    topContributor,
    durationMinutes,
    highlights: songs.slice(0, 5),
  };
}
