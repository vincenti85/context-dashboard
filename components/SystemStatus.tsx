import type { IntegrationStatus } from "@/app/actions";

/**
 * Live configuration health, not static docs. Research on internal-tool guides
 * is consistent that a page telling you what *should* be set up ages badly;
 * one showing what *is* set up stays true. Only presence is reported — the
 * server never sends env values to the client.
 */
export function SystemStatus({
  integrations,
  channelProfileSet,
  pendingJobs,
  deadJobs,
  lastJobAt,
}: {
  integrations: IntegrationStatus[];
  channelProfileSet: boolean;
  pendingJobs: number;
  deadJobs: number;
  lastJobAt: string | null;
}) {
  const missingRequired = integrations.filter((i) => i.required && !i.configured);
  const missingOptional = integrations.filter((i) => !i.required && !i.configured);

  const overall =
    missingRequired.length > 0
      ? { text: "필수 설정 누락", cls: "text-red-400", dot: "bg-red-400" }
      : missingOptional.length > 0
        ? { text: "동작 중 (일부 기능 비활성)", cls: "text-yellow-400", dot: "bg-yellow-400" }
        : { text: "전 기능 정상", cls: "text-green-400", dot: "bg-green-400" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${overall.dot}`} />
        <span className={`text-sm font-medium ${overall.cls}`}>{overall.text}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="대기 중인 작업" value={pendingJobs} tone={pendingJobs > 0 ? "active" : "idle"} />
        <StatCard label="실패한 작업" value={deadJobs} tone={deadJobs > 0 ? "error" : "idle"} />
        <StatCard
          label="마지막 작업"
          value={lastJobAt ? new Date(lastJobAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "없음"}
          tone="idle"
          small
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-elevated text-left text-xs text-text-muted">
              <th className="px-3 py-2 font-medium">연동</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium">없을 때</th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((it) => (
              <tr key={it.key} className="border-b border-border-subtle last:border-0">
                <td className="px-3 py-2">
                  <span className="text-text">{it.label}</span>
                  {it.required && <span className="ml-1.5 text-xs text-red-400">필수</span>}
                </td>
                <td className="px-3 py-2">
                  {it.configured ? (
                    <span className="text-green-400">✓ 설정됨</span>
                  ) : (
                    <span className={it.required ? "text-red-400" : "text-text-subtle"}>
                      {it.required ? "✕ 누락" : "− 미설정"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-text-subtle">
                  {it.configured ? "—" : it.impact}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border-subtle">
              <td className="px-3 py-2 text-text">채널 프로필</td>
              <td className="px-3 py-2">
                {channelProfileSet ? (
                  <span className="text-green-400">✓ 설정됨</span>
                ) : (
                  <span className="text-yellow-400">− 미설정</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-text-subtle">
                {channelProfileSet ? "—" : "채널 정보가 AI 프롬프트에 포함되지 않아 결과가 일반적입니다."}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: number | string;
  tone: "idle" | "active" | "error";
  small?: boolean;
}) {
  const color =
    tone === "error" ? "text-red-400" : tone === "active" ? "text-accent" : "text-text";
  return (
    <div className="rounded-md border border-border-subtle bg-bg-subtle px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 font-semibold ${color} ${small ? "text-sm" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
