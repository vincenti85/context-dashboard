/**
 * Visual map of the nine pipeline stages. The operator sees stage names in the
 * PipelineStatus panel and in failure emails; without this, those names are
 * opaque strings. Each stage states what it does and what happens when it fails,
 * because "what do I do now" is the question a failure actually raises.
 */

interface Stage {
  n: number;
  id: string;
  name: string;
  what: string;
  onFail: string;
  optional?: boolean;
}

const STAGES: Stage[] = [
  {
    n: 1,
    id: "template_generate",
    name: "템플릿 생성",
    what: "메모를 파싱해 13개 섹션의 기본 패키지를 만듭니다. AI를 쓰지 않아 항상 같은 결과가 나옵니다.",
    onFail: "메모 형식 문제일 가능성이 큽니다. '## 주제'가 있는지 확인하세요.",
  },
  {
    n: 2,
    id: "keyword_snapshot",
    name: "키워드 검증",
    what: "주제로 YouTube를 검색해 경쟁 영상 10건의 조회수·채널을 수집합니다. 7일간 재사용합니다.",
    onFail: "건너뛰고 계속 진행합니다. 근거 탭만 비어 있게 됩니다.",
    optional: true,
  },
  {
    n: 3,
    id: "ai_improve_section",
    name: "AI 섹션 개선 ×6",
    what: "대본·제목·썸네일·쇼츠·X·인스타 6개 섹션을 순서대로 다듬습니다. 헤더 구조가 바뀌면 원본을 유지합니다.",
    onFail: "실패한 섹션만 기본안으로 남고 나머지는 계속 진행됩니다.",
  },
  {
    n: 4,
    id: "score_titles",
    name: "제목 순위 매기기",
    what: "2단계에서 모은 실제 조회수 데이터를 근거로 제목 5개에 순위와 이유를 붙입니다.",
    onFail: "건너뜁니다. 제목은 그대로 쓸 수 있고 순위만 없습니다.",
    optional: true,
  },
  {
    n: 5,
    id: "stage_posts",
    name: "게시물 준비",
    what: "쇼츠·X·인스타 문안을 복사 가능한 형태로 분리해 '게시 준비' 탭에 넣습니다.",
    onFail: "패키지 본문에는 그대로 있으니 직접 복사하면 됩니다.",
  },
  {
    n: 6,
    id: "notify",
    name: "완료 알림",
    what: "추천 제목과 링크를 담아 메일을 보냅니다. 같은 내용은 1시간에 한 번만 발송합니다.",
    onFail: "메일만 오지 않습니다. 대시보드에서 결과는 정상 확인됩니다.",
    optional: true,
  },
];

export function PipelineDiagram() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        드래프트를 저장하면 아래 순서로 자동 진행됩니다. 보통 <strong className="text-text">2~3분</strong>{" "}
        걸리며, 중간 단계가 실패해도 나머지는 계속 진행됩니다.
      </p>

      <ol className="space-y-2">
        {STAGES.map((s) => (
          <li
            key={s.id}
            className="rounded-md border border-border-subtle bg-bg-subtle p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                {s.n}
              </span>
              <span className="text-sm font-medium text-text">{s.name}</span>
              {s.optional && (
                <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-text-subtle">
                  선택
                </span>
              )}
              <code className="ml-auto font-mono-md text-xs text-text-subtle">{s.id}</code>
            </div>
            <p className="mt-1.5 pl-8 text-xs text-text-muted">{s.what}</p>
            <p className="mt-1 pl-8 text-xs text-text-subtle">
              <span className="text-yellow-500/80">실패 시</span> {s.onFail}
            </p>
          </li>
        ))}
      </ol>

      <div className="rounded-md border border-border-subtle bg-bg-subtle p-3">
        <p className="text-sm font-medium text-text">별도 진행: 매일 아침 6시</p>
        <p className="mt-1 text-xs text-text-muted">
          게시한 영상의 조회수를 수집해 성과가 좋은 콘텐츠의 패턴을 채널 프로필에 반영합니다.
          영상을 연결해둔 드래프트가 있어야 동작합니다.
        </p>
      </div>
    </div>
  );
}
