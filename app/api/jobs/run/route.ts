// app/api/jobs/run/route.ts — Worker endpoint. Called by:
//  ① enqueue()'s self-invoke (immediacy)
//  ② cron-job.org, 1-min interval (sweeper: retries + catches missed self-invokes)
//  ③ chained re-invocation from within this route when queued jobs remain
// Auth: Bearer CRON_SECRET (NOT the admin session cookie — see middleware.ts
// and lib/auth.ts). This endpoint has no browser session; it is called by
// external services and by itself.

import { NextRequest, NextResponse } from "next/server";
import { isValidCronSecret } from "@/lib/auth";
import { claimNextJob, completeJob, failJob, fireWorker } from "@/lib/queue";
import { runHandler } from "@/lib/jobs/registry";

export const maxDuration = 60; // Vercel Hobby: verify actual ceiling on preview deploy (WP3-V3).

// Soft deadline: stop claiming new jobs once this many ms have elapsed, so we
// always return a response before Vercel's hard function timeout. Deliberately
// well under the Hobby maxDuration ambiguity noted in the WP0 audit.
const SOFT_DEADLINE_MS = 8_000;

interface ProcessedEntry {
  id: number;
  jobType: string;
  outcome: "completed" | "failed";
}

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deadline = Date.now() + SOFT_DEADLINE_MS;
  const processed: ProcessedEntry[] = [];

  while (Date.now() < deadline) {
    const job = await claimNextJob();
    if (!job) break;

    try {
      await runHandler(job);
      await completeJob(job.id);
      processed.push({ id: job.id, jobType: job.jobType, outcome: "completed" });
    } catch (err) {
      await failJob(job.id, err instanceof Error ? err.message : String(err));
      processed.push({ id: job.id, jobType: job.jobType, outcome: "failed" });
    }
  }

  // If we stopped because of the soft deadline (not because the queue is
  // empty), there may still be queued work — chain another invocation so a
  // single burst of enqueues drains without waiting for the 1-min sweeper.
  const stoppedOnDeadline = Date.now() >= deadline;
  if (stoppedOnDeadline) {
    fireWorker();
  }

  return NextResponse.json({ processed, chained: stoppedOnDeadline });
}
