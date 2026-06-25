// format.ts — Port of Python slugify, numbered, bullet_list, and the target dash-only strip
// from scripts/new_content_package.py. Must match Python behavior exactly.

/**
 * Slugify a string for use in filenames.
 *
 * Python: re.sub(r"[^\w가-힣]+", "-", value.lower(), flags=re.UNICODE).strip("-")
 *         then (slug[:48].strip("-") or "content-package")
 *
 * CRITICAL TRAP: JS \w is ASCII-only even with the unicode flag.
 * The explicit 가-힣 range is REQUIRED to preserve Hangul syllables.
 * Python \w with re.UNICODE already matches Hangul, making 가-힣 redundant-but-harmless there.
 */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\w가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const truncated = slug.slice(0, 48).replace(/^-+|-+$/g, "");
  return truncated || "content-package";
}

/**
 * Format items as a numbered list.
 * Python: "\n".join(f"{index}. {item}" for index, item in enumerate(items, 1))
 */
export function numbered(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

/**
 * Format items as a bullet list.
 * Python: "\n".join(f"- {item}" for item in items)
 */
export function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * Strip ONLY a leading dash from a line (NOT asterisk or numbered marker).
 *
 * ASYMMETRY TRAP (M3): This is DIFFERENT from firstNonEmptyLine and bullets,
 * which strip [-*]|\d+\. markers. The target default construction in Python uses
 * re.sub(r"^\s*-\s+", "", line) — dash only.
 *
 * Do NOT generalize this into a shared strip-marker helper.
 */
export function stripTargetDash(line: string): string {
  return line.replace(/^\s*-\s+/, "").trim();
}
