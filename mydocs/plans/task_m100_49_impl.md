# 구현계획서 — Task #49: Sites full-stack MVP 적합성 검증 및 production 아키텍처 재결정

수행계획서: [`task_m100_49.md`](task_m100_49.md)
GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 다음 단계 진입 조건 |
|---|---|---|---|
| 1 | Sites full-stack compatibility 경계와 local harness | 별도 full-stack Worker entry/build, binding/config contract, artifact verifier | Worker ESM build와 기존 Cloud Run/marketing build 동시 통과, 외부 GitHub OAuth 지원 경로 확인 |
| 2 | D1 structured store와 named atomic operation | D1 schema/migration, store/rate-limit adapter, 5개 named operation | 중복·경쟁·실패 주입에서 원자성 증명. generic callback transaction 없이 통과 |
| 3 | native R2 media adapter | R2 binding adapter, revision/stable publication, conditional/failure test | S3 adapter와 같은 public/private·ETag 계약 및 publication 보상/경쟁 통과 |
| 4 | Worker PNG renderer와 local full-stack 통합 | JS/Wasm renderer, D1/R2/runtime wiring, local browser/CLI smoke | 1497×918 결정적 PNG, `en`/`ko`, 전체 local flow와 작업지시자 시각 승인 |
| 5 | 승인된 remote Sites/D1/R2 hosted 검증 | exact Site linkage, saved version/deployment, OAuth/CLI/public flow 증적 | Gate A·B 승인, 기능·보안·비용·한도 수용 기준 모두 통과 |
| 6 | architecture 판정과 handoff | PASS/FAIL decision matrix, 공식 hosting 문서, 최종 보고 | 판정 근거와 fallback/후속 migration 범위 일치, 전체 회귀 통과 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| production architecture·운영 계약 | 기존 공식 문서 루트 | `docs/production-hosting.md` (Stage 6) | OK | 최종 PASS/FAIL 전에는 수정하지 않음 |
| 단계별 POC·remote 검증 증적 | 내부 working 문서 | `mydocs/working/task_m100_49_stage{N}.md` | OK | 계정별 limit, 일회성 URL과 측정값은 공식 제품 계약으로 승격하지 않음 |
| 최종 판정·후속 작업 handoff | 내부 report 문서 | `mydocs/report/task_m100_49_report.md` | OK | #43/#46 상태는 변경하지 않고 권고만 기록 |
| D1 schema | Sites runtime source | `db/schema.ts`, `db/migrations/` | OK | durable structured data의 진실 원천을 application source로 보존 |
| Sites project linkage | platform manifest | `.openai/hosting.json` (Stage 5 Gate A 승인 후) | OK | 실제 tool이 반환한 opaque `project_id`와 logical binding만 기록 |

## 공통 구현 계약

### 기존 제품과 fallback 보존

- 기존 React/Vite application, backend HTTP route, GitHub owner identity, browser cookie, CLI protocol, store/media contract를 기능 동등성 기준으로 사용한다.
- 현재 `build:sites`와 `dist-sites`는 sample-only marketing artifact로 유지한다. full-stack POC는 별도 `build:sites-fullstack`과 별도 output directory를 사용해 의미가 섞이지 않게 한다.
- `build`, `build:cloud-run`, Node production server, Postgres adapter, S3-compatible adapter와 관련 migration/test를 삭제하거나 Sites 전용으로 바꾸지 않는다.
- Stage 6 PASS는 전체 production migration 완료를 뜻하지 않는다. PASS 뒤에도 canonical 전환, 데이터 migration과 DNS는 별도 이슈에서 진행한다.
- Task #43 branch/worktree와 #43/#46 GitHub 상태는 이번 task에서 변경하지 않는다.

### Sites Worker와 binding 경계

- hosted server entry는 Cloudflare Worker-compatible ESM default `fetch` export만 사용한다. `node:http`, `node:fs`, `node:path`, `process.env`, native addon과 Node server bootstrap을 import하지 않는다.
- frontend asset은 `ASSETS`, structured data는 logical binding `DB`, media는 logical binding `PROFILE_MEDIA`로만 주입한다.
- GitHub OAuth runtime secret 이름은 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`으로 유지한다. canonical origin과 secure-cookie 정책은 Worker request/site origin에서 계산하되, 신뢰 가능한 production origin 검증을 거친다.
- `.openai/hosting.json`의 `d1`/`r2`는 Stage 1~4에서 현재 `null`을 유지한다. Stage 5 Gate A 승인 뒤에만 logical binding과 플랫폼이 실제 반환한 `project_id`를 기록한다.
- frontend bundle, Worker source map, response와 log에는 GitHub secret, session/token/state 원문, private usage, provider credential과 local path가 없어야 한다.
- 공식 Sites Vite integration package와 version은 Stage 1 시작 시 현재 platform tooling이 제공하는 값을 확인한 뒤 lockfile에 고정한다. package 이름이나 project id를 계획 단계에서 추정하지 않는다.

### store contract v2와 named atomic operation

- 현재 `PROFILE_BACKEND_STORE_ATOMIC_OPERATIONS`의 5개 이름을 실제 실행 경계로 승격한다.
  - `completeOAuthCallback`
  - `approveCliLogin`
  - `exchangeCliLogin`
  - `submitAccountUsage`
  - `updateVisibility`
- service는 정규화·digest·ID/token 생성처럼 순수하거나 secret을 DB에 남기지 않는 작업을 먼저 수행하고, provider adapter에는 operation별 command를 넘긴다. adapter는 condition/result를 다시 검증해 domain result를 반환한다.
- memory/file/Postgres adapter는 기존 `transaction(runner)`를 내부 구현 수단으로 사용할 수 있지만, 위 5개 service path는 공통 named operation만 호출한다.
- D1 adapter는 arbitrary callback이나 `transaction(runner)`를 지원하는 것처럼 보이지 않는다. conditional `UPDATE`/`UPSERT ... RETURNING`, 한 statement의 CTE 또는 플랫폼이 보장하는 `batch()`만 사용한다.
- 한 원자 연산이 선행 statement 결과에 따라 다음 statement를 동적으로 선택해야 해서 D1의 보장 안에서 표현되지 않으면 Stage 2를 실패 처리한다. 네트워크 왕복 사이의 application lock이나 “best effort rollback”을 원자성으로 인정하지 않는다.
- `updateVisibility`는 R2 I/O를 D1 transaction 안에 넣지 않는다. expected owner/visibility revision을 받는 compare-and-set structured operation으로 만들고, publication service는 immutable write → stable materialization → visibility CAS/보상 순서를 명시적으로 처리한다.
- token/device-code 원문과 GitHub access token은 어떤 adapter에도 저장하지 않는다. 기존 digest-only invariant를 D1 schema와 test에 그대로 적용한다.

### D1 schema와 rate limit

- `db/schema.ts`는 table, index, binding type과 migration 순서를 선언한다. 실행 SQL은 `db/migrations/`에 한 migration당 명시적으로 보존한다.
- timestamp는 현재 contract와 동일한 ISO-8601 UTC text, JSON은 canonical JSON text로 저장한다. provider별 JSON type 차이를 public record shape에 노출하지 않는다.
- 모든 query는 binding의 prepared statement와 bind parameter를 사용한다. 한 `prepare()`에 SQL statement 하나만 둔다.
- OAuth state, challenge, owner와 최신 usage의 condition은 status, expiry, revision/digest와 expected value를 SQL `WHERE`에 포함하고 affected row/`RETURNING` 결과로 경쟁 패배를 판정한다.
- shared Account Usage rate limit은 Worker instance memory에 두지 않는다. D1 window row의 atomic UPSERT/conditional update로 burst와 sustained window를 검사한다.
- burst/sustained 두 window를 all-or-nothing으로 소비하거나 거부한 요청을 소비하지 않는 의미를 D1에서 증명하지 못하면 Stage 2 hard blocker로 판정한다.
- migration은 빈 DB, 재실행, 이전 version, 부분 실패를 test하며 destructive reset을 기본 경로로 제공하지 않는다.

### native R2와 HTTP ETag

- native adapter는 Worker `R2Bucket` binding의 `head`, `get`, `put`만 사용한다. R2 `delete`에는 storage precondition이 없으므로 stable publication의 경쟁 안전한 상태 전환에 사용하지 않는다. access key, S3 endpoint와 AWS SDK를 hosted path에서 읽지 않는다.
- immutable revision key와 stable public key는 media contract v2를 유지한다.
  - immutable: `cards/v2/owners/{ownerId}/revisions/{locale}/{revision}.png`
  - stable: `cards/v2/public/{handle}/card.png`
- application ETag는 최종 PNG SHA-256 base64url digest를 quote한 값으로 유지한다. R2 storage ETag는 `onlyIf` 등 storage conditional operation에만 사용한다.
- R2 binding에 server-side copy가 없으면 작은 immutable PNG를 bounded `get`한 뒤 stable `put`으로 materialize한다. stable metadata에 publication id와 `en`/`ko` pointer/application ETag를 함께 기록한다.
- stable update와 unpublish 경쟁은 expected publication/owner visibility revision과 storage precondition으로 검출한다. unpublish와 structured commit 실패 보상은 직전에 확인하거나 쓴 storage ETag가 일치할 때만 stable key를 tombstone object로 조건부 교체한다. 기존 public publication 복구도 자신이 쓴 tombstone ETag가 그대로일 때만 허용한다.
- tombstone은 명시적인 unpublished metadata와 빈 body를 가진 stable object다. public read는 tombstone/private/missing을 동일한 unpublished 결과로 취급하며, 이후 publish는 tombstone의 storage ETag를 조건으로 정상 PNG로 교체한다. immutable revision은 유지한다.
- native R2 경로는 unconditional delete가 다른 동시 요청의 stable object를 제거할 수 있으므로 MVP에서 stable tombstone을 물리 삭제하지 않는다. public card는 R2 bucket URL이 아니라 Worker route로만 서빙하며 cleanup 도구는 stable tombstone을 orphan으로 간주하지 않는다.
- bounded retry가 소진되거나 storage 보상에 실패하면 `unavailable`/repair-required로 반환하며 이전 stable object를 잘못된 새 publication으로 간주하지 않는다.
- private preview `/api/profile/card.png`는 계속 on-demand/no-store이며 R2에 쓰지 않는다. public route는 stable object만 읽고 missing/unpublished/private는 동일한 404를 유지한다.

### Worker renderer 수용 기준

- 기존 `@napi-rs/canvas` renderer는 Cloud Run fallback으로 유지한다. Worker renderer는 별도 module로 격리한 뒤 runtime selection 경계에서만 선택한다.
- 첫 후보는 SVG layout + JS/Wasm rasterization 조합으로 검증하되, package와 version은 Stage 4의 bundle/license/runtime proof 뒤 확정한다. native addon이나 runtime filesystem read가 필요한 후보는 제외한다.
- 한글 font bytes는 build-time asset/import로 Worker bundle에 포함하고 runtime `fs`로 읽지 않는다.
- 1497×918 PNG, `en`/`ko`, 한글 glyph, avatar success/failure, heatmap/stats, 동일 입력의 byte 결정성과 PNG digest를 자동 검증한다.
- native renderer와 byte-for-byte 일치를 요구하지는 않지만 정보 누락, 읽기 어려운 typography, locale 오류는 허용하지 않는다. 대표 카드 이미지를 보고한 뒤 작업지시자 시각 승인 전 Stage 5로 가지 않는다.
- avatar fetch/decode와 rasterization에 timeout·body size 상한을 둔다. hosted cold/warm latency와 Worker bundle 크기가 현재 Sites limit 안에 들어오지 않으면 hard blocker다.

### 외부 Gate와 배포 안전

- Stage 5 전에는 Site, D1, R2와 OAuth callback을 생성·변경하지 않는다.
- 모든 Sites deployment URL은 production으로 취급한다. exact source state를 push하고 그 commit으로 version을 저장한 뒤, 저장된 version만 deploy한다.
- Site는 한 번만 생성한다. `.openai/hosting.json`이 이미 갖는 project id를 먼저 확인하고, 없을 때만 승인된 create를 한 번 호출한다.
- owner-only deployment와 nonproduction test data로 먼저 검증한다. public/CLI 접근 전에는 exact URL과 공개 범위를 Gate B에서 다시 승인받는다.
- test Site/D1/R2/OAuth app의 유지·비공개·삭제는 Stage 6에서 별도 결정을 받는다. 자동으로 material resource를 삭제하지 않는다.

## Stage 1 — Sites full-stack compatibility 경계와 local harness

### 산출물

신규:

- `src/profile-runtime/sites/config.js` — Worker env/binding/runtime config 정규화
- `src/profile-runtime/sites/worker.js` — API/public card와 `ASSETS`를 합성하는 ESM entry
- `src/profile-runtime/sites/backend.js` — Sites binding을 기존 backend handler에 주입하는 composition root
- `src/profile-runtime/sites/__tests__/config.test.js`
- `src/profile-runtime/sites/__tests__/worker.test.js`
- `vite.sites-fullstack.config.js` — 기존 product UI + Worker artifact 전용 build
- `scripts/verify-sites-fullstack-artifact.mjs` — hosted import/secret/output shape 검사
- `scripts/__tests__/verify-sites-fullstack-artifact.test.js`

수정:

- `package.json`, `package-lock.json` — 공식 Sites integration과 `build:sites-fullstack`, local preview/verify script
- 필요 시 `src/profile-runtime/host-adapter.js`와 test — Worker asset fallback과 API/public card route 재사용

유지:

- `.openai/hosting.json`의 `d1: null`, `r2: null`
- `vite.sites.config.js`, `src/profile-marketing/sites-worker.js`, `build/sites-vite-plugin.js`

### 변경 내용

- 현재 Sites tooling/공식 surface를 read-only로 확인해 full-stack Vite integration import, Worker output 규격과 app-owned external OAuth 지원 경로를 Stage 보고서에 기록한다.
- app-owned GitHub OAuth client id/secret을 server-only runtime secret으로 주입하고 callback을 동일 Site origin으로 받을 수 있는 platform-supported 경로가 확인되지 않으면 코드를 우회 구현하지 않고 Stage 1 FAIL로 종료한다.
- product `index.html`/React entry를 client build로 사용하되 `ASSETS.fetch`의 404에만 SPA fallback을 적용한다. `/api/*`와 `/u/{handle}/card.png`는 fallback 전에 backend handler로 라우팅한다.
- Worker composition root는 Stage 1에서는 명시적 unavailable fixture를 주입해 D1/R2가 아직 연결되지 않았음을 숨기지 않는다. store/media 실제 연결은 Stage 2·3에서 진행한다.
- artifact verifier는 server entry가 ESM default export인지, client/server/manifest output이 있는지, client bundle에 server-only module과 secret 이름/fixture 값이 없는지 검사한다.
- server artifact에서 Node server, filesystem, Postgres, AWS SDK와 native canvas import를 부정 검사한다. package가 설치되어 있다는 사실이 아니라 hosted import graph에 들어오지 않음을 기준으로 한다.
- marketing artifact verifier와 full-stack verifier의 허용 route/API 문자열 정책을 분리한다.

### 검증

```bash
node --test src/profile-runtime/sites/__tests__/config.test.js
node --test src/profile-runtime/sites/__tests__/worker.test.js
node --test scripts/__tests__/verify-sites-fullstack-artifact.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run build:sites
npm run build:cloud-run
npm run build
node --test
git diff --check
```

### 중단 조건

- app-owned GitHub OAuth callback 또는 external public API/CLI request를 platform-supported 방식으로 받을 수 없다.
- Worker artifact가 Node-only module/native addon을 실제 import한다.
- full-stack integration이 기존 marketing/Cloud Run build를 같은 lockfile에서 보존하지 못한다.

### 커밋

```text
Task #49 Stage 1: Sites full-stack Worker 경계와 local harness
```

## Stage 2 — D1 structured store와 named atomic operation POC

### 산출물

신규:

- `db/schema.ts` — D1 binding/schema/migration 선언
- `db/migrations/0001_profile_backend.sql` — owners, auth/session, CLI, usage/snapshot/device schema
- `db/migrations/0002_account_usage_rate_limits.sql` — shared rate-limit window schema/index
- `src/profile-backend/atomic-operations.js` — provider-neutral operation 이름, command/result assertion
- `src/profile-backend/d1/store.js` — prepared statement 기반 record read/write와 named operation
- `src/profile-backend/d1/rate-limiter.js` — D1 shared burst/sustained limit
- `src/profile-backend/d1/migrate.js` — ordered migration runner
- `src/profile-backend/d1/index.js`
- `src/profile-backend/__tests__/atomic-operations.test.js`
- `src/profile-backend/__tests__/d1-migrate.test.js`
- `src/profile-backend/__tests__/d1-store.test.js`
- `src/profile-backend/__tests__/d1-concurrency.test.js`
- `src/profile-backend/__tests__/d1-rate-limiter.test.js`

수정:

- `src/profile-backend/store-contract.js`, `index.js` — contract v2 named operation surface/export
- `src/profile-backend/store.js`, `durable-store.js` — memory/file named operation
- `src/profile-backend/postgres/store.js` — Postgres named operation
- `src/profile-backend/oauth-runtime.js`
- `src/profile-backend/cli-login.js`
- `src/profile-backend/account-usage-submit.js`
- `src/profile-backend/snapshots.js`와 visibility 관련 service/test
- 관련 memory/file/Postgres contract·transaction·concurrency test
- `src/profile-runtime/sites/backend.js`, config/test — `DB` binding과 D1 rate limiter 주입

### 변경 내용

- Postgres migration의 table/unique/index와 existing record shape를 SQLite/D1 type에 맞게 옮기되 API record는 동일한 JS object로 정규화한다.
- `atomic` surface는 operation별 command를 받고 business invariant를 adapter 내부에서 재검증한다. service는 provider별 SQL/transaction runner를 알지 못한다.
- OAuth callback은 pending/unexpired state 소비, owner upsert와 session 저장을 하나의 operation으로 처리한다. 같은 state의 동시 callback 중 하나만 성공해야 한다.
- CLI approve는 pending/unexpired challenge와 owner 존재를, exchange는 approved/unexpired/unexchanged challenge와 token issuance를 각각 한 operation으로 보장한다. poll 교환도 같은 exchange operation을 사용한다.
- Account Usage submit은 owner/최신 usage/device를 한 serialization boundary에서 처리해 stale/conflict/idempotent/new 결과와 device touch를 함께 commit한다.
- visibility 변경은 expected owner revision을 받는 conditional operation으로 owner/latest usage/latest snapshot을 일관되게 갱신한다. 경쟁 패배는 retry 가능한 conflict로 반환한다.
- D1 adapter가 generic `transaction`을 제공하지 않아도 위 service가 동작하도록 한다. 기존 transaction은 named operation 외의 fallback 코드가 의존하는 동안 memory/Postgres에만 남긴다.
- rate limiter는 token id digest-safe key와 window start/count만 저장하며 raw token을 저장하지 않는다. rejection/expiry cleanup과 retry-after 계산을 고정한다.
- D1 local-compatible runtime에서 실제 prepared/batch/SQLite 의미를 사용하는 test를 우선한다. 단순 JS Map fake만으로 원자성 통과를 선언하지 않는다.

### 검증

```bash
node --test src/profile-backend/__tests__/atomic-operations.test.js
node --test src/profile-backend/__tests__/d1-migrate.test.js
node --test src/profile-backend/__tests__/d1-store.test.js
node --test src/profile-backend/__tests__/d1-concurrency.test.js
node --test src/profile-backend/__tests__/d1-rate-limiter.test.js
node --test src/profile-backend/__tests__/store-contract.test.js
node --test src/profile-backend/__tests__/store-transactions.test.js
node --test src/profile-backend/__tests__/postgres-store.test.js
node --test src/profile-backend/__tests__/postgres-concurrency.test.js
node --test src/profile-backend/__tests__/oauth-runtime.test.js
node --test src/profile-backend/__tests__/cli-login.test.js
node --test src/profile-backend/__tests__/account-usage-submit.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
node --test
git diff --check
```

Postgres env가 없는 경우 env-gated integration은 skip 사유를 기록하되 memory/D1 contract와 local D1 concurrency는 반드시 실행한다.

### 중단 조건

- 5개 operation 중 하나라도 D1의 보장된 SQL/batch 의미 안에서 원자적으로 표현되지 않는다.
- concurrent callback/exchange/submit/visibility에서 이중 소비, lost update나 partial record가 발생한다.
- burst/sustained rate limit을 shared D1 state에서 일관되게 소비·거부할 수 없다.
- 원자성을 application process memory lock이나 이름만 `transaction`인 callback으로 보완해야 한다.

### 커밋

```text
Task #49 Stage 2: D1 store와 named atomic operation POC
```

## Stage 3 — native R2 media adapter POC

### 산출물

신규:

- `src/profile-media/r2-binding/store.js` — native `R2Bucket` media contract adapter
- `src/profile-media/r2-binding/index.js`
- `src/profile-media/__tests__/r2-binding-store.test.js`
- `src/profile-media/__tests__/r2-binding-failure.test.js`
- `src/profile-media/__tests__/r2-publication-concurrency.test.js`

수정:

- `src/profile-media/index.js` — native R2 adapter export
- `src/profile-media/media-store-contract.js`와 common contract test — storage precondition/metadata 정합
- `src/profile-media/publication-service.js` — D1 visibility CAS와 R2 stable materialization/보상 경계
- `src/profile-media/__tests__/publication-service.test.js`
- `src/profile-media/__tests__/publication-concurrency.test.js`
- `src/profile-backend/http.js`와 public route test — native R2 result/error mapping
- `src/profile-runtime/sites/backend.js`와 test — `PROFILE_MEDIA` binding 주입

### 변경 내용

- R2 binding fake는 Worker API의 body stream, `httpEtag`, custom metadata와 `onlyIf` 의미를 재현한다. S3 command mock을 재사용하지 않는다.
- `putRevision`은 create-only conditional write 후 same bytes/application ETag를 멱등으로, 다른 bytes/metadata를 conflict로 판정한다.
- `publishRevision`은 referenced `en`/`ko` immutable object를 먼저 검증하고 `en` body를 stable key에 materialize한다. stable custom metadata에 두 representation pointer, application ETag, publication id와 published timestamp를 기록한다.
- `getPublishedCard`는 stable metadata를 검증하고 `en`은 stable body, `ko`는 immutable pointer body를 반환한다. `If-None-Match`, HEAD body 생략과 304는 application ETag만 사용한다.
- `unpublishCard`는 stable key를 현재 storage ETag가 일치할 때만 tombstone으로 교체하고 immutable revision을 보존한다. 이미 tombstone/missing이면 unpublished 멱등 결과를 반환한다.
- publication service는 R2 I/O와 D1 CAS를 분리한다. 최초 publish에서 structured commit 실패 시 자신이 쓴 stable publication의 storage ETag가 그대로일 때만 tombstone으로 조건부 교체하고, 기존 또는 경쟁 요청의 stable object를 보상 삭제하지 않는다.
- public→private는 stable tombstone 전환 성공과 D1 visibility CAS의 순서를 failure matrix로 검증한다. D1 CAS가 실패하면 자신이 쓴 tombstone ETag가 그대로일 때만 이전 PNG를 조건부 복구한다. 보상 후에도 일관성을 복구할 수 없는 case는 generic 503과 repair-required internal result로 fail closed한다.
- public route가 tombstone을 404로 처리하고 direct R2 public URL을 전제로 하지 않음을 검증한다. cleanup은 stable tombstone을 orphan 삭제 대상으로 삼지 않는다.
- existing S3 adapter/common tests를 계속 통과시키되 공통 계약의 `unpublishCard` 의미는 물리 삭제가 아니라 public read에서 unpublished 상태가 되는 것으로 정의한다. hosted import graph에는 `@aws-sdk/client-s3`가 들어오지 않게 한다.

### 검증

```bash
node --test src/profile-media/__tests__/r2-binding-store.test.js
node --test src/profile-media/__tests__/r2-binding-failure.test.js
node --test src/profile-media/__tests__/r2-publication-concurrency.test.js
node --test src/profile-media/__tests__/media-store-contract.test.js
node --test src/profile-media/__tests__/publication-service.test.js
node --test src/profile-media/__tests__/publication-concurrency.test.js
node --test src/profile-media/__tests__/s3-store.test.js
node --test src/profile-backend/__tests__/http.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
node --test
git diff --check
```

### 중단 조건

- stable materialization·tombstone 경쟁에서 이전 publication을 잘못 덮거나 다른 요청의 stable object를 보상 전환/복구할 수 있다.
- private/unpublished/missing route가 404로 닫히지 않거나 private preview가 R2에 저장된다.
- public card가 Worker route를 우회한 direct R2 URL에 의존하거나 stable tombstone을 cleanup 대상으로 처리해야 한다.
- native R2 adapter를 위해 S3 credential/AWS SDK를 hosted artifact에 포함해야 한다.

### 커밋

```text
Task #49 Stage 3: native R2 media adapter POC
```

## Stage 4 — Worker PNG renderer와 local full-stack 통합

### 산출물

신규:

- `src/profile-card/worker-renderer.js` — Worker-compatible PNG renderer
- `src/profile-card/worker-renderer-assets.js` — bundled font/renderer asset 경계
- `src/profile-card/__tests__/worker-renderer.test.js`
- `src/profile-card/__tests__/worker-renderer-visual.test.js`
- `src/profile-runtime/sites/__tests__/full-stack.test.js`
- `scripts/smoke-sites-fullstack-local.mjs`

수정:

- `src/profile-card/index.js`, `service.js` — renderer injection/selection과 digest 계약
- `src/profile-card/renderer.js` — native fallback 보존에 필요한 최소 공통화
- `package.json`, `package-lock.json` — 검증을 통과한 JS/Wasm renderer/font dependency와 local smoke script
- `src/profile-runtime/sites/backend.js`, `worker.js`, config/test — D1/R2/renderer/GitHub client 전체 composition
- 관련 backend HTTP, auth/session, CLI, media test fixture

### 변경 내용

- card view model과 data normalization은 기존 module을 재사용하고 rasterization만 Worker module로 분리한다.
- font와 Wasm은 Sites build가 지원하는 방식으로 bundle/initialize한다. request마다 compile하거나 filesystem path를 찾지 않는다.
- avatar fetch는 HTTPS, timeout, 최대 bytes와 supported content type을 제한한다. 실패·decode 오류는 기존 fallback avatar로 수렴한다.
- 동일 fixture를 native/Worker renderer에 넣어 정보 항목, locale, 크기와 digest stability를 비교한다. Worker renderer 자체는 같은 입력에서 byte-identical 결과를 내야 한다.
- Sites backend composition은 `DB`, `PROFILE_MEDIA`, GitHub secret과 Worker renderer를 기존 `createProfileBackendHttpHandler`에 주입한다. frontend route/API/public card contract는 바꾸지 않는다.
- local full-stack smoke는 OAuth client stub으로 browser session 흐름을, packed CLI 또는 실제 CLI package entry로 device login→approve→exchange→submit을 검증한다.
- public/private profile, authenticated private card, publish/unpublish, GET/HEAD/304/404를 같은 local Worker runtime에서 검증한다.
- client/server artifact secret scan과 hosted Node import 부정 검사를 다시 실행한다.
- 대표 `en`/`ko`, avatar success/failure PNG와 주요 desktop/mobile UI route screenshot을 임시 산출물로 렌더링해 작업지시자에게 보여주고 시각 승인을 받는다.

### 검증

```bash
node --test src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-card/__tests__/worker-renderer-visual.test.js
node --test src/profile-runtime/sites/__tests__/full-stack.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
npm run build
npm run build:cloud-run
npm run build:sites
npm test
npm run test:e2e
git diff --check
```

### 중단 조건

- 1497×918, 한글 font, locale, avatar fallback, 결정성 중 하나를 충족하지 못한다.
- representative card의 정보/가독성 차이가 작업지시자 시각 승인을 받지 못한다.
- Sites limit 안에서 Worker bundle을 만들 수 없거나 local cold/warm render가 명백히 MVP에 부적합하다.
- auth/session/CLI/publication 핵심 local flow가 기존 계약과 다르게 동작한다.

### 시각 승인 Gate

Stage 4 보고서에 다음을 함께 제시한다.

- native/Worker `en` 카드
- native/Worker `ko` 카드
- avatar 실패 카드
- desktop/mobile login, profile와 device approval 핵심 화면
- PNG 크기·digest·cold/warm latency와 bundle size 표

승인 전 Stage 5 external Gate A로 진행하지 않는다.

### 커밋

```text
Task #49 Stage 4: Worker renderer와 local full-stack 통합
```

## Stage 5 — 승인된 remote Sites/D1/R2와 hosted 핵심 흐름 검증

### Gate A — resource와 restricted deployment 승인 입력

외부 변경 전에 다음 exact 값을 read-only 확인해 제시한다.

- 현재 ChatGPT/Sites account와 workspace, 이용 가능한 plan/limit/비용 표시
- `.openai/hosting.json`의 현재 내용과 existing `project_id` 유무
- 생성할 Site 표시 이름/slug, region 또는 residency 선택지가 있으면 그 값
- logical binding 이름 `DB`, `PROFILE_MEDIA`
- 생성될 D1/R2 resource의 표시 이름과 test-only 표식
- secret 이름 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`과 값의 출처. secret 값 자체는 보고서에 쓰지 않음
- test GitHub OAuth app, initial callback 후보와 owner test identity
- deploy 대상 branch/commit, owner-only access 설정
- migration command와 nonproduction seed 범위
- 실패 시 deployment 비공개 유지, resource 유지/삭제를 다시 묻는 원복 정책

Gate A 승인 후에만 다음을 수행한다.

1. 기존 project linkage를 재확인하고, 없을 때 Site를 한 번 생성한다.
2. tool이 반환한 opaque `project_id`를 그대로 `.openai/hosting.json`에 기록한다.
3. logical D1/R2 binding과 runtime secret을 연결한다.
4. remote D1 migration을 실행하고 빈/test-only 상태를 검증한다.
5. manifest와 deploy source를 candidate commit으로 고정하고 해당 commit을 push한다.
6. 그 exact commit으로 version을 저장하고, 저장된 version을 owner-only로 deploy한다.
7. binding/readiness, secret non-exposure, D1 atomic operation과 R2/renderer restricted smoke를 수행한다.

remote deployment 전에 필요한 candidate commit은 다음 하위 단계 메시지를 사용한다.

```text
Task #49 [Stage 5.1]: Sites hosted 검증 candidate 고정
```

Stage 5 smoke 뒤에는 redacted 증적과 필요한 최소 보완을 별도 Stage 5 보고 commit으로 묶는다. deployment가 참조한 commit과 최종 Stage 5 commit을 보고서에서 혼동하지 않는다.

### Gate B — public URL과 OAuth/CLI smoke 승인 입력

owner-only 검증 통과 뒤 다음 exact 값을 제시한다.

- 실제 production deployment URL
- GitHub OAuth callback `${productionUrl}/api/auth/github/callback`
- GitHub OAuth app client id와 callback 변경 전/후 값. client secret은 이름만 표시
- public access 변경 대상과 “anyone on the internet” 등 정확한 access mode
- browser/CLI에서 접근할 exact verification/public card URL
- disposable owner/session/device/usage/media test data 범위
- 공개 시간 동안 실행할 smoke 순서
- 테스트 종료 뒤 공개 유지/owner-only 복귀와 test data/resource 처리 선택지

Gate B 승인 후에만 public access와 OAuth callback을 변경하고 다음 remote smoke를 수행한다.

- browser GitHub login → callback → secure session → logout
- packed CLI device login → browser approve → poll/exchange → Account Usage submit
- private/public profile visibility
- authenticated private card on-demand/no-store
- publish/unpublish와 stable `GET`, `HEAD`, `If-None-Match` 304
- missing/private/unpublished 404
- D1 duplicate callback/exchange와 concurrent usage/visibility
- R2 publication conflict/failure의 fail-closed 결과
- response/header/client asset/log secret·private-data scan
- 현재 account의 usage/limit/추가 과금 표시 재확인

### 산출물

수정:

- `.openai/hosting.json` — approved logical binding과 actual opaque project linkage
- 필요 시 `.env.example` — secret 값 없이 Sites logical binding/runtime variable 설명
- hosted 검증에서 드러난 최소 runtime/test 보완

증적:

- `mydocs/working/task_m100_49_stage5.md`
- exact deployed commit/version, deployment/access 상태, 비용·limit 관찰
- secret을 제거한 OAuth/CLI/D1/R2/renderer smoke 결과

### 검증

```bash
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm test
npm run test:e2e
git diff --check
```

remote 명령과 결과는 secret/token/session/private payload를 redaction해 Stage 보고서에 기록한다.

### 중단 조건

- Gate A 또는 Gate B가 승인되지 않았다.
- Site/D1/R2 사용에 즉시 추가 비용이 필요하거나 현재 account에서 무료/포함 한도를 확인할 수 없다.
- external GitHub OAuth callback, secure session 또는 public CLI request가 hosted runtime에서 동작하지 않는다.
- D1 remote concurrency 의미가 local test와 달라 원자성을 깨뜨린다.
- Worker renderer가 hosted limit/latency를 넘거나 R2 stable route가 계약을 충족하지 못한다.
- secret/private usage가 client, response 또는 log에 노출된다.

### 커밋

```text
Task #49 Stage 5: hosted Sites 핵심 흐름과 비용 Gate 검증
```

## Stage 6 — architecture 판정, 공식 문서와 후속 handoff

### 판정 규칙

PASS는 다음을 모두 충족할 때만 선택한다.

- 현재 account 조건에서 MVP 운영에 필요한 Site/D1/R2가 증분 인프라 비용 0원으로 확인된다.
- GitHub OAuth, secure browser session/logout과 packed CLI device login/submit이 실제 public URL에서 통과한다.
- D1의 5개 named operation과 shared rate limit이 local/remote 경쟁·실패 test를 통과한다.
- native R2가 public/private, revision/stable, ETag, publish/unpublish와 failure 계약을 통과한다.
- Worker renderer가 기능·시각 승인, 결정성, bundle/runtime limit과 허용 latency를 통과한다.
- client/response/log에 secret과 private usage가 노출되지 않는다.
- beta limit exhaustion 때 비공개/중단과 Cloud Run fallback으로 전환하는 조건을 설명할 수 있다.

하나라도 충족하지 못하면 FAIL로 판정한다. “추가 구현하면 될 것 같음”이나 local-only 성공은 PASS 근거로 사용하지 않는다.

### PASS 문서 결과

- `docs/production-hosting.md`에 Sites + D1 + R2를 M100 canonical MVP target으로 기록한다.
- Cloud Run + Neon + R2를 tested fallback으로 유지하고 삭제하지 않는다.
- 별도 migration 이슈 범위로 canonical build 전환, D1 data migration, production OAuth app/custom domain, monitoring/backup, Task #43 처리와 최종 cutover를 제시한다.
- Stage 5의 test deployment/resource를 즉시 production으로 간주하지 않고 유지·비공개·삭제 선택을 작업지시자에게 요청한다.

### FAIL 문서 결과

- `docs/production-hosting.md`의 Cloud Run + Neon + R2 canonical 결정을 유지한다.
- 검증된 blocker, 재검토 trigger와 Sites sample-only marketing 범위를 최소 수정으로 기록한다.
- Task #43 재개 권고와 test deployment/resource의 유지·비공개·삭제 선택을 작업지시자에게 요청한다.

### 산출물

신규:

- `mydocs/report/task_m100_49_report.md`

수정:

- `docs/production-hosting.md`
- `mydocs/orders/20260723.md` — task 완료 시각과 PASS/FAIL 요약
- hosted/local POC에서 판정에 필요한 최소 source/test 보완

각 Stage 종료 시:

- `mydocs/working/task_m100_49_stage{N}.md`

### 검증

```bash
npm test
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run smoke:hosting-matrix
git diff --check
git status --short
```

추가로 다음을 수동 대조한다.

- decision matrix 각 PASS/FAIL 근거가 Stage 증적과 연결되는지
- `docs/production-hosting.md`의 canonical/fallback 표현이 실제 판정과 같은지
- #43/#46의 이슈/branch 상태를 변경하지 않았는지
- remote resource 처리 결정을 승인 없이 실행하지 않았는지
- PR 대상에 secret, token, session, private payload와 계정별 민감 정보가 없는지

### 커밋

```text
Task #49 Stage 6 + 최종 보고서: Sites MVP architecture 판정
```

## 전체 승인·중단 순서

1. 이 구현계획서 승인
2. Stage 1 구현·검증·보고 승인
3. Stage 2 구현·검증·보고 승인
4. Stage 3 구현·검증·보고 승인
5. Stage 4 구현·검증·시각 승인
6. Stage 5 Gate A external resource/restricted deployment 승인
7. Stage 5 Gate B public URL/OAuth/CLI 승인
8. Stage 5 결과 승인
9. Stage 6 PASS/FAIL 판정·문서·최종 보고 승인
10. 별도 승인 뒤 PR 게시

어느 Stage에서든 중단 조건이 충족되면 다음 구현으로 확장하지 않는다. 해당 단계 보고서에 재현 조건, 현재 fallback 건전성, 제거하지 않은 remote/local 부산물과 Stage 6 FAIL 판정에 필요한 근거를 기록한 뒤 작업지시자 결정을 받는다.
