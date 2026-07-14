import { buildYouTubeThumbnailUrl, parseIso8601Duration } from "@musicapp/shared";
import type { SearchResultDTO } from "@musicapp/shared";
import { env } from "../../lib/env";
import { HttpError } from "../../lib/http-error";
import { logger } from "../../lib/logger";
import { InMemoryCache } from "./cache";
import type { DataApiSearchResponse, DataApiVideosListResponse } from "./types";

const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000; // ~1 hour
const MAX_RESULTS = 8;
const UNAVAILABLE_MESSAGE = "Search is unavailable — paste a YouTube link instead";

const cache = new InMemoryCache<SearchResultDTO[]>();

/**
 * Searches all of YouTube (not restricted to the Music category — unlike the trending-fallback
 * chart, search results should match what typing into youtube.com's own search box would show).
 * Results are cached by normalized query text for an hour, shared across every room — identical
 * queries from different rooms hit the same cache entry, which is the whole point given
 * search.list's quota cost (100 units/call vs. 1 for videos.list; see the search route's
 * comment for the full breakdown).
 */
export async function searchVideos(query: string): Promise<SearchResultDTO[]> {
  const key = query.trim().toLowerCase();
  if (!key) return [];

  const cached = cache.get(key);
  if (cached) return cached;

  if (!env.youtubeApiKey) {
    throw new HttpError(503, UNAVAILABLE_MESSAGE);
  }

  const results = await fetchFromDataApi(key, env.youtubeApiKey);
  cache.set(key, results, SEARCH_CACHE_TTL_MS);
  return results;
}

async function fetchFromDataApi(query: string, apiKey: string): Promise<SearchResultDTO[]> {
  let searchData: DataApiSearchResponse;
  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("maxResults", String(MAX_RESULTS));
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      await logApiError("search.list", searchRes);
      throw new HttpError(503, UNAVAILABLE_MESSAGE);
    }
    searchData = (await searchRes.json()) as DataApiSearchResponse;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    logger.error("youtube-search", "search.list request failed", err);
    throw new HttpError(503, UNAVAILABLE_MESSAGE);
  }

  const items = searchData.items.filter((item) => item.id.videoId);
  if (items.length === 0) return [];

  // search.list doesn't return duration — a second, cheap (1 quota unit) batched call does,
  // reusing the same video IDs the search just returned.
  const videoIds = items.map((item) => item.id.videoId!);
  const durationByVideoId = await fetchDurations(videoIds, apiKey);

  return items.map((item) => {
    const videoId = item.id.videoId!;
    return {
      videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        buildYouTubeThumbnailUrl(videoId),
      duration: durationByVideoId.get(videoId) ?? 0,
    } satisfies SearchResultDTO;
  });
}

async function fetchDurations(videoIds: string[], apiKey: string): Promise<Map<string, number>> {
  try {
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "contentDetails");
    videosUrl.searchParams.set("id", videoIds.join(","));
    videosUrl.searchParams.set("key", apiKey);

    const res = await fetch(videosUrl.toString());
    if (!res.ok) {
      await logApiError("videos.list", res);
      return new Map(); // durations are a nice-to-have here — degrade to 0 rather than fail the whole search
    }
    const data = (await res.json()) as DataApiVideosListResponse;
    return new Map(data.items.map((item) => [item.id, parseIso8601Duration(item.contentDetails.duration)]));
  } catch (err) {
    logger.warn("youtube-search", "videos.list duration lookup failed", err);
    return new Map();
  }
}

async function logApiError(call: string, res: Response): Promise<void> {
  // Data API error bodies can include the exact reason (quotaExceeded, keyInvalid, ...) — log
  // it server-side for diagnosis, but the client only ever sees the generic UNAVAILABLE_MESSAGE
  // (never expose internal/provider error details to the browser).
  const body = await res.text().catch(() => "");
  logger.error("youtube-search", `${call} failed: ${res.status}`, body.slice(0, 500));
}
