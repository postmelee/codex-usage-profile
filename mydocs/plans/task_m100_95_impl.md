# Task #95 구현계획서 — 인증·화면 복귀 시 Home 카드 단일 reveal 보장

- 수행계획서: [`task_m100_95.md`](task_m100_95.md)
- GitHub Issue: [#95](https://github.com/postmelee/codex-usage-profile/issues/95)
- 마일스톤: M100 — v1.0 MVP
- 상태: 구현 승인 대기

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 상태 이력 재현과 단일 reveal 계약 확정 | Home 상태 관찰 fixture, known-failure E2E와 순수 target 계약 | 집중 Chromium·WebKit, transition 단위 기준선 |
| 2 | 최종 target authority와 단조 presentation 구현 | unresolved/selected resolver, current target provenance와 표시 준비 판정 | target·transition 단위 테스트, owner/anonymous/fallback E2E |
| 3 | 복귀·logout·cache·revision 회귀 보강 | full navigation·scope change·cold/warm·lease 회귀 | desktop/mobile Chromium·WebKit, 상태 이력·DOM commit 검증 |
| 4 | 통합 검증과 실제 모바일 Gate | 전체 검증, Sites 산출물, Safari·Chrome 실측 | unit/E2E/build/verify/smoke, 실제 기기 확인 |

## 상태 모델과 불변식

### Target authority

Home card의 최종 target 선택 상태를 다음 두 종류로 구분한다.

- `unresolved`: auth가 `loading`이거나 authenticated owner의 profile이 `idle/loading`인 상태.
  operator resource를 선로드할 수는 있지만 표시 권한은 없다.
- `selected`: 다음 중 하나가 최종 target으로 확정된 상태.
  - anonymous/unavailable auth → operator
  - authenticated + profile ready + usage + preview URL → owner
  - authenticated + profile ready에서 usage 없음 → sample
  - authenticated + profile error → sample

target resolver는 브라우저·React·storage에 의존하지 않는 순수 함수로 두며, source에는 기존처럼
`kind`와 same-origin `src`만 포함한다. owner identity를 URL, storage 또는 transition 직렬화 값에
추가하지 않는다.

### Transition provenance

기존 transition은 `pending`이 owner 실패 뒤 fallback source로 교체되면 그 fallback이 어떤 원래
target에서 시작됐는지 잃는다. current selected target과 presentation의 정합성을 증명할 수 있도록
원래 요청 target을 immutable provenance로 유지한다.

- `target`: 현재 generation이 최종적으로 만족하려는 selected source
- `pending`: 실제 load 중인 source. owner 실패 뒤 sample fallback일 수 있음
- `visible`: decode 완료 뒤 commit된 source
- fallback ready는 `target === current selected target`이고 `visible === fallbackSource`일 때만
  현재 selection을 만족한 것으로 본다.
- stale generation resolve/reject는 target·visible·resource를 바꾸지 않는다.

정확한 property 이름은 Stage 1 회귀가 증명하는 최소 상태에 맞추되 위 provenance를 잃지 않는다.
기존 frozen state, safe same-origin source와 storage 비접근 계약을 유지한다.

### Presentation readiness

화면은 다음 조건을 모두 만족할 때만 최초 `ready`를 표시한다.

1. target authority가 `selected`다.
2. transition provenance가 현재 selected target과 일치한다.
3. 해당 target 또는 그 target에서 파생된 fallback이 decode 완료되어 visible이다.
4. auth owner scope가 현재 load/visible resource scope와 충돌하지 않는다.

조건이 만족되기 전에는 동일한 Skeleton geometry와 `aria-busy=true`를 유지한다. React effect가
새 target transition을 시작하기 전의 한 render에서도 current visible과 desired target 불일치를
동기적으로 계산해 중간 card paint를 허용하지 않는다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_95*.md` | OK | 내부 구현 판단과 승인 경계 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_95_stage{N}.md` | OK | 각 Stage 소스·검증과 함께 커밋 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_95_report.md` | OK | 전체 검증과 실제 모바일 Gate 기록 |
| README·공개 문서 | 변경 없음 | 해당 없음 | OK | 사용자 흐름·API·URL 계약 변경 없음 |

## Stage 1 — 상태 이력 재현과 단일 reveal 계약 확정

### 산출물

신규:

- `mydocs/working/task_m100_95_stage1.md`

수정:

- `src/profile-ui/__tests__/homeCardTransition.test.js`
- `tests/profile-ui.spec.js`

### 변경 내용

- 제품 소스를 바꾸지 않고 authenticated Home mount를 OAuth 복귀와 Profile→Home full navigation의
  공통 초기화 경계로 재현한다.
- operator image는 먼저 resolve하고 owner profile과 owner image는 별도 gate로 지연한다.
  profile 응답 직후 React effect가 owner transition을 시작하기 전후의 `data-card-status`, source
  kind/URL, Skeleton active/opacity와 image `src` commit을 기록한다.
- MutationObserver와 `requestAnimationFrame` sampling을 page 초기 script에서 설치해 매우 짧은
  `loading → ready → loading → ready`, operator paint와 owner DOM commit 횟수를 누락하지 않는다.
- 현재 구현에서 authenticated initial mount가 `ready → loading`으로 후퇴하거나 operator를
  reveal하는 회귀를 known failure로 고정한다. Playwright `test.fail()`은 Stage 1 CI를 통과시키되
  Stage 2 보정 뒤 제거하지 않으면 unexpected pass가 되게 한다.
- anonymous Home은 auth가 확정된 뒤 operator 한 번만 ready가 되는 기준선을 별도 통과 테스트로
  유지한다.
- transition 단위 테스트에 current target provenance가 없는 현재 공백을 실패 계약으로 추가한다.
  제품 소스 수정 없이 표현할 수 없는 순수 helper 계약은 Stage 1 보고서에서 입력·출력 표로
  확정하고 Stage 2에서 구현한다.
- 기존 owner decode, fallback, logout stale completion, Skeleton geometry와 reduced-motion 테스트를
  함께 실행해 회귀 기준선을 기록한다.

### 검증

```bash
node --test src/profile-ui/__tests__/homeCardTransition.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #95|Home card transition keeps the operator card pending|Home card transition keeps a stable skeleton|Home card transition ignores a stale owner image" --workers=1
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #95" --workers=1
git diff --check
```

WebKit binary 또는 실행 환경이 기존 workspace에 없으면 설치하지 않고 Chromium known failure와
실제 모바일 증거를 Stage 1 기준선으로 기록하며, Stage 4 전에 가용한 승인 경로로 보완한다.

### 커밋

```text
Task #95 Stage 1: Home 카드 상태 이력 재현과 계약 고정
```

## Stage 2 — 최종 target authority와 단조 presentation 구현

### 산출물

신규:

- `mydocs/working/task_m100_95_stage2.md`

수정:

- `src/profile-ui/homeCardTransition.js`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/__tests__/homeCardTransition.test.js`
- `tests/profile-ui.spec.js`

Stage 1 결과에서 별도 모듈이 책임 분리를 더 명확히 할 때만 다음 파일을 추가한다.

- `src/profile-ui/homeCardTarget.js`
- `src/profile-ui/__tests__/homeCardTarget.test.js`

### 변경 내용

- auth/profile 입력에서 `unresolved` 또는 immutable selected target을 반환하는 순수 resolver를
  구현한다. helper를 별도 파일로 둘지는 Stage 1의 입력·출력 크기와 기존 transition 응집도를
  기준으로 결정한다.
- transition에 current generation의 원래 target provenance를 보존한다. fallback load가 pending을
  sample로 바꿔도 owner target에서 파생됐음을 유지하고, 다른 selected target의 fallback을
  잘못 ready로 인정하지 않는다.
- current transition이 selected target을 만족하는지 판정하는 순수 helper를 추가한다.
  `READY + visible target`, `FALLBACK + matching target provenance + visible fallback`만 settled로
  인정한다.
- `HomePage`는 auth/profile unresolved, selected target 불일치, pending load와 visible 부재를
  render 시점에 동기적으로 `cardLoading`에 반영한다. profile ready render와 effect 사이에
  operator가 잠깐 ready가 되는 틈을 닫는다.
- operator preload 자체는 제거하지 않아 anonymous 경로의 네트워크 이점을 유지하되 auth가
  확정되기 전에는 Skeleton 아래에서만 준비한다.
- authenticated owner는 owner/sample/error target 확정 뒤 transition을 시작하고 decode 완료 뒤
  한 번만 reveal한다. owner image 실패는 sample fallback decode 전까지 Skeleton을 유지한다.
- logout은 기존 `resetHomeCardTransition`으로 visible owner를 즉시 제거하고 operator target을 새로
  선택한다. stale owner generation과 resource completion은 commit하지 않는다.
- Stage 1 known failure annotation을 제거하고 상태 이력이 `loading → ready`의 단조 수열이며
  owner DOM commit이 한 번임을 검증한다.

### 검증

```bash
node --test src/profile-ui/__tests__/homeCardTransition.test.js
node --test src/profile-ui/__tests__/homeCardTarget.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #95|Home card transition keeps the operator card pending|uses the personalized sample|fails closed when owner image decode rejects|ignores a stale owner image" --workers=1
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #95" --workers=1
git diff --check
```

별도 target test 파일을 만들지 않으면 존재하지 않는 두 번째 Node 명령은 실행 목록에서 제거하고
Stage 2 보고서에 resolver가 transition test에 함께 배치된 근거를 기록한다.

### 커밋

```text
Task #95 Stage 2: Home 카드 최종 target 단일 reveal 보정
```

## Stage 3 — 복귀·logout·cache·revision 회귀 보강

### 산출물

신규:

- `mydocs/working/task_m100_95_stage3.md`

수정:

- `tests/profile-ui.spec.js`
- Stage 3 회귀에서 범위 내 결함이 재현될 때만 `src/profile-ui/HomePage.jsx`
- owner scope invalidation 책임이 root auth state에 있음을 재현한 경우에만 `src/App.jsx`
- 해당 source 변경 시 관련 `src/profile-ui/__tests__/*.test.js`

### 변경 내용

- OAuth callback 뒤 Home mount와 동일한 authenticated 초기화 순서를 query-preserving Home URL로
  검증한다. 실제 provider redirect를 자동화하지 않고 `/api/auth/me`·profile·image 응답 경계를
  통제한다.
- `/?view=profile`에서 brand link를 눌러 `/`로 full navigation한 뒤 같은 단일 reveal 상태 이력을
  검증한다. SPA router를 추가하지 않는다.
- reload/cold path와 같은 tab에서 browser cache가 warm한 path 모두 중간 ready 후퇴 없이 최종
  target을 한 번만 reveal하는지 확인한다.
- logout 중 owner image completion이 늦게 도착해도 owner source·identity·Blob이 Home DOM에
  재등장하지 않고 operator가 loading→ready로 reset되는지 확인한다.
- 동일 owner의 preview revision 변경은 현재 refresh·resource reuse 의미를 유지하며, 다른 owner
  scope나 anonymous 전환은 stale visible/resource를 재사용하지 않는다.
- resource acquisition/release와 object URL revoke가 기존 bounded cache·lease 계약을 만족하는지
  기존 hook fixture와 Home surface를 함께 검증한다.
- desktop/mobile Chromium과 WebKit에서 status history, source history와 DOM commit 횟수를 같은
  assertion으로 실행한다.
- Stage 2 설계만으로 모든 검증이 통과하면 제품 소스를 추가 수정하지 않고 E2E·단계 보고서만
  커밋한다. 위에 명시되지 않은 구조 변경이 필요하면 먼저 구현계획 변경 승인을 요청한다.

### 검증

```bash
node --test src/profile-ui/__tests__/homeCardTransition.test.js src/profile-ui/__tests__/cardImageReadiness.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #95|Home card transition ignores a stale owner image|card image resource cache" --workers=1
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #95" --workers=1
git diff --check
```

### 커밋

```text
Task #95 Stage 3: Home 복귀와 카드 lifecycle 회귀 보강
```

## Stage 4 — 통합 검증과 실제 모바일 Gate

### 산출물

신규:

- `mydocs/working/task_m100_95_stage4.md`

수정:

- 검증 중 재현된 Task #95 범위의 최소 보정 파일
- 단계 상태를 기록할 `mydocs/orders/20260812.md`

### 변경 내용

- 전체 Node·Playwright와 production Sites build·artifact·local full-stack smoke를 실행한다.
- Chromium과 가용한 WebKit에서 Task #95 전체 상태 이력 회귀를 재실행한다.
- 로컬 또는 승인된 owner-only 배포 URL과 다음 실제 모바일 체크리스트를 제공한다.
  1. 로그아웃 Home → GitHub 로그인 → Home 복귀
  2. Profile → topbar brand → Home 복귀
  3. Home reload cold/warm 반복
  4. logout 뒤 stale owner 카드 비노출
- 실제 Safari·Chrome에서 Skeleton이 중단되지 않고 최종 카드가 한 번만 나타나는지 작업지시자
  확인을 받는다.
- 실제 기기에서 새 결함이 나오면 임의로 Stage 4를 완료하지 않고 Task #95 범위 여부와 보정
  하위 단계를 제안해 승인을 받는다.
- 결과를 #96 시작 조건과 #84 exact release candidate 재검증 handoff에 기록한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #95" --workers=1
git diff --check
git status --short
```

### 커밋

```text
Task #95 Stage 4: 통합 검증과 모바일 단일 reveal 실측 완료
```

## 검증

- 각 Stage 검증은 `task-stage-report` 보고서 작성 전에 실행한다.
- known failure annotation은 Stage 2 보정에서 제거하며 예상하지 않은 pass/fail을 방치하지 않는다.
- status history는 최초 관찰 시점부터 기록하고 최종 상태만 polling하는 검증으로 대체하지 않는다.
- fallback·logout·scope change 검증은 화면 상태뿐 아니라 stale source/owner 문자열과 DOM image
  commit도 확인한다.
- resource lifecycle 검증은 object URL revoke·lease release의 기존 정확성을 유지한다.
- 실제 기기와 자동화가 다르면 실제 기기 결과를 우선해 재현 계약을 보강한다.
- 계획된 파일 밖의 API·backend·router·공개 문서 변경이 필요하면 구현 전 계획 변경 승인을 받는다.
- 각 Stage 완료 뒤 보고서와 source/test를 함께 커밋하고 다음 Stage 승인을 요청한다.

## 커밋

- Stage 1: `Task #95 Stage 1: Home 카드 상태 이력 재현과 계약 고정`
- Stage 2: `Task #95 Stage 2: Home 카드 최종 target 단일 reveal 보정`
- Stage 3: `Task #95 Stage 3: Home 복귀와 카드 lifecycle 회귀 보강`
- Stage 4: `Task #95 Stage 4: 통합 검증과 모바일 단일 reveal 실측 완료`
- 전체 Stage 완료 뒤 `task-final-report`로 최종 보고서·오늘할일·`devel` 대상 PR을 처리한다.

## 단계 의존성

- Stage 1은 승인된 수행계획과 본 구현계획 승인 뒤 시작한다.
- Stage 2는 Stage 1의 실제 상태 이력·target provenance 계약과 단계 보고 승인 뒤 시작한다.
- Stage 3은 Stage 2 단조 transition 구현·집중 검증과 단계 보고 승인 뒤 시작한다.
- Stage 4는 Stage 3 navigation·lifecycle 검증과 단계 보고 승인 뒤 시작한다.
- #96은 #95 실제 모바일 Gate 완료 뒤 시작한다.
- #84 Gate C와 마케팅은 #95·#96 완료 및 exact candidate 재검증 전까지 중단한다.

## 위험과 대응

- **관찰자 설치 전 짧은 paint 누락**: page init script에서 MutationObserver를 설치하고 route gate를
  연 뒤 auth/profile/image 응답을 순서대로 release한다.
- **operator preload 제거로 성능 회귀**: load 선행은 허용하고 presentation authority만 차단한다.
- **fallback provenance 상실**: 원래 selected target과 실제 pending fallback을 별도 immutable
  상태로 유지해 현재 target에서 파생된 fallback만 ready로 인정한다.
- **동일 owner refresh 회귀**: initial/scope-change와 same-owner revision을 분리해 기존
  last-ready/resource reuse 의미를 테스트한다.
- **identity leakage**: owner id를 source URL·storage·직렬화 transition에 추가하지 않고 component
  scope와 generation으로 stale completion을 차단한다.
- **WebKit 실행 환경 차이**: 기존 binary를 우선 사용하고 설치가 필요하면 별도 승인받으며 실제
  Safari·Chrome Gate를 자동화 결과와 함께 유지한다.
- **Stage 3 조건부 파일 수정의 범위 확대**: `HomePage`·`App` 외 구조 변경이 필요하면 즉시
  중단하고 구현계획 변경 승인을 요청한다.

## 승인 요청 사항

- Stage 1에서 제품 소스 없이 실제 상태 이력을 known failure로 고정하고 Stage 2에서
  `test.fail()`을 제거하는 절차를 승인한다.
- operator resource 선로드는 유지하되 auth/profile target이 unresolved인 동안 presentation
  `ready` 권한을 주지 않는 설계를 승인한다.
- transition이 원래 selected target provenance를 보존하고 current selected target과 정합한
  ready/fallback만 표시하는 상태 확장을 승인한다.
- 최초·scope-change는 stale visible을 허용하지 않고 same-owner revision은 기존 refresh 의미를
  유지하는 경계를 승인한다.
- Stage 3은 우선 회귀 검증 중심으로 진행하고, 승인된 범위 내 결함이 재현될 때만 `HomePage` 또는
  `App`을 추가 보정하는 조건부 산출물을 승인한다.
- 각 Stage 보고 승인과 실제 모바일 Safari·Chrome Gate 전에는 다음 Stage 또는 #96으로
  진행하지 않는 순서를 승인한다.
