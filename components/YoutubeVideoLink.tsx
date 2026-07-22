"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkYoutubeVideo } from "@/app/actions";

/**
 * Links a published video to this draft (S2 prerequisite). The daily
 * metrics_pull job only collects performance for drafts that carry a video ID,
 * and that performance is what feeds channel_profile.provenPatterns back into
 * future generations.
 *
 * No YouTube API call happens here — the deployed OAuth token is Analytics
 * read-only by design (see app/api/youtube/oauth/route.ts).
 */
export function YoutubeVideoLink({
  draftId,
  currentVideoId,
}: {
  draftId: number;
  currentVideoId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentVideoId ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const saved = await linkYoutubeVideo(draftId, value.trim());
      setValue(saved);
      setMessage(`연결됨: ${saved}`);
      router.refresh();
    } catch (e) {
      setIsError(true);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
      <h4 className="mb-1 text-xs font-medium text-text-muted">업로드한 영상 연결</h4>
      <p className="mb-2 text-xs text-text-subtle">
        영상을 올린 뒤 URL이나 영상 ID를 넣어두면, 매일 성과를 수집해 다음 기획에 반영합니다.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://youtu.be/... 또는 영상 ID"
          className="flex-1 rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {saving ? "저장 중..." : "연결"}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${isError ? "text-red-400" : "text-green-400"}`}>{message}</p>
      )}
    </div>
  );
}
