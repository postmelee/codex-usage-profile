# Task #95 Stage 4 보고서 — 통합 검증과 로컬 확인 handoff

GitHub Issue: [#95](https://github.com/postmelee/codex-usage-profile/issues/95)
구현계획서: [`task_m100_95_impl.md`](../plans/task_m100_95_impl.md)
Stage: 4

## 단계 목적

Home 카드의 최종 target 단일 reveal 보정을 전체 회귀·production Sites 산출물·local full-stack
smoke까지 검증한다. 실제 배포는 수행하지 않고, PR 게시 뒤 작업지시자가 로컬과 실제 모바일
Safari·Chrome에서 merge Gate를 수행할 수 있도록 절차와 판정 기준을 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/HomePage.jsx` | auth 미확정 중 선로드 이미지는 DOM에 유지하되 Skeleton 아래 presentation-ready를 차단하도록 통합 계약 보정 |
| `mydocs/working/task_m100_95_stage2.md` | 위 선로드·presentation 구분을 Stage 2 근거에 명시 |
| `mydocs/working/task_m100_95_stage4.md` | 전체 검증 결과, 비배포 원칙과 merge 전 실제 기기 Gate 기록 |
| `mydocs/orders/20260812.md` | #95 Stage 4 완료와 PR 게시 준비 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

Stage 4의 제품 소스 변경은 통합 회귀에서 확인한 기존 reduced-motion DOM 계약을 보존하는 최소
보정이다. operator 이미지는 기존처럼 선로드·decode되어 DOM에 남지만 auth/profile target이
미확정이면 `data-card-status=loading`, `aria-busy=true`와 불투명 Skeleton을 유지한다. 사용자에게
operator 카드가 먼저 드러나는 회귀는 허용하지 않으며, 공개 API·URL·backend·데이터 계약과 공개
문서는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5195 npx playwright test --config=/private/tmp/task95.playwright.config.mjs --workers=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5195 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task95.playwright.config.mjs --browser=webkit --grep "Task #95" --workers=1
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
git diff --check
```

결과:

- OK — 전체 Node 739건 중 733건 통과, 실패 0건, 환경 의존 skip 6건.
- OK — Chromium 전체 Playwright 82/82 통과. 기본 5173의 무관한 로컬 서버를 건드리지 않고
  5195 isolated origin에서 실행했다.
- OK — WebKit Task #95 핵심 3/3 통과: authenticated direct Home, Profile 브랜드 복귀,
  cold/warm reload가 모두 intermediate `ready(operator)` 없이 최종 owner 한 번만 reveal했다.
- OK — production Sites full-stack build 통과.
- OK — Sites artifact verifier가 client 8개, worker 2개, migration 5개와 hosted mode를 확인했다.
- OK — local full-stack smoke가 50개 route를 검증했고 cold 136.46ms, warm 66.08ms,
  publish render 382.12ms로 완료됐다.
- OK — `git diff --check` 경고 없음.

## 로컬·실제 모바일 merge Gate

PR checkout 뒤 로컬 서버를 실행한다.

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5177
```

같은 네트워크의 실제 모바일 Safari와 Chrome에서 로컬 주소를 열고 다음을 확인한다.

1. 로그아웃 Home에서 GitHub 로그인 뒤 Home으로 돌아온다.
2. Profile에서 상단 `Codex Usage Profile` 브랜드를 눌러 Home으로 돌아온다.
3. Home을 cold reload한 뒤 같은 tab에서 warm reload를 반복한다.
4. 로그아웃 직후 늦게 완료되는 owner 카드가 다시 나타나지 않는지 확인한다.

모든 시나리오의 판정 기준은 동일하다. 카드 영역은 최종 target 준비 전까지 같은 Skeleton을
유지하고, 중간 operator·sample·stale owner를 보여주거나 `ready → loading → ready`로 깜빡이지
않으며 최종 카드만 한 번 나타나야 한다.

## 잔여 위험

- 실제 모바일 Safari·Chrome의 compositor paint와 OAuth provider 왕복은 자동 WebKit·Chromium이
  완전히 대체하지 않는다. 작업지시자 요청대로 PR 게시 뒤 실제 기기 확인을 merge Gate로 둔다.
- 이번 Stage와 이후 #96 모두 실제 Sites 배포를 수행하지 않는다. 배포 검증은 두 PR merge 뒤
  작업지시자의 별도 동시 배포 요청에서 수행한다.

## 다음 단계 영향

- Task #95 최종 보고서와 devel 대상 PR을 게시한다.
- PR은 실제 모바일 merge Gate 통과 전 merge하지 않는다.
- 이어서 #96을 최신 devel 기준 독립 브랜치에서 시작해 테마 전환과 light Skeleton을 보정하되
  실제 배포 없이 별도 PR로 게시한다.

## 승인 요청

- 작업지시자가 #95·#96 모두 PR 생성까지 진행하도록 승인했으므로 Stage 4 결과를 기준으로
  최종 보고서와 PR 게시 절차를 계속한다.
