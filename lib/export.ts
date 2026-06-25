// lib/export.ts — Assemble-on-read (B2) + markdown export.
// Overlays ai_overrides section-keyed JSON map onto the template baseline.

import { slugify } from "@/lib/generator/format";

/**
 * Assemble the final document by overlaying AI overrides onto the template baseline.
 * B2 contract:
 * 1. Start from template baseline doc (uploadPackage)
 * 2. Split by header-preserving lookahead (L1): /^(?=##\s)/m
 * 3. Replace chunks whose key is present in ai_overrides
 * 4. Sections NOT in ai_overrides render as template defaults
 *
 * For brief/outline: whole-doc substitution (no split needed) (L2).
 */
export function assembleDocument(
  baselineDoc: string,
  aiOverrides: Record<string, string> | null,
): string {
  if (!aiOverrides || Object.keys(aiOverrides).length === 0) {
    return baselineDoc;
  }

  // L1: Header-preserving split using lookahead
  // chunk[0] = H1 preamble, chunk[1..] each begin with "## "
  const chunks = baselineDoc.split(/^(?=##\s)/m);

  const result = chunks.map((chunk) => {
    // Extract the section key (level-2 header text) from this chunk
    const headerMatch = chunk.match(/^##\s+(.+?)\s*$/m);
    if (!headerMatch) {
      return chunk; // Preamble or non-section chunk — keep as-is
    }

    const sectionKey = headerMatch[1].trim();
    if (sectionKey in aiOverrides) {
      return aiOverrides[sectionKey]; // Replace with improved version
    }

    return chunk; // Keep template default
  });

  return result.join("");
}

/**
 * Build the export filename: YYYY-MM-DD-slug-upload-package.md
 * Reuses the same slugify + date logic as templateGenerate.
 */
export function buildExportFilename(topic: string, date: string): string {
  return `${date}-${slugify(topic)}-upload-package.md`;
}

/**
 * Parse ai_overrides JSON text column into a map.
 * Returns null if empty/invalid.
 */
export function parseAiOverrides(raw: string | null): Record<string, string> | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Serialize ai_overrides map to JSON text for storage.
 */
export function serializeAiOverrides(overrides: Record<string, string>): string {
  return JSON.stringify(overrides);
}
