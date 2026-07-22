import Link from "next/link";

/**
 * Shown on the overview page while no draft exists. Research on first-run
 * dashboards is blunt about this screen: it is where users decide whether the
 * product is worth their time, and "아직 드래프트가 없습니다" answers none of
 * the questions they actually have. So this states what the system produces,
 * shows how far setup has got, and offers exactly one primary action.
 */
export function FirstRunGuide({ channelProfileSet }: { channelProfileSet: boolean }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-subtle p-6">
      <h3 className="text-base font-semibold text-text">첫 콘텐츠를 만들어 보세요</h3>
      <p className="mt-1.5 text-sm text-text-muted">
        짧은 메모 하나를 저장하면 <strong className="text-text">2~3분 뒤</strong> 제목 후보·촬영
        대본·썸네일 문구·쇼츠와 SNS 문안까지 한 번에 만들어집니다. 그 사이 사람이 할 일은 없습니다.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ChecklistItem
          done={channelProfileSet}
          label="채널 정보 등록"
          hint={channelProfileSet ? "완료" : "생성 품질의 기준이 됩니다"}
          href="/settings"
        />
        <ChecklistItem done={false} label="첫 드래프트 작성" hint="메모 형식은 가이드 참고" href="/guide" />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Link
          href="/drafts/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          새 드래프트 만들기
        </Link>
        <Link href="/guide" className="text-sm text-accent transition-colors hover:text-accent-hover">
          활용 가이드 보기 →
        </Link>
      </div>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  hint,
  href,
}: {
  done: boolean;
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg px-3 py-2.5 transition-colors hover:border-border"
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
          done ? "bg-green-500/20 text-green-400" : "border border-border text-text-subtle"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span>
        <span className={`block text-sm ${done ? "text-text-muted line-through" : "text-text"}`}>
          {label}
        </span>
        <span className="block text-xs text-text-subtle">{hint}</span>
      </span>
    </Link>
  );
}
