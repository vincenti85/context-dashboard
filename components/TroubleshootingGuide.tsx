/**
 * Symptom-first troubleshooting. Every entry here is a failure that actually
 * happened during the 2026-07-22 production run — see docs/reviews/A001 — so
 * this is a record of real incidents, not hypothetical ones.
 */

interface Issue {
  symptom: string;
  cause: string;
  fix: string;
}

const ISSUES: Issue[] = [
  {
    symptom: "저장했는데 몇 분이 지나도 아무 일이 없습니다",
    cause:
      "작업을 주기적으로 실행하는 외부 스케줄러(cron-job.org)가 멈췄을 수 있습니다. 이 시스템은 1분마다 오는 신호로 작업을 처리합니다.",
    fix: "cron-job.org에 로그인해 실행 이력이 200으로 기록되는지 확인하세요. 실패가 이어지면 CRON_SECRET이 바뀌지 않았는지 확인이 필요합니다.",
  },
  {
    symptom: "개요 화면에 '실패한 작업'이 표시됩니다",
    cause: "재시도를 3회까지 했는데도 성공하지 못한 작업입니다.",
    fix: "개요 화면의 재시도 버튼을 누르면 다시 시도합니다. 반복 실패하면 해당 작업의 오류 메시지를 확인하세요.",
  },
  {
    symptom: "AI가 다듬지 않은 기본 문구만 나옵니다",
    cause: "AI 연동(Gemini)이 설정되지 않았거나, 하루 사용 한도를 넘었습니다.",
    fix: "이 페이지 상단의 시스템 상태에서 'AI 생성' 항목을 확인하세요. 한도(하루 1,500회)는 자정에 초기화됩니다.",
  },
  {
    symptom: "근거 탭이 비어 있습니다",
    cause:
      "YouTube 검색 연동이 없거나, API 키에 권한이 없습니다. 실제로 겪은 사례는 AI용 키를 YouTube에도 함께 써서 거부된 경우였습니다.",
    fix: "Google Cloud에서 YouTube Data API v3 전용 키를 따로 만들어 쓰는 것이 안전합니다.",
  },
  {
    symptom: "대본만 다듬어지지 않았습니다",
    cause:
      "대본은 소제목이 여럿이라 AI가 구조를 흐트러뜨리기 쉽습니다. 그런 응답은 자동으로 거부되고 원본이 유지됩니다.",
    fix: "드래프트를 조금 수정해 다시 저장하면 재시도합니다. 다룰 포인트를 더 구체적으로 적으면 성공률이 올라갑니다.",
  },
  {
    symptom: "성과 데이터가 수집되지 않습니다",
    cause: "영상을 드래프트에 연결하지 않았거나, YouTube 인증이 만료됐습니다.",
    fix: "'게시 준비' 탭에서 영상 URL을 연결했는지 확인하세요. 수집은 매일 아침 6시에 한 번만 실행됩니다.",
  },
];

export function TroubleshootingGuide() {
  return (
    <div className="space-y-2">
      {ISSUES.map((issue) => (
        <details
          key={issue.symptom}
          className="group rounded-md border border-border-subtle bg-bg-subtle"
        >
          <summary className="cursor-pointer px-4 py-3 text-sm text-text marker:text-text-subtle">
            {issue.symptom}
          </summary>
          <div className="space-y-2 border-t border-border-subtle px-4 py-3">
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-subtle">원인 </span>
              {issue.cause}
            </p>
            <p className="text-xs text-text-muted">
              <span className="font-medium text-green-400/80">조치 </span>
              {issue.fix}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
