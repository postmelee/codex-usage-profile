# Task #119 최종 결과 보고 — Sites 계정 삭제 timeout 이후 멱등 재개 보강

GitHub Issue: [#119](https://github.com/postmelee/codex-usage-profile/issues/119)
마일스톤: M100

## 작업 요약

- 대상 이슈: #119
- 마일스톤: M100 — v1.0 MVP
- 단계 수: 4
- 작업 목적: 많은 R2 revision을 가진 계정 삭제가 요청 제한이나 응답 유실로 중단돼도 동일 operation을 안전하게 직렬 재개하고, 모든 media 제거가 확인된 뒤에만 D1 owner를 삭제하도록 보강한다.
- 완료 범위: D1 지속 operation·lease, bounded R2 batch, Sites phase 전이와 safe progress, operator CLI 직렬 재개·불확정 결과 reconciliation, migration 6 packaging·local smoke·운영 문서 정합화.

Task #108 Stage5 Gate E에서는 95개 객체 중 R2 revision 18개를 삭제한 뒤 요청이 중단되고 후속 실행이 `maintenance_conflict`로 닫혔다. Task #119는 최초 승인 digest·object count를 operation에 고정하고, 실제 R2 manifest를 매 batch 다시 읽는 재개 계약을 추가했다. stable publication과 immutable ETag 보호는 유지하며 R2 revision이 하나라도 남아 있으면 structured delete를 실행하지 않는다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `db/migrations/0006_account_deletion_operations.sql`, `src/profile-backend/d1/` | owner별 deletion operation·phase·lease table, migration manifest 1..6, 원자적 lease 획득·회수와 멱등 quiesce 추가 | D1 schema, 계정 삭제 authority와 동시성 |
| `src/profile-media/r2-binding/maintenance.js` | 기본 8개·최대 32개의 bounded revision batch, 삭제 전 stable·ETag 재검사와 post-delete manifest 반환 | R2 media 삭제와 부분 실패 재개 |
| `src/profile-runtime/sites/maintenance.js` | `prepare → media → structured → completed` 전이, safe progress, lease conflict와 완료 reconciliation 추가 | Sites maintenance API·Worker orchestration |
| `scripts/sites-profile-maintenance.mjs` | 동일 operation 직렬 반복, Retry-After·plan reconciliation, `not_found` 완료 판정과 반복 상한 추가 | 운영자 `delete-account` CLI |
| 관련 `__tests__`, artifact verifier, local smoke | timeout·중복 요청·stale state·정보 경계·migration 6 packaging 회귀 추가 | Node·Miniflare·real-workerd 검증 |
| `docs/sites-operations.md`, `docs/production-hosting.md` | batch 재개, network-unknown, lease conflict, rollback·recovery 운영 절차 보정 | 배포·운영 담당자 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/`, `mydocs/orders/` | 승인 범위, 단계별 구현·검증과 최종 결과 기록 | 내부 추적·감사 |

최종 보고 전 `origin/devel` 대비 Task #119 변경은 25개 경로, 3,265 insertions·154 deletions이며, 최종 보고서가 1개 경로 추가된다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| Sites 계정 삭제 운영 계약 | `docs/` | `docs/sites-operations.md` | OK | operator 실행·부분 진행·timeout 재개·conflict 복구 절차 |
| production migration·rollback 계약 | `docs/` | `docs/production-hosting.md` | OK | migration 6, active operation과 application rollback 호환성 |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_119*.md` | OK | 승인 범위·불변식·Stage 1~4 계획 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_119_stage{1..4}.md` | OK | 단계별 구현·검증·잔여 위험 기록 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_119_report.md` | OK | 중앙 최종 보고서 위치 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | Task #119 결과 |
|---|---|---|
| D1 migration exact version | 1..5 | 1..6 |
| 삭제 진행 상태 | 요청 내부에만 존재 | owner별 persistent operation 1개와 phase 저장 |
| 동시 mutation 통제 | 지속 lease 없음 | 120초 lease, live conflict·stale 회수 |
| 요청당 R2 revision 삭제 | 잔여 전량 순차 처리 | 기본 8개, 주입 가능 범위 1..32 |
| 계정 삭제 phase | 단일 요청 순차 흐름 | `prepare`, `media`, `structured`, `completed` |
| CLI 자동 재개 | 완료 응답 1회 의존 | 동일 operation 직렬 재개, 기본 128·최대 256회 상한 |
| local full-stack smoke | migration 1..5, 완료 progress 검증 없음 | route 67개, migration 1..6, account deletion completed 검증 |
| 최종 대상 테스트 | 수용 기준 미고정 | 84/84 pass |
| 최종 전체 Node 테스트 | Task 전 기준 | 863건 중 857 pass·0 fail·6 skip |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| timeout·부분 삭제 뒤 같은 operation 재개 | OK — 실제 manifest를 다시 읽어 이미 삭제된 key를 제외하고 잔여 batch를 처리 |
| 동일 owner 중복 요청의 안전한 직렬화 | OK — 한 요청만 lease를 획득하고 live lease는 mutation 없이 bounded retry progress 반환 |
| stale lease 회수 | OK — 120초 TTL 만료 뒤 새 nonce로 같은 operation 재개 |
| tombstone·quiesce 멱등성 | OK — 반복 실행 전후 owner timestamp와 deletion plan digest/count 동일 |
| R2 완료 전 D1 owner 보호 | OK — 남은 revision이 있으면 `media`에 머물고 structured delete 미실행 |
| stable publication·immutable ETag 보호 | OK — republish, ETag 변경, delete 후 객체 잔존을 conflict/unavailable로 닫음 |
| 최초 승인값 불변 | OK — operation ID와 최초 digest/count를 모든 batch에 유지하고 불일치는 fail closed |
| 불확정 네트워크 결과 회복 | OK — 새 mutation 전에 plan 조회, active operation 채택 또는 original plan 1회 재시도 |
| 최종 응답 유실 뒤 완료 판정 | OK — 승인된 operation의 plan `not_found`를 completed로 reconcile |
| safe progress 정보 경계 | OK — lease nonce, owner scope, R2 key·ETag, provider 원문과 extra field 미노출 |
| migration 6 artifact·readiness 정합 | OK — full-stack·production verifier와 real-workerd smoke에서 exact 1..6 확인 |
| 기존 maintenance·전체 회귀 | OK — 대상 84/84, 전체 857 pass·0 fail·6 환경 의존 skip |
| public release surface | OK — `blockerCount: 0`, 기존 review/info finding만 유지 |
| Task #119 원격 범위 | OK — Stage5 migration·배포·실데이터 mutation 미수행 |

### 단계별 검증 결과

- Stage 1: [`task_m100_119_stage1.md`](../working/task_m100_119_stage1.md) — D1 migration 6, operation·lease·멱등 quiesce; 30/30 pass.
- Stage 2: [`task_m100_119_stage2.md`](../working/task_m100_119_stage2.md) — bounded R2 batch와 Sites 단계 재개; 39/39 pass.
- Stage 3: [`task_m100_119_stage3.md`](../working/task_m100_119_stage3.md) — operator CLI 직렬 재개·plan reconciliation·정보 경계; 52/52 pass.
- Stage 4: [`task_m100_119_stage4.md`](../working/task_m100_119_stage4.md) — migration 6 packaging, 운영 문서, real-workerd smoke와 전체 회귀; 대상 84/84, 전체 857 pass.

최종 통합 검증 결과:

- maintenance·artifact 대상 Node 테스트: 84 tests, 84 pass, 0 fail.
- `npm run build:sites-fullstack`: Worker·client production artifact 생성 성공.
- `npm run verify:sites-fullstack`: hosted mode, client 12, Worker 2, migration 6 확인.
- `npm run verify:sites-production`: artifact 5,408,542 bytes, binding 3, migration 6 확인.
- `npm run smoke:sites-fullstack:local`: route 67개, canonical update 2회, migration 1..6과 account deletion completed 확인.
- `npm run scan:public-release`: `ok: true`, blocker 0.
- `npm test`: 863건 중 857 pass, 0 fail, 환경 의존 6 skip.
- `git diff --check origin/devel...HEAD`: 경고 없음.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 Stage5 migration 6 적용, remote deployment와 테스트 owner 삭제 재개는 Task #119 범위 밖이다. merge·release·배포 뒤 Task #108 Gate E에서 별도 승인과 검증이 필요하다.
- active deletion operation이 있는 상태에서 migration 6을 모르는 application version으로 rollback하면 안 된다. maintenance를 닫고 같은 operation을 완료하거나 승인된 복구 절차를 따라야 한다.
- R2와 D1은 하나의 transaction으로 묶이지 않는다. 구현은 매 batch 실제 manifest 재계획과 D1 최종 삭제 제한으로 이 경계를 보완하지만 provider 장애·장기 quota 위험은 운영 관찰 대상이다.
- Postgres/S3 환경 의존 테스트 6건은 credential이 없어 skip됐다. canonical Sites D1·native R2 경로는 unit, Miniflare, real-workerd smoke로 검증했다.

### 후속 작업 후보

- PR merge·release·Stage5 배포 뒤 Task #108 Gate E에서 migration 6 readiness와 기존 active/partial owner 상태를 확인한다.
- 새 `delete-account` CLI로 같은 operation을 직렬 재개해 R2 잔여 0, completed progress, D1 owner 제거를 검증한다.
- live 삭제 전후 backup·readiness·public/private route와 provider log를 기존 runbook에 따라 기록한다.

## 작업지시자 승인

- 작업지시자가 Stage 4 결과를 승인하고 최종 보고서 작성, 오늘할일 완료 처리, `publish/task119` push와 `devel` 대상 Open PR 생성을 지시했다.
