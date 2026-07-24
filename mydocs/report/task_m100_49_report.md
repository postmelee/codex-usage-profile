# Task #49 최종 보고서 — Sites full-stack MVP 적합성 검증 및 production architecture 재결정

GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
마일스톤: M100

## 작업 요약

- 대상 이슈: #49
- 마일스톤: M100
- 단계 수: 6
- 작업 목적: Sites + D1 + native R2가 기존 GitHub OAuth/CLI/profile/card 계약을 유지하면서 현재 계정에서 증분 비용 0원의 개인 MVP canonical target이 될 수 있는지 local·hosted로 검증
- 최종 판정: **PASS**

PASS는 현재 Stage 5 test deployment를 production으로 전환한다는 의미가 아니다. Sites + D1 + native R2를 M100 canonical **target**으로 채택하고, 별도 migration/cutover task가 production OAuth/domain/data/access/backup/monitoring을 완료할 때까지 owner-only test와 현재 source topology를 유지한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `.openai/hosting.json` | actual Sites project linkage와 logical `DB`/`PROFILE_MEDIA` binding | Sites version/package 연결 |
| `db/schema.ts`, `db/migrations/` | D1 structured schema와 rate-limit migration | canonical durable state |
| `src/profile-backend/atomic-operations.js`, `d1/` | provider-neutral named operation과 D1 store/rate limiter | OAuth/CLI/usage/visibility 원자성 |
| `src/profile-media/r2-binding/` | native R2 revision/stable/tombstone adapter | public card publication |
| `src/profile-media/publication-service.js` | D1 CAS와 R2 conditional compensation | publish/unpublish failure·경쟁 |
| `src/profile-card/worker-renderer*.js`, bundled font | Worker-compatible 결정적 PNG renderer | Sites private/public card |
| `src/profile-runtime/sites/` | D1/R2/GitHub/renderer composition과 Worker route | Sites full-stack runtime |
| `vite.sites-fullstack.config.js`, `build/sites-fullstack-vite-plugin.js` | full-stack Sites build/package | hosted artifact |
| `scripts/verify-sites-fullstack-artifact.mjs` | ESM/import/secret/binding/migration 검증 | deployment gate |
| `scripts/smoke-sites-fullstack-local.mjs`와 tests | 실제 CLI를 포함한 local Worker end-to-end | 회귀 검증 |
| `src/profile-runtime/github-oauth-client.js` | GitHub REST required User-Agent | hosted OAuth identity |
| `docs/production-hosting.md` | Sites canonical target, Cloud Run fallback, 비용·risk·migration handoff | 공식 architecture |
| `mydocs/working/task_m100_49_stage1.md`~`stage6.md` | Stage별 local/remote 증적 | 작업 검토 |

기존 Cloud Run Node host, Postgres/Neon adapter, S3-compatible R2 adapter, native renderer와 sample-only Sites build는 삭제하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| production architecture·운영 계약 | `docs/production-hosting.md` | `docs/production-hosting.md` | OK | 수행계획서의 공식 문서 진실 원천과 일치 |
| 단계별 POC·remote 증적 | `mydocs/working/task_m100_49_stage{N}.md` | Stage 1~6 파일 | OK | 계정별 측정과 Gate 결과를 working 문서에 격리 |
| 최종 판정·후속 handoff | `mydocs/report/task_m100_49_report.md` | 동일 | OK | task 장기 보고 위치와 일치 |
| D1 schema/migration | `db/schema.ts`, `db/migrations/` | 동일 | OK | application source의 durable schema |
| Sites linkage | `.openai/hosting.json` | 동일 | OK | project id와 logical binding만 저장 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| Sites 역할 | sample-only marketing mirror | full-stack M100 canonical target |
| Sites API/backend | API/public card 503 POC 이전 | GitHub OAuth, session, CLI, D1/R2와 renderer hosted 통과 |
| structured store | Postgres/Neon canonical, D1 없음 | D1 canonical target + Postgres fallback |
| media contract | v2, S3-compatible copy/delete | v3, native R2 conditional publication/tombstone + S3 fallback |
| hosted renderer | 없음 | JS/Wasm 1497×918 결정적 PNG |
| full-stack Worker | Stage 1 8.23 kB POC | raw 3,823,944 bytes, compressed 2,129,753 bytes |
| 전체 Node test | Stage 1 기준 393개, 387 pass | 436개, 430 pass, 6 skip, 0 fail |
| Playwright E2E | 기존 15개 | 15/15 pass |
| 변경 규모 | 해당 없음 | 97 files, 10,875 insertions, 967 deletions |
| 최종 Site 상태 | 없음 | owner-only, profile private, public profile/card 404 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 현재 account 조건의 증분 비용 0원 | OK — 별도 결제·plan upgrade 없이 Site/D1/R2 hosted smoke 완료. 현재 계정/현재 beta 관찰로 한정 |
| GitHub OAuth/session/logout | OK — 실제 public URL에서 code exchange, owner identity, secure session, logout |
| packed CLI device login/submit | OK — approve/exchange, Contract v1 submit, token revoke |
| D1 다섯 named operation/shared rate limit | OK — real-workerd concurrency/failure test와 hosted duplicate submit/exchange |
| native R2 public/private/ETag/publication | OK — hosted GET/HEAD/304/404, publish/unpublish/concurrency |
| Worker renderer 기능·시각·한도 | OK — 결정성, `en`/`ko`, avatar fallback, hosted PNG와 artifact size |
| secret/private usage 비노출 | OK — client/response/header와 제한 log scan |
| beta exhaustion stop/fallback | OK — owner-only/maintenance와 Cloud Run fallback trigger를 공식 문서화 |
| remote provider fault injection | 승인된 위험 수용 — local failure/concurrency suite와 hosted 정상·경쟁을 근거로 remote seam 미추가 |

### 단계별 검증 결과

- Stage 1: [`task_m100_49_stage1.md`](../working/task_m100_49_stage1.md) — 별도 full-stack Worker build, fail-closed seam과 hosted import 경계
- Stage 2: [`task_m100_49_stage2.md`](../working/task_m100_49_stage2.md) — D1 schema/store/rate limit과 named atomic operation
- Stage 3: [`task_m100_49_stage3.md`](../working/task_m100_49_stage3.md) — native R2 contract v3, tombstone과 publication compensation
- Stage 4: [`task_m100_49_stage4.md`](../working/task_m100_49_stage4.md) — Worker renderer와 local browser/CLI full-stack, 시각 승인
- Stage 5: [`task_m100_49_stage5.md`](../working/task_m100_49_stage5.md) — actual Sites/D1/R2/GitHub OAuth/CLI/public route와 원복
- Stage 6: [`task_m100_49_stage6.md`](../working/task_m100_49_stage6.md) — PASS decision matrix, 공식 architecture와 migration handoff

최종 통합 검증:

- `npm test`: 430 pass, 6 env-gated skip, 0 fail
- `npm run test:e2e`: 15/15
- `npm run build`, `build:cloud-run`, `build:sites`, `build:sites-fullstack`: 모두 통과
- `npm run verify:sites-fullstack`: hosted linkage/migration/import/secret 검사 통과
- `npm run smoke:hosting-matrix`: current Cloud Run/product와 sample-only Sites fallback 회귀 통과
- `git diff --check`: 경고 없음

## 잔여 위험과 후속 작업

### 잔여 위험

- Sites beta의 account별 numeric quota와 장기 가격은 보장되지 않는다. 비용 0원 판정은 현재 계정/현재 시점 관찰이다.
- managed remote R2 provider failure를 직접 주입하지 않았다. 작업지시자가 local failure/concurrency + hosted 정상·경쟁 근거로 위험 수용을 승인했다.
- Stage 5 test D1/R2에는 승인된 owner 집계 usage와 immutable media가 owner-only/private 상태로 남아 있다.
- production OAuth app/custom domain, D1/R2 backup/restore, retention/account deletion, monitoring/alerting과 abuse 운영 값은 미구현이다.
- source의 canonical entry 정리와 actual production cutover는 아직 수행하지 않았다.

### 후속 작업 후보

- Sites MVP migration/cutover issue 신규 등록
  - canonical build 정리와 CLI 기본 origin
  - production OAuth app/custom domain/public access
  - Stage 5 test data 재사용·분리·cleanup
  - D1/R2 export, backup/restore, retention/account deletion
  - log/metric/alert, abuse와 비용·quota stop runbook
- #43을 Cloud Run fallback deployment 범위로 유지·재정의
- #46의 marketing-only publication을 canonical migration과 중복되지 않게 유지·대체·close

이번 task에서는 #43/#46을 수정·close하지 않았고 Site/D1/R2/test OAuth app을 삭제하거나 production 공개로 전환하지 않았다.

## 작업지시자 승인 요청

- 최종 PASS 판정, 공식 architecture 문서와 후속 migration 범위를 승인하면 `publish/task49` branch와 `devel` 대상 Open PR을 게시한다.
- PR merge 또는 별도 승인 전에는 production 공개 전환, remote resource 삭제와 #43/#46 상태 변경을 수행하지 않는다.
