import Link from "next/link";
import type { NextContentIdea } from "@/app/actions";

/** Dashboard (/) — performance-fed content ideas (C1). Hidden until real metrics exist. */
export function NextContentIdeas({ ideas }: { ideas: NextContentIdea[] }) {
  if (ideas.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
      <h3 className="mb-3 text-sm font-medium text-text-muted">
        성과 기반 다음 콘텐츠 아이디어
      </h3>
      <div className="space-y-2">
        {ideas.map((idea) => (
          <div
            key={idea.text}
            className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="text-text">{idea.text}</p>
              <p className="mt-0.5 text-xs text-text-subtle">
                근거: {idea.sourceDraftTitle} (누적 조회수 {idea.totalViews.toLocaleString("ko-KR")})
              </p>
            </div>
            <Link
              href={`/drafts/new?idea=${encodeURIComponent(idea.text)}`}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
            >
              새 드래프트로
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
