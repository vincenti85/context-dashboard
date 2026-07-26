CREATE TABLE "report_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"report_version_id" integer,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_section_id" integer NOT NULL,
	"anchor" text,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_version_id" integer NOT NULL,
	"format" text NOT NULL,
	"object_uri" text,
	"checksum" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_metric_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_section_id" integer NOT NULL,
	"metric_id" integer NOT NULL,
	"token" text NOT NULL,
	"display_format" text NOT NULL,
	"source_checksum" text NOT NULL,
	"status" text DEFAULT 'current' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_snapshot_id" integer NOT NULL,
	"metric_key" text NOT NULL,
	"label" text NOT NULL,
	"period" text NOT NULL,
	"amount_decimal" text NOT NULL,
	"unit" text NOT NULL,
	"source_locator" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_version_id" integer NOT NULL,
	"section_key" text NOT NULL,
	"title" text NOT NULL,
	"body_markdown" text DEFAULT '' NOT NULL,
	"owner_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"section_schema" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"parent_version_id" integer,
	"version_no" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"company_key" text NOT NULL,
	"period" text NOT NULL,
	"template_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_version_id" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source_type" text NOT NULL,
	"name" text NOT NULL,
	"effective_at" timestamp NOT NULL,
	"object_uri" text,
	"checksum" text NOT NULL,
	"source_schema" jsonb,
	"imported_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_audit_events" ADD CONSTRAINT "report_audit_events_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_audit_events" ADD CONSTRAINT "report_audit_events_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_report_section_id_report_sections_id_fk" FOREIGN KEY ("report_section_id") REFERENCES "public"."report_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_metric_links" ADD CONSTRAINT "report_metric_links_report_section_id_report_sections_id_fk" FOREIGN KEY ("report_section_id") REFERENCES "public"."report_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_metric_links" ADD CONSTRAINT "report_metric_links_metric_id_report_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."report_metrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_metrics" ADD CONSTRAINT "report_metrics_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_sections" ADD CONSTRAINT "report_sections_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_metric_links_section_token_idx" ON "report_metric_links" USING btree ("report_section_id","token");--> statement-breakpoint
CREATE UNIQUE INDEX "report_metrics_snapshot_key_period_idx" ON "report_metrics" USING btree ("source_snapshot_id","metric_key","period");--> statement-breakpoint
CREATE UNIQUE INDEX "report_sections_version_key_idx" ON "report_sections" USING btree ("report_version_id","section_key");--> statement-breakpoint
CREATE UNIQUE INDEX "report_templates_workspace_name_version_idx" ON "report_templates" USING btree ("workspace_id","name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "report_versions_report_version_idx" ON "report_versions" USING btree ("report_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_workspace_company_period_idx" ON "reports" USING btree ("workspace_id","company_key","period");--> statement-breakpoint
CREATE UNIQUE INDEX "source_snapshots_workspace_checksum_idx" ON "source_snapshots" USING btree ("workspace_id","checksum");