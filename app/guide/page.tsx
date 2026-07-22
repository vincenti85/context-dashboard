// app/guide/page.tsx — Operator guide: how the system works, how to use it,
// what to do when it breaks. Opens with live configuration status rather than
// static prose, so the page reflects the deployment it is actually running in.

import Link from "next/link";
import { getSystemStatus } from "../actions";
import { SystemStatus } from "@/components/SystemStatus";
import { PipelineDiagram } from "@/components/PipelineDiagram";
import { DraftTemplateGuide } from "@/components/DraftTemplateGuide";
import { TroubleshootingGuide } from "@/components/TroubleshootingGuide";

export default async function GuidePage() {
  const status = await getSystemStatus();

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h2 className="text-xl font-semibold">활용 가이드</h2>
        <p className="mt-1 text-sm text-text-muted">
          이 시스템이 무엇을 대신해주는지, 어떻게 쓰는지, 문제가 생기면 어떻게 하는지 정리했습니다.
        </p>
      </div>

      {/* 1. What this replaces — the "why" before the "how" */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text">이 시스템이 하는 일</h3>
        <div className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
          <p className="text-sm text-text-muted">
            짧은 <strong className="text-text">콘텐츠 메모</strong> 하나를 저장하면, 유튜브 업로드에
            필요한 것들이 한 번에 만들어집니다.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-text-muted">
            <span>· 제목 후보 5개 (실제 데이터 기반 순위 포함)</span>
            <span>· 썸네일 문구 후보 5개</span>
            <span>· 촬영용 대본 (소제목별 구성)</span>
            <span>· 영상 설명란 · 고정 댓글</span>
            <span>· 챕터 타임라인 · 화면 지시</span>
            <span>· 쇼츠 3개 · X · 인스타 문안</span>
          </div>
          <p className="mt-3 text-sm text-text-muted">
            사람이 하는 일은 <strong className="text-text">메모를 쓰는 것</strong>과{" "}
            <strong className="text-text">결과를 검토하는 것</strong> 두 가지뿐입니다.
          </p>
        </div>
      </section>

      {/* 2. Live status — the part that goes stale in static docs */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-text">현재 시스템 상태</h3>
          <p className="mt-0.5 text-xs text-text-subtle">
            지금 이 서버에 실제로 설정된 내용입니다. 문서가 아니라 실시간 확인 결과입니다.
          </p>
        </div>
        <SystemStatus {...status} />
      </section>

      {/* 3. Getting started */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text">시작하기</h3>
        <ol className="space-y-2">
          {[
            {
              t: "채널 정보를 등록합니다",
              d: "설정 화면에서 채널명·타겟·톤을 입력합니다. 이 내용이 모든 생성물의 기준이 되므로 가장 먼저 하는 것이 좋습니다.",
              href: "/settings",
              cta: "설정으로",
              done: status.channelProfileSet,
            },
            {
              t: "첫 드래프트를 만듭니다",
              d: "아래 템플릿을 복사해 붙여넣고 내용을 채운 뒤 저장합니다.",
              href: "/drafts/new",
              cta: "새 드래프트",
            },
            {
              t: "2~3분 기다립니다",
              d: "저장 즉시 자동으로 진행됩니다. 드래프트 상세 화면 상단에서 진행 상황이 보이고, 완료되면 메일이 옵니다.",
            },
            {
              t: "결과를 검토하고 촬영합니다",
              d: "결과 탭에서 패키지를, 근거 탭에서 제목 순위의 이유를, 게시 준비 탭에서 SNS 문안을 확인합니다.",
            },
            {
              t: "업로드 후 영상을 연결합니다",
              d: "게시 준비 탭에 영상 URL을 넣으면 다음 날부터 성과가 수집되어 이후 기획에 반영됩니다.",
            },
          ].map((step, i) => (
            <li key={step.t} className="rounded-md border border-border-subtle bg-bg-subtle p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-text">{step.t}</span>
                {step.done && <span className="text-xs text-green-400">✓ 완료</span>}
                {step.href && (
                  <Link
                    href={step.href}
                    className="ml-auto rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:text-text"
                  >
                    {step.cta} →
                  </Link>
                )}
              </div>
              <p className="mt-1.5 pl-8 text-xs text-text-muted">{step.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Memo format */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text">메모 작성 형식</h3>
        <DraftTemplateGuide />
      </section>

      {/* 5. Pipeline */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text">자동 처리 과정</h3>
        <PipelineDiagram />
      </section>

      {/* 6. Troubleshooting */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-text">문제가 생겼을 때</h3>
          <p className="mt-0.5 text-xs text-text-subtle">
            항목을 눌러 원인과 조치를 확인하세요. 모두 실제로 발생했던 사례입니다.
          </p>
        </div>
        <TroubleshootingGuide />
      </section>

      {/* 7. Operating limits — the numbers that decide whether to worry */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text">운영 한도</h3>
        <div className="overflow-hidden rounded-md border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-elevated text-left text-xs text-text-muted">
                <th className="px-3 py-2 font-medium">항목</th>
                <th className="px-3 py-2 font-medium">무료 한도</th>
                <th className="px-3 py-2 font-medium">패키지 1건당 사용량</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["AI 생성 (Gemini)", "하루 1,500회", "약 8회"],
                ["키워드 검색 (YouTube)", "하루 약 100회", "2회"],
                ["이메일 (Resend)", "하루 100통 / 월 3,000통", "1통"],
                ["데이터베이스 (Neon)", "0.5GB", "약 50KB"],
              ].map(([a, b, c]) => (
                <tr key={a} className="border-b border-border-subtle last:border-0">
                  <td className="px-3 py-2 text-text">{a}</td>
                  <td className="px-3 py-2 text-text-muted">{b}</td>
                  <td className="px-3 py-2 text-text-subtle">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-subtle">
          하루에 10편을 만들어도 한도의 10% 미만입니다. 월 운영 비용은 $0입니다.
        </p>
      </section>
    </div>
  );
}
