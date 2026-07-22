// app/page.tsx — Overview dashboard.

import {
  getOverviewStats,
  getDrafts,
  getDeadJobs,
  getNextContentIdeas,
  getChannelProfile,
} from "./actions";
import { OverviewCards } from "@/components/OverviewCards";
import { JobsPanel } from "@/components/JobsPanel";
import { NextContentIdeas } from "@/components/NextContentIdeas";
import { FirstRunGuide } from "@/components/FirstRunGuide";
import Link from "next/link";

export default async function OverviewPage() {
  const [stats, recentDrafts, deadJobs, ideas, profile] = await Promise.all([
    getOverviewStats(),
    getDrafts(),
    getDeadJobs(),
    getNextContentIdeas(),
    getChannelProfile(),
  ]);

  const isFirstRun = recentDrafts.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">개요</h2>
          <p className="mt-1 text-sm text-text-muted">콘텐츠 패키지 생성 현황</p>
        </div>
        <Link
          href="/guide"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          활용 가이드
        </Link>
      </div>

      <JobsPanel jobs={deadJobs} />

      {/* First run: guidance instead of three zeros and an empty list. */}
      {isFirstRun ? (
        <FirstRunGuide channelProfileSet={Boolean(profile)} />
      ) : (
        <>
          <NextContentIdeas ideas={ideas} />

          <OverviewCards
            total={stats.total}
            generated={stats.generated}
            needsReview={stats.needsReview}
          />

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-muted">최근 드래프트</h3>
              <Link href="/drafts" className="text-sm text-accent hover:text-accent-hover">
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
