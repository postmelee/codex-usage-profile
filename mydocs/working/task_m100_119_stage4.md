# Task #119 Stage 4 보고서 — migration·운영 문서와 통합 검증 정합화

GitHub Issue: [#119](https://github.com/postmelee/codex-usage-profile/issues/119)

구현계획서: [`task_m100_119_impl.md`](../plans/task_m100_119_impl.md)

Stage: 4

## 단계 목적

Stage 1~3의 계정 삭제 operation·lease·bounded batch·CLI 재개 계약을 실제 Sites production artifact와 local full-stack runtime에 연결했다. migration 6이 manifest 순서대로 누락 없이 package되는지 독립 verifier와 smoke로 확인하고, operator가 timeout·live lease·부분 삭제를 안전하게 재개하거나 중단할 수 있도록 공식 운영 문서를 정합화했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/verify-sites-production-artifact.mjs` | production independent migration allowlist를 `0001..0006` exact 집합으로 확장 |
| `scripts/__tests__/verify-sites-production-artifact.test.js` | migration 6 포함·6개 count와 unreviewed migration 7 거부 fixture 추가 |
| `scripts/__tests__/verify-sites-fullstack-artifact.test.js` | full-stack fixture를 manifest 1..6과 exact order로 갱신 |
| `scripts/smoke-sites-fullstack-local.mjs` | migrate/readiness 1..6, 계정 삭제 completed progress를 real workerd에서 검증 |
| `scripts/__tests__/sites-profile-maintenance.test.js` | operator migrate fixture를 candidate 1..6으로 정합화 |
| `docs/sites-operations.md` | migration 6 packaging·reconciliation, serial batch·operation ID·Retry-After·network-unknown·not-found 완료·복구 runbook 추가 |
| `docs/production-hosting.md` | migration 6 additive operation table, owner cascade, active operation rollback 금지와 lifecycle 경계 추가 |

## 본문 변경 정도 / 본문 무손실 여부

과거 production과 stage5에서 실제 관찰한 readiness `[1,2,3,4,5]` 기록은 당시 증적으로 그대로 보존했다. 앞으로 배포할 Task #119 candidate, packaging allowlist와 startup 계약만 migration `1..6`으로 변경했다. 기존 export/restore/retention, public route, rollback과 fallback 설명은 유지하고 계정 삭제의 새 operation·lease·bounded batch 절차만 필요한 위치에 추가했다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-media/__tests__/r2-binding-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js \
  scripts/__tests__/verify-sites-fullstack-artifact.test.js \
  scripts/__tests__/verify-sites-production-artifact.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
npm run scan:public-release
npm test
git diff --check origin/devel...HEAD
git status --short
```

결과:

- OK — Stage 4 대상 84 tests, 84 pass, 0 fail.
- OK — `build:sites-fullstack` 성공, Worker와 client production artifact 생성.
- OK — full-stack·production verifier 모두 `migrationFileCount: 6`; hosted project와 `DB`·`PROFILE_MEDIA` exact binding, credential/path/import scan 통과.
- OK — local real-workerd smoke `routesVerified: 67`, migration 1..6 migrate/readiness와 account deletion completed progress 통과.
- OK — public release scan `blockerCount: 0`; 기존 review/info finding만 유지.
- OK — 전체 `npm test` 863 tests, 857 pass, 0 fail, 6 environment-dependent skip.
- OK — `origin/devel` 기준 변경은 Task #119의 migration, maintenance source/test, artifact/smoke, 운영 문서와 Hyper-Waterfall 산출물 24개로 한정됐다.
- OK — tracked 변경과 commit diff whitespace 검사 통과.

## 잔여 위험

- 실제 Stage5 migration 6 적용, remote deployment와 test owner 삭제 재개는 Task #119 범위가 아니며 Task #108의 별도 Gate 승인이 필요하다.
- production application rollback은 active deletion operation이 없을 때만 허용한다. active operation이 있으면 maintenance를 닫고 같은 operation을 완료하거나 별도 복구 승인을 받아야 한다.
- Sites public beta의 provider fault와 장기 quota는 local contract·smoke만으로 제거할 수 없으며 기존 운영 관찰 절차를 유지한다.

## 다음 단계 영향

- Stage 1~4 source 구현은 완료됐다. 다음 승인 뒤 `task-final-report` 절차로 최종 보고서, 오늘할일 완료, publish branch와 devel 대상 PR을 준비한다.
- PR merge·release·stage5 배포 뒤에만 Task #108 Gate E의 실제 잔여 삭제를 새 serial CLI 계약으로 재개한다.

## 승인 요청

- Stage 4 산출물과 통합 검증 결과를 승인하면 Task #119 최종 보고 및 PR 게시 단계로 진행한다.
