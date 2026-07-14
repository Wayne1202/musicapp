/** Internal shapes for the YouTube Data API's raw responses — not exposed to the client.
 *  The public contract clients actually consume is `SearchResultDTO` (packages/shared). */

export interface DataApiSearchResponse {
  items: Array<{
    id: { videoId?: string };
    snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> };
  }>;
}

export interface DataApiVideosListResponse {
  items: Array<{
    id: string;
    snippet: { title: string; thumbnails: Record<string, { url: string }> };
    contentDetails: { duration: string };
  }>;
}
