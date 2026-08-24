# Task #122 구현계획서 — Sites live D1 structured 계정 삭제 충돌 보정

- 수행계획서: [`task_m100_122.md`](task_m100_122.md)
- GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)
- 마일스톤: M100 — v1.0 MVP
- 상태: 구현 승인 대기

## 승인된 목표와 불변식

### 데이터 안전

- R2 revision이 0이고 stable state가 public publication이 아님을 다시 확인하기 전에는
  structured delete를 호출하지 않는다.
- exact `ownerId`·`handle`, 기존 operation ID, 최초 승인 content digest·object count를
  모든 재개 요청에서 유지한다. 현재 partial plan으로 최초 승인값을 교체하지 않는다.
- D1 structured delete는 dependent rows, deletion operation과 owner가 모두 제거되거나
  모두 유지되는 원자적 success/rollback 결과만 허용한다.
- guard mismatch, provider limit, lock, constraint 또는 statement failure를 성공으로
  reconciliation하지 않는다.
- raw D1/R2 mutation, manual SQL delete와 safety guard 제거는 구현·검증·복구 수단에서
  모두 제외한다.

### 재개와 operation authority

- Stage5 active operation
  `maintenance_delete_20d40b9d433449a6a33ae02c56ca17e1`만 기존 삭제 authority로
  인정한다. 새 operation을 만들거나 active row를 수동 수정하지 않는다.
- phase `structured`, lease 없음, 최초 승인 object count 77이라는 현재 baseline을
  원격 mutation 직전에 다시 확인한다.
- retryable provider busy와 terminal invariant failure를 구분한다. terminal failure에서는
  CLI가 iteration limit까지 같은 mutation을 반복하지 않는다.
- apply 응답 유실 뒤 plan `not_found`는 기존 계약대로 완료 reconciliation이지만,
  apply 전 `not_found`나 generic provider failure는 완료로 간주하지 않는다.

### 정보와 환경 경계

- 외부 API·CLI는 기존 `maintenance_conflict` 호환성을 유지하되 필요한 경우 allowlist된
  safe reason code와 retryability만 추가한다.
- SQL, provider 원문, credential, owner scope, row payload, R2 key/ETag, lease nonce와
  backup payload는 response, CLI output, 문서·커밋에 넣지 않는다.
- Stage5 target은 project
  `appgprj_6a62f58721788191a7cd82f37320f244`와
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`다.
- production project
  `appgprj_6a83ecc3c4c08191bda7f14d7c26c974`는 전체 task에서 read-only다.
- tracked canonical hosting manifest는 production을 계속 가리킨다. Stage5 artifact는
  기존 target materialization/preflight 절차로 repository 밖에서 만든다.
- source fix는 non-closing checkpoint PR로 `devel`에 통합하고 별도 release PR로 `main`에
  승격한다. exact merged `main`만 Stage5에 save/deploy한다.

## 진단 가설과 판정 기준

Stage 1은 아래 가설을 각각 분리해 검증한다. 첫 가설이 맞더라도 나머지 원자성 회귀를
생략하지 않는다.

| ID | 가설 | 재현 입력 | 판정 |
|---|---|---|---|
| H1 | JS에서 정렬한 submitted-device fingerprint와 D1 `GROUP_CONCAT` 결과 순서가 live insertion/query plan에 따라 다르다. | device 7개를 lexicographic order와 다른 순서로 insert하고 guard SELECT를 반복한다. | claim 0-row와 assertion rollback이 device 순서에서만 발생하면 원인 후보로 확정한다. |
| H2 | `atomic_operation_claims` claim/assertion/cleanup이 기존 row 또는 zero-row claim과 충돌한다. | clean claim, pre-existing same-owner claim, injected zero-row guard를 각각 실행한다. | 어떤 statement role이 transaction을 rollback하는지 확인한다. |
| H3 | active deletion operation의 explicit delete와 owner `ON DELETE CASCADE` 조합이 provider 차이를 만든다. | active structured operation을 둔 explicit-delete/cascade 경계를 비교한다. | owner·operation이 함께 삭제되거나 함께 rollback되는지 확인한다. |
| H4 | dependent row 수·삭제 순서 또는 rate-limit subquery가 provider limit/lock을 유발한다. | live-equivalent count 19/22/11/8/0/1/7/2와 작은 control fixture를 비교한다. | row cardinality·특정 statement에서만 실패하는지 확인한다. |
| H5 | 두 plan과 delete batch 사이 state가 달라져 guard가 stale해진다. | `beforeDeleteOwner` hook과 operation lease update를 분리 주입한다. | profile fingerprint가 그대로면 성공하고 실제 drift만 fail closed하는지 확인한다. |

Stage 1 결과가 위 가설로 설명되지 않거나 real-workerd 경로에서 재현되지 않으면 Stage 2를
시작하지 않는다. 장애 분석 문서와 구현계획 보정안을 제시해 다시 승인받는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | live-equivalent 재현과 원인 고정 | high-cardinality fixture, 현재 실패를 증명하는 통과형 회귀, incident 초안 | D1 fixture·real-workerd rollback·failure class |
| 2 | D1 원자 삭제와 Sites 오류 경계 보정 | provider-compatible guard/delete, safe reason·retryability | D1·Sites atomicity와 정보 경계 |
| 3 | CLI reconciliation·운영 문서·통합 회귀 | bounded terminal handling, full-stack smoke, runbook | CLI·전체 Node·Sites artifact·real-workerd |
| 4 | source integration checkpoint와 exact-main release | non-closing task PR, release PR, exact tree provenance | PR checks·tree equality·Stage5 artifact preflight |
| 5 | Stage5 기존 operation 재개와 Task #108 handoff | exact-main private deployment, deletion completion, incident·handoff | D1/R2 0·비열거·access/service 복구·production 무변경 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/sites-operations.md` | `docs/` | Stage 3 `docs/sites-operations.md` | OK | 일반화된 failure 분류·중단·재개 절차 |
| `docs/production-hosting.md` | `docs/` | Stage 3 `docs/production-hosting.md` | OK | D1 transaction과 rollback/application version 경계 |
| `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md` | `mydocs/troubleshootings/` | Stage 1 초안, Stage 5 실측 확정 | OK | 특정 Stage5 incident 증상·원인·복구 기록 |
| Task #122 계획·단계·최종 보고서 | `mydocs/` | `plans/`, `working/`, `report/` | OK | 승인·검증·원격 Gate와 handoff 근거 |

Task #108 active worktree의 계획·단계 문서는 이 branch에서 수정하지 않는다. Task #122
최종 보고서에 handoff를 고정하고 merge 뒤 Task #108이 별도로 동기화한다.

## 원격 mutation matrix

| Stage | GitHub | Sites/version | Access/environment | D1/R2 | 승인 경계 |
|---|---|---|---|---|---|
| 1 | read-only | 없음 | 없음 | local/real-workerd fixture만 | 구현계획 승인 |
| 2 | 없음 | 없음 | 없음 | local/real-workerd fixture만 | Stage 1 보고 승인 |
| 3 | 없음 | local artifact만 | 없음 | local smoke만 | Stage 2 보고 승인 |
| 4 | checkpoint·release PR | save/deploy 없음 | metadata read-only | Stage5/production overview read-only | Stage 3 보고 승인, PR별 merge 지시 |
| 5 | 없음 | exact-main Stage5 save·owner-only deploy | maintenance token 일시 설정·제거 | 기존 active operation exact resume | Stage 4 보고 승인 + Stage5 preflight 승인 |

Stage 4 checkpoint와 release PR은 Issue #122를 close하지 않는다. Stage 5 승인 후
`task-final-report`가 만드는 최종 `devel` PR에서만 일반 종료 절차를 적용한다.

## Stage 1 — live-equivalent 재현과 원인 고정

### 산출물

신규:

- `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md`
- `mydocs/working/task_m100_122_stage1.md`

수정 후보:

- `src/profile-backend/__tests__/_d1-test-fixture.js`
- `src/profile-backend/__tests__/d1-maintenance.test.js`
- 필요할 때만 `scripts/smoke-sites-fullstack-local.mjs`
- `mydocs/orders/20260824.md`

제품 runtime 코드는 이 Stage에서 고치지 않는다.

### 변경 내용

1. live count와 phase를 복제하되 identifier·payload는 synthetic인 fixture를 만든다.
   owner 1, OAuth state 19, session 22, challenge 11, token 8, snapshot 0, usage 1,
   device 7, rate limit 2와 active structured operation 1을 사용한다.
2. device ID를 정렬 순서와 다른 insertion order로 seed하고 ordered control과 비교한다.
3. 현재 구현 failure를 `assert.rejects`로 기대하는 통과형 회귀를 둔다. 실패 뒤
   owner/dependent row/operation/claim count가 전부 원상태인지 확인한다.
4. guard claim, assertion, dependent delete, operation delete, owner delete와 cleanup의
   statement role별 injected failure로 rollback과 internal failure class를 구분한다.
5. 실제 원인, 기존 작은 fixture가 놓친 조건과 수정 불변식을 incident 문서에 기록한다.
   raw provider message와 live row payload는 기록하지 않는다.
6. 원인이 예상과 다르면 Stage 2를 시작하지 않고 구현계획 보정 승인을 요청한다.

### 검증

```bash
node --test src/profile-backend/__tests__/d1-maintenance.test.js
npm run smoke:sites-fullstack:local
git diff --check
git status --short
```

- 재현은 현재 failure를 기대하므로 test suite 자체는 pass해야 한다.
- injected failure마다 structured row가 부분 삭제되지 않고 claim residue가 없어야 한다.
- live Stage5/Sites mutation은 0건이어야 한다.

### 완료·중단 조건

- 완료: provider-faithful fixture에서 현재 failure와 rollback을 결정적으로 재현하고 최소
  보정 경계를 설명한다.
- 중단: SQLite mock에서만 재현되거나 원인이 다르거나 rollback 결과가 비원자적이다.

### 커밋

```text
Task #122 Stage 1: live structured 삭제 충돌 재현
```

## Stage 2 — D1 원자 삭제와 Sites 오류 경계 보정

### 산출물

신규:

- `mydocs/working/task_m100_122_stage2.md`

수정 후보:

- `src/profile-backend/d1/maintenance.js`
- `src/profile-backend/__tests__/_d1-test-fixture.js`
- `src/profile-backend/__tests__/d1-maintenance.test.js`
- `src/profile-runtime/sites/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- incident 문서와 오늘할일

### 변경 내용

1. Stage 1에서 확정한 provider 차이에만 최소 수정한다.
2. H1이 원인이면 fingerprint 비교를 query-order 추정에 의존하지 않는 canonical
   representation으로 바꾼다. 모든 device field guard 의미를 유지하고 count-only로 약화하지 않는다.
3. H2/H3/H4가 원인이면 claim assertion과 dependent/operation/owner delete ordering을
   D1이 보장하는 단일 transaction 안에서 재구성한다. exact guard와 owner delete
   exactly-one assertion은 유지한다.
4. operation row는 successful owner completion과 함께 제거되고 실패하면 기존
   ID·approval·phase가 그대로 남아야 한다.
5. Stage 1의 failure 기대 회귀를 성공 기대 회귀로 바꾼다. 같은 fixture가 한 번의 structured
   request에서 owner·dependent rows·operation을 제거해야 한다.
6. 중간 failure, guard drift, operation mismatch와 remaining R2/public stable 조건은
   fail closed·full rollback을 유지한다.
7. internal failure class를 allowlist된 safe reason/retryability로 정규화하되 기존
   top-level `maintenance_conflict` 소비자를 깨지 않는다.
8. provider message, SQL, stack과 extra field가 API body·log에 새지 않는 negative test를 추가한다.

### 검증

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
npm run smoke:sites-fullstack:local
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: live-equivalent fixture가 동일 operation·approval로 원자 완료되고 injected failure는
  원상 rollback과 safe error boundary를 보인다.
- 중단: transaction 분할, raw provider detail 또는 schema migration이 필요하다.

### 커밋

```text
Task #122 Stage 2: D1 원자 삭제와 Sites 오류 경계 보정
```

## Stage 3 — CLI reconciliation·운영 문서·통합 회귀

### 산출물

신규:

- `mydocs/working/task_m100_122_stage3.md`

수정 후보:

- `scripts/sites-profile-maintenance.mjs`
- `scripts/__tests__/sites-profile-maintenance.test.js`
- `src/profile-runtime/sites/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `scripts/__tests__/smoke-sites-production-local.test.js`
- `docs/sites-operations.md`
- `docs/production-hosting.md`
- incident 문서와 오늘할일

### 변경 내용

1. CLI가 retryable busy만 bounded backoff/reconciliation하고 terminal structured failure는
   한 번의 read-only plan 확인 뒤 중단하도록 한다.
2. reason을 모르는 구버전 응답은 기존 보수적 conflict 경계를 유지하며 성공으로 추정하거나
   새 operation을 만들지 않는다.
3. `--operation-id`, expected digest/count와 monotonic phase/count 검사를 유지한다.
4. terminal failure, no-progress, network unknown, final response loss, live lease와
   `not_found` completion의 mutation 횟수를 정확히 검증한다.
5. full-stack smoke에 high-cardinality completion과 injected rollback을 추가한다.
6. Sites 운영 문서에는 safe failure별 `재시도/plan 확인/즉시 중단` 결정을, production 문서에는
   transaction과 이전 application rollback 금지 경계를 적는다.
7. incident 문서는 수정 원인·회귀·Stage5 재개 checklist까지 갱신하고 live 결과는 미확정으로 둔다.
8. diff에서 Task #122 범위 밖 공개 UX/npm/migration 변경이 없는지 감사한다.

### 검증

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js \
  scripts/__tests__/smoke-sites-production-local.test.js
npm test
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
npm run scan:public-release
git diff --check origin/devel...HEAD
git status --short
```

### 완료·중단 조건

- 완료: CLI·service·D1 retryability와 atomicity가 일치하고 전체 regression, artifact,
  real-workerd smoke와 문서 계약이 통과한다.
- 중단: npm/public UX/schema migration까지 범위를 확장하거나 production project identity가 바뀐다.

### 커밋

```text
Task #122 Stage 3: CLI 재조정과 통합 검증 정합화
```

## Stage 4 — source integration checkpoint와 exact-main release

> exact-main Stage5 검증을 위한 Task #122 한정 선행 integration 예외다. checkpoint와
> release PR은 Issue #122를 close하지 않고 `task-final-report`를 호출하지 않는다.

### 실행 순서와 산출물

1. Stage 3 승인 뒤 최신 `origin/devel`과 task branch의 merge-base, diff, 병렬 PR을 확인한다.
2. 충돌이 없으면 `local/task122:publish/task122`를 push하고 base `devel`의 non-closing
   checkpoint PR을 만든다. 본문은 `Refs #122`만 사용한다.
3. checks·review·head SHA·diff를 확인하고 작업지시자에게 merge를 요청한다.
4. merge 뒤 source 포함과 remote branch 삭제를 확인하고 local branch를
   `git merge --ff-only origin/devel`로 동기화한다.
5. integrated devel 전체 검증 뒤 중복 release PR이 없으면 `devel → main` release PR을 만든다.
   tag/npm/Sites deploy는 포함하지 않는다.
6. 작업지시자 merge 뒤 candidate가 `origin/main`에 포함되고 tree diff가 비어 있는지 확인한다.
7. exact-main detached clean worktree에서 Stage5 role artifact를 새로 build/package하고 target
   project·origin·binding·migration `1..6`·credential/path scan을 통과시킨다.
8. Sites mutation 없이 Stage 5 입력만 제시한다.
9. `mydocs/working/task_m100_122_stage4.md`와 오늘할일을 커밋하고 Stage5 승인을 요청한다.

### 검증

```bash
git fetch origin
git merge-base --is-ancestor {stage3_sha} origin/devel
gh pr view {checkpoint_pr} --json state,baseRefName,headRefName,headRefOid,reviews,statusCheckRollup
gh pr checks {checkpoint_pr}
gh pr view {release_pr} --json state,baseRefName,headRefName,headRefOid,reviews,statusCheckRollup
gh pr checks {release_pr}
git merge-base --is-ancestor {integrated_devel_sha} origin/main
git diff --exit-code {integrated_devel_sha} origin/main -- .
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: checkpoint·release PR이 명시 지시에 따라 merge됐고 Issue는 open이며 exact main과
  Stage5 candidate provenance가 일치한다.
- 중단: PR 불일치, early issue close, main tree mismatch, branch fast-forward 불가 또는
  예상하지 않은 tag/npm/Sites mutation.

### 커밋

```text
Task #122 Stage 4: checkpoint와 exact main release provenance 기록
```

## Stage 5 — Stage5 기존 operation 재개와 Task #108 handoff

### Gate 5A — read-only preflight

다음을 mutation 없이 수집해 제시한다.

- exact `origin/main` SHA/tree와 Stage5 candidate archive digest
- Stage5 project/origin, deployed version/source, owner-only access와 environment revision
- readiness migration `1..6`, service normal, maintenance disabled
- exact owner/handle, existing operation ID, phase `structured`, lease 없음과 최초 승인 digest/count
- R2 revision 0, non-public stable과 structured table별 bounded count
- repository 밖 mode `0600` backup 존재·checksum 일치·payload 미출력
- production version 2, environment revision 2, 기록된 access policy와 HTTP baseline의
  read-only 비교

하나라도 수행계획 baseline과 다르면 mutation 전에 중단한다.

### Gate 5B — exact-main owner-only deploy

1. Gate 5A 승인 뒤 exact candidate source를 Stage5에 push하고 saved version 1개를 만든다.
2. requested source, returned version source와 archive provenance가 일치할 때만 owner-only
   deployment로 승격한다.
3. public access가 필요한 경로면 실행하지 않고 별도 승인받는다.
4. health, readiness, owner-only anonymous denial과 production 무변경을 확인한다.
5. 새 code의 read-only plan이 같은 active operation·approval·phase를 인식하는지 확인한다.

### Gate 5C — 동일 operation resume

1. 별도 Stage5 maintenance token을 일시 설정하고 revision을 기록하되 값을 출력하지 않는다.
2. exact owner/handle, 기존 operation ID, 최초 expected digest/count와 `--apply`를 명시한다.
3. retryable progress만 직렬 재개한다. terminal reason, mismatch, nonzero R2, public stable,
   lease 역행 또는 plan drift가 나오면 즉시 중단한다.
4. 완료 뒤 plan `not_found`, D1 owner/dependent rows/operation 0, R2 revision 0과 profile/card
   404를 확인한다.
5. maintenance token을 제거하고 disabled, service normal, owner-only access를 재검증한다.
   실패해도 token 제거와 maintenance close를 우선한다.
6. backup은 삭제하지 않고 production baseline을 다시 비교한다.

### 산출물과 검증

신규:

- `mydocs/working/task_m100_122_stage5.md`

수정:

- `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md`
- 실제 작업일의 `mydocs/orders/yyyyMMdd.md`

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run sites:profile-maintenance -- readiness \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- plan \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site \
  --owner-id {approved_owner_id} \
  --handle postmelee
git diff --check
git status --short
```

`delete-account --apply`, Sites save/deploy와 environment mutation은 Gate 5A 결과를 제시한 뒤
받는 명시 승인에만 추가한다.

### 완료·중단 조건

- 완료: existing operation이 새 ID·approval 변경 없이 completed되고 D1/R2 참조가 0이며,
  Stage5 owner-only·service normal·maintenance disabled, backup 유지와 production 무변경을
  확인했다.
- 중단: source/target/operation/approval/backup mismatch, nonzero media, partial structured
  state, public access 필요, token 제거 실패 또는 production 영향.

### 커밋

```text
Task #122 Stage 5: Stage5 삭제 재개와 Task #108 handoff 검증
```

Stage 5 승인 뒤 `task-final-report`에서 최종 보고서, Task #108 exact handoff와 다시 생성한
`publish/task122`의 final `devel` PR을 만든다.

## 공통 검증과 단계 의존성

- 각 Stage 검증은 `task-stage-report` 전에 통과해야 한다.
- Stage 1 재현은 failure 기대 assertion으로 suite 자체는 성공해야 한다.
- Stage 2 이후 같은 fixture는 성공 기대와 full deletion count를 검증해야 한다.
- concurrency/order는 fixture hook과 synthetic ID로 제어하며 sleep/live timing에 의존하지 않는다.
- real-workerd smoke는 repository 밖 임시 D1/R2만 쓰고 Stage5 credential을 주입하지 않는다.
- 문서 위치, 외부 response field 또는 schema migration 변경이 필요하면 계획을 보정하고 승인받는다.
- Stage source, 단계 보고서와 오늘할일을 한 커밋으로 묶는다.
- Stage 2는 Stage 1 원인 승인 후, Stage 3은 Stage 2 contract 승인 후 시작한다.
- Stage 4는 Stage 1~3 전체 승인 뒤, Stage 5는 exact `main`과 preflight 승인 뒤 시작한다.
- Stage 5 승인 전에는 final report, issue close와 task-closing PR을 만들지 않는다.

## 위험과 대응

- **순서 비결정성 오진**: control/permutation과 real-workerd에서 같은 결과를 확인한다.
- **guard 약화**: device fingerprint를 count-only로 줄이지 않고 canonical field set을 유지한다.
- **D1 provider 차이**: statement를 나눠 partial commit하는 우회를 금지한다.
- **외부 호환성**: safe reason을 추가해도 top-level code와 conservative behavior를 유지한다.
- **checkpoint 예외**: source PR은 issue를 close하지 않고 closing PR은 live 결과 후 만든다.
- **live state drift**: Gate 5A가 다르면 기존 삭제 승인을 재사용하지 않는다.
- **maintenance secret 잔존**: failure path에서도 token 제거와 maintenance disable을 우선한다.
- **Task #108 충돌**: Task #122 branch에서 Task #108 파일을 수정하지 않는다.

## 승인 요청 사항

- H1~H5 진단 행렬과 Stage 1의 통과형 실패 재현 방식을 승인한다.
- Stage 1 원인 고정 뒤에만 runtime을 수정하고, 원인이 다르면 계획을 보정하는 조건을 승인한다.
- exact guard·R2-first·동일 operation·approval 불변·atomic rollback과 safe error boundary를
  Stage 2 필수 수용 기준으로 승인한다.
- Stage 3 CLI terminal/retryable 분리, full-stack 회귀와 공식 운영 문서 보정을 승인한다.
- Stage 4 non-closing checkpoint와 별도 exact-main release 예외를 승인한다.
- Stage 5의 `read-only preflight → owner-only deploy → 동일 operation resume → maintenance close`
  Gate와 production read-only 경계를 승인한다.
- 위 Stage별 산출물, 검증 명령과 커밋 메시지를 승인한다.

승인되면 **Stage 1만** 수행하고 검증 통과 후 `task-stage-report`로 보고·커밋한 뒤 Stage 2
승인을 요청한다.
