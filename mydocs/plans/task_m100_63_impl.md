# Task M100 #63 구현계획서

수행계획서: [`task_m100_63.md`](task_m100_63.md)
GitHub Issue: [#63](https://github.com/postmelee/codex-usage-profile/issues/63)
마일스톤: M100

## 승인된 결정과 구현 해석

작업지시자가 승인한 수행계획서와 권고안 A를 다음과 같이 구현 경계로
고정한다.

- Sites가 제공하지 않는 saved-version 이전 원격 D1 direct query를
  가장하지 않는다.
- 실제 공개 전환 절차는 owner-only candidate 배포 후 기존 hidden
  maintenance 경계에서 read-only exact readiness를 확인하는 순서로
  문서화한다.
- Task #63에서는 local contract와 smoke만 구현하며 saved version 생성,
  Sites 배포, access/environment 변경과 원격 D1/R2 작업은 수행하지 않는다.
- application migration manifest에서 파생 가능한 version/name/file 중복만
  통합한다. production artifact의 exact filename allowlist는 독립 보안
  review gate로 남긴다.
- CLI와 UI의 production origin은 runtime dependency로 결합하지 않고 root
  contract test로 동일성을 검증한다.

일반 D1 store의 `verifyReadiness()`는 기존 배포본의 하위 호환을 위해
**필수 version 누락을 거부하되 더 높은 version은 허용**하는 현재 의미를
유지한다. 반면 새 운영자용 readiness operation은 public 전환 후보를
검증하므로 **expected/applied가 정확히 일치해야만 통과**한다. 이 분리로
rollback 가능한 기존 Worker를 깨뜨리지 않으면서 신규 public 전환은
unknown version에서도 fail-closed로 유지한다.

PR #64 리뷰 보정 승인에 따라 exact gate의 기본 동작은 완화하지 않는다.
대신 미마이그레이션 D1을 명시적인 migration 미준비 상태로 분류하고,
readiness 성공 직후 maintenance surface를 닫은 뒤 기능 smoke를 진행한다.
더 높은 migration version을 가진 schema로 application rollback이 필요한
예외는 자동 우회 옵션이 아니라 별도 호환성 검토와 작업지시자 승인 절차로
운영 문서에 고정한다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | D1 migration manifest와 readiness 계약 | pure manifest, exact inspector, Node/Worker 파생 경로 | manifest invariant, D1 migrate/store, full-stack bundle |
| 2 | protected Sites readiness preflight | maintenance operation/CLI, local smoke, 운영 순서 | auth·payload 최소화·read-only·mismatch fail-close |
| 3 | artifact와 canonical origin drift 방지 | manifest 기반 full-stack verifier, 독립 production allowlist, origin contract | missing/extra migration·origin mismatch 회귀 |
| 4 | 통합 검증과 문서 정합성 | 전체 검증 증적, 불변 경계 확인 | root test/build/artifact/local production smoke |
| 5 | PR #64 리뷰 보정 | 미마이그레이션 진단, maintenance 최소 노출, rollback 예외 문서 | focused regression, full-stack smoke, 전체 회귀 |

각 Stage는 소스와 `mydocs/working/task_m100_63_stage{N}.md`를 함께
커밋한다. 단계 보고 후 작업지시자 승인 없이는 다음 Stage로 진행하지
않는다.

## 문서 위치 확인

수행계획서에서 승인한 문서 위치를 그대로 사용한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| Sites 운영 순서 | `docs/` | `docs/sites-operations.md` | OK | Stage 2에서 owner-only readiness gate와 원복 조건 보강 |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_63*.md` | OK | 범위·결정·단계 승인 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_63_stage{N}.md` | OK | 단계별 검증과 잔여 위험 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_63_report.md` | OK | 모든 Stage 승인 후 작성 |

architecture/API/roadmap 문서, `mydocs/manual/`, root `README.md`와 package
사용자 문서는 변경하지 않는다. 구현 중 공개 API나 제품 아키텍처 설명이
필요해지면 해당 Stage를 중단하고 문서 위치를 포함한 계획 변경 승인을
받는다.

## Stage 1 — D1 migration manifest와 readiness 계약

### 산출물

신규:

- `src/profile-backend/d1/migration-manifest.js`
- `src/profile-backend/__tests__/d1-migration-contract.test.js`
- `mydocs/working/task_m100_63_stage1.md`

수정:

- `src/profile-backend/d1/migrate.js`
- `src/profile-backend/d1/store.js`
- `src/profile-backend/d1/index.js`
- `src/profile-backend/__tests__/d1-migrate.test.js`
- `src/profile-backend/__tests__/d1-store.test.js`
- `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js`

### 변경 내용

- Node builtin, SQL text와 runtime binding을 import하지 않는 pure migration
  manifest를 추가한다. 각 항목은 `version`, `name`,
  repository-relative `file`만 가진다.
- module 초기화 또는 exported assertion에서 다음 manifest invariant를
  fail-fast로 검증한다.
  - 비어 있지 않은 배열
  - 1부터 연속되는 양의 정수 version과 strictly ascending order
  - 중복되지 않는 version/name/file
  - `db/migrations/` 아래의 안전한 `.sql` 경로
- `migrate.js`는 manifest를 Node `fs` SQL loader와 결합하고 기존
  `DEFAULT_D1_MIGRATIONS`, `loadD1Migrations()`와
  `migrateD1Database()`의 외부 계약을 유지한다.
- D1 schema 상태를 `SELECT schema_migrations` 한 번으로 읽어 다음 bounded
  결과를 만드는 pure/read-only inspector를 추가한다.
  - `expectedVersions`
  - `appliedVersions`
  - `missingVersions`
  - `unexpectedVersions`
  - `readyExact`
- inspector는 schema나 row를 변경하지 않고 version 배열만 반환한다.
  raw SQL/provider message와 migration SQL 내용은 결과에 포함하지 않는다.
- store `verifyReadiness()`는 inspector의 `missingVersions`만 기준으로
  기존 필수 migration 누락을 거부하고 `{ appliedVersions }` 반환 계약을
  유지한다. 더 높은 version은 기존 Worker rollback 호환을 위해 허용한다.
- full-stack Worker harness는 Vite raw SQL inclusion map을 manifest와
  결합한다. version/name/count literal은 반복하지 않고, manifest에 있는
  SQL 누락 또는 map의 unexpected SQL은 bundle/test 단계에서 실패시킨다.
- migration 1~3 SQL, version/name/file 값과 D1 schema는 변경하지 않는다.

### 검증

```bash
node --test \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-backend/__tests__/d1-migrate.test.js \
  src/profile-backend/__tests__/d1-store.test.js
npm run build
npm run verify:sites-fullstack
git diff --check
git diff origin/devel -- db/migrations
```

추가 회귀는 manifest invalid fixture, 최초 migration `[1, 2, 3]`, 재실행
no-op, missing version 거부, higher version store 호환과 exact inspector의
unexpected version 거부를 포함한다. 마지막 migration SQL diff는 빈
출력이어야 한다.

### 커밋

```text
Task #63 Stage 1: D1 migration manifest와 readiness 계약 정렬
```

## Stage 2 — protected Sites readiness preflight

### 산출물

신규:

- `mydocs/working/task_m100_63_stage2.md`

수정:

- `src/profile-runtime/sites/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `scripts/sites-profile-maintenance.mjs`
- `scripts/__tests__/sites-profile-maintenance.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `docs/sites-operations.md`

### 변경 내용

- 기존 `/__ops/profile-maintenance` dispatcher와
  `sites:profile-maintenance` CLI에 `readiness` operation을 추가한다.
- 요청 payload는 정확히 `{ "operation": "readiness" }`이며 owner scope,
  `--apply`, expected digest/count와 backup을 받지 않는다.
- endpoint는 기존 maintenance enabled, bearer secret, same-origin,
  POST JSON, body-size limit와 disabled-as-404 경계를 그대로 재사용한다.
- service는 Stage 1 exact inspector만 호출한다. exact match 성공 응답의
  `summary`에는 다음 bounded 필드만 둔다.
  - `operation: "readiness"`
  - `ready: true`
  - `expectedVersions`
  - `appliedVersions`
- owner, handle, usage, snapshot, token/session/credential, SQL/provider
  message와 R2 object metadata는 읽거나 반환하지 않는다.
- missing 또는 unexpected version은 안정적인
  `migration_not_ready` code와 HTTP 503으로 fail-closed한다. 알 수 없는
  provider 오류도 기존 generic `maintenance_unavailable` 경계로 감춘다.
- CLI는 다음 단일 read-only 경로를 제공하고 성공 summary만 출력한다.

```bash
npm run sites:profile-maintenance -- readiness --origin <https-origin>
```

- local full-stack smoke는 maintenance 활성화 직후 migration 미적용 상태가
  `migration_not_ready`인지 확인하고, migration 적용 후 exact readiness를
  통과하면 maintenance를 즉시 비활성화한다. operator route `404`를 확인한
  다음에만 기존 OAuth/CLI/publication 흐름을 실행한다.
- `docs/sites-operations.md`의 향후 실제 운영 순서를 다음으로 고정한다.
  1. exact commit build·artifact verify·package
  2. owner-only candidate deploy
  3. protected readiness exact match
  4. maintenance disabled/secret-absent 복원과 operator route `404` 확인
  5. 기능 smoke
  6. 별도 승인 후 public access 전환
- mismatch/provider error 또는 maintenance 비활성화 실패에서는 public
  전환, 기능 smoke와 데이터 작업을 하지 않고 owner-only access를 유지한
  채 disabled/secret-absent baseline으로 원복한다. 정상 public baseline은
  operator secret absent/route disabled를 유지한다.
- 이 Stage에서 실제 Sites candidate를 배포하거나 원격 readiness를
  실행하지 않는다.

### 검증

```bash
node --test \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js
npm run smoke:sites-production:local
git diff --check
```

test는 disabled/secret/origin 보호, exact success, missing/unexpected
migration, provider failure, extra payload 거부와 D1 mutation 0건을
검증한다. success/error body에 owner·usage·token·session·credential·R2
metadata가 없는지도 확인한다.

### 커밋

```text
Task #63 Stage 2: Sites protected readiness preflight와 운영 순서 추가
```

## Stage 3 — artifact와 canonical origin drift 방지

### 산출물

신규:

- `src/profile-ui/__tests__/production-origin-contract.test.js`
- `mydocs/working/task_m100_63_stage3.md`

수정:

- `scripts/verify-sites-fullstack-artifact.mjs`
- `scripts/__tests__/verify-sites-fullstack-artifact.test.js`
- `scripts/__tests__/verify-sites-production-artifact.test.js`

필요한 경우에만 수정:

- `scripts/__tests__/smoke-sites-production-local.test.js`

### 변경 내용

- full-stack artifact verifier가 고정 count `3` 대신 pure manifest의
  ordered filename set과 packaged `.openai/drizzle` 파일을 exact
  비교하도록 바꾼다.
- missing, unexpected, duplicate와 순서 drift를 서로 구분된 실패로
  검증한다. manifest가 바뀌면 application/full-stack verifier의 expected
  목록은 함께 파생된다.
- production artifact verifier의 독립
  `EXPECTED_MIGRATIONS` exact allowlist는 manifest import로 대체하지
  않는다. 새 migration이 application manifest에만 추가되면 production
  verifier가 실패해 별도 production review를 요구하도록 negative test를
  추가한다.
- root contract test가 CLI package의 `DEFAULT_SERVICE_ORIGIN`과 UI의
  `DEVICE_APPROVAL_PRODUCTION_ORIGIN`을 직접 import해 exact equality와
  canonical HTTPS origin 형태를 확인한다.
- `scripts/smoke-npm-package-local.mjs`의 독립 expected-origin 검증은 packed
  supply-chain 경계이므로 그대로 유지한다.
- 현재 origin 문자열, OAuth callback과 runtime package dependency는
  변경하지 않는다.
- local production smoke test fixture가 새 readiness 결과 형식 때문에
  깨지는 경우에만 fixture를 최소 보정한다. 기능 동작이나 expected origin
  자체는 바꾸지 않는다.

### 검증

```bash
node --test \
  scripts/__tests__/verify-sites-fullstack-artifact.test.js \
  scripts/__tests__/verify-sites-production-artifact.test.js \
  src/profile-ui/__tests__/production-origin-contract.test.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git diff origin/devel -- \
  packages/codex-usage-profile-cli/src/config.js \
  src/profile-ui/deviceApproval.js
```

마지막 origin source diff는 빈 출력이어야 한다. test fixture에서는 한쪽
상수만 바뀔 때 origin contract 실패, manifest-only future migration에서
full-stack 파생 경로는 정렬되지만 production exact allowlist는 실패하는
독립성을 확인한다.

### 커밋

```text
Task #63 Stage 3: Sites artifact와 canonical origin drift 검증 강화
```

## Stage 4 — 통합 검증과 문서 정합성

### 산출물

신규:

- `mydocs/working/task_m100_63_stage4.md`

수정:

- Stage 1~3 실패가 승인 범위 안의 stale contract를 드러낸 경우에 한해
  해당 test/운영 문서

### 변경 내용

- Stage 1~3의 manifest, protected readiness, artifact와 origin contract를
  전체 root 검증으로 다시 실행한다.
- standard/production build 산출물에 기존 Sites app entry, D1 binding,
  R2 binding과 migration 1~3이 유지되는지 검증한다.
- production local smoke에서 maintenance readiness가 user flow보다 먼저
  성공하며 기존 OAuth, device login, submit, publication 경로가
  회귀하지 않는지 확인한다.
- 수행계획서·구현계획서·공식 운영 문서의 순서와 실패 조건을 대조한다.
- `.openai/hosting.json`, migration SQL, origin 값과 GitHub/Sites 외부
  상태가 변경되지 않았음을 diff와 작업 기록으로 확인한다.
- 검증 실패가 migration/schema/API/hosting 변경을 요구하면 임의 보정하지
  않고 Stage를 중단해 계획 변경 승인을 요청한다.

### 검증

```bash
npm test
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-production:local
git diff --check
git diff origin/devel -- \
  .openai/hosting.json \
  db/migrations \
  packages/codex-usage-profile-cli/src/config.js \
  src/profile-ui/deviceApproval.js
```

마지막 보호 파일 diff는 빈 출력이어야 한다. test skip, 환경 제약 또는
외부 dependency 한계가 있으면 Stage 보고서에 정확히 기록하고 실패나
미실행을 통과로 표현하지 않는다. 이 Stage도 Sites save/deploy/access,
D1/R2 mutation과 remote smoke를 수행하지 않는다.

### 커밋

```text
Task #63 Stage 4: Sites 배포 계약 통합 검증 완료
```

## Stage 5 — PR #64 리뷰 보정

### 산출물

신규:

- `mydocs/working/task_m100_63_stage5.md`

수정:

- `src/profile-backend/d1/store.js`
- `src/profile-backend/__tests__/d1-migration-contract.test.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `docs/sites-operations.md`
- `mydocs/plans/task_m100_63.md`
- `mydocs/plans/task_m100_63_impl.md`
- `mydocs/report/task_m100_63_report.md`

### 변경 내용

- readiness inspector는 `sqlite_master`를 read-only 조회해
  `schema_migrations` 존재 여부를 먼저 확인한다. 테이블이 없으면 적용
  version을 빈 배열로 취급해 모든 expected version을 missing으로 보고한다.
- `schema_migrations`가 없는 대표 미적용 상태는 maintenance route에서
  `migration_not_ready` 503으로 응답한다. sqlite metadata/version query의
  실제 provider failure는 계속 generic `maintenance_unavailable`로 감춘다.
- exact public cutover gate는 missing/unexpected version을 모두 거부한다.
  higher-version schema에서의 긴급 application rollback은 자동 허용하지
  않고, known-compatible saved version과 별도 호환성 검토·승인을 요구한다.
- owner-only candidate의 readiness 성공 직후 maintenance mode를 disabled로
  바꾸고 operator secret을 제거한 뒤 route `404`를 검증한다. 이 복원이
  성공하기 전에는 OAuth/CLI/publication 기능 smoke를 시작하지 않는다.
- 실제 Sites/D1/R2/environment/access 변경은 수행하지 않는다.

### 검증

```bash
node --test \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
npm run smoke:sites-production:local
npm test
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git diff origin/devel -- \
  .openai/hosting.json \
  db/migrations \
  packages/codex-usage-profile-cli/src/config.js \
  src/profile-ui/deviceApproval.js
```

### 커밋

```text
Task #63 Stage 5: PR 리뷰 readiness와 maintenance 경계 보정
```

## 단계 의존성과 중단 조건

- Stage 2는 Stage 1의 exact inspector와 manifest 계약 승인 후 시작한다.
- Stage 3는 Stage 1 manifest export가 안정화된 뒤 artifact verifier를
  연결한다. Stage 2와의 공통 변경이 생기면 Stage 2 승인 내용을 보존한다.
- Stage 4는 Stage 1~3 단계 보고 승인 후 실행한다.
- Stage 5는 PR #64 리뷰 검토와 작업지시자의 권고안 승인에 따라 기존
  Stage 1~4 불변 조건을 보존하는 보정 단계다.
- manifest 변경이 실제 migration 4/schema 변경을 요구하면 범위 밖이므로
  즉시 중단한다.
- readiness 구현이 owner/usage/R2 조회나 public health 노출을 요구하면
  승인된 최소 payload 경계를 벗어나므로 즉시 중단한다.
- Sites provider limitation 때문에 실제 원격 후보 검증이 필요해져도
  Task #63에서는 배포하지 않고 별도 Gate와 task로 넘긴다.

## 최종 불변 조건

- migration SQL과 현재 migration version/name/file은 바뀌지 않는다.
- 일반 D1 store는 필수 version 누락을 거부하고 higher version을 허용한다.
- public 전환용 protected readiness는 missing/unexpected version 모두
  거부한다.
- migration metadata table 부재는 missing version으로 분류하고 provider
  장애와 구분한다.
- 기능 smoke는 maintenance disabled/secret-absent와 operator route `404`
  복원을 확인한 뒤에만 시작한다.
- public `/healthz`와 일반 사용자 API에 schema metadata가 노출되지 않는다.
- production exact migration allowlist는 application manifest와 독립이다.
- CLI/UI canonical origin 값과 OAuth callback은 바뀌지 않는다.
- `.openai/hosting.json`, Sites version/access/environment와 D1/R2 데이터는
  바뀌지 않는다.
- 각 Stage는 보고서, 검증 결과와 커밋을 가진 뒤 다음 승인 Gate에서
  멈춘다.
