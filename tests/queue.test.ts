// tests/queue.test.ts — Unit tests for lib/queue pure logic and fireWorker.
// claimNextJob/completeJob/failJob's actual DB round-trip (atomicity, SKIP LOCKED
// concurrency, backoff persistence) requires a live Postgres connection and is
// NOT exercised here — see WP3-V3..V6 in the final verification checklist
// (docs/superpowers/specs/2026-07-05-integrated-system-design.md §10), which
// must be run against a real Neon branch before this is considered verified.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeBackoffMinutes,
  draftIdFromPayload,
  mapRawJobRow,
  fireWorker,
} from "@/lib/queue";

describe("computeBackoffMinutes", () => {
  it("doubles per attempt: 1->2, 2->4, 3->8", () => {
    expect(computeBackoffMinutes(1)).toBe(2);
    expect(computeBackoffMinutes(2)).toBe(4);
    expect(computeBackoffMinutes(3)).toBe(8);
  });
});

describe("draftIdFromPayload", () => {
  it("returns the number when payload.draftId is a number", () => {
    expect(draftIdFromPayload({ draftId: 42 })).toBe(42);
  });

  it("returns null when draftId is missing", () => {
    expect(draftIdFromPayload({ day: "2026-07-05" })).toBeNull();
  });

  it("returns null when draftId is present but not a number", () => {
    expect(draftIdFromPayload({ draftId: "42" })).toBeNull();
  });
});

describe("mapRawJobRow", () => {
  it("maps snake_case DB row to camelCase Job, preserving nulls", () => {
    const row = {
      id: 1,
      job_type: "template_generate",
      payload: { draftId: 7 },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      run_after: "2026-07-05T00:00:00.000Z",
      locked_at: null,
      last_error: null,
      created_at: "2026-07-05T00:00:00.000Z",
      completed_at: null,
    };
    const job = mapRawJobRow(row);
    expect(job.id).toBe(1);
    expect(job.jobType).toBe("template_generate");
    expect(job.payload).toEqual({ draftId: 7 });
    expect(job.maxAttempts).toBe(3);
    expect(job.lockedAt).toBeNull();
    expect(job.completedAt).toBeNull();
    expect(job.runAfter).toBeInstanceOf(Date);
    expect(job.createdAt).toBeInstanceOf(Date);
  });

  it("maps non-null lockedAt/completedAt to Date instances", () => {
    const row = {
      id: 2,
      job_type: "notify",
      payload: {},
      status: "running",
      attempts: 1,
      max_attempts: 3,
      run_after: "2026-07-05T00:00:00.000Z",
      locked_at: "2026-07-05T00:01:00.000Z",
      last_error: "boom",
      created_at: "2026-07-05T00:00:00.000Z",
      completed_at: "2026-07-05T00:02:00.000Z",
    };
    const job = mapRawJobRow(row);
    expect(job.lockedAt).toBeInstanceOf(Date);
    expect(job.completedAt).toBeInstanceOf(Date);
    expect(job.lastError).toBe("boom");
  });
});

describe("fireWorker", () => {
  const originalAppUrl = process.env.APP_URL;
  const originalCronSecret = process.env.CRON_SECRET;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    process.env.APP_URL = originalAppUrl;
    process.env.CRON_SECRET = originalCronSecret;
    vi.unstubAllGlobals();
  });

  it("does nothing when APP_URL is missing", () => {
    delete process.env.APP_URL;
    process.env.CRON_SECRET = "s3cr3t";
    fireWorker();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when CRON_SECRET is missing", () => {
    process.env.APP_URL = "https://example.vercel.app";
    delete process.env.CRON_SECRET;
    fireWorker();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs to /api/jobs/run with a Bearer header when both are configured", () => {
    process.env.APP_URL = "https://example.vercel.app";
    process.env.CRON_SECRET = "s3cr3t";
    fireWorker();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.vercel.app/api/jobs/run",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: "Bearer s3cr3t" },
      }),
    );
  });

  it("never throws even if fetch rejects", () => {
    process.env.APP_URL = "https://example.vercel.app";
    process.env.CRON_SECRET = "s3cr3t";
    fetchSpy.mockRejectedValue(new Error("network down"));
    expect(() => fireWorker()).not.toThrow();
  });
});
