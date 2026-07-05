import { extractYouTubeVideoId } from "@musicapp/shared";
import type { QueueItemDTO } from "@musicapp/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { fetchYouTubeMetadata } from "./youtubeMetadata";
import { serializeQueueItem } from "./serializers";
import { startPlaybackIfIdle } from "./playbackService";

export async function getQueue(roomId: string): Promise<QueueItemDTO[]> {
  const items = await prisma.queueItem.findMany({
    where: { roomId },
    include: { addedBy: true },
    orderBy: { position: "asc" },
  });
  return items.map(serializeQueueItem);
}

/**
 * Adds a song from a pasted YouTube URL. If nothing is currently playing in the room,
 * the song starts playing immediately instead of sitting in the queue.
 */
export async function addSongFromUrl(
  roomId: string,
  sessionId: string,
  url: string,
): Promise<{ queueItem: QueueItemDTO | null; startedImmediately: boolean }> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new HttpError(400, "Could not extract a YouTube video ID from that URL");
  }

  const playbackState = await prisma.playbackState.findUnique({ where: { roomId } });
  if (playbackState?.currentVideoId === videoId) {
    throw new HttpError(409, "That song is already playing");
  }

  const duplicate = await prisma.queueItem.findFirst({ where: { roomId, videoId } });
  if (duplicate) {
    throw new HttpError(409, "That song is already in the queue");
  }

  const metadata = await fetchYouTubeMetadata(videoId);

  const nothingPlaying = !playbackState?.currentVideoId;

  if (nothingPlaying) {
    await startPlaybackIfIdle(roomId, {
      videoId: metadata.videoId,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
    });
    return { queueItem: null, startedImmediately: true };
  }

  const last = await prisma.queueItem.findFirst({
    where: { roomId },
    orderBy: { position: "desc" },
  });
  const nextPosition = (last?.position ?? -1) + 1;

  const created = await prisma.queueItem.create({
    data: {
      roomId,
      addedById: sessionId,
      videoId: metadata.videoId,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      position: nextPosition,
    },
    include: { addedBy: true },
  });

  return { queueItem: serializeQueueItem(created), startedImmediately: false };
}

/**
 * Removes and returns the front of the queue (used when skipping / a song ends), or null if
 * empty. When `recycle` is true (room has repeat-queue enabled), the front item is moved to
 * the back of the queue instead of deleted, so the playlist loops instead of draining.
 */
export async function popNextQueueItem(
  roomId: string,
  options?: { recycle?: boolean },
): Promise<QueueItemDTO | null> {
  const next = await prisma.queueItem.findFirst({
    where: { roomId },
    include: { addedBy: true },
    orderBy: { position: "asc" },
  });
  if (!next) return null;

  if (options?.recycle) {
    const last = await prisma.queueItem.findFirst({ where: { roomId }, orderBy: { position: "desc" } });
    const recycled = await prisma.queueItem.update({
      where: { id: next.id },
      data: { position: (last?.position ?? next.position) + 1 },
      include: { addedBy: true },
    });
    return serializeQueueItem(recycled);
  }

  await prisma.queueItem.delete({ where: { id: next.id } });
  return serializeQueueItem(next);
}

/** Renumbers a room's queue to sequential 0..n-1 positions, closing any gaps left by removal. */
async function reindexQueue(roomId: string): Promise<void> {
  const items = await prisma.queueItem.findMany({ where: { roomId }, orderBy: { position: "asc" } });
  await prisma.$transaction(
    items.map((item, index) => prisma.queueItem.update({ where: { id: item.id }, data: { position: index } })),
  );
}

export async function removeQueueItem(roomId: string, itemId: string): Promise<void> {
  const item = await prisma.queueItem.findFirst({ where: { id: itemId, roomId } });
  if (!item) throw new HttpError(404, "Queue item not found");

  await prisma.queueItem.delete({ where: { id: itemId } });
  await reindexQueue(roomId);
}

export async function moveQueueItem(roomId: string, itemId: string, direction: "up" | "down"): Promise<void> {
  const items = await prisma.queueItem.findMany({ where: { roomId }, orderBy: { position: "asc" } });
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) throw new HttpError(404, "Queue item not found");

  const swapWithIndex = direction === "up" ? index - 1 : index + 1;
  if (swapWithIndex < 0 || swapWithIndex >= items.length) return; // already at that end, no-op

  const a = items[index];
  const b = items[swapWithIndex];
  await prisma.$transaction([
    prisma.queueItem.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.queueItem.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);
}

export async function clearQueue(roomId: string): Promise<void> {
  await prisma.queueItem.deleteMany({ where: { roomId } });
}

export async function shuffleQueue(roomId: string): Promise<void> {
  const items = await prisma.queueItem.findMany({ where: { roomId } });
  if (items.length < 2) return;

  const shuffled = shuffleInPlace([...items]);
  await prisma.$transaction(
    shuffled.map((item, index) => prisma.queueItem.update({ where: { id: item.id }, data: { position: index } })),
  );
}

export async function setRepeatQueue(roomId: string, enabled: boolean): Promise<void> {
  await prisma.room.update({ where: { id: roomId }, data: { repeatQueue: enabled } });
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
