// tests/youtube-link.test.ts — video ID extraction for linkYoutubeVideo (S2).
// The parsing is what stands between a pasted URL and a metrics_pull that
// silently collects nothing, so it is worth pinning down precisely.

import { describe, it, expect } from "vitest";

/** Mirrors the extraction in app/actions.ts#linkYoutubeVideo. */
function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  const parsed = trimmed.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? trimmed;
  return /^[A-Za-z0-9_-]{11}$/.test(parsed) ? parsed : null;
}

describe("parseVideoId", () => {
  it("accepts a bare 11-character ID", () => {
    expect(parseVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a standard watch URL", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a watch URL with extra query params", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a youtu.be short link", () => {
    expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a Shorts URL", () => {
    expect(parseVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("preserves IDs containing hyphens and underscores", () => {
    expect(parseVideoId("https://youtu.be/a-b_c1D2e3F")).toBe("a-b_c1D2e3F");
  });

  it("rejects input that cannot be an ID", () => {
    expect(parseVideoId("")).toBeNull();
    expect(parseVideoId("too-short")).toBeNull(); // 9 chars
    expect(parseVideoId("waaaaaaaaaaaay-too-long")).toBeNull();
    expect(parseVideoId("has spaces!")).toBeNull(); // 11 chars but illegal characters
    expect(parseVideoId("https://example.com/watch?v=short")).toBeNull();
  });

  it("cannot reject an arbitrary well-formed 11-char string", () => {
    // Documented limitation: an ID is 11 chars of [A-Za-z0-9_-], so a typo that
    // happens to fit the shape is indistinguishable from a real ID. A wrong ID
    // surfaces later as metrics_pull returning no rows for that video, not as a
    // validation error here.
    expect(parseVideoId("not-a-video")).toBe("not-a-video");
  });
});
