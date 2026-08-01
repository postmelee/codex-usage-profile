# Task M100 #63 Stage 1 완료 보고서

GitHub Issue: [#63](https://github.com/postmelee/codex-usage-profile/issues/63)
구현계획서: [`task_m100_63_impl.md`](../plans/task_m100_63_impl.md)
Stage: 1

## 단계 목적

D1 migration version/name/file 계약을 Node와 Worker가 함께 사용할 수 있는
순수 manifest로 분리하고, 일반 runtime의 rollback 호환 readiness와 향후
public candidate에서 사용할 exact readiness 판단을 같은 조회 결과에서
파생하도록 정렬했다. migration SQL과 실제 Sites/D1/R2 상태는 변경하지
않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/d1/migration-manifest.js` | 연속 version, snake_case name, exact SQL path와 deep-freeze invariant를 가진 pure manifest 추가 |
| `src/profile-backend/d1/migrate.js` | 기존 `DEFAULT_D1_MIGRATIONS`와 Node SQL loader를 pure manifest에서 파생 |
| `src/profile-backend/d1/store.js` | read-only exact readiness inspector 추가, 기존 store는 missing version만 거부하도록 호환 유지 |
| `src/profile-backend/d1/index.js` | manifest와 readiness inspector export 추가 |
| `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js` | Vite raw SQL glob을 manifest와 exact 결합해 version/name/count literal 제거 |
| `src/profile-backend/__tests__/d1-migration-contract.test.js` | manifest invariant, exact/missing/unexpected readiness와 D1 무변경성 검증 |
| `src/profile-backend/__tests__/d1-migrate.test.js` | real workerd 순서·idempotency와 Node loader/manifest metadata 정렬 검증 |
| `src/profile-backend/__tests__/d1-store.test.js` | real workerd에서 missing version 거부와 higher version rollback 호환 검증 |
| `mydocs/orders/20260801.md` | 날짜 전환 후 Task #63 Stage 1 진행 상태 기록 |
| `mydocs/working/task_m100_63_stage1.md` | Stage 1 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 기존
`DEFAULT_D1_MIGRATIONS`, `loadD1Migrations()`, `migrateD1Database()`와 store
`verifyReadiness()`의 성공 응답 형태는 유지했다. store는 기존처럼 필수
version 누락을 거부하고 더 높은 version을 허용한다.

새 exact inspector는 `schema_migrations`의 version만 한 번 조회하며
`expectedVersions`, `appliedVersions`, `missingVersions`,
`unexpectedVersions`, `readyExact`만 반환한다. migration SQL, schema,
`.openai/hosting.json`, origin 값과 public API는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-backend/__tests__/d1-migrate.test.js \
  src/profile-backend/__tests__/d1-store.test.js
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
git diff --check
git diff origin/devel -- db/migrations
```

결과:

- OK — D1 집중 테스트 12건 통과, 실패·skip 0건
- OK — real workerd D1에서 migration `[1, 2, 3]` 순서 적용과 재실행
  no-op 확인
- OK — real workerd D1에서 version 2 누락을 거부하고 version 4가 있는
  기존 schema에는 `[1, 2, 3, 4]`로 호환
- OK — standard build와 production full-stack build 통과
- OK — full-stack artifact verifier가 hosted linkage와 migration 3개를
  확인하고 Worker compressed bytes `2,146,546`으로 통과
- OK — local full-stack smoke `routesVerified=35`, public PNG 84,925 bytes,
  manifest 기반 Worker migration과 기존 OAuth/CLI/publication 흐름 통과
- OK — `git diff --check` 경고 없음
- OK — `db/migrations` diff 빈 출력; migration SQL 무변경

real workerd/Miniflare 검증은 로컬 Worker 실행 권한이 필요한 테스트이므로
샌드박스 밖의 동일 worktree·동일 의존성에서 재실행했으며 모든 검증이
통과했다. 미실행 또는 skip으로 처리한 항목은 없다.

## 잔여 위험

- protected maintenance endpoint와 operator CLI는 아직 exact inspector를
  호출하지 않는다. Stage 2에서 기존 인증·same-origin·disabled-as-404
  경계 안에 연결해야 한다.
- full-stack artifact verifier의 migration count는 아직 고정값 `3`이다.
  Stage 3에서 manifest filename set 기반으로 교체하되 production exact
  allowlist는 독립 유지해야 한다.
- 실제 Sites owner-only candidate, 원격 D1 readiness와 public access
  전환은 승인된 제외 범위로 수행하지 않았다.

## 다음 단계 영향

- Stage 2는 `inspectD1MigrationReadiness(database)`의 exact 결과만 사용해
  read-only `readiness` operation을 추가한다.
- 일반 store `verifyReadiness()`를 public candidate exact gate로 재사용하지
  않는다. higher version 허용은 rollback 호환 경계로 유지한다.
- 성공 응답에는 bounded version 배열만 포함하고 owner/usage/token/session,
  SQL/provider message와 R2 metadata를 포함하지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 protected Sites readiness
  preflight 구현으로 진행한다.
