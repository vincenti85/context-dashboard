// app/drafts/new/page.tsx — Create new draft.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDraft } from "@/app/actions";

export default function NewDraftPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    const draft = await createDraft(title.trim(), content);
    router.push(`/drafts/${draft.id}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-semibold">새 드래프트</h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-text-muted">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="드래프트 제목"
            className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-text-muted">
            초안 마크다운
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"# 콘텐츠 메모\n\n## 주제\n\n## 타겟 시청자\n\n## 핵심 메시지\n\n## 다룰 포인트\n\n- \n- \n- "}
            rows={20}
            className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 font-mono-md text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={loading || !title.trim() || !content.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-md border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:text-text"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
