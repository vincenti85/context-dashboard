// lib/jobs/metricsPull.ts — Daily performance collection (S2).
// Triggered by app/api/cron/daily/route.ts (Vercel Cron, 1x/day — Hobby limit).
// Skips gracefully (not a failure) when YouTube OAuth isn't configured yet.

import { isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts, videoMetrics } from "@/db/schema";
import { fetchDailyMetrics } from "@/lib/youtube/analytics";
import { enqueue } from "@/lib/queue";
import type { JobPayloadMap } from "@/lib/queue/types";

export async function handleMetricsPull(payload: JobPayloadMap["metrics_pull"]): Promise<void> {
  const { day } = payload;

  if (!process.env.YOUTUBE_CLIENT_ID) return; // OAuth not configured — optional integration, skip

  const publishedDrafts = await db.select().from(drafts).where(isNotNull(drafts.youtubeVideoId));
  if (publishedDrafts.length === 0) return;

  const videoIds = publishedDrafts.map((d) => d.youtubeVideoId).filter((id): id is string => Boolean(id));
  const metrics = await fetchDailyMetrics(videoIds, day);
  const draftIdByVideoId = new Map(publishedDrafts.map((d) => [d.youtubeVideoId, d.id]));

  for (const m of metrics) {
    // Upsert on (video, day) so a retried job never duplicates a day's row (A001 M-4).
    await db
      .insert(videoMetrics)
      .values({
        youtubeVideoId: m.youtubeVideoId,
        draftId: draftIdByVideoId.get(m.youtubeVideoId) ?? null,
        day,
        views: m.views,
        avgViewDurationSec: m.avgViewDurationSec,
      })
      .onConflictDoUpdate({
        target: [videoMetrics.youtubeVideoId, videoMetrics.day],
        set: {
          views: m.views,
          avgViewDurationSec: m.avgViewDurationSec,
          fetchedAt: new Date(),
        },
      });
  }

  if (metrics.length > 0) {
    // Feed today's performance back into the channel profile (S3) so future
    // AI prompts reference what's actually working.
    await enqueue("update_proven_patterns", {});
  }
}
