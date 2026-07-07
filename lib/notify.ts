// lib/notify.ts — Resend email notifications for pipeline completion/failure.
// Free tier: 3,000/mo, 100/day (see WP0-adjacent free-resource research,
// docs/2026-07-05-benchmark-and-solo-automation-plan.md §4.6).
// De-duplication: lib/jobs/notify.ts guards against sending the same
// draftId+kind more than once per hour (see that file's dedupe check).

import { Resend } from "resend";

export interface NotifyPackageReadyInput {
  draftTitle: string;
  topTitleCandidate: string | null;
  dashboardUrl: string;
}

export interface NotifyPipelineFailedInput {
  draftTitle: string;
  failedJobType: string;
  errorSummary: string;
  dashboardUrl: string;
}

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getRecipient(): string | null {
  return process.env.NOTIFY_EMAIL || null;
}

/** Returns true if an email was actually sent (false = skipped due to missing config). */
export async function sendPackageReadyEmail(input: NotifyPackageReadyInput): Promise<boolean> {
  const client = getClient();
  const to = getRecipient();
  if (!client || !to) return false;

  await client.emails.send({
    from: "Content Pipeline <onboarding@resend.dev>",
    to,
    subject: `[완성] ${input.draftTitle}`,
    text: [
      `"${input.draftTitle}" 패키지가 완성되었습니다.`,
      input.topTitleCandidate ? `추천 제목: ${input.topTitleCandidate}` : null,
      `대시보드: ${input.dashboardUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  return true;
}

export async function sendPipelineFailedEmail(input: NotifyPipelineFailedInput): Promise<boolean> {
  const client = getClient();
  const to = getRecipient();
  if (!client || !to) return false;

  await client.emails.send({
    from: "Content Pipeline <onboarding@resend.dev>",
    to,
    subject: `[실패] ${input.draftTitle} — ${input.failedJobType}`,
    text: [
      `"${input.draftTitle}" 파이프라인의 "${input.failedJobType}" 단계가 실패했습니다.`,
      `오류: ${input.errorSummary}`,
      `대시보드: ${input.dashboardUrl}`,
    ].join("\n\n"),
  });
  return true;
}
