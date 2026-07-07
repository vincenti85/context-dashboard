// ai-and-export.test.ts — Unit tests for B1 structural validation and B2 assemble-on-read.
// These test the pure logic without requiring a database or AI API.

import { describe, it, expect } from "vitest";
import {
  assembleDocument,
  parseAiOverrides,
  serializeAiOverrides,
  buildExportFilename,
  extractSectionChunk,
  stripHeaderLine,
} from "@/lib/export";

describe("stripHeaderLine", () => {
  it("removes the leading ## header line, keeping only the body", () => {
    const chunk = "## 9. 쇼츠 재가공 스크립트\n\n쇼츠 본문 내용\n둘째 줄\n";
    expect(stripHeaderLine(chunk)).toBe("쇼츠 본문 내용\n둘째 줄");
  });

  it("handles a chunk with no trailing content after the header", () => {
    expect(stripHeaderLine("## Empty Section\n")).toBe("");
  });
});

describe("extractSectionChunk", () => {
  const doc = `# Title

## 1. 콘텐츠 브리프

brief body

## 2. 유튜브 제목 후보

1. Title one
2. Title two

## 3. 썸네일 문구 후보

thumbnail body
`;

  it("extracts the chunk starting at the matching ## header through the next header", () => {
    const chunk = extractSectionChunk(doc, "2. 유튜브 제목 후보");
    expect(chunk).toBeDefined();
    expect(chunk).toContain("## 2. 유튜브 제목 후보");
    expect(chunk).toContain("Title one");
    expect(chunk).not.toContain("thumbnail body");
  });

  it("returns undefined when the header does not exist", () => {
    expect(extractSectionChunk(doc, "존재하지 않는 섹션")).toBeUndefined();
  });
});

// B1 structural validation is tested indirectly via the header extraction logic.
// The aiImprove function's validateStructure is internal, but we can test
// the same logic pattern here to verify the concept.

function extractHeaders(markdown: string): string[] {
  const headers: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (match) {
      headers.push(match[2].trim());
    }
  }
  return headers;
}

describe("B1 structural validation logic", () => {
  it("extracts ordered ## and ### headers", () => {
    const md = `# Title

## Section A

### Sub A1

## Section B

content`;
    expect(extractHeaders(md)).toEqual(["Section A", "Sub A1", "Section B"]);
  });

  it("does NOT match # (level 1) or ####+ (level 4+)", () => {
    const md = `# Title\n## Two\n### Three\n#### Four`;
    expect(extractHeaders(md)).toEqual(["Two", "Three"]);
  });

  it("detects header count mismatch", () => {
    const input = `## A\n## B`;
    const output = `## A`; // Missing B
    expect(extractHeaders(input).length).not.toBe(extractHeaders(output).length);
  });

  it("detects header rename", () => {
    const input = `## 유튜브 제목 후보`;
    const output = `## 유튜브 제목 추천`; // Renamed
    expect(extractHeaders(input)).not.toEqual(extractHeaders(output));
  });

  it("validates header-set equality when headers match", () => {
    const input = `## A\n### A1\n## B`;
    const output = `## A\nnew content\n### A1\nimproved\n## B\ndone`;
    expect(extractHeaders(input)).toEqual(extractHeaders(output));
  });
});

describe("B2 assemble-on-read", () => {
  const baseline = `# 업로드 패키지: Topic

## 1. 콘텐츠 브리프

Original brief content.

## 2. 유튜브 제목 후보

1. Original title 1
2. Original title 2

## 3. 쇼츠

Short content.
`;

  it("returns baseline unchanged when no overrides", () => {
    expect(assembleDocument(baseline, null)).toBe(baseline);
    expect(assembleDocument(baseline, {})).toBe(baseline);
  });

  it("replaces only the overridden section, keeps others as template", () => {
    const overrides = {
      "2. 유튜브 제목 후보": "## 2. 유튜브 제목 후보\n\n1. Improved title 1\n2. Improved title 2",
    };
    const result = assembleDocument(baseline, overrides);
    expect(result).toContain("Improved title 1");
    expect(result).toContain("Original brief content"); // Section 1 unchanged
    expect(result).toContain("Short content"); // Section 3 unchanged
    expect(result).not.toContain("Original title 1"); // Section 2 replaced
  });

  it("produces a complete document with partial override", () => {
    const overrides = {
      "1. 콘텐츠 브리프": "## 1. 콘텐츠 브리프\n\nAI improved brief.",
    };
    const result = assembleDocument(baseline, overrides);
    // All sections should be present
    expect(result).toContain("## 1. 콘텐츠 브리프");
    expect(result).toContain("## 2. 유튜브 제목 후보");
    expect(result).toContain("## 3. 쇼츠");
  });

  it("uses header-preserving lookahead split (L1)", () => {
    // Verify that the split preserves the ## header in each chunk
    const overrides = { "3. 쇼츠": "## 3. 쇼츠\n\nOverride shorts." };
    const result = assembleDocument(baseline, overrides);
    // The overridden section should start with its header
    const chunk = result.split(/^(?=##\s)/m).find((c) => c.startsWith("## 3"));
    expect(chunk).toBeDefined();
    expect(chunk).toContain("Override shorts.");
  });
});

describe("ai_overrides serialization", () => {
  it("round-trips JSON parse/serialize", () => {
    const original = { "2. 유튜브 제목 후보": "## 2. 유튜브 제목 후보\n\n1. A\n2. B" };
    const serialized = serializeAiOverrides(original);
    const parsed = parseAiOverrides(serialized);
    expect(parsed).toEqual(original);
  });

  it("parseAiOverrides returns null for empty/invalid", () => {
    expect(parseAiOverrides(null)).toBeNull();
    expect(parseAiOverrides("")).toBeNull();
    expect(parseAiOverrides("invalid json")).toBeNull();
  });
});

describe("export filename", () => {
  it("builds YYYY-MM-DD-slug-upload-package.md", () => {
    expect(buildExportFilename("클로드 코드", "2026-06-24")).toBe(
      "2026-06-24-클로드-코드-upload-package.md",
    );
  });
});
