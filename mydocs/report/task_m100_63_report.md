# Task M100 #63 최종 보고서

GitHub Issue: [#63](https://github.com/postmelee/codex-usage-profile/issues/63)
마일스톤: M100

## 작업 요약

- 대상 이슈: #63
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: Sites public 전환 전에 owner-only candidate의 D1 schema
  readiness를 fail-closed로 확인하고 migration·artifact·canonical origin
  drift를 자동 검증한다.

지원되지 않는 saved-version 이전 원격 D1 query를 도입하지 않았다. 대신
exact commit build와 owner-only candidate 배포 뒤 기존 hidden maintenance
경계의 read-only readiness가 exact match일 때만 기능 smoke와 별도 승인된
public 전환으로 진행하는 운영 계약을 확정했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-backend/d1/migration-manifest.js` | version/name/file pure manifest와 invariant 추가 | Node loader, D1 store, Worker harness가 공유하는 migration metadata |
| `src/profile-backend/d1/{migrate,store,index}.js` | manifest 파생 loader와 exact read-only inspector, 기존 readiness 호환 경계 정렬 | D1 migration 실행과 dependency readiness |
| `src/profile-runtime/sites/maintenance.js` | 인증된 `readiness` operation과 bounded success/error 추가 | hidden operator route; 일반/public route 제외 |
| `scripts/sites-profile-maintenance.mjs` | exact read-only `readiness --origin` CLI 추가 | owner-only candidate 운영 preflight |
| `scripts/smoke-sites-fullstack-local.mjs` | 사용자 흐름보다 먼저 exact readiness 확인 | local production scenario 순서 |
| `scripts/verify-sites-fullstack-artifact.mjs` | packaged SQL을 manifest ordered filenames와 exact 비교 | Sites build/package artifact gate |
| `scripts/__tests__/*.test.js`, `src/**/__tests__/*.test.js` | migration/readiness/artifact/origin의 정상·실패·무변경성 회귀 | root 자동 검증과 real workerd D1 계약 |
| `docs/sites-operations.md` | owner-only → readiness → 기능 smoke → 승인된 public 전환과 원복 조건 명시 | maintainer/operator 공식 절차 |
| `mydocs/plans/task_m100_63*.md` | 승인 범위, 설계 결정, 단계별 구현 계획 기록 | 작업지시자·리뷰어 추적성 |
| `mydocs/working/task_m100_63_stage*.md` | Stage 1~4 산출물·검증·잔여 위험 기록 | 단계 승인 증적 |
| `mydocs/orders/20260731.md`, `mydocs/orders/20260801.md` | Task #63 진행·완료 상태 기록 | 일일 작업 보드 |

`.openai/hosting.json`, `db/migrations/*.sql`, CLI/UI의 실제 production origin
값, OAuth callback, Sites saved version/access/environment와 D1/R2 데이터는
변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/sites-operations.md` | `docs/` | `docs/sites-operations.md` | OK | 기존 canonical Sites 운영 문서에만 candidate/readiness 순서 보강 |
| `task_m100_63.md`, `_impl.md` | `mydocs/plans/` | `mydocs/plans/` | OK | 승인 범위와 구현 계획 위치 일치 |
| `task_m100_63_stage{1..4}.md` | `mydocs/working/` | `mydocs/working/` | OK | 각 단계 증적 위치 일치 |
| `task_m100_63_report.md` | `mydocs/report/` | `mydocs/report/` | OK | 중앙 최종 보고서 정책 일치 |
| architecture/API/roadmap 문서 | 변경하지 않음 | 해당 없음 | OK | 공개 API·아키텍처·로드맵 변경 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| application migration metadata 진실 원천 | loader/store/harness의 개별 literal | pure manifest 1개에서 Node/Worker/full-stack verifier 파생 |
| public 전환 전 schema gate | 기능 smoke 전 exact schema gate 없음 | owner-only protected readiness `[1, 2, 3]` exact match 필수 |
| readiness success payload | 해당 operation 없음 | `operation`, `ready`, `expectedVersions`, `appliedVersions` 4필드만 허용 |
| full-stack packaged SQL 검증 | migration count `3` | manifest filename의 missing/unexpected/duplicate/order drift 구분 거부 |
| CLI/UI origin drift 검증 | 상수별 독립 테스트 | 두 source 직접 import equality + canonical HTTPS origin 계약 |
| local production smoke | readiness 이전 사용자 흐름 | readiness 선행 포함 36 route, public PNG 84,925 bytes |
| 최종 root 자동 테스트 | Task 시작 시 기준 | 535건 중 529건 통과, 실패 0건, 외부 설정 부재 6건 skip |
| 최종 보고서 작성 전 task diff | 해당 없음 | 27 files, +2,028/-89 lines |

production artifact의 migration allowlist는 application manifest에서 파생하지
않고 독립 3-file security review gate로 유지했다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| expected migration version/name/file의 pure manifest 파생 | OK — invariant, Node loader와 Worker harness 검증 통과 |
| real workerd D1 migration 순서·idempotency와 store 호환 | OK — `[1, 2, 3]` 적용, 재실행 no-op, missing 거부·higher version 허용 |
| protected readiness의 exact match와 read-only 최소 payload | OK — 성공 4필드, mismatch 503, provider detail 비노출, D1/R2 mutation 0건 |
| packaged migration drift fail-close | OK — missing/extra/name/duplicate/order 회귀 통과 |
| production exact allowlist 독립성 | OK — manifest import 없음과 unreviewed future SQL 거부 확인 |
| CLI/UI canonical production origin 동기화 | OK — exact equality와 canonical HTTPS origin 회귀 통과 |
| public health/API metadata 비노출 | OK — root route/observability/maintenance 회귀 통과 |
| standard/production build와 artifact | OK — hosted `DB`/`PROFILE_MEDIA`, migration 3개, artifact 5,496,371 bytes |
| local production end-to-end | OK — real CLI/D1/R2/renderer/publication 포함 36 route 통과 |
| 보호 파일과 외부 상태 무변경 | OK — hosting/migration/origin source diff 빈 출력; 원격 mutation 미수행 |
| 전체 root 회귀 | OK — 535건 중 529 pass, 0 fail, 6 skip |

최종 실행 명령:

```bash
npm test
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-production:local
git diff --check
git diff origin/devel -- \
  .openai/hosting.json \
  db/migrations \
  packages/codex-usage-profile-cli/src/config.js \
  src/profile-ui/deviceApproval.js
```

### 단계별 검증 결과

- [Stage 1](../working/task_m100_63_stage1.md): pure manifest, exact inspector,
  real workerd migration/store 계약 통과
- [Stage 2](../working/task_m100_63_stage2.md): hidden readiness service/CLI와
  owner-only 운영 순서, local production smoke 통과
- [Stage 3](../working/task_m100_63_stage3.md): artifact migration drift와
  canonical origin 계약, production build/verifier 통과
- [Stage 4](../working/task_m100_63_stage4.md): root 전체 회귀, build,
  artifact와 local production 36-route smoke 통과

## 잔여 위험과 후속 작업

### 잔여 위험

- `TEST_DATABASE_URL` 부재로 PostgreSQL seed/concurrency/migration/adapter/media
  integration 5건을 실행하지 않았다.
- `TEST_S3_ENDPOINT`와 test bucket/access key 부재로 실제 S3 endpoint
  adapter contract 1건을 실행하지 않았다.
- 실제 owner-only Sites candidate와 원격 D1에서 readiness를 실행하지 않았다.
  Task #63의 승인 범위는 local source/test/docs이며 remote
  save/deploy/access/environment와 D1/R2 mutation을 제외한다.
- Sites public beta의 lifecycle과 interface가 바뀌면 실제 배포 task에서
  공식 capability를 다시 확인해야 한다.

### 후속 작업 후보

- Task #63 merge 이후 실제 배포가 필요할 때 별도 승인 Gate에서 exact
  commit의 owner-only candidate → protected readiness → 기능 smoke → public
  승인 순서를 수행한다.
- CI 또는 별도 통합 환경에 PostgreSQL/S3 secret이 제공되면 skip된 6건을
  실행해 external adapter 증적을 추가한다.
- Sites가 공식 pre-deploy D1 query/apply interface를 제공하면 readiness gate
  위치를 saved-version 이전으로 앞당기는 별도 issue를 검토한다.

## 작업지시자 승인 요청

- Stage 4 완료 후 작업지시자가 최종 보고서와 PR 게시 진행을 승인했다.
  이 보고서와 최종 수용 검증 결과를 근거로 `publish/task63`을 `devel`
  대상으로 게시한다.
