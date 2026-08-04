# Task M100 #74 Stage 1 보고서 — owner 카드 설정·migration·API 계약

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
구현계획서: [`task_m100_74_impl.md`](../plans/task_m100_74_impl.md)
Stage: 1

## 단계 목적

Profile 카드 커스터마이징의 저장·API 기반을 먼저 확정했다. versioned `cardStyle`과 닫힌 preset registry를 도입하고, 기존 owner에는 canonical dark/none 기본값을 적용했다. D1/Postgres additive migration, owner revision 기반 atomic mutation, owner/public response의 theme URL 계약과 maintenance export/restore 호환성을 구현했다. 실제 dual stable media 생성·serving은 계획대로 Stage 2~3의 seam으로 남겼다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/presentation.js` | `cardStyle` v1 registry, strict normalization, 크기 제한, canonical serialization과 presentation digest를 추가했다. |
| `src/profile-card/service-core.js` | owner CAS 설정 저장과 공개 owner media ensure 선행 seam을 추가했다. |
| `db/migrations/0004_card_style.sql` | D1 owner `card_style` canonical JSON 기본값과 JSON 유효성 제약을 additive하게 추가했다. |
| `src/profile-backend/postgres/migrations/0003_card_style.{up,down}.sql` | Postgres JSONB 카드 설정 migration과 rollback을 추가했다. |
| `db/schema.ts`, `src/profile-backend/d1/migration-manifest.js` | D1 migration 4를 ordered manifest/schema에 반영했다. |
| `src/profile-backend/{store-contract.js,atomic-operations.js,store.js}` | memory/file 공통 owner 기본값과 atomic `updateCardSettings` 계약을 추가했다. |
| `src/profile-backend/d1/{store.js,maintenance.js}` | canonical D1 persistence, CAS mutation, legacy backup 기본값과 digest 검증을 구현했다. |
| `src/profile-backend/postgres/store.js` | Postgres owner JSONB 저장·조회와 canonical 기본값을 구현했다. |
| `src/profile-backend/{http.js,maintenance-contract.js}` | owner-only settings endpoint, strict body/CSRF, additive profile fields와 backup 계약을 추가했다. |
| `src/profile-api/client.js` | 카드 설정 mutation client를 추가했다. |
| `src/profile-card/__tests__/presentation.test.js` 및 관련 backend/API tests | registry, migration, store, atomic update, HTTP validation·CSRF·serialization 회귀를 고정했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 변경은 해당 없다. 기존 query 없는 `/u/{handle}/card.png`와 `publicCardUrl`은 dark 호환 URL로 보존했다. 신규 설정과 URL map은 additive field로만 노출하며, 실제 공개 PNG bytes와 media contract는 아직 변경하지 않았다. 기존 store record와 maintenance backup에서 `cardStyle`이 누락된 경우만 canonical dark/none으로 보정한다.

## 검증 결과

구현계획서의 Stage 1 명령을 그대로 실행했다. Miniflare가 loopback port를 사용하므로 sandbox 밖에서 실행했다.

```bash
node --test \
  src/profile-card/__tests__/presentation.test.js \
  src/profile-backend/__tests__/store-contract.test.js \
  src/profile-backend/__tests__/store.test.js \
  src/profile-backend/__tests__/durable-store.test.js \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-backend/__tests__/d1-migrate.test.js \
  src/profile-backend/__tests__/d1-store.test.js \
  src/profile-backend/__tests__/postgres-migrate.test.js \
  src/profile-backend/__tests__/postgres-store.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-api/__tests__/client.test.js
git diff --check
```

결과:

- OK — 108 tests, 106 pass, 0 fail, 2 skip.
- SKIP — `TEST_DATABASE_URL`이 없어 실제 PostgreSQL migration up/down/up 및 adapter integration 각 1건을 실행하지 않았다. migration loader·pairing·store 단위 계약은 통과했다.
- OK — real-workerd D1 migration 1~4, idempotency, store round-trip과 atomic card settings update가 통과했다.
- OK — 추가 회귀 검증 `node --test src/profile-backend/__tests__/d1-maintenance.test.js`: 4 pass, 0 fail.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- 공개 light URL은 Stage 1에서 response 계약과 ensure seam만 제공한다. light stable object와 authority 검증이 구현되는 Stage 2~3 전에는 실제 media 기능 완료로 간주하지 않는다.
- 실제 PostgreSQL 연결 검증 2건은 `TEST_DATABASE_URL`이 있는 환경에서 Stage 6 통합 검증 시 다시 실행해야 한다.
- D1 migration은 additive라 이전 saved version이 신규 column을 무시할 수 있지만, production artifact와 운영 migration 절차 반영은 Stage 6 범위다.

## 다음 단계 영향

- Stage 2는 `presentationDigest`, `theme`과 기존 query 없는 dark 호환을 media contract v4의 identity로 사용한다.
- light stable serving은 dark authority의 publication id를 확인하기 전까지 fail-closed해야 한다.
- Stage 3에서 `ensureCardStyleMedia` seam을 실제 dual publication으로 연결한 뒤에만 공개 owner의 light 설정 저장을 완성한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 media theme 축과 dual stable serving 구현으로 진행한다.
