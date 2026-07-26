// db/schema.ts — Drizzle ORM schema for Neon Postgres.
// All content stored as text columns (no Blob/file storage).

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Draft status enum values: draft | generated | reviewed | ready | archived
// pipelineStatus enum values: idle | queued | generating | completed | failed
export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sourceMarkdown: text("source_markdown").notNull(),
  targetAudience: text("target_audience"),
  coreMessage: text("core_message"),
  status: text("status").notNull().default("draft"),
  pipelineStatus: text("pipeline_status").notNull().default("idle"),
  youtubeVideoId: text("youtube_video_id"), // set once the package is published (WP9)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Generation mode: template | ai_improve
// Generation status: running | completed | failed
// triggeredBy: manual | auto (auto = created by the WP3 pipeline worker)
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
  triggeredBy: text("triggered_by").notNull().default("manual"), // manual | auto
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

// ─── Job queue (WP3) ──────────────────────────────────────────
// status: queued | running | completed | failed | dead
//   failed = will retry (run_after is the backoff time), dead = maxAttempts exhausted.
// payload shape is validated per jobType against JobPayloadMap (lib/queue/types.ts),
// not enforced at the DB layer (jsonb is intentionally untyped here).
export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    jobType: text("job_type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: timestamp("run_after").notNull().defaultNow(),
    lockedAt: timestamp("locked_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("jobs_claim_idx").on(t.status, t.runAfter)],
);

// ─── Channel profile (single row; M8) ─────────────────────────
export const channelProfile = pgTable("channel_profile", {
  id: serial("id").primaryKey(),
  channelName: text("channel_name").notNull(),
  channelDescription: text("channel_description").notNull(),
  defaultAudience: text("default_audience").notNull(),
  toneGuide: text("tone_guide"),
  provenPatterns: text("proven_patterns"), // S3: performance-verified title/hook patterns (auto-updated)
  recentTopics: jsonb("recent_topics").$type<string[]>(),
  benchmarkChannelIds: jsonb("benchmark_channel_ids").$type<string[]>(), // S4
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── Keyword snapshots (M6; cached per draft, 7-day TTL) ──────
export interface KeywordItem {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  publishedAt: string;
  subscriberBand?: string;
}

export interface TitleScore {
  title: string;
  rank: number;
  comment: string;
}

export const keywordSnapshots = pgTable("keyword_snapshots", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id")
    .notNull()
    .references(() => drafts.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  items: jsonb("items").notNull().$type<KeywordItem[]>(),
  // Populated by the score_titles job once evidence + current titles are both available.
  titleScores: jsonb("title_scores").$type<TitleScore[]>(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

// ─── Benchmark channel outlier snapshots (S4, daily) ──────────
export interface OutlierVideoItem {
  videoId: string;
  title: string;
  viewCount: number;
  publishedAt: string;
}

export const outlierSnapshots = pgTable("outlier_snapshots", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  items: jsonb("items").notNull().$type<OutlierVideoItem[]>(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

// ─── SNS post staging (M7) ─────────────────────────────────────
// platform: youtube_community | x_thread | instagram | shorts_script
// status: draft | approved | published | discarded
export const scheduledPosts = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id")
    .notNull()
    .references(() => drafts.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  scheduledFor: date("scheduled_for"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Video performance metrics (S2) ────────────────────────────
// (video, day) is unique so a retried metrics_pull upserts instead of
// duplicating rows — duplicates would inflate SUM(views) in the feedback
// loop (updateProvenPatterns / getNextContentIdeas). A001 M-4.
export const videoMetrics = pgTable(
  "video_metrics",
  {
    id: serial("id").primaryKey(),
    youtubeVideoId: text("youtube_video_id").notNull(),
    draftId: integer("draft_id").references(() => drafts.id, { onDelete: "set null" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
    impressions: integer("impressions"),
    ctr: text("ctr"), // numeric-as-text to preserve decimal precision
    avgViewDurationSec: integer("avg_view_duration_sec"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("video_metrics_video_day_idx").on(t.youtubeVideoId, t.day)],
);

// Financial reporting is intentionally isolated from drafts/generations. It
// shares infrastructure (Neon, jobs) but has its own version and audit chain.
export const reportTemplates = pgTable(
  "report_templates",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    sectionSchema: jsonb("section_schema").notNull().$type<Record<string, unknown>>(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("report_templates_workspace_name_version_idx").on(
    t.workspaceId,
    t.name,
    t.version,
  )],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    companyKey: text("company_key").notNull(),
    period: text("period").notNull(),
    templateId: integer("template_id")
      .notNull()
      .references(() => reportTemplates.id),
    status: text("status").notNull().default("draft"),
    currentVersionId: integer("current_version_id"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    publishedAt: timestamp("published_at"),
  },
  (t) => [uniqueIndex("reports_workspace_company_period_idx").on(
    t.workspaceId,
    t.companyKey,
    t.period,
  )],
);

export const reportVersions = pgTable(
  "report_versions",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    parentVersionId: integer("parent_version_id"),
    versionNo: integer("version_no").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lockedAt: timestamp("locked_at"),
  },
  (t) => [uniqueIndex("report_versions_report_version_idx").on(t.reportId, t.versionNo)],
);

export const reportSections = pgTable(
  "report_sections",
  {
    id: serial("id").primaryKey(),
    reportVersionId: integer("report_version_id")
      .notNull()
      .references(() => reportVersions.id, { onDelete: "cascade" }),
    sectionKey: text("section_key").notNull(),
    title: text("title").notNull(),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    ownerId: text("owner_id"),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at"),
  },
  (t) => [uniqueIndex("report_sections_version_key_idx").on(t.reportVersionId, t.sectionKey)],
);

export const sourceSnapshots = pgTable(
  "source_snapshots",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    sourceType: text("source_type").notNull(),
    name: text("name").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    objectUri: text("object_uri"),
    checksum: text("checksum").notNull(),
    sourceSchema: jsonb("source_schema").$type<Record<string, unknown>>(),
    importedBy: text("imported_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("source_snapshots_workspace_checksum_idx").on(
    t.workspaceId,
    t.checksum,
  )],
);

export const reportMetrics = pgTable(
  "report_metrics",
  {
    id: serial("id").primaryKey(),
    sourceSnapshotId: integer("source_snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "cascade" }),
    metricKey: text("metric_key").notNull(),
    label: text("label").notNull(),
    period: text("period").notNull(),
    amountDecimal: text("amount_decimal").notNull(),
    unit: text("unit").notNull(),
    sourceLocator: jsonb("source_locator").notNull().$type<Record<string, unknown>>(),
  },
  (t) => [uniqueIndex("report_metrics_snapshot_key_period_idx").on(
    t.sourceSnapshotId,
    t.metricKey,
    t.period,
  )],
);

export const reportMetricLinks = pgTable(
  "report_metric_links",
  {
    id: serial("id").primaryKey(),
    reportSectionId: integer("report_section_id")
      .notNull()
      .references(() => reportSections.id, { onDelete: "cascade" }),
    metricId: integer("metric_id")
      .notNull()
      .references(() => reportMetrics.id),
    token: text("token").notNull(),
    displayFormat: text("display_format").notNull(),
    sourceChecksum: text("source_checksum").notNull(),
    status: text("status").notNull().default("current"),
  },
  (t) => [uniqueIndex("report_metric_links_section_token_idx").on(
    t.reportSectionId,
    t.token,
  )],
);

export const reportComments = pgTable("report_comments", {
  id: serial("id").primaryKey(),
  reportSectionId: integer("report_section_id")
    .notNull()
    .references(() => reportSections.id, { onDelete: "cascade" }),
  anchor: text("anchor"),
  body: text("body").notNull(),
  authorId: text("author_id").notNull(),
  status: text("status").notNull().default("open"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportExports = pgTable("report_exports", {
  id: serial("id").primaryKey(),
  reportVersionId: integer("report_version_id")
    .notNull()
    .references(() => reportVersions.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  objectUri: text("object_uri"),
  checksum: text("checksum").notNull(),
  manifest: jsonb("manifest").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportAuditEvents = pgTable("report_audit_events", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  reportVersionId: integer("report_version_id").references(() => reportVersions.id),
  action: text("action").notNull(),
  actorId: text("actor_id").notNull(),
  detail: jsonb("detail").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
export type GenerationOutput = typeof generationOutputs.$inferSelect;
export type NewGenerationOutput = typeof generationOutputs.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type ChannelProfile = typeof channelProfile.$inferSelect;
export type NewChannelProfile = typeof channelProfile.$inferInsert;
export type KeywordSnapshot = typeof keywordSnapshots.$inferSelect;
export type NewKeywordSnapshot = typeof keywordSnapshots.$inferInsert;
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type NewScheduledPost = typeof scheduledPosts.$inferInsert;
export type VideoMetric = typeof videoMetrics.$inferSelect;
export type NewVideoMetric = typeof videoMetrics.$inferInsert;
export type OutlierSnapshot = typeof outlierSnapshots.$inferSelect;
export type NewOutlierSnapshot = typeof outlierSnapshots.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ReportVersion = typeof reportVersions.$inferSelect;
export type NewReportVersion = typeof reportVersions.$inferInsert;
export type ReportSection = typeof reportSections.$inferSelect;
export type NewReportSection = typeof reportSections.$inferInsert;
export type SourceSnapshot = typeof sourceSnapshots.$inferSelect;
export type NewSourceSnapshot = typeof sourceSnapshots.$inferInsert;
export type ReportMetric = typeof reportMetrics.$inferSelect;
export type NewReportMetric = typeof reportMetrics.$inferInsert;
