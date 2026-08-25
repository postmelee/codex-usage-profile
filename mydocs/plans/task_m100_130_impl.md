# Task #130 구현계획서 — 미제출 계정 Home을 운영자 카드로 표시

수행계획서: [`task_m100_130.md`](task_m100_130.md)
GitHub Issue: [#130](https://github.com/postmelee/codex-usage-profile/issues/130)
마일스톤: M100

## 승인된 결정과 구현 해석

- authenticated profile이 ready이고 `usage`가 없으면 정적 sample이 아니라 locale-aware operator
  stable card를 최종 target으로 선택한다.
- no-usage operator image가 실패해 transition의 정적 sample fallback이 보이더라도 현재 로그인
  계정 identity를 overlay하지 않는다.
- 사용량이 존재하지만 owner preview가 실패한 기존 personalized sample fallback은 유지한다.
- no-usage 상태의 disabled `먼저 사용량을 제출하세요` action, anonymous operator, submitted owner,
  auth/profile loading Skeleton과 logout identity reset은 변경하지 않는다.
- backend/API, card renderer, 운영자 endpoint/handle, static sample asset, public docs,
  `.openai/hosting.json`과 production 배포는 변경하지 않는다.
- 기존 Sites capability path에서 구현·headless E2E·production artifact 검증까지만 수행한다. Issue의
  승인된 제외 범위가 Sites 기본 hosting handoff보다 우선하므로 deploy 또는 Site remote mutation은
  수행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | no-usage operator target 계약 | `homeCardTarget.js`, resolver 단위 테스트 | target priority·immutability·error fallback |
| 2 | Home fallback identity와 사용자 상태 회귀 | `HomePage.jsx`, Home Playwright E2E | operator 정상/실패·overlay 부재·owner 회귀 |
| 3 | Sites artifact와 통합 회귀 | 전체 test/build/verifier, 단계 보고 | Node·Playwright·Sites production artifact |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_130_impl.md` | OK | 승인된 Stage 산출물·검증·커밋 경계 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_130_stage{1..3}.md` | OK | 각 Stage source와 함께 commit |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_130_report.md` | OK | 모든 Stage 승인 뒤 작성 |
| README·공식 제품 문서 | 변경 없음 | 해당 없음 | OK | 사용자 명령·URL·API 계약 변경 없음 |

## 공통 상태 계약

### Target priority

| auth/profile 조건 | 최종 target | identity overlay | action |
|---|---|---|---|
| auth loading | unresolved/Skeleton | 없음 | account 확인 상태 |
| anonymous 또는 auth unavailable | operator | 없음 | login 또는 unavailable 상태 |
| authenticated + profile idle/loading | unresolved/Skeleton | 없음 | card loading |
| authenticated + profile ready + no usage | operator | 없음 | submit first disabled |
| authenticated + profile ready + usage + owner preview URL | owner | 없음 | publish/share 상태별 action |
| authenticated + profile error 또는 usage owner preview URL 없음 | sample | 기존 personalized fallback | 기존 error/action 계약 |

### Image failure contract

- operator와 owner target은 기존 `acquireCardImageResource` preload/decode 뒤에만 reveal한다.
- target image 실패는 기존 `homeCardTransition`이 정적 sample source로 fail closed한다.
- no-usage 여부는 visible source kind만으로 판단하지 않는다. operator 실패 뒤 visible source가 sample이
  되므로 `hasUsage`를 personalized overlay gate에 포함한다.
- submitted owner failure는 `hasUsage === true`, authenticated/profile ready, visible sample과 ready 상태가
  모두 맞을 때만 기존 overlay를 표시한다.
- target generation, resource scope, object URL release와 retry 동작은 변경하지 않는다.

## Stage 1 — no-usage operator target 계약

### 진입 조건

- 수행계획서와 본 구현계획서의 3개 Stage, 상태 우선순위와 제외 범위가 승인됐다.
- `local/task130` worktree가 clean이고 `origin/devel` 기준 task-start commit만 포함한다.

### 산출물

수정:

- `src/profile-ui/homeCardTarget.js`
- `src/profile-ui/__tests__/homeCardTarget.test.js`
- `mydocs/orders/20260824.md`

신규:

- `mydocs/working/task_m100_130_stage1.md`

### 변경 내용

1. `resolveHomeCardTarget`의 authenticated bootstrap unresolved gate는 그대로 유지한다.
2. `profileStatus === "ready" && hasUsage === false`를 명시적인 operator target으로 반환한다.
3. ready usage + valid owner preview는 owner target을 유지한다.
4. profile error, ready usage + owner preview 누락 등 나머지 failure outcome은 기존 sample target을
   유지한다.
5. 기존 no-usage/sample 복합 단위 테스트를 no-usage operator와 failure sample 계약으로 분리한다.
6. 반환 target/source가 frozen이고 입력 source가 normalization되는 기존 계약을 함께 검증한다.
7. 집중 검증이 통과하면 `task-stage-report`로 Stage 1 보고서·오늘할일·source를 한 commit으로 묶고
   Stage 2 승인을 요청한다.

### 검증

```bash
node --test src/profile-ui/__tests__/homeCardTarget.test.js
node --test src/profile-ui/__tests__/homeCardTransition.test.js
git diff --check
```

### 완료·중단 조건

- 완료: authenticated ready no-usage는 operator, submitted valid preview는 owner, 오류 outcome은 sample로
  단위 계약이 분리되고 모든 집중 테스트가 통과한다.
- 중단: no-usage operator 선택에 `homeCardTransition` 구조 변경이 필요하거나 #95의 unresolved gate가
  달라지면 구현계획서를 먼저 보정하고 승인받는다.

### 커밋

```text
Task #130 Stage 1: 미제출 operator target 계약 확정
```

## Stage 2 — Home fallback identity와 사용자 상태 회귀

### 진입 조건

- Stage 1 보고서와 operator target resolver 계약이 승인됐다.

### 산출물

수정:

- `src/profile-ui/HomePage.jsx`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260824.md`

신규:

- `mydocs/working/task_m100_130_stage2.md`

### 변경 내용

1. `showPersonalizedSample`에 `hasUsage === true` gate를 추가한다.
2. `HomeSampleIdentity` component와 CSS는 삭제하지 않는다. submitted owner preview 실패 fallback에서
   계속 사용하기 때문이다.
3. 기존 no-usage E2E를 다음 관찰 가능 계약으로 보정한다.
   - card source kind가 `operator`이고 source URL이 locale-aware `/u/postmelee/card.png`다.
   - `.home-card-sample-identity`가 없고 현재 owner avatar/name/login이 card media에 overlay되지 않는다.
   - `/api/profile/card.png` owner preview를 요청하지 않는다.
   - `Submit usage first`는 disabled이고 Publish·Share는 없다.
4. Task #130 no-usage operator 404/503 fallback E2E를 추가하거나 parameterize한다.
   - visible source/status는 `sample`/`fallback`이다.
   - static sample image는 decode 뒤 표시된다.
   - personalized identity overlay는 없다.
   - submit-first action은 계속 disabled다.
5. 기존 submitted owner card 404/503와 decode failure E2E가 personalized sample overlay를 계속
   요구하도록 유지한다.
6. anonymous operator, logout reset, auth/profile initial Skeleton과 card source data attribute 회귀를
   집중 grep에 포함한다.
7. 변경 후 개발 server를 별도 browser UI로 열거나 screenshot을 새로 생성하지 않는다. 승인된
   headless Playwright 시나리오로 사용자 상태를 검증하고, 별도 수동 browser QA가 필요해지면 먼저
   범위 승인을 요청한다.
8. 집중 검증이 통과하면 `task-stage-report`로 Stage 2 보고서·오늘할일·source를 한 commit으로 묶고
   Stage 3 승인을 요청한다.

### 검증

```bash
node --test src/profile-ui/__tests__/homeCardTarget.test.js src/profile-ui/__tests__/homeCardTransition.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #130|Home keeps card actions disabled until usage is submitted|uses the personalized sample|decodes the anonymous operator card|logout"
git diff --check
```

### 완료·중단 조건

- 완료: no-usage 정상·operator failure 모두 현재 계정 overlay 없이 올바른 source/action을 보이고,
  submitted owner fallback과 anonymous/logout 회귀가 통과한다.
- 중단: overlay gate만으로 no-usage operator fallback을 분리할 수 없거나 owner failure UX가 바뀌면
  상태 모델과 계획을 먼저 보정해 승인받는다.

### 커밋

```text
Task #130 Stage 2: 미제출 Home fallback identity 보정
```

## Stage 3 — Sites artifact와 통합 회귀

### 진입 조건

- Stage 2 보고서와 Home 정상·실패 E2E 결과가 승인됐다.
- Stage 1~2 source가 각 보고서와 commit되어 working tree가 clean하다.

### 산출물

수정:

- `mydocs/orders/20260824.md`

신규:

- `mydocs/working/task_m100_130_stage3.md`

제품 source, public docs, asset와 hosting manifest는 Stage 3에서 수정하지 않는다. 검증 실패를
해결하기 위한 source 변경이 필요하면 Stage 2 보정 또는 구현계획 변경 승인을 먼저 받는다.

### 실행 순서

1. 전체 Node test를 순차 concurrency로 실행한다.
2. 전체 Playwright E2E로 Home 외 Profile, Settings, Share Studio와 locale/motion 회귀를 확인한다.
3. production Sites full-stack artifact를 build하고 full-stack·production verifier를 실행한다.
4. task diff에서 hosting manifest, static sample asset, backend/API와 공식 docs가 변경되지 않았는지
   path-level로 확인한다.
5. Issue 수용 기준과 Stage 1~2 결과를 Stage 3 보고서에 정리한다.
6. `task-stage-report`로 검증 보고서·오늘할일을 commit하고 최종 보고 단계 승인을 요청한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --exit-code origin/devel...HEAD -- .openai/hosting.json public/assets/codex-card-sample.png README.md docs src/profile-backend src/profile-card
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: 전체 test/build/verifier가 통과하고 task diff가 승인된 frontend source와 내부 task 문서에만
  한정된다.
- 중단: 전체 회귀, Worker artifact 또는 제외 path diff가 실패하면 Stage를 완료 처리하지 않고
  원인과 계획 보정 필요 여부를 보고한다.

### 커밋

```text
Task #130 Stage 3: Sites artifact와 통합 회귀 완료
```

## 검증

- 각 Stage 검증은 단계 보고서 작성 전에 실행하고 실패한 Stage는 완료 처리하지 않는다.
- Playwright는 source kind/URL, status, overlay 부재와 action 상태를 함께 판정한다. 최종 screenshot만
  근거로 사용하지 않는다.
- no-usage owner preview request count와 card media markup에 authenticated owner identity가 없는지
  확인한다.
- submitted owner failure personalized overlay와 anonymous operator는 positive regression assertion을
  유지한다.
- 계획 밖 source, public docs, asset, backend 또는 hosting 변경이 필요하면 구현계획서를 먼저
  갱신하고 승인받는다.
- production deploy, access/environment 변경과 remote Site mutation은 실행하지 않는다.

## 커밋

- Stage source, `mydocs/working/task_m100_130_stage{N}.md`와 오늘할일 갱신을 해당 Stage commit으로
  함께 묶는다.
- Stage 완료보고서의 실행 명령, 결과와 잔여 위험을 기록한 뒤 다음 Stage 승인을 요청한다.
- 모든 Stage 승인 뒤 최종 보고와 PR은 `task-final-report` 절차를 별도로 적용한다.

## 단계 의존성

- Stage 2는 Stage 1 resolver 계약과 보고서 승인 뒤 진행한다.
- Stage 3은 Stage 2 Home source/overlay/action E2E와 보고서 승인 뒤 진행한다.
- 최종 보고서는 Stage 3 전체 test/build/verifier와 제외 path 검증 승인 뒤 작성한다.

## 위험과 대응

- **operator target과 fallback source 혼동**: operator 실패 뒤 visible source가 sample이므로 target
  종류만으로 overlay를 판단하지 않고 `hasUsage`를 함께 gate한다.
- **submitted owner fallback 회귀**: overlay component/CSS를 제거하지 않고 기존 owner 404/503·decode
  failure assertion을 positive 회귀로 유지한다.
- **초기 reveal 회귀**: resolver의 unresolved 조건과 transition generation은 수정하지 않고 #95 관련
  E2E를 Stage 2 집중·Stage 3 전체 suite에서 확인한다.
- **no-usage owner request**: `ownerPreviewUrl`의 기존 `hasUsage` gate를 유지하고 E2E request count로
  `/api/profile/card.png` 무요청을 검증한다.
- **운영자 card 장애**: operator endpoint failure는 static sample로 fail closed하며, 이때 현재 계정
  identity를 노출하지 않는다.
- **Sites 검증과 배포 혼동**: artifact build/verifier는 실행하되 `.openai/hosting.json`과 remote Site는
  변경하지 않고 production deploy는 Issue 제외 범위로 유지한다.
- **병렬 작업 충돌**: 모든 변경과 commit은 `.worktrees/task130`의 `local/task130`에만 남기고 메인
  worktree와 `local/task90`을 건드리지 않는다.

## 승인 요청 사항

- 위 3개 Stage 분할, target priority, `hasUsage` overlay gate와 owner fallback 보존을 승인해 주세요.
- Stage 1은 resolver와 단위 테스트만 변경하고 보고 후 Stage 2 승인을 받는 경계로 진행합니다.
- Stage 2는 Home overlay 조건과 headless E2E만 변경하며 CSS/asset/renderer는 건드리지 않습니다.
- Stage 3은 전체 test/build/verifier와 무변경 path 확인만 수행하고 production deploy는 하지 않습니다.
- 각 Stage source와 완료보고서를 규정된 commit으로 묶고 다음 Stage 전 승인을 다시 받습니다.

승인되면 Stage 1 resolver·단위 테스트 구현과 단계 보고서 작성부터 진행한다.
