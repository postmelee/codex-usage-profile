# Task #51 Stage 3 보고서 — production 운영 guardrail과 local candidate

GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)
구현계획서: [`task_m100_51_impl.md`](../plans/task_m100_51_impl.md)
Stage: 3

## 단계 목적

Sites production cutover 전에 request 관찰 범위를 privacy-safe schema로 고정하고,
D1 shared rate limit과 maintenance/owner-only/quota/provider stop 의미를
실행 가능한 코드와 test로 만든다. 같은 candidate에서 production artifact와
anonymous landing, OAuth/session/CSRF, CLI, D1/R2, preview, publication,
maintenance disabled/enabled를 검증하고 운영·fallback runbook을 공식 문서에
기록한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/sites/observability.js` | 7개 allowlist field, route class, duration bucket, retryability와 correlation response header를 구현한다. |
| `src/profile-runtime/sites/config.js` | bounded D1 rate-limit, service mode와 stop Retry-After를 읽고 invalid 조합을 승인된 기본값/maintenance로 fail closed한다. |
| `src/profile-runtime/sites/backend.js` | maintenance 503, owner-only public 404, quota 429와 provider 503 응답을 고정한다. |
| `src/profile-runtime/sites/worker.js` | observability wrapper, generic `/healthz`, operational stop을 backend/assets 앞에 연결한다. |
| `src/profile-backend/d1/rate-limiter.js` | direct override도 count/window maximum을 넘지 못하게 한다. |
| `src/profile-runtime/sites/__tests__/observability.test.js` | query/cookie/Authorization/exception/private payload 비노출과 exact event schema를 검증한다. |
| `src/profile-runtime/sites/__tests__/{config,backend,worker}.test.js` | bounded config, 404/429/503/Retry-After, health와 stop 우선순위를 검증한다. |
| `src/profile-backend/__tests__/d1-rate-limiter.test.js` | unbounded direct override 거부를 검증한다. |
| `scripts/verify-sites-production-artifact.mjs` | hosted linkage, static/server/migration/binding, credential/local path/fallback import와 12MB artifact ceiling을 검사한다. |
| `scripts/verify-sites-fullstack-artifact.mjs` | 공용 artifact file/manifest 검증을 export하고 local harness·fixture·absolute path를 production Worker/client에서 거부한다. |
| `scripts/smoke-sites-production-local.mjs` | production build/verifier와 real local Worker 전체 흐름을 한 검증으로 묶는다. |
| `scripts/smoke-sites-fullstack-local.mjs` | health, anonymous landing, CSRF 거부와 maintenance disabled→enabled를 포함한 35-route smoke로 확장한다. |
| `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js` | 같은 local runtime에서 maintenance mode를 전환하는 test-only seam을 추가한다. |
| `src/profile-runtime/sites/__tests__/full-stack.test.js` | 35-route 전체 smoke 계약으로 갱신한다. |
| `scripts/__tests__/verify-sites-production-artifact.test.js` | hosted shape, linkage, credential/path/import와 size 실패를 검증한다. |
| `scripts/__tests__/smoke-sites-production-local.test.js` | build→verify→runtime 순서와 재사용 경로를 검증한다. |
| `package.json` | `verify:sites-production`, `smoke:sites-production:local` script를 추가한다. |
| `docs/sites-operations.md` | private deploy, environment/OAuth rotation, lifecycle, public 원복, log/quota stop과 Cloud Run fallback runbook을 작성한다. |
| `docs/production-hosting.md` | canonical runtime key, observability, health와 stop 계약을 공식 architecture에 반영한다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 OAuth/session/CLI,
Account Usage Contract v1, private preview, public profile/card와 ETag 계약은
유지했다. public read는 owner-only stop에서도 존재 여부를 숨기는 404이고,
quota/maintenance/provider 실패만 bounded `Retry-After`가 있는 429/503으로
구분된다.

관찰 event는 request id, route class, method, status, duration bucket, error
code와 retryability 외 필드를 만들지 않는다. query, cookie, Authorization,
OAuth code/state, session/token/device code, owner identity, usage/card bytes와
exception 원문을 읽거나 기록하지 않는다. production artifact와 검증 로그에도
fixture credential, private data와 absolute local path를 남기지 않았다.

Stage 3은 local source/build/test/document만 변경했다. remote Site metadata,
environment, OAuth app, saved version/deployment, D1/R2 data와 access policy는
조회하거나 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-runtime/sites/__tests__/observability.test.js
node --test scripts/__tests__/verify-sites-production-artifact.test.js
node --test scripts/__tests__/smoke-sites-production-local.test.js
npm run smoke:sites-production:local
npm test
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
git diff --check
```

추가 검증:

```bash
Sites package helper로 production `dist/` 임시 archive 생성·크기 확인
production artifact의 fixture credential/private key/absolute path scan
client artifact의 server-only environment key/runtime marker scan
```

결과:

- OK — observability 3개, production verifier 5개, production smoke
  orchestrator 2개 대상 test가 모두 통과했다.
- OK — 전체 test 476개 중 470개 통과, 환경 의존 6개 skip, 실패 0개.
- OK — browser E2E 15개 통과.
- OK — production local smoke가 한 runtime의 35개 route에서 health, anonymous
  landing, OAuth/session/CSRF, CLI device flow, D1/R2, private preview,
  publish/unpublish, GET/HEAD/304/404, stable ETag와 maintenance
  disabled/enabled를 검증했다.
- OK — production artifact는 5,399,476 bytes, client file 7개, expected
  binding 3개, migration 2개, Worker JS file 2개였다. Worker raw는
  3,900,764 bytes, gzip은 2,145,311 bytes로 ceiling 이하였다.
- OK — Sites package helper의 임시 candidate archive는 3,073,136 bytes였고
  검증 뒤 삭제했다.
- OK — 기존 app/Cloud Run, marketing Sites, production Sites build와
  Sites/Cloud Run hosting matrix가 모두 통과했다.
- OK — production/client artifact에서 fixture credential, private key,
  absolute local path와 client server-only marker를 찾지 못했다.
- OK — `git diff --check` 통과.

## Gate A 승인 입력

아래 값은 Stage 3 local candidate와 Task #49 종료 snapshot을 결합한 입력이다.
remote mutable 상태와 최종 Stage 3 commit SHA는 remote mutation 직전 read-only
snapshot에서 다시 일치시킨다. 불일치하면 mutation을 시작하지 않고 새 입력표를
제시한다.

| 항목 | Gate A 입력 |
|---|---|
| Site project | `.openai/hosting.json`의 기존 `appgprj_6a62f58721788191a7cd82f37320f244`; 새 Site 생성 금지 |
| production origin/slug | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` / `codex-usage-profile-stage5` 유지 |
| title/access | 현재 `Codex Usage Profile — Stage 5 Test`, custom owner-only(owner 1, user/group allowlist 0); 목표 title `Codex Usage Profile`, 같은 owner-only policy 유지 |
| current remote baseline | saved version 2, deployment `appgdep_6a630f37aa3c8191b713f54614674d41`, access revision 5, environment revision 2 — Stage 4 시작 시 read-only 재확인 |
| production OAuth app | 이름 `Codex Usage Profile`, homepage 위 origin, callback `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/api/auth/github/callback`; production 전용 client id/secret은 repository 밖에서 생성·보관 |
| environment keys | `GITHUB_CLIENT_ID`, secret `GITHUB_CLIENT_SECRET`, secret `PROFILE_MAINTENANCE_TOKEN`, `PROFILE_MAINTENANCE_MODE`, `PROFILE_SERVICE_MODE`, `PROFILE_STOP_RETRY_AFTER_SECONDS`, 4개 `PROFILE_ACCOUNT_USAGE_*` |
| 승인 운영값 | initial/final maintenance `disabled`, lifecycle window만 `enabled`; service `normal`; stop retry 300; burst 5/10000ms, sustained 30/60000ms |
| candidate | 이 Stage 3 묶음 commit과 그 source의 `dist/`; verifier 기준 artifact 5,399,476 bytes, package helper archive 3,073,136 bytes. exact commit SHA는 commit 직후 승인 요청에 제시 |
| export/restore | repository 밖 사용자 지정 0600 backup, contract/schema version·digest·count만 보고; apply 전 disposable restore/repair와 동일 manifest 재확인 |
| cleanup 대상 | Task #49 Stage 5 test owner `postmelee` 1명과 그 owner-dependent usage/snapshot/device/publication/revision; auth/session/token/rate row는 backup 제외. exact owner id, object count와 digest는 새 maintenance route의 plan/export 뒤 apply 전에 재확인 |
| 비용/quota | Task #49 관찰은 추가 결제·plan upgrade 0원. Gate A에서 현재 plan, 결제수단/자동 초과 과금 요구, Sites/D1/R2 quota 표시를 다시 확인하며 하나라도 추가 과금을 요구하면 중단 |
| 실패/원복 | 같은 previous saved version과 owner-only access 유지, maintenance disabled, test OAuth/environment key set 원복. data mutation 시작 뒤 일관성을 증명하지 못하면 public으로 진행하지 않고 maintenance 상태에서 backup 복구 |

secret 값, backup path/payload, owner 내부 id와 private usage 값은 이 입력과
보고서에 포함하지 않았다.

## 잔여 위험

- 실제 hosted event 조회·quota 표시는 provider remote에서만 확인할 수 있다.
  Stage 4 owner-only candidate에서 event schema 비노출과 추가 과금 0원 조건을
  다시 검증해야 한다.
- Task #49 snapshot 이후 Site version/access/environment가 바뀌었을 수 있다.
  Stage 4 첫 작업은 exact read-only snapshot이며 위 baseline과 다르면 승인
  범위를 자동 확대하지 않는다.
- D1/R2의 현재 delete plan digest/count는 Stage 3 source가 배포되기 전에는
  계산할 수 없다. Gate A가 승인하는 cleanup target은 Stage 5 test owner
  scope로 한정하며, plan/export 뒤 exact digest/count가 예상 범위를 벗어나면
  apply하지 않고 추가 승인을 받는다.
- Sites beta numeric quota와 장기 가격은 고정 보장이 아니다. 비용 판정은 각
  Gate 시점의 계정 표시와 실제 추가 과금 요구 유무에 한정된다.

## 다음 단계 영향

- Stage 4는 위 Gate A 입력의 remote mutable 항목을 read-only로 재확인한 뒤,
  production OAuth/environment와 같은 Stage 3 commit의 saved version을
  owner-only로 배포한다.
- maintenance window에서 plan/export를 먼저 수행하고 approved Stage 5 test
  scope만 cleanup한다. disposable restore/repair, OAuth/session/logout,
  packed CLI, private preview와 publish/unpublish/ETag를 owner-only 안에서
  검증한 뒤 maintenance를 다시 disabled로 둔다.
- public/shared access 변경은 Stage 4 범위가 아니며 Gate B 승인 전에는
  수행하지 않는다.

## 승인 요청

- Stage 3 산출물, 검증 결과와 위 Gate A 입력을 승인하면 Stage 4
  production OAuth와 owner-only candidate로 진행한다.
