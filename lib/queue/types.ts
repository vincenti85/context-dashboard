// lib/queue/types.ts — Job type registry and payload contracts.
// See docs/superpowers/specs/2026-07-05-integrated-system-design.md §6.1, §4 (pipeline diagram).

export type JobType =
  | "template_generate"
  | "ai_improve_section"
  | "keyword_snapshot"
  | "score_titles"
  | "stage_posts"
  | "notify"
  | "metrics_pull"
  | "outlier_pull"
  | "update_proven_patterns";

/** Shape of a raw db.execute(sql`...`) row from jobs — used by actions.ts query helpers
 * for the UI (PipelineStatus/JobsPanel), which bypass Drizzle's camelCase mapper. */
export interface JobSummaryRow {
  id: number;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DeadJobRow extends JobSummaryRow {
  payload: { draftId?: number; [key: string]: unknown };
}

export interface JobPayloadMap {
  template_generate: { draftId: number };
  ai_improve_section: { draftId: number; sectionKey: string; remaining: string[] };
  keyword_snapshot: { draftId: number };
  score_titles: { draftId: number };
  stage_posts: { draftId: number };
  notify: { draftId: number; kind: "package_ready" | "pipeline_failed"; failedJobType?: string };
  metrics_pull: { day: string }; // YYYY-MM-DD
  outlier_pull: { channelIds: string[] };
  update_proven_patterns: Record<string, never>; // no payload — single channel_profile row
}
