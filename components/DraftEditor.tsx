"use client";

import { useState } from "react";
import { updateDraft } from "@/app/actions";

export function DraftEditor({
  draftId,
  initialContent,
}: {
  draftId: number;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await updateDraft(draftId, { sourceMarkdown: content });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={30}
        className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 font-mono-md text-text focus:border-accent focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
        >
          저장
        </button>
        {saved && <span className="text-xs text-green-400">저장됨</span>}
      </div>
    </div>
  );
}
