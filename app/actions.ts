// app/actions.ts — Server Actions for draft CRUD + generation.
// All actions use the Drizzle pooler client + revalidatePath.

"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db/client";
import {
  drafts,
  generations,
  generationOutputs,
  type GenerationOutput,
} from "@/db/schema";
import { templateGenerate } from "@/lib/generator";
import { aiImprove } from "@/lib/ai/improve";
import {
  assembleDocument,
  parseAiOverrides,
  serializeAiOverrides,
} from "@/lib/export";

// ─── Draft CRUD ────────────────────────────────────────────────

export async function createDraft(title: string, sourceMarkdown: string) {
  const [draft] = await db
    .insert(drafts)
    .values({ title, sourceMarkdown, status: "draft" })
    .returning();
  revalidatePath("/drafts");
  return draft;
}

export async function updateDraft(
  id: number,
  fields: { title?: string; sourceMarkdown?: string; status?: string },
) {
  await db.update(drafts).set(fields).where(eq(drafts.id, id));
  revalidatePath(`/drafts/${id}`);
  revalidatePath("/drafts");
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
  await db.update(drafts).set({ status }).where(eq(drafts.id, draftId));
  revalidatePath(`/drafts/${draftId}`);
  revalidatePath("/drafts");
}

export async function deleteDraft(id: number) {
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

    // Update draft status and metadata
    await db
      .update(drafts)
      .set({
        status: "generated",
        targetAudience: result.meta.topic, // Will be refined later
        coreMessage: result.meta.topic,
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
  const baselineDoc = outputs.uploadPackage;
  const chunks = baselineDoc.split(/^(?=##\s)/m);
  const sectionChunk = chunks.find((chunk) => {
    const m = chunk.match(/^##\s+(.+?)\s*$/m);
    return m && m[1].trim() === sectionKey;
  });

  if (!sectionChunk) throw new Error(`Section "${sectionKey}" not found in baseline`);

  // Run AI improvement
  const improveResult = await aiImprove(sectionKey, sectionChunk);

  // Create generation record
  const [gen] = await db
    .insert(generations)
    .values({
      draftId,
      mode: "ai_improve",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
