// lib/jobs/notify.ts — Terminal pipeline stage: email the admin.
// De-dupe: skip if a completed "notify" job with the same draftId+kind
// exists within the last hour (design §6.3: Resend free tier is 100/day,
// and repeated failures of the same job shouldn't spam separate emails).
// No further chaining — this is the end of the pipeline for a given run.

import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts, keywordSnapshots } from "@/db/schema";
import { sendPackageReadyEmail, sendPipelineFailedEmail } from "@/lib/notify";
import type { JobPayloadMap } from "@/lib/queue/types";

export async function handleNotify(payload: JobPayloadMap["notify"]): Promise<void> {
  const { draftId, kind, failedJobType } = payload;

  const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId));
  if (!draft) return; // draft was deleted in the meantime — nothing to notify about

  // Terminal pipelineStatus transition (A001 B-1). Must happen BEFORE the email
  // dedupe check: a re-run within the dedupe window still needs its status
  // closed out, even when the duplicate email is suppressed. The 'failed'
  // counterpart is set directly in failJob (lib/queue/index.ts) so it applies
  // even if this notify job itself never runs.
  if (kind === "package_ready") {
    await db
      .update(drafts)
      .set({ pipelineStatus: "completed" })
      .where(eq(drafts.id, draftId));
  }

  const recent = await db.execute(sql`
    SELECT id FROM jobs
    WHERE job_type = 'notify'
      AND status = 'completed'
      AND completed_at > now() - interval '1 hour'
      AND payload->>'draftId' = ${String(draftId)}
      AND payload->>'kind' = ${kind}
    LIMIT 1
  `);
  if (recent.rows.length > 0) return; // deduped — an equivalent notification already went out recently

  const dashboardUrl = `${process.env.APP_URL ?? ""}/drafts/${draftId}`;

  if (kind === "package_ready") {
    const [snapshot] = await db
      .select()
      .from(keywordSnapshots)
      .where(eq(keywordSnapshots.draftId, draftId))
      .orderBy(desc(keywordSnapshots.fetchedAt))
      .limit(1);
    const top = snapshot?.titleScores?.slice().sort((a, b) => a.rank - b.rank)[0];

    await sendPackageReadyEmail({
      draftTitle: draft.title,
      topTitleCandidate: top?.title ?? null,
      dashboardUrl,
    });
  } else {
    await sendPipelineFailedEmail({
      draftTitle: draft.title,
      failedJobType: failedJobType ?? "unknown",
      errorSummary: "파이프라인 실행 중 오류가 발생했습니다. 대시보드의 실패 작업 목록을 확인하세요.",
      dashboardUrl,
    });
  }
}
