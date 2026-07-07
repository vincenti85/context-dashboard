// generator.meta.test.ts — RED-GREEN regression test for the actions.ts metadata bug.
// Bug (docs/superpowers/specs/2026-07-05-wp0-baseline-audit.md, actions.ts:113-117):
// generatePackage() wrote result.meta.topic into BOTH targetAudience and coreMessage.
// Fix: templateGenerate() must expose the actually-parsed target/message text
// (undefined when the draft doesn't specify them), and a pure helper decides
// which fields to write — never falling back to topic.

import { describe, it, expect } from "vitest";
import { templateGenerate, deriveDraftMetadataUpdate } from "@/lib/generator";

describe("templateGenerate meta — targetAudience/coreMessage", () => {
  it("includes targetAudience/coreMessage when the draft explicitly provides them", () => {
    const draft = `# 메모

## 주제

Claude.md 작성법

## 타겟 시청자

Claude Code를 처음 세팅하는 비개발자

## 핵심 메시지

Claude.md는 프로젝트 규칙이다

## 다룰 포인트

- 하나
- 둘
`;
    const result = templateGenerate(draft);
    expect(result.meta.targetAudience).toBe("Claude Code를 처음 세팅하는 비개발자");
    expect(result.meta.coreMessage).toBe("Claude.md는 프로젝트 규칙이다");
    // Regression guard: these must NOT equal topic (the original bug).
    expect(result.meta.targetAudience).not.toBe(result.meta.topic);
    expect(result.meta.coreMessage).not.toBe(result.meta.topic);
  });

  it("omits targetAudience/coreMessage when the draft does not provide them", () => {
    const draft = `# 메모

## 주제

아무 주제
`;
    const result = templateGenerate(draft);
    expect(result.meta.targetAudience).toBeUndefined();
    expect(result.meta.coreMessage).toBeUndefined();
  });
});

describe("deriveDraftMetadataUpdate — pure mapping used by app/actions.ts", () => {
  it("returns only the provided fields when the draft supplies both", () => {
    const update = deriveDraftMetadataUpdate({
      topic: "주제",
      slug: "slug",
      date: "2026-07-05",
      targetAudience: "타겟 A",
      coreMessage: "메시지 B",
    });
    expect(update).toEqual({ targetAudience: "타겟 A", coreMessage: "메시지 B" });
  });

  it("returns an empty object when neither is provided (preserves existing draft row values)", () => {
    const update = deriveDraftMetadataUpdate({
      topic: "주제",
      slug: "slug",
      date: "2026-07-05",
    });
    expect(update).toEqual({});
  });

  it("never derives targetAudience/coreMessage from topic", () => {
    const update = deriveDraftMetadataUpdate({
      topic: "주제입니다",
      slug: "slug",
      date: "2026-07-05",
    });
    expect(update.targetAudience).toBeUndefined();
    expect(update.coreMessage).toBeUndefined();
  });
});
