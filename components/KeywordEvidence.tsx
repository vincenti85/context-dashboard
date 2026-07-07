interface KeywordItem {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  publishedAt: string;
}

interface TitleScore {
  title: string;
  rank: number;
  comment: string;
}

/** Result tabs — "근거" tab: keyword search evidence + AI title ranking (M6). */
export function KeywordEvidence({
  keyword,
  items,
  titleScores,
}: {
  keyword?: string;
  items: KeywordItem[];
  titleScores?: TitleScore[] | null;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-subtle p-8 text-center">
        <p className="text-sm text-text-muted">
          아직 키워드 근거가 없습니다. YOUTUBE_API_KEY가 설정되면 다음 파이프라인 실행 시 자동으로
          수집됩니다.
        </p>
      </div>
    );
  }

  const sortedScores = titleScores?.slice().sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-4">
      {sortedScores && sortedScores.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-muted">제목 후보 순위</h4>
          <ol className="space-y-2">
            {sortedScores.map((s) => (
              <li
                key={s.title}
                className="rounded-md border border-border-subtle bg-bg-subtle p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs font-medium text-accent">
                    {s.rank}위
                  </span>
                  <span className="text-text">{s.title}</span>
                </div>
                <p className="mt-1 text-xs text-text-subtle">{s.comment}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-medium text-text-muted">
          검색 근거{keyword ? ` — "${keyword}"` : ""}
        </h4>
        <div className="overflow-x-auto rounded-md border border-border-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-elevated text-left text-text-muted">
                <th className="px-3 py-2 font-medium">제목</th>
                <th className="px-3 py-2 font-medium">채널</th>
                <th className="px-3 py-2 font-medium">조회수</th>
                <th className="px-3 py-2 font-medium">게시일</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.videoId} className="border-b border-border-subtle last:border-0">
                  <td className="max-w-xs truncate px-3 py-2 text-text">{item.title}</td>
                  <td className="px-3 py-2 text-text-muted">{item.channelTitle}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {item.viewCount.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-text-subtle">{item.publishedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
