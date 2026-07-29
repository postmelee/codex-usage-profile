# Task #45 Stage 1 보고서 — immutable release와 production baseline

GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
구현계획서: [`task_m100_45_impl.md`](../plans/task_m100_45_impl.md)
Stage: 1

## 단계 목적

public npm `codex-usage-profile@0.1.0`의 immutable registry artifact,
provenance와 지원 Node 범위가 Task #44 handoff와 일치하는지 독립적으로
재검증한다. canonical Sites production의 saved version, access,
environment key, D1/R2 binding readiness와 익명 공개 경계를 read-only로
확인하고, fresh OAuth와 Account Usage Contract v1 전송에 필요한 Gate A
입력을 exact redacted 값으로 고정한다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_45_stage1.md` | local·registry·Sites baseline, 보안 점검, Gate A 입력과 잔여 위험 기록 |
| `mydocs/orders/20260728.md` | Task #45를 Stage 1 완료·Gate A 승인 대기로 갱신 |
| npm/Sites/GitHub read-only evidence | registry metadata·서명·provenance, saved version/access/environment key와 익명 route 상태 확인 |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, package/lockfile, 공식 사용자 문서, npm registry, Git tag,
GitHub Actions, Site version/deployment/access/environment와 D1/R2 data를
변경하지 않았다. task 전용 worktree에서 dependency 설치와 build artifact만
생성했고, 커밋 대상은 본 단계 보고서와 오늘할일 상태뿐이다.

Sites 조회에서는 environment key name, secret flag, revision과 기대 상태의
불리언 비교만 사용했다. secret/plain value, Site dispatch token, product
cookie, Bearer token, OAuth code/state, usage aggregate와 local session path는
출력하거나 기록하지 않았다.

## immutable npm release 판정

- registry package는 `codex-usage-profile@0.1.0` 하나이고
  `latest=0.1.0`, public files 13개, unpacked size 49,887 bytes다.
- registry SHA-1은
  `a1d30872a6677e9b781e64e14f7ad9040ee92e0d`, SHA-512는
  `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==`
  로 Task #44 handoff와 일치한다.
- registry signature와 SLSA provenance attestation은 invalid 0,
  missing 0이다. registry `gitHead`와 recovery tag
  `codex-usage-profile-v0.1.0-recovery.1`은
  `f10ad2cb1a38568371c5467dc3a25ce29df7ae8f`로 일치한다.
- provenance source는 public
  `postmelee/codex-usage-profile`, workflow
  `.github/workflows/publish-npm.yml`, 성공한 run
  [`30352705791`](https://github.com/postmelee/codex-usage-profile/actions/runs/30352705791)이다.
  이 run의 Node 20/22/24 package verification과 provenance publish job은
  모두 success다.
- 별도 empty consumer에 exact `0.1.0`과 `@latest`를 설치했다. 두 설치는
  CLI `0.1.0`, analyzer `0.2.0`, engine `>=20`, production 기본 origin을
  동일하게 제공했다.
- Node `20.20.2`, `22.23.1`, `24.15.0`에서 exact와 latest CLI version이
  모두 `0.1.0`으로 실행됐다. 격리된 XDG config에서 help는 production
  origin을 표시하고 credential-free status는 network 요청 전에
  `No credential found. Run login first.`로 안전하게 실패했다.
- current source candidate도 13-entry package 검증과 local consumer smoke를
  통과했다. current source의 local pack digest는 immutable registry digest와
  다르며 동일 version 재게시 후보로 사용하지 않는다.

## Sites production baseline

- project는 active, title `Codex Usage Profile`, slug
  `codex-usage-profile-stage5`, canonical origin은
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`다.
- access는 public revision `14`, allowed owner count `1`, disabled 상태
  없음이다. Site를 owner-only로 바꾸거나 access policy를 수정하지 않았다.
- latest saved version은 `7`, source는
  `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`, archive는 tar 19 files,
  4,679,680 bytes다. 새 version을 저장하거나 production에 재배포하지 않았다.
- production environment revision은 `13`이다. service mode는 expected
  `normal`, maintenance mode는 expected `disabled`로 비교 통과했다.
  GitHub OAuth client id/secret과 maintenance operator secret key는
  등록돼 있으며 secret value는 조회·출력하지 않았다. disabled maintenance
  route는 secret key 존재와 무관하게 닫혀 있다.
- `.openai/hosting.json`의 logical binding은 D1 `DB`, R2
  `PROFILE_MEDIA`다. production `/healthz`는 `status=ok`, `worker=ok`,
  `bindings=ok` 세 allowlist field만 반환했다. production artifact는
  expected bindings 3개와 D1 migration 2개를 검증했다.
- anonymous route 결과는 landing `200 text/html`, health
  `200 application/json`, `/api/auth/me` `401`,
  `postmelee` public JSON `404`, stable card `404`, disabled maintenance
  route `404`다. redirect 또는 private response body 노출은 없었다.
- 최근 error-only Worker event는 예상된 401/404 경계뿐이고 5xx,
  non-`ok` Worker outcome과 application source allowlist 위반은 0건이다.
  provider envelope의 일반 cookie header event는 있었지만 최근 24시간에
  제품 `cup_session`, Authorization, OAuth code/state는 0건이었다.
- 비밀이 아닌 synthetic invalid `cup_session`과 Bearer를 각각 GET 1회
  사용한 redaction probe에서도 해당 marker와 credential header field는
  provider log에 나타나지 않았다. 두 요청은 모두 예상한 generic `401`이고
  data mutation은 없다.
- Sites connector와 production API에서 신규 resource, plan upgrade,
  결제수단 또는 quota blocker 표시는 관찰되지 않았다. connector가
  billing dashboard나 장기 quota 추세를 제공하지 않는 한계는 Gate와 최종
  판정의 잔여 위험으로 유지한다.

## Gate A 승인 입력

### Production과 release

| 항목 | 승인 입력 |
|---|---|
| Origin | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` |
| Site | active/public, access revision `14`, saved version `7` |
| Saved source | `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0` |
| Runtime | environment revision `13`, service normal, maintenance disabled, health/bindings `ok` |
| Data linkage | logical D1 `DB`, R2 `PROFILE_MEDIA`, migration count `2` |
| npm | `codex-usage-profile@0.1.0`, `latest=0.1.0`, analyzer `0.2.0` |
| npm integrity | SHA-1/SHA-512는 위 immutable registry 값과 일치 |
| Provenance | recovery SHA `f10ad2c…`, successful run `30352705791` |
| Consumer | exact/latest 모두 Node 20/22/24에서 CLI `0.1.0` 실행 |

### Disposable identity와 생성 예정 상태

- GitHub login과 requested public handle: `postmelee`.
- 현재 anonymous session은 없고 `/api/auth/me`는 `401`이다.
  `postmelee` public JSON과 card는 모두 `404`다.
- Task #44 exact cleanup handoff상 disposable owner-dependent D1/R2
  state는 제거됐다. public 404만으로 private durable owner 부재를 독립
  조회할 수는 없으므로 Stage 2 OAuth 결과가 fresh account 조건과 다르면
  submit 전에 중단한다.
- Stage 2에서 생성 예정인 product state:
  - OAuth state 1개
  - owner 1개와 browser session 1개
  - CLI device challenge 1개와 narrow submit token 1개
  - submitted device 1개
  - latest usage/snapshot 1세트
- Stage 2는 private-by-default까지만 수행하므로 publish 전 R2 object는
  `0`을 유지한다. `en`/`ko` immutable revision과 stable publication은
  별도 Stage 4 승인 범위다.

### 전송 허용 범위

- Account Usage Contract v1 top-level:
  `contractVersion`, `capturedAt`, `summary`, `dailyUsageBuckets`.
- `summary` aggregate:
  `lifetimeTokens`, `peakDailyTokens`, `longestRunningTurnSec`,
  `currentStreakDays`, `longestStreakDays`.
- 각 daily bucket:
  `startDate`, `tokens`.
- request metadata로 product가 생성한 narrow Bearer submit token,
  random device id와 optional device display name을 사용한다. raw 값은
  report, argv, URL, source와 stdout에 기록하지 않는다.
- 전송 제외:
  prompt, response, tool input/output, Codex/OpenAI access·refresh token,
  cookie/API key, GitHub OAuth token/email/id, local Codex session·인증 파일,
  filesystem path와 raw app-server RPC.

### Gate A 종료 목표와 경계

- Stage 2 종료 시 owner는 private/unpublished이고 authenticated preview는
  `private, no-store`, anonymous public HTML/JSON/card는 `404`여야 한다.
- Gate A는 fresh OAuth/session/device/token 생성과 위 Contract v1 집계
  전송만 승인한다. public publish, Site access/environment 전환,
  maintenance operator mutation, export/delete/restore와 final cleanup은
  승인하지 않는다.
- Task #45 최종 종료 목표는 Site public, service normal, maintenance
  disabled, disposable owner/session/token/D1/R2/local credential `0`,
  public JSON/card `404`다.

## 검증 결과

실행 명령:

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

추가 read-only 검증:

```text
npm registry exact version/dist-tag/integrity/signature/attestation
Git tag/recovery SHA와 GitHub publish run
empty consumer exact/@latest on Node 20/22/24
npm audit + npm audit --omit=dev
Sites project/access/version/environment key presence/error-only log
anonymous landing/health/auth/private/public/maintenance route
synthetic invalid cookie/Bearer log redaction GET
```

결과:

- OK — Node test 487개 중 481개 통과, 환경 의존 6개 skip, 실패 0건.
- OK — Playwright E2E 16/16 통과.
- OK — 기본, Cloud Run, Sites와 production build 통과.
- OK — full-stack/production artifact verifier 통과. production candidate
  5,400,662 bytes, client files 7, expected bindings 3, migrations 2,
  Worker raw 3,901,236 bytes, gzip 2,145,397 bytes다.
- OK — hosting matrix가 Cloud Run canonical app, sample-only Sites mirror와
  fallback 독립성을 확인했다.
- OK — local package verifier/smoke는 13 entries와 5 consumer checks를
  통과했다.
- OK — registry exact/latest integrity, signature, provenance와
  Node 20/22/24 소비자 실행 일치.
- OK — public release scan 1,254 blobs, blocker 0, 기존 승인 review 12.
- OK — production public/version 7/normal/maintenance disabled,
  bindings ready와 anonymous private/public 경계 유지.
- OK — recent log에 5xx/Worker failure/application allowlist 위반 0,
  synthetic product credential marker 0.
- OK — `git diff --check` 통과.

## 잔여 위험

- 전체 `npm audit`은 build/dev 도구 체인에서 low 1, high 7을 보고한다.
  direct 항목은 `@cloudflare/vite-plugin@1.37.1`과
  `wrangler@4.92.0`, transitive 항목은 `esbuild`, `miniflare`,
  `postcss`, `sharp`, `undici`, `ws`다. `npm audit --omit=dev`는
  vulnerability 0이고 production artifact에도 이 패키지들은 포함되지
  않아 현재 deployed runtime/CLI blocker로 판정하지 않았다.
  `@cloudflare/vite-plugin@1.47.0` 이상을 포함한 dependency hardening은
  source/lockfile 변경이므로 별도 승인된 task에서 회귀 검증해야 한다.
- provider Worker envelope에는 플랫폼이 수집한 일반 request metadata가
  존재한다. 현재 제품 session/Bearer/OAuth marker 비노출은 확인했지만
  Stage 2 실제 OAuth와 device flow 뒤 동일 점검을 다시 수행해야 한다.
- public `404`는 private durable owner와 owner 부재를 구분하지 못한다.
  Task #44 exact cleanup을 선행 증적으로 사용하며 fresh OAuth 결과가
  예상과 다르면 submit 전에 중단한다.
- maintenance operator secret key가 등록돼 있으나 route는 disabled다.
  Gate B에서는 fresh secret으로 교체하고 Task 종료 시 key 제거 여부까지
  별도 검증해야 한다.
- Sites의 장기 가격·quota·정책과 provider-managed fault는 이번 read-only
  baseline으로 보증할 수 없다. 추가 과금/upgrade/quota blocker가 실제로
  관찰되면 신규 submit/publication을 중단하고 #43 trigger로 넘긴다.

## 다음 단계 영향

- Stage 2는 위 Gate A의 exact origin, owner/handle, 생성 record, Contract v1
  field allowlist와 종료 목표를 그대로 사용한다.
- Stage 2 시작 전 public/version/health와 `postmelee` public 404를 다시
  확인한다.
- 실제 OAuth/session/device/token과 Contract v1 aggregate 전송은 Stage 1
  보고서와 Gate A를 작업지시자가 승인한 뒤에만 수행한다.
- public publish, operational transition과 destructive lifecycle은 각각
  Stage 4, Gate B/C까지 계속 금지한다.

## 승인 요청

- Stage 1 baseline과 Gate A 입력을 승인하면 Stage 2의 fresh GitHub OAuth,
  device login, Account Usage Contract v1 집계 전송과 private-by-default
  검증으로 진행한다.
