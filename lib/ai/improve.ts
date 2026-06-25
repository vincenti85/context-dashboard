// lib/ai/improve.ts — aiImprove with B1 structural validation.
// One section per request (M1: Vercel Hobby 10s constraint).

import { generateText, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { numbered } from "@/lib/generator/format";

export interface AiImproveResult {
  success: boolean;
  improvedMarkdown?: string;
  error?: string;
}

/**
 * Extract ordered level-2 and level-3 header texts from markdown.
 * Used for B1 structural validation.
 * Every anchor MUST be ^##\s (two hashes + whitespace) to avoid matching ### (L5).
 */
function extractHeaders(markdown: string): string[] {
  const headers: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    // Match ## or ### headers (NOT # alone, NOT ####+)
    const match = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (match) {
      headers.push(match[2].trim());
    }
  }
  return headers;
}

/**
 * B1 STRUCTURAL VALIDATION:
 * Assert the ordered header-set of the AI response equals the input.
 * On mismatch: return failure (caller records structure_violation, keeps template).
 */
function validateStructure(
  inputMarkdown: string,
  outputMarkdown: string,
): { valid: boolean; reason?: string } {
  const inputHeaders = extractHeaders(inputMarkdown);
  const outputHeaders = extractHeaders(outputMarkdown);

  if (inputHeaders.length !== outputHeaders.length) {
    return {
      valid: false,
      reason: `header count mismatch: input has ${inputHeaders.length}, output has ${outputHeaders.length}`,
    };
  }

  for (let i = 0; i < inputHeaders.length; i++) {
    if (inputHeaders[i] !== outputHeaders[i]) {
      return {
        valid: false,
        reason: `header mismatch at position ${i}: expected "${inputHeaders[i]}", got "${outputHeaders[i]}"`,
      };
    }
  }

  return { valid: true };
}

const SYSTEM_PROMPT = `당신은 한국어 유튜브 콘텐츠 에디터입니다.
주어진 섹션의 문장을 더 자연스럽고 구체적으로 개선하되, 다음 규칙을 엄격히 지킵니다:
1. 모든 ## 및 ### 헤더를 원본 그대로 유지합니다 (추가, 삭제, 이름 변경, 레벨 변경 금지).
2. 섹션 구조를 변경하지 않습니다.
3. 한국어로 작성합니다.
4. 마크다운 형식만 반환합니다.`;

/**
 * Improve a single section's markdown using AI.
 * M1: One section per request (Vercel Hobby 10s constraint).
 * B1: Structural validation on every response.
 */
export async function aiImprove(
  sectionKey: string,
  templateSection: string,
): Promise<AiImproveResult> {
  try {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // Special handling for titles/thumbnails (structured output)
    if (sectionKey === "2. 유튜브 제목 후보" || sectionKey === "3. 썸네일 문구 후보") {
      return await aiImproveTitlesOrThumbnails(sectionKey, templateSection, model);
    }

    // Free-text section improvement
    const { text } = await generateText({
      model: openai(model),
      system: SYSTEM_PROMPT,
      prompt: `다음 섹션을 개선해주세요:\n\n${templateSection}`,
      maxTokens: 2000,
    });

    // B1: Validate structural integrity
    const validation = validateStructure(templateSection, text);
    if (!validation.valid) {
      return {
        success: false,
        error: `structure_violation: ${validation.reason}`,
      };
    }

    return { success: true, improvedMarkdown: text };
  } catch (err) {
    return {
      success: false,
      error: `api_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Titles and thumbnails use generateObject + zod (arrays of exactly 5 strings).
 * Result is re-serialized to numbered markdown via numbered() before storage (L3).
 */
async function aiImproveTitlesOrThumbnails(
  sectionKey: string,
  templateSection: string,
  model: string,
): Promise<AiImproveResult> {
  try {
    const isTitles = sectionKey === "2. 유튜브 제목 후보";
    const label = isTitles ? "제목" : "썸네일 문구";

    const { object } = await generateObject({
      model: openai(model),
      system: `당신은 한국어 유튜브 콘텐츠 전략가입니다. 기존 ${label} 후보를 참고하여 더 클릭을 유도하는 5개의 ${label}을 제안합니다.`,
      prompt: `기존 ${label} 후보:\n\n${templateSection}\n\n이것들을 참고하여 더 나은 5개의 ${label}을 작성해주세요.`,
      schema: z.object({
        items: z.array(z.string()).length(5),
      }),
    });

    // Re-serialize to numbered markdown (L3)
    const improvedMarkdown = `${sectionKey}\n\n${numbered(object.items)}\n`;
    return { success: true, improvedMarkdown };
  } catch (err) {
    return {
      success: false,
      error: `api_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
