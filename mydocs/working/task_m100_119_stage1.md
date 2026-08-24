# Task #119 Stage 1 보고서 — 지속 삭제 operation과 lease 기반

GitHub Issue: [#119](https://github.com/postmelee/codex-usage-profile/issues/119)

구현계획서: [`task_m100_119_impl.md`](../plans/task_m100_119_impl.md)

Stage: 1

## 단계 목적

계정 삭제가 한 HTTP 요청을 넘어 안전하게 재개될 수 있도록 D1에 owner-scoped operation과 lease checkpoint를 추가했다. 최초 승인 digest/count 고정, 단일 active operation, 120초 lease, 순차 phase 전이와 실제 멱등 quiesce를 구축하고, migration 6의 hosted physical-schema reconciliation 경계를 함께 마련했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `db/migrations/0006_account_deletion_operations.sql` | owner cascade, 최초 승인, phase와 nullable lease pair를 보존하는 persistent operation table 추가 |
| `src/profile-backend/d1/migration-manifest.js` | exact migration manifest와 readiness 기대 버전을 1..6으로 확장 |
| `src/profile-backend/d1/maintenance.js` | operation 조회·생성, lease 획득·회수·해제, phase 전이 API와 멱등 quiesce 추가 |
| `src/profile-backend/__tests__/_d1-worker-harness.js` | 테스트용 deletion operation inspection 추가 |
| `src/profile-backend/__tests__/d1-maintenance.test.js` | 승인 고정, 동시 lease, TTL 회수, phase 순서, operation 정리와 digest 불변 테스트 추가 |
| `src/profile-backend/__tests__/d1-migration-contract.test.js` | manifest/readiness 1..6 exact 계약 갱신 |
| `src/profile-runtime/sites/maintenance.js` | migration 6 table의 exact DDL metadata-only reconciliation 추가 |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | migration 6 absent/exact/drift와 readiness fixture 검증 추가 |

## 본문 변경 정도 / 본문 무손실 여부

제품·운영 문서는 변경하지 않았다. 기존 export/restore/retention과 account deletion plan/delete 계약은 유지하고 D1 maintenance 내부 API만 additive하게 확장했다. 기존 owner count에는 operation row를 포함하지 않아 최초 삭제 승인 count 의미를 보존했다. 기존 quiesce는 모든 durable row가 이미 private인 경우 owner timestamp를 다시 쓰지 않도록 보정했다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
git diff --check
```

결과:

- OK — 30 tests, 30 pass, 0 fail.
- OK — 같은 owner의 동시 lease 획득은 정확히 한 요청만 성공했다.
- OK — 120초 만료 시 stale lease를 새 nonce로 회수했다.
- OK — migration 6 table 부재는 SQL apply, exact table은 metadata-only, DDL drift는 mutation 전 conflict로 구분했다.
- OK — 반복 quiesce 전후 owner timestamp, deletion plan digest/count가 동일했다.
- OK — `git diff --check` 통과.

## 잔여 위험

- Stage 2 전까지 기존 Sites delete-account orchestration은 새 operation/lease API를 소비하지 않는다.
- migration manifest는 1..6으로 올랐지만 artifact allowlist, local smoke와 운영 문서의 나머지 기대값은 승인된 구현계획대로 Stage 4에서 일괄 정합화한다.
- 실제 Stage5 migration·배포·잔여 계정 삭제는 이 Stage에서 수행하지 않았다.

## 다음 단계 영향

- Stage 2는 이 Stage의 `prepare → media → structured` phase와 120초 lease를 사용해 한 요청당 R2 revision batch 하나만 삭제해야 한다.
- Sites 응답에는 lease nonce나 owner scope를 노출하지 않고 별도 safe progress만 제공해야 한다.
- structured D1 delete는 실제 R2 revision이 0개일 때만 호출해야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2의 bounded R2 batch와 Sites 단계 전이 구현으로 진행한다.
