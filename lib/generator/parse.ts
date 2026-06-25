// parse.ts — Port of Python parse_sections, find_section, first_non_empty_line, bullets
// from scripts/new_content_package.py. Must match Python behavior exactly.

/**
 * Parse markdown text into sections keyed by level-2 headings.
 * Matches Python: re.match(r"^##\s+(.+?)\s*$", line)
 * Keeps a __root bucket for pre-heading lines (Python behavior).
 * Empty sections still get a key with empty string value.
 */
export function parseSections(text: string): Map<string, string> {
  const sections: Map<string, string[]> = new Map();
  sections.set("__root", []);
  let current = "__root";

  for (const line of text.split(/\r?\n/)) {
    // Python: re.match(r"^##\s+(.+?)\s*$", line) — match anchors at start implicitly
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      current = match[1].trim();
      if (!sections.has(current)) {
        sections.set(current, []);
      }
      continue;
    }
    if (!sections.has(current)) {
      sections.set(current, []);
    }
    sections.get(current)!.push(line);
  }

  const result = new Map<string, string>();
  for (const [key, lines] of sections) {
    result.set(key, lines.join("\n").trim());
  }
  return result;
}

/**
 * Look up a section by ordered name candidates.
 * Returns first non-empty trimmed value, or empty string.
 * Python: exact key equality, case-sensitive, no normalization.
 */
export function findSection(sections: Map<string, string>, names: string[]): string {
  for (const name of names) {
    const value = (sections.get(name) || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

/**
 * First non-empty, non-hash line. Strips leading bullet/asterisk/number marker.
 * Python: re.sub(r"^(?:[-*]|\d+\.)\s+", "", line).strip()
 */
export function firstNonEmptyLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      // Strip leading list marker: dash, asterisk, or number+dot
      return trimmed.replace(/^(?:[-*]|\d+\.)\s+/, "").trim();
    }
  }
  return "";
}

/**
 * Extract bullet/numbered items from text.
 * If any lines match the bullet pattern, return those captures.
 * Otherwise, return all non-empty lines.
 * Python: re.match(r"^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$", line)
 */
export function bullets(text: string): string[] {
  const items: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  if (items.length > 0) {
    return items;
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

