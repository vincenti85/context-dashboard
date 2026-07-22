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

// Read-only Analytics scope only. The write scope
// (https://www.googleapis.com/auth/youtube) that videos.update needs is
// deliberately NOT requested: metadata is copied by hand from the 게시 준비
// tab, so granting this token write access to the channel would be permission
// we never exercise. Adding S1 later means adding that scope here and
// re-running this flow to mint a new refresh token.
const SCOPES = ["https://www.googleapis.com/auth/yt-analytics.readonly"].join(" ");

export async function GET(request: NextRequest) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / APP_URL must be set first" },
      { status: 500 },
    );
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
    return NextResponse.json({ error: `token exchange failed: ${errorText}` }, { status: 500 });
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
