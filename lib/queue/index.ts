// lib/queue/index.ts — DB-backed job queue (no external queue service; Neon Postgres + jobs table).
// See docs/superpowers/specs/2026-07-05-integrated-system-design.md §6.1.
//
// Concurrency safety: claimNextJob() uses a single atomic
// `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` statement.
// This is one Postgres statement (one implicit transaction), so it works
// over the Neon HTTP driver (drizzle-orm/neon-http) without needing
// multi-statement session transactions, which that driver does not support.

import { sql, eq } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { db } from "@/db/client";
import { jobs, drafts, type Job } from "@/db/schema";
import { AUTO_IMPROVE_SECTIONS } from "@/lib/ai/prompts";
import type { JobType, JobPayloadMap } from "./types";

const STALE_LOCK_MINUTES = 5;

/** Insert a job row and best-effort trigger the worker immediately. */
export async function enqueue<T extends JobType>(
  jobType: T,
  payload: JobPayloadMap[T],
  opts?: { runAfter?: Date },
): Promise<number> {
  const [row] = await db
    .insert(jobs)
    .values({
      jobType,
      payload,
      runAfter: opts?.runAfter ?? new Date(),
    })
    .returning({ id: jobs.id });
  fireWorker();
  return row.id;
}

/**
 * Best-effort self-invoke of the worker endpoint. Never throws.
 * Missing APP_URL/CRON_SECRET or a network failure just means the
 * cron-job.org sweeper (1-min interval) picks the job up instead
 * (3-trigger design — see design doc §2.2).
 */
export function fireWorker(): void {
  const appUrl = process.env.APP_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!appUrl || !cronSecret) return;
  const dispatch = fetch(`${appUrl}/api/jobs/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${cronSecret}` },
  }).catch(() => {});
  // A001 M-1: a bare fire-and-forget fetch can be dropped when the serverless
  // function freezes right after returning its response. waitUntil() keeps the
  // function alive until the dispatch request is actually sent. Outside a
  // Vercel request context (local dev, tests) waitUntil may be unavailable —
  // fall back to plain fire-and-forget there.
  try {
    waitUntil(dispatch);
  } catch {
    // no Vercel request context — dispatch continues as fire-and-forget
  }
}

/**
 * Atomically claim the oldest eligible job: queued-and-due, or a stale
 * "running" job whose lock expired (worker crashed mid-processing).
 * Returns null when no job is eligible. Safe under concurrent callers
 * (FOR UPDATE SKIP LOCKED — a second concurrent caller skips locked rows).
 */
export async function claimNextJob(): Promise<Job | null> {
  const result = await db.execute(sql`
    UPDATE jobs
    SET status = 'running', locked_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE (status = 'queued' AND run_after <= now())
         OR (status = 'running' AND locked_at < now() - interval '${sql.raw(String(STALE_LOCK_MINUTES))} minutes')
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, job_type, payload, status, attempts, max_attempts,
              run_after, locked_at, last_error, created_at, completed_at;
  `);
  const row = (result.rows as unknown as RawJobRow[])[0];
  return row ? mapRawJobRow(row) : null;
}

export async function completeJob(id: number): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(jobs.id, id));
}

/**
 * Record a job failure. Retries with exponential backoff (2^attempts minutes)
 * until maxAttempts is exhausted, then marks the job `dead` and enqueues a
 * pipeline_failed notification (skipped for jobs with no draftId in their
 * payload, e.g. metrics_pull/outlier_pull, and for notify jobs themselves —
 * to avoid an infinite notify-about-notify-failure loop).
 */
export async function failJob(id: number, error: string): Promise<void> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return;

  if (job.attempts >= job.maxAttempts) {
    await db
      .update(jobs)
      .set({ status: "dead", lastError: error })
      .where(eq(jobs.id, id));

    const draftId = draftIdFromPayload(job.payload);

    // Terminal pipelineStatus transition (A001 B-1): mark the draft failed
    // directly here — not via the notify job — so the status closes out even
    // if the notify job itself can never run. A later package_ready notify
    // (from a chain that survived this dead job) overwrites this with
    // 'completed', which correctly reflects a partial-success outcome.
    if (draftId !== null) {
      await db
        .update(drafts)
        .set({ pipelineStatus: "failed" })
        .where(eq(drafts.id, draftId));
    }

    if (job.jobType !== "notify" && draftId !== null) {
      await enqueue("notify", { draftId, kind: "pipeline_failed", failedJobType: job.jobType });
    }

    // Chain succession (A001 M-2, extended): a dead mid-pipeline stage must
    // hand off to the next one. Without this, a single permanently failing
    // stage silently kills every later stage — no staged posts, no
    // package_ready notify, draft stuck as failed even though most of the
    // package generated fine. Partial success is the design contract (§4).
    //
    // ai_improve_section is special-cased because it carries the `remaining`
    // section list; every other stage has a fixed successor.
    if (draftId !== null) {
      await enqueueSuccessorStage(job.jobType, job.payload, draftId);
    }
    return;
  }

  const runAfter = new Date(Date.now() + computeBackoffMinutes(job.attempts) * 60_000);
  await db
    .update(jobs)
    .set({ status: "queued", lastError: error, runAfter })
    .where(eq(jobs.id, id));
}

/** Fixed successor for each mid-pipeline stage (mirrors the happy-path chain in lib/jobs/*). */
export const SUCCESSOR_STAGE_FOR_TEST: Partial<Record<string, JobType>> = {
  template_generate: "keyword_snapshot",
  keyword_snapshot: "ai_improve_section",
  score_titles: "stage_posts",
  stage_posts: "notify",
};

async function enqueueSuccessorStage(
  jobType: string,
  payload: Record<string, unknown>,
  draftId: number,
): Promise<void> {
  if (jobType === "ai_improve_section") {
    const remaining = Array.isArray(payload.remaining) ? (payload.remaining as string[]) : [];
    if (remaining.length > 0) {
      const [next, ...rest] = remaining;
      await enqueue("ai_improve_section", { draftId, sectionKey: next, remaining: rest });
    } else {
      await enqueue("score_titles", { draftId });
    }
    return;
  }

  const successor = SUCCESSOR_STAGE_FOR_TEST[jobType];
  if (!successor) return; // notify / metrics_pull / outlier_pull: nothing follows

  if (successor === "ai_improve_section") {
    // Entering the section loop: start at the first section with the rest queued behind it.
    const [first, ...rest] = AUTO_IMPROVE_SECTIONS;
    await enqueue("ai_improve_section", { draftId, sectionKey: first, remaining: [...rest] });
  } else if (successor === "notify") {
    await enqueue("notify", { draftId, kind: "package_ready" });
  } else {
    await enqueue(successor as "keyword_snapshot" | "score_titles" | "stage_posts", { draftId });
  }
}

// ─── Pure helpers (exported for unit testing without a live DB — see tests/queue.test.ts) ───

/** Exponential backoff in minutes: attempts=1 -> 2, 2 -> 4, 3 -> 8, ... */
export function computeBackoffMinutes(attempts: number): number {
  return Math.pow(2, attempts);
}

export function draftIdFromPayload(payload: Record<string, unknown>): number | null {
  return typeof payload.draftId === "number" ? payload.draftId : null;
}

// ─── Raw-row mapping (db.execute(sql`...`) bypasses Drizzle's camelCase mapper) ───

interface RawJobRow {
  id: number;
  job_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  run_after: string | Date;
  locked_at: string | Date | null;
  last_error: string | null;
  created_at: string | Date;
  completed_at: string | Date | null;
}

export function mapRawJobRow(row: RawJobRow): Job {
  return {
    id: row.id,
    jobType: row.job_type,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: new Date(row.run_after),
    lockedAt: row.locked_at ? new Date(row.locked_at) : null,
    lastError: row.last_error,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

export type { JobType, JobPayloadMap } from "./types";
