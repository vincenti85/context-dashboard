// tests/ai-improve.test.ts — RED-GREEN regression for review A001 Blocker B-2:
// title/thumbnail overrides MUST include the "## " header (schema contract
// "improved markdown incl. header", db/schema.ts) so that assembleDocument's
// chunk replacement preserves document structure and downstream consumers
// (extractSectionChunk in applyYoutubeMetadata, extractNumberedTitles in
// scoreTitles) keep working on the assembled document.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleDocument, extractSectionChunk } from "@/lib/export";

const generateWithFallbackMock = vi.fn();
const generateObjectWithFallbackMock = vi.fn();

vi.mock("@/lib/ai/provider", () => ({
  generateWithFallback: (...args: unknown[]) => generateWithFallbackMock(...args),
  generateObjectWithFallback: (...args: unknown[]) => generateObjectWithFallbackMock(...args),
  AiUnavailableError: class AiUnavailableError extends Error {},
}));

const BASELINE_DOC = `# 업로드 패키지: 테스트

## 1. 콘텐츠 브리프

브리프 본문

## 2. 유튜브 제목 후보

1. 원본 제목 하나
2. 원본 제목 둘
3. 원본 제목 셋
4. 원본 제목 넷
5. 원본 제목 다섯

## 3. 썸네일 문구 후보

1. 문구 하나
2. 문구 둘
3. 문구 셋
4. 문구 넷
5. 문구 다섯

## 4. 영상 설명란

설명란 본문
`;

describe("aiImprove — title/thumbnail override header contract (A001 B-2)", () => {
  beforeEach(() => {
    generateObjectWithFallbackMock.mockReset();
    generateObjectWithFallbackMock.mockResolvedValue({
      object: { items: ["새 제목 1", "새 제목 2", "새 제목 3", "새 제목 4", "새 제목 5"] },
      modelUsed: "gemini-2.0-flash",
    });
  });

  it("stores the titles override WITH the '## ' header prefix", async () => {
    const { aiImprove } = await import("@/lib/ai/improve");
    const sectionChunk = extractSectionChunk(BASELINE_DOC, "2. 유튜브 제목 후보")!;

    const result = await aiImprove("2. 유튜브 제목 후보", sectionChunk);

    expect(result.success).toBe(true);
    expect(result.improvedMarkdown).toMatch(/^## 2\. 유튜브 제목 후보\n/);
  });

  it("round-trips: assembled document still has the section findable by extractSectionChunk", async () => {
    const { aiImprove } = await import("@/lib/ai/improve");
    const sectionChunk = extractSectionChunk(BASELINE_DOC, "2. 유튜브 제목 후보")!;
    const result = await aiImprove("2. 유튜브 제목 후보", sectionChunk);

    const assembled = assembleDocument(BASELINE_DOC, {
      "2. 유튜브 제목 후보": result.improvedMarkdown!,
    });

    // The section must still exist as a proper ## section after assembly...
    const reExtracted = extractSectionChunk(assembled, "2. 유튜브 제목 후보");
    expect(reExtracted).toBeDefined();
    expect(reExtracted).toContain("새 제목 1");
    // ...and the following section must remain intact (not absorbed).
    const description = extractSectionChunk(assembled, "4. 영상 설명란");
    expect(description).toBeDefined();
    expect(description).toContain("설명란 본문");
  });

  it("does not leak the header text as a numbered title candidate (scoreTitles regression)", async () => {
    const { aiImprove } = await import("@/lib/ai/improve");
    const sectionChunk = extractSectionChunk(BASELINE_DOC, "2. 유튜브 제목 후보")!;
    const result = await aiImprove("2. 유튜브 제목 후보", sectionChunk);

    // Same extraction logic as lib/jobs/scoreTitles.ts#extractNumberedTitles
    const titles: string[] = [];
    for (const line of result.improvedMarkdown!.split(/\r?\n/)) {
      const m = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
      if (m) titles.push(m[1].trim());
    }
    expect(titles).toHaveLength(5);
    expect(titles).not.toContain("유튜브 제목 후보");
  });
});

describe("aiImprove — free-text path structural validation still enforced", () => {
  beforeEach(() => {
    generateWithFallbackMock.mockReset();
  });

  it("rejects a response whose headers differ (structure_violation)", async () => {
    generateWithFallbackMock.mockResolvedValue({
      text: "## 완전히 다른 헤더\n\n내용",
      modelUsed: "gemini-2.0-flash",
    });
    const { aiImprove } = await import("@/lib/ai/improve");
    const sectionChunk = extractSectionChunk(BASELINE_DOC, "4. 영상 설명란")!;

    const result = await aiImprove("4. 영상 설명란", sectionChunk);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^structure_violation/);
  });

  it("accepts a response with identical headers", async () => {
    generateWithFallbackMock.mockResolvedValue({
      text: "## 4. 영상 설명란\n\n개선된 설명란 본문",
      modelUsed: "gemini-2.0-flash",
    });
    const { aiImprove } = await import("@/lib/ai/improve");
    const sectionChunk = extractSectionChunk(BASELINE_DOC, "4. 영상 설명란")!;

    const result = await aiImprove("4. 영상 설명란", sectionChunk);

    expect(result.success).toBe(true);
    expect(result.improvedMarkdown).toContain("개선된 설명란 본문");
  });
});
