# Task #51 최종 보고서 — Sites MVP production migration 및 공개 cutover

GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)
마일스톤: M100

## 작업 요약

- 대상 이슈: #51
- 마일스톤: M100
- 단계 수: 6
- 작업 목적: Task #49에서 채택한 Sites + D1 + native R2 구성을 추가 과금 요구 없이 실제 MVP canonical production으로 전환하고, 기존 OAuth·CLI·private/public card 계약과 Cloud Run fallback을 보존
- 최종 판정: **PASS**

기존 owner-only 검증 Site를 재사용해 production OAuth, D1/R2 lifecycle,
privacy-safe observability와 비용 stop 절차를 먼저 완성했다. Gate A의 owner-only
candidate, Gate B의 일시적 public smoke와 원복, Gate C의 최종 public cutover를
각각 승인받아 진행했다. 최종 Site는 public이며 test owner, browser session,
CLI token/credential과 public publication은 정리된 상태다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `build/sites-fullstack-vite-plugin.js`, `vite.sites-fullstack.config.js`, `package.json` | canonical production artifact를 `dist/`로 정규화하고 별도 build/verify/smoke command 추가 | Sites 배포 package와 Cloud Run fallback 회귀 |
| `packages/codex-usage-profile-cli/` | production 기본 origin, override/stored-origin 우선순위와 packed candidate test·문서 정렬 | CLI device login과 Account Usage Contract v1 submit |
| `src/profile-backend/maintenance-contract.js`, `src/profile-backend/d1/maintenance.js` | versioned durable export/restore, retention과 exact owner deletion | D1 lifecycle과 destructive guard |
| `src/profile-media/maintenance-contract.js`, `src/profile-media/r2-binding/maintenance.js` | R2 manifest, tombstone, retention과 conditional publication repair | stable/revision object lifecycle |
| `src/profile-runtime/sites/maintenance.js`, `scripts/sites-profile-maintenance.mjs` | 기본 차단된 maintenance route와 dry-run 우선 operator 도구 | production backup·cleanup·repair 운영 |
| `src/profile-runtime/sites/observability.js`, Sites config/backend/worker | allowlist log, health, rate limit과 maintenance/owner-only/quota/provider stop | 공개 runtime 보안·관찰·중단 |
| `src/profile-ui/` route와 관련 test | Sites 호환 Settings, device approval, public profile root-query route | hosted SPA 사용자 흐름 |
| `scripts/verify-sites-production-artifact.mjs`, production/local smoke와 tests | binding·migration·secret/path/import·artifact size 검증 | 배포 전 품질 gate |
| `README.md`, `docs/*.md`, package README | 실제 production URL, 운영 runbook, CLI와 card URL, fallback 계약 확정 | 사용자·기여자·운영자 공식 문서 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | 계획, Stage 1~6 증적과 최종 결과 보존 | Hyper-Waterfall 작업 추적 |
| GitHub #43~#46, M100 metadata | Sites 기준 release 순서와 fallback 조건 정렬, 중복 #46 종료 | 후속 roadmap |
| 기존 Sites project | production OAuth/env, saved version 7, public access revision 14 | 실제 MVP production |

기존 Cloud Run Node host, Postgres/Neon adapter, S3-compatible R2 adapter와
관련 build/test는 삭제하지 않았다. npm registry publish도 수행하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | `README.md` | OK | 공개 진입점과 production Quickstart를 루트에 유지 |
| production architecture·운영 계약 | `docs/production-hosting.md` | 동일 | OK | 기존 공식 architecture 진실 원천 갱신 |
| Sites 운영 runbook | `docs/sites-operations.md` | 동일 | OK | 반복 가능한 backup/retention/rollback 절차를 공식 문서에 배치 |
| CLI 사용자 문서 | `docs/cli-submit.md` | 동일 | OK | production origin과 override 계약을 기존 위치에서 유지 |
| card 사용자 문서 | `docs/readme-card.md` | 동일 | OK | canonical HTML과 stable PNG URL을 기존 위치에서 유지 |
| package 사용자 문서 | `packages/codex-usage-profile-cli/README.md` | 동일 | OK | #44가 게시할 artifact에 사용자 안내 포함 |
| 단계별 증적 | `mydocs/working/task_m100_51_stage{N}.md` | Stage 1~6 파일 | OK | credential·backup payload 없이 Gate 결과 보존 |
| 최종 보고 | `mydocs/report/task_m100_51_report.md` | 동일 | OK | cutover 결과와 잔여 위험을 task 단위로 보존 |

수행계획서의 문서 위치 판단과 실제 산출물 위치가 모두 일치한다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| canonical Site 상태 | saved version 2, owner-only, test title | saved version 7, title `Codex Usage Profile`, public access revision 14 |
| Sites environment | revision 2의 test candidate | revision 9, service normal·maintenance disabled |
| CLI 기본 service origin | 없음 | 실제 canonical `chatgpt.site` origin |
| D1/R2 운영 lifecycle | production export/restore/retention/account deletion 도구 없음 | versioned manifest와 digest/count/owner/`--apply` guard가 있는 dry-run 우선 도구 |
| 전체 Node test | Task #49 종료 기준 436개 | 477 total, 471 pass, 6 env-gated skip, 0 fail |
| Playwright E2E | 15개 | 16/16 pass |
| production artifact | migration/cutover용 verifier 없음 | 5,400,732 bytes, client 7, migration 2, worker 2, expected binding 3 |
| CLI package | production 기본 origin 없음 | 13 files, package 14.2 kB |
| 최종 disposable owner data | Task #49 검증 owner data 잔존 | owner 0, 연관 object 0, public profile/card 404 |
| 추가 과금 요구 | 미확인 | Gate A~C 중 plan upgrade·결제수단·자동 초과 과금 요구 0회 관찰 |

비용 결과는 현재 계정과 현재 Sites beta에서 작업 중 관찰한 값이며 향후
가격·quota 보장은 아니다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 추가 결제 없이 MVP public cutover | OK — 기존 Site/D1/R2를 재사용했고 Gate A~C에서 과금·upgrade 요구가 없었음 |
| production OAuth와 browser session | OK — 실제 public origin callback, secure session, identity load와 logout 통과 |
| clean packed CLI와 Contract v1 submit | OK — device approve/exchange/submit/revoke 및 local credential 제거 통과 |
| private-by-default와 공개 범위 | OK — submit 직후 private 404, publish 뒤 profile/card 200, unpublish 뒤 404 |
| stable card cache 계약 | OK — GET/HEAD 200, quoted ETag, matching `If-None-Match` 304 |
| D1/R2 lifecycle과 destructive guard | OK — export/restore/repair/retention/delete dry-run과 exact digest/count guard 검증 |
| secret/private-data 비노출 | OK — client artifact, public response/header와 recent log에서 credential·집계 값 비노출 |
| abuse·비용·provider stop | OK — bounded rate limit, generic 404/429/503와 owner-only/maintenance runbook 검증 |
| final cleanup | OK — final smoke owner와 연관 object 정리, session/token/credential revoke, publication 404 |
| Cloud Run fallback 보존 | OK — Cloud Run build와 hosting matrix 회귀 통과 |
| 원격 provider failure 주입 | 승인된 위험 수용 — local failure/concurrency suite와 hosted 정상·경쟁 검증으로 대체 |

### 단계별 검증 결과

- Stage 1: [`task_m100_51_stage1.md`](../working/task_m100_51_stage1.md) — canonical Sites build와 CLI production origin
- Stage 2: [`task_m100_51_stage2.md`](../working/task_m100_51_stage2.md) — D1/R2 lifecycle, retention과 안전한 account deletion
- Stage 3: [`task_m100_51_stage3.md`](../working/task_m100_51_stage3.md) — privacy-safe observability, stop guard와 전체 local candidate
- Stage 4: [`task_m100_51_stage4.md`](../working/task_m100_51_stage4.md) — production OAuth와 owner-only candidate
- Stage 5: [`task_m100_51_stage5.md`](../working/task_m100_51_stage5.md) — public smoke, hosted route 보완과 owner-only 원복
- Stage 6: [`task_m100_51_stage6.md`](../working/task_m100_51_stage6.md) — 최종 public cutover, cleanup, 공식 문서와 roadmap 정렬

최종 통합 검증:

- `npm test`: 477 total, 471 pass, 6 env-gated skip, 0 fail
- `npm run test:e2e`: 16/16
- `npm run build`, `build:cloud-run`, `build:sites`, `build:production`: 모두 통과
- `npm run verify:sites-fullstack`: client 7, migration 2, worker 2
- `npm run verify:sites-production`: 5,400,732 bytes, expected binding 3
- `npm run smoke:hosting-matrix`: Cloud Run canonical과 Sites mirror 분리 회귀 통과
- `npm pack --dry-run --workspace packages/codex-usage-profile-cli`: 13 files, 14.2 kB
- `git diff --check`: 경고 없음

## 잔여 위험과 후속 작업

### 잔여 위험

- Sites beta의 가격·quota·정책은 바뀔 수 있다. 추가 비용이나 contract
  blocker가 나타나면 quota stop, owner-only, maintenance 순서로 닫고 #43
  fallback을 별도 승인한다.
- 기존 URL slug의 `stage5`는 검증된 project/D1/R2/version history를 보존하기
  위해 수용한 opaque 식별자다.
- Sites 앞단은 extension 없는 `/u/{handle}` HTML deep link를 `/`로 보낸다.
  canonical HTML은 `/?profile={handle}`, stable image는
  `/u/{handle}/card.png`다.
- owner에 귀속되지 않은 만료 device challenge 2건은 profile, usage, token이
  없고 아직 90일 cleanup 후보가 아니다. threshold 도달 뒤 월별 dry-run과
  별도 apply 승인을 거친다.
- repository 밖 원본 durable backup은 2026-08-26과 #45 완료 중 더 늦은
  시점까지 mode `0600`으로 보존한다. 두 조건 뒤 별도 영구 삭제 승인이
  필요하다.
- npm package는 아직 공개되지 않았다. #44 전에는 source checkout 또는
  검토된 local tarball만 사용자 설치 경로다.
- self-service account deletion UI는 없으며 현재 exact guarded operator
  절차를 사용한다.
- managed provider 장애를 원격에서 직접 주입하지 않았다. Task #49에서
  수용한 local failure/concurrency + hosted 정상·경쟁 검증 근거를 유지한다.

### 후속 작업 후보

- #44 — Sites production origin을 기본으로 하는 npm package publish
- #45 — #51·#44 이후 Sites production 전체 흐름과 보안 QA
- #43 — 실제 가격·quota·정책·장애 trigger가 발생할 때만 Cloud Run fallback
- #46 — canonical full-stack Site와 중복되어 `not planned`로 종료됨

## 작업지시자 승인 상태

- 작업지시자가 Stage 6 결과 검토 뒤 최종 보고서 작성, 오늘할일 완료 처리,
  `publish/task51` push와 `devel` 대상 PR 게시를 명시적으로 승인했다.
- PR merge와 Issue #51 close는 이 승인에 포함되지 않으며 merge 확인 뒤
  별도 cleanup 절차로 수행한다.
