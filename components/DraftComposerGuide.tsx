"use client";

import { useState } from "react";

/**
 * Writing aid beside the new-draft editor. The generator matches section
 * headers literally and every downstream section is derived from these four
 * required fields, so a vague memo produces a vague package — and the operator
 * only finds that out three minutes later. Showing a filled example and the
 * good/bad contrast per field is what prevents that round trip.
 */

/** Empty scaffold — headers only, nothing to delete afterwards. */
export const BLANK_TEMPLATE = `# 콘텐츠 메모

## 주제

## 타겟 시청자

## 핵심 메시지

## 다룰 포인트

-
-
-

## 보여줄 예시 또는 시연

## 원하는 분위기

## CTA
`;

/** Fully written example, sized and toned for this channel. */
export const SAMPLE_DRAFT = `# 콘텐츠 메모

## 주제

ChatGPT로 매일 쓰는 견적서 자동으로 만들기

## 타겟 시청자

견적서를 매번 엑셀로 새로 쓰는 1인 사업자와 소규모 업체 사장님

## 핵심 메시지

견적서는 매번 새로 쓰는 게 아니라, 한 번 양식을 잡아두고 내용만 바꾸는 것이다

## 다룰 포인트

- 매번 새로 쓰면 왜 시간이 오래 걸리는가
- 내 업종에 맞는 견적서 양식 한 번에 만들기
- 고객 정보만 바꿔서 재사용하는 방법
- 금액 계산이 틀리지 않게 확인하는 요령

## 보여줄 예시 또는 시연

실제 견적서 하나를 처음부터 만들고, 두 번째 견적서는 30초 만에 완성되는 장면 비교

## 원하는 분위기

컴퓨터가 익숙하지 않아도 따라 할 수 있게, 천천히 하나씩

## CTA

다음 편에서 견적서를 세금계산서로 연결하는 방법 예고
`;

interface FieldGuide {
  name: string;
  required: boolean;
  what: string;
  good: string;
  bad: string;
  why: string;
}

const FIELDS: FieldGuide[] = [
  {
    name: "주제",
    required: true,
    what: "영상 한 편이 다루는 내용을 한 문장으로",
    good: "ChatGPT로 매일 쓰는 견적서 자동으로 만들기",
    bad: "ChatGPT 활용법",
    why: "제목 후보 5개와 검색 근거 수집이 모두 이 문장에서 나옵니다. 넓으면 제목도 뭉툭해집니다.",
  },
  {
    name: "타겟 시청자",
    required: true,
    what: "누가, 어떤 상황에서 보는지",
    good: "견적서를 매번 엑셀로 새로 쓰는 1인 사업자",
    bad: "AI에 관심 있는 사람",
    why: "대본의 말투와 설명 수준이 여기에 맞춰집니다. 상황까지 적어야 구체적인 대본이 나옵니다.",
  },
  {
    name: "핵심 메시지",
    required: true,
    what: "영상이 끝난 뒤 기억에 남을 한 가지",
    good: "견적서는 매번 새로 쓰는 게 아니라 양식을 재사용하는 것이다",
    bad: "ChatGPT는 유용하다",
    why: "제목·썸네일·대본이 같은 약속을 하도록 묶는 기준입니다. 두 가지를 넣으면 영상이 흩어집니다.",
  },
  {
    name: "다룰 포인트",
    required: true,
    what: "영상에서 반드시 다룰 내용을 3~5개",
    good: "매번 새로 쓰면 왜 오래 걸리는가 / 양식 만들기 / 재사용하기",
    bad: "여러 가지 기능들",
    why: "그대로 대본의 목차와 챕터 타임라인이 됩니다. 순서대로 적으면 그 순서로 만들어집니다.",
  },
  {
    name: "보여줄 예시 또는 시연",
    required: false,
    what: "화면에서 실제로 보여줄 장면",
    good: "첫 견적서는 처음부터, 두 번째는 30초 만에 완성되는 장면 비교",
    bad: "(비워둠)",
    why: "화면 구성·시연 지시 섹션의 근거가 됩니다. 비우면 일반적인 지시만 나옵니다.",
  },
  {
    name: "원하는 분위기",
    required: false,
    what: "말투와 속도에 대한 요청",
    good: "컴퓨터가 익숙하지 않아도 따라 할 수 있게, 천천히",
    bad: "(비워둠)",
    why: "비우면 설정 화면의 채널 톤 지침을 따릅니다. 이 영상만 다르게 가고 싶을 때 씁니다.",
  },
  {
    name: "CTA",
    required: false,
    what: "영상 끝에서 시청자에게 요청할 행동",
    good: "다음 편에서 세금계산서 연결 방법 예고",
    bad: "(비워둠)",
    why: "시리즈 흐름을 만들 때 씁니다. 비우면 일반적인 마무리가 됩니다.",
  },
];

export function DraftComposerGuide({
  onInsert,
  hasContent,
}: {
  onInsert: (text: string) => void;
  hasContent: boolean;
}) {
  const [openField, setOpenField] = useState<string | null>("주제");

  function insert(text: string) {
    if (hasContent && !confirm("작성 중인 내용을 지우고 넣을까요?")) return;
    onInsert(text);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text">작성 도우미</h3>
        <p className="mt-0.5 text-xs text-text-subtle">
          아래 버튼으로 시작한 뒤 내용만 바꾸면 됩니다.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => insert(BLANK_TEMPLATE)}
          className="flex-1 rounded-md border border-border px-3 py-2 text-xs text-text-muted transition-colors hover:text-text"
        >
          빈 양식 넣기
        </button>
        <button
          type="button"
          onClick={() => insert(SAMPLE_DRAFT)}
          className="flex-1 rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-xs text-accent transition-colors hover:bg-accent/20"
        >
          예시 넣어보기
        </button>
      </div>

      <div className="rounded-md border border-border-subtle bg-bg-subtle p-3">
        <p className="text-xs text-text-muted">
          <strong className="text-text">필수 4개</strong>만 채워도 패키지가 만들어집니다. 나머지는
          비우면 채널 설정값을 따릅니다.
        </p>
      </div>

      <div className="space-y-1.5">
        {FIELDS.map((f) => {
          const open = openField === f.name;
          return (
            <div key={f.name} className="rounded-md border border-border-subtle bg-bg-subtle">
              <button
                type="button"
                onClick={() => setOpenField(open ? null : f.name)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span className="text-xs text-text-subtle">{open ? "▾" : "▸"}</span>
                <span className="text-sm text-text">{f.name}</span>
                {f.required ? (
                  <span className="text-xs text-accent">필수</span>
                ) : (
                  <span className="text-xs text-text-subtle">선택</span>
                )}
              </button>

              {open && (
                <div className="space-y-2 border-t border-border-subtle px-3 py-2.5">
                  <p className="text-xs text-text-muted">{f.what}</p>
                  <div className="space-y-1">
                    <p className="text-xs">
                      <span className="text-green-400">좋은 예 </span>
                      <span className="text-text-muted">{f.good}</span>
                    </p>
                    <p className="text-xs">
                      <span className="text-red-400/80">아쉬운 예 </span>
                      <span className="text-text-subtle">{f.bad}</span>
                    </p>
                  </div>
                  <p className="text-xs text-text-subtle">{f.why}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-subtle">
        헤더(## 로 시작하는 줄)는 글자 그대로 두어야 각 항목이 인식됩니다.
      </p>
    </div>
  );
}
