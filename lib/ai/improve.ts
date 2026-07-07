// lib/ai/improve.ts — aiImprove with B1 structural validation.
// One section per request (Vercel Hobby function-duration constraint).
// Provider: Gemini (free 1,500 req/day) with Groq fallback (free 1,000 req/day) —
// see lib/ai/provider.ts. Replaces the earlier direct @ai-sdk/openai call.

import { z } from "zod";
import { numbered } from "@/lib/generator/format";
import { generateWithFallback, generateObjectWithFallback, AiUnavailableError } from "./provider";
import { improveSectionPrompt } from "./prompts";

export interface AiImproveResult {
  success: boolean;
  improvedMarkdown?: string;
  error?: string;
  modelUsed?: string;
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
export function validateStructure(
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

/**
 * Improve a single section's markdown using AI.
 * B1: Structural validation on every response.
 * channelContext: optional block from lib/ai/prompts.ts#channelContextBlock (empty string = none).
 */
export async function aiImprove(
  sectionKey: string,
  templateSection: string,
  channelContext = "",
): Promise<AiImproveResult> {
  try {
    // Special handling for titles/thumbnails (structured output)
    if (sectionKey === "2. 유튜브 제목 후보" || sectionKey === "3. 썸네일 문구 후보") {
      return await aiImproveTitlesOrThumbnails(sectionKey, templateSection, channelContext);
    }

    const { system, prompt } = improveSectionPrompt(sectionKey, templateSection, channelContext);
    const { text, modelUsed } = await generateWithFallback({ system, prompt, maxOutputTokens: 2000 });

    // B1: Validate structural integrity
    const validation = validateStructure(templateSection, text);
    if (!validation.valid) {
      return {
        success: false,
        error: `structure_violation: ${validation.reason}`,
        modelUsed,
      };
    }

    return { success: true, improvedMarkdown: text, modelUsed };
  } catch (err) {
    return {
      success: false,
      error: `${err instanceof AiUnavailableError ? "ai_unavailable" : "api_error"}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

/**
 * Titles and thumbnails use generateObject + zod (arrays of exactly 5 strings).
 * Result is re-serialized to numbered markdown via numbered() before storage.
 */
async function aiImproveTitlesOrThumbnails(
  sectionKey: string,
  templateSection: string,
  channelContext: string,
): Promise<AiImproveResult> {
  try {
    const isTitles = sectionKey === "2. 유튜브 제목 후보";
    const label = isTitles ? "제목" : "썸네일 문구";

    const { object, modelUsed } = await generateObjectWithFallback({
      system: `당신은 한국어 유튜브 콘텐츠 전략가입니다.\n${channelContext}기존 ${label} 후보를 참고하여 더 클릭을 유도하는 5개의 ${label}을 제안합니다. 과장하지 않고, 제목/썸네일/대본이 같은 약속을 전달하도록 합니다.`,
      prompt: `기존 ${label} 후보:\n\n${templateSection}\n\n이것들을 참고하여 더 나은 5개의 ${label}을 작성해주세요.`,
      schema: z.object({
        items: z.array(z.string()).length(5),
      }),
    });

    // Re-serialize to numbered markdown. The override MUST include the "## "
    // header (schema contract "improved markdown incl. header") so that
    // assembleDocument's chunk replacement keeps the document structure intact
    // — fixed in review A001 B-2 (the bare `${sectionKey}` form corrupted the
    // assembled doc and leaked the header into scoreTitles as a fake title).
    const improvedMarkdown = `## ${sectionKey}\n\n${numbered(object.items)}\n`;

    const validation = validateStructure(templateSection, improvedMarkdown);
    if (!validation.valid) {
      return {
        success: false,
        error: `structure_violation: ${validation.reason}`,
        modelUsed,
      };
    }

    return { success: true, improvedMarkdown, modelUsed };
  } catch (err) {
    return {
      success: false,
      error: `${err instanceof AiUnavailableError ? "ai_unavailable" : "api_error"}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
