// lib/jobs/outlierPull.ts — Benchmark channel outlier snapshot (S4).
// Triggered by app/api/cron/daily/route.ts using channel_profile.benchmarkChannelIds.
// Skips gracefully when YOUTUBE_API_KEY is unset or no channels are configured.

import { db } from "@/db/client";
import { outlierSnapshots, type OutlierVideoItem } from "@/db/schema";
import { ytApiKey } from "@/lib/youtube/client";
import type { JobPayloadMap } from "@/lib/queue/types";

interface SearchListItem {
  id: { videoId?: string };
  snippet: { title: string; publishedAt: string };
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

export async function handleOutlierPull(payload: JobPayloadMap["outlier_pull"]): Promise<void> {
  const { channelIds } = payload;
  if (!process.env.YOUTUBE_API_KEY || channelIds.length === 0) return;

  for (const channelId of channelIds) {
    const searchRes = await ytApiKey<SearchListResponse>("search", {
      part: "snippet",
      channelId,
      type: "video",
      order: "date",
      maxResults: "10",
    });
    const videoIds = searchRes.items.map((i) => i.id.videoId).filter((id): id is string => Boolean(id));
    if (videoIds.length === 0) continue;

    const statsRes = await ytApiKey<VideosListResponse>("videos", {
      part: "statistics",
      id: videoIds.join(","),
    });
    const viewsById = new Map(
      statsRes.items.map((i) => [i.id, parseInt(i.statistics.viewCount ?? "0", 10) || 0]),
    );

    const items: OutlierVideoItem[] = searchRes.items
      .filter((i): i is SearchListItem & { id: { videoId: string } } => Boolean(i.id.videoId))
      .map((i) => ({
        videoId: i.id.videoId,
        title: i.snippet.title,
        viewCount: viewsById.get(i.id.videoId) ?? 0,
        publishedAt: i.snippet.publishedAt,
      }));

    await db.insert(outlierSnapshots).values({ channelId, items });
  }
}
