# 단계 보고서 — Task #41 Stage 3

GitHub Issue: [#41](https://github.com/postmelee/codex-usage-profile/issues/41)
구현계획서: [`task_m100_41_impl.md`](../plans/task_m100_41_impl.md)
Stage: 3 — Postgres async adapter와 runtime wiring

## 단계 목적

store contract 전체(31 method)를 구현하는 벤더 중립 Postgres adapter를 만들고, 5개 원자 연산의 직렬화 키를 실제 row lock(`FOR UPDATE`)으로 잠그며, `PROFILE_STORE_MODE=external`에서 production runtime이 readiness 검증을 거쳐 기동되도록 배선한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/postgres/pool.js` | `pg` Pool 생성. `NEON_DATABASE_URL`(→`DATABASE_URL`) 로딩을 pool 생성 시점 한 곳에 한정, 인스턴스당 pool max 4, `query_timeout`·connection/idle timeout. pooled endpoint 전제 주석 |
| `src/profile-backend/postgres/store.js` | `createPostgresProfileBackendStore`: 8개 레코드 column spec 기반 전체 contract 구현. `AsyncLocalStorage`로 transaction runner의 async flow 전체를 전용 client에 라우팅(tx-bound sub-service가 자동으로 transactional). **transaction 내 단일행 getter는 `FOR UPDATE`** 로 직렬화 키 잠금. `BEGIN + SET LOCAL statement_timeout/idle_in_transaction_session_timeout`(transaction pooling에서도 유효). unique 위반(23505)은 constraint 이름→memory store와 동일한 CONFLICT 메시지로 매핑. `requireFields` 검증 동일 재현. jsonb 컬럼은 명시 stringify(배열의 PG array literal 오인 방지). `verifyReadiness()`(마이그레이션 적용 확인, 미실행 시 실행 명령 안내), `close()` |
| `src/profile-backend/index.js` | pool/adapter export 추가 |
| `src/profile-backend/account-usage-submit.js` | (조정) tx 첫 read를 `tx.getOwnerById`로 — 직렬화 키(owner.id) 선 잠금 + 재조회 owner의 handle/visibility로 기록해 visibility 변경과 정합 |
| `src/profile-backend/store-contract.js` | (조정, Stage 1.1 L1 해소) `submitAccountUsage.records`에서 `cliToken` 제거, lastUsedAt touch가 의도적 tx 밖임을 주석 명문화 |
| `src/profile-runtime/production-server.js` | external branch에서 adapter 생성(secret 누락 시 fail closed 유지), 자체 생성 store에만 `verifyReadiness()` 실행(주입 store는 호출자 소유), 종료 시 pool close(프로세스 잔류 방지) |
| `src/profile-runtime/__tests__/production-server.test.js` | external fail-closed 메시지 갱신(`NEON_DATABASE_URL is required`), contract 충족 store 생성 테스트 추가 |
| `src/profile-backend/__tests__/postgres-store.test.js` | env-gated 9 subtest: readiness fail-closed→contract 표면→레코드 round-trip·validation·unique conflict→transaction commit/rollback/중첩 거부→**FOR UPDATE 잠금 순서 실측**→5개 원자 연산 end-to-end→export/clear |

### 계획 대비 조정 (승인 요청 포함)

1. **env 로딩 위치**: `config.js`/`deployment-config.js` 수정 없이 `postgres/pool.js` 한 곳에 한정 — 서버 전용 secret을 config 객체·로그로 전파하지 않기 위함.
2. **submit 직렬화 키 잠금**: contract의 serializationKey(owner.id)를 실제로 잠그려면 tx 첫 read가 owner row여야 함을 구현 중 확인(최초 submit엔 usage row가 없어 `FOR UPDATE` 대상이 없음). 서비스 1곳 수정으로 해소, 부수 효과로 visibility 변경과의 handle/visibility 정합 개선.
3. **contract records 정합(L1 해소)**: lastUsedAt touch를 tx에 포함하는 대신 계약 문구를 실제 경계에 맞게 수정(기존 동작 보존 우선). `docs/production-hosting.md`의 submit 행("device touch와 함께 commit")과 이미 일치.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업. 서비스 외부 시그니처·HTTP 응답 형태 보존. submit 응답의 `owner`가 tx 시점 재조회 값으로 바뀌었으나 필드 구성은 동일(비경쟁 시 값도 동일, 기존 테스트 전부 통과로 확인).

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/postgres-store.test.js   # TEST_DATABASE_URL(로컬 Docker Postgres 17)
node --test src/profile-runtime/__tests__/production-server.test.js
npm test                                                           # env 유무 각각
git diff --check
# + production external 스모크 (스크립트)
```

결과:

- OK — postgres-store gated: **10/10 pass** (잠금 순서 실측: 첫 tx가 lock 보유 중 두 번째 tx의 동일 row read가 commit 이후에만 완료 — `["first-read","first-done","second-read"]`)
- OK — production-server: 6/6 pass
- OK — env 없이 `npm test`: `322 tests / 320 pass / 2 skipped / 0 fail`
- OK — env 포함 `npm test`: `331 / 331 pass`
- OK — production external 스모크(실 DB): 미마이그레이션 DB에 `Postgres store schema is not migrated…`로 **기동 거부**, 마이그레이션 DB에 기동 → `/healthz` 200 → 실 store 경유 `/u/nobody/card.png` 404 → server+pool 정상 종료(프로세스 잔류 없음)
- OK — `git diff --check` 무경고

## 잔여 위험

- **다중 인스턴스 경쟁의 체계적 검증은 Stage 5**: 이번 단계는 잠금 배선의 실측 1건(oauth state)까지 확인했고, 5연산 × {중복 소비, 부분 commit} 매트릭스는 Stage 5에서 수행한다.
- **verify 후 revoke race**: token 검증(tx 밖)과 submit commit 사이에 revoke가 끼어들 극소 창이 존재(기존 동작과 동일). 계약상 요구 없음, owner 본인 소유 흐름이라 수용. Stage 5 문서화 시 명시 예정.

## 다음 단계 영향

- Stage 4 seeding 도구는 file store `exportState()` → adapter `save*`/transaction으로 적재하면 된다(동일 계약 표면).
- 검증용 컨테이너 `cup-task41-pg` 유지 중.

## 승인 요청

- Stage 3 산출물, "계획 대비 조정" 3건, 검증 결과를 승인하면 Stage 4(file→Postgres seeding migration)로 진행한다.
