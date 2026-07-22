// app/actions.ts — Server Actions for draft CRUD + generation.
// All actions use the Drizzle pooler client + revalidatePath.

"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  drafts,
  generations,
  generationOutputs,
  channelProfile,
  jobs,
  scheduledPosts,
  keywordSnapshots,
  type GenerationOutput,
  type ChannelProfile,
} from "@/db/schema";
import { templateGenerate, deriveDraftMetadataUpdate } from "@/lib/generator";
import { aiImprove } from "@/lib/ai/improve";
import { channelContextBlock } from "@/lib/ai/prompts";
import {
  assembleDocument,
  parseAiOverrides,
  serializeAiOverrides,
  extractSectionChunk,
} from "@/lib/export";
import { requireAdmin } from "@/lib/auth";
import { enqueue, fireWorker } from "@/lib/queue";
import type { JobSummaryRow, DeadJobRow } from "@/lib/queue/types";
import { applyMetadata } from "@/lib/youtube/metadata";

async function getChannelContext(): Promise<string> {
  const [profile] = await db.select().from(channelProfile).limit(1);
  return channelContextBlock(profile ?? null);
}

// ─── Draft CRUD ────────────────────────────────────────────────
// Every mutating action starts with requireAdmin() as defense-in-depth.
// middleware.ts already blocks unauthenticated requests to these routes;
// this guard protects the action itself if ever invoked from a context
// middleware does not cover (golden-principles.md #6: validate at boundaries).

export async function createDraft(title: string, sourceMarkdown: string) {
  await requireAdmin();
  const [draft] = await db
    .insert(drafts)
    .values({ title, sourceMarkdown, status: "draft", pipelineStatus: "queued" })
    .returning();
  revalidatePath("/drafts");
  // Auto-pipeline (WP2-WP4): saving a draft with real content kicks off
  // template_generate -> keyword_snapshot -> ai_improve_section chain ->
  // score_titles -> stage_posts -> notify, with zero further manual action.
  await enqueue("template_generate", { draftId: draft.id });
  return draft;
}

export async function updateDraft(
  id: number,
  fields: { title?: string; sourceMarkdown?: string; status?: string },
) {
  await requireAdmin();
  const [current] = await db.select().from(drafts).where(eq(drafts.id, id));
  if (!current) throw new Error("Draft not found");

  await db.update(drafts).set(fields).where(eq(drafts.id, id));
  revalidatePath(`/drafts/${id}`);
  revalidatePath("/drafts");

  // Only re-run the auto-pipeline when the content ACTUALLY changed (A001 M-3):
  // the editor always sends sourceMarkdown on save, so a value comparison —
  // not just presence — is required. Without it, every no-op save burns ~8 LLM
  // calls and discards existing ai_overrides by creating a fresh baseline.
  const contentChanged =
    fields.sourceMarkdown !== undefined && fields.sourceMarkdown !== current.sourceMarkdown;
  if (contentChanged) {
    await db.update(drafts).set({ pipelineStatus: "queued" }).where(eq(drafts.id, id));
    await enqueue("template_generate", { draftId: id });
  }
}

/** Restart the auto-pipeline from scratch for a draft (JobsPanel "재시도" action on a dead pipeline). */
export async function retryPipeline(draftId: number) {
  await requireAdmin();
  // Clean up dead jobs from the previous failed run first (design §6.7-adjacent
  // "dead 잡 정리 후 파이프라인 재시작") — otherwise old dead rows stay in the
  // table forever and PipelineStatus/JobsPanel keep showing a failure badge
  // even after this retry succeeds.
  await db
    .delete(jobs)
    .where(and(eq(jobs.status, "dead"), sql`payload->>'draftId' = ${String(draftId)}`));
  await db.update(drafts).set({ pipelineStatus: "queued" }).where(eq(drafts.id, draftId));
  await enqueue("template_generate", { draftId });
  revalidatePath(`/drafts/${draftId}`);
  revalidatePath("/");
}

/** Requeue a single dead job with a fresh attempt budget (JobsPanel per-row retry). */
export async function retryJob(jobId: number) {
  await requireAdmin();
  await db
    .update(jobs)
    .set({ status: "queued", attempts: 0, runAfter: new Date(), lastError: null })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "dead")));
  fireWorker();
  revalidatePath("/");
}

export async function getDrafts(status?: string) {
  if (status && status !== "all") {
    return db
      .select()
      .from(drafts)
      .where(eq(drafts.status, status))
      .orderBy(desc(drafts.updatedAt));
  }
  return db.select().from(drafts).orderBy(desc(drafts.updatedAt));
}

export async function getDraft(id: number) {
  const [draft] = await db.select().from(drafts).where(eq(drafts.id, id));
  return draft;
}

export async function updateStatus(draftId: number, status: string) {
  await requireAdmin();
  await db.update(drafts).set({ status }).where(eq(drafts.id, draftId));
  revalidatePath(`/drafts/${draftId}`);
  revalidatePath("/drafts");
}

export async function deleteDraft(id: number) {
  await requireAdmin();
  await db.delete(drafts).where(eq(drafts.id, id));
  revalidatePath("/drafts");
}

// ─── Generation ────────────────────────────────────────────────

/**
 * Generate content package from a draft.
 * mode=template: run templateGenerate, persist baseline + empty ai_overrides.
 * mode=ai_improve: improve ONE section (M1), validate B1, write override B2.
 */
export async function generatePackage(
  draftId: number,
  mode: "template" | "ai_improve",
  sectionKey?: string,
) {
  await requireAdmin();
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");

  if (mode === "template") {
    // Run template generation
    const result = templateGenerate(draft.sourceMarkdown);

    // Create generation record
    const [gen] = await db
      .insert(generations)
      .values({
        draftId,
        mode: "template",
        model: "template",
        status: "completed",
        completedAt: new Date(),
      })
      .returning();

    // Persist baseline outputs
    await db.insert(generationOutputs).values({
      generationId: gen.id,
      contentBrief: result.brief,
      outline: result.outline,
      uploadPackage: result.uploadPackage,
      aiOverrides: null,
    });

    // Update draft status and metadata.
    // Bug fix (WP0 audit): previously wrote result.meta.topic into BOTH
    // targetAudience and coreMessage. deriveDraftMetadataUpdate() only
    // includes fields the draft actually specified — see lib/generator/index.ts.
    await db
      .update(drafts)
      .set({
        status: "generated",
        ...deriveDraftMetadataUpdate(result.meta),
      })
      .where(eq(drafts.id, draftId));

    revalidatePath(`/drafts/${draftId}`);
    revalidatePath("/drafts");
    return { generationId: gen.id, result };
  }

  // mode === "ai_improve"
  if (!sectionKey) throw new Error("sectionKey required for ai_improve mode");

  // Get latest template generation for this draft
  const [latestGen] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.draftId, draftId), eq(generations.mode, "template")))
    .orderBy(desc(generations.createdAt))
    .limit(1);

  if (!latestGen) throw new Error("No template generation found. Run template first.");

  const [outputs] = await db
    .select()
    .from(generationOutputs)
    .where(eq(generationOutputs.generationId, latestGen.id));

  if (!outputs || !outputs.uploadPackage) throw new Error("No baseline output found");

  // Extract the template section for this key
  const sectionChunk = extractSectionChunk(outputs.uploadPackage, sectionKey);

  if (!sectionChunk) throw new Error(`Section "${sectionKey}" not found in baseline`);

  // Run AI improvement (Gemini -> Groq fallback chain; see lib/ai/provider.ts)
  const channelContext = await getChannelContext();
  const improveResult = await aiImprove(sectionKey, sectionChunk, channelContext);

  // Create generation record
  const [gen] = await db
    .insert(generations)
    .values({
      draftId,
      mode: "ai_improve",
      model: improveResult.modelUsed ?? "unknown",
      status: improveResult.success ? "completed" : "failed",
      errorMessage: improveResult.error,
      sectionKey,
      completedAt: new Date(),
    })
    .returning();

  if (!improveResult.success) {
    revalidatePath(`/drafts/${draftId}`);
    return { generationId: gen.id, error: improveResult.error };
  }

  // B2: Update ai_overrides
  const existingOverrides = parseAiOverrides(outputs.aiOverrides);
  const updatedOverrides: Record<string, string> = {
    ...(existingOverrides || {}),
    [sectionKey]: improveResult.improvedMarkdown!,
  };

  await db
    .update(generationOutputs)
    .set({ aiOverrides: serializeAiOverrides(updatedOverrides) })
    .where(eq(generationOutputs.id, outputs.id));

  revalidatePath(`/drafts/${draftId}`);
  return { generationId: gen.id, improved: true };
}

// ─── Query helpers ─────────────────────────────────────────────

export async function getLatestOutputs(
  draftId: number,
): Promise<{ generation: typeof generations.$inferSelect; output: GenerationOutput } | null> {
  const [gen] = await db
    .select()
    .from(generations)
    .where(eq(generations.draftId, draftId))
    .orderBy(desc(generations.createdAt))
    .limit(1);

  if (!gen) return null;

  const [output] = await db
    .select()
    .from(generationOutputs)
    .where(eq(generationOutputs.generationId, gen.id));

  if (!output) return null;

  return { generation: gen, output };
}

export async function getAssembledPackage(draftId: number): Promise<string | null> {
  const result = await getLatestOutputs(draftId);
  if (!result || !result.output.uploadPackage) return null;

  return assembleDocument(
    result.output.uploadPackage,
    parseAiOverrides(result.output.aiOverrides),
  );
}

// ─── Channel profile (M8, /settings) ───────────────────────────

export async function getChannelProfile(): Promise<ChannelProfile | null> {
  const [profile] = await db.select().from(channelProfile).limit(1);
  return profile ?? null;
}

export async function updateChannelProfile(fields: {
  channelName: string;
  channelDescription: string;
  defaultAudience: string;
  toneGuide?: string;
  benchmarkChannelIds?: string[];
}) {
  await requireAdmin();
  const existing = await getChannelProfile();
  if (existing) {
    await db.update(channelProfile).set(fields).where(eq(channelProfile.id, existing.id));
  } else {
    await db.insert(channelProfile).values(fields);
  }
  revalidatePath("/settings");
}

// ─── SNS post staging (M7) ──────────────────────────────────────

export async function getScheduledPosts(draftId: number) {
  return db.select().from(scheduledPosts).where(eq(scheduledPosts.draftId, draftId));
}

export async function updatePostStatus(
  postId: number,
  status: "draft" | "approved" | "published" | "discarded",
) {
  await requireAdmin();
  await db
    .update(scheduledPosts)
    .set({ status, publishedAt: status === "published" ? new Date() : null })
    .where(eq(scheduledPosts.id, postId));
  revalidatePath("/drafts");
}

// ─── Link a published video to a draft (S2 prerequisite) ────────
// metrics_pull only collects for drafts that carry a youtube_video_id, so this
// is what makes the performance feedback loop possible. Deliberately does NOT
// call the YouTube API: the deployed OAuth token holds the read-only Analytics
// scope, and linking is a local bookkeeping operation.

export async function linkYoutubeVideo(draftId: number, youtubeVideoId: string) {
  await requireAdmin();

  const trimmed = youtubeVideoId.trim();
  // Accept a bare ID or a full watch/share URL — pasting the URL straight from
  // the address bar is the obvious thing to do.
  const parsed =
    trimmed.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? trimmed;
  if (!/^[A-Za-z0-9_-]{11}$/.test(parsed)) {
    throw new Error("YouTube 영상 ID 형식이 아닙니다 (11자). 영상 URL을 붙여넣어도 됩니다.");
  }

  await db.update(drafts).set({ youtubeVideoId: parsed }).where(eq(drafts.id, draftId));
  revalidatePath(`/drafts/${draftId}`);
  return parsed;
}

// ─── YouTube metadata apply (S1 — NOT ENABLED) ──────────────────
// Kept for a future opt-in: the deployed OAuth token is Analytics-read-only,
// so this would fail with insufficient scope. Enabling S1 means adding
// https://www.googleapis.com/auth/youtube to app/api/youtube/oauth SCOPES,
// re-running that flow, and surfacing this action in the UI again.
//
// SAFETY: this is the ONLY call site for applyMetadata() in the whole app —
// it must never be invoked from an automatic pipeline job. Guard verified in
// WP9-V2: `grep -r "applyMetadata" lib/jobs/` must return 0 matches.

export async function applyYoutubeMetadata(draftId: number, youtubeVideoId: string) {
  await requireAdmin();

  const trimmedVideoId = youtubeVideoId.trim();
  if (!trimmedVideoId) throw new Error("youtubeVideoId is required");

  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");

  const assembled = await getAssembledPackage(draftId);
  if (!assembled) throw new Error("No generated package to publish");

  const description = extractSectionChunk(assembled, "4. 영상 설명란") ?? "";
  const titleSection = extractSectionChunk(assembled, "2. 유튜브 제목 후보") ?? "";
  const firstTitle = titleSection
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*\d+\.\s+(.+?)\s*$/)?.[1])
    .find(Boolean);

  await applyMetadata({
    videoId: trimmedVideoId,
    title: firstTitle ?? draft.title,
    description: description.replace(/^##.*\n/, "").trim(),
    tags: draft.targetAudience ? [draft.targetAudience] : [],
  });

  await db.update(drafts).set({ youtubeVideoId: trimmedVideoId }).where(eq(drafts.id, draftId));
  revalidatePath(`/drafts/${draftId}`);
}

// ─── Pipeline observability (M9, JobsPanel/PipelineStatus) ─────

export async function getJobsForDraft(draftId: number): Promise<JobSummaryRow[]> {
  const result = await db.execute(sql`
    SELECT id, job_type, status, attempts, max_attempts, last_error, created_at, completed_at
    FROM jobs
    WHERE payload->>'draftId' = ${String(draftId)}
    ORDER BY created_at ASC
  `);
  return result.rows as unknown as JobSummaryRow[];
}

export async function getDeadJobs(): Promise<DeadJobRow[]> {
  const result = await db.execute(sql`
    SELECT id, job_type, payload, attempts, max_attempts, last_error, created_at
    FROM jobs
    WHERE status = 'dead'
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return result.rows as unknown as DeadJobRow[];
}

export async function getKeywordEvidence(draftId: number) {
  const [snapshot] = await db
    .select()
    .from(keywordSnapshots)
    .where(eq(keywordSnapshots.draftId, draftId))
    .orderBy(desc(keywordSnapshots.fetchedAt))
    .limit(1);
  return snapshot ?? null;
}

// ─── System status (guide page) ─────────────────────────────────
// Reports which integrations are wired up. Env values are read server-side and
// only their presence is returned — never the values themselves.

export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  required: boolean;
  /** What stops working when this is missing. */
  impact: string;
}

export async function getSystemStatus(): Promise<{
  integrations: IntegrationStatus[];
  channelProfileSet: boolean;
  pendingJobs: number;
  deadJobs: number;
  lastJobAt: string | null;
}> {
  const has = (k: string) => Boolean(process.env[k]?.trim());

  const integrations: IntegrationStatus[] = [
    { key: "DATABASE_URL", label: "데이터베이스 (Neon)", configured: has("DATABASE_URL"), required: true,
      impact: "없으면 대시보드 자체가 동작하지 않습니다." },
    { key: "CRON_SECRET", label: "워커 인증 토큰", configured: has("CRON_SECRET"), required: true,
      impact: "없으면 자동 파이프라인이 전혀 실행되지 않습니다." },
    { key: "APP_URL", label: "앱 주소", configured: has("APP_URL"), required: true,
      impact: "없으면 저장 직후 즉시 처리(self-invoke)가 동작하지 않습니다." },
    { key: "GOOGLE_GENERATIVE_AI_API_KEY", label: "AI 생성 (Gemini)", configured: has("GOOGLE_GENERATIVE_AI_API_KEY"), required: false,
      impact: "없으면 AI 개선 없이 템플릿 기본안만 생성됩니다." },
    { key: "GROQ_API_KEY", label: "AI 폴백 (Groq)", configured: has("GROQ_API_KEY"), required: false,
      impact: "선택 사항입니다. Gemini 실패 시 대체 경로로만 쓰입니다." },
    { key: "YOUTUBE_API_KEY", label: "키워드 검증 (YouTube Data)", configured: has("YOUTUBE_API_KEY"), required: false,
      impact: "없으면 경쟁 영상 근거와 제목 순위가 비어 있습니다." },
    { key: "YOUTUBE_REFRESH_TOKEN", label: "성과 수집 (YouTube Analytics)", configured: has("YOUTUBE_REFRESH_TOKEN"), required: false,
      impact: "없으면 조회수 기반 피드백 루프가 동작하지 않습니다." },
    { key: "RESEND_API_KEY", label: "이메일 알림 (Resend)", configured: has("RESEND_API_KEY"), required: false,
      impact: "없으면 완료·실패 알림 메일이 오지 않습니다(파이프라인은 정상)." },
  ];

  const [profile] = await db.select().from(channelProfile).limit(1);

  const counts = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE status IN ('queued','running')) AS pending,
      count(*) FILTER (WHERE status = 'dead') AS dead,
      max(created_at) AS last_at
    FROM jobs
  `);
  const row = counts.rows[0] as { pending: string; dead: string; last_at: string | null };

  return {
    integrations,
    channelProfileSet: Boolean(profile),
    pendingJobs: Number(row?.pending ?? 0),
    deadJobs: Number(row?.dead ?? 0),
    lastJobAt: row?.last_at ?? null,
  };
}

// ─── Next content ideas (C1, performance-fed) ──────────────────

const IDEA_ANGLES = [
  (title: string) => `"${title}" 후속편 — 지난 영상에서 다루지 못한 심화 내용`,
  (title: string) => `"${title}"과(와) 대비되는 실패 사례 비교 콘텐츠`,
  (title: string) => `"${title}" 시청자가 가장 많이 놓치는 실수와 해결법`,
];

export interface NextContentIdea {
  text: string;
  sourceDraftTitle: string;
  totalViews: number;
}

/** Deterministic (no AI call) — surfaces ideas from actual top-performing drafts. */
export async function getNextContentIdeas(): Promise<NextContentIdea[]> {
  const result = await db.execute(sql`
    SELECT d.title AS title, SUM(vm.views) AS total_views
    FROM video_metrics vm
    JOIN drafts d ON d.id = vm.draft_id
    GROUP BY d.id, d.title
    ORDER BY total_views DESC
    LIMIT 3
  `);
  const rows = result.rows as unknown as { title: string; total_views: number }[];

  return rows.map((row, i) => ({
    text: IDEA_ANGLES[i % IDEA_ANGLES.length](row.title),
    sourceDraftTitle: row.title,
    totalViews: Number(row.total_views),
  }));
}

export async function getOverviewStats() {
  const allDrafts = await db.select().from(drafts);
  const total = allDrafts.length;
  const generated = allDrafts.filter((d) =>
    ["generated", "reviewed", "ready"].includes(d.status),
  ).length;
  const needsReview = allDrafts.filter((d) => d.status === "generated").length;

  const recentGens = await db
    .select()
    .from(generations)
    .orderBy(desc(generations.createdAt))
    .limit(5);

  return { total, generated, needsReview, recentGenerations: recentGens };
}
