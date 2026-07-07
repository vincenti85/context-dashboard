// lib/jobs/aiImproveSection.ts — Pipeline stage 3: per-section AI improvement.
// Chain: enqueue(next ai_improve_section) if sections remain, else enqueue(score_titles).
//
// Failure policy (design §6.3):
//  - structure_violation -> skip this section only, do NOT rethrow (baseline
//    preserved, chain proceeds to the next section — no retry).
//  - api_error / ai_unavailable -> rethrow so the worker's failJob() retries
//    this exact job with backoff (see lib/queue/index.ts).

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { generations, generationOutputs, channelProfile } from "@/db/schema";
import { aiImprove } from "@/lib/ai/improve";
import { channelContextBlock } from "@/lib/ai/prompts";
import { parseAiOverrides, serializeAiOverrides, extractSectionChunk } from "@/lib/export";
import { enqueue } from "@/lib/queue";
import type { JobPayloadMap } from "@/lib/queue/types";

export async function handleAiImproveSection(
  payload: JobPayloadMap["ai_improve_section"],
): Promise<void> {
  const { draftId, sectionKey, remaining } = payload;

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
  if (!outputs?.uploadPackage) throw new Error(`no baseline output for draft ${draftId}`);

  const sectionChunk = extractSectionChunk(outputs.uploadPackage, sectionKey);

  if (sectionChunk) {
    const [profile] = await db.select().from(channelProfile).limit(1);
    const context = channelContextBlock(profile ?? null);

    const result = await aiImprove(sectionKey, sectionChunk, context);

    await db.insert(generations).values({
      draftId,
      mode: "ai_improve",
      model: result.modelUsed ?? "unknown",
      status: result.success ? "completed" : "failed",
      errorMessage: result.error,
      sectionKey,
      triggeredBy: "auto",
      completedAt: new Date(),
    });

    if (result.success) {
      const existingOverrides = parseAiOverrides(outputs.aiOverrides);
      const updatedOverrides = {
        ...(existingOverrides || {}),
        [sectionKey]: result.improvedMarkdown!,
      };
      await db
        .update(generationOutputs)
        .set({ aiOverrides: serializeAiOverrides(updatedOverrides) })
        .where(eq(generationOutputs.id, outputs.id));
    } else if (!result.error?.startsWith("structure_violation")) {
      // api_error / ai_unavailable — retryable. Rethrow so failJob() backs off
      // and re-attempts this exact section later instead of silently moving on.
      throw new Error(result.error ?? "ai_improve failed");
    }
    // else: structure_violation — fall through, baseline preserved, proceed.
  }

  if (remaining.length > 0) {
    const [next, ...rest] = remaining;
    await enqueue("ai_improve_section", { draftId, sectionKey: next, remaining: rest });
  } else {
    await enqueue("score_titles", { draftId });
  }
}
