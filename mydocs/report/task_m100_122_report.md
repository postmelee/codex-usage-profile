# Task #122 최종 보고서 — Sites live D1 structured 계정 삭제 충돌 보정

GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)
마일스톤: M100

## 작업 요약

- 대상 이슈: #122
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: Stage5 structured account deletion을 반복 rollback시킨 D1 정렬 충돌을 원자성·정보 경계를 약화하지 않고 보정하고, exact-main Stage5를 안전하게 종료해 production 공개 준비와 live recovery 후속 작업을 분리한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-backend/d1/maintenance.js` | submitted-device fingerprint의 locale 의존 정렬을 SQLite `BINARY`와 일치하는 deterministic comparator로 교체하고 확인된 state drift를 안전하게 분류 | D1 structured account deletion guard·원자성 |
| `src/profile-backend/__tests__/_d1-test-fixture.js`, `src/profile-backend/__tests__/_d1-worker-harness.js`, `src/profile-backend/__tests__/d1-maintenance.test.js` | live-equivalent mixed-case 재현, 원자 완료, injected full rollback과 정보 경계 회귀 추가 | Miniflare·real D1 회귀 |
| `src/profile-runtime/sites/maintenance.js`, `src/profile-runtime/sites/__tests__/maintenance.test.js` | 기존 `maintenance_conflict` 호환성을 유지하며 allowlist된 terminal reason·retryability만 전달 | Sites maintenance API |
| `scripts/sites-profile-maintenance.mjs`, `scripts/__tests__/sites-profile-maintenance.test.js` | terminal conflict는 read-only plan 1회 뒤 중단하고 legacy·network-unknown 계약은 보존 | 운영 CLI reconciliation |
| `scripts/smoke-sites-fullstack-local.mjs` | mixed-case 71개 structured 객체의 rollback·동일 operation 재개 완료 시나리오 추가 | real-workerd full-stack smoke |
| `docs/sites-operations.md`, `docs/production-hosting.md` | safe failure별 재시도·plan 확인·중단 판단과 transaction/application rollback 경계 기록 | 공식 운영 문서 |
| `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md` | incident 원인, 회귀, exact-main Stage5 결과와 후속 recovery 경계 기록 | 내부 장애·복구 지식 |
| `mydocs/plans/task_m100_122*.md`, `mydocs/working/task_m100_122_stage*.md`, `mydocs/orders/20260824.md` | 승인 경계, 5개 Stage 결과, 원격 provenance와 handoff 이력 기록 | Hyper-Waterfall 내부 문서 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/sites-operations.md` | `docs/` | `docs/sites-operations.md` | OK | 일반화된 Sites failure 분류와 운영 중단·재개 절차를 공식 운영 문서에 반영 |
| `docs/production-hosting.md` | `docs/` | `docs/production-hosting.md` | OK | production D1 transaction과 application rollback 금지 경계를 공식 hosting 문서에 반영 |
| `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md` | `mydocs/troubleshootings/` | 계획과 동일 | OK | 특정 Stage5 incident 원인·증적·복구 handoff를 내부 troubleshooting 위치에 보존 |
| 계획·단계·최종 보고서 | `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | 계획과 동일 | OK | 승인·단계 검증·최종 판단을 각 문서 역할에 맞게 분리 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| mixed-case live-equivalent structured delete | fingerprint mismatch로 rollback | 71개 structured 객체와 operation이 단일 D1 transaction에서 원자 완료 |
| injected owner-delete failure | 기존 작은 fixture에서 미검증 | 71개 객체·operation·승인값 전부 원상 rollback, claim residue 0 |
| terminal structured conflict CLI mutation | legacy bounded 반복 가능 | apply 1회 뒤 read-only plan 1회, 추가 mutation 없이 중단 |
| 집중 maintenance 회귀 | mixed-case·terminal 계약 없음 | D1 9 + Sites 23 + CLI 22 + production-local 2, 합계 56 pass |
| 전체 Node suite | 작업 전 기준 suite | 868개 중 862 pass·6 skip·0 fail |
| real-workerd full-stack smoke | 67 routes 기본 계약 | 67 routes, canonical update 2회와 high-cardinality rollback·resume 포함 |
| Stage5 배포 source | 기존 version 35 | exact `main` 기반 owner-only version 36 |
| Stage5 안전 종료 | active operation과 maintenance incident | operation·backup 보존, maintenance disabled·service normal·operator token absent |
| production 영향 | version 2 baseline | version 2·환경 baseline 무변경 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| live-equivalent 조건에서 충돌 원인을 결정적으로 재현 | OK — JavaScript locale 정렬과 SQLite binary 정렬의 mixed-case fingerprint 불일치를 고정하고 lowercase control과 구분 |
| exact guard와 단일 transaction 원자성 유지 | OK — device 전 field guard를 유지하면서 원자 완료와 마지막 mutation 실패 시 full rollback 검증 |
| 기존 외부 호환성과 정보 경계 유지 | OK — top-level `maintenance_conflict` 유지, allowlist 밖 reason·SQL·provider detail·row payload 차단 |
| terminal·retryable·legacy CLI reconciliation 분리 | OK — confirmed terminal만 plan 1회 뒤 중단하고 legacy·network-unknown·`not_found` 완료 계약 보존 |
| 전체 회귀·artifact·real-workerd 검증 | OK — Node 862 pass/6 skip, migration 6개, client 12·Worker 2 files, production artifact와 67-route smoke 통과 |
| exact-main Stage5 provenance와 안전 종료 | OK — exact-main version 36을 owner-only로 배포하고 기존 operation authority·R2 revision 0을 보존한 채 delete request 0건으로 안전 종료 |
| production read-only 경계 | OK — production version·source·환경과 maintenance baseline 무변경 확인 |
| production 공개 준비와 live recovery 후속 분리 | OK — #108에 production release gate를 handoff하고 안전한 credential 전달·기존 operation resume는 비차단 #125로 분리 |

### 단계별 검증 결과

- Stage 1: live-equivalent mixed-case fixture로 기존 conflict와 full rollback을 재현하고 정렬 불일치를 원인으로 확정
- Stage 2: deterministic binary comparator, safe terminal classification, 71개 객체 원자 완료·injected rollback 검증
- Stage 3: CLI bounded reconciliation, 운영 문서, 집중 56개·전체 868개 Node 회귀와 real-workerd·artifact 검증 완료
- Stage 4: checkpoint PR #123과 release PR #124를 거쳐 integrated `devel`과 exact `main` tree equality 및 Stage5 artifact provenance 확인
- Stage 5: exact-main owner-only version 36 배포, credential fail-closed 안전 종료, production 무변경과 #108/#125 handoff 완료

## 잔여 위험과 후속 작업

### 잔여 위험

- Stage5의 exact-main live operator readiness·plan·기존 operation resume는 아직 수행하지 않았다. credential을 transcript·로그·명령행·process argument에 남기지 않는 전달 경로와 별도 파괴적 승인이 필요하다.
- production은 아직 version 2와 migration `1..5` baseline이다. 공개·마케팅 전 exact-main production 배포, migration 6과 전체 사용자 흐름 smoke가 필요하다.

### 후속 작업 후보

- [#125](https://github.com/postmelee/codex-usage-profile/issues/125) — Stage5 maintenance 자격 증명 전달과 기존 operation live recovery 후속 검증
- [#108](https://github.com/postmelee/codex-usage-profile/issues/108) — production exact-main 배포, migration 6, login→submit→publish→share→account deletion smoke와 공개 release gate

## 작업지시자 승인 요청

- 작업지시자가 Stage 5 결과와 최종 보고 절차를 승인했으므로 `publish/task122` push와 `devel` 대상 task-closing PR 생성으로 진행한다.
