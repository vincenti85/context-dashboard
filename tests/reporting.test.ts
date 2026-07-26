import { describe, expect, it } from "vitest";
import { BoardReport } from "@/lib/reporting/domain/board-report";

describe("BoardReport", () => {
  it("renders repeated metric tokens from one source and rejects unsupported numbers", () => {
    const report = new BoardReport({
      id: "report-1",
      workspaceId: "workspace-1",
      companyKey: "company-1",
      period: "2026-Q2",
      createdBy: "controller-1",
      requiredSections: ["financial-performance"],
    });
    report.addSource({
      id: "source-1",
      name: "Q2 approved actuals",
      checksum: "actuals-v1",
      metrics: [
        {
          key: "revenue",
          label: "Revenue",
          value: "1200000.00",
          unit: "USD",
          locator: "Actuals!B12",
        },
      ],
    });
    report.setSectionBody(
      "financial-performance",
      "Revenue was {{metric:revenue}}. The reported revenue of {{metric:revenue}} reflects current operations.",
      "fpa-1",
    );

    const rendered = report.renderSection("financial-performance");
    expect(rendered.body.match(/\$1,200,000\.00/g)).toHaveLength(2);
    expect(rendered.citations).toEqual([
      {
        metricKey: "revenue",
        sourceId: "source-1",
        sourceChecksum: "actuals-v1",
        locator: "Actuals!B12",
      },
    ]);

    report.setSectionBody(
      "financial-performance",
      "Revenue was {{metric:revenue}}, with an unsupported outlook of $1.5M.",
      "fpa-1",
    );
    expect(report.validateSection("financial-performance").errors).toContain(
      "Unsupported numeric value: $1.5M",
    );
  });

  it("requires independent section approval before publishing an immutable version", () => {
    const report = new BoardReport({
      id: "report-1",
      workspaceId: "workspace-1",
      companyKey: "company-1",
      period: "2026-Q2",
      createdBy: "controller-1",
      requiredSections: ["financial-performance"],
    });
    report.addSource({
      id: "source-1",
      name: "Q2 approved actuals",
      checksum: "actuals-v1",
      metrics: [
        {
          key: "revenue",
          label: "Revenue",
          value: "1200000.00",
          unit: "USD",
          locator: "Actuals!B12",
        },
      ],
    });
    report.setSectionBody(
      "financial-performance",
      "Revenue was {{metric:revenue}}.",
      "fpa-1",
    );

    expect(() => report.publish("controller-1")).toThrow(
      "Unapproved sections: financial-performance",
    );
    report.requestReview("financial-performance", "fpa-1");
    expect(() =>
      report.approveSection("financial-performance", "fpa-1"),
    ).toThrow("Section owner cannot approve their own section");
    report.approveSection("financial-performance", "controller-1");

    const publication = report.publish("controller-1");
    expect(publication.manifest.metricCoverage).toBe(1);
    expect(publication.checksum).toMatch(/^[a-f0-9]{8}$/);
    expect(() =>
      report.setSectionBody("financial-performance", "Changed", "fpa-1"),
    ).toThrow("Published reports are immutable");
  });

  it("marks linked metrics stale when an approved source snapshot changes", () => {
    const report = new BoardReport({
      id: "report-1",
      workspaceId: "workspace-1",
      companyKey: "company-1",
      period: "2026-Q2",
      createdBy: "controller-1",
      requiredSections: ["financial-performance"],
    });
    report.addSource({
      id: "source-1",
      name: "Q2 approved actuals",
      checksum: "actuals-v1",
      metrics: [
        {
          key: "revenue",
          label: "Revenue",
          value: "1000.00",
          unit: "USD",
          locator: "Actuals!B12",
        },
      ],
    });
    report.setSectionBody(
      "financial-performance",
      "Revenue was {{metric:revenue}}.",
      "fpa-1",
    );

    report.refreshSource({
      id: "source-1",
      name: "Q2 approved actuals",
      checksum: "actuals-v2",
      metrics: [
        {
          key: "revenue",
          label: "Revenue",
          value: "1100.00",
          unit: "USD",
          locator: "Actuals!B12",
        },
      ],
    });

    expect(report.validateSection("financial-performance").errors).toContain(
      "Stale metric reference: revenue",
    );
    report.acknowledgeMetricRefresh("revenue", "fpa-1");
    expect(report.renderSection("financial-performance").body).toContain(
      "$1,100.00",
    );
  });
});
