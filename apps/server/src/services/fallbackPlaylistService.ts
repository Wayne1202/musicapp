import { buildYouTubeThumbnailUrl, parseIso8601Duration } from "@musicapp/shared";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

export interface FallbackVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number;
}

interface ChartResponse {
  items: Array<{
    id: string;
    snippet: { title: string; thumbnails: Record<string, { url: string }> };
    contentDetails: { duration: string };
  }>;
}

const MUSIC_CATEGORY_ID = "10";
const REGION_CODE = "US";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — trending charts don't move fast enough to need more

let cache: { videos: FallbackVideo[]; fetchedAt: number } | null = null;

/**
 * Rotating pool of currently-trending YouTube music videos, used to keep a room playing
 * something when its queue runs dry instead of going idle. Fetched from the Data API's
 * "most popular" chart (Music category) rather than a hardcoded ID list — a static list would
 * inevitably contain removed/region-locked/wrong videos we can't actually verify. Requires
 * YOUTUBE_API_KEY; without one this returns an empty pool and autoplay-fallback silently no-ops
 * (rooms just behave like they did before this feature existed).
 */
export async function getFallbackVideos(): Promise<FallbackVideo[]> {
  if (!env.youtubeApiKey) return [];
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.videos;

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("videoCategoryId", MUSIC_CATEGORY_ID);
    url.searchParams.set("regionCode", REGION_CODE);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", env.youtubeApiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`YouTube Data API chart error: ${res.status}`);
    const data = (await res.json()) as ChartResponse;

    const videos: FallbackVideo[] = data.items.map((item) => ({
      videoId: item.id,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        buildYouTubeThumbnailUrl(item.id),
      duration: parseIso8601Duration(item.contentDetails.duration),
    }));

    cache = { videos, fetchedAt: Date.now() };
    return videos;
  } catch (err) {
    logger.warn("fallback-playlist", "Failed to refresh trending-music chart", err);
    // Keep serving the last good cache (even if stale) rather than going empty on a transient
    // fetch failure; only a truly empty/never-fetched cache falls through to [].
    return cache?.videos ?? [];
  }
}

/** Picks a random fallback song, avoiding an immediate repeat of whatever just finished. */
export async function pickRandomFallback(excludeVideoId?: string | null): Promise<FallbackVideo | null> {
  const videos = await getFallbackVideos();
  if (videos.length === 0) return null;

  const candidates = videos.length > 1 ? videos.filter((v) => v.videoId !== excludeVideoId) : videos;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
