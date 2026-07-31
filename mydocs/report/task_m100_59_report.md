# Task M100 #59 최종 보고서

GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
마일스톤: M100

## 작업 요약

- 대상 이슈: #59
- 마일스톤: M100
- 단계 수: 정규 Stage 4개 + local QA 보정 Stage 4.1
- 작업 목적: CLI device 승인 요청을 terminal UI 상태로 고정하고
  `login | submit | null` intent에 맞는 다음 행동을 안내하며, 동일 owner의
  승인 재시도를 token 재발급 없이 안전하게 복구한다.

CLI start 요청에 optional intent를 추가하고 D1/Postgres challenge schema와
store mapping에 durable하게 연결했다. 승인 API는 UI에 필요한 4개 필드만
반환하며 same-owner의 `approved`/`exchanged` 재시도와 pending race loser를
완료 상태로 복구한다. 다른 owner, 만료·잘못된 code는 기존처럼
fail-closed다.

브라우저 UI는 승인 중 중복 요청을 막고 성공 후 input/button을 다시
활성화하지 않는다. `submit`, `login`, no-intent별 terminal 안내와
origin-aware copy command를 제공하되 자동 redirect, clipboard, command
실행과 browser storage 기록은 하지 않는다. local QA에서 발견한 의미
혼동은 Stage 4.1에서 `Device approved`와 terminal의 최종 submit 결과
확인 문구로 분리했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `packages/codex-usage-profile-cli/src/*.js` | device start intent 전달·검증과 login/submit 호출부 분리 | npm CLI login 및 첫 submit |
| `packages/codex-usage-profile-cli/test/*.test.js` | intent 직렬화, 기존 credential 분기와 호환성 검증 | CLI 회귀 |
| `db/migrations/0003_cli_login_intent.sql` | D1 challenge nullable intent column과 enum 제약 추가 | Sites D1 schema |
| `src/profile-backend/postgres/migrations/0002_cli_login_intent.*.sql` | Postgres intent migration up/down 추가 | fallback Postgres schema |
| `src/profile-backend/cli-login.js`, `http.js`, `store-contract.js` | same-owner 완료 상태 복구, expiry/owner 경계와 4필드 serializer | device 승인 API·보안 경계 |
| `src/profile-backend/d1/*`, `postgres/store.js` | intent persistence와 store mapping 정렬 | durable storage adapter |
| `src/profile-backend/__tests__/*` | migration, replay, concurrency, token 비증가와 응답 최소화 검증 | backend 회귀 |
| `src/profile-api/client.js`, `src/profile-api/__tests__/client.test.js` | 최소화된 authorize 응답 소비 | frontend API seam |
| `src/profile-ui/deviceApproval.js` | status/error/intent 안내와 안전한 command pure helper | device 승인 상태 모델 |
| `src/profile-ui/DeviceApprovalPage.jsx`, `src/styles.css` | terminal success, 접근성, retry/copy와 reduced-motion UI | device 승인 화면 |
| `src/profile-ui/__tests__/deviceApproval.test.js`, `tests/profile-ui.spec.js` | intent 3종, double click, 오류, keyboard/mobile/motion 회귀 | UI 자동 검증 |
| `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js` | migration 3을 local Worker 통합 경로에 연결 | Sites full-stack smoke |
| `scripts/verify-sites-*-artifact.mjs`, 관련 test | packaged D1 migration allowlist와 count를 3으로 정렬 | production artifact 검증 |
| `docs/cli-submit.md` | 승인 후 intent별 행동과 device 승인/submit 결과 책임 분리 | 공식 CLI 사용자 문서 |
| `packages/codex-usage-profile-cli/README.md` | npm 사용자의 승인 직후 행동 요약 | npm package 사용자 문서 |
| `mydocs/plans/task_m100_59*.md` | 승인 범위, Stage 4.1 보정과 검증 계획 | 내부 작업 계획 |
| `mydocs/working/task_m100_59_stage*.md` | 단계별 구현·검증·잔여 위험 기록 | 내부 검증 증적 |

전체 diff는 최종 보고서와 오늘할일 변경 전 기준 50개 파일,
2,789 insertions, 107 deletions이다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/cli-submit.md` | `docs/` | `docs/cli-submit.md` | OK | 기존 CLI 상세 문서에 intent별 승인 이후 행동만 추가 |
| `packages/codex-usage-profile-cli/README.md` | CLI package root | 동일 | OK | npm package 사용자용 요약과 공식 문서 연결 유지 |
| `task_m100_59.md`, `task_m100_59_impl.md` | `mydocs/plans/` | 동일 | OK | 승인 범위와 Stage 계획 기록 |
| `task_m100_59_stage*.md` | `mydocs/working/` | 동일 | OK | Stage 1~4.1 보고서가 각 Stage commit에 포함 |
| `task_m100_59_report.md` | `mydocs/report/` | 동일 | OK | 중앙 최종 보고서 템플릿 적용 |
| root `README.md`, `mydocs/manual/`, API/architecture 문서 | 변경하지 않음 | 변경 없음 | OK | 계획된 문서 경계를 유지 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| CLI device intent | 미지정 단일 흐름 | `login`, `submit`, `null` 3상태 |
| packaged D1 migration 수 | 2 | 3 |
| Postgres task migration 수 | 1 | 2 |
| device authorize UI 응답 allowlist | challenge 중심 기존 shape | `status`, `intent`, `approvedAt`, `exchangedAt` 4필드 |
| 승인 완료 button | 재활성화 가능 | input/button terminal lock |
| 브라우저 성공 label | `Approved` | `Device approved` |
| root 자동 검증 | 해당 task 이전 기준 | 517건: 511 pass, 6 skip, 0 fail |
| Playwright 회귀 | 해당 task 이전 기준 | 36/36 pass |
| production artifact | D1 migration 2 고정 | migration 3, bindings 3, verifier OK |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 요청 직후 UI 잠금과 빠른 double click authorize 1회 | OK — focused helper/E2E와 전체 Playwright에서 확인 |
| 성공 후 check icon, `Device approved`, input/button terminal lock | OK — exact accessible name과 disabled 상태 검증 |
| `submit` intent는 현재 CLI 계속·terminal 최종 결과 안내 | OK — helper unit, E2E, 공식 문서 일치 |
| `login` intent는 복사 가능한 submit command와 local `--server` 유지 | OK — production/local origin command와 clipboard 실패·재시도 검증 |
| null intent는 특정 다음 명령을 추측하지 않음 | OK — authorization 완료와 terminal 복귀 문구 검증 |
| same-owner approved/exchanged replay와 pending race 복구 | OK — memory와 real workerd D1에서 완료 상태 수렴 |
| 승인 재시도에서 token 추가 발급 금지 | OK — replay/concurrency에서 token row 비증가 확인 |
| other-owner, expired, invalid challenge fail-closed | OK — backend HTTP/security/concurrency test 통과 |
| 승인 응답의 owner/token/digest 비노출 | OK — 4필드 exact allowlist test 통과 |
| retryable/terminal error, keyboard, live/busy, reduced-motion | OK — focused 및 전체 Playwright 통과 |
| 자동 redirect/clipboard/command/storage write 금지 | OK — URL·storage 불변과 user-action copy 검증 |
| 기존 CLI submit, Home, #55 loading card, profile/settings/Share Studio 무회귀 | OK — root test와 Playwright 36/36 통과 |
| D1 migration 3 및 production Sites artifact 포함 | OK — real workerd `[1,2,3]`, packaged migration 3, verifier OK |
| `.openai/hosting.json`과 기존 project/D1/R2 linkage 무변경 | OK — `git diff origin/devel...HEAD -- .openai/hosting.json` 빈 출력 |
| production deploy/access/environment/secret 변경 없음 | OK — local build/verifier만 수행하고 외부 배포 작업 없음 |
| PR 준비 전 diff·worktree 무결성 | OK — `git diff --check` 및 clean status 확인 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_59_stage1.md): CLI/backend intent 계약,
  D1/Postgres migration과 store round-trip 검증 완료.
- [Stage 2](../working/task_m100_59_stage2.md): same-owner replay,
  concurrency, token 비증가와 최소 응답 경계 검증 완료.
- [Stage 3](../working/task_m100_59_stage3.md): terminal UI,
  intent별 onboarding, 접근성·motion focused 검증 완료.
- [Stage 4](../working/task_m100_59_stage4.md): 공식 문서, root test,
  production artifact와 전체 Playwright 검증 완료.
- [Stage 4.1](../working/task_m100_59_stage4_1.md): device 승인과 usage submit
  결과 문구 분리 및 local QA 회귀 검증 완료.

최종 HEAD에서 다시 실행한 결과:

- `npm test`: 517 tests, 511 pass, 6 skip, 0 fail
- `npm run build`: Vite 42 modules
- `npm run build:production`: Worker 47 modules, client 42 modules
- `npm run verify:sites-production`: artifact 5,491,841 bytes,
  client 7 files, Worker 2 files, D1 migrations 3, expected bindings 3,
  Worker raw 3,902,742 bytes, compressed 2,145,666 bytes
- `npm run test:e2e`: 36 tests, 36 pass
- `git diff --check`: 경고 없음
- `.openai/hosting.json` diff: 빈 출력

## 잔여 위험과 후속 작업

### 잔여 위험

- `TEST_DATABASE_URL`이 없어 PostgreSQL 연동 5건(file-store seed,
  migration up/down/up, adapter, concurrency/failure injection,
  different-owner media concurrency)은 명시적으로 skip됐다. memory와
  real workerd D1의 동일 invariant는 통과했지만 실제 PostgreSQL 실행을
  대체하지 않는다.
- `TEST_S3_ENDPOINT`, bucket, credential이 없어 MinIO/S3 endpoint
  integration 1건은 skip됐다. command-client와 native R2 contract는
  통과했다.
- 브라우저는 downstream analyzer와 usage submit 결과를 알 수 없다.
  `Device approved`는 device authorization 완료만 의미하며 최종 제출
  결과는 terminal에서 확인해야 한다.
- production Sites deploy와 remote D1 migration은 이번 task 범위에서
  수행하지 않았다. 실제 배포 전 migration 3 artifact와 기존 binding을
  다시 확인해야 한다.

### 후속 작업 후보

- [#61 공통 헤더·Profile 진입점 및 관리 화면 레이아웃 정렬](https://github.com/postmelee/codex-usage-profile/issues/61)
  — 계정 메뉴의 Profile 진입점, 공통 전역 헤더와 Profile/Settings/Approve
  화면 shell을 별도 task에서 정렬한다.

## 작업지시자 승인 요청

- 작업지시자가 2026-07-31 같은 스레드에서 최종 보고서와 PR 게시 진행을
  명시 승인했다. 이 보고서와 오늘할일 완료 처리를 commit한 뒤
  `publish/task59`를 push하고 `devel` 대상 Open PR을 게시한다.
