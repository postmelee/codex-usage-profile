# Task M100 #63 Stage 5 완료보고서

GitHub Issue: [#63](https://github.com/postmelee/codex-usage-profile/issues/63)
구현계획서: [`task_m100_63_impl.md`](../plans/task_m100_63_impl.md)
Stage: 5

## 단계 목적

PR #64 리뷰에서 확인된 병합 전 3개 항목을 기존 보안 불변 조건 안에서
보정한다. exact public gate는 유지하면서 긴급 application rollback 예외를
문서화하고, 미마이그레이션 D1 진단과 readiness 이후 maintenance 최소 노출을
실행 가능한 test와 운영 순서로 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/d1/store.js` | `sqlite_master` read-only 확인으로 migration metadata table 부재를 empty applied state로 분류 |
| `src/profile-backend/__tests__/d1-migration-contract.test.js` | table 부재가 `[1, 2, 3]` missing이며 version query·mutation을 하지 않는 회귀 추가 |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | 미마이그레이션 D1은 `migration_not_ready`, 실제 provider failure는 generic error인 경계 검증 |
| `scripts/smoke-sites-fullstack-local.mjs` | readiness 직후 maintenance를 닫고 사용자 흐름을 실행하며 lifecycle 구간만 별도 활성화 |
| `src/profile-runtime/sites/__tests__/full-stack.test.js` | 추가된 보안 전환을 포함한 42-route 증적으로 갱신 |
| `docs/sites-operations.md` | disabled/secret-absent 선복원과 별도 승인 긴급 rollback 예외 절차 명시 |
| `mydocs/plans/task_m100_63*.md` | 승인된 Stage 5 범위·검증·불변 조건 반영 |
| `mydocs/report/task_m100_63_report.md` | 최종 수용 결과를 Stage 5 기준으로 갱신 |
| `mydocs/orders/20260801.md` | Stage 5 완료 시각과 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

공개 API, migration SQL/schema, production origin, hosting manifest와 일반
runtime 동작은 변경하지 않았다. 기존 protected readiness는 missing/unexpected
모두 fail-closed하는 exact gate로 유지했다. 공식 운영 문서는 candidate
readiness 이후 maintenance 노출 시간을 줄이고 긴급 rollback이 일반 cutover
gate의 자동 우회로 오해되지 않도록 필요한 문단만 보강했다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
npm run smoke:sites-production:local
npm test
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git diff origin/devel -- \
  .openai/hosting.json \
  db/migrations \
  packages/codex-usage-profile-cli/src/config.js \
  src/profile-ui/deviceApproval.js
```

결과:

- focused migration/maintenance: 13 pass, 0 fail
- local production smoke: 42 routes, public PNG 84,925 bytes, OK
- root: 536건 중 530 pass, 0 fail, 외부 설정 부재 6 skip
- standard build: client 42 modules, OK
- production build: server 48 modules와 client 42 modules, OK
- full-stack/production verifier: migration 3개, binding 3개,
  artifact 5,496,708 bytes, OK
- `git diff --check`: OK
- hosting manifest, migration SQL, CLI/UI origin source 보호 diff: 빈 출력

## 잔여 위험

- 실제 owner-only Sites candidate와 원격 D1에서 readiness/environment 복원을
  실행하지 않았다. Task #63의 승인 범위는 local source/test/docs이며 원격
  save/deploy/access/environment와 D1/R2 mutation을 제외한다.
- PostgreSQL 5건과 S3 endpoint 1건은 외부 test 설정 부재로 기존과 같이
  skip했다. 이번 D1/Sites 보정의 직접 경로는 모두 실행됐다.
- manifest order/helper, 중복 readiness fixture, source-text test와 origin
  package-boundary 설명은 MVP 병합을 막지 않으므로 별도 follow-up issue로
  등록한다.

## 다음 단계 영향

- 다음 단계는 별도 기능 구현이 아니라 PR #64 head 갱신과 리뷰 재확인이다.
- GitHub 리뷰 답변·PR head push·후속 issue 생성은 각각 명시 승인 뒤 수행한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 PR #64 head 갱신 단계로 진행한다.
