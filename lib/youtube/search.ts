// lib/youtube/search.ts — Keyword evidence for M6 (title scoring).
// Quota budget per draft: search.list (1) + videos.list (1) = 2 calls.
// Caching (7-day TTL) is enforced by the caller (lib/jobs/keywordSnapshot.ts).

import { ytApiKey } from "./client";
import type { KeywordItem } from "@/db/schema";

interface SearchListItem {
  id: { videoId?: string };
  snippet: { title: string; channelTitle: string; publishedAt: string };
}
interface SearchListResponse {
  items: SearchListItem[];
}
interface VideosListItem {
  id: string;
  statistics: { viewCount?: string };
}
interface VideosListResponse {
  items: VideosListItem[];
}

export async function fetchKeywordEvidence(keyword: string): Promise<KeywordItem[]> {
  const searchRes = await ytApiKey<SearchListResponse>("search", {
    part: "snippet",
    q: keyword,
    type: "video",
    order: "viewCount",
    maxResults: "10",
  });

  const videoIds = searchRes.items.map((i) => i.id.videoId).filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return [];

  const statsRes = await ytApiKey<VideosListResponse>("videos", {
    part: "statistics",
    id: videoIds.join(","),
  });
  const viewsById = new Map(
    statsRes.items.map((item) => [item.id, parseInt(item.statistics.viewCount ?? "0", 10) || 0]),
  );

  return searchRes.items
    .filter((item): item is SearchListItem & { id: { videoId: string } } => Boolean(item.id.videoId))
    .map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      viewCount: viewsById.get(item.id.videoId) ?? 0,
      publishedAt: item.snippet.publishedAt,
    }));
}
