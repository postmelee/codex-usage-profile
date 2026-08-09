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

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | production artifact local-path 보정 | post-build finalizer, package script, focused test | final manifest 부재, runtime 파일 보존, 두 artifact verifier 통과 |
| 2 | exact local candidate와 archive preflight | 전체 local 검증, Sites package archive, candidate 증적 | test/E2E/build/verifier, archive 파일·금지 문자열 검사 |
| 3 | Gate A owner-only 배포와 전체 기능 smoke | saved version, migration `1..5`, owner-only smoke | exact source, readiness, maintenance safe state, OAuth/CLI/card/OG |
| 4 | Gate B public cache 실측과 baseline 원복 | cache/revision 관찰, owner-only·disposable cleanup, 공식 상태 문서 | anonymous 경계, cache header, revision 신선도, 원복·비노출 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| Sites current baseline·runbook | `docs/` | `docs/sites-operations.md` (Stage 4, 필요한 경우) | OK | saved version/access/environment 또는 장기 운영 절차가 실제로 바뀔 때만 최소 수정 |
| production 검증 상태 | `docs/` | `docs/production-hosting.md` (Stage 4, 필요한 경우) | OK | migration/artifact/cache 중 장기 유지할 검증 사실만 반영 |
| 공개 카드 후보 상태 | `docs/` | `docs/readme-card.md` (Stage 4, 필요한 경우) | OK | Gate C 전이므로 CTA는 활성화하지 않고 후보 상태 문구만 사실에 맞게 조정 |
| 단계 검증 증적 | `mydocs/working/` | `mydocs/working/task_m100_83_stage{N}.md` | OK | SHA, count/size와 redacted remote 결과를 task 범위에 보관 |
| 최종 handoff | `mydocs/report/` | `mydocs/report/task_m100_83_report.md` | OK | #84 선행조건과 exact application source를 최종 정리 |

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

## Stage 4 — Gate B public cache 실측과 baseline 원복

### Gate B 승인 입력

public access를 열기 전에 다음을 제시한다.

- Stage 3 saved version/deployment/source와 protected readiness exact-match 증적
- owner-only Sites gate에서 `/u/{handle}`가 `/`로 `307` 전환되어 Stage 4 public access에서
  canonical/OG/Twitter·private/missing HTML 폴백을 실측해야 한다는 승인된 handoff
- current owner-only access policy와 public으로 바꿀 exact access, 즉시 복원할 owner-only 값
- maintenance disabled, operator secret absent, operator route `404`, health `200`
- disposable test profile/private state, 일회용 token/session과 종료 cleanup scope
- 측정할 exact `/u/{handle}`·README/social URL과 redacted 관찰 항목
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
5. 같은 `/u/{handle}`에 GET/HEAD를 반복하며 timestamp와 bounded `CF-Cache-Status`, `Age`, `x-request-id`, `Cache-Control`, `og:image?v=`만 기록한다.
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

### 커밋

```text
Task #83 Stage 4: public cache 실측과 owner-only 원복
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이나 예상 파일 밖 source 변경이 필요하면 구현계획서를 먼저 갱신하고 승인을 받는다.
- Stage 3·4 원격 결과에는 secret/plain identity/raw usage/backup path를 기록하지 않는다.
- 공식 문서 위치가 수행계획서 판단과 달라지면 수정 전에 계획 변경 승인을 받는다.
- Stage 4 완료 뒤 전체 수용 기준과 #84 선행조건을 최종 보고서에서 재확인한다.

## 커밋

- 구현계획서 자체는 구현 시작 전 `Task #83: 구현 계획서 작성`으로 별도 커밋한다.
- 각 Stage source/remote-result와 `mydocs/working/task_m100_83_stage{N}.md`는 다음 exact 커밋으로 묶는다.
  - `Task #83 Stage 1: Sites production artifact local path 제거`
  - `Task #83 Stage 2: exact Sites candidate와 archive preflight`
  - `Task #83 Stage 3: owner-only Sites candidate와 전체 smoke`
  - `Task #83 Stage 4: public cache 실측과 owner-only 원복`

## 단계 의존성

- Stage 1은 이 구현계획서 승인 뒤에만 시작한다.
- Stage 2는 Stage 1 산출물·검증·완료보고서 승인 후 진행한다.
- Stage 3은 Stage 2 완료보고서 승인과 별도 Gate A 승인 후 진행한다.
- Stage 4는 Stage 3 완료보고서 승인과 별도 Gate B 승인 후 진행한다.
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
- **cache 오판**: timestamp, HTML revision, social ETag와 cache header를 함께 기록하고 application correctness와 최적화를 분리한다.
- **quota/과금 변화**: 각 Gate 직전 plan 표시를 확인하고 추가 결제·자동 초과 과금 요구 시 mutation을 중단한다.

## 승인 요청 사항

- Cloudflare Vite build가 manifest를 소비한 뒤 실행되는 별도 post-build finalizer 방식
- finalizer가 exact manifest만 제거하고 다른 runtime/build entry는 보존하는 fail-closed 범위
- production verifier와 Worker·renderer·D1/R2 제품 source를 Stage 1 보호 대상으로 두는 결정
- 4개 Stage의 산출물, 검증 명령과 exact 커밋 메시지
- Stage 3 Gate A와 Stage 4 Gate B의 승인 입력·중단·원복 절차
- saved version source는 Stage 2 application candidate, 이후 보고서 commit은 document-only HEAD로 구분하는 provenance 정책
- Gate B 결과를 release blocker와 비차단 cache 최적화로 나누는 판단 기준
- Stage 4 뒤 owner-only baseline으로 복원하고 #84가 Gate C와 main 릴리스를 담당하는 의존성
