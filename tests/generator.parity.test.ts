// generator.parity.test.ts — Golden-master parity test.
// Verifies templateGenerate() matches the recorded Python output byte-for-byte.
// Fixtures are COPIED verbatim from existing recorded outputs (A2).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { templateGenerate } from "@/lib/generator";
import { slugify } from "@/lib/generator/format";
import { parseSections, firstNonEmptyLine, bullets } from "@/lib/generator/parse";
import { stripTargetDash } from "@/lib/generator/format";

const FIXTURES = join(__dirname, "fixtures");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

function readExpected(name: string): string {
  return readFileSync(join(FIXTURES, "expected", name), "utf-8");
}

/**
 * Normalize trailing whitespace/newlines for comparison.
 * Python write_file does content.rstrip() + "\n".
 */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[\r\n\s]+$/, "") + "\n";
}

describe("templateGenerate — golden-master parity", () => {
  it("produces byte-exact brief for freeform fixture (test0.1.md)", () => {
    const draft = readFixture("test0.1.md");
    const expected = readExpected("brief.md");
    const result = templateGenerate(draft);
    expect(normalize(result.brief)).toBe(normalize(expected));
  });

  it("produces byte-exact outline for freeform fixture (test0.1.md)", () => {
    const draft = readFixture("test0.1.md");
    const expected = readExpected("outline.md");
    const result = templateGenerate(draft);
    expect(normalize(result.outline)).toBe(normalize(expected));
  });

  it("produces byte-exact upload-package for freeform fixture (test0.1.md)", () => {
    const draft = readFixture("test0.1.md");
    const expected = readExpected("upload-package.md");
    const result = templateGenerate(draft);
    expect(normalize(result.uploadPackage)).toBe(normalize(expected));
  });

  it("slug matches the recorded filename pattern", () => {
    const draft = readFixture("test0.1.md");
    const result = templateGenerate(draft);
    // Recorded filename: 2026-06-24-클로드-코드-프로젝트-세팅-4단계-*.md
    expect(result.meta.slug).toBe("클로드-코드-프로젝트-세팅-4단계");
  });
});

describe("slugify — Hangul preservation", () => {
  it("preserves Hangul syllables (JS word-class trap)", () => {
    expect(slugify("클로드 코드")).toBe("클로드-코드");
    expect(slugify("클로드 코드 프로젝트 세팅 4단계")).toBe(
      "클로드-코드-프로젝트-세팅-4단계",
    );
  });

  it("falls back to content-package for empty/whitespace-only", () => {
    expect(slugify("")).toBe("content-package");
    expect(slugify("   ")).toBe("content-package");
    expect(slugify("---")).toBe("content-package");
  });

  it("truncates to 48 chars and strips dashes", () => {
    const long = "a".repeat(60);
    const result = slugify(long);
    expect(result.length).toBe(48);
  });
});

describe("M3 asymmetry — target dash-only strip", () => {
  it("strips only leading dash, NOT asterisk or numbered marker", () => {
    // Target strips: ^\s*-\s+ (dash only)
    expect(stripTargetDash("- hello")).toBe("hello");
    expect(stripTargetDash("  - hello")).toBe("hello");
    // Does NOT strip asterisk
    expect(stripTargetDash("* hello")).toBe("* hello");
    // Does NOT strip numbered marker
    expect(stripTargetDash("1. hello")).toBe("1. hello");
  });

  it("firstNonEmptyLine strips ALL markers (dash, asterisk, numbered)", () => {
    expect(firstNonEmptyLine("- hello")).toBe("hello");
    expect(firstNonEmptyLine("* hello")).toBe("hello");
    expect(firstNonEmptyLine("1. hello")).toBe("hello");
  });
});

describe("parseSections — edge cases", () => {
  it("creates __root bucket for pre-heading lines", () => {
    const sections = parseSections("line before\n## Heading\nbody");
    expect(sections.get("__root")).toBe("line before");
    expect(sections.get("Heading")).toBe("body");
  });

  it("creates empty section keys", () => {
    const sections = parseSections("## Empty\n\n## Next\ncontent");
    expect(sections.get("Empty")).toBe("");
    expect(sections.get("Next")).toBe("content");
  });

  it("exact section-name matching (case-sensitive, no normalization)", () => {
    const sections = parseSections("## 타겟 시청자\n비개발자\n## Target Audience\ndevelopers");
    // findSection tries names in order; first non-empty wins
    expect(sections.get("타겟 시청자")).toBe("비개발자");
    expect(sections.get("Target Audience")).toBe("developers");
  });
});

describe("bullets — fallback behavior", () => {
  it("extracts bullet items when present", () => {
    expect(bullets("- a\n- b\n- c")).toEqual(["a", "b", "c"]);
    expect(bullets("1. a\n2. b")).toEqual(["a", "b"]);
  });

  it("returns all non-empty lines when no bullets", () => {
    expect(bullets("plain text\nmore text")).toEqual(["plain text", "more text"]);
  });
});
