# 단계 보고서 — Task #41 Stage 4

GitHub Issue: [#41](https://github.com/postmelee/codex-usage-profile/issues/41)
구현계획서: [`task_m100_41_impl.md`](../plans/task_m100_41_impl.md)
Stage: 4 — file→Postgres seeding migration (최소 구현)

## 단계 목적

local file store 스냅샷을 Postgres로 이전하는 one-shot 도구를 만들고 dry-run/실행/재실행 idempotent/rollback을 검증한다. production 실데이터가 없으므로(개발자 로컬 한정) 계획대로 seeding 성격으로 얇게 구현하고, 기존 부품(`readStoreState` → memory store hydrate 검증 → adapter transaction upsert)을 재사용한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/migrate-file-store-to-postgres.mjs` | `seed [--file] [--dry-run]` / `rollback [--file]`. 스냅샷은 memory store hydrate로 runtime과 동일한 검증(requireFields·unique)을 통과해야 적재. 적재는 adapter transaction 1건 — dry-run은 sentinel throw로 ROLLBACK, unique 충돌은 전체 중단(부분 적재 없음), 재실행은 PK upsert로 idempotent. rollback은 스냅샷에 있는 id만 정확히 역순 DELETE(외부 데이터 불가침). 실행 전 `verifyReadiness()`로 미마이그레이션 DB 차단. 출력은 counts만(레코드 내용·연결 문자열 미출력) |
| `scripts/__tests__/migrate-file-store-to-postgres.test.js` | 비gated 1건(스냅샷 로딩·재검증, 부재 파일=빈 스냅샷), gated 5 subtest: dry-run rollback → seed 전 레코드 확인 → 재실행 exportState 완전 동일 → rollback 정확 개수 제거·전체 empty → 선점 handle 충돌 시 전체 중단·기존 데이터 불가침 |
| `package.json` | `migrate:seed` 스크립트 |

## 본문 변경 정도 / 본문 무손실 여부

신규 파일과 스크립트 등록만. 기존 코드 무변경.

## 검증 결과

실행 명령:

```bash
node --test scripts/__tests__/migrate-file-store-to-postgres.test.js   # TEST_DATABASE_URL
npm run migrate:seed -- seed --file <fixture> --dry-run / seed / rollback   # CLI smoke (실 DB)
npm test   # env 유무 각각
git diff --check
```

결과:

- OK — gated test **7/7 pass** (실 Postgres 17): dry-run 후 DB empty, seed 후 owner/token digest/usage/device 조회 일치, 재실행 `exportState` deep-equal 무변화, rollback removed 개수 정확·전체 empty, 선점 충돌 시 `conflict`로 전체 중단·기존 owner만 잔존
- OK — CLI smoke 전체 사이클: dry-run(rolled back) → seed committed → rollback `removed … sessions 1, owners 1` — 스냅샷 id만 정확 제거
- OK — env 없이 `npm test`: `324 tests / 321 pass / 3 skipped / 0 fail`
- OK — env 포함 `npm test`: `338 / 338 pass`
- OK — `git diff --check` 무경고

참고: CLI smoke 첫 시도에서 fixture 생성 env 전달 실수로 저장소 루트에 기본 경로 store 파일이 생성되어 즉시 삭제했다(미추적 파일, 커밋 영향 없음). 재실행 smoke는 정상 fixture로 수행했다.

## 잔여 위험

- **rollback은 스냅샷 기준 역연산**: seed 이후 runtime이 같은 레코드를 갱신했다면 rollback이 그 갱신본을 함께 지운다(id 동일). one-shot 이전 직후 사용을 전제로 하는 도구 성격을 사용법 주석에 명시했다. production 실데이터가 없는 현 시점 리스크는 사실상 없음.

## 다음 단계 영향

- Stage 5 concurrency·failure injection은 Stage 3 adapter와 이 도구가 공유하는 transaction 경계를 대상으로 한다. 검증용 컨테이너 `cup-task41-pg` 유지 중이며 Stage 5 종료 후 정리한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5(concurrency·failure injection·secret·retention 문서)로 진행한다.
