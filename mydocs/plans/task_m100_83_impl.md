# Task #83 구현계획서 — 누적 Sites 후보 production artifact preflight와 owner-only 배포 검증

수행계획서: [`task_m100_83.md`](task_m100_83.md)
GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
마일스톤: M100

## 승인된 결정과 구현 해석

승인된 수행계획을 다음 구현 경계로 고정한다.

- production verifier의 absolute-path·credential·secret 검사를 완화하거나 `dist/server/.vite/manifest.json`을 검사 예외로 두지 않는다.
- Cloudflare Vite plugin은 Worker build가 끝난 뒤 `.vite/manifest.json`을 읽어 imported asset을 client output으로 이동한다. 따라서 Worker `closeBundle` 중 manifest를 제거하거나 수정하지 않는다.
- 최종 `wrangler.json`, Worker entry와 emitted JS/Wasm/font는 `.vite/manifest.json`을 runtime에서 참조하지 않는다. Vite 전체 build가 성공적으로 끝난 뒤 exact build metadata만 제거하는 post-build finalizer를 둔다.
- finalizer는 `dist/server/.vite/manifest.json`만 제거하고 비어 있는 `.vite` directory만 정리한다. `.vite`에 예상하지 못한 다른 파일이 있으면 남겨 production verifier가 검사하도록 하며, `dist/server` runtime 파일은 건드리지 않는다.
- `verify:sites-fullstack`과 `verify:sites-production`의 책임·패턴·allowlist는 변경하지 않는다. artifact producer를 보정한 뒤 두 verifier가 독립적으로 통과해야 한다.
- Stage 1·2는 local source/artifact만 변경한다. Stage 3 Sites owner-only mutation과 Stage 4 임시 public access는 각각 read-only snapshot과 별도 Gate 승인을 받은 뒤에만 수행한다.
- Stage 3 배포 source는 Stage 2 완료 commit이다. Stage 3·4 보고서와 공식 문서 commit은 배포 뒤 추가되는 문서-only HEAD로 구분하고, saved version의 exact application source SHA를 별도로 기록한다.
- migration `3..5` 적용은 mutation이고 readiness는 read-only다. exact `[1,2,3,4,5]`가 아니면 기능 smoke와 public Gate를 진행하지 않는다.
- Stage 4 Gate B 종료 시 영구 public 상태를 유지하지 않는다. owner-only access, private profile, revoked token/session, disposable D1/R2 정리와 maintenance disabled/secret-absent baseline을 복원한 뒤 후속 #84로 넘긴다.
- Sites에서 소유자 프로필의 canonical application route는 `/?view=profile`로 둔다. UI, OAuth 복귀와 CLI profile metadata가 이 경로를 생성하며 `/profile`은 Node/dev 하위 호환 route로만 유지한다.
- Stage 3.10은 owner profile UI route와 metadata만 보정한다. Stage 3.9 exact source에서 완료한 Gate B cache·OG·social 측정의 backend/public 계약은 다시 실행하지 않고, 새 exact source의 owner-only saved version과 query route 집중 smoke로 후보를 재고정한다.
- Stage 4 뒤 발견한 동적 카드 loading·motion 회귀는 Stage 4.1에서 보정한다. 홈의
  기존 Skeleton을 공통 카드 readiness 표현으로 승격하되 avatar/logo에는 적용하지
  않고, `load`와 가능한 `decode()`가 끝난 generation만 visible source와 motion을
  활성화한다.
- Stage 4.1은 private preview `private, no-store`, public media ETag/cache header,
  D1/R2 publication atomicity를 유지한다. Skeleton과 별개로 unique render/in-flight
  중복·avatar invalidation을 측정해 증명된 최소 성능 보정만 포함한다.
- Stage 4.2는 Stage 4.1 뒤 확인한 카드 내부 GitHub avatar fallback 고착과 surface 간
  동일 decoded image 재요청을 보정한다. avatar 성공 bytes만 server LRU에 저장하고
  transient failure는 bounded 1회 재시도한다. client는 owner-scoped·TTL/LRU bounded
  tab-memory resource cache만 사용하며 HTTP cache header와 persistent storage는 바꾸지 않는다.
- Stage 4.3은 saved version 19 hosted smoke에서 확인한 Workerd
  `redirect: "error"` 비호환과 최초 Share Studio source→target 연속성만 보정한다.
  avatar는 manual redirect + 3xx fail-closed를 사용하고, 공유 motion은 이미 decode된
  source bitmap으로 시작해 public target 준비 뒤 교체한다. owner/public cache key,
  route별 profile load, HTTP header와 persistent storage 경계는 바꾸지 않는다.
- Stage 4.4는 saved version 20 hosted smoke에서 확인한 warm target 중복 fade와 profile
  loading 표현 불일치만 보정한다. source 없는 cold readiness fade와 route별 fetch,
  public media/cache·publication·access 계약은 변경하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | production artifact local-path 보정 | post-build finalizer, package script, focused test | final manifest 부재, runtime 파일 보존, 두 artifact verifier 통과 |
| 2 | exact local candidate와 archive preflight | 전체 local 검증, Sites package archive, candidate 증적 | test/E2E/build/verifier, archive 파일·금지 문자열 검사 |
| 3 | Gate A owner-only 배포와 전체 기능 smoke | saved version, migration `1..5`, owner-only smoke | exact source, readiness, maintenance safe state, OAuth/CLI/card/OG |
| 4 | Gate B public cache 실측과 baseline 원복 | cache/revision 관찰, owner-only·disposable cleanup, 공식 상태 문서 | anonymous 경계, cache header, revision 신선도, 원복·비노출 |
| 4.1 | 카드 readiness·Skeleton·motion 회귀 보정 | 공통 card loading contract, intro/handoff gate, profile draft 안정화 | delayed/error/reduced-motion E2E, cache 계약, owner-only smoke |
| 4.2 | avatar 복구성과 card resource 재사용 보정 | fail-soft avatar loader, tab-memory decoded resource cache | retry/failure eviction, cross-surface dedupe, owner 격리, 전체 회귀 |
| 4.3 | hosted avatar 호환과 공유 handoff 연속성 보정 | manual redirect fail-closed, source bitmap handoff | 3xx 거부, delayed target/failure/close/reduced-motion, hosted smoke |
| 4.4 | 공유 전환·프로필 Skeleton 연속성 보정 | warm target motion continuity, 공통 profile Skeleton | opacity 연속성, 요소별 shimmer, identity 비노출, reduced-motion |
| 4.5 | Skeleton/ready 위치·reveal 정합화 | ready-equivalent placeholder geometry, content micro cascade | bounding box, final opacity/transform, replay 부재, reduced-motion |
| 4.6 | profile reveal 공간 이동·stagger 제거 | transform-free synchronized opacity reveal | delay 0s, active/final transform none, geometry, reduced-motion, local preview |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| Sites current baseline·runbook | `docs/` | `docs/sites-operations.md` (Stage 4, 필요한 경우) | OK | saved version/access/environment 또는 장기 운영 절차가 실제로 바뀔 때만 최소 수정 |
| production 검증 상태 | `docs/` | `docs/production-hosting.md` (Stage 4, 필요한 경우) | OK | migration/artifact/cache 중 장기 유지할 검증 사실만 반영 |
| 공개 카드 후보 상태 | `docs/` | `docs/readme-card.md` (Stage 4, 필요한 경우) | OK | Gate C 전이므로 CTA는 활성화하지 않고 후보 상태 문구만 사실에 맞게 조정 |
| 소유자 profile·CLI route | `docs/` | `docs/readme-card.md`, `docs/cli-submit.md` (Stage 3.10) | OK | Sites canonical root-query 경로를 사용자·CLI 문서에 반영하고 `/profile`은 local compatibility 설명에서만 유지 |
| 단계 검증 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage{N}.md` | OK | SHA, count/size와 redacted remote 결과를 task 범위에 보관 |
| 최종 handoff | `mydocs/report/` | `mydocs/report/task_m100_83_report.md` | OK | #84 선행조건과 exact application source를 최종 정리 |
| Stage 4.1 회귀 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage4_1.md` | OK | 사용자 식별자나 raw timing log 없이 상태 전환·검증 결과와 exact source만 기록 |
| Stage 4.2 회귀 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage4_2.md` | OK | avatar URL·owner·provider error 원문 없이 retry/cache/resource 결과만 기록 |
| Stage 4.3 회귀 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage4_3.md` | OK | hosted URL·identity 원문 없이 redirect/handoff 상태와 검증 결과만 기록 |
| Stage 4.4 회귀 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage4_4.md` | OK | 사용자 identity·hosted URL 원문 없이 target opacity와 Skeleton 상태·검증 결과만 기록 |
| Stage 4.5 회귀 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage4_5.md` | OK | 사용자 identity·usage 없이 layout delta와 animation 계약만 기록 |
| Stage 4.6 회귀 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage4_6.md` | OK | transform·stagger 제거, local preview 승인과 exact source owner-only hosted smoke만 기록 |

새 공식 문서는 만들지 않는다. raw request/response, credential, identity, usage bytes, backup path/payload와 disposable 식별자는 공식 문서나 task 문서에 기록하지 않는다.

## Stage 1 — production artifact local-path 보정

### 산출물

신규:

- `scripts/finalize-sites-fullstack-artifact.mjs`
- `scripts/__tests__/finalize-sites-fullstack-artifact.test.js`
- `mydocs/working/task_m100_83_stage1.md` (Stage 1 완료 시 `task-stage-report`로 작성)

수정:

- `package.json`

보호 대상(감사만 수행하고 Stage 1에서 수정하지 않음):

- `build/sites-fullstack-vite-plugin.js`
- `vite.sites-fullstack.config.js`
- `scripts/verify-sites-fullstack-artifact.mjs`
- `scripts/verify-sites-production-artifact.mjs`
- Worker, renderer, D1/R2와 UI source 전체

### 변경 내용

- `finalizeSitesFullStackArtifact()`와 CLI entry를 갖는 Node ESM finalizer를 추가한다.
- output directory는 명시 option을 우선하고, CLI 기본값은 production `dist`로 둔다. local full-stack smoke처럼 다른 output을 사용하는 caller는 exact 경로를 전달하도록 한다.
- finalizer는 다음 순서로 동작한다.
  1. output path와 exact `server/.vite/manifest.json`을 resolve한다.
  2. manifest가 없으면 이미 안전한 build로 보고 no-op summary를 반환한다.
  3. manifest가 regular file인지 확인하고 symlink·directory·기타 type은 실패시킨다.
  4. exact manifest만 삭제한다.
  5. `.vite`가 비었을 때만 directory를 제거한다. 다른 entry가 있으면 보존한다.
  6. removed 여부와 보존된 unexpected entry count만 bounded summary로 반환한다. 원본 path·manifest 내용은 출력하지 않는다.
- `build:sites-fullstack`은 `vite build --config vite.sites-fullstack.config.js` 성공 뒤 finalizer를 실행한다. Vite 실패 시 finalizer를 실행하지 않는다.
- local smoke가 `build:sites-fullstack`을 직접 호출하면서 alternate output을 사용한다면 caller에서 finalizer exact output을 전달하도록 focused diff만 추가한다. 이 필요가 확인되면 `scripts/smoke-sites-fullstack-local.mjs`를 Stage 1 수정 목록에 추가하고 단계 보고서에 계획 대비 이유를 기록한다.
- focused test는 다음을 검증한다.
  - manifest와 빈 `.vite` 제거
  - manifest 부재 no-op
  - 다른 `.vite` entry 보존
  - symlink manifest 거부
  - Worker JS/Wasm/font와 `wrangler.json` 바이트 무변경
- 기존 production verifier test의 forbidden absolute path case는 그대로 유지해 회귀 보호선으로 사용한다.

### 검증

```bash
node --test scripts/__tests__/finalize-sites-fullstack-artifact.test.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
test ! -e dist/server/.vite/manifest.json
rg -n '/Users/|/home/[^/[:space:]]+/|[A-Za-z]:\\\\Users\\\\' dist
git diff --check
```

- 마지막 `rg`는 빈 출력이어야 한다.
- final `dist/server`에 Worker JS, renderer Wasm 1개, font bin 4개, `index.js`, `wrangler.json`이 유지돼야 한다.
- Stage 1 diff는 finalizer, focused test, 필요한 package/local-smoke 연결과 Stage 1 보고서에 한정한다.

### 커밋

```text
Task #83 Stage 1: Sites production artifact local path 제거
```

## Stage 2 — exact local candidate와 archive preflight

### 산출물

신규:

- `mydocs/working/task_m100_83_stage2.md` (Stage 2 완료 시 `task-stage-report`로 작성)

수정:

- Stage 1 회귀에서 확인된 최소 test/build 연결 파일 — 변경이 필요한 경우 구현계획 보정 승인 후에만

원격 변경:

- 없음

### 변경 내용

- Stage 1 commit의 clean checkout에서 전체 test, E2E, production build와 두 verifier를 실행한다.
- 설치된 Sites `package-site.sh` helper로 final `dist/`, `.openai/hosting.json`, migration `1..5`를 임시 archive에 package한다.
- archive는 repository 밖 `mktemp -d` 경로에 만들고 검증 뒤 제거한다. path와 payload는 보고서에 기록하지 않는다.
- archive entry를 추출하지 않고 우선 목록으로 검사하고, 별도 임시 directory에 안전하게 풀어 다음을 확인한다.
  - `dist/server/index.js`, `dist/server/wrangler.json`, static client asset
  - `dist/.openai/hosting.json`
  - `dist/.openai/drizzle/0001...0005` exact set
  - `.vite/manifest.json`, absolute local path, credential, secret, test fixture literal 부재
- symlink, absolute archive entry, `..` path traversal과 unexpected top-level entry를 거부한다.
- artifact bytes, compressed archive bytes, file count, migration count와 SHA-256 digest만 Stage 2 보고서에 기록한다.
- Stage 2 보고서 commit 뒤 그 commit을 Stage 3 application candidate로 고정한다. Stage 3은 이 exact commit에서 다시 build/package하므로 Stage 2에서 만든 임시 archive 자체를 원격에 재사용하지 않는다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

추가 archive 검증:

- installed Sites helper package 성공
- archive entry가 `dist/`와 승인된 metadata/migration 경계 안에 있음
- migration filename이 정확히 `0001`~`0005`
- 절대 로컬 경로·credential·secret·fixture token 검색 결과 0건
- archive 생성·검증 뒤 임시 파일 정리

### 커밋

```text
Task #83 Stage 2: exact Sites candidate와 archive preflight
```

## Stage 3 — Gate A owner-only 배포와 전체 기능 smoke

### Gate A 1차 실행 관찰과 source 보정 Gate

2026-08-08 version 8 protected bridge는 service `maintenance`에서 anonymous
root/health `200`, 기존 profile/card와 일반 backend `503`을 확인했고 access를
즉시 owner-only로 복원했다. 그러나 read-only readiness는
`migration_not_ready`로 중단됐다. 실패 뒤 environment revision 61의
maintenance disabled/operator secret absent/service `normal`, owner 1명·추가
user/group 0명 owner-only와 version 8을 다시 private deploy했다.

Sites deployment 성공만으로 application `schema_migrations`가 exact `1..5`가
되지 않으므로 기능 smoke를 진행하지 않는다. 승인된 source 보정을 Stage 3
안에서 먼저 수행한다.

- production Worker entry가 `D1_MIGRATION_MANIFEST`의 exact SQL 5개를 Vite raw
  module로 bundle하고 maintenance service에만 주입한다.
- operator CLI에 `migrate` command를 추가한다. payload는 exact
  `{ operation: "migrate" }`만 허용하며 owner/data selector와 arbitrary SQL은
  받지 않는다.
- service는 apply 전에 current versions를 read-only 검사해 unexpected version을
  거부하고, existing idempotent D1 runner로 missing known migration만 순서대로
  적용한다. 결과는 applied/newly-applied version 배열만 반환한다.
- maintenance enabled, exact bearer, same-origin, bounded JSON과 generic error
  경계를 그대로 사용한다. disabled route는 계속 `404`다.
- local real-workerd에서 `1..2 → 1..5`, 재실행 no-op, unexpected version 무변경,
  인증/maintenance 실패와 readiness 후속 성공을 검증한다.
- source 보정 뒤 전체 test/E2E/production build/verifier/package를 다시 실행하고,
  새 exact source/새 saved version으로 Gate A deployment를 재개한다. version 8은
  source 보정 전 owner-only rollback target으로 유지한다.

version 9 첫 protected `migrate`는 generic `maintenance_unavailable`로 실패했고,
access revision 31 owner-only와 environment revision 63의 maintenance disabled,
operator secret absent, service `normal`로 즉시 복원해 같은 version을 private
deploy했다. local missing-schema 경로는 통과했으므로 Sites package migration이
물리 column을 선적용하고 application metadata만 누락한 hosted 상태를 별도로
보정한다.

- missing metadata `3..5`에 대해 known table column의 type, nullability, default,
  CHECK fragment를 read-only 검사한다.
- physical contract가 exact-match하면 SQL을 재실행하지 않고 metadata row만
  idempotent runner로 기록한다. column이 없으면 bundled SQL을 실행한다.
- column이 있으나 contract가 다르면 mutation 전 `maintenance_conflict`로
  중단한다. provider SQL이나 schema 원문은 응답·로그에 반환하지 않는다.
- real-workerd smoke는 `1..2` metadata + physical `3..5` 상태에서 metadata
  reconciliation, 재실행 no-op, unexpected version 무변경을 검증한다.
- deployed D1에서 provider-sensitive `PRAGMA table_info` 경로가 generic
  unavailable로 중단된 뒤에도 owner-only/revision 65 safe baseline을 복원했다.
  readiness와 같은 `sqlite_master` read 경계에서 normalized exact column DDL
  fragment를 판정하도록 inspection을 축소한다.
- version 11도 같은 generic unavailable로 중단됐고 owner-only access revision
  35, environment revision 67의 disabled/secret-absent/service `normal`과 같은
  version private deployment를 복원했다. 더 이상 schema 형태를 추측하지 않고
  inspection, reconciliation, apply, verification 네 경계를 고정된 503 코드로만
  식별한다. provider 오류·SQL·schema·identity 원문은 반환하지 않으며,
  `maintenance_conflict`와 `migration_not_ready` 응답 계약은 유지한다.
- version 12에서 고정 단계 코드는 `migration_apply_unavailable`을 확인했다. access
  revision 37 owner-only와 environment revision 69 disabled/secret-absent/service
  `normal`을 즉시 복원했다. 다음 후보는 migration runner가 mutation 전
  initialize/read와 exact version별 batch 시작만 알리는 callback을 사용하고,
  reconciliation 결과의 SQL 적용/metadata-only 여부와 결합한 bounded code만
  반환한다. SQL 및 provider 오류 원문은 계속 반환하지 않는다.
- version 13은 anonymous `/healthz` JSON 200 전파 확인 뒤
  `migration_apply_sql_v1_unavailable`을 반환했다. access revision 41 owner-only와
  environment revision 73 disabled/secret-absent/service `normal`을 복원했다.
  hosted physical schema 1~5·application metadata 0 상태를 새 local real-workerd
  fixture로 재현하고, base migration 1·2의 explicit table/index DDL 전체와 later
  additive column fragment를 exact-match한 경우에만 metadata-only reconciliation을
  허용한다. partial/drift schema는 metadata mutation 전 conflict로 중단한다.

### Gate A 승인 입력

원격 mutation 전에 다음 read-only 상태와 exact 변경 범위를 제시한다.

- Site project/title/canonical URL, 현재 access policy와 public revision
- 현재 saved version/deployment/source, environment revision과 secret을 제외한 key 존재 상태
- service `normal`, maintenance disabled, operator secret absent baseline
- source 보정 candidate commit, clean status, build/verifier 결과, archive digest/count/size
- 현재 D1 applied migration과 적용할 `3..5`, expected final `[1,2,3,4,5]`
- migration `3..5`의 saved version 8 backward-compatibility 근거와 application rollback target
- owner-only custom policy의 owner 1명, 추가 user/group 0개 exact rollback 값
- production OAuth callback과 runtime key 변경/유지 목록. secret plaintext는 표시하지 않음
- disposable QA owner/profile/token/session/usage/media 범위와 종료 cleanup count
- current Sites plan/quota와 추가 결제·자동 초과 과금 표시
- source push → exact rebuild/package → saved version 1회 저장 → private deploy → readiness → maintenance disable → smoke 순서
- 실패 시 public 미전환, owner-only 유지, previous saved version와 disabled/secret-absent 원복 절차

Gate A 승인 전에는 access, environment, D1/R2, source repository, version/deployment와 OAuth app을 변경하지 않는다.

### 산출물

외부 상태 변경:

- existing Site의 owner-only access policy
- exact source 보정 commit과 그 source의 saved version/deployment
- D1 migration `3..5`
- temporary maintenance mode/operator secret과 최종 disabled/secret-absent environment
- disposable QA owner/profile/token/session/usage/media

신규:

- `mydocs/working/task_m100_83_stage3.md` (Stage 3 완료 시 `task-stage-report`로 작성)

수정:

- `src/profile-runtime/sites/worker-entry.js`
- `src/profile-runtime/sites/worker.js`
- `src/profile-runtime/sites/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js`
- `scripts/sites-profile-maintenance.mjs`
- `scripts/__tests__/sites-profile-maintenance.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `docs/sites-operations.md`

### 실행 순서

1. Gate A 승인 시점의 Site/access/environment/version/quota를 다시 read-only 확인한다.
2. production public access를 승인된 custom owner-only policy로 전환하고 anonymous platform gate를 확인한다.
3. temporary source credential로 source 보정 exact commit을 push한다. credential은 URL, Git config, log와 문서에 저장하지 않는다.
4. exact commit에서 production build와 두 verifier를 재실행하고 Sites helper로 새 archive를 package한다.
5. source commit과 archive를 사용해 saved version을 한 번 저장하고 private deployment를 시작한다. 동일 version/deployment id를 terminal status까지 조회한다.
6. source 보정 candidate의 maintenance mode와 새 operator secret에 service `maintenance`를 함께 설정해 private deploy한다. `/healthz`와 operator route 외 backend가 generic `503`인지 확인한 뒤 access를 짧게 public으로 전환한다.
7. identity-less maintenance CLI `migrate`를 한 번 실행하고 바로 read-only `readiness`를 실행한다. `appliedVersions`와 `expectedVersions`가 exact `[1,2,3,4,5]`가 아니면 즉시 owner-only로 닫고 중단한다.
8. readiness 결과와 무관하게 먼저 access를 owner-only로 복원한다. 이어서 maintenance disabled, operator secret absent, service `normal`로 복원해 같은 version을 private deploy하고 operator route `404`, `/healthz` `200`을 확인한다.
9. 기존 production 소유자 데이터는 읽기 외에 사용하지 않는다. 별도 disposable GitHub 계정의 로그인 준비를 확인하고 service `owner-only`를 private deploy해 모든 public profile/card/social route가 동일 `404`인지 먼저 확인한다.
10. access를 짧게 public으로 전환해 packed CLI login/approve/exchange/submit/status/revoke와 OAuth/session/logout을 disposable 계정으로 검증한다. 이 bridge에서는 runtime `owner-only`가 기존·QA public profile/media를 계속 `404`로 닫아야 한다.
11. CLI bridge 직후 먼저 access를 owner-only로 복원하고 service `normal`을 private deploy한다. owner-authenticated browser 안에서 disposable 계정의 private preview와 card settings를 검증한다.
12. disposable profile publish 뒤 dark/light × en/ko README PNG와 social PNG의 GET/HEAD/If-None-Match 304를 protected 요청으로 확인한다. owner-authenticated Chrome·in-app browser와 protected request에서 owner-only Sites gate가 `/u/{handle}` HTML을 애플리케이션에 전달하지 않고 `/`로 `307` 전환하는 경계를 확인한다. 작업지시자가 승인한 계획 보정에 따라 canonical/OG/Twitter HTML 실측은 Stage 4 Gate B 필수 항목으로 이동한다.
13. private·missing PNG가 같은 `404`인지 대조하고 unpublish 뒤 모든 stable media가 404인지 확인한다. private·missing HTML fallback 동일성은 Stage 4 public access에서 확인한다.
14. recent error event에 query/credential/identity/usage bytes가 없음을 확인한다.
15. disposable profile을 private으로 두고 token/session을 revoke하며 Gate B에 필요한 최소 QA state만 승인된 범위로 남긴다.

### 검증

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run sites:profile-maintenance -- migrate \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- readiness \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
git diff --check
```

remote contract:

- deployment `succeeded`, saved version source == source 보정 candidate commit
- `appliedVersions == expectedVersions == [1,2,3,4,5]`
- maintenance disabled, operator secret absent, operator route `404`, health `200`
- OAuth/session/logout와 packed CLI submit/revoke 성공
- private preview `200`/no-store, private/missing public API·PNG `404`
- README PNG 4변형과 social PNG GET/HEAD/304, publish/unpublish ETag 계약
- owner-only Sites gate의 profile HTML `307 /` 경계와 Stage 4 canonical/OG/Twitter 실측 handoff
- artifact/response/header/recent error event의 secret·private data 비노출
- 추가 결제·plan upgrade·자동 초과 과금 요구 없음

### 중단·원복 조건

- deployment, migration/readiness, maintenance 비활성화, OAuth/CLI/media smoke 중 하나라도 실패한다.
- missing 또는 unexpected migration version이 있다.
- source SHA, archive와 saved version이 일치하지 않는다.
- private/missing handle 구분, credential/private usage 또는 provider 원문이 노출된다.
- Sites quota/plan이 추가 결제나 자동 초과 과금을 요구한다.

중단 시 public으로 진행하지 않는다. owner-only access를 유지하고 environment를 disabled/secret-absent로 복원한 뒤 operator route와 health를 확인한다. application rollback은 승인된 previous saved version만 사용하며 schema downgrade는 하지 않는다.

### 커밋

```text
Task #83 Stage 3: owner-only Sites candidate와 전체 smoke
```

## Stage 3.7 — Sites 호환 공유 문서 경로 보정

### Gate B 1차 실패와 복원 증적

2026-08-09 별도 승인된 Gate B에서 access를 public revision 46으로 전환했다.
anonymous landing `200`, private API `401`, missing public API·README·social media
`404`는 통과했지만 `/u/{handle}`과 trailing slash 변형은 모두 `Location: /`의
`307`이었다. canonical/OG/Twitter initial HTML과 revision을 측정할 수 없으므로
OAuth·submit·publish mutation 전에 release blocker로 중단했다.

access를 즉시 custom owner-only revision 47로 복원했고 owner 1명, 추가
user/group/external visitor 0명을 재확인했다. environment revision 77은 service
`normal`, maintenance disabled/secret-absent를 유지하며 anonymous health `401`,
protected health `200`, operator route `404`다. 새 token/session/usage/media mutation은
없었다. protected read-only 진단에서 `/?profile={handle}`은 `200`,
`/u/{handle}.html`과 `/u/{handle}/index.html`은 `404`였다.

### 승인된 보정 설계

1. public profile document request는 기존 `/u/{handle}` GET/HEAD와 함께 root의
   exact `profile` query를 인식한다. 빈 값, 중복/추가 path, invalid handle과
   card/social media path는 계속 거부한다.
2. canonical HTML share URL은 실제 Sites front door가 Worker에 전달하는
   `/?profile={handle}`로 생성한다. locale은 별도 query로 추가되더라도 canonical은
   handle만 포함한다.
3. `og:image`와 Twitter image는 HTML URL에 경로를 이어 붙이지 않고 기존
   `/u/{handle}/social.png?v={revision}`을 독립 생성한다. README 카드 URL과 ETag,
   stable R2 key는 변경하지 않는다.
4. Share Studio의 복사·X·Threads·LinkedIn·Facebook·Reddit 대상은 같은 query
   share URL을 사용한다. 공개 화면에서 GitHub OAuth를 시작하면 기존
   current-location redirect가 query를 그대로 보존한다.
5. Node/dev는 기존 `/u/{handle}` 문서도 계속 처리한다. 이 경로는 Sites에서
   public 링크로 안내하지 않을 뿐 하위 호환 source 계약을 삭제하지 않는다.
6. 공식 문서는 Gate B 실측 사실과 Sites용 query canonical을 반영하되 Gate C 전
   README CTA와 영구 public 상태는 활성화하지 않는다.

### 예상 변경 파일

- `src/profile-runtime/public-profile-document.js`
- `src/profile-runtime/open-graph.js`
- `src/profile-runtime/__tests__/public-profile-document.test.js`
- `src/profile-runtime/__tests__/open-graph.test.js`
- `src/profile-runtime/sites/backend.js`
- `src/profile-runtime/sites/worker.js`
- `src/profile-runtime/sites/__tests__/backend.test.js`
- `src/profile-runtime/sites/__tests__/full-stack.test.js`
- `src/profile-ui/shareStudio.js`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `src/profile-ui/__tests__/accountUi.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `tests/profile-ui.spec.js`
- `docs/sites-operations.md`
- `docs/production-hosting.md`
- `docs/readme-card.md`
- `README.md`
- `mydocs/working/task_m100_83_stage3_7.md`

### 검증

- query/path GET·HEAD 판별, POST/media/invalid query 폴스루
- public query document의 canonical·`og:url`·Twitter metadata와
  `/u/{handle}/social.png?v=` 분리
- private/missing query HTML의 byte-identical fallback
- Share Studio target 전체가 encoded `/?profile={handle}` 사용
- current-location OAuth redirect가 query를 보존
- real Worker·D1·R2·ASSETS full-stack smoke에서 public query GET/HEAD와
  handle별 metadata를 검증
- focused Node tests, 전체 test/E2E/build/full-stack/production artifact 검증
- source commit 뒤 새 owner-only saved version에서 protected query HTML `200`과
  `/u/{handle}` front-door `307` 경계를 함께 확인

### 커밋

```text
Task #83 [Stage 3.7]: Sites 호환 공유 문서 경로 보정
```

## Stage 3.8 — Worker 전달 공유 문서 경로 보정

### Stage 3.7 owner-only production 반증

Stage 3.7 exact source commit의 owner-only saved version 15 배포와 provenance 확인은
성공했다. custom owner-only, 허용 사용자 1명, group/external visitor 0명,
service `normal`, maintenance disabled/secret-absent baseline도 유지됐다.

그러나 protected `/?profile={handle}` GET/HEAD `200`은 동적 metadata 없이 정적
`index.html`을 반환했고 해당 root query는 Worker request event에 나타나지 않았다.
같은 version에서 `/u/{handle}`은 Worker event와 동적 fallback canonical/OG/Twitter를
반환했으며 `/api/profiles/public/{handle}`도 Worker에서 `404`를 반환했다. 따라서
root query가 Worker로 전달된다는 Stage 3.7 가정은 production에서 반증됐다.
release blocker 확인 직후 readiness bridge와 Gate B는 시작하지 않았고 원격은
owner-only safe baseline을 유지한다.

### 승인된 보정 설계

1. canonical HTML share URL은 Sites production에서 Worker 전달이 확인된 exact
   `/api/share/{handle}` GET/HEAD를 사용한다.
2. public profile document handler는 API share path를 기존 `/u/{handle}`과 root
   query보다 우선하지 않고 병렬 하위 호환 route로 인식한다. POST, 추가 path,
   invalid handle과 media URL은 계속 거부한다.
3. Share Studio, frontend public profile route, OAuth current-location redirect와
   Open Graph canonical/`og:url`은 API share path를 사용한다.
4. README card와 social image는 각각 `/u/{handle}/card.png`,
   `/u/{handle}/social.png?v={revision}`을 유지한다. API JSON route, R2 key,
   ETag와 publish/unpublish 계약은 변경하지 않는다.
5. observability는 `/api/share/{handle}`을 identity-less `public_profile` class로
   축약하고 raw handle을 application event에 기록하지 않는다.
6. 공식 문서는 Stage 3.7 production 반증과 API share canonical을 반영하되,
   owner-only 재배포와 별도 Gate B 전 production CTA는 활성화하지 않는다.

### 예상 변경 파일

- `src/profile-runtime/public-profile-document.js`
- `src/profile-runtime/open-graph.js`
- `src/profile-runtime/sites/observability.js`
- `src/profile-runtime/__tests__/public-profile-document.test.js`
- `src/profile-runtime/__tests__/open-graph.test.js`
- `src/profile-runtime/sites/__tests__/backend.test.js`
- `src/profile-runtime/sites/__tests__/observability.test.js`
- `src/profile-runtime/sites/__tests__/full-stack.test.js`
- `src/profile-ui/shareStudio.js`
- `src/profile-ui/publicProfileRoutes.js`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `src/profile-ui/__tests__/publicProfileRoutes.test.js`
- `src/profile-ui/__tests__/accountUi.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `tests/profile-ui.spec.js`
- `README.md`
- `docs/sites-operations.md`
- `docs/production-hosting.md`
- `docs/readme-card.md`
- `mydocs/working/task_m100_83_stage3_8.md`

### 검증

- API share/path/query GET·HEAD 판별, POST/media/invalid path 폴스루
- public API share document canonical·`og:url`·Twitter metadata와
  `/u/{handle}/social.png?v=` 분리
- private/missing API share HTML의 byte-identical fallback
- Share Studio target과 frontend route가 encoded `/api/share/{handle}` 사용
- current-location OAuth redirect가 API share path를 보존
- observability가 raw handle 없이 `public_profile`로 축약
- real Worker·D1·R2·ASSETS full-stack smoke에서 API share GET/HEAD와 handle별 metadata
- focused Node tests, 전체 test/E2E/build/full-stack/production artifact 검증
- source commit 뒤 새 owner-only saved version에서 protected API share initial HTML exact-match

### 커밋

```text
Task #83 [Stage 3.8]: Worker 전달 공유 문서 경로 보정
```

## Stage 3.9 — social preview 자산 가용성 보정

### Gate B 2차 production 반증

Stage 3.8 exact source의 owner-only saved version 16 배포와 provenance, protected
`/api/share/{handle}` GET/HEAD metadata 및 migration readiness `[1,2,3,4,5]`는
통과했다. Gate B 재승인 뒤 public access revision 48에서 anonymous landing
`200`, private API `401`, missing API/media `404`, public API share GET/HEAD `200`과
canonical/OG/Twitter metadata가 통과했다.

그러나 기존 version 7 publication의 README stable card는 `200`이지만 metadata가
선언한 stable/versioned social PNG는 모두 `404`였다. missing API share fallback도
`MARKETING_OPERATOR_CARD_HANDLE`의 같은 social object를 선언해 깨진 preview를
반환했다. application event는 해당 social route를 `asset`으로 분류했다. X·Threads·
카카오톡 요청과 disposable mutation은 시작하지 않고 public access를 revision 49의
custom owner-only로 즉시 복원했다. 최종 기준선은 허용 사용자 1명, group/external
visitor 0명, anonymous `401`, protected health `200`, operator route `404`, service
`normal`, maintenance disabled/secret-absent다.

### 승인된 보정 설계

1. store public profile projection 뒤 media store의 dark stable authority와 social
   object metadata를 body 없이 읽는다. owner id와 publication id가 일치할 때만
   personalized `/u/{handle}/social.png?v={revision}`을 metadata에 선언한다.
2. legacy publication, social renderer 미지원 결과, missing/private profile 또는
   media read 실패는 실제 계정 mutation과 on-demand R2 write 없이 packaged
   `/assets/codex-social-sample.png`으로 fail closed한다.
3. static fallback은 기존 sample view model과 renderer로 결정적으로 생성한
   2400x1260 PNG이며 OG/Twitter width·height·type 선언과 byte identity를 검증한다.
4. README card/public API/visibility/R2 publication·ETag 계약은 변경하지 않는다.
   personalized social route 자체가 missing이면 계속 동일 `404`다.
5. `social.png` GET/HEAD의 application observability는 raw handle 없이
   `public_card`로 축약한다.
6. 실제 production 소유자의 settings, usage, visibility를 backfill 목적으로
   변경하지 않는다. 새 owner-only 배포와 protected asset 검증 뒤 Gate B를 다시
   승인받는다.

### 예상 변경 파일

- `public/assets/codex-social-sample.png`
- `scripts/generate-social-sample.mjs`
- `src/profile-card/__tests__/social-sample-asset.test.js`
- `src/profile-runtime/public-profile-resolver.js`
- `src/profile-runtime/open-graph.js`
- `src/profile-runtime/public-profile-document.js`
- `src/profile-runtime/sites/worker.js`
- `src/profile-runtime/dev-server.js`
- `src/profile-runtime/production-server.js`
- `src/profile-runtime/sites/observability.js`
- `src/profile-runtime/__tests__/public-profile-resolver.test.js`
- `src/profile-runtime/__tests__/open-graph.test.js`
- `src/profile-runtime/__tests__/public-profile-document.test.js`
- `src/profile-runtime/sites/__tests__/observability.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `docs/sites-operations.md`
- `docs/production-hosting.md`
- `docs/readme-card.md`
- `mydocs/working/task_m100_83_stage3_9.md`

### 검증

- generated sample asset과 source renderer 결과의 byte equality, PNG 2400x1260
- coherent authority/social publication은 personalized versioned image URL
- legacy/missing/mismatched/error social state는 packaged static fallback URL
- missing/private HTML byte-identical fallback과 static asset `200 image/png`
- personalized social route missing `404`를 HTML의 static fallback `200`과 분리
- social GET/HEAD observability의 identity-less `public_card` 분류
- real Worker·D1·R2·ASSETS full-stack smoke와 전체 Node/E2E/build/verifier
- source commit 뒤 owner-only saved version에서 legacy API share initial HTML이
  존재하는 fallback asset만 선언하는지 protected exact-match

### 커밋

```text
Task #83 [Stage 3.9]: social preview 자산 가용성 보정
```

## Stage 3.10 — Sites 소유자 프로필 경로 보정

### Stage 4 종료 전 production 결함

Stage 3.9 exact source의 Gate B cache·OG·social 측정과 disposable cleanup 뒤 access는
custom owner-only로 복원됐다. 복원 상태에서 인증된 계정 메뉴의 **프로필** 링크가
`/profile`을 전체 navigation으로 요청하고, Sites front door가 extension 없는 이
경로를 application `index.html`로 전달하지 않아 `/` 홈으로 돌아가는 결함을
확인했다.

설정 메뉴의 `/?view=settings`와 device approval의 `/?view=device`는 같은 Sites
제약을 root-query route로 회피하지만 owner profile만 legacy path를 생성한다.
`/api/share/{handle}`이나 Gate B cache 결과가 원인은 아니며, Stage 3.7·3.8에서
확정한 Sites application route 제약이 소유자 화면 진입점에도 적용된 누락이다.
기본 계정 메뉴, 로그인 복귀와 기기 승인 후 profile 진입이 홈으로 이탈하므로
#84 release candidate 승격 전에 #83의 owner-only 기능 smoke 결함으로 보정한다.

### 승인 요청 보정 설계

1. Sites canonical owner profile href를 `/?view=profile`로 고정하고 UI에서 재사용할
   route 상수를 둔다. broad client-router 도입이나 history state 전환은 수행하지
   않는다.
2. root pathname에서 `view=profile`을 `OWNER_PROFILE`로 해석한다. 기존
   `?profile={handle}` public compatibility query보다 먼저 explicit `view`를
   판정해 두 query 계약이 충돌하지 않게 한다.
3. account menu, owner profile 로그인 CTA, public 화면의 create/my-profile CTA와
   device approval 완료 link가 canonical owner route만 생성하도록 변경한다.
4. OAuth `redirect_to`와 CLI status의 `profileUrl`도 query와 fragment를 보존하는
   `/?view=profile`로 변경한다. local redirect 검증의 same-origin 보호 규칙은
   완화하지 않는다.
5. `/profile` route 해석과 Node/dev direct navigation test는 하위 호환으로
   유지한다. 기존 `/profile` 문자열을 일괄 치환하지 않고 사용자에게 전달되는
   href·redirect·metadata만 변경한다.
6. public profile document, `/api/share/{handle}`, README/social PNG, cache/ETag,
   D1/R2 schema와 visibility 계약은 변경하지 않는다. 따라서 Gate B public
   cache·SNS 전체 smoke는 재실행하지 않는다.
7. source 검증 뒤 별도 승인으로 exact source owner-only saved version을 배포하고
   protected `/?view=profile` rendering, 계정 메뉴 href, 로그인 URL의
   `redirect_to`, device/public CTA와 safe environment baseline만 집중 확인한다.

### 예상 변경 파일

- `src/profile-ui/appRoutes.js`
- `src/profile-ui/AccountMenu.jsx`
- `src/profile-ui/cardShare.js`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/DeviceApprovalPage.jsx`
- `src/profile-backend/http.js`
- `src/profile-ui/__tests__/appRoutes.test.js`
- `src/profile-ui/__tests__/cardShare.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `tests/profile-ui.spec.js`
- `docs/readme-card.md`
- `docs/cli-submit.md`
- `mydocs/working/task_m100_83_stage3_10.md`

### 검증

- `/?view=profile`은 owner profile, `/?view=settings`는 settings,
  `?profile={handle}`은 public profile로 서로 다르게 resolve
- account menu, authenticated/anonymous public CTA와 device success link의
  canonical owner href
- owner profile GitHub login URL과 OAuth callback의 `redirect_to` query roundtrip
- CLI submit/status metadata의 absolute owner `profileUrl`
- `/profile` Node/dev legacy route와 direct E2E 호환 유지
- focused Node/UI E2E 뒤 전체 test/E2E/build/full-stack/production verifier
- exact source owner-only deployment에서 protected query route와 anonymous Sites
  gate, readiness `[1,2,3,4,5]`, maintenance disabled/secret-absent, operator `404`
- `git diff --check`

### 중단·원복 조건

`view=profile`이 public profile query와 충돌하거나 OAuth redirect가 root 이외로
이탈하고, owner profile 외 public/backend 계약 diff가 생기면 구현을 중단하고
계획 범위를 다시 승인받는다. owner-only 배포가 실패하면 public으로 전환하지
않고 기존 Stage 3.9 saved version과 exact owner-only access/environment baseline을
유지한다.

### 커밋

```text
Task #83 [Stage 3.10]: Sites 소유자 프로필 경로 보정
```

## Stage 4 — Gate B public cache 실측과 baseline 원복

### Gate B 승인 입력

public access를 열기 전에 다음을 제시한다.

- Stage 3.9 saved version/deployment/source, protected fallback asset과 readiness
  exact-match 증적
- Gate B 1차 `/u/{handle} → /` `307` 실패, 즉시 owner-only 복원과
  Stage 3.7 root query 정적 우회와 `/api/share/{handle}` 보정의 protected exact metadata 증적
- current owner-only access policy와 public으로 바꿀 exact access, 즉시 복원할 owner-only 값
- maintenance disabled, operator secret absent, operator route `404`, health `200`
- disposable test profile/private state, 일회용 token/session과 종료 cleanup scope
- 측정할 exact `/api/share/{handle}`·README/social URL과 redacted 관찰 항목
- 반복 GET/HEAD 및 submit 전·직후·경과 후 측정 순서
- success/failure 모두 public에서 즉시 owner-only로 복원하는 절차
- current plan/quota와 추가 결제·자동 초과 과금 표시

Gate B 승인 전에는 access를 public으로 변경하지 않는다.

### 산출물

외부 상태 변경:

- 제한된 시간의 public access와 즉시 복원된 owner-only policy
- 검증 중 생성·갱신 후 정리된 disposable profile/token/session/D1/R2 state

신규:

- `mydocs/working/task_m100_83_stage4.md` (Stage 4 완료 시 `task-stage-report`로 작성)

수정(실제 운영 사실이 바뀐 경우에만):

- `docs/sites-operations.md`
- `docs/production-hosting.md`
- `docs/readme-card.md`

### 실행 순서

1. Gate B 승인 상태를 재확인하고 test profile을 private, token/session을 새 일회성 값으로 준비한다.
2. public access로 전환한다.
3. anonymous landing, private API `401/403`, private/missing profile/card/social `404`와 동일 HTML fallback을 확인한다.
4. OAuth/CLI submit과 publish를 수행하고 README PNG 4변형, social PNG, canonical HTML/metadata 공개 계약을 확인한다.
5. 같은 `/api/share/{handle}`에 GET/HEAD를 반복하며 timestamp와 bounded `CF-Cache-Status`, `Age`, `x-request-id`, `Cache-Control`, `og:image?v=`만 기록한다.
6. 다음 usage submit 전, 직후, 짧은 경과 후 HTML `og:image?v=`와 social PNG ETag/304를 대조한다.
7. cache header가 없거나 always dynamic이어도 application revision이 즉시 갱신되고 privacy/publish 계약이 맞으면 비차단으로 분류한다.
8. stale HTML이 private 전환 뒤 공개되거나 다른 handle 응답이 섞이거나 revision이 계약 시간 안에 갱신되지 않으면 release blocker로 분류하고 후속 공개를 중단한다.
9. 측정 직후 unpublish/private, token/session revoke와 disposable D1/R2 cleanup을 수행한다.
10. access를 exact owner-only policy로 복원하고 anonymous platform auth gate를 확인한다.
11. maintenance disabled, operator secret absent, operator route `404`, health `200`과 recent error event 비노출을 재확인한다.
12. 장기 운영 사실이 달라진 경우에만 승인된 공식 문서의 현재 상태 절을 최소 갱신한다. README placeholder와 production CTA는 활성화하지 않는다.

### 검증

- public anonymous landing과 private-by-default 경계
- private/missing HTML fallback 동일성, README/social PNG 동일 404
- publish 뒤 README PNG 4변형과 social PNG GET/HEAD/304
- canonical/OG/Twitter metadata와 `og:image?v=` revision
- repeated request의 bounded cache header 시계열
- submit 직후·경과 후 HTML revision과 social ETag 신선도
- unpublish/private 뒤 모든 public media 404
- exact owner-only access 복원과 anonymous platform gate
- revoked token/session, disposable owner/usage/media 0건
- maintenance disabled/secret absent, operator route 404, health 200
- recent error event의 query/credential/identity/usage bytes 비노출
- `git diff --check`

### cache 판단 기준

- **release blocker**: private/missing 존재 노출, handle 간 응답 혼합, publish/unpublish 불일치, submit 뒤 HTML revision과 social media가 계약대로 갱신되지 않음.
- **비차단 후속 후보**: application은 정확하지만 shared cache가 비활성이라 D1 비용 최적화 여지가 있거나, 외부 platform cache의 갱신 지연만 관찰됨.
- 후속 최적화가 필요하면 측정된 header/요청 수와 안전 경계를 사용해 별도 Issue 후보를 작성하되, 이 Stage에서 cache source를 수정하지 않는다.

### Stage 4 완료 결과

- Stage 3.9 exact source `4541e3be7fc1dce6d7e54bbe01ce279d1ceba05f`의
  saved version 17에서 최종 Gate B를 실행했다. anonymous/private/missing 경계,
  README dark/light × en/ko, canonical OG/Twitter, personalized/fallback social
  GET/HEAD/304와 publish/unpublish 계약이 통과했다.
- 반복 요청과 submit 전후 측정에서는 shared-cache HIT나 stale `Age` 증거가 없었다.
  application revision과 media ETag는 즉시 갱신됐으므로 cache source 변경과 별도
  최적화 이슈를 release blocker로 분류하지 않는다.
- X 링크 카드의 실제 표시는 작업지시자가 정상으로 확인했다. 플랫폼의 장기 scraper
  cache와 투명 여백 합성 색은 provider 동작이므로 이 Stage에서 media source를
  보정하지 않는다.
- 측정 종료 뒤 public publication, 일회용 token/session, disposable D1/R2와 local
  credential을 정리하고 custom owner-only policy로 복원했다.
- Stage 3.10 exact source `e431cc88ba73b02341a170fe5c38117d4552e42a`는 saved
  version 18로 owner-only 배포했다. protected `/?view=profile`, 계정 메뉴, public
  CTA와 실제 OAuth 복귀를 확인했고 readiness는 `[1,2,3,4,5]` exact-match다.
- 최종 safe baseline은 access revision 56, owner 1명·추가 user/group 0명,
  environment revision 85, maintenance disabled/operator secret absent/service normal,
  health `200`, operator route `404`다. anonymous root와 owner query는 Sites access
  gate에서 `401`이다.
- Stage 3.10은 public profile/cache/OG/media source를 변경하지 않았으므로 public
  Gate B를 반복하지 않았다. permanent public Gate C와 `main` 릴리스는 #84에서
  수행한다.

### 커밋

```text
Task #83 Stage 4: public cache 실측과 owner-only 원복
```

## Stage 4.1 — 카드 readiness·Skeleton·motion 회귀 보정

### 발견 근거와 범위

version 18 owner-only 후보의 실제 브라우저 검증에서 다음 순서를 재현했다.

1. 공개 profile JSON을 기다리는 동안 카드 구조와 무관한 72px 원형 indicator가 보인다.
2. JSON과 card URL이 준비되면 `PublicCardIntro`가 즉시 mount되고 900ms Y축 회전을
   시작한다.
3. card PNG가 아직 `load`·`decode`되지 않아 alt text, 빈 어두운 면 또는 부분
   렌더링된 card가 회전한다.
4. 소유자 profile의 theme/locale draft와 Share Studio도 같은 card readiness를
   소비하지 않아 지연 중 상태와 motion 시작 시점이 일관되지 않는다.

홈은 이미 pending image preload, last-ready source와 exact card Skeleton을 가지지만
다른 surface는 `MarketingCardPreview`의 기본 `ready` 상태 또는 raw `<img>`를 사용한다.
Stage 4.1은 이를 공통 계약으로 통합하고 #84 영구 공개 전에 release blocker를 닫는다.

### 산출물

신규(공통 상태를 기존 module에 안전하게 수용할 수 없을 때만):

- `src/profile-ui/cardImageReadiness.js`
- `src/profile-ui/__tests__/cardImageReadiness.test.js`

수정:

- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-ui/homeCardTransition.js`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/PublicCardIntro.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/useCardHandoffMotion.js` — readiness input이 공통 hook 경계에
  필요한 경우에만
- `src/profile-card/service-core.js` — focused 측정으로 unique render/in-flight 또는
  avatar cache key 문제가 확인된 경우에만
- `src/styles.css`
- `tests/profile-ui.spec.js`
- 관련 focused Node test
- `mydocs/working/task_m100_83_stage4_1.md`
- `mydocs/orders/20260811.md`

보호 대상:

- private preview `Cache-Control: private, no-store`
- public card/social ETag와 `no-cache, must-revalidate`
- `/api/share/{handle}` canonical/OG/Twitter와 cache header
- D1/R2 publication ordering, visibility와 atomicity
- card PNG bytes, theme/locale URL contract와 `499 / 306` 비율

### 변경 내용

1. 동적 card source마다 monotonically increasing generation을 만든다. 최초 source는
   `visible=null`, `status=loading`이며 exact card 비율 Skeleton으로 공간을 예약한다.
2. 새 source는 pending image로 preload한다. `load` 뒤 `decode()`가 지원되면 decode까지
   기다리고, 현재 generation과 일치할 때만 `visibleSrc`로 commit한다. 이전 generation의
   늦은 완료·실패는 무시한다.
3. source 교체 중 last-ready image가 있으면 DOM에서 보존하고 Skeleton/neutral busy
   layer로 pending 상태를 알린다. 준비 전 새 bitmap이나 alt text는 노출하지 않는다.
4. 공통 preview는 `loading`, `ready`, `error`를 `aria-busy`, polite status와
   `data-card-status`로 제공한다. error 시 last-ready가 있으면 유지하고, 최초 load
   error면 고정 fallback을 표시해 무한 shimmer를 막는다.
5. 공개 profile JSON loading은 handle·identity를 노출하지 않는 profile/card 구조형
   Skeleton으로 교체한다. unavailable/private-owner 결과 상태는 기존 copy와 action을
   유지한다.
6. `PublicCardIntro` dialog와 Skeleton은 즉시 렌더할 수 있지만 flip의 active 조건은
   해당 generation의 card `ready`다. ready 전 spatial animation·tilt·beam을 실행하지
   않고, ready 뒤 opening은 한 번만 실행한다.
7. Share Studio도 공통 card frame 또는 동일 readiness hook을 사용한다. source handoff는
   image ready 뒤 시작하고 error에서는 stable fallback으로 settle한다.
8. 소유자 profile theme/locale 변경은 last-ready card를 유지한 채 새 variant를 준비한다.
   save/share action은 최신 draft generation과 저장 상태를 사용하며 이전 image 완료가
   최신 선택을 되돌리지 못한다.
9. reduced-motion에서는 flip/handoff를 생략하고 decoded image를 즉시 교체하거나
   140ms 이하의 opacity transition만 허용한다. Skeleton shimmer도 기존처럼 중단한다.
10. private preview 요청을 실제 후보와 local instrumentation으로 측정한다. 동일
    owner/usage/theme/locale의 중복 renderer 실행과 concurrent miss가 증명되면 bounded
    in-flight dedupe/LRU key를 최소 보정한다. avatar cache는 avatar 자체 식별자·URL과
    필요한 owner identity만 사용해 card setting 변경으로 불필요하게 무효화되지 않게
    하되, stale avatar를 허용하지 않는다.
11. card settings 저장은 D1/R2 일관성 완료 뒤에만 성공을 반환하는 기존 계약을
    유지한다. UI는 saving 상태를 명확히 표시하고 server work를 비동기로 가장해
    성공을 조기 반환하지 않는다.

### 검증

focused state/unit:

- initial source `loading → ready`, source change의 last-ready 보존
- 빠른 dark/light/locale 연속 변경에서 최신 generation만 commit
- `load` 뒤 decode 대기와 decode rejection/error fallback
- source 제거/unmount 뒤 pending completion 무시
- private/public source validation과 기존 home transition 회귀 부재

Playwright E2E:

- public profile JSON이 delayed인 동안 identity-free 구조형 Skeleton과 card 비율 유지
- card PNG가 delayed인 동안 intro phase가 preparing이고 flip animation 0개
- response release와 `naturalWidth > 0`/decode 뒤 opening 1회, Skeleton fade-out
- failed card에서 alt text flip·무한 Skeleton 없이 fallback과 정상 close action
- owner profile 최초 load 및 theme/locale source 변경에서 last-ready image 보존,
  latest source만 표시
- Share Studio delayed/error image의 handoff gate와 fallback settle
- `prefers-reduced-motion: reduce`에서 spatial flip/handoff 미실행
- desktop/mobile aspect-ratio, layout shift와 horizontal overflow 부재

성능·계약:

- cold/warm dark/light owner preview ready timing을 동일 조건으로 전후 비교
- 동일 pending source의 renderer 중복 수와 avatar cache hit/miss focused assertion
- private preview `private, no-store`, public card/social ETag/cache header exact 불변
- D1/R2 publication, visibility와 README/social 4 variant focused 회귀

전체:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

owner-only remote 집중 smoke는 새 exact source saved version을 별도 승인 후 배포해
protected `/api/share/{handle}` 첫 진입, profile theme/locale draft, intro/Share Studio
loading·motion과 final safe baseline만 확인한다. permanent public Gate C와 disposable
profile publication은 #84에 유지하며, public cache·OG·SNS Gate B 전체 mutation은
public backend/media 계약이 불변이면 반복하지 않는다.

### 중단·원복 조건

- card bytes/URL, private/public cache header, D1/R2 publication 계약이 변경된다.
- last-ready card가 다른 owner/source와 혼합되거나 private card가 public surface에
  재사용된다.
- error에서 무한 loading이 남거나 ready 전 motion을 시작한다.
- source race가 최신 theme/locale 선택을 덮는다.
- 성능 보정이 stale private data 또는 settings success 조기 반환을 요구한다.

중단 시 UI 공통 readiness 범위로 되돌려 계획을 다시 승인받는다. owner-only 배포가
실패하면 access를 public으로 바꾸지 않고 saved version 18, access revision 56,
environment revision 85의 safe baseline을 유지한다.

### 커밋

```text
Task #83 [Stage 4.1]: 카드 readiness와 motion 회귀 보정
```

## Stage 4.2 — avatar 복구성과 card resource 재사용 보정

### 발견 근거와 범위

- production 후보에서 계정 UI의 GitHub avatar는 정상인데 server-rendered card만
  initials fallback을 사용한다. avatar source URL과 원본 응답은 유효하지만 loader가
  fetch/timeout/response 실패를 모두 `null`로 축약하고 그 실패까지 LRU에 저장해 hosted
  실패 원인을 구분할 수 없고 transient failure가 고착될 수 있다.
- Stage 4.1 공통 readiness는 hook instance 안에서만 object URL을 유지한다. 동일 document
  runtime에서 다른 component가 같은 source를 acquire하거나 Share Studio를 닫았다 다시
  열면 새 fetch/decode가 발생한다. 전체 document navigation은 module memory를 초기화하므로
  이 Stage의 재사용 범위가 아니며, private `no-store`를 완화하거나 persistent storage를
  추가하지 않는다.

### 산출물

수정:

- `src/profile-card/service-core.js`
- `src/profile-card/service.js`, `src/profile-card/index.js` — 새 bounded default export가
  필요한 경우에만
- `src/profile-card/__tests__/service.test.js`
- `src/profile-backend/http.js`
- `src/profile-runtime/sites/backend.js`
- `src/profile-runtime/sites/worker.js`
- `src/profile-runtime/sites/maintenance.js` — repair 경로도 같은 observer를 사용할 때만
- `src/profile-runtime/sites/observability.js`
- `src/profile-runtime/sites/__tests__/observability.test.js`
- `src/profile-ui/cardImageReadiness.js`
- `src/profile-ui/__tests__/cardImageReadiness.test.js`
- `src/profile-ui/HomePage.jsx`
- `src/profile-marketing/MarketingLanding.jsx` — home의 original source metadata와 Blob
  display source를 분리할 때만
- `src/App.jsx`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260811.md`

신규:

- `mydocs/working/task_m100_83_stage4_2.md` (Stage 완료 시 `task-stage-report`로 작성)

### 서버 avatar 변경

1. timeout은 bounded 5초로 유지하고 retry count 기본값을 1로 둔다. network/timeout,
   `408/425/429/5xx`만 재시도하며 content type·size·body·non-retryable status 실패는 즉시
   initials fallback으로 settle한다.
2. 성공한 non-empty supported image bytes만 avatar LRU에 저장한다. 실패 `null`은 저장하지
   않아 다음 독립 render가 다시 시도할 수 있어야 한다.
3. avatar cache key는 normalized GitHub URL 기준으로 두고 bounded TTL을 추가해 card
   theme/locale/settings의 owner revision 변경이 avatar bytes를 불필요하게 무효화하지
   않게 한다. TTL 만료 뒤에는 같은 URL도 다시 확인해 실제 avatar 변경이 영구 stale하지
   않게 한다.
4. failure observer payload는 exact `{ errorCode, attempt, retrying }` bounded field만
   노출한다. avatar URL, owner/provider id, handle, response body/status 원문과 caught error는
   포함하지 않으며 observer failure가 card 응답을 바꾸지 않는다.
5. Sites는 기존 bounded event writer로 별도 `profile_card_avatar` event를 기록한다.
   request event schema는 변경하지 않는다.

### client resource cache 변경

1. `cardImageReadiness` 아래 module-level resource cache를 둔다. cache entry는 normalized
   same-origin source, private owner scope, source kind, decoded object URL, pending promise,
   refcount, last-used와 expiry를 보유한다.
2. 동일 key의 concurrent/sequence acquire는 fetch와 decode를 1회만 수행한다. component
   release는 refcount만 줄이고 object URL은 TTL/LRU eviction 또는 explicit clear 때 revoke한다.
3. owner source는 non-empty owner scope를 key에 강제해 다른 account와 공유하지 않는다.
   auth owner 변경·logout에서 owner entry를 clear/abort하고 public resource는 유지한다.
4. source URL의 theme/locale/revision은 기존 URL key를 그대로 사용하므로 variant 변경은
   새 resource다. failure와 aborted load는 cache하지 않고 다음 acquire에서 재시도한다.
5. max entry와 TTL을 bounded constant로 두며 local/session storage, Cache Storage,
   IndexedDB, Service Worker를 사용하지 않는다. full document navigation 뒤에는 기존
   private/public HTTP cache와 server renderer cache 계약이 계속 적용된다.
6. 홈 transition도 같은 acquire API를 사용하되 기존 operator → owner/sample fallback,
   logout stale-generation 차단과 last-ready 상태 machine은 유지한다. DOM `img`에는 decoded
   Blob URL을 사용하고 `data-card-source-url`에는 canonical 원본 source를 보존한다.

### 검증

focused Node:

- avatar 첫 network failure 뒤 두 번째 성공과 bytes render
- 최종 failure fallback 뒤 다른 card source render가 다시 fetch해 failure가 cache되지 않음
- invalid content/oversize/non-retryable status는 retry하지 않음
- avatar success cache가 settings revision 변경에도 유지되고 TTL 뒤 재확인
- observer exact field, observer throw 무해성과 URL/identity/error 원문 비노출
- resource same-key sequential/concurrent acquire의 fetch/decode 1회
- release 뒤 TTL 내 재acquire, TTL/LRU/explicit clear의 exact-once revoke
- owner scope·variant/revision 분리, failure eviction과 pending clear abort

Playwright:

- home의 decoded Blob display와 canonical `data-card-source-url`, 기존 fallback/logout 계약
- Share Studio close/reopen의 동일 public source request 1회
- public profile resting/intro의 shared decoded resource와 motion gate 회귀 부재
- owner profile draft latest-generation, Skeleton/last-ready와 owner scope clear 회귀 부재
- local/session storage에 private URL/blob/owner 값이 기록되지 않음

전체:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

원격 owner-only 재배포는 Stage 4.2 exact source commit과 전체 검증 결과를 제시해 별도
승인받은 뒤 수행한다. 이 Stage source 보정만으로 access, D1/R2, OAuth 또는 saved version을
변경하지 않는다.

### 중단·원복 조건

- private/public response cache header나 publication atomicity를 변경해야 한다.
- owner scope가 없는 private resource가 재사용되거나 logout 뒤 owner bitmap이 표시된다.
- cache hit가 최신 source generation을 덮거나 error를 고착시킨다.
- observer가 URL·identity·provider error 원문을 내보내거나 logging failure가 응답을 바꾼다.

### 커밋

```text
Task #83 [Stage 4.2]: avatar 복구와 card resource cache 보정
```

## Stage 4.3 — hosted avatar 호환과 공유 handoff 연속성 보정

### 발견 근거와 범위

- saved version 19의 avatar 원본 URL은 hosted 환경에서 `200 image/jpeg`이지만 같은
  Workerd fetch에 `redirect: "error"`를 지정하면 response 전에 `TypeError`가 발생한다.
  `redirect: "manual"`은 정상 response를 반환하며, 기존 allowlisted HTTPS host와
  `response.ok` 검사를 유지하면 3xx를 따라가지 않고 fail closed할 수 있다.
- Home·owner profile은 owner preview를 이미 decoded Blob으로 표시하지만 Share Studio는
  별도 public URL을 새 resource key로 acquire한다. `shareOpen`과 동시에 source를 숨겨
  target 준비 동안 hero Skeleton이 노출되고, ready 뒤 실제 카드가 뒤늦게 공간 motion에
  합류한다. 재진입 public resource cache는 이 최초 owner→public handoff를 해결하지 않는다.
- Share button은 usage/profile JSON을 다시 읽지 않는다. 따라서 Home-only refresh로
  제한하지 않고 route direct entry와 mutation invalidation은 유지하며, warm interaction의
  display resource만 source→target handoff로 연결한다.

### 산출물

수정:

- `src/profile-card/service-core.js`
- `src/profile-card/__tests__/service.test.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/useCardHandoffMotion.js` — source visibility timing 변경이 필요한 경우에만
- `src/profile-marketing/MarketingLanding.jsx` — decoded source metadata 전달이 필요한 경우에만
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md`
- `mydocs/orders/20260811.md`

신규:

- `mydocs/working/task_m100_83_stage4_3.md` (Stage 완료 시 `task-stage-report`로 작성)

### 서버 avatar 변경

1. allowlisted GitHub avatar request의 fetch redirect mode를 `manual`로 바꾼다.
2. 기존 `response.ok` 검사를 통과하지 않는 3xx는 Location을 따르거나 body를 render하지
   않고 non-retryable `avatar_http_rejected`로 initials fallback한다.
3. timeout, transient 1회 retry, content-type/size/body 검사, 성공 bytes TTL cache와 safe
   observer payload는 Stage 4.2 계약을 그대로 유지한다.
4. focused test는 exact fetch option과 redirect response 무추적·무재시도를 고정한다.

### client share handoff 변경

1. Home과 owner profile은 공유 click 시 source rect와 함께 현재 decoded display source,
   canonical source kind/URL과 owner scope를 Share Studio에 전달한다.
2. Share Studio는 source display가 있으면 그 bitmap을 handoff preview의 초기 visible image로
   사용하고 source overlay 준비 전 원래 카드를 숨기지 않는다. source가 없을 때만 기존
   public readiness Skeleton을 사용한다.
3. spatial opening은 source bitmap 준비를 시작 조건으로 삼는다. public target resource는
   기존 public URL/cache key로 background acquire하고, target settle 및 decode 완료 뒤
   120ms 이하의 opacity 교체로 commit한다. motion 중 target 준비가 끝나도 source bitmap을
   중간에 교체하지 않는다.
4. public target failure는 source bitmap을 유지하되 preview unavailable 상태와 share action
   실패 계약을 보존한다. ready 전 close는 resource lease·focus·source visibility를 즉시
   복원하고 object URL을 누수하지 않는다.
5. owner/public cache key를 합치지 않고, source DOM reparent와 persistent storage를 사용하지
   않는다. Home·profile route의 profile fetch와 direct public entry Skeleton은 유지한다.

### 검증

focused Node:

- avatar request `redirect: "manual"`, 200 bytes render와 3xx 무추적·무재시도 fallback
- 기존 transient retry, content/size 거부, success TTL cache와 observer 회귀 부재

Playwright:

- delayed public target의 첫 공유에서 source bitmap이 즉시 handoff하고 hero Skeleton은
  활성화되지 않으며 actual target ready 뒤에만 교체
- Home과 owner profile, dirty Save & Share, public target failure, close-before-ready,
  detached source와 reduced-motion 경로
- 첫 public target fetch 1회, close/reopen 추가 fetch 0회와 canonical public action URL 유지
- source가 없는 cold path는 기존 Skeleton/readiness와 error fallback 유지

전체:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

원격 owner-only 배포는 Stage 4.3 exact source commit과 전체 검증 결과를 제시해 별도
승인받은 뒤 수행한다. 이 Stage source 보정만으로 access, D1/R2, OAuth 또는 saved version을
변경하지 않는다.

### 중단·원복 조건

- avatar redirect를 자동 추적하거나 allowlisted host·content/size 검사를 완화해야 한다.
- private owner bitmap이 public cache entry로 저장되거나 public action URL에 사용된다.
- target 준비 전 source를 숨기거나 Skeleton이 warm handoff hero로 다시 노출된다.
- direct route loading을 Home 상태에 의존시키거나 persistent private cache가 필요해진다.

### 커밋

```text
Task #83 [Stage 4.3]: hosted avatar와 공유 handoff 보정
```

## Stage 4.4 — 공유 전환·프로필 Skeleton 연속성 보정

### 발견 근거와 범위

- saved version 20의 warm Share Studio handoff는 source bitmap으로 공간 이동을 정상 완료한
  뒤 public target class로 바뀌는 순간 `.share-studio-card` 기본 crossfade가 다시 시작한다.
  wrapper transform은 이미 identity인데 image opacity가 낮아졌다 복귀하므로 네트워크나
  Skeleton과 무관한 중복 fade다.
- public profile loading은 identity·stats·activity·card 구조를 갖추고도 최상위 wrapper의
  `::after` 하나가 전체 높이를 횡단한다. owner profile은 동일한 ready layout 앞에서 text
  message만 표시해 두 route의 loading hierarchy와 layout 안정성이 다르다.
- Stage 4.4는 client motion class와 공통 loading component/CSS만 수정한다. fetch 빈도,
  card resource key/lease, API response, public cache·ETag와 Sites access는 범위 밖이다.

### 산출물

수정:

- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md`
- `mydocs/orders/20260811.md`

신규:

- `src/profile-ui/ProfileLoadingSkeleton.jsx`
- `mydocs/working/task_m100_83_stage4_4.md` (Stage 완료 시 `task-stage-report`로 작성)

### client motion 변경

1. Share Studio는 decoded source를 사용한 warm handoff에서 public target이 준비돼 교체돼도
   image-level crossfade animation을 다시 시작하지 않는다.
2. source가 없는 cold path는 기존 120ms readiness fade, error와 Skeleton 계약을 유지한다.
3. target class와 warm/cold 상태를 DOM attribute/class로 구분해 E2E가 opacity·animation-name
   연속성을 직접 고정한다.

### 공통 profile Skeleton 변경

1. 공개·소유자 profile loading은 identity를 포함하지 않는 공통 구조형 component를 사용한다.
2. 최상위 page-wide shimmer를 제거하고 avatar, name, handle, 각 stat, activity header/tabs/grid,
   card preview가 자신의 경계에서 loading 상태를 표현한다. 실제 usage·card data는 렌더하지 않는다.
3. 공통 Skeleton은 ready layout의 920px width, profile header→stats→activity→card 순서와
   단일 sr-only `h1`을 유지한다. owner/public 별 접근성 문구와 test id만 구분한다.
4. `prefers-reduced-motion: reduce`에서는 공통 placeholder와 card Skeleton sheen을 정지한다.

### 검증

Playwright:

- delayed public target warm handoff가 public class로 바뀐 뒤에도 image animation-name `none`,
  opacity `1`을 유지하고 hero Skeleton이 비활성인 상태
- source 없는 cold path의 readiness fade와 error/reduced-motion 회귀 부재
- public profile loading의 page wrapper pseudo animation 부재와 identity·stats·activity 요소별
  shimmer, owner profile의 같은 공통 구조·단일 sr-only heading
- 두 loading route에서 실제 identity 비노출, ready 전환 뒤 정상 heading과 layout 회귀 부재

전체:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

원격 owner-only 배포는 Stage 4.4 exact source commit과 전체 검증 결과를 제시해 별도
승인받은 뒤 수행한다. 이 Stage source 보정만으로 access, D1/R2, OAuth 또는 saved version을
변경하지 않는다.

### 중단·원복 조건

- warm target 보정을 위해 public target readiness를 기다리지 않거나 spatial handoff를 제거해야 한다.
- 공통 Skeleton에 실제 identity/usage를 임시 값으로 노출하거나 page fetch를 공유해야 한다.
- per-element shimmer가 과도한 DOM animation·layout shift를 만들거나 reduced-motion을 무시한다.
- cold path의 readiness·error fallback 또는 public media/cache 계약이 달라진다.

### 커밋

```text
Task #83 [Stage 4.4]: 공유 전환과 프로필 Skeleton 보정
```

## Stage 4.5 — Skeleton/ready 위치와 content reveal 정합화

### 발견 근거와 범위

- saved version 21 직접 확인에서 warm target 깜빡임 제거는 승인됐다.
- 공통 Skeleton은 identity name/handle line box가 ready보다 짧고, stats를 단일 pill로
  표현하며, activity month label·option spacing과 card section heading을 생략한다.
  이 높이 차이가 아래 section으로 누적돼 loading과 ready 위치가 다르게 보인다.
- ready content는 API state 전환과 동시에 최종 opacity로 mount돼 Skeleton 제거 뒤 정보가
  갑자기 나타난다.
- Stage 4.5는 공통 Skeleton markup/CSS와 ready stage entrance class만 수정한다. profile
  fetch, card resource/cache/readiness, API·publication·access 계약은 변경하지 않는다.

### 구현 계약

1. identity avatar/name/handle, stats 5개 value/label와 divider, activity header/grid/month
   label/option, card heading/preview를 ready component와 같은 box hierarchy·간격으로 맞춘다.
2. loading DOM에는 실제 identity·usage를 넣지 않고 중립 placeholder만 렌더한다.
3. ready stage는 identity, stats, activity, card section 순으로 0/40/80/120ms delay를 사용하고
   각 entrance는 6px 이하 translation과 opacity를 360ms decelerating curve로 정착시킨다.
4. 전체 cascade는 500ms 안에 끝나며 profile state의 후속 저장·공개 전환 rerender에서는
   animation을 다시 시작하지 않는다.
5. `prefers-reduced-motion`에서는 animation과 transform을 제거하고 최종 상태를 즉시 표시한다.

### 예상 변경 파일

- `src/profile-ui/ProfileLoadingSkeleton.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/plans/task_m100_83.md`
- `mydocs/plans/task_m100_83_impl.md`
- `mydocs/orders/20260811.md`
- `mydocs/working/task_m100_83_stage4_5.md`

### 검증

```bash
npm test -- --test-concurrency=1
npx playwright test
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

원격 owner-only 배포는 Stage 4.5 exact source와 전체 검증·완료보고서 승인 뒤 수행한다.
승인된 source `0cea83436e5347eb73fcb1ccc221fdbd169ab9ed`를 saved version 22로
배포했고, custom owner-only access revision 56·environment revision 85를 유지했다.
hosted smoke는 owner profile Skeleton→reveal, card bitmap ready, Share Studio frame 안정성과
protected direct share HTML의 version 22 asset 응답을 확인했다.

### 커밋

```text
Task #83 [Stage 4.5]: 프로필 loading/ready 전환 정합화
```

## Stage 4.6 — profile reveal 공간 이동·stagger 제거

### 발견 근거와 범위

- saved version 22 직접 확인에서 ready content가 6px 아래 좌표에서 위로 이동해 Skeleton과
  다른 위치에서 시작하는 것처럼 보이는 잔여 회귀를 확인했다.
- loading/ready box geometry와 reduced-motion 계약은 유지하고 `profile-content-enter`의
  transform 성분 및 0/40/80/120ms stagger를 제거해 전 영역을 동시에 opacity reveal한다.
- profile API, card resource/cache/readiness, 공유 motion, Sites access와 remote deployment는
  변경하지 않는다. 사용자 직접 확인 전에는 로컬 preview까지만 수행한다.

### 예상 변경 파일

- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/plans/task_m100_83.md`
- `mydocs/plans/task_m100_83_impl.md`
- `mydocs/orders/20260811.md`
- `mydocs/working/task_m100_83_stage4_6.md` (로컬 검증 승인 뒤 단계 종료 시)

### 검증

```bash
npx playwright test --grep "loading geometry matches ready content"
npm test -- --test-concurrency=1
npx playwright test
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

로컬 preview에서 ready reveal의 active/final transform `none`, 전 영역 delay `0s`와
Skeleton/ready geometry를 확인한다. 작업지시자 승인 전에는 saved version을 만들거나
owner-only Site를 재배포하지 않는다.

### 커밋

```text
Task #83 [Stage 4.6]: 프로필 reveal 공간 이동·stagger 제거
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이나 예상 파일 밖 source 변경이 필요하면 구현계획서를 먼저 갱신하고 승인을 받는다.
- Stage 3·3.10·4·4.1 원격 결과에는 secret/plain identity/raw usage/backup path를 기록하지 않는다.
- 공식 문서 위치가 수행계획서 판단과 달라지면 수정 전에 계획 변경 승인을 받는다.
- Stage 4.1 완료 뒤 전체 수용 기준과 #84 선행조건을 최종 보고서에서 재확인한다.

## 커밋

- 구현계획서 자체는 구현 시작 전 `Task #83: 구현 계획서 작성`으로 별도 커밋한다.
- 각 Stage source/remote-result와 `mydocs/working/task_m100_83_stage{N}.md`는 다음 exact 커밋으로 묶는다.
  - `Task #83 Stage 1: Sites production artifact local path 제거`
  - `Task #83 Stage 2: exact Sites candidate와 archive preflight`
  - `Task #83 Stage 3: owner-only Sites candidate와 전체 smoke`
  - `Task #83 [Stage 3.7]: Sites 호환 공유 문서 경로 보정`
  - `Task #83 [Stage 3.8]: Worker 전달 공유 문서 경로 보정`
  - `Task #83 [Stage 3.9]: social preview 자산 가용성 보정`
  - `Task #83 [Stage 3.10]: Sites 소유자 프로필 경로 보정`
  - `Task #83 Stage 4: public cache 실측과 owner-only 원복`
  - `Task #83 [Stage 4.1]: 카드 readiness와 motion 회귀 보정`
  - `Task #83 [Stage 4.2]: avatar 복구와 card resource cache 보정`
  - `Task #83 [Stage 4.3]: hosted avatar와 공유 handoff 보정`
  - `Task #83 [Stage 4.4]: 공유 전환과 프로필 Skeleton 보정`
  - `Task #83 [Stage 4.5]: 프로필 loading/ready 전환 정합화`
  - `Task #83 [Stage 4.6]: 프로필 reveal 공간 이동·stagger 제거`

## 단계 의존성

- Stage 1은 이 구현계획서 승인 뒤에만 시작한다.
- Stage 2는 Stage 1 산출물·검증·완료보고서 승인 후 진행한다.
- Stage 3은 Stage 2 완료보고서 승인과 별도 Gate A 승인 후 진행한다.
- Stage 3.7은 Stage 4 Gate B 1차 blocker와 owner-only 복원 뒤 작업지시자의
  계획 보정·source 수정 승인으로 진행한다.
- Stage 3.8은 Stage 3.7 owner-only version 15의 root query 정적 우회 반증 뒤
  작업지시자의 계획 보정·source 수정 승인으로 진행한다.
- Stage 3.9는 Stage 3.8 owner-only version 16의 protected metadata 성공 뒤 Gate B
  2차 public social PNG `404` 반증과 owner-only 복원, 작업지시자의 계획 보정·
  source 수정 승인으로 진행한다.
- Stage 4 재시도는 Stage 3.9 완료보고서 승인, 새 owner-only saved version의
  protected API share HTML·fallback asset 검증과 별도 Gate B 재승인 후 진행한다.
- Stage 3.10은 Stage 4 Gate B cache·SNS 측정과 owner-only 복원 뒤 발견한
  `/profile` front-door 이탈을 근거로, 본 구현계획 보정과 source 수정 승인을 받은
  뒤 진행한다.
- Stage 4 완료보고서는 Stage 3.10 exact source의 전체 local 검증, owner-only saved
  version과 query route 집중 smoke, safe baseline 재확인 뒤 작성한다. Stage 3.10이
  public profile/cache/OG/media source를 변경하지 않으므로 Gate B 전체 public
  mutation은 반복하지 않는다.
- Stage 4.1은 Stage 4 완료 뒤 실제 후보 브라우저에서 확인한 card loading·motion
  blocker와 작업지시자의 계획 보정 승인으로 진행한다. source 구현 전 이 보정
  구현계획을 승인받는다.
- Stage 4.1 source·focused/전체 검증 승인 뒤에만 새 exact source owner-only saved
  version 배포 승인을 요청한다. public backend/media 계약이 불변이면 Gate B 전체
  mutation은 반복하지 않고 protected 사용자 흐름만 집중 확인한다.
- Stage 4.2는 Stage 4.1 local 검증 뒤 확인한 server avatar failure 고착과 component-local
  resource 수명을 근거로 작업지시자의 계획·source 수정 승인 후 진행한다.
- Stage 4.2 source·focused/전체 검증과 완료보고서 승인 뒤에만 exact source owner-only
  saved version 배포 승인을 다시 요청한다.
- Stage 4.2 local source는 transient avatar 복구·safe failure observability와 bounded
  same-document resource cache를 구현했고 focused/전체 test, E2E, production build와 두
  artifact verifier를 통과했다. 완료보고서와 같은 commit으로 고정한 뒤 owner-only
  saved version 배포 승인 경계에서 중단한다.
- Stage 4.3은 saved version 19 owner-only smoke에서 확인한 Workerd redirect 비호환과
  최초 공유 handoff Skeleton 결함에 대해 작업지시자의 계획·source 수정 승인으로 진행한다.
- Stage 4.3 source·focused/전체 검증과 완료보고서 승인 뒤에만 exact source owner-only
  saved version 배포 승인을 다시 요청한다.
- Stage 4.3 local source는 avatar redirect 미추적 fail-closed와 warm source handoff를
  구현했고 focused/전체 test, E2E, production build와 두 artifact verifier를 통과했다.
  완료보고서와 같은 commit으로 고정한 뒤 owner-only saved version 재배포 승인 경계에서
  중단한다.
- Stage 4.4는 saved version 20 owner-only smoke에서 확인한 warm target 중복 fade와
  profile loading 불일치를 근거로 작업지시자의 계획·source 수정 승인 후 진행한다.
- Stage 4.4 source·focused/전체 검증과 완료보고서 승인 뒤에만 exact source owner-only
  saved version 재배포 승인을 다시 요청한다.
- Stage 4.4 exact source는 saved version 21로 owner-only 재배포됐고 protected health·
  profile/share HTML과 hosted warm target·공통 Skeleton smoke를 통과했다. access revision
  56의 custom owner-only 경계는 유지하며 사용자 직접 확인 승인 전에는 public mutation과
  task-final-report를 시작하지 않는다.
- Stage 4.5는 작업지시자의 saved version 21 직접 확인과 source 수정 지시에 따라
  Skeleton/ready geometry와 content reveal만 보정한다. local 전체 검증·완료보고서 승인
  뒤 exact source를 saved version 22로 owner-only 재배포했고 protected hosted smoke를
  통과했다. 사용자 직접 확인 승인 전에는 public mutation과 task-final-report를 시작하지
  않는다.
- Stage 4.6은 saved version 22 직접 확인에서 발견한 upward entrance와 순차 reveal 잔여
  불일치에 대해 작업지시자의 source 수정·local preview 지시로 진행한다. local 검증과
  직접 확인 승인 전에는 remote saved version을 생성하지 않는다. 직접 확인 승인 뒤 exact
  source `c030339d848f961c54358d9d3523b340bed09670`을 saved version 23으로 owner-only
  배포했고 동시 reveal·공유 card hosted smoke를 통과했다.
- task-final-report는 Stage 4.6 local 확인과 owner-only version 23 smoke 통과 뒤 재개한다.
- #84는 Task #83 PR merge·cleanup과 issue close가 끝난 뒤에만 `task-start`한다.

## 위험과 대응

- **Cloudflare build-time manifest 사용**: Worker hook에서 조기 삭제하지 않고 전체 Vite command 성공 뒤 finalizer를 실행한다.
- **runtime 파일 오삭제**: exact manifest만 제거하고 다른 `.vite` entry와 Worker asset은 보존하며 focused byte-identity test를 둔다.
- **finalizer 미실행 경로**: production/local smoke가 쓰는 build script를 감사하고 alternate output caller를 focused test로 고정한다.
- **verifier 우회**: verifier source와 absolute path pattern을 보호하고 producer 보정 뒤 실제 검증 성공만 수용한다.
- **provenance drift**: Stage 3에서 source 보정 commit을 다시 build/package하고 saved version source와 exact-match시킨다.
- **migration rollback**: `3..5` backward compatibility와 backup 가능성을 Gate A에 제시하며 schema downgrade를 금지한다.
- **remote credential/data 노출**: secret은 hosted environment에만 두고 bounded status/count/digest만 문서화한다.
- **Gate B public 잔류**: 실패 원인 분석보다 owner-only 복원을 먼저 수행하고 anonymous gate를 재확인한다.
- **Sites front-door 경로 불일치**: local Worker `/u/{handle}` 성공은 production
  share 계약으로 인정하지 않는다. query route의 protected/public initial HTML을
  별도로 검증하고 media URL과 HTML URL builder를 분리한다.
- **owner/public query 충돌**: explicit `view=profile`을 `profile={handle}`보다 먼저
  판정하고 focused route test로 owner/public profile을 분리한다.
- **legacy route drift**: 제품이 생성하는 owner link만 canonical query로 바꾸고
  `/profile` Node/dev route와 direct navigation test는 제거하지 않는다.
- **OAuth·CLI deep-link drift**: UI href뿐 아니라 `redirect_to`와 API metadata의
  absolute profile URL을 함께 검증한다.
- **cache 오판**: timestamp, HTML revision, social ETag와 cache header를 함께 기록하고 application correctness와 최적화를 분리한다.
- **legacy social object 부재**: D1 public만으로 personalized image를 추정하지 않고
  R2 authority/social metadata 정합성을 확인한다. 부재·mismatch·provider failure는
  실제 사용자를 변경하지 않고 packaged static image로 fail closed한다.
- **quota/과금 변화**: 각 Gate 직전 plan 표시를 확인하고 추가 결제·자동 초과 과금 요구 시 mutation을 중단한다.
- **loading UI와 실제 성능 혼동**: Skeleton 표시 성공과 renderer latency 개선을 별도
  assertion으로 검증하며, 서버 보정은 measured duplicate/invalidation에 한정한다.
- **decode race**: abort할 수 없는 browser image decode가 source 변경 뒤 완료될 수
  있다. generation exact-match 전에는 visible state를 commit하지 않는다.
- **motion readiness 순환 의존**: motion wrapper 크기 측정과 image ready가 서로를
  기다리지 않도록 Skeleton이 최종 aspect-ratio rect를 먼저 제공하고, ready는 bitmap
  decode만 의존한다.
- **공통화 회귀**: 홈의 source allowlist, owner logout stale-card 차단과 share handoff를
  공통 hook으로 약화하지 않고 기존 focused transition test를 함께 유지한다.
- **document 경계 과장**: module memory는 full document navigation을 넘지 않는다. 같은
  runtime의 중복 제거와 서버 LRU 개선만 수용 기준으로 두고 persistent private cache나
  response header 완화 없이 page reload 간 즉시 재사용을 약속하지 않는다.
- **avatar retry 증폭**: invalid content까지 반복하면 외부 provider 부하와 응답 지연이
  커진다. transient status/network만 1회 재시도하고 timeout·byte limit을 유지한다.

## 승인 요청 사항

- Cloudflare Vite build가 manifest를 소비한 뒤 실행되는 별도 post-build finalizer 방식
- finalizer가 exact manifest만 제거하고 다른 runtime/build entry는 보존하는 fail-closed 범위
- production verifier와 Worker·renderer·D1/R2 제품 source를 Stage 1 보호 대상으로 두는 결정
- 4개 Stage와 Stage 3.7·3.8·3.9·3.10·4.1 보정의 산출물, 검증 명령과 exact 커밋 메시지
- Stage 3.10의 `/?view=profile` canonical route, `/profile` Node/dev compatibility,
  영향 파일과 owner-only 집중 smoke 범위
- Stage 3.10이 public cache·OG·media 계약을 변경하지 않으므로 Gate B 전체 public
  smoke를 반복하지 않는 결정
- Stage 3 Gate A와 Stage 4 Gate B의 승인 입력·중단·원복 절차
- saved version source는 Stage 2 application candidate, 이후 보고서 commit은 document-only HEAD로 구분하는 provenance 정책
- Gate B 결과를 release blocker와 비차단 cache 최적화로 나누는 판단 기준
- Stage 4 뒤 owner-only baseline으로 복원하고 #84가 Gate C와 main 릴리스를 담당하는 의존성
- Stage 4.1의 동적 card surface 한정 Skeleton, generation/load/decode readiness,
  intro/Share Studio motion gate와 reduced-motion/error 계약
- measured private render 중복·avatar invalidation만 최소 보정하고 cache header와
  publication atomicity를 유지하는 성능 경계
- Stage 4.1 source 검증 뒤 owner-only saved version 배포와 protected 집중 smoke를
  별도 승인으로 분리하는 절차
