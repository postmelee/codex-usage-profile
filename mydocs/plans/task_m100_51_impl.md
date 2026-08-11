# 구현계획서 — Task #51: Sites MVP production migration 및 공개 cutover

수행계획서: [`task_m100_51.md`](task_m100_51.md)
GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | canonical Sites build와 production origin 계약 | `dist/` Sites artifact, CLI default origin과 override 회귀 | full-stack artifact·packed CLI·Cloud Run fallback build |
| 2 | D1/R2 lifecycle, retention과 account deletion | maintenance contract, operator CLI, D1/R2 export·restore·cleanup·repair | disposable lifecycle와 destructive guard test |
| 3 | 관찰·abuse·비용 stop과 전체 local candidate | structured log/redaction, production verifier/smoke, 운영 runbook | 전체 test/E2E/build/hosting matrix와 secret scan |
| 4 | Gate A: production OAuth와 owner-only candidate | exact saved version/private deployment, approved data cleanup·restore 증적 | hosted OAuth/CLI/D1/R2/card와 owner-only access |
| 5 | Gate B: 일시적 public smoke와 owner-only 원복 | public access smoke와 custom owner-only 원복 증적 | anonymous/private/security 경계와 revoke/404 |
| 6 | Gate C: 최종 cutover, 공식 문서와 roadmap 정렬 | final access, README/공식 문서, #43/#44/#45/#46·M100 정렬 | clean user flow, full regression, rollback dry-run |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | `README.md` | OK | Stage 6에서 production Quickstart와 실제 URL 반영 |
| `docs/production-hosting.md` | `docs/` | `docs/production-hosting.md` | OK | Stage 3 운영 계약 초안, Stage 6 실제 cutover 상태 확정 |
| `docs/sites-operations.md` | `docs/` | `docs/sites-operations.md` | OK | Stage 3에서 신규 생성하고 Gate 결과를 Stage 4~6에서 보완 |
| `docs/cli-submit.md` | `docs/` | `docs/cli-submit.md` | OK | Stage 6에서 CLI default/override/migration 문서화 |
| `docs/readme-card.md` | `docs/` | `docs/readme-card.md` | OK | Stage 6에서 stable production URL과 cache 계약 갱신 |
| `packages/codex-usage-profile-cli/README.md` | package root | `packages/codex-usage-profile-cli/README.md` | OK | Stage 6에서 #44 publish candidate 사용자 문서 갱신 |
| `mydocs/working/task_m100_51_stage{N}.md` | `mydocs/working/` | 동일 | OK | credential·backup payload 없이 redacted 증적만 기록 |
| `mydocs/report/task_m100_51_report.md` | `mydocs/report/` | 동일 | OK | 최종 cutover 결과와 잔여 위험 보존 |

## 공통 구현 규칙

- 작업 경로는 분리 worktree `/private/tmp/codex-usage-profile-task51`, branch는 `local/task51`로 고정한다. 메인 worktree의 `local/task43`과 `codex-extracted/`를 수정하지 않는다.
- `.openai/hosting.json`의 기존 opaque `project_id`와 logical binding `DB`, `PROFILE_MEDIA`를 재사용한다. `create_site`를 호출하거나 project id를 바꾸지 않는다.
- Sites runtime value는 Sites environment에서만 관리한다. GitHub client secret, maintenance token, session/token/state 원문과 backup payload를 source, commit, report, shell history용 URL과 Git config에 넣지 않는다.
- Sites build는 기존 non-vinext Worker-compatible ESM 구조를 유지하되 production packaging 입력을 `dist/`로 통일한다. local smoke 전용 output은 별도 경로를 유지한다.
- 배포는 검증된 commit을 source repository credential로 push하고 같은 commit SHA와 그 source에서 만든 archive로 saved version을 생성한 뒤, saved version만 deploy한다.
- owner-only candidate는 가능한 경우 private deployment 전용 operation을 사용한다. public/shared access operation은 Gate B 또는 Gate C의 명시 승인 없이는 호출하지 않는다.
- D1 migration이 바뀌면 `db/migrations/`와 packaged `dist/.openai/drizzle/`을 함께 검사한다. multiline SQL을 `exec()`에 넣지 않고 statement별 prepared query와 `batch()`를 사용한다.
- destructive maintenance는 항상 `plan -> dry-run -> exact target/digest/count 확인 -> --apply` 순서다. remote 삭제·restore·repair는 해당 Gate 승인 범위를 넘어 실행하지 않는다.
- remote Site, version, deployment, D1/R2, OAuth app, access policy와 GitHub Issue/Milestone 변경은 Stage report 승인 없이 다음 변경으로 이어가지 않는다.
- 각 Stage는 `task-stage-report` 절차로 source와 `mydocs/working/task_m100_51_stage{N}.md`를 함께 커밋하고 다음 Stage 승인을 받는다.

## Stage 1 — canonical Sites build와 production origin 계약

### 산출물

신규:

- 필요 시 `scripts/__tests__/verify-sites-production-artifact.test.js`

수정:

- `package.json`
- `vite.sites-fullstack.config.js`
- `build/sites-fullstack-vite-plugin.js`
- `scripts/verify-sites-fullstack-artifact.mjs`
- `scripts/__tests__/verify-sites-fullstack-artifact.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`
- `scripts/smoke-hosting-matrix.mjs`
- `packages/codex-usage-profile-cli/src/config.js`
- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/src/index.js`
- `packages/codex-usage-profile-cli/test/config.test.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `packages/codex-usage-profile-cli/test/integration.test.js`
- `mydocs/working/task_m100_51_stage1.md`

### 변경 내용

- `build:sites-fullstack`의 production output을 Sites hosting helper가 요구하는 `dist/`로 통일한다. `SITES_FULLSTACK_LOCAL_SMOKE=1` output은 `dist-sites-fullstack-local-smoke/`로 유지해 local runtime과 production package가 섞이지 않게 한다.
- full-stack artifact plugin은 `dist/.openai/hosting.json`과 `dist/.openai/drizzle/**`을 source에서 복사하고 `dist/server/index.js`와 static asset이 함께 존재하도록 한다.
- `verify:sites-fullstack`은 기본 `dist/`를 검사하고, project linkage·logical binding·migration·Worker ESM·client secret 부정 검사와 compressed/raw size를 유지한다.
- `build:production`을 `build:sites-fullstack`의 명시적 alias로 추가한다. 기존 `build`, `build:cloud-run`, `build:sites`와 fallback test는 삭제하거나 의미를 바꾸지 않는다.
- CLI에 production 기본 후보 `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`를 한 곳의 exported constant로 둔다.
- origin 선택 우선순위를 `--server > CODEX_USAGE_PROFILE_URL > stored credential origin > production default`로 고정한다. file credential의 issuing origin이 다른 default나 override에 전송되지 않는 기존 방어를 유지한다.
- help와 error 문구는 기본 origin 존재를 반영하되 local development의 explicit `--server` 경로를 유지한다.
- clean HOME/XDG fixture, 기존 credential, env override와 `--server`를 모두 포함한 packed candidate test를 추가한다.
- Stage 1에서는 Site metadata, runtime environment, OAuth app과 access policy를 변경하지 않는다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/config.test.js
node --test packages/codex-usage-profile-cli/test/cli.test.js
node --test packages/codex-usage-profile-cli/test/integration.test.js
node --test scripts/__tests__/verify-sites-fullstack-artifact.test.js
npm run build:production
npm run verify:sites-fullstack
npm run build
npm run build:cloud-run
npm run build:sites
npm run smoke:hosting-matrix
git diff --check
```

`npm pack --dry-run --workspace packages/codex-usage-profile-cli`로 package content를 확인하되 registry publish는 수행하지 않는다.

### 중단 조건

- production `dist/`가 Sites saved-version archive 계약을 충족하지 못한다.
- CLI default 추가가 explicit override 또는 credential origin binding을 약화한다.
- Cloud Run/Postgres/S3-compatible fallback build나 기존 marketing build가 회귀한다.

### 커밋

```text
Task #51 Stage 1: canonical Sites build와 CLI production origin
```

## Stage 2 — D1/R2 lifecycle, retention과 account deletion

### 산출물

신규:

- `src/profile-backend/maintenance-contract.js`
- `src/profile-backend/d1/maintenance.js`
- `src/profile-backend/__tests__/d1-maintenance.test.js`
- `src/profile-media/maintenance-contract.js`
- `src/profile-media/r2-binding/maintenance.js`
- `src/profile-media/__tests__/r2-binding-maintenance.test.js`
- `src/profile-runtime/sites/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `scripts/sites-profile-maintenance.mjs`
- `scripts/__tests__/sites-profile-maintenance.test.js`
- `mydocs/working/task_m100_51_stage2.md`

수정:

- `src/profile-backend/d1/index.js`
- `src/profile-backend/index.js`
- `src/profile-media/r2-binding/index.js`
- `src/profile-media/index.js`
- `src/profile-runtime/sites/config.js`
- `src/profile-runtime/sites/backend.js`
- `src/profile-runtime/sites/worker.js`
- `src/profile-runtime/sites/worker-entry.js`
- `scripts/cleanup-orphan-card-media.mjs`
- `scripts/__tests__/cleanup-orphan-card-media.test.js`
- `package.json`

### 변경 내용

- versioned maintenance envelope을 정의한다. durable backup은 owner identity, latest usage/snapshot, visibility와 publication metadata만 포함한다. OAuth state, session, CLI challenge/token digest와 rate-limit row 등 인증·일시 상태는 export/restore에서 제외해 복구 뒤 재로그인을 강제한다. summary에는 schema/contract version, created-at, operation, owner/object count와 content digest만 출력한다.
- D1 maintenance module은 다음 operation을 product store contract와 분리해 제공한다.
  - 인증·일시 상태를 제외한 versioned durable export와 disposable scoped restore
  - expired OAuth state, CLI challenge, session과 revoked/expired token retention
  - exact owner id/handle을 요구하는 owner-dependent record plan/delete
  - restore idempotency, conflict와 schema-version 거부
- account deletion은 stable publication을 먼저 tombstone/검증하고, R2 owner revision plan을 만든 뒤 D1 dependent rows와 owner를 atomic batch로 정리한다. media failure나 count/digest mismatch에서는 D1 delete를 시작하지 않는다.
- R2 maintenance module은 stable publication/tombstone과 immutable revision manifest를 page 단위로 열거하고, referenced/recent/retention 보호 규칙을 재사용한다. repair는 expected application/storage ETag와 owner/handle을 확인하며 최신 publication을 덮지 않는다.
- Sites Worker에는 하나의 좁은 `/__ops/profile-maintenance` route를 둔다. route는 `PROFILE_MAINTENANCE_MODE=enabled`와 secret `PROFILE_MAINTENANCE_TOKEN`, HTTPS/same-origin policy, method/content-type/body-size, constant-time token 검증을 모두 통과해야 하며 기본은 generic `404`로 닫힌다.
- operator CLI는 `plan`, `export`, `restore`, `retention`, `delete-account`, `repair-publication` subcommand를 제공한다. mutation은 `--apply`, exact origin, expected digest/count와 owner 확인 문자열을 동시에 요구한다.
- export file은 repository 밖 사용자가 지정한 path에 atomic write하고 macOS/Linux `0600`을 적용한다. identity-free usage라도 owner identity와 결합된 backup은 민감 데이터로 취급하며, backup path와 payload는 Stage report에 기록하지 않고 digest/count만 남긴다.
- local real-workerd D1와 R2 binding fixture에서 disposable owner/key로 export→mutation/delete→restore/repair→cleanup을 반복해 최종 count와 tombstone을 검증한다.
- public self-service API/UI, broad SQL execution, arbitrary object delete와 raw dump logging은 만들지 않는다.

### 검증

```bash
node --test src/profile-backend/__tests__/d1-maintenance.test.js
node --test src/profile-media/__tests__/r2-binding-maintenance.test.js
node --test src/profile-runtime/sites/__tests__/maintenance.test.js
node --test scripts/__tests__/sites-profile-maintenance.test.js
node --test scripts/__tests__/cleanup-orphan-card-media.test.js
npm run smoke:sites-fullstack:local
npm run build:production
npm run verify:sites-fullstack
npm test
git diff --check
```

추가 부정 검증:

- maintenance mode/token 부재·오류·timing-independent reject
- `--apply`/owner/digest/count 확인 누락 시 mutation 0건
- schema version mismatch, stale ETag, newer publication과 partial D1/R2 failure에서 fail closed
- OAuth state/session/CLI challenge·token digest/rate-limit row의 backup 제외와 private usage의 summary/client artifact/log 비노출

### 중단 조건

- operator route를 credential이나 mode 없이 호출할 수 있다.
- D1/R2 partial failure에서 account/publication 일관성을 증명할 수 없다.
- 실제 backup을 repository나 Stage report에 저장해야만 operation이 동작한다.

### 커밋

```text
Task #51 Stage 2: Sites 데이터 lifecycle과 안전한 운영 도구
```

## Stage 3 — 관찰·abuse·비용 stop과 전체 local candidate

### 산출물

신규:

- `src/profile-runtime/sites/observability.js`
- `src/profile-runtime/sites/__tests__/observability.test.js`
- `scripts/verify-sites-production-artifact.mjs`
- `scripts/__tests__/verify-sites-production-artifact.test.js`
- `scripts/smoke-sites-production-local.mjs`
- `scripts/__tests__/smoke-sites-production-local.test.js`
- `docs/sites-operations.md`
- `mydocs/working/task_m100_51_stage3.md`

수정:

- `src/profile-runtime/sites/config.js`
- `src/profile-runtime/sites/backend.js`
- `src/profile-runtime/sites/worker.js`
- `src/profile-runtime/sites/__tests__/config.test.js`
- `src/profile-runtime/sites/__tests__/backend.test.js`
- `src/profile-runtime/sites/__tests__/worker.test.js`
- `src/profile-backend/d1/rate-limiter.js`
- 관련 rate-limit test
- `scripts/verify-sites-fullstack-artifact.mjs`
- `package.json`
- `docs/production-hosting.md`

### 변경 내용

- request correlation id, route class, method, status, duration bucket, error code와 retryability만 허용하는 structured event schema를 추가한다. URL query, cookie, Authorization, OAuth code/state, session/token/device code, owner identity, usage/card bytes와 exception 원문은 기록하지 않는다.
- `/healthz`는 Worker와 required binding availability를 generic status로 구분하며 binding metadata나 payload를 노출하지 않는다.
- D1 shared rate-limit의 window/limit을 bounded runtime config로 노출하고 invalid/missing production 값은 approved default로 fail closed한다. bypass나 per-process memory limiter를 추가하지 않는다.
- `maintenance`, `owner-only stop`, `quota stop`, `provider unavailable` 상태와 public response 404/429/503, `Retry-After` 의미를 문서와 test로 고정한다.
- production artifact verifier는 `dist/server/index.js`, static assets, hosting metadata, migrations, expected bindings, forbidden env literal·credential pattern·local path·Node/native/Postgres/S3 production import와 maximum size를 검사한다.
- production local smoke는 anonymous landing, GitHub OAuth seam, session/CSRF, CLI device flow, D1/R2, private preview, publish/unpublish, stable ETag와 maintenance disabled/enabled 분기를 한 runtime에서 검증한다.
- `docs/sites-operations.md`에 private deployment, environment rotation, export/restore, retention/account deletion, public smoke/revert, log inspection, quota stop와 Cloud Run fallback 평가 순서를 작성한다.
- Stage 3 종료 시 Gate A 입력표를 작성한다. exact project/origin/title/current access, environment key 이름, production OAuth callback, candidate commit, export plan/count/digest, 삭제 대상, saved-version package와 quota/비용 확인 항목을 포함하고 secret 값은 제외한다.

### 검증

```bash
node --test src/profile-runtime/sites/__tests__/observability.test.js
node --test scripts/__tests__/verify-sites-production-artifact.test.js
node --test scripts/__tests__/smoke-sites-production-local.test.js
npm run smoke:sites-production:local
npm test
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
git diff --check
```

검증 로그와 artifact를 fixture secret/token/session/state/private usage 및 absolute local path로 검사한다. Stage report에는 pass/fail과 count/size만 기록한다.

### 중단 조건

- production artifact 또는 Worker log에 secret/private data가 포함된다.
- anonymous request가 private account/API/card 또는 maintenance route에 접근한다.
- 추가 과금 없이 사용할 수 있는 owner-only candidate package를 준비하지 못한다.

### 커밋

```text
Task #51 Stage 3: production 운영 guardrail과 local candidate
```

## Stage 4 — Gate A: production OAuth와 owner-only candidate

### Gate A 승인 입력

remote mutation 전에 다음 exact 값을 read-only로 제시한다.

- 기존 Site project, 현재 production URL/slug, 변경할 display title과 owner-only access policy
- 현재 saved version/deployment와 Stage 3 candidate commit
- runtime environment key의 현재/변경 목록
  - `GITHUB_CLIENT_ID`
  - secret `GITHUB_CLIENT_SECRET`
  - secret `PROFILE_MAINTENANCE_TOKEN`
  - `PROFILE_MAINTENANCE_MODE`
  - approved rate-limit/maintenance/stop 값
- production GitHub OAuth app 이름, homepage와 exact callback URL. client secret은 값이 아니라 교체 주체와 보관 위치만 표시
- source push, `dist/` package, version save와 private deployment 순서
- D1/R2 export destination의 분류, manifest digest/count와 backup 보존/폐기 정책. path/payload는 보고하지 않음
- 삭제할 Stage 5 owner/session/token/device/usage/media의 exact redacted identifier와 예상 count
- disposable restore/repair record/key prefix와 종료 cleanup 기준
- 현재 Sites 계정의 plan/quota/추가 결제·자동 초과 과금 표시
- 실패 시 같은 saved version 유지, maintenance disabled, owner-only access와 test OAuth/env 원복 정책

Gate A가 승인되지 않으면 runtime environment, OAuth app, Site metadata, data와 deployment를 변경하지 않는다.

### 실행 순서

1. current Site/access/environment/version을 read-only snapshot으로 확인한다. secret plaintext는 읽거나 출력하지 않는다.
2. production GitHub OAuth app과 exact callback을 준비하고 Sites environment의 client id/secret을 교체한다.
3. production display title을 적용한다. slug와 project id는 변경하지 않는다.
4. Stage 3 commit의 source를 temporary write credential로 push한다. credential을 remote URL/Git config에 저장하지 않는다.
5. 같은 commit에서 `npm run build:production`과 verifier를 재실행하고 Sites plugin의 `scripts/package-site.sh`로 `dist/`, hosting metadata와 migration archive를 만든다.
6. exact commit SHA와 archive로 saved version을 한 번 생성하고 private deployment operation으로 owner-only 배포한다.
7. non-terminal deployment는 같은 project/version/deployment id로 `succeeded` 또는 terminal failure까지 확인한다.
8. maintenance token을 secret으로 설정하고 maintenance mode를 일시적으로 enable한 environment revision을 같은 saved version 재배포로 적용한다.
9. `plan`과 `export`를 실행하고 승인된 Stage 5 test data만 cleanup한다. disposable D1/R2 restore/repair smoke와 cleanup을 완료한다.
10. maintenance mode를 disable하고 같은 saved version을 재배포한다.
11. production GitHub OAuth/session/logout, packed CLI login/submit/revoke, private preview와 publish/unpublish/GET/HEAD/304/404를 owner-only access 안에서 검증한다.
12. recent Worker error log를 확인하고 secret/private-data 비노출과 generic error를 검증한다.

### 산출물

- Sites saved version/deployment와 environment revision — repository 밖 remote state
- production GitHub OAuth app — secret 값은 repository 밖
- repository 밖 D1/R2 backup — digest/count만 보고
- `mydocs/working/task_m100_51_stage4.md`
- hosted 검증에서 확인된 최소 source/test 보완이 있을 때만 해당 파일

### 검증

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm test
npm run test:e2e
git diff --check
```

remote 검증:

- deployment `succeeded`, exact production URL과 owner-only custom access
- production OAuth callback/session/logout
- packed CLI device login→approve→exchange→submit→revoke
- private preview `200 private, no-store`
- publish/unpublish와 stable `GET`, `HEAD`, `If-None-Match 304`, private/unpublished/missing `404`
- export digest/count, approved cleanup 0 remaining, disposable restore/repair cleanup 0 remaining
- maintenance disabled 시 `/__ops/profile-maintenance` generic `404`
- recent log/client/response/header에 secret/token/state/session/private usage 없음
- plan upgrade, 결제수단, 추가 과금과 자동 초과 과금 요구 없음

### 중단·원복 조건

- production OAuth, private deployment, D1/R2 operation 또는 renderer가 실패한다.
- backup digest/count와 remote state가 일치하지 않는다.
- secret/private data가 artifact, response 또는 log에 노출된다.
- Sites가 유료 plan/결제수단/자동 초과 과금을 요구한다.

중단 시 public access로 진행하지 않고 maintenance mode를 disable하며 owner-only를 유지한다. data 삭제가 시작됐다면 승인된 backup과 manifest로 일관성을 먼저 복구하고, 복구가 증명되지 않으면 generic maintenance 상태에서 멈춘다.

### 커밋

```text
Task #51 Stage 4: production OAuth와 owner-only Sites candidate
```

## Stage 5 — Gate B: 일시적 public smoke와 owner-only 원복

### Gate B 승인 입력

- Stage 4 deployment URL, version과 owner-only 검증 결과
- public access가 “URL을 아는 인터넷 사용자 누구나”에 주는 정확한 범위
- ChatGPT account gate 없이 노출되는 landing/static asset과 app-owned GitHub OAuth 경계
- anonymous에서 기대하는 API/private/public card status matrix
- 사용할 GitHub test identity, disposable session/device/usage/publication의 redacted 범위
- public access 시작·종료 기준과 최대 smoke 요청 순서
- 즉시 custom owner-only로 원복할 exact policy와 현재 owner allowlist
- unpublish, session/token revoke, disposable data cleanup과 실패 시 maintenance/stop 순서

Gate B 승인 전에는 access update operation을 호출하지 않는다.

### 실행 순서

1. Site/access/version/environment과 owner-only health를 다시 확인한다.
2. approved public access mode로 전환한다. source/version/environment는 바꾸지 않는다.
3. anonymous landing/static asset과 unauthenticated API/private route의 status/cache/header를 확인한다.
4. browser GitHub OAuth → secure session → private-by-default Home/card를 확인한다.
5. clean packed CLI device login→approve→exchange→submit을 수행한다.
6. publish 후 public stable card `GET/HEAD/304`와 README URL shape를 확인하고, unpublish 후 동일 URL `404`를 확인한다.
7. cross-origin/CSRF/cookie/Bearer, duplicate submit/exchange와 basic abuse/rate-limit을 검증한다.
8. access를 `custom` owner-only로 즉시 원복하고 allowlist/group이 Stage 4 policy와 같은지 확인한다.
9. disposable profile을 private/unpublished로 만들고 session/token을 revoke하며 test data cleanup을 수행한다.
10. anonymous Site 접근 차단, public card `404`, maintenance disabled와 recent log redaction을 검증한다.

### 산출물

- 일시적 public access와 owner-only 원복 — repository 밖 remote state
- redacted browser/CLI/status/cache/security evidence
- `mydocs/working/task_m100_51_stage5.md`
- hosted smoke에서 드러난 최소 source/test 보완이 있을 때만 해당 파일

### 검증

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
git diff --check
```

remote status matrix:

| 상태 | anonymous landing | private API/preview | published card | unpublished/missing card |
|---|---:|---:|---:|---:|
| public smoke | 200 | 401/404 | 200/304 | 404 |
| owner-only 원복 | platform auth gate | platform auth gate | platform auth gate 또는 승인된 접근 차단 | platform auth gate 또는 접근 차단 |

원복 뒤에는 access mode, allowed users/groups, session/token revoke와 publication tombstone을 별도로 확인한다.

### 중단·원복 조건

- anonymous 사용자가 private account/usage/preview에 접근한다.
- app-owned GitHub OAuth/CLI가 public access에서 동작하지 않거나 origin 경계가 달라진다.
- access 원복, unpublish, revoke 또는 data cleanup을 확인할 수 없다.
- unexpected cost/quota/abuse signal이 발생한다.

### 커밋

```text
Task #51 Stage 5: public smoke와 owner-only 원복 검증
```

## Stage 6 — Gate C: 최종 cutover, 공식 문서와 roadmap 정렬

### Gate C 승인 입력

- Stage 5 public smoke/owner-only 원복 결과와 잔여 위험
- 최종 production URL, display title, saved version와 access mode
- 최종 public 전환 시 anonymous/GitHub OAuth/CLI/public card 노출 범위
- no-cost/quota 관찰과 owner-only/maintenance/fallback stop trigger
- data backup 보존 기간, maintenance disabled 상태와 test data 0건 증적
- #43/#44/#45/#46과 M100 milestone description의 exact 수정/close diff
- 공개하지 않을 경우 owner-only candidate를 유지하는 결과와 #44/#45 진입 제한

Gate C 미승인 시 Site를 owner-only로 유지하고 final public access 변경 없이 문서에 candidate 상태를 기록한다.

### 산출물

신규:

- `mydocs/working/task_m100_51_stage6.md`
- 최종 단계 승인 뒤 `mydocs/report/task_m100_51_report.md`

수정:

- `README.md`
- `docs/production-hosting.md`
- `docs/sites-operations.md`
- `docs/cli-submit.md`
- `docs/readme-card.md`
- `packages/codex-usage-profile-cli/README.md`
- 필요 시 package help/smoke fixture
- GitHub Issues #43, #44, #45, #46
- 필요 시 GitHub M100 milestone description
- `mydocs/orders/20260724.md`

### 변경 내용

- 승인 시 existing Site access를 public으로 전환하고 anonymous landing, GitHub OAuth, clean packed CLI submit, private-by-default card와 publish/unpublish stable route를 final smoke한다.
- 미승인 시 owner-only access를 재확인하고 production candidate URL을 public 사용자 문서에 확정값처럼 쓰지 않는다.
- README와 CLI/package 문서의 placeholder origin을 실제 승인된 origin으로 바꾸고 default/override/stored credential migration을 설명한다.
- `docs/production-hosting.md`에 실제 cutover status, deployed version/source provenance, free-account 관찰의 한계와 stop/fallback 조건을 반영한다. credential, backup path와 개인 data id는 쓰지 않는다.
- `docs/sites-operations.md`를 export/restore, retention/account deletion, environment rotation, public↔owner-only access, log 확인, rollback과 fallback evaluation의 재현 가능한 runbook으로 확정한다.
- #43은 Cloud Run fallback을 실제 trigger 후 수행하는 비차단 task로 재범위화한다.
- #44는 #51 public cutover와 exact Sites origin을 선행조건으로 바꾸고 npm registry publish 범위를 유지한다.
- #45는 Sites production OAuth/CLI/D1/R2/card 전체 흐름과 보안 QA로 바꾸고 #51·#44를 선행조건으로 둔다. #38은 release-blocking 신규 기능이 아니라면 선행조건에서 제거한다.
- #46은 marketing-only Sites mirror가 canonical full-stack Site와 중복되므로 exact diff 승인에 따라 `not planned` close하거나 중복되지 않는 후속 marketing 범위로 축소한다.
- M100 milestone의 완료 기반과 release gate 순서를 #49/#51/#44/#45 기준으로 최소 수정한다.
- final source에서 deployable code가 바뀌면 full build/verify 후 새 saved version을 만들고 승인된 access mode로 deploy한다. 문서/GitHub metadata만 바뀌면 Stage 4 saved version을 유지하고 deployed commit과 repository HEAD의 차이가 문서-only임을 보고한다.

### 검증

```bash
npm test
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
npm pack --dry-run --workspace packages/codex-usage-profile-cli
git diff --check
```

최종 remote/문서 검증:

- Site access mode와 final URL/title/version
- clean HOME/XDG packed CLI가 문서만 따라 login→submit→status→logout
- GitHub OAuth/session/logout, private default, publish/unpublish와 stable card ETag
- test session/token/device/usage/media 0건과 maintenance disabled
- recent log/client/response/header secret·private-data 부정 검사
- README/package/docs의 origin, callback, privacy, cost와 fallback 설명 일치
- #43/#44/#45/#46·M100 description과 실제 architecture/release order 일치
- owner-only/maintenance rollback runbook dry-run

### 중단·원복 조건

- Gate C가 승인되지 않았다.
- final public access에서 Stage 5와 다른 privacy/security/cost 결과가 나온다.
- 문서가 실제 origin/access/package publish 상태를 앞서 주장한다.
- issue/milestone 수정안이 승인 범위를 넘는다.

### 커밋

Stage source/문서와 Stage 6 보고:

```text
Task #51 Stage 6: Sites MVP 최종 cutover와 운영 문서
```

모든 검증과 최종 보고 승인 뒤 `task-final-report` 절차가 요구하는 보고/PR commit을 별도로 사용한다.

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않고 같은 Stage 안에서 수정·재검증한다.
- remote command, connector result와 browser evidence는 secret/token/state/session/private payload를 redaction한 요약만 Stage report에 기록한다.
- Sites plugin이나 connector schema가 구현 시점에 계획과 다르면 해당 tool description을 진실 원천으로 삼되, Stage 산출물·access·비용·data 범위가 바뀌면 구현계획서를 먼저 갱신하고 승인받는다.
- D1 schema가 바뀌면 migration file, package inclusion과 backward-compatible rollback 구간을 검증한다.
- public access 변경, material remote data 삭제/restore, GitHub OAuth app/env rotation과 Issue/Milestone mutation은 해당 Gate의 exact 승인 없이는 실행하지 않는다.
- Stage 6 후 `git status --short`가 clean이고 `git diff --check`가 통과해야 최종 보고로 진행한다.

## 커밋

- 단계 source와 `mydocs/working/task_m100_51_stage{N}.md`는 같은 Stage commit에 묶는다.
- hosted deployment가 참조한 source commit, saved version과 Stage report commit을 구분해 기록한다.
- 기본 Stage commit:
  - `Task #51 Stage 1: canonical Sites build와 CLI production origin`
  - `Task #51 Stage 2: Sites 데이터 lifecycle과 안전한 운영 도구`
  - `Task #51 Stage 3: production 운영 guardrail과 local candidate`
  - `Task #51 Stage 4: production OAuth와 owner-only Sites candidate`
  - `Task #51 Stage 5: public smoke와 owner-only 원복 검증`
  - `Task #51 Stage 6: Sites MVP 최종 cutover와 운영 문서`
- candidate source 고정이나 Gate 사이 최소 보완이 필요하면 `Task #51 [Stage N.M]: ...` 형식을 사용하고 Stage report에 이유를 기록한다.

## 단계 의존성

1. Stage 1은 구현계획 승인 후 시작한다.
2. Stage 2는 Stage 1 검증·보고 승인 후 시작한다.
3. Stage 3은 Stage 2 lifecycle contract·guard 승인 후 시작한다.
4. Stage 4는 Stage 3 전체 local candidate 통과와 Gate A exact 승인 뒤에만 시작한다.
5. Stage 5는 Stage 4 owner-only candidate 검증·보고 승인과 Gate B exact 승인 뒤에만 시작한다.
6. Stage 6은 Stage 5 public smoke/owner-only 원복 보고 승인과 Gate C exact 승인 뒤에만 final public access를 변경한다.
7. 각 Stage 사이에는 `task-stage-report` 절차를 적용하며 승인 없이 다음 Stage 변경을 시작하지 않는다.
8. Stage 6 완료 뒤에만 `task-final-report`로 최종 보고와 PR 게시를 준비한다.

## 위험과 대응

- **Sites slug와 비용 0원 제약**: 현재 project/origin을 재사용하고 display title만 변경한다. slug를 바꾸기 위한 Site 삭제·재생성이나 유료 domain을 하지 않는다.
- **maintenance route 공격 표면**: mode와 secret을 모두 요구하고 기본 generic `404`, bounded body, constant-time token 검증, exact operation allowlist를 적용한다. remote operation 뒤 mode를 disable하고 재배포한다.
- **backup/restore의 민감 데이터**: repository 밖 0600 file과 digest/count report를 강제하고 인증·일시 상태는 backup에서 제외해 복구 뒤 재로그인을 요구한다. payload/path는 커밋·report·log에 남기지 않는다.
- **D1/R2 partial failure**: export manifest, expected count/digest와 conditional ETag를 사용하고 structured delete 전에 media tombstone/repair 결과를 확인한다.
- **CLI default origin 회귀**: explicit override와 stored-origin 우선순위, cross-origin token 송신 거부를 unit/packed E2E로 고정한다.
- **public access privacy/abuse**: Stage 5를 짧은 smoke와 즉시 owner-only 원복으로 한정하고 Stage 6 final public을 별도 승인한다.
- **production OAuth rotation**: owner-only에서 callback/session/logout을 먼저 검증하고 실패 시 public으로 진행하지 않는다.
- **Sites beta/가격·quota 변화**: Gate A/B/C마다 plan 표시와 추가 과금 요구를 확인하고, 변화가 있으면 owner-only/maintenance에서 중단한다.
- **deployment provenance 불일치**: exact pushed commit, archive, saved version과 deployment id를 같은 flow에서 사용하고 문서-only HEAD 차이는 final report에 명시한다.
- **roadmap 외부 상태 오수정**: #43/#44/#45/#46·M100 exact diff를 Gate C 입력에 포함하고 승인된 필드만 connector/`gh`로 변경한다.

## 승인 요청 사항

- 6개 Stage의 산출물, 검증 명령과 커밋 경계
- Stage 1에서 Sites production artifact를 `dist/`로 통일하고 CLI default 후보를 현재 `chatgpt.site` origin으로 넣는 방향
- Stage 2에서 default-disabled, secret-gated 단일 maintenance route와 dry-run operator CLI를 사용하는 방향
- Stage 3에서 공식 `docs/sites-operations.md`와 production verifier/smoke를 만드는 방향
- Stage 4의 exact source push→package→saved version→private deployment 순서와 production OAuth/data lifecycle Gate A
- Stage 5 public smoke 후 반드시 custom owner-only로 원복하는 Gate B
- Stage 6에서만 final public access와 #43/#44/#45/#46·M100 description을 exact 승인 뒤 변경하는 Gate C
- remote backup payload/secret/개인 data id를 저장소와 보고서에 남기지 않는 제한

승인되면 Stage 1의 source 변경부터 시작한다. Stage 1이 끝나면 `task-stage-report` 절차로 검증 결과와 변경 파일을 보고하고 다음 Stage 승인을 요청한다.
