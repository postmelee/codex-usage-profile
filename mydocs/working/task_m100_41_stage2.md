# 단계 보고서 — Task #41 Stage 2

GitHub Issue: [#41](https://github.com/postmelee/codex-usage-profile/issues/41)
구현계획서: [`task_m100_41_impl.md`](../plans/task_m100_41_impl.md)
Stage: 2 — Postgres schema와 versioned migration

## 단계 목적

store contract v1의 8개 레코드를 담는 Postgres schema(DDL)와 up/down versioned migration runner를 만든다. unique constraint 6종을 DDL에서 강제하고, advisory lock으로 다중 실행을 직렬화하며, clean database bootstrap과 up→down→up 재현을 실 Postgres로 검증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/postgres/migrations/0001_init.up.sql` | 8개 테이블 DDL. NOT NULL은 contract `requireFields`와 1:1, unique constraint 8개 명명(provider identity, handle, token digest, device/user code, owner+deviceKey, usage/snapshot handle), raw secret 컬럼 없음(digest만). 타임스탬프는 ISO-8601 UTC text(계약 fixture와 byte-identical round-trip, 사전순=시간순), FK 없음(계약이 unique key만 요구, 삭제 없는 데이터) — 판단 근거를 파일 주석에 기록 |
| `src/profile-backend/postgres/migrations/0001_init.down.sql` | 역순 DROP. `schema_migrations`는 runner 소유라 미포함 |
| `src/profile-backend/postgres/migrate.js` | `loadMigrations`(쌍 검증·정렬), `migrateUp`/`migrateDown`/`migrationStatus`, `schema_migrations` bookkeeping, `pg_advisory_lock` 직렬화, migration별 BEGIN/COMMIT, CLI(`up|down|status`, `NEON_DATABASE_URL`/`DATABASE_URL`, URL 미출력). 부팅 시 자동 실행 금지 원칙 주석 명시 |
| `src/profile-backend/__tests__/postgres-migrate.test.js` | 비gated 2건(파일 쌍·명명 규율), gated 1건(`TEST_DATABASE_URL`): clean bootstrap→테이블·constraint 검증→idempotent 재실행→down→up 재현 |
| `package.json` / `package-lock.json` | `pg ^8.22.0` dependency, `migrate:postgres` 스크립트 |

## 본문 변경 정도 / 본문 무손실 여부

신규 파일 추가와 의존성 등록만. 기존 코드·동작 변경 없음(회귀 무영향은 아래 검증으로 확인).

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/postgres-migrate.test.js   # env 유무 각각
npm run migrate:postgres -- status|up|down                           # CLI smoke (실 DB)
npm test                                                             # env 유무 각각
git diff --check
```

결과:

- OK — gated test, 실 Postgres 17(로컬 Docker `postgres:17-alpine`, 임시 schema)에서 `3 pass / 0 fail`: bootstrap 후 테이블 9종·unique constraint 8종 정확 일치, 재실행 no-op, down 후 `schema_migrations`만 잔존, up 재현 일치
- OK — env 없이 `npm test`: `320 tests / 319 pass / 1 skipped / 0 fail` (gated test는 skip — 어디서나 green 유지 전략 충족)
- OK — env 포함 `npm test`: `320 / 320 pass / 0 skipped`
- OK — CLI smoke: `status → up(applied 0001_init) → status(applied: 1) → down(reverted) → status(pending: 1)` 전체 사이클 정상, 연결 문자열 미출력
- OK — `git diff --check` 무경고

## 잔여 위험

- **advisory lock 경쟁 실측 미실시**: 동시 runner 2개의 직렬화는 lock 의미론으로 보장되나 실측은 Stage 5 concurrency test에서 수행한다.
- **schema는 adapter 없이는 미사용**: 컬럼 camel↔snake 매핑 정합은 Stage 3 adapter의 contract test 재실행에서 최종 확인된다.

## 다음 단계 영향

- Stage 3 adapter는 이 DDL의 컬럼·constraint 이름을 그대로 매핑하면 된다. unique 위반은 Postgres error code(23505)를 contract의 `CONFLICT`로 변환한다.
- 검증용 로컬 Postgres 컨테이너(`cup-task41-pg`, 포트 54329, `--rm`)가 가동 중이며 Stage 3~5 검증에 재사용 후 task 종료 시 정리한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3(Postgres async adapter와 runtime wiring)으로 진행한다.
