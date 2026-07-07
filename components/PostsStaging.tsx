"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePostStatus } from "@/app/actions";

interface ScheduledPost {
  id: number;
  platform: string;
  body: string;
  status: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  shorts_script: "쇼츠 스크립트",
  x_thread: "쓰레드/X",
  instagram: "인스타 캡션",
  youtube_community: "커뮤니티",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  approved: "승인됨",
  published: "게시됨",
  discarded: "폐기됨",
};

/** Result tabs — "게시 준비" tab: SNS post staging with copy + status controls (M7). */
export function PostsStaging({ posts }: { posts: ScheduledPost[] }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-subtle p-8 text-center">
        <p className="text-sm text-text-muted">
          아직 게시 준비물이 없습니다. 파이프라인이 완료되면 자동으로 생성됩니다.
        </p>
      </div>
    );
  }

  async function handleCopy(post: ScheduledPost) {
    await navigator.clipboard.writeText(post.body);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleStatusChange(postId: number, status: string) {
    await updatePostStatus(postId, status as "draft" | "approved" | "published" | "discarded");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div key={post.id} className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text">
              {PLATFORM_LABELS[post.platform] ?? post.platform}
            </span>
            <select
              value={post.status}
              onChange={(e) => handleStatusChange(post.id, e.target.value)}
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-mono-md text-xs text-text-muted">
            {post.body}
          </pre>
          <button
            onClick={() => handleCopy(post)}
            className="mt-2 rounded-md border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:text-text"
          >
            {copiedId === post.id ? "복사됨!" : "복사"}
          </button>
        </div>
      ))}
    </div>
  );
}
