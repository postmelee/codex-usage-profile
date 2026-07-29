# Task #45 최종 보고서 — Sites production 전체 흐름 및 보안 QA

GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
마일스톤: M100

## 작업 요약

- 대상 이슈: #45
- 마일스톤: M100
- 단계 수: 6
- 작업 목적: fresh owner 기준 GitHub OAuth, published CLI device login,
  Account Usage Contract v1 submit, private preview, publish/unpublish,
  rollback·backup/restore와 exact cleanup을 production에서 검증하고 M100
  공개·홍보 가능 여부를 판정한다.

Task #44의 immutable npm `codex-usage-profile@0.1.0`과 Sites production
baseline에서 시작해 disposable owner로 전체 사용자 흐름을 검증했다. 실제
집계는 Account Usage Contract v1 필드만 전송했고 prompt, response, tool
input/output, Codex/OpenAI 인증정보와 local session file은 전송하지 않았다.

production submit의 accepted/exact retry/conflict·stale, origin/CORS/CSRF,
token revoke, private-by-default, public HTML/JSON과 stable R2 card의
GET/HEAD/ETag/304/locale 계약을 확인했다. maintenance fail-close,
export→exact delete→restore와 최종 exact cleanup까지 수행한 뒤 Site를 public,
service normal, maintenance disabled, operator secret absent 상태로 종료했다.

최종 local·registry·provenance·clean consumer·Sites·로그·비용 stop 검증이
모두 release-blocking 수용 기준을 통과했다. Task #45의 M100 공개·홍보 판정은
`PASS`이며 현재 #43 Cloud Run fallback trigger는 충족되지 않았다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `scripts/sites-profile-maintenance.mjs` | 15초 request timeout, atomic `0600` export, exact restore 입력과 민감정보 비노출 보강 | maintenance operator 안전성 |
| `scripts/__tests__/sites-profile-maintenance.test.js` | timeout, export/restore/apply confirmation과 credential 비노출 회귀 추가 | operator CLI 회귀 |
| `docs/sites-operations.md` | final access/environment revision, operator secret 부재, cleanup과 Sites public-beta 비용·limit 경계 반영 | production 운영자 |
| `docs/production-hosting.md` | Task #45 final cleanup, release QA와 후속 운영 상태 반영 | architecture·hosting 운영자 |
| `mydocs/plans/task_m100_45.md` | 범위, 6개 Stage, Gate, 문서 위치와 수용 기준 | task 추적 |
| `mydocs/plans/task_m100_45_impl.md` | exact 실행·검증·fail-close·복구 절차와 승인 결과 | task 실행 증적 |
| `mydocs/working/task_m100_45_stage{1..6}.md` | 단계별 local/registry/production 검증과 종료 상태 | task 추적 |
| `mydocs/orders/20260728.md`, `mydocs/orders/20260729.md` | Task #45 시작·진행·완료 상태 | 당일 작업 보드 |
| `mydocs/report/task_m100_45_report.md` | 전체 수용 결과, 공개 판정과 잔여 위험 | 장기 보고 |

제품 application runtime, D1/R2 schema, package/lockfile, npm registry, Git
tag와 saved Site version 7은 변경하지 않았다. production의 disposable
owner/session/token/D1/R2 state와 maintenance 환경·access는 승인된 Gate에서만
일시 변경했고 final safe state로 복구했다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | repository root, drift 시만 수정 | 무변경 | OK | 사용자 진입 계약 drift 없음 |
| `docs/production-hosting.md` | `docs/` | `docs/` | OK | architecture·보안·retention 진실 원천 |
| `docs/sites-operations.md` | `docs/` | `docs/` | OK | production Sites 운영 runbook |
| `docs/cli-submit.md` | `docs/`, drift 시만 수정 | 무변경 | OK | CLI·Contract v1 계약 drift 없음 |
| `docs/readme-card.md` | `docs/`, drift 시만 수정 | 무변경 | OK | public profile/card 계약 drift 없음 |
| `packages/codex-usage-profile-cli/README.md` | package root, drift 시만 수정 | 무변경 | OK | published package 계약 drift 없음 |
| `mydocs/working/task_m100_45_stage{N}.md` | `mydocs/working/` | `mydocs/working/` | OK | 단계별 task 증적 |
| `mydocs/report/task_m100_45_report.md` | `mydocs/report/` | `mydocs/report/` | OK | task 최종 장기 보고 |

공식 제품·사용자·운영 문서는 계획대로 기존 root, package root와 `docs/`의
진실 원천을 유지했다. 실제 production drift가 확인된 두 운영 문서만 최소
수정했고 `mydocs/manual`에는 제품 문서를 추가하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | QA 중 | 변경 후 |
|---|---|---|---|
| Site access | public revision 14 | owner-only/public fail-close 전환 | public revision 26 |
| Site environment | revision 13 | maintenance·operator secret exact 전환 | revision 57, normal/disabled, operator secret 0 |
| saved Site version | 7 | 7만 재배포 | 7 |
| disposable owner/session | 0 | owner 1, browser session 1 | 0 |
| disposable active CLI token/device | 0 | primary token 1, submitted device 1 | 0 |
| latest Contract v1 usage | 0 | latest usage 1과 retry/conflict 검증 | 0 |
| public publication | public JSON/card 404 | HTML/JSON/PNG 200과 ETag/304 검증 후 unpublish | public JSON/card 404 |
| R2 owner publication | 0 | default/en/ko stable·revision object 검증 | 0 |
| npm public release | `0.1.0` | immutable, 무변경 | `0.1.0`, integrity·provenance 일치 |
| Node consumer matrix | Node 20/22/24 | exact와 `@latest` 모두 검증 | 6/6 consumer 조합 통과 |
| 전체 Node 회귀 | 488 tests 기준 | 단계별 focused 회귀 | 482 pass·6 skip·0 fail |
| Playwright E2E | 16 tests | 단계별 browser 시나리오 | 16/16 pass |
| public surface scan | blocker 0 | 승인 review 12 유지 | 1,350 blobs, blocker 0 |
| task source diff | 해당 없음 | 해당 없음 | 최종 보고 전 14 files, 3,425 insertions·41 deletions |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| immutable npm release | OK — public `0.1.0`, `latest=0.1.0`, 13 files와 Stage 1 SHA-1/SHA-512 불변 |
| provenance와 clean consumer | OK — recovery provenance success, exact/`@latest`가 Node 20/22/24에서 실행 |
| fresh OAuth와 device login | OK — fresh product session, GitHub OAuth, one-token device exchange와 narrow submit token |
| private-by-default | OK — owner private/unpublished, authenticated preview 가능, anonymous JSON/card 404 |
| Contract v1 privacy | OK — 승인된 aggregate field만 전송, prompt/response/tool/auth/session file 비전송 |
| submit idempotency | OK — accepted 201, exact retry 200·revision 불변, conflict/stale 409 |
| token·origin 경계 | OK — secondary token revoke 후 410, cross-origin/CSRF/CORS와 invalid body fail-closed |
| public profile/card | OK — HTML/JSON/PNG, stable URL, GET/HEAD/ETag/304/locale와 revision 갱신 |
| unpublish | OK — owner는 private, public JSON/card 전체 404 |
| rollback·backup/restore | OK — maintenance fail-close, atomic `0600` export, exact delete와 restore |
| exact final cleanup | OK — owner plan `not_found`, retention candidate 0, owner/session/token/D1/R2/local artifact 제거 |
| production safe state | OK — active/public revision 26, version 7, environment 57, normal/disabled, operator secret absent |
| anonymous HTTP 경계 | OK — landing/health 200, auth 401, disposable JSON/card/operator 404를 3회 확인 |
| production 로그 | OK — 예상 401/404 32건, 5xx/error/Worker failure 0 |
| 비용 stop | OK — active, disabled reason 없음, upgrade/payment/automatic overage trigger 미관찰 |
| 전체 회귀 | OK — unit, E2E, 모든 build/verifier/smoke와 `git diff --check` 통과 |
| M100 공개·홍보 | PASS — 현재 release blocker와 #43 fallback trigger 없음 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_45_stage1.md): immutable npm release,
  provenance, Node consumer와 Sites production baseline을 고정했다.
- [Stage 2](../working/task_m100_45_stage2.md): fresh OAuth, browser session,
  published CLI device login과 private-by-default 흐름을 검증했다.
- [Stage 3](../working/task_m100_45_stage3.md): submit idempotency,
  token revoke, origin/CORS/CSRF와 invalid body 경계를 검증했다.
- [Stage 4](../working/task_m100_45_stage4.md): public HTML/JSON, stable R2
  card/cache와 unpublish safe state를 검증했다.
- [Stage 5](../working/task_m100_45_stage5.md): maintenance rollback,
  export/delete/restore와 owner/session/token/D1/R2 exact cleanup을 완료했다.
- [Stage 6](../working/task_m100_45_stage6.md): 전체 release QA와 final safe
  state를 재확인하고 M100 공개·홍보를 `PASS`로 판정했다.

최종 통합 검증:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
npm run verify:npm-release
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

- OK — Node 488개 중 482 pass, 환경 의존 integration 6 skip, fail 0.
- OK — Playwright 16/16.
- OK — 기본, Cloud Run, Sites와 full-stack production build.
- OK — production artifact 5,400,662 bytes, client 7 files, binding 3개,
  migration 2개. Worker raw 3,901,236 bytes, gzip 2,145,397 bytes.
- OK — hosting matrix, local npm candidate 13 entries와 isolated smoke 5개.
- OK — registry signature/attestation invalid 0, missing 0. provenance
  [run 30352705791](https://github.com/postmelee/codex-usage-profile/actions/runs/30352705791)의
  Node 20/22/24와 publish job success.
- OK — 전체 `npm audit`은 low 1/high 7, production dependency audit은 0.
- OK — public release scan 1,350 blobs, blocker 0, 기존 승인 review 12.
- OK — `git diff --check` 통과.

## 외부 변경과 종료 상태

- npm: public `codex-usage-profile@0.1.0`, `latest=0.1.0`, immutable
- provenance: recovery SHA
  `f10ad2cb1a38568371c5467dc3a25ce29df7ae8f`, run `30352705791` success
- production Site: active/public revision 26, saved version 7
- environment: revision 57, service normal, maintenance disabled
- maintenance operator secret: absent
- logical binding: D1 `DB`, R2 `PROFILE_MEDIA`, migration 2개
- disposable owner/session/token/device/usage/D1/R2/backup/local credential:
  exact cleanup 완료
- final anonymous route: landing/health 200, auth 401, disposable
  JSON/card/operator 404
- #43 fallback: trigger 대기 open 상태, 무변경

## 잔여 위험과 후속 작업

### 잔여 위험

- managed production에서 D1/R2 provider fault를 의도적으로 주입하지 않았다.
  local real-workerd/native-R2 failure·concurrency 회귀와 production
  observability/repair 절차로 보완한다.
- fresh QA는 동일 maintainer GitHub identity의 기존 product state를 exact
  삭제해 재생성한 조건이다. 독립적인 제3자 owner의 환경·행동 차이는 남는다.
- Sites는 public beta다. eligible ChatGPT plan 포함과 plan별 limit은 현재
  조건이며 장기 가격, 고정 quota와 정책 불변을 보장하지 않는다.
- 전체 dev/build 도구 audit low 1/high 7이 남아 있다. production
  dependency audit은 0이며 deployed runtime/CLI에 포함되지 않아 release
  blocker로 판정하지 않았다.
- public npm `0.1.0`은 immutable이다. 향후 기능·보안 blocker가 발견되면
  같은 version 재게시가 아니라 patch release가 필요하다.

### 후속 작업 후보

- 월간 retention dry-run으로 unexpected candidate와 owner orphan을 확인한다.
- Sites의 plan limit, pricing·policy와 장애 상태를 계속 관찰하고 실제 비용,
  quota, 정책 또는 장기 장애 trigger가 생길 때만
  [#43](https://github.com/postmelee/codex-usage-profile/issues/43)의 Cloud
  Run fallback을 별도 승인한다.
- dev/build dependency hardening과 독립 제3자 UX 검증이 필요하면 각각 별도
  이슈·계획으로 진행한다.

## 작업지시자 승인 요청

- 6개 Stage, production 전체 흐름·보안·exact cleanup, M100 `PASS` 판정과
  final safe state를 검토하고 Task #45 PR의 merge 여부를 승인해 달라.
