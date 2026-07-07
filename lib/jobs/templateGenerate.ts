// lib/jobs/templateGenerate.ts — Pipeline stage 1: deterministic template generation.
// Chain: enqueue(keyword_snapshot) on success (see design §4).

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts, generations, generationOutputs, channelProfile } from "@/db/schema";
import { templateGenerate, deriveDraftMetadataUpdate } from "@/lib/generator";
import { enqueue } from "@/lib/queue";
import type { JobPayloadMap } from "@/lib/queue/types";

const MAX_RECENT_TOPICS = 20;

export async function handleTemplateGenerate(
  payload: JobPayloadMap["template_generate"],
): Promise<void> {
  const { draftId } = payload;

  const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId));
  if (!draft) throw new Error(`draft ${draftId} not found`);

  const result = templateGenerate(draft.sourceMarkdown);

  const [gen] = await db
    .insert(generations)
    .values({
      draftId,
      mode: "template",
      model: "template",
      status: "completed",
      triggeredBy: "auto",
      completedAt: new Date(),
    })
    .returning();

  await db.insert(generationOutputs).values({
    generationId: gen.id,
    contentBrief: result.brief,
    outline: result.outline,
    uploadPackage: result.uploadPackage,
    aiOverrides: null,
  });

  await db
    .update(drafts)
    .set({
      status: "generated",
      pipelineStatus: "generating",
      ...deriveDraftMetadataUpdate(result.meta),
    })
    .where(eq(drafts.id, draftId));

  // Track the topic so channelContextBlock() can steer future generations
  // away from repeating it (design §6.4: "최근 주제(중복 회피)").
  const [profile] = await db.select().from(channelProfile).limit(1);
  if (profile) {
    const updatedTopics = [result.meta.topic, ...(profile.recentTopics ?? [])]
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, MAX_RECENT_TOPICS);
    await db
      .update(channelProfile)
      .set({ recentTopics: updatedTopics })
      .where(eq(channelProfile.id, profile.id));
  }

  await enqueue("keyword_snapshot", { draftId });
}
