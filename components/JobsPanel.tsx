"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryJob } from "@/app/actions";
import type { DeadJobRow } from "@/lib/queue/types";

/** Dashboard (/) — surfaces jobs that exhausted retries so failures are never silent (M9). */
export function JobsPanel({ jobs }: { jobs: DeadJobRow[] }) {
  const router = useRouter();
  const [retryingId, setRetryingId] = useState<number | null>(null);

  if (jobs.length === 0) return null;

  async function handleRetry(jobId: number) {
    setRetryingId(jobId);
    try {
      await retryJob(jobId);
      router.refresh();
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
      <h3 className="mb-3 text-sm font-medium text-red-300">
        실패한 작업 {jobs.length}건 — 확인이 필요합니다
      </h3>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-subtle px-3 py-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text">{job.job_type}</span>
                {job.payload.draftId && (
                  <a
                    href={`/drafts/${job.payload.draftId}`}
                    className="text-accent hover:text-accent-hover"
                  >
                    드래프트 #{job.payload.draftId}
                  </a>
                )}
              </div>
              {job.last_error && (
                <p className="mt-0.5 truncate text-text-subtle" title={job.last_error}>
                  {job.last_error}
                </p>
              )}
            </div>
            <button
              onClick={() => handleRetry(job.id)}
              disabled={retryingId === job.id}
              className="ml-3 shrink-0 rounded-md border border-border px-2 py-1 text-text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              {retryingId === job.id ? "재시도 중..." : "재시도"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
