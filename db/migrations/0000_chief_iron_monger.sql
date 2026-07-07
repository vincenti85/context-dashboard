CREATE TABLE "channel_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_name" text NOT NULL,
	"channel_description" text NOT NULL,
	"default_audience" text NOT NULL,
	"tone_guide" text,
	"proven_patterns" text,
	"recent_topics" jsonb,
	"benchmark_channel_ids" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source_markdown" text NOT NULL,
	"target_audience" text,
	"core_message" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"pipeline_status" text DEFAULT 'idle' NOT NULL,
	"youtube_video_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_outputs" (
	"id" serial PRIMARY KEY NOT NULL,
	"generation_id" integer NOT NULL,
	"content_brief" text,
	"outline" text,
	"upload_package" text,
	"shorts" text,
	"thread_post" text,
	"instagram_caption" text,
	"quality_checklist" text,
	"ai_overrides" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"mode" text NOT NULL,
	"model" text,
	"status" text DEFAULT 'running' NOT NULL,
	"error_message" text,
	"section_key" text,
	"triggered_by" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_after" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "keyword_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"keyword" text NOT NULL,
	"items" jsonb NOT NULL,
	"title_scores" jsonb,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlier_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"items" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"platform" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" date,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"youtube_video_id" text NOT NULL,
	"draft_id" integer,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"impressions" integer,
	"ctr" text,
	"avg_view_duration_sec" integer,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_outputs" ADD CONSTRAINT "generation_outputs_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_snapshots" ADD CONSTRAINT "keyword_snapshots_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_metrics" ADD CONSTRAINT "video_metrics_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "video_metrics_video_day_idx" ON "video_metrics" USING btree ("youtube_video_id","day");