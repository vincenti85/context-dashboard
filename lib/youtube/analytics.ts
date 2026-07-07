// lib/youtube/analytics.ts — Daily performance pull (S2).
// Scope note: this pass covers views + average view duration via the basic
// reports.query endpoint. Impressions/CTR require a separate report
// dimension set (e.g. playback-based traffic-source reports) — deferred;
// video_metrics.impressions/ctr remain nullable until that follow-up lands.

import { ytOAuth, YT_ANALYTICS_BASE } from "./client";

export interface VideoMetricRow {
  youtubeVideoId: string;
  views: number;
  avgViewDurationSec: number;
}

interface AnalyticsQueryResponse {
  rows?: Array<[string, number, number]>;
}

export async function fetchDailyMetrics(videoIds: string[], day: string): Promise<VideoMetricRow[]> {
  if (videoIds.length === 0) return [];

  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate: day,
    endDate: day,
    metrics: "views,averageViewDuration",
    dimensions: "video",
    filters: `video==${videoIds.join(",")}`,
  });

  const res = await ytOAuth<AnalyticsQueryResponse>(`reports?${params.toString()}`, {}, YT_ANALYTICS_BASE);

  return (res.rows ?? []).map(([videoId, views, avgViewDuration]) => ({
    youtubeVideoId: String(videoId),
    views: Number(views) || 0,
    avgViewDurationSec: Number(avgViewDuration) || 0,
  }));
}
