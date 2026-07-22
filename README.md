# 콘텐츠 패키지 자동화 대시보드

`1.Draft` 폴더의 로컬 스크립트를 대체하는 Vercel 웹 대시보드다. Draft를 저장하면
템플릿 생성 → 키워드 검증 → AI 섹션 개선 → 제목 스코어링 → SNS 게시물 준비 →
알림까지 사람 개입 없이 자동으로 진행된다.

설계 근거: `docs/superpowers/specs/2026-07-05-integrated-system-design.md`
감사 기록: `docs/superpowers/specs/2026-07-05-wp0-baseline-audit.md`

## 1. 로컬 개발 환경 설정

```bash
npm install
cp .env.example .env.local   # 아래 2번 항목을 채운다
npm run dev
```

## 2. 환경 변수

`.env.example`을 참고한다. 필수/선택 여부와 발급처는 다음과 같다.

| 변수 | 필수 | 발급처 | 비고 |
|---|---|---|---|
| `DATABASE_URL` | 필수 | Neon 프로젝트 (pooled) | |
| `DIRECT_URL` | 필수 | Neon 프로젝트 (direct) | 마이그레이션 전용 |
| `ADMIN_PASSWORD` | 필수 | 직접 설정 | 관리자 로그인 |
| `CRON_SECRET` | 필수 | `openssl rand -hex 32` | 워커/크론 엔드포인트 Bearer 토큰 |
| `APP_URL` | 필수 | 배포 후 확정되는 Vercel URL | self-invoke 대상 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 선택* | https://aistudio.google.com/apikey (카드 불필요, 무료 1,500회/일) | 없으면 AI 개선 단계가 건너뛰어짐(파이프라인은 계속 진행) |
| `GROQ_API_KEY` | 선택 | https://console.groq.com/keys (카드 불필요, 무료 1,000회/일) | Gemini 실패 시 폴백. 미설정 시 Gemini 단독 운영 |
| `RESEND_API_KEY` | 선택 | https://resend.com/api-keys (무료 3,000통/월) | 없으면 이메일 알림 생략 |
| `NOTIFY_EMAIL` | 선택 | 본인 이메일 | |
| `YOUTUBE_API_KEY` | 선택 | Google Cloud Console → APIs & Services → 사용자 인증 정보 (API 키) | 없으면 키워드 검증/제목 스코어링 생략 |
| `YOUTUBE_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | 선택 (S2) | Google Cloud Console → OAuth 클라이언트 | 성과(Analytics) 수집용. 없으면 metrics_pull이 건너뜀 |

\* AI 키가 하나도 없으면 파이프라인은 템플릿 baseline만 생성하고 완료된다(오류 아님).

AI provider 체인은 **실제로 설정된 키로만 구성**된다(`lib/ai/provider.ts#getModelChain`).
따라서 `GROQ_API_KEY`를 비워두면 Gemini 단독으로 동작하며, 폴백을 시도하다
"키 없음" 오류가 발생하는 일은 없다. 나중에 Groq 키를 추가하면 코드 변경 없이
폴백이 활성화된다.

## 3. 데이터베이스 마이그레이션

```bash
npm run db:generate   # 스키마 변경 시 db/migrations/*.sql 생성
npm run db:migrate    # DIRECT_URL 기준으로 실제 적용
```

이 저장소에는 이미 `db/migrations/0000_*.sql`, `0001_*.sql`이 생성되어 있다.
**Neon 프로젝트를 처음 연결한 뒤에는 반드시 `npm run db:migrate`를 한 번 실행해야
한다** — 로컬 환경에는 연결 가능한 Neon 인스턴스가 없어 이 저장소의 자동화
과정에서는 마이그레이션을 실제로 적용해보지 못했다 (아래 "실행 전 확인 필요"
참고).

## 4. 테스트

```bash
npm test
```

DB 연결 없이 동작하는 순수 로직 테스트다. 큐의 원자적 클레임(`claimNextJob`),
동시성(SKIP LOCKED), 실제 마이그레이션 적용 여부는 로컬에서 검증할 수 없으며
Neon 연결 후 수동 확인이 필요하다 (5번 체크리스트).

## 5. 자동 파이프라인 스케줄러 설정 (필수)

Vercel Hobby 플랜은 Cron Job이 **하루 1회**로 제한된다. 그래서 잡 큐 소진은
아래 3중 구조로 처리한다.

1. **self-invoke**: Draft 저장 직후 서버가 스스로 `/api/jobs/run`을 호출 (즉시성)
2. **cron-job.org (필수 등록)**: 1분 주기로 `/api/jobs/run`을 호출하는 스위퍼.
   무료 계정으로 https://cron-job.org 에서 다음과 같이 등록한다.
   - URL: `https://<your-app>.vercel.app/api/jobs/run`
   - Method: POST
   - Header: `Authorization: Bearer <CRON_SECRET>`
   - Interval: 1분
3. **Vercel Cron (1일 1회)**: `vercel.json`에 이미 등록됨 (`/api/cron/daily`,
   UTC 21:00 = KST 06:00). 성과 수집(`metrics_pull`)과 아웃라이어 수집
   (`outlier_pull`)을 담당한다.

2번(cron-job.org 등록)을 빠뜨리면 self-invoke가 실패할 때(배포 콜드스타트,
네트워크 오류 등) 잡이 재시도되지 않고 지연될 수 있다.

## 6. Vercel 배포

```bash
vercel link            # 프로젝트 연결 (최초 1회)
vercel env pull         # 로컬 .env.local과 동기화하고 싶을 때
# Vercel 대시보드 또는 CLI로 위 2번 항목의 환경 변수를 모두 설정한 뒤:
vercel deploy           # preview
vercel deploy --prod    # production (preview 검증 후에만)
```

Neon Postgres는 Vercel Marketplace 통합(Storage 탭)으로 연결하는 것을 권장한다.

## 7. 실행 전 확인 필요 (이 저장소의 자동화 과정에서 검증하지 못한 항목)

아래는 실제 계정·배포·API 키가 있어야 확인 가능해 로컬에서 자동 검증하지
못했다. 배포 전 반드시 사용자가 직접 확인해야 한다.

- [ ] `npm run db:migrate`가 실제 Neon 인스턴스에 성공적으로 적용되는지
- [ ] `claimNextJob()`의 동시성 제어(SKIP LOCKED)가 동시 요청 2개 이상에서 잡을
      중복 처리하지 않는지 (`curl`로 `/api/jobs/run` 동시 호출 2회 테스트)
- [ ] Vercel Hobby 플랜에서 워커 함수(`/api/jobs/run`)의 실제 실행 시간 한도가
      8초 소프트 데드라인 내에서 LLM 호출 1회를 완주하기에 충분한지 (preview
      배포 후 함수 로그에서 실측)
- [ ] Vercel Cron이 `CRON_SECRET`을 자동으로 `Authorization: Bearer` 헤더로
      보내는지, 아니면 별도 설정이 필요한지 (배포 시점의 Vercel Cron Jobs 공식
      문서로 확인)
- [ ] Gemini(`gemini-3.5-flash`)/Groq(`llama-3.3-70b-versatile`) 무료 티어가
      실제 한국어 콘텐츠 개선에 충분한 품질을 내는지 (섹션 몇 개를 실제 생성해
      수동 비교)
- [ ] YouTube OAuth 리프레시 토큰 발급 (아래 §9 참고)
- [ ] cron-job.org 1분 주기 호출의 24시간 성공률

## 8. 이 구현이 아직 하지 않는 것 (범위 밖, `Won't`)

- SNS 자동 게시(X/Instagram/Threads 직접 API 연동) — 게시물 스테이징과 복사
  버튼까지만 제공한다.
- 썸네일 **이미지** 생성 — 문구 후보까지만.
- 영상 편집 자동화, 다중 사용자, 결제, Vercel Blob 저장.
- YouTube API 쿼터 증설 신청 — 개인 채널 기본 쿼터로 충분하다는 전제.

전체 범위 정의: `docs/superpowers/specs/2026-07-05-integrated-system-design.md` §3

## 9. YouTube 성과 수집(S2) 연동

영상 성과를 매일 수집해 `channel_profile.provenPatterns`에 반영하는 피드백
루프다. 연동하지 않아도 나머지 파이프라인은 정상 동작한다.

### 9.1 Google Cloud 설정

1. **YouTube Analytics API 활성화** — APIs & Services → Library →
   `YouTube Analytics API` → Enable (Data API와 별개의 API다)
2. **OAuth 동의 화면** — External 선택, 앱 이름·지원 이메일 입력
3. **동의 화면을 반드시 "In Production"으로 게시** ⚠️
   Testing 상태로 두면 Google이 **refresh token을 7일 후 만료**시켜 매주
   재인증해야 한다. 게시하면 토큰이 영구화된다. 심사(verification) 없이도
   게시할 수 있으며, 최초 인증 시 "확인되지 않은 앱" 경고에서
   **고급 → 이동(안전하지 않음)** 을 누르면 된다.
4. **OAuth 클라이언트 ID 생성** — 유형: 웹 애플리케이션,
   승인된 리디렉션 URI에 `{APP_URL}/api/youtube/oauth` 추가

### 9.2 리프레시 토큰 발급

1. Vercel에 `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` 설정 후 재배포
2. **대시보드에 로그인한 상태로** `{APP_URL}/api/youtube/oauth` 접속
   (이 경로는 관리자 쿠키로 보호된다)
3. Google 동의 후 화면에 표시된 refresh token을 복사
4. `YOUTUBE_REFRESH_TOKEN`으로 Vercel에 저장 → 재배포

요청 스코프는 `yt-analytics.readonly` **하나뿐**이다. 영상 메타데이터 자동
적용(S1)은 쓰지 않기로 해 쓰기 권한(`.../auth/youtube`)을 요청하지 않는다.
나중에 S1을 켜려면 `app/api/youtube/oauth/route.ts`의 `SCOPES`에 쓰기 스코프를
추가하고 위 절차를 다시 실행해 토큰을 새로 발급해야 한다.

### 9.3 사용 방법

영상을 업로드한 뒤 해당 드래프트의 **게시 준비** 탭에서 **업로드한 영상 연결**에
영상 URL(또는 ID)을 입력한다. 이후 매일 1회 `metrics_pull`이 그 영상의
조회수·평균 시청 시간을 수집하고, 상위 성과 콘텐츠가 채널 프로필의
`provenPatterns`에 반영되어 이후 생성 프롬프트에 포함된다.

영상 ID를 연결하지 않으면 수집 대상이 없어 아무 일도 일어나지 않는다.
