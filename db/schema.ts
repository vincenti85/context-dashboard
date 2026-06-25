// db/schema.ts — Drizzle ORM schema for Neon Postgres.
// All content stored as text columns (no Blob/file storage).

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// Draft status enum values: draft | generated | reviewed | ready | archived
export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sourceMarkdown: text("source_markdown").notNull(),
  targetAudience: text("target_audience"),
  coreMessage: text("core_message"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Generation mode: template | ai_improve
// Generation status: running | completed | failed
export const generations = pgTable("generations", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id")
    .notNull()
    .references(() => drafts.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(), // template | ai_improve
  model: text("model"),
  status: text("status").notNull().default("running"), // running | completed | failed
  errorMessage: text("error_message"),
  sectionKey: text("section_key"), // for ai_improve: which section was improved
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// One row per generation. Baseline columns = templateGenerate output.
// ai_overrides = section-keyed JSON map of AI-improved sections (B2).
export const generationOutputs = pgTable("generation_outputs", {
  id: serial("id").primaryKey(),
  generationId: integer("generation_id")
    .notNull()
    .references(() => generations.id, { onDelete: "cascade" }),
  // Template baseline outputs
  contentBrief: text("content_brief"),
  outline: text("outline"),
  uploadPackage: text("upload_package"),
  shorts: text("shorts"),
  threadPost: text("thread_post"),
  instagramCaption: text("instagram_caption"),
  qualityChecklist: text("quality_checklist"),
  // AI overrides: { "section_key": "improved markdown incl. header" }
  aiOverrides: text("ai_overrides"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
export type GenerationOutput = typeof generationOutputs.$inferSelect;
export type NewGenerationOutput = typeof generationOutputs.$inferInsert;
