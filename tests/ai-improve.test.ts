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
      modelUsed: "gemini-3.5-flash",
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
      modelUsed: "gemini-3.5-flash",
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
      modelUsed: "gemini-3.5-flash",
    });
    const { aiImprove } = await import("@/lib/ai/improve");
    const sectionChunk = extractSectionChunk(BASELINE_DOC, "4. 영상 설명란")!;

    const result = await aiImprove("4. 영상 설명란", sectionChunk);

    expect(result.success).toBe(true);
    expect(result.improvedMarkdown).toContain("개선된 설명란 본문");
  });
});

describe("aiImprove — long-section robustness (script section failure, 2026-07-22 prod run)", () => {
  const SCRIPT_SECTION = `## 6. 촬영용 대본

### Hook

훅 본문

### 오프닝

오프닝 본문

### 문제 제기

문제 제기 본문

### 핵심 개념

핵심 개념 본문

### 실습 또는 예시

실습 본문

### 정리/CTA

정리 본문
`;

  beforeEach(() => {
    generateWithFallbackMock.mockReset();
  });

  it("reports an empty model response distinctly, not as a bogus header mismatch", async () => {
    // A thinking model that spends its whole output budget on reasoning returns
    // empty text. Calling that "header count mismatch: 0" hides the real cause.
    generateWithFallbackMock.mockResolvedValue({ text: "   \n  ", modelUsed: "gemini-3.5-flash" });
    const { aiImprove } = await import("@/lib/ai/improve");

    const result = await aiImprove("6. 촬영용 대본", SCRIPT_SECTION);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^empty_response/);
  });

  it("retries once with corrective feedback when the first response drops the headers", async () => {
    generateWithFallbackMock
      .mockResolvedValueOnce({ text: "헤더 없이 산문으로만 쓴 응답", modelUsed: "gemini-3.5-flash" })
      .mockResolvedValueOnce({ text: SCRIPT_SECTION, modelUsed: "gemini-3.5-flash" });
    const { aiImprove } = await import("@/lib/ai/improve");

    const result = await aiImprove("6. 촬영용 대본", SCRIPT_SECTION);

    expect(generateWithFallbackMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it("gives up after the corrective retry also fails (no infinite retry)", async () => {
    generateWithFallbackMock.mockResolvedValue({ text: "여전히 헤더 없음", modelUsed: "gemini-3.5-flash" });
    const { aiImprove } = await import("@/lib/ai/improve");

    const result = await aiImprove("6. 촬영용 대본", SCRIPT_SECTION);

    expect(generateWithFallbackMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^structure_violation/);
  });

  it("requests enough output budget for a long section to survive thinking-token overhead", async () => {
    generateWithFallbackMock.mockResolvedValue({ text: SCRIPT_SECTION, modelUsed: "gemini-3.5-flash" });
    const { aiImprove } = await import("@/lib/ai/improve");

    await aiImprove("6. 촬영용 대본", SCRIPT_SECTION);

    const callArgs = generateWithFallbackMock.mock.calls[0][0];
    expect(callArgs.maxOutputTokens).toBeGreaterThanOrEqual(8000);
  });
});

describe("improveSectionPrompt — explicit header contract", () => {
  it("enumerates the exact headers the response must reproduce", async () => {
    const { improveSectionPrompt } = await import("@/lib/ai/prompts");
    const section = "## 6. 촬영용 대본\n\n### Hook\n\n본문\n\n### 오프닝\n\n본문\n";

    const { system, prompt } = improveSectionPrompt("6. 촬영용 대본", section, "");
    const combined = `${system}\n${prompt}`;

    // Listing them verbatim is what stops a long section being rewritten as prose.
    expect(combined).toContain("## 6. 촬영용 대본");
    expect(combined).toContain("### Hook");
    expect(combined).toContain("### 오프닝");
  });
});
