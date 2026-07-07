// lib/youtube/client.ts — Raw fetch wrappers for YouTube Data API v3 (API key)
// and OAuth-authenticated calls (Data API videos.update + Analytics API).
// No `googleapis` dependency — keeps the bundle small; free-tier quota is
// enough for our call volume (see docs/2026-07-05-benchmark-and-solo-automation-plan.md).

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const YT_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YT_ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2";

export class YoutubeApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "YoutubeApiError";
    this.status = status;
  }
}

/** API-key-authenticated GET (search.list, videos.list — read-only, no user consent needed). */
export async function ytApiKey<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new YoutubeApiError("YOUTUBE_API_KEY is not configured");

  const url = new URL(`${YT_API_BASE}/${path}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new YoutubeApiError(`YouTube API ${path} failed: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// Module-scope cache. Each Vercel function invocation is a fresh module load,
// so this only helps within a single warm invocation/worker loop — acceptable,
// since the alternative (persisting tokens) would need its own DB round trip.
let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new YoutubeApiError("YouTube OAuth env vars are not configured");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(YT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new YoutubeApiError(`YouTube OAuth token refresh failed: ${res.status}`, res.status);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

/** OAuth-authenticated call (videos.update, Analytics reports.query). Manual-approval callers only (WP9). */
export async function ytOAuth<T>(
  path: string,
  init: RequestInit = {},
  base: string = YT_API_BASE,
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${base}/${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new YoutubeApiError(`YouTube OAuth API ${path} failed: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}
