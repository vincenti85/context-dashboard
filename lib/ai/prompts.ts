// lib/ai/prompts.ts — All AI prompt text lives here (single review point).
// See docs/superpowers/specs/2026-07-05-integrated-system-design.md §6.4.

import type { ChannelProfile } from "@/db/schema";
import type { KeywordItem } from "@/db/schema";

/** Sections eligible for automated AI improvement in the auto pipeline.
 * Confirmed against actual template headers — WP0 audit §V2. Do not change
 * without re-checking lib/generator/templates.ts's buildUploadPackage() output. */
export const AUTO_IMPROVE_SECTIONS = [
  "6. 촬영용 대본",
  "2. 유튜브 제목 후보",
  "3. 썸네일 문구 후보",
  "9. 쇼츠 재가공 스크립트",
  "10. 쓰레드/X 게시글",
  "11. 인스타 캡션",
] as const;

export function channelContextBlock(profile: ChannelProfile | null): string {
  if (!profile) return "";
  const lines = [
    `채널: ${profile.channelName} — ${profile.channelDescription}`,
    `기본 타겟: ${profile.defaultAudience}`,
  ];
  if (profile.toneGuide) lines.push(`톤: ${profile.toneGuide}`);
  if (profile.provenPatterns) lines.push(`검증된 패턴: ${profile.provenPatterns}`);
  if (profile.recentTopics?.length) {
    lines.push(`최근 주제(중복 회피): ${profile.recentTopics.join(", ")}`);
  }
  return `[채널 컨텍스트]\n${lines.join("\n")}\n`;
}

const BASE_RULES = `1. 모든 ## 및 ### 헤더를 원본 그대로 유지합니다 (추가, 삭제, 이름 변경, 레벨 변경 금지).
2. 섹션 구조를 변경하지 않습니다.
3. 한국어로, 비개발자도 이해할 수 있는 쉬운 표현을 사용합니다.
4. 과장하지 않습니다. 제목, 썸네일, 대본이 같은 약속을 전달하도록 합니다.
5. 마크다운 형식만 반환합니다.`;

export function improveSectionPrompt(
  sectionKey: string,
  sectionMarkdown: string,
  channelContext: string,
): { system: string; prompt: string } {
  return {
    system: `당신은 한국어 유튜브 콘텐츠 에디터입니다.\n${channelContext}주어진 섹션의 문장을 더 자연스럽고 구체적으로 개선하되, 다음 규칙을 엄격히 지킵니다:\n${BASE_RULES}`,
    prompt: `다음 섹션을 개선해주세요:\n\n${sectionMarkdown}`,
  };
}

export function scoreTitlesPrompt(
  titles: string[],
  evidence: KeywordItem[],
  channelContext: string,
): { system: string; prompt: string } {
  const evidenceLines = evidence
    .slice(0, 10)
    .map(
      (item, i) =>
        `${i + 1}. "${item.title}" — ${item.channelTitle}, 조회수 ${item.viewCount.toLocaleString(
          "ko-KR",
        )}, 게시일 ${item.publishedAt.slice(0, 10)}`,
    )
    .join("\n");

  return {
    system: `당신은 한국어 유튜브 데이터 분석가입니다.\n${channelContext}아래 검색 결과 데이터를 근거로 제목 후보의 우선순위를 매기고, 각 코멘트에는 반드시 데이터의 실제 수치(조회수, 채널명 등)를 인용합니다. 추측이나 일반론으로 코멘트를 채우지 않습니다.`,
    prompt: `제목 후보:\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n검색 결과 근거:\n${evidenceLines || "(검색 결과 없음)"}\n\n각 제목에 순위(1이 가장 좋음)와 근거 코멘트를 부여해주세요.`,
  };
}
