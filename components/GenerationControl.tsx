"use client";

import { useState } from "react";
import { generatePackage, updateStatus } from "@/app/actions";

export function GenerationControl({
  draftId,
  hasOutput,
}: {
  draftId: number;
  hasOutput: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSection, setAiSection] = useState("6. 촬영용 대본");
  const [message, setMessage] = useState("");

  async function handleTemplate() {
    setLoading(true);
    setMessage("");
    try {
      await generatePackage(draftId, "template");
      setMessage("템플릿 생성 완료");
    } catch (e) {
      setMessage(`오류: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  }

  async function handleAiImprove() {
    setAiLoading(true);
    setMessage("");
    try {
      const result = await generatePackage(draftId, "ai_improve", aiSection);
      setMessage(result.error ? `AI 오류: ${result.error}` : "AI 개선 완료");
    } catch (e) {
      setMessage(`오류: ${e instanceof Error ? e.message : String(e)}`);
    }
    setAiLoading(false);
  }

  const SECTIONS = [
    "2. 유튜브 제목 후보",
    "3. 썸네일 문구 후보",
    "4. 영상 설명란",
    "5. 고정 댓글",
    "6. 촬영용 대본",
    "9. 쇼츠 재가공 스크립트",
    "10. 쓰레드/X 게시글",
    "11. 인스타 캡션",
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleTemplate}
        disabled={loading}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? "생성 중..." : "템플릿 생성"}
      </button>

      {hasOutput && (
        <>
          <div className="flex items-center gap-1">
            <select
              value={aiSection}
              onChange={(e) => setAiSection(e.target.value)}
              className="rounded-md border border-border bg-bg-subtle px-2 py-1.5 text-xs text-text"
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={handleAiImprove}
              disabled={aiLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              {aiLoading ? "AI 처리 중..." : "AI 개선"}
            </button>
          </div>

          <a
            href={`/api/export?id=${draftId}`}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            다운로드
          </a>

          <button
            onClick={() => updateStatus(draftId, "archived")}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            보관
          </button>
        </>
      )}

      {message && <span className="text-xs text-text-muted">{message}</span>}
    </div>
  );
}
