import type { RecentlyPlayedItemDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { serializeRecentlyPlayedItem } from "./serializers";

const MAX_RECENTLY_PLAYED_PER_ROOM = 20;

/** Snapshots a song that just finished playing. Called from advanceToNextSong right before
 *  the outgoing song's playback state is overwritten. */
export async function recordPlayed(
  roomId: string,
  song: { videoId: string; title: string; thumbnail: string; duration: number; addedByName: string | null },
): Promise<void> {
  await prisma.recentlyPlayedItem.create({
    data: {
      roomId,
      videoId: song.videoId,
      title: song.title,
      thumbnail: song.thumbnail,
      duration: song.duration,
      addedByName: song.addedByName,
    },
  });

  // Keep the table bounded — no cron needed, just prune whatever's past the cap on every write.
  const overflow = await prisma.recentlyPlayedItem.findMany({
    where: { roomId },
    orderBy: { playedAt: "desc" },
    skip: MAX_RECENTLY_PLAYED_PER_ROOM,
    select: { id: true },
  });
  if (overflow.length > 0) {
    await prisma.recentlyPlayedItem.deleteMany({ where: { id: { in: overflow.map((item) => item.id) } } });
  }
}

export async function getRecentlyPlayed(roomId: string, limit = MAX_RECENTLY_PLAYED_PER_ROOM): Promise<RecentlyPlayedItemDTO[]> {
  const items = await prisma.recentlyPlayedItem.findMany({
    where: { roomId },
    orderBy: { playedAt: "desc" },
    take: limit,
  });
  return items.map(serializeRecentlyPlayedItem);
}
