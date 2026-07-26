import { BoardReport } from "@/lib/reporting/domain/board-report";

function buildBoardPack() {
  const report = new BoardReport({
    id: "board-2026-q2",
    workspaceId: "finance-leadership",
    companyKey: "sample-company",
    period: "2026-Q2",
    createdBy: "controller",
    requiredSections: ["executive-summary", "financial-performance", "outlook"],
  });
  report.addSource({
    id: "q2-actuals",
    name: "Q2 Approved Actuals.xlsx",
    checksum: "q2-approved-8f31a2",
    metrics: [
      {
        key: "revenue",
        label: "Revenue",
        value: "18400000.00",
        unit: "USD",
        locator: "P&L!B12",
      },
      {
        key: "ebitda",
        label: "Adjusted EBITDA",
        value: "3200000.00",
        unit: "USD",
        locator: "P&L!B28",
      },
      {
        key: "ending_cash",
        label: "Ending cash",
        value: "6700000.00",
        unit: "USD",
        locator: "Balance Sheet!B7",
      },
    ],
  });
  report.setSectionBody(
    "executive-summary",
    "Q2 revenue reached {{metric:revenue}} and adjusted EBITDA was {{metric:ebitda}}. Ending liquidity closed at {{metric:ending_cash}}.",
    "fpa-lead",
  );
  return report.renderSection("executive-summary");
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const sectionStatus = [
  { title: "Executive summary", owner: "FP&A Lead", status: "Approved", tone: "text-emerald-400 bg-emerald-400/10" },
  { title: "Financial performance", owner: "Controller", status: "Approved", tone: "text-emerald-400 bg-emerald-400/10" },
  { title: "Outlook & key decisions", owner: "CFO", status: "In review", tone: "text-amber-300 bg-amber-300/10" },
];

export default function ReportsPage() {
  const executiveSummary = buildBoardPack();
  const metrics = [
    { label: "Revenue", value: 18_400_000, change: "+8.4% vs Q1", tone: "text-accent" },
    { label: "Adjusted EBITDA", value: 3_200_000, change: "17.4% margin", tone: "text-emerald-400" },
    { label: "Ending cash", value: 6_700_000, change: "+$0.9M vs Q1", tone: "text-blue-400" },
    { label: "Source coverage", value: 100, change: "3 / 3 metrics cited", tone: "text-violet-400", percent: true },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border-subtle pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Private board reporting
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Disclosure &amp; Board Reporting</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Tie every narrative number to an approved source, route independent review and lock the published board pack.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-md border border-border px-4 py-2 text-sm text-text-muted transition hover:text-text">
            Import source
          </button>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover">
            New board pack
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(metric => (
          <article key={metric.label} className="rounded-lg border border-border-subtle bg-bg-subtle p-5">
            <p className="text-xs uppercase tracking-wide text-text-subtle">{metric.label}</p>
            <p className={`mt-3 text-2xl font-semibold ${metric.tone}`}>
              {metric.percent ? `${metric.value}%` : money.format(metric.value)}
            </p>
            <p className="mt-2 text-xs text-text-muted">{metric.change}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <article className="rounded-lg border border-border-subtle bg-bg-subtle">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <div>
              <h3 className="font-medium">FY26 Q2 Board Pack</h3>
              <p className="mt-1 text-xs text-text-muted">Version 3 · Management confidential</p>
            </div>
            <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-300">1 review remaining</span>
          </div>
          <div className="space-y-5 p-5">
            <div className="rounded-md border border-border bg-bg p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Executive summary</h4>
                <span className="text-xs text-emerald-400">Validated</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-text-muted">{executiveSummary.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {executiveSummary.citations.map(citation => (
                  <span key={citation.metricKey} className="rounded border border-border px-2 py-1 text-[11px] text-text-subtle">
                    {citation.metricKey} · {citation.locator} · {citation.sourceChecksum.slice(-6)}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-4 bg-bg px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-subtle">
                <span>Metric</span><span className="text-right">Q2</span><span className="text-right">Q1</span><span className="text-right">Variance</span>
              </div>
              {[
                ["Revenue", "$18.4M", "$17.0M", "+8.4%"],
                ["Adjusted EBITDA", "$3.2M", "$2.8M", "+14.3%"],
                ["Ending cash", "$6.7M", "$5.8M", "+15.5%"],
              ].map(row => (
                <div key={row[0]} className="grid grid-cols-4 border-t border-border-subtle px-4 py-3 text-sm">
                  <span>{row[0]}</span><span className="text-right">{row[1]}</span><span className="text-right text-text-muted">{row[2]}</span><span className="text-right text-emerald-400">{row[3]}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-lg border border-border-subtle bg-bg-subtle p-5">
            <h3 className="font-medium">Section workflow</h3>
            <div className="mt-4 divide-y divide-border-subtle">
              {sectionStatus.map((section, index) => (
                <div key={section.title} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs text-text-muted">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{section.title}</p>
                    <p className="mt-1 text-xs text-text-subtle">{section.owner}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${section.tone}`}>{section.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-border-subtle bg-bg-subtle p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Source health</h3>
              <span className="text-xs text-emerald-400">Current</span>
            </div>
            <div className="mt-4 rounded-md border border-border bg-bg p-4">
              <p className="text-sm font-medium">Q2 Approved Actuals.xlsx</p>
              <p className="mt-1 text-xs text-text-muted">Effective Jun 30, 2026 · 3 named metrics</p>
              <p className="mt-3 font-mono text-[11px] text-text-subtle">checksum …8f31a2</p>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-text-muted">
              <li>✓ Narrative numeric validation passed</li>
              <li>✓ Metric citation coverage 100%</li>
              <li>✓ No stale source references</li>
              <li>○ CFO approval pending</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
