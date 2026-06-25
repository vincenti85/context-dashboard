import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import type { Draft } from "@/db/schema";

export function DraftList({ drafts }: { drafts: Draft[] }) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-subtle p-8 text-center">
        <p className="text-sm text-text-muted">드래프트가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <Link
          key={draft.id}
          href={`/drafts/${draft.id}`}
          className="block rounded-md border border-border-subtle bg-bg-subtle px-4 py-3 transition-colors hover:border-border"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusBadge status={draft.status} />
              <span className="text-sm font-medium">{draft.title}</span>
            </div>
            <span className="text-xs text-text-subtle">
              {new Date(draft.updatedAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
