// lib/jobs/registry.ts — jobType -> handler dispatch table for the worker route.

import type { Job } from "@/db/schema";
import type { JobPayloadMap, JobType } from "@/lib/queue/types";
import { handleTemplateGenerate } from "./templateGenerate";
import { handleKeywordSnapshot } from "./keywordSnapshot";
import { handleAiImproveSection } from "./aiImproveSection";
import { handleScoreTitles } from "./scoreTitles";
import { handleStagePosts } from "./stagePosts";
import { handleNotify } from "./notify";
import { handleMetricsPull } from "./metricsPull";
import { handleOutlierPull } from "./outlierPull";
import { handleUpdateProvenPatterns } from "./updateProvenPatterns";

type Handler<T extends JobType> = (payload: JobPayloadMap[T]) => Promise<void>;

const handlers: { [T in JobType]: Handler<T> } = {
  template_generate: handleTemplateGenerate,
  keyword_snapshot: handleKeywordSnapshot,
  ai_improve_section: handleAiImproveSection,
  score_titles: handleScoreTitles,
  stage_posts: handleStagePosts,
  notify: handleNotify,
  metrics_pull: handleMetricsPull,
  outlier_pull: handleOutlierPull,
  update_proven_patterns: handleUpdateProvenPatterns,
};

export async function runHandler(job: Job): Promise<void> {
  const jobType = job.jobType as JobType;
  const handler = handlers[jobType] as ((payload: unknown) => Promise<void>) | undefined;
  if (!handler) {
    throw new Error(`no handler registered for job type "${job.jobType}"`);
  }
  // Runtime dispatch on a DB-sourced string key inherently can't be statically
  // narrowed to the matching payload type — the cast above is the dispatch
  // boundary; each individual handler still has a fully typed payload param.
  await handler(job.payload);
}
