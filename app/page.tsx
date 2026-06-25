// app/page.tsx — Overview dashboard.

import { getOverviewStats, getDrafts } from "./actions";
import { OverviewCards } from "@/components/OverviewCards";
import Link from "next/link";

export default async function OverviewPage() {
  const stats = await getOverviewStats();
  const recentDrafts = await getDrafts();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">개요</h2>
        <p className="mt-1 text-sm text-text-muted">
          콘텐츠 패키지 생성 현황
        </p>
      </div>

      <OverviewCards
        total={stats.total}
        generated={stats.generated}
        needsReview={stats.needsReview}
      />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-muted">최근 드래프트</h3>
          <Link
            href="/drafts"
            className="text-sm text-accent hover:text-accent-hover"
          >
            전체 보기 →
          </Link>
        </div>
        <div className="space-y-2">
          {recentDrafts.slice(0, 5).map((draft) => (
            <Link
              key={draft.id}
              href={`/drafts/${draft.id}`}
              className="block rounded-md border border-border-subtle bg-bg-subtle px-4 py-3 transition-colors hover:border-border"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{draft.title}</span>
                <span className="text-xs text-text-subtle">
                  {new Date(draft.updatedAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </Link>
          ))}
          {recentDrafts.length === 0 && (
            <p className="text-sm text-text-muted">아직 드래프트가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
