export type ReportMetric = {
  key: string;
  label: string;
  value: string;
  unit: "USD" | "count" | "percent";
  locator: string;
};

export type SourceSnapshot = {
  id: string;
  name: string;
  checksum: string;
  metrics: ReportMetric[];
};

type ReportSection = {
  key: string;
  body: string;
  ownerId?: string;
  status: "draft" | "review" | "approved";
  approvedBy?: string;
};

type MetricRecord = ReportMetric & {
  sourceId: string;
  sourceChecksum: string;
};

const METRIC_TOKEN = /\{\{metric:([a-zA-Z0-9_.-]+)\}\}/g;
const DISPLAYED_NUMBER = /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?(?:[KMB])?|\b\d+(?:\.\d+)?%)/g;

function formatMetric(metric: ReportMetric): string {
  const value = Number(metric.value);
  if (!Number.isFinite(value)) throw new Error(`Invalid metric value: ${metric.key}`);
  if (metric.unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  }
  if (metric.unit === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US").format(value);
}

export class BoardReport {
  readonly id: string;
  readonly workspaceId: string;
  readonly companyKey: string;
  readonly period: string;
  readonly createdBy: string;
  private status: "draft" | "published" = "draft";
  private readonly sources = new Map<string, SourceSnapshot>();
  private readonly metrics = new Map<string, MetricRecord>();
  private readonly sections = new Map<string, ReportSection>();
  private readonly staleMetrics = new Set<string>();
  private readonly auditEvents: Array<{
    action: string;
    actorId: string;
    sectionKey?: string;
  }> = [];

  constructor(input: {
    id: string;
    workspaceId: string;
    companyKey: string;
    period: string;
    createdBy: string;
    requiredSections: string[];
  }) {
    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.companyKey = input.companyKey;
    this.period = input.period;
    this.createdBy = input.createdBy;
    for (const key of input.requiredSections) {
      this.sections.set(key, { key, body: "", status: "draft" });
    }
  }

  addSource(source: SourceSnapshot): void {
    this.ensureDraft();
    for (const metric of source.metrics) {
      if (this.metrics.has(metric.key)) {
        throw new Error(`Duplicate metric key: ${metric.key}`);
      }
      formatMetric(metric);
      this.metrics.set(metric.key, {
        ...metric,
        sourceId: source.id,
        sourceChecksum: source.checksum,
      });
    }
    this.sources.set(source.id, {
      ...source,
      metrics: source.metrics.map(metric => ({ ...metric })),
    });
  }

  refreshSource(source: SourceSnapshot): void {
    this.ensureDraft();
    const current = this.sources.get(source.id);
    if (!current) throw new Error(`Source snapshot not found: ${source.id}`);
    if (current.checksum === source.checksum) return;

    const priorMetricKeys = [...this.metrics.values()]
      .filter(metric => metric.sourceId === source.id)
      .map(metric => metric.key);
    for (const metricKey of priorMetricKeys) {
      this.metrics.delete(metricKey);
      if ([...this.sections.values()].some(section =>
        section.body.includes(`{{metric:${metricKey}}}`),
      )) {
        this.staleMetrics.add(metricKey);
      }
    }
    for (const metric of source.metrics) {
      formatMetric(metric);
      this.metrics.set(metric.key, {
        ...metric,
        sourceId: source.id,
        sourceChecksum: source.checksum,
      });
    }
    this.sources.set(source.id, {
      ...source,
      metrics: source.metrics.map(metric => ({ ...metric })),
    });
  }

  acknowledgeMetricRefresh(metricKey: string, actorId: string): void {
    this.ensureDraft();
    if (!this.metrics.has(metricKey)) throw new Error(`Metric not found: ${metricKey}`);
    this.staleMetrics.delete(metricKey);
    this.auditEvents.push({ action: `metric.refresh_acknowledged:${metricKey}`, actorId });
  }

  setSectionBody(sectionKey: string, body: string, ownerId: string): void {
    this.ensureDraft();
    const section = this.requireSection(sectionKey);
    section.body = body;
    section.ownerId = ownerId;
    section.status = "draft";
    section.approvedBy = undefined;
  }

  renderSection(sectionKey: string): {
    body: string;
    citations: Array<{
      metricKey: string;
      sourceId: string;
      sourceChecksum: string;
      locator: string;
    }>;
  } {
    const section = this.requireSection(sectionKey);
    const citations = new Map<string, {
      metricKey: string;
      sourceId: string;
      sourceChecksum: string;
      locator: string;
    }>();
    const body = section.body.replace(METRIC_TOKEN, (_token, metricKey: string) => {
      const metric = this.metrics.get(metricKey);
      if (!metric) throw new Error(`Metric not found: ${metricKey}`);
      citations.set(metric.key, {
        metricKey: metric.key,
        sourceId: metric.sourceId,
        sourceChecksum: metric.sourceChecksum,
        locator: metric.locator,
      });
      return formatMetric(metric);
    });
    return { body, citations: [...citations.values()] };
  }

  validateSection(sectionKey: string): { valid: boolean; errors: string[] } {
    const section = this.requireSection(sectionKey);
    const errors: string[] = [];
    for (const metricKey of this.staleMetrics) {
      if (section.body.includes(`{{metric:${metricKey}}}`)) {
        errors.push(`Stale metric reference: ${metricKey}`);
      }
    }
    const withoutTokens = section.body.replace(METRIC_TOKEN, "");
    for (const match of withoutTokens.match(DISPLAYED_NUMBER) ?? []) {
      errors.push(`Unsupported numeric value: ${match}`);
    }
    try {
      this.renderSection(sectionKey);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Metric rendering failed");
    }
    return { valid: errors.length === 0, errors };
  }

  requestReview(sectionKey: string, actorId: string): void {
    this.ensureDraft();
    const section = this.requireSection(sectionKey);
    if (section.ownerId !== actorId) throw new Error("Only the section owner can request review");
    const validation = this.validateSection(sectionKey);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    section.status = "review";
    this.auditEvents.push({ action: "section.review_requested", actorId, sectionKey });
  }

  approveSection(sectionKey: string, actorId: string): void {
    this.ensureDraft();
    const section = this.requireSection(sectionKey);
    if (section.ownerId === actorId) {
      throw new Error("Section owner cannot approve their own section");
    }
    if (section.status !== "review") throw new Error("Section is not ready for approval");
    section.status = "approved";
    section.approvedBy = actorId;
    this.auditEvents.push({ action: "section.approved", actorId, sectionKey });
  }

  publish(actorId: string): {
    checksum: string;
    manifest: {
      reportId: string;
      workspaceId: string;
      period: string;
      sourceChecksums: string[];
      metricCoverage: number;
    };
  } {
    this.ensureDraft();
    const unapproved = [...this.sections.values()]
      .filter(section => section.status !== "approved")
      .map(section => section.key);
    if (unapproved.length > 0) {
      throw new Error(`Unapproved sections: ${unapproved.join(", ")}`);
    }
    const renderedSections = [...this.sections.values()].map(section =>
      this.renderSection(section.key),
    );
    const citedMetrics = new Set(
      renderedSections.flatMap(section => section.citations.map(citation => citation.metricKey)),
    );
    const sourceChecksums = [...new Set(
      renderedSections.flatMap(section =>
        section.citations.map(citation => citation.sourceChecksum),
      ),
    )].sort();
    const manifest = {
      reportId: this.id,
      workspaceId: this.workspaceId,
      period: this.period,
      sourceChecksums,
      metricCoverage: citedMetrics.size,
    };
    const checksum = simpleChecksum(JSON.stringify({
      manifest,
      sections: renderedSections.map(section => section.body),
    }));
    this.status = "published";
    this.auditEvents.push({ action: "report.published", actorId });
    return { checksum, manifest };
  }

  private requireSection(sectionKey: string): ReportSection {
    const section = this.sections.get(sectionKey);
    if (!section) throw new Error(`Report section not found: ${sectionKey}`);
    return section;
  }

  private ensureDraft(): void {
    if (this.status === "published") throw new Error("Published reports are immutable");
  }
}

function simpleChecksum(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
