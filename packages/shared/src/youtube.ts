// Parses the two supported YouTube URL formats and extracts the 11-character video ID:
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://youtu.be/VIDEO_ID
// Also tolerates youtube.com/embed/, /shorts/, and extra query params (e.g. &t=30s, &list=...).

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare video ID pasted directly.
  if (VIDEO_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && VIDEO_ID_PATTERN.test(id) ? id : null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if ((segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live") && segments[1]) {
      return VIDEO_ID_PATTERN.test(segments[1]) ? segments[1] : null;
    }
  }

  return null;
}

export function isValidYouTubeUrl(input: string): boolean {
  return extractYouTubeVideoId(input) !== null;
}

export function buildYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Parses an ISO 8601 duration (e.g. "PT4M13S") returned by the YouTube Data API into seconds. */
export function parseIso8601Duration(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}
