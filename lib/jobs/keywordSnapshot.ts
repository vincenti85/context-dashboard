// lib/jobs/keywordSnapshot.ts — Pipeline stage 2: cached keyword evidence (M6).
// Chain: enqueue(ai_improve_section, first of AUTO_IMPROVE_SECTIONS) on success.
// Keyword evidence is ENRICHMENT: the pipeline must not stall on an optional
// integration (design §6.9). That applies to a missing YOUTUBE_API_KEY *and*
// to a key that the API rejects — a 403 (API not enabled / key restricted /
// quota denied) will never succeed on retry, so it is skipped rather than
// retried into a dead job. Transient errors (429, 5xx, network) still throw so
// the queue retries them with backoff.

import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts, keywordSnapshots } from "@/db/schema";
import { fetchKeywordEvidence } from "@/lib/youtube/search";
import { YoutubeApiError } from "@/lib/youtube/client";
import { enqueue } from "@/lib/queue";
import { AUTO_IMPROVE_SECTIONS } from "@/lib/ai/prompts";
import { templateGenerate } from "@/lib/generator";
import type { JobPayloadMap } from "@/lib/queue/types";

/** 4xx other than 429 means the request will keep failing — retrying is pointless. */
export function isPermanentYoutubeError(err: unknown): boolean {
  if (!(err instanceof YoutubeApiError)) return false;
  const status = err.status;
  if (status === undefined) return true; // e.g. missing API key — configuration, not transient
  return status >= 400 && status < 500 && status !== 429;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function handleKeywordSnapshot(
  payload: JobPayloadMap["keyword_snapshot"],
): Promise<void> {
  const { draftId } = payload;

  const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId));
  if (!draft) throw new Error(`draft ${draftId} not found`);

  // Use the parsed "## 주제" text (same value templateGenerate uses), not the
  // free-text draft title field — the topic is what actually drives search
  // relevance. Falls back to the title only if the draft has no topic section.
  const keyword = templateGenerate(draft.sourceMarkdown).meta.topic || draft.title || "콘텐츠";

  const [existing] = await db
    .select()
    .from(keywordSnapshots)
    .where(eq(keywordSnapshots.draftId, draftId))
    .orderBy(desc(keywordSnapshots.fetchedAt))
    .limit(1);

  // Fresh only if BOTH recent AND for the same keyword — otherwise an edited
  // draft (new topic) would silently keep serving evidence for the old topic
  // for up to 7 days.
  const isFresh =
    existing &&
    existing.keyword === keyword &&
    Date.now() - existing.fetchedAt.getTime() < CACHE_TTL_MS;

  if (!isFresh && process.env.YOUTUBE_API_KEY) {
    try {
      const items = await fetchKeywordEvidence(keyword);
      await db.insert(keywordSnapshots).values({ draftId, keyword, items });
    } catch (err) {
      // Permanent config/permission failures: skip the evidence and let the
      // package generate without it. Transient failures rethrow to be retried.
      if (!isPermanentYoutubeError(err)) throw err;
      // Skipping silently would leave an empty evidence tab with no explanation
      // anywhere — the job is marked completed, so the error never reaches the
      // jobs table. Log it so the cause is recoverable from the runtime logs.
      console.warn(
        `[keyword_snapshot] skipped for draft ${draftId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const [firstSection, ...remaining] = AUTO_IMPROVE_SECTIONS;
  await enqueue("ai_improve_section", {
    draftId,
    sectionKey: firstSection,
    remaining: [...remaining],
  });
}
