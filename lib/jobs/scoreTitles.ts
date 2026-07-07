// lib/jobs/scoreTitles.ts — Pipeline stage 4: evidence-based title scoring (M6).
// Best-effort: AI/zod failure does not fail the job — scoring is a value-add,
// not a blocking requirement, and the pipeline must still reach stage_posts/notify.
// Chain: enqueue(stage_posts) unconditionally.

import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { generations, generationOutputs, keywordSnapshots, channelProfile } from "@/db/schema";
import { generateObjectWithFallback } from "@/lib/ai/provider";
import { scoreTitlesPrompt, channelContextBlock } from "@/lib/ai/prompts";
import { parseAiOverrides, extractSectionChunk } from "@/lib/export";
import { enqueue } from "@/lib/queue";
import type { JobPayloadMap } from "@/lib/queue/types";

const TITLES_HEADER = "2. 유튜브 제목 후보";

const ScoreSchema = z.object({
  scores: z.array(
    z.object({
      title: z.string(),
      rank: z.number(),
      comment: z.string(),
    }),
  ),
});

/** Extract "1. Title text" numbered-list entries from a section's markdown body. */
function extractNumberedTitles(markdown: string): string[] {
  const titles: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
    if (m) titles.push(m[1].trim());
  }
  return titles;
}

export async function handleScoreTitles(payload: JobPayloadMap["score_titles"]): Promise<void> {
  const { draftId } = payload;

  const [latestGen] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.draftId, draftId), eq(generations.mode, "template")))
    .orderBy(desc(generations.createdAt))
    .limit(1);
  if (!latestGen) throw new Error(`no template generation found for draft ${draftId}`);

  const [outputs] = await db
    .select()
    .from(generationOutputs)
    .where(eq(generationOutputs.generationId, latestGen.id));

  if (outputs?.uploadPackage) {
    const overrides = parseAiOverrides(outputs.aiOverrides);
    const titlesSection =
      overrides?.[TITLES_HEADER] ?? extractSectionChunk(outputs.uploadPackage, TITLES_HEADER);
    const titles = titlesSection ? extractNumberedTitles(titlesSection) : [];

    if (titles.length > 0) {
      const [snapshot] = await db
        .select()
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.draftId, draftId))
        .orderBy(desc(keywordSnapshots.fetchedAt))
        .limit(1);

      try {
        const [profile] = await db.select().from(channelProfile).limit(1);
        const context = channelContextBlock(profile ?? null);
        const { system, prompt } = scoreTitlesPrompt(titles, snapshot?.items ?? [], context);

        const { object } = await generateObjectWithFallback({ system, prompt, schema: ScoreSchema });

        if (snapshot) {
          await db
            .update(keywordSnapshots)
            .set({ titleScores: object.scores })
            .where(eq(keywordSnapshots.id, snapshot.id));
        }
      } catch {
        // Best-effort: AI unavailable or malformed structured output — skip scoring,
        // the pipeline still proceeds (design WP5-V3: "1회 재시도 후 스킵"; the provider
        // chain in generateObjectWithFallback already retries across Gemini/Groq, so a
        // second full retry here would just double the wait for a low-value feature).
      }
    }
  }

  await enqueue("stage_posts", { draftId });
}
