"use client";

import { useState } from "react";

/**
 * The memo format, copyable. The generator matches section headers literally,
 * so a template the operator can paste beats prose describing the same thing —
 * this is the single most common source of a weak package.
 */

const TEMPLATE = `# 콘텐츠 메모

## 주제

여기에 영상 한 편의 주제를 한 문장으로 씁니다

## 타겟 시청자

누가 이 영상을 보면 좋을지 구체적으로 씁니다

## 핵심 메시지

시청자가 영상이 끝난 뒤 기억할 한 가지를 씁니다

## 다룰 포인트

- 첫 번째 다룰 내용
- 두 번째 다룰 내용
- 세 번째 다룰 내용

## 보여줄 예시 또는 시연

화면에서 실제로 보여줄 장면을 씁니다

## 원하는 분위기

예: 쉽고 실용적으로, 따라 하기 좋게

## CTA

영상 끝에서 시청자에게 요청할 행동을 씁니다
`;

const FIELDS = [
  { name: "주제", required: true, tip: "구체적일수록 좋습니다. \"Claude Code 설명\"보다 \"Claude Code로 엑셀 정리 자동화하기\"." },
  { name: "타겟 시청자", required: true, tip: "\"AI 쓰는 사람\"처럼 넓으면 대본이 뭉툭해집니다. 상황까지 적으세요." },
  { name: "핵심 메시지", required: true, tip: "한 문장, 한 가지만. 여러 개를 넣으면 영상이 흩어집니다." },
  { name: "다룰 포인트", required: true, tip: "3~5개가 적당합니다. 이것이 대본의 목차가 됩니다." },
  { name: "보여줄 예시 또는 시연", required: false, tip: "화면 지시 섹션의 근거가 됩니다." },
  { name: "원하는 분위기", required: false, tip: "비우면 채널 설정의 톤 지침을 따릅니다." },
  { name: "CTA", required: false, tip: "다음 영상으로 이어지는 흐름을 만들 때 씁니다." },
];

export function DraftTemplateGuide() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        아래 형식을 그대로 복사해 새 드래프트에 붙여넣고 내용만 채우세요.{" "}
        <strong className="text-text">헤더(## 로 시작하는 줄)는 글자 그대로</strong> 두어야 각 항목이
        올바르게 인식됩니다.
      </p>

      <div className="relative">
        <pre className="max-h-72 overflow-y-auto rounded-md border border-border-subtle bg-bg-subtle p-4 font-mono-md text-xs text-text-muted">
          {TEMPLATE}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 rounded-md border border-border bg-bg px-3 py-1 text-xs text-text-muted transition-colors hover:text-text"
        >
          {copied ? "복사됨!" : "복사"}
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-elevated text-left text-xs text-text-muted">
              <th className="px-3 py-2 font-medium">항목</th>
              <th className="px-3 py-2 font-medium">필수</th>
              <th className="px-3 py-2 font-medium">작성 요령</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => (
              <tr key={f.name} className="border-b border-border-subtle last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-text">{f.name}</td>
                <td className="px-3 py-2">
                  {f.required ? (
                    <span className="text-accent">필수</span>
                  ) : (
                    <span className="text-text-subtle">선택</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-text-subtle">{f.tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-yellow-900/40 bg-yellow-950/10 p-3">
        <p className="text-xs text-yellow-200/90">
          <strong>주의:</strong> 저장할 때마다 파이프라인이 다시 실행되어 AI 개선분이 새로
            만들어집니다. 내용을 바꾸지 않은 저장은 무시되지만, 조금이라도 수정하면 전체가
            재생성됩니다.
        </p>
      </div>
    </div>
  );
}
