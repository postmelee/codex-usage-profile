# 구현계획서 — Task #41: Neon production structured store 및 migration 구현

수행계획서: [`task_m100_41.md`](task_m100_41.md)
GitHub Issue: [#41](https://github.com/postmelee/codex-usage-profile/issues/41)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | async 계약 정렬과 atomic operation 승격 | `store-contract.js`, `store.js`, `durable-store.js`, 서비스 9종, `http.js`, `store-transactions.test.js` | `node --test` 전체 회귀 green |
| 2 | Postgres schema와 versioned migration | `postgres/migrate.js`, `postgres/migrations/0001_init.*.sql` | up→down→up, clean bootstrap |
| 3 | Postgres async adapter와 runtime wiring | `postgres/store.js`, `postgres/pool.js`, `production-server.js`, `config.js` | contract test(env-gated), external 기동 |
| 4 | file→Postgres seeding migration | `scripts/migrate-file-store-to-postgres.mjs` + test | dry-run/실행/재실행/rollback |
| 5 | concurrency·failure·secret·문서 | `postgres-concurrency.test.js`, `docs/production-hosting.md` | 경쟁·부분 commit 부재, secret 미저장 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| retention/backup/PII 정책 | `docs/production-hosting.md` 절 확장 | `docs/production-hosting.md` (Stage 5) | OK | 신규 파일 아님 |
| Neon schema/migration 참조 | `docs/production-hosting.md` "후속 작업" 갱신 | `docs/production-hosting.md` (Stage 5) | OK | 상태만 갱신 |
| 어댑터 코드 | (제품 문서 아님) | `src/profile-backend/postgres/` | OK | 벤더 중립 코드, 공식 문서 아님 |

## Stage 1 — async 계약 정렬과 atomic operation 승격

### 산출물

신규:

- `src/profile-backend/__tests__/store-transactions.test.js`

수정:

- `src/profile-backend/store-contract.js` — `PROFILE_BACKEND_STORE_METHODS`에 `transaction` 추가, async 계약 주석
- `src/profile-backend/store.js` — memory store에 `transaction(fn)` (스냅샷/복원 기반 all-or-nothing) 추가
- `src/profile-backend/durable-store.js` — `transaction`을 proxy에서 특수 처리(성공 시 1회 persist), 실패 시 memory 복원
- store 호출 서비스 async 전환: `oauth-runtime.js`, `cli-login.js`, `account-usage-submit.js`, `accounts.js`, `devices.js`, `session.js`, `tokens.js`, `snapshots.js` — store 호출 `await`, 원자 연산은 `store.transaction`으로 감싸고 tx-bound sub-service 사용
- `src/profile-backend/http.js` — 서비스 호출부 `await` 정합

### 변경 내용 (transaction scope, 2026-07-21 승인 갱신)

- store는 `transaction(runner)`를 노출한다. memory 구현은 `exportState` 스냅샷 후 runner 실행, 성공 시 반환·실패 시 `clear`+`hydrate`로 복원(all-or-nothing). runner에는 tx로 store 자신을 전달(단일 스레드).
- file store는 proxy에서 `transaction`을 특수 처리: memory target에서 runner 실행 후 성공하면 1회 persist, 실패하면 memory가 이미 복원되어 persist 불필요.
- 4개 write 원자 연산은 `await store.transaction(async (tx) => { ... })`로 감싸고, 내부에서 `createAccountService({ store: tx })` 등 tx-bound sub-service를 구성해 read-modify-write 전체를 스코프 안에서 실행한다. 네트워크 호출(GitHub identity)·crypto는 트랜잭션 밖에서 수행한다.
- `store-transactions.test.js`는 각 원자 연산이 (1) 성공 경로, (2) 중복 소비 거부, (3) 부분 commit 부재(실패 시 관련 레코드 원상)를 memory store 기준으로 고정한다.
- 서비스 외부 시그니처와 HTTP 응답 형태는 유지한다(회귀 관점 고정). memory/file **store method 자체는 동기 유지**(store-level test 무변경), 서비스 계층만 async.

### 검증

```bash
node --test
git diff --check
```

### 커밋

```text
Task #41 Stage 1: store contract async 정렬과 5 atomic operation 승격
```

## Stage 2 — Postgres schema와 versioned migration

### 산출물

신규:

- `src/profile-backend/postgres/migrations/0001_init.up.sql`
- `src/profile-backend/postgres/migrations/0001_init.down.sql`
- `src/profile-backend/postgres/migrate.js` — 순번 기반 up/down runner, `schema_migrations` 테이블, `pg_advisory_lock`
- `src/profile-backend/__tests__/postgres-migrate.test.js` (env-gated)

수정:

- `package.json` — `pg` dependency, `"migrate:postgres": "node src/profile-backend/postgres/migrate.js"` 스크립트

### 변경 내용

- `0001_init.up.sql`은 8개 테이블(owner, oauth_state, session, cli_login_challenge, cli_token, latest_snapshot, latest_usage, submitted_device)과 unique constraint(provider identity, handle, token digest, device/user code, owner+deviceKey, owner/handle latest)를 생성한다. raw secret 컬럼 없음(digest만).
- runner는 `SELECT pg_advisory_lock(...)`로 단일 실행을 보장하고, 적용된 migration을 `schema_migrations`에 기록하며, `down`은 역순 롤백한다.
- 최소 한 application rollback 구간 backward compatible 원칙을 주석으로 명시한다.
- test는 `TEST_DATABASE_URL`이 있을 때만 실행: clean DB → up → 스키마·constraint 존재 확인 → down → up 재현.

### 검증

```bash
node --test src/profile-backend/__tests__/postgres-migrate.test.js
git diff --check
```

### 커밋

```text
Task #41 Stage 2: Postgres schema와 versioned migration runner
```

## Stage 3 — Postgres async adapter와 runtime wiring

### 산출물

신규:

- `src/profile-backend/postgres/pool.js` — `pg` Pool 생성, `NEON_DATABASE_URL` 로딩, pool max·`statement_timeout`
- `src/profile-backend/postgres/store.js` — `createPostgresProfileBackendStore` (전체 contract + 5 transaction)
- `src/profile-backend/__tests__/postgres-store.test.js` (env-gated, 계약 회귀)

수정:

- `src/profile-backend/index.js` — adapter export 추가
- `src/profile-runtime/production-server.js` — `createProductionStore` external branch에서 Postgres store 생성
- `src/profile-runtime/config.js` / `deployment-config.js` — Postgres 연결 env(서버 전용) 로딩, dependency readiness 검증

### 변경 내용

- 각 read/list는 owner scope 파라미터를 SQL `WHERE`로 강제해 우회 조회를 차단한다.
- 5 transaction은 `BEGIN` 내에서 `SELECT … FOR UPDATE`(직렬화 키: oauthState.id / cliLoginChallenge.id / owner.id) 또는 conditional `UPDATE … WHERE`로 stale/conflict/idempotent/new를 원자 판정하고 부분 commit 없이 `COMMIT`한다. 실패 시 `ROLLBACK`.
- `production-server.js`는 external 모드에서 adapter 주입이 없으면 여전히 fail closed(기존 동작 유지), 있으면 Postgres store 사용.
- `postgres-store.test.js`는 Stage 1의 계약 test 스위트를 Postgres adapter로 재실행한다(env-gated skip).

### 검증

```bash
node --test src/profile-backend/__tests__/postgres-store.test.js
node --test src/profile-runtime/__tests__/production-server.test.js
git diff --check
```

### 커밋

```text
Task #41 Stage 3: Postgres async adapter와 external runtime wiring
```

## Stage 4 — file→Postgres seeding migration

### 산출물

신규:

- `scripts/migrate-file-store-to-postgres.mjs` — `--dry-run` / 실행 / `--rollback`
- `scripts/__tests__/migrate-file-store-to-postgres.test.js` (env-gated)

수정:

- `package.json` — `"migrate:seed": "node scripts/migrate-file-store-to-postgres.mjs"` 스크립트

### 변경 내용

- file store `exportState()` 스냅샷을 읽어 Postgres에 트랜잭션 적재한다. `--dry-run`은 적재 후 `ROLLBACK`, 실제 실행은 `COMMIT`, 재실행은 unique key upsert로 idempotent, `--rollback`은 대상 owner scope 삭제로 원상 복원.
- 실데이터 부재를 감안해 `hydrate` 로직을 재사용하고 도구는 얇게 유지한다.
- test: fixture 스냅샷 → seeding → row 수 확인 → 재실행 무변화 → rollback 후 empty.

### 검증

```bash
node --test scripts/__tests__/migrate-file-store-to-postgres.test.js
git diff --check
```

### 커밋

```text
Task #41 Stage 4: file store에서 Postgres로의 seeding migration
```

## Stage 5 — concurrency·failure injection·secret·문서

### 산출물

신규:

- `src/profile-backend/__tests__/postgres-concurrency.test.js` (env-gated)

수정:

- `docs/production-hosting.md` — retention/backup/PII 절 추가, "설계만 확정됨"→구현 완료 상태 갱신, "후속 작업" 1·2번 반영

### 변경 내용

- concurrency test 상한: **5 atomic operation × {중복 소비, 부분 commit}** 매트릭스. 동일 pending state/challenge에 병렬 요청을 보내 정확히 하나만 소비되는지, transaction 중 실패 주입 시 부분 commit이 없는지 검증한다.
- secret inspection: 저장 경로에 raw token/OAuth access token이 없는지 `grep`과 schema 확인으로 고정한다.
- 문서: retention/backup 기본 정책(백업 보관, 계정 삭제, PII 최소화)과 Neon 연결 env·pooled endpoint 운영 지침을 `docs/production-hosting.md`에 추가한다.

### 검증

```bash
node --test src/profile-backend/__tests__/postgres-concurrency.test.js
grep -rniE "access_token|refresh_token|raw.?token" src/profile-backend/postgres/ || true
npm test
git diff --check
```

### 커밋

```text
Task #41 Stage 5: concurrency·failure injection test와 retention 문서
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다. env-gated Postgres test는 `TEST_DATABASE_URL` 유무를 보고서에 명시한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_41_stage{N}.md`를 함께 묶는다.
- 형식: `Task #41 Stage {N}: {요약}`.

## 단계 의존성

- Stage 2는 Stage 1의 async 계약·원자 method 확정 후 진행한다.
- Stage 3은 Stage 2의 schema·runner 확정 후 진행한다.
- Stage 4는 Stage 3의 adapter 확정 후 진행한다.
- Stage 5는 Stage 3·4의 transaction·seeding 확정 후 진행한다.

## 위험과 대응

- **env-gated test가 CI/이 환경에서 skip됨**: 로컬 Docker Postgres로 실행하고, skip 시 그 사실을 단계 보고서에 명시한다. `npm test`는 어디서나 green 유지.
- **async 전환 회귀**: Stage 1에서 서비스 시그니처·HTTP 응답을 유지하고 전체 `node --test`로 고정한 뒤에만 Stage 2 진행.
- **콜드스타트 × card.png (기간 한정)**: #42 전까지 리스크임을 문서에 명시, readiness·pooled endpoint로 완화.

## 승인 요청 사항

- 5 Stage 분할, 각 Stage 산출물 경로, 검증 명령, 커밋 메시지 형식 승인.
- env-gated 실 Postgres 테스트 방식(로컬 Docker) 승인.
- 승인 시 Stage 1부터 구현에 착수한다.
