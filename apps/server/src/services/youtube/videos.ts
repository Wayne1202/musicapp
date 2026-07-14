import { buildYouTubeThumbnailUrl, parseIso8601Duration } from "@musicapp/shared";
import { env } from "../../lib/env";
import { HttpError } from "../../lib/http-error";
import { logger } from "../../lib/logger";

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  thumbnail: string;
  /** Duration in seconds. 0 if unknown (no YOUTUBE_API_KEY configured). */
  duration: number;
}

interface DataApiVideosResponse {
  items: Array<{
    id: string;
    snippet: { title: string; thumbnails: Record<string, { url: string }> };
    contentDetails: { duration: string };
  }>;
}

interface OEmbedResponse {
  title: string;
  thumbnail_url: string;
}

/**
 * Fetches video metadata for a given YouTube video ID. Prefers the official Data API
 * (gives us an accurate duration) but falls back to the public, key-less oEmbed endpoint
 * so the app works out of the box without any API key configured.
 */
export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeVideoMetadata> {
  if (env.youtubeApiKey) {
    try {
      return await fetchViaDataApi(videoId, env.youtubeApiKey);
    } catch (err) {
      logger.warn("youtube", "Data API lookup failed, falling back to oEmbed", err);
    }
  }
  return fetchViaOEmbed(videoId);
}

async function fetchViaDataApi(videoId: string, apiKey: string): Promise<YouTubeVideoMetadata> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube Data API error: ${res.status}`);
  }
  const data = (await res.json()) as DataApiVideosResponse;
  const item = data.items?.[0];
  if (!item) {
    throw new HttpError(404, "Video not found or unavailable");
  }

  return { videoId, ...mapSnippetAndDuration(item) };
}

/** Shared by videos.ts's single-video lookup and search.ts's duration-batching call. */
export function mapSnippetAndDuration(item: {
  id: string;
  snippet: { title: string; thumbnails: Record<string, { url: string }> };
  contentDetails: { duration: string };
}): Omit<YouTubeVideoMetadata, "videoId"> {
  const thumbnail =
    item.snippet.thumbnails?.high?.url ??
    item.snippet.thumbnails?.medium?.url ??
    item.snippet.thumbnails?.default?.url ??
    buildYouTubeThumbnailUrl(item.id);

  return {
    title: item.snippet.title,
    thumbnail,
    duration: parseIso8601Duration(item.contentDetails.duration),
  };
}

async function fetchViaOEmbed(videoId: string): Promise<YouTubeVideoMetadata> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}&format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpError(404, "Video not found or unavailable");
  }
  const data = (await res.json()) as OEmbedResponse;

  return {
    videoId,
    title: data.title,
    thumbnail: data.thumbnail_url ?? buildYouTubeThumbnailUrl(videoId),
    duration: 0,
  };
}
