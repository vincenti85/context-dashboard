"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { retryPipeline } from "@/app/actions";
import type { JobSummaryRow } from "@/lib/queue/types";

const JOB_LABELS: Record<string, string> = {
  template_generate: "템플릿 생성",
  keyword_snapshot: "키워드 검증",
  ai_improve_section: "AI 섹션 개선",
  score_titles: "제목 스코어링",
  stage_posts: "게시물 준비",
  notify: "알림 발송",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "대기 중",
  running: "실행 중",
  completed: "완료",
  failed: "재시도 대기",
  dead: "실패",
};

/** Draft detail page — shows the auto-pipeline's job history and polls while it's still running. */
export function PipelineStatus({
  draftId,
  pipelineStatus,
  jobs,
}: {
  draftId: number;
  pipelineStatus: string;
  jobs: JobSummaryRow[];
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const isActive = pipelineStatus === "queued" || pipelineStatus === "generating";
  const hasDead = jobs.some((j) => j.status === "dead");

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(interval);
  }, [isActive, router]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryPipeline(draftId);
      router.refresh();
    } finally {
      setRetrying(false);
    }
  }

  if (jobs.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-muted">
          자동 파이프라인 {isActive && <span className="text-accent">(진행 중...)</span>}
        </h3>
        {hasDead && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="rounded-md border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            {retrying ? "재시도 중..." : "파이프라인 재시도"}
          </button>
        )}
      </div>
      <ol className="space-y-1.5">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                job.status === "completed"
                  ? "bg-green-400"
                  : job.status === "dead"
                    ? "bg-red-400"
                    : job.status === "failed"
                      ? "bg-yellow-400"
                      : "bg-blue-400"
              }`}
            />
            <span className="text-text">{JOB_LABELS[job.job_type] ?? job.job_type}</span>
            <span className="text-text-subtle">
              {STATUS_LABELS[job.status] ?? job.status}
              {job.attempts > 0 && ` (${job.attempts}/${job.max_attempts})`}
            </span>
            {job.last_error && (
              <span className="truncate text-red-400" title={job.last_error}>
                — {job.last_error}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
