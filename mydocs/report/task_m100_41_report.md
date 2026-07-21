# 최종 보고서 — Task #41: Neon production structured store 및 migration 구현

GitHub Issue: [#41](https://github.com/postmelee/codex-usage-profile/issues/41)
마일스톤: M100

## 작업 요약

- 대상 이슈: #41
- 마일스톤: M100
- 단계 수: 5 (+ Stage 1.1 보완)
- 작업 목적: Cloud Run 다중 인스턴스 production runtime의 durable structured store를 벤더 중립 Postgres(배포 대상 Neon) adapter로 구현하고, store contract의 5개 원자 연산을 실제 DB transaction(`FOR UPDATE`)으로 보장하며, versioned migration과 file store seeding/rollback 경로를 확보한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-backend/store-contract.js` | `transaction` method 추가, async 계약 명문화, submit records 경계 정합 | store 계약 소비자 전체 |
| `src/profile-backend/store.js` | memory store `transaction` (FIFO 직렬화 + AsyncLocalStorage 중첩 감지 + 스냅샷/복원) | 로컬 개발·테스트 fixture |
| `src/profile-backend/durable-store.js` | file store transaction persist를 직렬화 슬롯 내 1회로 | 로컬 개발·spike |
| `src/profile-backend/{oauth-runtime,cli-login,account-usage-submit,accounts,devices,session,tokens,snapshots}.js` | store 호출 async 전환, 원자 연산을 `store.transaction` 스코프로, tx-bound `store` override, submit의 owner row 선 잠금 | 백엔드 서비스 전체 |
| `src/profile-backend/http.js`, `src/profile-card/service.js` | async 정합, `updateVisibility`가 owner+usage+snapshot을 한 transaction으로 | HTTP 표면·카드 서비스 |
| `src/profile-backend/postgres/pool.js` | `NEON_DATABASE_URL` 로딩 한정, 인스턴스당 소형 pool·timeout | production 연결 관리 |
| `src/profile-backend/postgres/store.js` | 전체 contract 구현 adapter (FOR UPDATE, SET LOCAL, 23505→conflict, readiness) | production store |
| `src/profile-backend/postgres/migrate.js` + `migrations/0001_init.*.sql` | versioned up/down runner(advisory lock)와 schema DDL(unique 8종, secret 컬럼 없음) | schema 수명주기 |
| `src/profile-runtime/production-server.js` | external branch adapter 생성·readiness·종료 시 pool close | production 기동/종료 |
| `scripts/migrate-file-store-to-postgres.mjs` | seeding 도구 (dry-run/idempotent/rollback) | 데이터 이전 |
| `src/profile-backend/__tests__/{store-transactions,postgres-migrate,postgres-store,postgres-concurrency}.test.js`, `scripts/__tests__/…` | 원자성 계약·migration·adapter·동시성 매트릭스·seeding 검증 (Postgres는 `TEST_DATABASE_URL` gated) | 회귀 안전망 |
| 기존 test 13종 + CLI integration | async 전환 정합 | 회귀 안전망 |
| `docs/production-hosting.md` | 구현 상태 반영, adapter env 확정, retention/backup/PII 절 신설 | 공식 아키텍처 문서 |
| `README.md` | external store 문구 현행화 2곳 | 공식 소개 문서 |
| `package.json`(+lock) | `pg ^8.22.0`, `migrate:postgres`/`migrate:seed` 스크립트 | 의존성·운영 명령 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| retention/backup/PII 정책 | `docs/production-hosting.md` 절 확장 | `docs/production-hosting.md` "Data Retention, Backup, PII 최소화" | OK | 수행계획서 확정 결정 5번 |
| schema/migration 상태 반영 | `docs/production-hosting.md` | 동일 문서 각 절 | OK | 후속 작업 1·2 완료 반영 |
| README 현행화 | (Stage 5 보고서에서 승인) | `README.md` 2문장 | OK | 작업지시자 "함께 수정" 지시 |
| 작업 산출물 | `mydocs/` | `mydocs/plans·working·report` | OK | 규칙 고정 경로 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 전체 테스트 (`npm test`, env 없음) | 305 pass | 321 pass / 4 skipped(gated) / 0 fail |
| 전체 테스트 (`TEST_DATABASE_URL` 포함) | (해당 없음 — Postgres 경로 부재) | 352 / 352 pass |
| production external 기동 | adapter 부재로 불가(fail closed만) | 실 DB 기동·readiness·청정 종료 실측 |
| runtime 의존성 | pg 없음 | `pg ^8.22.0` 1종 추가 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| `PROFILE_STORE_MODE=external`에서 Neon adapter로 production runtime 시작 | OK — 실 Postgres 스모크: 미마이그레이션 DB 기동 거부 → 마이그레이션 DB 기동 → `/healthz` 200 → 실 store 경유 404 → server+pool 청정 종료 |
| 다중 인스턴스 경쟁에서 OAuth state·CLI challenge·usage revision 중복 소비·부분 commit 없음 | OK — 5연산 × {병렬 중복 소비, 실패 주입} 매트릭스 14/14 (`postgres-concurrency.test.js`) |
| raw CLI token·GitHub OAuth access token DB 미저장 | OK — 실 flow 후 전체 상태 raw 값 스캔 부재 + digest 존재 증명 + schema 컬럼 allowlist 정확 일치 + 소스 grep 무히트 |
| owner scope 우회 조회 불가 | OK — SQL `WHERE` owner scope 강제 + 교차 조회 격리 test |
| migration dry-run·실행·재실행·rollback 검증 | OK — schema up/down/up 재현(gated 3/3) + seeding 7/7 + CLI smoke 전 사이클 |
| `npm test` | OK — env 없음 321 pass/0 fail(어디서나 green), env 포함 352/352 |
| `git diff --check` | OK — 무경고 |

### 단계별 검증 결과

- Stage 1(+1.1): [task_m100_41_stage1.md](../working/task_m100_41_stage1.md) — async 계약·transaction scope, lost-commit 결함 재현→직렬화 수정
- Stage 2: [task_m100_41_stage2.md](../working/task_m100_41_stage2.md) — schema·migration runner, 실 DB bootstrap 검증
- Stage 3: [task_m100_41_stage3.md](../working/task_m100_41_stage3.md) — adapter·FOR UPDATE·external wiring·readiness
- Stage 4: [task_m100_41_stage4.md](../working/task_m100_41_stage4.md) — seeding dry-run/idempotent/rollback
- Stage 5: [task_m100_41_stage5.md](../working/task_m100_41_stage5.md) — 동시성 매트릭스·secret·retention 문서

## 잔여 위험과 후속 작업

### 잔여 위험

- 원격 Neon project 연결·pooled endpoint·scale-to-zero 재개 지연은 로컬 Docker Postgres로 대체 검증했다. 실측은 #43 배포 task 범위다.
- R2 도입(#42) 전까지 공개 card 요청이 Postgres를 직접 조회하므로 콜드스타트 지연이 card 응답에 노출될 수 있다(문서 명시, #42로 해소).
- CLI token 검증(lastUsedAt)과 submit commit 사이의 극소 revoke race는 기존 동작 보존을 위해 의도적으로 tx 밖에 두었다(계약·문서 명문화).

### 후속 작업 후보

- 만료 레코드 정리(retention 자동화)와 계정 삭제 기능 — `docs/production-hosting.md` 정책 절의 #43 확정 항목과 연동
- 없음(그 외) — R2/배포/QA는 기존 이슈 #42·#43·#45가 담당

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 PR 게시 절차로 진행한다.
