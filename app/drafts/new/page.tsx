// app/drafts/new/page.tsx — Create new draft.

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createDraft } from "@/app/actions";
import { DraftComposerGuide, BLANK_TEMPLATE } from "@/components/DraftComposerGuide";

// useSearchParams() requires a Suspense boundary (Next.js App Router).
export default function NewDraftPage() {
  return (
    <Suspense>
      <NewDraftForm />
    </Suspense>
  );
}

function NewDraftForm() {
  const searchParams = useSearchParams();
  // Prefill from a performance-fed suggestion (C1 — NextContentIdeas "새 드래프트로" link).
  const idea = searchParams.get("idea");

  const [title, setTitle] = useState("");
  // Start from the scaffold so the editor is never a blank box. A suggested
  // idea (from the performance-fed panel) drops straight into 주제.
  const [content, setContent] = useState(
    idea ? BLANK_TEMPLATE.replace("## 주제\n", `## 주제\n\n${idea}\n`) : BLANK_TEMPLATE,
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // The scaffold alone is not real content — don't let it satisfy the save button.
  const hasRealContent = content.trim() !== BLANK_TEMPLATE.trim() && content.trim().length > 0;

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    const draft = await createDraft(title.trim(), content);
    router.push(`/drafts/${draft.id}`);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">새 드래프트</h2>
          <p className="mt-1 text-sm text-text-muted">
            저장하면 2~3분 뒤 패키지가 완성되고 메일이 옵니다.
          </p>
        </div>
        <a
          href="/guide"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          전체 가이드
        </a>
      </div>

      {/* Editor and guidance side by side: the field explanations are only
          useful while the memo is being written, not on a separate page. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-muted">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 견적서 자동화 (관리용 이름이라 자유롭게)"
              className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-muted">콘텐츠 메모</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={26}
              className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 font-mono-md text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={loading || !title.trim() || !hasRealContent}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? "저장 중..." : "저장하고 생성 시작"}
            </button>
            <button
              onClick={() => router.back()}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:text-text"
            >
              취소
            </button>
            {!hasRealContent && (
              <span className="text-xs text-text-subtle">
                내용을 채우면 저장할 수 있습니다
              </span>
            )}
          </div>
        </div>

        <DraftComposerGuide onInsert={setContent} hasContent={hasRealContent} />
      </div>
    </div>
  );
}
