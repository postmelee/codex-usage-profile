# Task M100 #59 구현계획서

수행계획서: [`task_m100_59.md`](task_m100_59.md)
GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | optional intent 계약과 durable persistence | CLI caller, challenge schema, D1/Postgres migration | intent 분기·validation·migration/store test |
| 2 | 동일 owner 승인 복구와 보안 경계 | idempotent approval, 최소 응답 serializer | token 단일 발급·owner/expiry·concurrency test |
| 3 | terminal 승인 UI와 intent별 onboarding | UI 상태 모델, copy 안내, 접근성·motion | unit, focused Playwright, build |
| 4 | 문서·통합 회귀와 Sites artifact | CLI 사용자 문서, 전체 검증 증적 | root test/build/E2E, production artifact |
| 4.1 | 승인과 submit 결과 문구 분리 | device-scoped 완료 문구와 회귀 test | helper unit, focused Playwright, build |

## 문서 위치 확인

수행계획서에서 선택한 공식 사용자 문서와 task 산출물 위치를 그대로
사용한다. Stage 1~3은 제품 소스와 단계 보고서만 변경하고, Stage 4에서
공식 CLI 사용자 문서를 갱신한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| CLI login/submit 상세 | `docs/` | `docs/cli-submit.md` | OK | Stage 4에서 intent별 승인 후 행동 설명 |
| npm package 요약 | CLI package root | `packages/codex-usage-profile-cli/README.md` | OK | Stage 4에서 package 사용자 안내 |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_59*.md` | OK | 승인된 범위와 단계 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_59_stage{N}.md` | OK | 각 Stage 소스와 함께 커밋 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_59_report.md` | OK | 모든 Stage 승인 후 별도 작성 |

root `README.md`, `mydocs/manual/`, API/architecture 문서와
`.openai/hosting.json`은 변경하지 않는다. 구현 중 이 경계를 바꿔야 하면
해당 Stage를 중단하고 계획 변경 승인을 받는다.

## Stage 1 — optional intent 계약과 durable persistence

### 산출물

신규:

- `db/migrations/0003_cli_login_intent.sql`
- `src/profile-backend/postgres/migrations/0002_cli_login_intent.up.sql`
- `src/profile-backend/postgres/migrations/0002_cli_login_intent.down.sql`
- `mydocs/working/task_m100_59_stage1.md`

수정:

- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/src/device-login.js`
- `packages/codex-usage-profile-cli/src/service-client.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `packages/codex-usage-profile-cli/test/device-login.test.js`
- `packages/codex-usage-profile-cli/test/service-client.test.js`
- `src/profile-backend/cli-login.js`
- `src/profile-backend/http.js`
- `src/profile-backend/d1/migrate.js`
- `src/profile-backend/d1/store.js`
- `src/profile-backend/postgres/store.js`
- `src/profile-backend/__tests__/cli-login.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/d1-migrate.test.js`
- `src/profile-backend/__tests__/d1-store.test.js`
- `src/profile-backend/__tests__/postgres-migrate.test.js`
- `src/profile-backend/__tests__/postgres-store.test.js`

### 변경 내용

- `loginWithDeviceCode`가 `intent` option을 받고 start 요청에만 전달하도록
  한다. poll, credential과 usage document에는 intent를 넣지 않는다.
- `runLogin`은 `login`, credential이 없어 device flow를 시작하는
  `runSubmit`은 `submit`을 전달한다. 기존 credential이 있는 submit은
  login/start 요청 자체를 만들지 않는다.
- service client가 `login | submit`만 직렬화하고 미지정 값은 body에서
  생략한다. CLI 내부의 잘못된 값도 request 전 validation error로 막는다.
- backend에 frozen intent enum과 `normalizeCliLoginIntent`를 두고
  `undefined | null → null`, `login | submit → same value`로 정규화하며
  나머지는 `validation_failed`로 거부한다.
- challenge record와 start/device serializer에 normalized intent를
  추가한다. intent가 없는 기존 CLI 응답은 `null`로 호환한다.
- D1 migration 3은 `cli_login_challenges.intent` nullable column과
  `NULL | login | submit` CHECK를 추가한다. migration registry의 version,
  name과 expected applied versions를 갱신한다.
- Postgres migration 2는 동일 column/CHECK를 up에서 추가하고 down에서
  constraint와 column을 제거한다. migration 1은 immutable bootstrap
  history로 유지한다.
- D1/Postgres store column mapping을 확장하고 기존 memory/file record
  round-trip은 nullable field를 그대로 보존한다.
- Stage 1에서는 approval 상태 복구와 UI를 변경하지 않는다.

### 검증

```bash
node --test \
  packages/codex-usage-profile-cli/test/cli.test.js \
  packages/codex-usage-profile-cli/test/device-login.test.js \
  packages/codex-usage-profile-cli/test/service-client.test.js
node --test \
  src/profile-backend/__tests__/cli-login.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-backend/__tests__/d1-migrate.test.js \
  src/profile-backend/__tests__/d1-store.test.js \
  src/profile-backend/__tests__/postgres-migrate.test.js \
  src/profile-backend/__tests__/postgres-store.test.js
git diff --check
```

Postgres integration test는 `TEST_DATABASE_URL`이 없으면 기존 정책대로 skip
상태와 사유를 Stage 보고서에 기록한다. D1 migration은 real workerd
fixture에서 `[1, 2, 3]` 최초 적용과 재실행 no-op를 확인한다.

### 커밋

```text
Task #59 Stage 1: CLI intent 계약과 저장소 migration 추가
```

## Stage 2 — 동일 owner 승인 복구와 보안 경계

### 산출물

신규:

- `mydocs/working/task_m100_59_stage2.md`

수정:

- `src/profile-backend/cli-login.js`
- `src/profile-backend/http.js`
- `src/profile-backend/store-contract.js`
- `src/profile-backend/__tests__/cli-login.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `src/profile-backend/__tests__/d1-concurrency.test.js`
- `src/profile-backend/__tests__/postgres-concurrency.test.js`

### 변경 내용

- approval 진입 시 현재 authenticated owner id를 먼저 정규화하고,
  challenge expiry를 상태 복구보다 먼저 검사한다.
- pending challenge는 기존 `atomic.approveCliLogin`만 사용한다. atomic
  failure가 승인 race일 가능성이 있을 때 challenge를 한 번 다시 읽고,
  같은 owner의 `approved` 또는 `exchanged` 상태일 때만 성공으로 복구한다.
- 최초 조회가 이미 `approved`/`exchanged`이면 challenge owner와 현재
  owner가 정확히 같을 때 저장된 완료 상태를 반환한다.
- 다른 owner, expired/not-found/invalid code와 허용되지 않은 상태는 기존
  error code·HTTP fail-closed 경계를 유지한다.
- idempotent approval 경로는 token service,
  `atomic.exchangeCliLogin`과 token row write를 절대 호출하지 않는다.
- `/api/auth/device/authorize`에 전용 최소 serializer를 적용해
  `status`, `intent`, `approvedAt`, `exchangedAt`만 반환한다. owner id,
  token id/token, device digest와 redirect metadata는 제외한다.
- legacy `/api/cli/login/*`와 poll의 token-once 계약은 호환을 위해
  유지한다. device authorize의 narrowed response만 UI 계약으로 고정한다.
- store contract의 approval invariant 설명을 “pending atomic transition +
  same-owner completed replay” 경계와 token non-issuance가 드러나게 갱신한다.
- memory, D1과 Postgres concurrency test에서 fast double approval,
  same-owner replay, other-owner mismatch와 token row count를 확인한다.

### 검증

```bash
node --test \
  src/profile-backend/__tests__/cli-login.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-backend/__tests__/security.test.js \
  src/profile-backend/__tests__/d1-concurrency.test.js \
  src/profile-backend/__tests__/postgres-concurrency.test.js
git diff --check
```

Postgres concurrency test가 environment 부재로 skip되면 D1 real-workerd와
memory store의 동일 invariant 통과를 필수 증적으로 남긴다. 실제
`TEST_DATABASE_URL`이 준비되어 있으면 동일 Stage에서 Postgres 경로도
실행한다.

### 커밋

```text
Task #59 Stage 2: device 승인 재시도 보안 경계 강화
```

## Stage 3 — terminal 승인 UI와 intent별 onboarding

### 산출물

신규:

- `src/profile-ui/deviceApproval.js`
- `src/profile-ui/__tests__/deviceApproval.test.js`
- `mydocs/working/task_m100_59_stage3.md`

수정:

- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/DeviceApprovalPage.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`

### 변경 내용

- pure helper에 approval status, retryable/terminal error 분류,
  normalized intent별 문구와 후속 submit command 생성을 둔다.
- retryable error는 network status `0`, `429`, `5xx`로 제한하고 같은
  code의 manual retry를 허용한다. terminal error는 approve button을
  잠그되 input 변경 시 error를 지우고 idle로 돌아간다.
- form submit 직후 `approving`으로 전환해 button을 disable하고
  `Approving…`을 표시한다. event와 state guard로 빠른 double click에서도
  profile API authorize call을 한 번만 보낸다.
- 승인 응답의 `approved`/`exchanged`를 모두 terminal success로 처리한다.
  button은 existing `CodexCheckCircleIcon`과 `Approved`로 교체하고
  button/input을 disabled로 유지한다.
- `submit` intent에는 현재 CLI 프로세스로 돌아가면 usage submit이
  계속된다고 안내한다. `login` intent에는 후속 submit 명령과 explicit
  copy button을 제공한다. null intent는 특정 명령 없이 terminal 복귀를
  안내한다.
- production origin은 기본 submit 명령을, current `location.origin`이
  다르면 고정 command에 `--server <normalized-origin>`을 붙인다. query,
  hash, response field와 user code는 command에 포함하지 않는다.
- copy는 user click에서만 `navigator.clipboard.writeText`를 호출하고
  성공/실패 상태를 live text로 전달한다. 자동 clipboard, command 실행,
  storage write와 navigation은 하지 않는다.
- success 영역의 Home/profile은 same-origin anchor로만 제공하며
  auto redirect를 추가하지 않는다.
- form 또는 status region에 `aria-busy`, polite live status와 명시적
  error semantics를 적용한다. success는 icon+text로 색상 외 의미를
  제공한다.
- 약 240ms `cubic-bezier(0.2, 0, 0, 1)`의 작은 success content 전환만
  추가하고 layout 이동/bounce를 금지한다. reduced-motion에서는 해당
  animation/transition을 제거한다.
- Playwright에서 desktop/mobile/reduced-motion, keyboard, double click,
  retryable/terminal error, intent 3종, local origin, clipboard,
  no redirect/storage를 검증한다.

### 검증

```bash
node --test \
  src/profile-api/__tests__/client.test.js \
  src/profile-ui/__tests__/deviceApproval.test.js
npm run build
npm run test:e2e -- --grep "device approval"
git diff --check
```

focused Playwright test에는 desktop과 mobile viewport, reduced-motion
emulation과 keyboard focus 경로를 포함한다. screenshot은 상태와 layout
검증에 필요한 경우 test output으로만 생성하며 repository asset으로
추가하지 않는다.

### 커밋

```text
Task #59 Stage 3: device 승인 완료 UI와 intent 안내 구현
```

## Stage 4 — 문서·통합 회귀와 Sites artifact

### 산출물

신규:

- `mydocs/working/task_m100_59_stage4.md`

수정:

- `docs/cli-submit.md`
- `packages/codex-usage-profile-cli/README.md`

### 변경 내용

- 공식 CLI 문서의 Browser 승인 흐름에 `submit`은 같은 process에서
  자동 계속되고, `login`은 다음 submit 명령을 제공하며, no-intent는
  terminal 복귀만 안내하는 차이를 기록한다.
- local/non-default service에서 copy command가 `--server`를 유지하고
  브라우저가 자동 redirect/clipboard/command 실행을 하지 않는 경계를
  설명한다.
- package README에는 npm 사용자가 첫 device 승인 직후 행동을 오해하지
  않을 정도의 짧은 요약만 추가하고 상세는 기존 공식 문서 링크로 유지한다.
- full root test로 CLI/backend/API/UI 회귀를 확인한다.
- standard build와 production Sites build/artifact verifier를 실행한다.
- 전체 Playwright에서 Home, #55 loading card, profile, settings와 device
  flow 회귀를 확인한다.
- `.openai/hosting.json`, account usage, renderer/card media, R2/publication
  소스에 변경이 없고 production deploy/API 호출이 없음을 diff로 재확인한다.

### 검증

```bash
npm test
npm run build
npm run build:production
npm run verify:sites-production
npm run test:e2e
git diff --check
git diff origin/devel -- .openai/hosting.json
```

마지막 hosting manifest diff는 빈 출력이어야 한다. 전체 검증의 skip,
platform 제약 또는 외부 dependency 한계가 있으면 Stage 보고서에 명시하고
실패를 통과로 기록하지 않는다.

### 커밋

```text
Task #59 Stage 4: CLI 승인 안내 문서와 통합 검증 완료
```

## Stage 4.1 — 승인과 submit 결과 문구 분리

### 산출물

신규:

- `mydocs/working/task_m100_59_stage4_1.md`

수정:

- `src/profile-ui/deviceApproval.js`
- `src/profile-ui/DeviceApprovalPage.jsx`
- `src/profile-ui/__tests__/deviceApproval.test.js`
- `tests/profile-ui.spec.js`
- `docs/cli-submit.md`
- `packages/codex-usage-profile-cli/README.md`

### 변경 내용

- terminal success button을 `Device approved`로 바꿔 device 인증 완료와
  usage submit 성공을 구분한다.
- `submit` intent는 authorization 완료 뒤 terminal로 돌아가 흐름을
  계속하고 최종 제출 결과를 terminal에서 확인하라고 안내한다.
- `login`과 no-intent도 `Authorization is complete`로 device-scoped
  상태를 명시하되 기존 command와 terminal 복귀 의미는 유지한다.
- 브라우저가 downstream analyzer 또는 submit 결과를 추론하거나 성공으로
  표시하지 않는다.
- query의 `user_code` 자동 채움, 수동 approve, no redirect/clipboard/
  command execution과 credential 비노출 경계는 변경하지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/deviceApproval.test.js
npm run build
npm run test:e2e -- --grep "device approval"
git diff --check
git diff 7b3e8ec -- .openai/hosting.json
```

### 커밋

```text
Task #59 [Stage 4.1]: device 승인과 submit 결과 문구 분리
```

## 검증

- 각 Stage 검증 명령은 `task-stage-report` 절차로 단계 보고서를 작성하기
  전에 실행한다.
- 실패한 검증은 단계 완료로 처리하거나 커밋하지 않고 같은 Stage에서
  원인을 해결한다.
- Postgres environment 부재처럼 기존 test의 명시적 skip은 실행 결과와
  대체 검증을 보고서에 남긴다.
- Stage 1 migration은 기존 row null 호환과 fresh/up rerun을 모두 확인한다.
- Stage 2는 response shape뿐 아니라 token row count와 atomic exchange
  호출 부재를 확인한다.
- Stage 3은 시각적 결과 외 authorize request count, disabled semantics,
  live/busy attributes와 storage/navigation side effect 부재를 확인한다.
- Stage 4는 full root suite와 Sites production artifact까지 검증하지만
  production deploy나 database migration은 수행하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는
  구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계별 소스와 `mydocs/working/task_m100_59_stage{N}.md`를 같은 Stage
  commit에 묶는다.
- Stage 보고서가 검증 결과를 반영하기 전에 commit하지 않는다.
- 계획서에 고정한 다음 commit message를 사용한다.

```text
Task #59 Stage 1: CLI intent 계약과 저장소 migration 추가
Task #59 Stage 2: device 승인 재시도 보안 경계 강화
Task #59 Stage 3: device 승인 완료 UI와 intent 안내 구현
Task #59 Stage 4: CLI 승인 안내 문서와 통합 검증 완료
Task #59 [Stage 4.1]: device 승인과 submit 결과 문구 분리
```

## 단계 의존성

- Stage 1은 intent의 end-to-end data shape와 durable schema를 확정한다.
- Stage 2는 Stage 1의 stored intent와 migration이 승인된 뒤 approval
  idempotency와 최소 응답 경계를 구현한다.
- Stage 3은 Stage 2의 승인 응답과 error semantics가 승인된 뒤 UI를
  연결한다.
- Stage 4는 Stage 1~3 검증과 단계 보고서 승인이 모두 끝난 뒤 문서와
  전체 회귀를 확정한다.
- Stage 4.1은 local QA에서 확인된 device 승인과 downstream submit 결과의
  문구 혼동만 보정하고 Stage 4 artifact 경계를 유지한다.
- 각 Stage 완료보고서 승인 전에는 다음 Stage 소스를 수정하지 않는다.
- Stage 4.1 승인 후에만 최종 결과보고서와 PR 게시 절차로 이동한다.

## 위험과 대응

- **migration/code 배포 순서**: nullable forward migration과 old-row null
  fallback을 사용하고 production deploy는 별도 gate로 남긴다.
- **same-owner replay가 exchange로 확장되는 위험**: approval recovery는
  challenge read만 수행하고 token service와 atomic exchange를 호출하지
  않는 test seam을 둔다.
- **동시 요청의 오류 오인**: atomic loser는 한 번만 re-read하며 owner와
  completed status가 모두 맞을 때만 성공으로 바꾼다.
- **narrow serializer의 legacy 회귀**: device authorize 전용 response만
  축소하고 legacy start/poll/exchange serializer는 유지한다.
- **UI stale state**: request 중 code mutation을 잠그고 terminal error에서
  code 변경 시만 state를 초기화한다. approved에서는 component lifetime
  동안 terminal success를 유지한다.
- **origin command injection**: `location.origin`과 고정 token만 사용하고
  자동 실행하지 않으며 helper unit test로 query/hash 배제를 검증한다.
- **motion/accessibility 회귀**: icon+label+live semantics를 기본 결과로
  두고 motion은 비필수 240ms decoration으로 제한한다.
- **범위 확장**: Home/#55, account usage, R2/publication, hosting manifest와
  production deploy는 변경하지 않고 regression 대상으로만 검사한다.

## 승인 요청 사항

- Stage 1에서 CLI caller부터 D1/Postgres nullable migration까지 optional
  intent 계약을 먼저 확정하는 순서
- Stage 2에서 same-owner completed replay와 concurrent loser recovery를
  token exchange와 분리하고 authorize response를 최소화하는 순서
- Stage 3에서 pure UI helper, terminal state, explicit copy,
  접근성/reduced-motion을 묶어 focused Playwright로 검증하는 순서
- Stage 4에서 공식 CLI 문서 2개만 갱신하고 full test/build/E2E 및 Sites
  artifact 검증으로 마무리하는 순서
- 각 Stage의 산출물, 검증 명령, commit message와 Stage별 승인 gate
- production database migration, Sites deploy/access/environment/secret을
  계속 제외하는 범위
