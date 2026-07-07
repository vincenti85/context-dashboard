"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyYoutubeMetadata } from "@/app/actions";

/**
 * Manual-only YouTube metadata apply (S1). Requires the video to already be
 * uploaded/published by the admin elsewhere — this only pushes title/description/tags.
 * SAFETY: calls the applyYoutubeMetadata Server Action, which is the sole
 * caller of lib/youtube/metadata.ts#applyMetadata (never invoked automatically).
 */
export function YoutubeMetadataApply({
  draftId,
  currentVideoId,
}: {
  draftId: number;
  currentVideoId: string | null;
}) {
  const router = useRouter();
  const [videoId, setVideoId] = useState(currentVideoId ?? "");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");

  async function handleApply() {
    if (!videoId.trim()) return;
    setApplying(true);
    setMessage("");
    try {
      await applyYoutubeMetadata(draftId, videoId.trim());
      setMessage("적용 완료");
      router.refresh();
    } catch (e) {
      setMessage(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
      <h4 className="mb-2 text-xs font-medium text-text-muted">
        YouTube 메타데이터 적용 (S1 — 이미 업로드된 영상에만 사용)
      </h4>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          placeholder="YouTube 영상 ID"
          className="flex-1 rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
        <button
          onClick={handleApply}
          disabled={applying || !videoId.trim()}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {applying ? "적용 중..." : "적용"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-text-subtle">{message}</p>}
    </div>
  );
}
