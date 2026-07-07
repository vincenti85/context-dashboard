// app/drafts/page.tsx — Draft list with status filter and new draft button.

import { getDrafts } from "../actions";
import { DraftList } from "@/components/DraftList";

export default async function DraftsPage({
  searchParams,
}: {
  // Next.js 15: searchParams is a Promise (async dynamic APIs).
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = statusParam || "all";
  const draftList = await getDrafts(status === "all" ? undefined : status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">드래프트</h2>
        <a
          href="/drafts/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          + 새 드래프트
        </a>
      </div>

      <div className="flex gap-2">
        {["all", "draft", "generated", "reviewed", "ready", "archived"].map((s) => (
          <a
            key={s}
            href={`/drafts?status=${s}`}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              status === s
                ? "bg-bg-elevated text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            {s === "all"
              ? "전체"
              : { draft: "초안", generated: "생성됨", reviewed: "검토됨", ready: "완료", archived: "보관됨" }[s] || s}
          </a>
        ))}
      </div>

      <DraftList drafts={draftList} />
    </div>
  );
}
