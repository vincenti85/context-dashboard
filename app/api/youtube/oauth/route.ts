// app/api/youtube/oauth/route.ts — One-time OAuth setup flow for the YouTube
// Analytics API (S2). Admin-only (protected by middleware's default cookie
// check — this path is NOT in the public/bearer allowlist).
//
// Flow:
//  1. GET with no `code` -> redirect to Google's consent screen.
//  2. Google redirects back here with `code` -> exchange for tokens, DISPLAY
//     the refresh_token (Vercel functions cannot write their own env vars —
//     the admin must copy YOUTUBE_REFRESH_TOKEN into Vercel env vars manually
//     and redeploy; see README.md §7).

import { NextRequest, NextResponse } from "next/server";
import { ytOAuth, YT_ANALYTICS_BASE } from "@/lib/youtube/client";

// Read-only Analytics scope only. The write scope
// (https://www.googleapis.com/auth/youtube) that videos.update needs is
// deliberately NOT requested: metadata is copied by hand from the 게시 준비
// tab, so granting this token write access to the channel would be permission
// we never exercise. Adding S1 later means adding that scope here and
// re-running this flow to mint a new refresh token.
const SCOPES = ["https://www.googleapis.com/auth/yt-analytics.readonly"].join(" ");

/**
 * Describes a secret's shape without revealing it, so an invalid_client can be
 * told apart from a copy-paste accident. Google client secrets look like
 * "GOCSPX-" + 28 chars; a trailing newline from a paste is a common cause.
 */
function describeSecretShape(raw: string, trimmed: string): string {
  return [
    `length=${trimmed.length}`,
    `hadSurroundingWhitespace=${raw !== trimmed}`,
    `startsWithGOCSPX=${trimmed.startsWith("GOCSPX-")}`,
  ].join(", ");
}

interface AnalyticsProbeResponse {
  rows?: unknown[][];
  columnHeaders?: Array<{ name: string }>;
}

/**
 * Exercises the whole stored chain: refresh token -> access token -> a minimal
 * channel-level Analytics query. Reports which link broke rather than a bare
 * failure, since each has a different fix (expired token vs missing scope vs
 * Analytics API not enabled).
 */
async function verifySetup(): Promise<NextResponse> {
  if (!process.env.YOUTUBE_REFRESH_TOKEN?.trim()) {
    return NextResponse.json(
      { ok: false, step: "config", error: "YOUTUBE_REFRESH_TOKEN is not set" },
      { status: 500 },
    );
  }

  // Yesterday..today in UTC — Analytics data lags, so a single recent day can
  // legitimately be empty; the point here is that the call is *authorized*.
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate: fmt(weekAgo),
    endDate: fmt(today),
    metrics: "views",
  });

  try {
    const res = await ytOAuth<AnalyticsProbeResponse>(
      `reports?${params.toString()}`,
      {},
      YT_ANALYTICS_BASE,
    );
    const views = Number(res.rows?.[0]?.[0] ?? 0);
    return NextResponse.json({
      ok: true,
      message: "Refresh token, Analytics scope and API access all working.",
      window: `${fmt(weekAgo)} ~ ${fmt(today)}`,
      channelViewsInWindow: views,
      note:
        views === 0
          ? "0 views is expected if the channel has no published videos yet — authorization still succeeded."
          : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        step: message.includes("token refresh") ? "token_refresh" : "analytics_query",
        error: message,
        hint: message.includes("403")
          ? "403 here usually means the YouTube Analytics API is not enabled on the project, or the token lacks yt-analytics.readonly."
          : message.includes("invalid_grant")
            ? "invalid_grant means the refresh token expired or was revoked — publish the consent screen to In production and re-run this flow."
            : undefined,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Trim: Vercel's env editor readily keeps a trailing newline, and Google
  // rejects the secret with a bare "invalid_client" that names no cause.
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const rawSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const clientSecret = rawSecret?.trim();
  const appUrl = process.env.APP_URL?.trim();

  if (!clientId || !clientSecret || !appUrl) {
    return NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / APP_URL must be set first" },
      { status: 500 },
    );
  }

  // ?verify=1 — end-to-end check of the stored setup. Without it a broken
  // token stays invisible until the daily metrics_pull runs, and even then
  // only once a video has been linked (that job returns early otherwise).
  if (request.nextUrl.searchParams.get("verify")) {
    return verifySetup();
  }

  const redirectUri = `${appUrl}/api/youtube/oauth`;
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent"); // force refresh_token on every run
    return NextResponse.redirect(authUrl.toString());
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    // invalid_client names no cause, so add the secret's shape (never its
    // value) — that distinguishes a bad paste from a genuinely wrong secret.
    const hint = errorText.includes("invalid_client")
      ? ` | YOUTUBE_CLIENT_SECRET shape: ${describeSecretShape(rawSecret ?? "", clientSecret)}` +
        ` | clientId ends with: ...${clientId.slice(-24)}`
      : "";
    return NextResponse.json(
      { error: `token exchange failed: ${errorText}${hint}` },
      { status: 500 },
    );
  }

  const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token: string };

  if (!tokens.refresh_token) {
    return new NextResponse(
      `<p>refresh_token이 반환되지 않았습니다. 이미 한 번 인증한 계정이면
       Google 계정 설정에서 이 앱의 접근 권한을 제거한 뒤 다시 시도하세요
       (Google은 최초 동의 시에만 refresh_token을 내려줍니다).</p>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(
    `<pre style="white-space:pre-wrap;font-family:monospace;padding:24px">
YOUTUBE_REFRESH_TOKEN 값을 아래에서 복사해 Vercel 환경 변수에 저장한 뒤 재배포하세요.
이 값은 다시 보여지지 않으니 지금 복사하세요.

${tokens.refresh_token}
</pre>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
