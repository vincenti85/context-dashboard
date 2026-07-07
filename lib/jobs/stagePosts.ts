// lib/jobs/stagePosts.ts — Pipeline stage 5: SNS post staging (M7).
// Idempotency (design §6.3): re-running for the same draft replaces only the
// "draft"-status row per platform; "approved"/"published" rows are preserved.
// Chain: enqueue(notify, kind: package_ready) unconditionally.

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { generations, generationOutputs, scheduledPosts } from "@/db/schema";
import { parseAiOverrides, extractSectionChunk, stripHeaderLine } from "@/lib/export";
import { enqueue } from "@/lib/queue";
import type { JobPayloadMap } from "@/lib/queue/types";

const SECTION_TO_PLATFORM: Record<string, string> = {
  "9. 쇼츠 재가공 스크립트": "shorts_script",
  "10. 쓰레드/X 게시글": "x_thread",
  "11. 인스타 캡션": "instagram",
};

export async function handleStagePosts(payload: JobPayloadMap["stage_posts"]): Promise<void> {
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

    for (const [header, platform] of Object.entries(SECTION_TO_PLATFORM)) {
      const body = overrides?.[header] ?? extractSectionChunk(outputs.uploadPackage, header);
      if (!body) continue;

      await db
        .delete(scheduledPosts)
        .where(
          and(
            eq(scheduledPosts.draftId, draftId),
            eq(scheduledPosts.platform, platform),
            eq(scheduledPosts.status, "draft"),
          ),
        );

      await db.insert(scheduledPosts).values({
        draftId,
        platform,
        body: stripHeaderLine(body),
        status: "draft",
      });
    }
  }

  await enqueue("notify", { draftId, kind: "package_ready" });
}
