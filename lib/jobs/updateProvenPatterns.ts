// lib/jobs/updateProvenPatterns.ts — Feedback loop stage (S3).
// Deterministic (no AI call — keeps this free and dependency-free): summarizes
// the top-performing drafts by total views into channel_profile.provenPatterns,
// which channelContextBlock() then injects into every future AI prompt.
// Triggered by lib/jobs/metricsPull.ts after it records a day's metrics.

import { sql, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { channelProfile } from "@/db/schema";
import type { JobPayloadMap } from "@/lib/queue/types";

interface TopDraftRow {
  draft_id: number;
  title: string;
  total_views: number;
}

export async function handleUpdateProvenPatterns(
  _payload: JobPayloadMap["update_proven_patterns"],
): Promise<void> {
  const result = await db.execute(sql`
    SELECT d.id AS draft_id, d.title AS title, SUM(vm.views) AS total_views
    FROM video_metrics vm
    JOIN drafts d ON d.id = vm.draft_id
    GROUP BY d.id, d.title
    ORDER BY total_views DESC
    LIMIT 3
  `);
  const topDrafts = result.rows as unknown as TopDraftRow[];
  if (topDrafts.length === 0) return; // no performance data yet — nothing to learn from

  const summary = topDrafts
    .map((d) => `"${d.title}" (누적 조회수 ${Number(d.total_views).toLocaleString("ko-KR")})`)
    .join(", ");

  const [profile] = await db.select().from(channelProfile).limit(1);
  if (!profile) return; // no channel profile configured yet (M8 not set up) — skip gracefully

  await db
    .update(channelProfile)
    .set({ provenPatterns: `최근 성과 상위 콘텐츠: ${summary}` })
    .where(eq(channelProfile.id, profile.id));
}
