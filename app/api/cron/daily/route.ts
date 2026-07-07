// app/api/cron/daily/route.ts — Vercel Cron, 1x/day (Hobby plan limit — see WP0 audit).
// Enqueues the heavy work (metrics_pull, outlier_pull) rather than doing it inline,
// so this route itself returns in well under a second regardless of API latency.
//
// Auth: same CRON_SECRET Bearer check as /api/jobs/run (lib/auth.ts). Configure
// CRON_SECRET as a Vercel env var and verify at deploy time whether Vercel's Cron
// feature auto-attaches it as `Authorization: Bearer $CRON_SECRET` (check Vercel's
// current Cron Jobs docs) — if not, this route can also be triggered by cron-job.org
// with the header set manually, same as the worker endpoint.

import { NextRequest, NextResponse } from "next/server";
import { isValidCronSecret } from "@/lib/auth";
import { enqueue } from "@/lib/queue";
import { db } from "@/db/client";
import { channelProfile } from "@/db/schema";

export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await enqueue("metrics_pull", { day: yesterday });

  const [profile] = await db.select().from(channelProfile).limit(1);
  if (profile?.benchmarkChannelIds?.length) {
    await enqueue("outlier_pull", { channelIds: profile.benchmarkChannelIds });
  }

  return NextResponse.json({ ok: true, day: yesterday });
}
