# Task #49 Stage 2 보고서 — D1 structured store와 named atomic operation POC

GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
구현계획서: [`task_m100_49_impl.md`](../plans/task_m100_49_impl.md)
Stage: 2

## 단계 목적

기존 memory/file/Postgres store의 callback transaction에 직접 결합된 다중 record 변경을 contract v2의 5개 named atomic operation으로 승격한다. D1 adapter는 generic callback transaction을 제공하지 않고 실제 D1 prepared statement와 `batch()` rollback 의미만으로 OAuth callback, CLI approve/exchange, Account Usage submit, visibility 변경의 불변식을 보장한다.

동시에 기존 structured record shape를 SQLite/D1 schema로 옮기고, token record id만 사용하는 shared burst/sustained rate limiter와 Sites backend dependency seam을 만든다. 이번 Stage는 local workerd/D1 POC까지만 수행하며 remote D1, Site, R2와 OAuth resource는 생성하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `db/schema.ts` | `DB`/future `PROFILE_MEDIA` binding type과 ordered migration metadata 선언 |
| `db/migrations/0001_profile_backend.sql` | owner, OAuth/session, CLI, usage/snapshot/device와 transient atomic claim/assertion SQLite schema |
| `db/migrations/0002_account_usage_rate_limits.sql` | token record id별 fixed burst/sustained window counter와 expiry index |
| `src/profile-backend/atomic-operations.js` | 5개 operation 이름, command/result assertion, memory/file/Postgres transactional implementation |
| `src/profile-backend/store-contract.js`, `store-values.js` | contract v2 named `atomic` surface와 Worker-safe 공통 상수 분리 |
| `src/profile-backend/d1/store.js` | prepared CRUD, JSON 정규화, D1 batch 기반 5개 named operation, readiness/export 구현 |
| `src/profile-backend/d1/migration-runner.js`, `migrate.js`, `index.js` | Worker-safe migration 실행기, Node migration loader와 D1 export |
| `src/profile-backend/d1/rate-limiter.js` | shared fixed-window burst/sustained counter, atomic rejection과 `Retry-After`, expiry cleanup |
| `src/profile-backend/store.js`, `durable-store.js`, `postgres/store.js` | 기존 adapter의 named operation 구현과 file commit persistence 유지 |
| `src/profile-backend/oauth-runtime.js`, `accounts.js`, `session.js` | OAuth owner/session command를 준비하고 `completeOAuthCallback` operation만 호출하도록 전환 |
| `src/profile-backend/cli-login.js`, `tokens.js` | approve/exchange/poll을 named operation으로 전환하고 raw token/record 준비와 atomic 발급 분리 |
| `src/profile-backend/account-usage-submit.js` | async shared limiter와 `submitAccountUsage` command를 사용해 stale/conflict/idempotent/new 및 device touch를 한 경계로 전환 |
| `src/profile-card/service.js` | expected owner revision을 사용하는 conditional visibility operation과 단조 증가 revision timestamp 적용 |
| `src/profile-backend/http.js`, `snapshots.js` | Worker-safe store 상수를 사용하도록 변경; legacy snapshot transaction fallback 동작은 유지 |
| `src/profile-runtime/sites/backend.js`, `worker.js`, `config.js` | D1 store/shared limiter dependency seam과 DB-only binding validation 추가; Stage 4 API factory 전에는 503 유지 |
| `src/profile-backend/__tests__/atomic-operations.test.js` | contract v2 operation/command/result surface 검사 |
| `src/profile-backend/__tests__/_d1-worker-harness.js`, `_d1-test-fixture.js` | 실제 Miniflare workerd/D1에서 production adapter와 migration runner를 호출하는 local harness |
| `src/profile-backend/__tests__/d1-migrate.test.js`, `d1-store.test.js` | 실제 D1 migration/idempotency, contract, CRUD/JSON, conflict 검증 |
| `src/profile-backend/__tests__/d1-concurrency.test.js` | 실제 D1에서 5개 operation의 동시 소비/lost-update/partial-write 방지 검증 |
| `src/profile-backend/__tests__/d1-rate-limiter.test.js` | concurrent burst, sustained rollback, expiry cleanup과 raw token 비저장 검증 |
| `src/profile-runtime/sites/__tests__/backend.test.js`, `config.test.js` | D1 dependency 주입, fail-closed, DB-only binding 검증 |
| 기존 memory/file/Postgres/service test | contract v2와 named operation fault injection에 맞게 회귀 fixture 갱신 |

D1 schema/adapter/migration/rate limiter 본문은 1,304줄, provider-neutral atomic operation은 386줄이다. D1 harness와 전용 test 및 Sites backend test는 1,140줄이다.

`.openai/hosting.json`은 계속 `d1: null`, `r2: null`이며 `project_id`가 없다. Site, D1, R2, OAuth app, runtime secret과 access policy는 생성하거나 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

외부 HTTP API의 request/response shape, 기존 record shape, OAuth/CLI/Account Usage/visibility 결과 의미는 유지했다. service는 provider별 transaction이나 SQL을 알지 않고 `store.atomic.{operation}`만 호출한다.

Memory/file/Postgres는 기존 `transaction(runner)`를 adapter-local compatibility primitive로 유지하되 named operation을 그 위에서 구현한다. D1은 contract v2를 만족하지만 `transaction` property가 없으며, transient claim/assertion과 한 번의 D1 `batch()`로 조건 확인, 다중 write, 결과 read, claim cleanup을 함께 commit한다. 조건부 claim이 0행이면 NOT NULL/CHECK constraint가 batch 전체를 rollback한다.

Visibility의 expected revision은 owner `updatedAt`을 사용하되 service가 기존 값보다 최소 1ms 큰 값을 만들고 command assertion도 동일 revision 재사용을 거부한다. 따라서 같은 clock tick의 경쟁 요청도 한 건만 commit한다.

Legacy snapshot submit과 media publication처럼 이번 5개 operation 밖의 fallback 경로는 memory/Postgres generic transaction을 계속 사용한다. D1 hosted HTTP 합성은 Stage 4 범위이므로 이번 Stage의 Sites backend는 API factory가 없으면 기존과 동일하게 503으로 닫힌다.

## 검증 결과

구현계획서 Stage 2 명령:

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

추가 Stage 2 seam 검증:

```bash
node --test src/profile-runtime/sites/__tests__/backend.test.js
node --test src/profile-runtime/sites/__tests__/config.test.js
```

결과:

- OK — atomic operation contract: 2/2 통과, 정확히 5개 operation과 command/result/revision assertion 확인
- OK — 실제 workerd/D1 migration: 2/2 통과, migration 1·2 순차 적용과 재실행 idempotency 확인
- OK — 실제 workerd/D1 store: 3/3 통과, contract v2 만족 및 generic `transaction` 부재 확인
- OK — 실제 workerd/D1 concurrency: 상위 suite와 5개 operation subtest 6/6 통과
  - 같은 OAuth state의 session은 1개만 commit
  - 같은 CLI challenge approve/exchange는 각각 1개만 commit
  - 같은 timestamp의 상충 usage 중 1개만 commit하고 패자 device touch는 없음
  - 경쟁 visibility 중 패자는 conflict이며 owner/usage/snapshot visibility가 일치
- OK — 실제 workerd/D1 rate limiter: 3/3 통과
  - concurrent burst 3건 중 2건 허용, 1건 429와 `Retry-After`
  - sustained 거부 시 같은 batch의 burst 증가도 rollback
  - expired window cleanup과 raw CLI token 비저장 확인
- OK — memory/file contract: 3/3 통과
- OK — memory transaction/named operation 회귀: 12/12 통과
- SKIP — Postgres adapter/concurrency 2개 env-gated suite: `TEST_DATABASE_URL` 미설정
- OK — OAuth runtime: 5/5 통과
- OK — CLI login: 7/7 통과
- OK — Account Usage submit: 6/6 통과
- OK — Sites backend/config seam: 10/10 통과
- OK — full-stack build: Worker ESM 44.43 kB, client entry 304.88 kB
- OK — artifact verifier: client 7 files, Worker 1 JS file, forbidden hosted import/client secret pattern 없음
- OK — 전체 test: 413개 중 407 pass, 6 skip, 0 fail
  - skip은 기존 `TEST_DATABASE_URL`/`TEST_S3_*` 미설정 integration test다.
- OK — `git diff --check`: 경고 없음

Miniflare의 `getD1Database()` proxy는 이 환경에서 응답하지 않아 test를 JS Map fake로 대체하지 않았다. 대신 Miniflare가 시작한 실제 workerd Worker에 HTTP request를 보내고, Worker 내부 `DB` binding에서 production migration runner, D1 store와 limiter를 직접 실행했다. local listener 권한으로 최종 전체 test를 재실행해 통과했다.

## 잔여 위험

- remote Sites D1 resource/binding은 아직 만들지 않았고 실제 remote D1 latency, quota와 배포 migration은 Stage 5 전까지 검증되지 않았다.
- D1 limiter는 계획의 `window_start/count` schema에 맞춘 fixed window다. rolling window인 기존 in-memory limiter와 경계 시점 허용 패턴은 다르며, 배포 부하 관찰 후 sliding window 또는 Durable Object가 필요한지 판단해야 한다.
- legacy snapshot submit과 media publication은 아직 generic transaction fallback을 사용하므로 D1 hosted HTTP factory에 그대로 연결할 수 없다. Stage 4에서 route 보존 방식과 adapter composition을 확정해야 한다.
- `TEST_DATABASE_URL`이 없어 이번 변경 뒤의 live Postgres integration/concurrency suite는 실행하지 못했다. Memory fault injection과 기존 Postgres adapter surface 회귀만 확인했다.
- Sites backend는 Stage 4 API factory 전까지 의도적으로 503이며 실제 GitHub OAuth/public CLI Gate도 Stage 5에 남아 있다.

## 다음 단계 영향

- Stage 3은 이번 Worker-safe 경계와 별도로 native R2 media adapter를 구현하고, AWS SDK를 hosted import graph에 포함하지 않아야 한다.
- Stage 3에서도 `.openai/hosting.json`의 `d1`/`r2`는 remote Gate 전까지 `null`로 유지한다.
- Stage 4는 `createProfileSitesBackendHandler({ createBackendApiHandler })`에 D1 store와 shared rate limiter를 주입해 실제 HTTP service를 합성한다.
- Stage 4에서 legacy snapshot fallback과 publication coordinator가 D1의 generic transaction 부재를 침범하지 않도록 별도 보존/대체 전략이 필요하다.

## 승인 요청

- Stage 2의 D1 structured store, 5개 named atomic operation, shared rate limiter POC와 검증 결과를 승인하면 Stage 3 native R2 media adapter POC로 진행한다.
