// index.ts — templateGenerate: the main exported function.
// Port of Python build_outputs() from scripts/new_content_package.py.
// Produces brief, outline, uploadPackage markdown + meta (topic, slug, date).

import { parseSections, findSection, firstNonEmptyLine, bullets } from "./parse";
import { slugify, bulletList, stripTargetDash } from "./format";
import { buildBrief, buildOutline, buildUploadPackage, type TemplateContext } from "./templates";

export interface GeneratorResult {
  brief: string;
  outline: string;
  uploadPackage: string;
  meta: {
    topic: string;
    slug: string;
    date: string;
    /** Only set when the draft explicitly has a "## 타겟 시청자" section (undefined otherwise). */
    targetAudience?: string;
    /** Only set when the draft explicitly has a "## 핵심 메시지" section (undefined otherwise). */
    coreMessage?: string;
  };
}

export interface GeneratorOptions {
  /** Injectable date (YYYY-MM-DD) for deterministic testing. Defaults to today. */
  date?: string;
}

/**
 * Generate content package outputs from a draft markdown text.
 *
 * This is the TypeScript port of Python's build_outputs(). The generation is
 * pure template substitution — no AI. All content is deterministic given the
 * same input + date.
 *
 * Python's write_file does content.rstrip() + "\n", ensuring exactly one
 * trailing newline. We replicate this by calling normalizeTrailingNewline.
 */
export function templateGenerate(
  draftText: string,
  options?: GeneratorOptions,
): GeneratorResult {
  const sections = parseSections(draftText);

  // Section lookups with fallbacks (exact Python behavior)
  const topicText =
    findSection(sections, ["주제", "Topic"]) || firstNonEmptyLine(draftText);
  const targetText = findSection(sections, [
    "타겟 시청자",
    "타겟",
    "Target Audience",
  ]);
  const messageText = findSection(sections, [
    "핵심 메시지",
    "메시지",
    "Core Message",
  ]);
  const pointsText = findSection(sections, ["다룰 포인트", "포인트", "Points"]);
  const demoText = findSection(sections, [
    "보여줄 예시 또는 시연",
    "시연",
    "예시",
  ]);
  const toneText = findSection(sections, ["원하는 분위기", "분위기", "톤"]);
  const ctaText = findSection(sections, ["CTA", "Call To Action"]);

  // Variable construction with defaults
  const topic = firstNonEmptyLine(topicText) || "콘텐츠 주제";

  // Target: Python does (target_text or DEFAULT).splitlines(), filter non-empty,
  // strip leading dash only (M3 asymmetry: ^\s*-\s+, NOT [-*]|\d+\.), trim, join ", "
  const target = (targetText || "Claude Code를 배우고 싶은 비개발자, 자영업자, 1인 기업")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => stripTargetDash(line))
    .join(", ");

  const coreMessage =
    firstNonEmptyLine(messageText) ||
    "좋은 결과는 많은 정보보다 명확한 지침에서 시작된다.";
  // Python: [] or default → default (empty list is falsy in Python)
  // JS TRAP: [] is truthy in JS! Must check .length explicitly.
  const pointsArr = bullets(pointsText);
  const points = pointsArr.length > 0
    ? pointsArr
    : ["문제 상황", "핵심 개념", "실습 방법", "마무리 정리"];
  const demo =
    firstNonEmptyLine(demoText) || "실제 파일 작성 또는 설정 전후 비교 화면";
  const tone = firstNonEmptyLine(toneText) || "쉽고 실용적인 입문자 설명";
  const cta =
    firstNonEmptyLine(ctaText) || "다음 콘텐츠에서 이어지는 실습을 보도록 안내한다.";

  // Derived values
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const slug = slugify(topic);
  const pointsMd = bulletList(points);
  const firstPoint = points[0] ?? "핵심 개념";
  const secondPoint = points[1] ?? "실습 방법";
  const thirdPoint = points[2] ?? "정리와 적용";

  const ctx: TemplateContext = {
    topic,
    target,
    coreMessage,
    pointsMd,
    tone,
    demo,
    cta,
    firstPoint,
    secondPoint,
    thirdPoint,
  };

  return {
    brief: normalizeTrailingNewline(buildBrief(ctx)),
    outline: normalizeTrailingNewline(buildOutline(ctx)),
    uploadPackage: normalizeTrailingNewline(buildUploadPackage(ctx)),
    meta: {
      topic,
      slug,
      date,
      // Only populated when the draft actually authored these sections —
      // `target`/`coreMessage` above already have generator-internal fallback
      // defaults applied, which must NOT be mistaken for user-authored values
      // (see deriveDraftMetadataUpdate below).
      targetAudience: targetText ? target : undefined,
      coreMessage: messageText ? coreMessage : undefined,
    },
  };
}

/**
 * Pure mapping from generator meta to the drafts-table fields that should be
 * updated after a template generation run.
 *
 * Bug fixed here (see docs/superpowers/specs/2026-07-05-wp0-baseline-audit.md):
 * app/actions.ts used to write `result.meta.topic` into BOTH targetAudience
 * and coreMessage. This helper only ever writes fields the draft actually
 * specified, and never falls back to topic. When a field is absent, it is
 * omitted from the returned object entirely so the caller's `db.update(...).set()`
 * leaves the existing column value untouched (no silent overwrite with a guess).
 */
export function deriveDraftMetadataUpdate(
  meta: GeneratorResult["meta"],
): { targetAudience?: string; coreMessage?: string } {
  const update: { targetAudience?: string; coreMessage?: string } = {};
  if (meta.targetAudience) update.targetAudience = meta.targetAudience;
  if (meta.coreMessage) update.coreMessage = meta.coreMessage;
  return update;
}

/**
 * Replicate Python's write_file: content.rstrip() + "\n".
 * Strips ALL trailing whitespace/newlines, then adds exactly one "\n".
 */
function normalizeTrailingNewline(content: string): string {
  return content.replace(/[\r\n\s]+$/, "") + "\n";
}
