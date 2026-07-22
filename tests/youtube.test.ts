// tests/youtube.test.ts — lib/youtube/search.ts, fully mocked via global.fetch.
// Verifies WP5-V1: exactly 2 API calls per keyword lookup (search.list + videos.list),
// and that view counts are correctly joined onto search results.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("fetchKeywordEvidence", () => {
  const originalApiKey = process.env.YOUTUBE_API_KEY;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.YOUTUBE_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
  });

  it("makes exactly 2 API calls (search.list + videos.list) and joins view counts", async () => {
    fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: { videoId: "abc123" },
                  snippet: { title: "Title A", channelTitle: "Channel A", publishedAt: "2026-01-01T00:00:00Z" },
                },
                {
                  id: { videoId: "def456" },
                  snippet: { title: "Title B", channelTitle: "Channel B", publishedAt: "2026-01-02T00:00:00Z" },
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes("/videos")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                { id: "abc123", statistics: { viewCount: "1000" } },
                { id: "def456", statistics: { viewCount: "2000" } },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { fetchKeywordEvidence } = await import("@/lib/youtube/search");
    const items = await fetchKeywordEvidence("test keyword");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ videoId: "abc123", title: "Title A", viewCount: 1000 });
    expect(items[1]).toMatchObject({ videoId: "def456", title: "Title B", viewCount: 2000 });
  });

  it("returns an empty array without calling videos.list when search has no results", async () => {
    fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const { fetchKeywordEvidence } = await import("@/lib/youtube/search");
    const items = await fetchKeywordEvidence("no results keyword");

    expect(items).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // only search.list, videos.list skipped
  });

  it("throws YoutubeApiError when YOUTUBE_API_KEY is not configured", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const { fetchKeywordEvidence } = await import("@/lib/youtube/search");
    const { YoutubeApiError } = await import("@/lib/youtube/client");

    await expect(fetchKeywordEvidence("anything")).rejects.toBeInstanceOf(YoutubeApiError);
  });

  it("throws YoutubeApiError on a non-ok HTTP response", async () => {
    fetchSpy = vi.fn().mockResolvedValue(new Response("quota exceeded", { status: 403 }));
    vi.stubGlobal("fetch", fetchSpy);

    const { fetchKeywordEvidence } = await import("@/lib/youtube/search");
    const { YoutubeApiError } = await import("@/lib/youtube/client");

    await expect(fetchKeywordEvidence("anything")).rejects.toBeInstanceOf(YoutubeApiError);
  });
});

describe("YoutubeApiError — actionable 403 diagnosis", () => {
  const originalApiKey = process.env.YOUTUBE_API_KEY;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.YOUTUBE_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
  });

  it("surfaces Google's error reason so a 403 cause is identifiable", async () => {
    // The three 403 causes (API disabled / key restricted / quota) share a status
    // code and are only distinguishable by `reason`.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "YouTube Data API v3 has not been used in project 123 before or it is disabled.",
              errors: [{ reason: "accessNotConfigured" }],
            },
          }),
          { status: 403 },
        ),
      ),
    );

    const { fetchKeywordEvidence } = await import("@/lib/youtube/search");
    const { YoutubeApiError } = await import("@/lib/youtube/client");

    await expect(fetchKeywordEvidence("test")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(YoutubeApiError);
      const e = err as InstanceType<typeof YoutubeApiError>;
      expect(e.reason).toBe("accessNotConfigured");
      expect(e.status).toBe(403);
      expect(e.message).toContain("accessNotConfigured");
      expect(e.message).toContain("has not been used in project");
      return true;
    });
  });

  it("still reports a usable error when the body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>gateway</html>", { status: 502 })));

    const { fetchKeywordEvidence } = await import("@/lib/youtube/search");
    await expect(fetchKeywordEvidence("test")).rejects.toThrow(/502/);
  });
});
