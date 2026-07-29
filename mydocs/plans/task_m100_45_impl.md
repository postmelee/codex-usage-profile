# 구현계획서 — Task #45: Sites production 전체 흐름 및 보안 QA

수행계획서: [`task_m100_45.md`](task_m100_45.md)
GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | immutable release와 production baseline | registry·provenance·source·Sites read-only evidence, Gate A 입력 | 전체 회귀, clean install, public/anonymous route와 비용 stop baseline |
| 2 | Gate A: fresh OAuth, device login과 private-by-default | disposable owner/session/device/token, private Contract v1 snapshot | OAuth/session/logout, published CLI, private preview no-store와 anonymous 404 |
| 3 | submit idempotency와 보안 경계 | retry/conflict, token/origin/CSRF/log evidence | unchanged/409/410, cross-origin/CORS, allowlist와 local concurrency/failure |
| 4 | public profile, stable R2 card와 cache | temporary public publication, locale/card digest와 ETag evidence | HTML/JSON/PNG GET·HEAD·304, accepted submit·ETag invariant, unpublish 404 |
| 5 | Gate B/C: 운영 rollback, backup/restore와 cleanup | access/environment rollback, export/restore, retention, exact final cleanup | revision/version 고정, digest/count, public/normal 복구와 owner/card 404 |
| 6 | release decision, 문서 drift와 handoff | 전체 재검증, 필요한 공식 문서 보정, release QA 판정 | final remote/local state, 비용 stop, blocker와 M100 홍보 PASS/BLOCKED |

## 수행계획 반영과 고정 결정

- 작업지시자가 수행계획서와 권고안 A를 승인했다. 현재 canonical public
  Site, saved version 7과 public npm `codex-usage-profile@0.1.0`을 직접
  검증한다.
- 수행계획 승인은 아래 remote Gate를 자동 승인하지 않는다.
  - Gate A: disposable owner/session/device/token 생성과 Account Usage
    Contract v1 집계 전송
  - Gate B: Site access와 environment revision의 짧은 운영 전환
  - Gate C: export→delete→restore/repair→final cleanup
- 새 Site, 새 D1/R2, 새 saved version, custom domain, 유료 resource와
  Cloud Run fallback은 만들지 않는다.
- production server/runtime/schema/package 수정은 예상하지 않는다. Stage 5
  Gate B-R3에서 확인된 operator CLI 무기한 대기 blocker는 작업지시자가
  승인한 계획 변경에 따라 기본 15초 request timeout과 회귀 테스트만
  보정한다. 그 밖의 QA blocker가 source 변경을 요구하면 production을 safe
  state로 복구하고 수행·구현 계획 변경 또는 별도 issue 승인을 먼저 받는다.
- fresh 환경은 기존 owner record가 없는 production에서 새 product
  OAuth/session/device/token을 만들고, 기존 product cookie·credential·npm
  cache를 재사용하지 않는다는 의미다. 별도 제3자 GitHub 계정을 요구하지
  않는다.
- CLI config는 task 전용 `XDG_CONFIG_HOME`과 npm cache를 사용한다. `$HOME`,
  `$CODEX_HOME`, 기존 credential path와 main worktree는 변경하지 않는다.
- actual Account Usage document와 service token은 한 ephemeral Node process의
  memory에서만 retry/conflict probe에 사용한다. payload/token/cookie를
  source, temporary file, argv, URL, stdout, report 또는 채팅에 기록하지
  않는다.
- browser session mutation은 browser context 안에서 수행한다. session cookie를
  추출하거나 shell로 전달하지 않는다.
- production request는 route별 최소 횟수로 제한한다. rate-limit,
  provider failure와 concurrency 대부분은 local real-workerd/D1/R2 suite로
  검증한다.
- 모든 Stage는 `task-stage-report` 절차로
  `mydocs/working/task_m100_45_stage{N}.md`를 작성하고 해당 Stage의 변경과
  함께 커밋한 뒤 다음 Stage 승인을 받는다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 사용자 진입 문서 | 저장소 루트, drift 시만 수정 | `README.md` | OK | Stage 6에서 실제 계약과 다를 때만 최소 수정 |
| architecture·보안·retention 계약 | 기존 공식 `docs/` | `docs/production-hosting.md` | OK | Stage 6에서 실제 production drift만 반영 |
| Sites 운영 runbook | 기존 공식 `docs/` | `docs/sites-operations.md` | OK | Gate B/C 결과가 반복 절차를 바꾼 경우만 수정 |
| CLI 사용자 문서 | 기존 공식 `docs/` | `docs/cli-submit.md` | OK | published CLI UX·privacy drift 시만 수정 |
| card 사용자 문서 | 기존 공식 `docs/` | `docs/readme-card.md` | OK | URL/cache/locale drift 시만 수정 |
| npm package 사용자 문서 | package root | `packages/codex-usage-profile-cli/README.md` | OK | immutable `0.1.0`은 덮어쓰지 않고 source/future patch만 판단 |
| 단계별 QA 증적 | `mydocs/working/` | `mydocs/working/task_m100_45_stage{N}.md` | OK | secret·payload·path 없이 상태/digest/count만 기록 |
| 최종 release QA 보고 | `mydocs/report/` | `mydocs/report/task_m100_45_report.md` | OK | M100 홍보 PASS/BLOCKED와 #43 trigger 보존 |

QA가 현재 계약과 일치하면 공식 문서는 수정하지 않는다. 특정 owner, request,
Gate와 일회성 검증 결과는 공식 문서나 `mydocs/manual`에 넣지 않는다.

## 공통 실행 규칙

- 작업 경로는 `/private/tmp/codex-usage-profile-task45`, branch는
  `local/task45`로 고정한다.
- main worktree의 `local/task43`, `codex-extracted/`와 사용자의 다른 local
  변경은 읽기·수정·merge·rebase·삭제하지 않는다.
- `.openai/hosting.json`의 기존 opaque project와 logical binding `DB`,
  `PROFILE_MEDIA`만 사용한다. project id를 만들거나 바꾸지 않는다.
- production baseline은 Site active/public, saved version 7, service normal,
  maintenance disabled다. Stage 5의 모든 전환은 같은 saved version 7을
  재배포하고 source archive/version을 새로 저장하지 않는다.
- Sites identifier와 environment secret은 connector 응답에서 받은 opaque
  값을 그대로 사용하되 문서·보고서에는 version/revision/count만 적는다.
- environment를 읽을 때 nested tool 결과에서 key name/presence와 revision만
  추출한다. secret/plain value는 모델 출력으로 전달하거나 기록하지 않는다.
- OAuth, operator, session, CLI token은 secret이다. raw 값을 shell argument,
  URL, Git config, source, log, stage report와 채팅에 넣지 않는다.
- task 전용 임시 directory는 `mktemp -d`로 만들고 exact resolved path만
  정리한다. 기존 사용자 config/cache나 넓은 path를 재귀 삭제하지 않는다.
- Account Usage Contract v1에서 허용하는 top-level field는
  `contractVersion`, `capturedAt`, `summary`, `dailyUsageBuckets`뿐이다.
  identity, credential, prompt, response, tool data와 local path를 payload에
  넣지 않는다.
- aggregate value와 daily bucket 자체는 Stage report에 복제하지 않는다.
  contract version, field name, capturedAt 존재, document digest와 HTTP
  result만 기록한다.
- public JSON이 합법적으로 aggregate를 공개하는 동안에도 report에는 field
  allowlist와 digest만 남긴다.
- stable card ETag와 PNG SHA-256은 public cache 검증값으로 기록할 수 있다.
  storage ETag, internal R2 key와 owner numeric id는 보고하지 않는다.
- exact destructive plan이 예상과 다르면 apply를 호출하지 않는다.
- remote 단계 중 실패하면 새 진단보다 다음 순서의 safe state 복구를
  우선한다.
  1. public visibility를 private/unpublished로 닫기
  2. service `normal`, Site access `public`, maintenance route `disabled` 복원
  3. fresh operator secret 폐기
  4. token/session/local credential revoke
  5. health/anonymous 404 재확인
- 추가 plan, 결제수단, 자동 초과 과금 또는 quota blocker가 보이면 신규
  submit/publication을 중단하고 #43 trigger 후보로 보고한다.
- 기존 durable backup은 이번 task에서 삭제하지 않는다.

## Stage 1 — immutable release와 production baseline

### 산출물

신규:

- `mydocs/working/task_m100_45_stage1.md`

수정:

- 없음

### 실행 내용

1. local branch가 승인된 수행·구현 계획 commit만 포함하고
   `origin/devel`의 PR #53 merge 이후 기준인지 확인한다.
2. public npm `0.1.0`의 name/version/dist-tag, 13-file tarball,
   SHA-1/SHA-512, signatures와 provenance source를 Task #44 handoff 값과
   대조한다.
3. task 전용 npm cache와 empty consumer directory에서 exact `0.1.0`,
   `@latest`, bin/help/status의 safe failure와 production default origin을
   검증한다.
4. 전체 Node/E2E/build/Sites production artifact/Cloud Run fallback/public
   surface 회귀를 실행한다.
5. Sites connector로 project title/status/current live URL/access mode,
   saved version 7/source commit, current deployment와 D1/R2 logical linkage를
   read-only로 확인한다.
6. environment는 key presence, secret flag와 revision만 sanitizing해 확인한다.
   value는 출력하지 않는다.
7. anonymous request로 landing/health `200`, `/api/auth/me`의 로그인 전 경계,
   `postmelee` public JSON/card `404`, maintenance route generic `404`를
   확인한다.
8. recent error-only Worker log를 좁은 시간 범위로 조회해 blocker/error
   event와 allowlist 외 field가 없는지 확인한다.
9. 신규 비용·quota/plan upgrade 표시가 connector/API에서 관찰되지 않는지
   기록하고, UI 확인이 필요한 값은 Gate A 입력에 작업지시자 확인 항목으로
   분리한다.
10. 아래 Gate A 표를 값 없는 template이 아니라 exact redacted 값으로 만든다.

### Gate A 승인 입력

- production:
  - canonical origin, Site public access revision, saved version number/source
  - service mode/maintenance key presence와 health
  - logical binding 이름과 migration count
- release:
  - npm name/version/latest, registry SHA-1/SHA-512, provenance source/run
  - clean install Node/npm/CLI/analyzer version
- disposable identity:
  - GitHub login과 requested public handle
  - 현재 owner/public profile/card가 없다는 `404`
- 생성 예정:
  - OAuth state, owner, browser session, CLI device challenge/token,
    submitted device, latest usage/snapshot
  - publish 전 R2 object `0`; Stage 4 publish 시 `en`/`ko` revision과 stable
    publication 생성 예정
- 전송 범위:
  - Account Usage Contract v1의 네 top-level field와 summary/daily bucket
    aggregate
  - prompt, response, tool data, Codex/OpenAI/GitHub credential, local session
    file 제외
- 종료 목표:
  - public Site/normal/maintenance disabled
  - disposable owner/session/token/D1/R2/local credential `0`
  - public JSON/card `404`

### 검증

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

- `npm view codex-usage-profile@0.1.0`과 `dist-tags`
- npm registry tarball integrity/signature/provenance
- isolated exact/`@latest` consumer install on Node 20, 22, 24
- Sites project/access/version/environment key presence와 recent error log
- anonymous landing/health/auth/private/public/maintenance route status

### 중단 조건

- registry artifact, integrity, provenance 또는 dist-tag가 Task #44와 다르다.
- 전체 회귀나 Node 20/22/24 clean install이 실패한다.
- Site가 public/version 7이 아니거나 required D1/R2 linkage가 없다.
- `postmelee` owner/public media가 이미 존재하거나 anonymous private data가
  노출된다.
- secret/private value가 client, response, registry artifact, source 또는
  structured log에 나타난다.
- 추가 과금/plan upgrade/quota blocker가 관찰된다.

### 커밋

```text
Task #45 Stage 1: immutable release와 production baseline
```

## Stage 2 — Gate A: fresh OAuth, device login과 private-by-default

### 실행 전 조건

- Stage 1 보고서 승인
- Gate A의 exact owner/handle, Contract field, 생성 record와 종료 목표 승인
- current public Site/version/health와 owner/public 404 재확인
- task 전용 CLI config/cache directory와 fresh product browser session 준비

### 산출물

신규:

- `mydocs/working/task_m100_45_stage2.md`

수정:

- 없음

### 실행 순서

1. task 전용 config/cache directory를 `mktemp -d`로 만들고
   `XDG_CONFIG_HOME`과 npm `--cache`에만 연결한다. 기존 config를 복사하지
   않는다.
2. browser에서 `/api/auth/me`가 unauthenticated인지 확인한다. 기존 product
   session이 있으면 UI logout으로 제거하고 다시 확인한다.
3. exact `codex-usage-profile@0.1.0 login`을 실행해 device verification URL과
   user code를 받는다. raw device code 전체는 report에 기록하지 않는다.
4. browser에서 GitHub OAuth를 완료하고 device code를 한 번 승인한다.
   작업지시자 interaction이 필요하면 approval UI에서만 수행한다.
5. CLI poll/exchange가 한 submit token만 발급하고 task config directory에
   owner-only mode로 저장하는지 확인한다.
6. `status --json`의 allowlist된 version/origin/handle/token metadata만
   검증한다.
7. exact CLI `submit --json`으로 작업지시자가 승인한 local Account Usage
   Contract v1 집계를 전송한다.
8. success output의 status, contract version, capturedAt 존재, profile/card
   URL만 검증한다. aggregate value와 token은 출력·복제하지 않는다.
9. browser에서 authenticated profile/private preview가 `200`,
   `private, no-store`이고 usage/identity field allowlist만 표시되는지
   확인한다.
10. 별도 anonymous request로 canonical HTML unavailable, public JSON/card
    `404`를 확인한다.
11. Stage 3~4용 primary CLI token과 browser session은 유지하되 report에는
    존재 yes/no와 record count만 남긴다.

### 검증

```bash
npx --yes --cache <task-cache> codex-usage-profile@0.1.0 login
npx --yes --cache <task-cache> codex-usage-profile@0.1.0 status --json
npx --yes --cache <task-cache> codex-usage-profile@0.1.0 submit --json
git diff --check
```

추가 검증:

- OAuth state 일회성, callback/session/logout, secure host-only cookie 속성
- device poll interval/expiry와 one-token exchange
- task config directory `0700`, credential file `0600`, symlink 부정
- submitted Contract top-level/summary/bucket allowlist와 identity-free body
- private preview `Cache-Control: private, no-store`
- anonymous public JSON/card `404`

### 중단 조건

- OAuth callback origin/state 또는 GitHub identity가 Gate A와 다르다.
- 기존 owner/data가 나타나거나 생성 count가 예상과 다르다.
- product credential이 task directory 밖에 저장된다.
- payload에 unknown/identity/credential/local path field가 포함된다.
- submit 전 profile이 public이거나 private preview가 no-store가 아니다.
- token/session/usage value가 response allowlist, log 또는 report에 노출된다.

### 커밋

```text
Task #45 Stage 2: fresh OAuth와 private-by-default 흐름
```

## Stage 3 — submit idempotency와 보안 경계

### 산출물

신규:

- `mydocs/working/task_m100_45_stage3.md`

수정:

- 없음

### 실행 내용

1. ephemeral Node process에서 approved Account Usage Contract document와 primary
   service token을 memory에만 유지한다. process는 document digest와 safe
   result code만 출력한다.
2. 같은 document를 exact retry해 `200 unchanged`, 같은 capturedAt의 변경
   document와 더 오래된 capturedAt을 보내 `409`가 되는지 확인한다. rejected
   probe는 stored latest usage를 바꾸지 않아야 한다.
3. `status`와 private preview의 latest digest/count가 exact retry와 rejected
   probe 전후 동일한지 확인한다.
4. Settings에서 secondary narrow token을 하나 만들고 한 번 사용한 뒤
   revoke해 다음 request `410 gone`을 확인한다. primary CLI token은 Stage 4까지
   유지한다.
5. primary credential의 issuing origin과 다른 HTTPS/loopback origin으로
   `status`를 요청해 network 전 token 전달 전에 local 거부되는지 확인한다.
6. browser same-origin UI mutation은 성공해야 한다. 별도 cross-origin browser
   context에서 session cookie를 추출하지 않고 API mutation을 시도해
   Origin/CORS가 닫히는지 확인한다.
7. invalid/missing auth, content type, oversized/unknown Contract field에 대해
   generic 4xx와 safe error code만 반환되는지 bounded probe한다.
8. production rate-limit은 quota를 소진하지 않는 최소 request만 확인한다.
   threshold 경쟁, duplicate callback/exchange/submit/visibility, rollback,
   R2 failure/concurrency는 local real-workerd suite로 재검증한다.
9. probe request id와 좁은 시간대의 recent Worker log를 확인한다. event는
   requestId, routeClass, method, status, durationBucket, errorCode,
   retryable allowlist만 가져야 한다.

### 검증

```bash
node --test src/profile-backend/__tests__/security.test.js
node --test src/profile-backend/__tests__/http.test.js
node --test src/profile-backend/__tests__/d1-store.test.js
node --test src/profile-backend/__tests__/d1-rate-limiter.test.js
node --test src/profile-runtime/sites/__tests__/backend.test.js
node --test src/profile-runtime/sites/__tests__/observability.test.js
node --test src/profile-runtime/sites/__tests__/full-stack.test.js
node --test src/profile-media/__tests__/r2-binding-store.test.js
npm test --workspace packages/codex-usage-profile-cli
git diff --check
```

Production evidence:

- exact retry `200 unchanged`; same timestamp conflict/stale `409`
- secondary revoked token `410 gone`
- issuing-origin mismatch가 request 전 local fail
- cross-origin mutation/CORS deny와 same-origin UI success
- generic 4xx/429 boundary와 structured-log allowlist

### 중단 조건

- retry가 duplicate latest record/device를 만든다.
- rejected conflict/stale request가 stored usage나 publication을 바꾼다.
- revoked/cross-origin credential이 accepted된다.
- CORS allow-origin, cookie/token/usage/URL/query 또는 provider exception이
  공개 response/log에 나타난다.
- bounded probe가 unexpected traffic/quota/error 증가를 만든다.

### 커밋

```text
Task #45 Stage 3: submit idempotency와 보안 경계
```

## Stage 4 — public profile, stable R2 card와 cache

### 산출물

신규:

- `mydocs/working/task_m100_45_stage4.md`

수정:

- 없음

### 실행 내용

1. browser session과 private preview/latest usage를 재확인한다.
2. same-origin Settings/Profile UI에서 한 번 publish한다.
3. canonical `/?profile={handle}`과 public JSON이 `200`이며 JSON key가
   GitHub public identity + Account Usage allowlist인지 확인한다.
4. stable PNG의 `GET|HEAD`, content type, cache-control, quoted application
   ETag와 SHA-256을 기록한다.
5. `locale=en`, `locale=ko`, unsupported locale을 요청한다. `ko`는 한국어
   revision, unsupported는 `en` body/ETag fallback이어야 한다.
6. matching `If-None-Match`가 body 없는 `304`를 반환하는지 확인한다.
7. ongoing Codex 사용으로 Account Usage document digest와 card render input인
   `summary`/`dailyUsageBuckets`가 각각 달라졌는지 analyzer에서 확인한 뒤 CLI
   submit을 다시 실행한다. synthetic usage는 만들지 않는다.
8. accepted submit 뒤 stable URL은 같고 public JSON latest digest가 같은
   revision을 나타내야 한다. render input이 달라졌다면 PNG
   digest/application ETag도 달라져야 한다. `capturedAt`만 달라지고 render
   input과 PNG bytes가 같다면 content-addressed ETag가 유지되는 것을 정상으로
   판정하며, render input 변경 시 ETag 변경 계약은 executable regression으로
   교차 검증한다.
9. changed document exact retry는 `200 unchanged`, stable digest/ETag를
   유지해야 한다.
10. same-origin UI에서 unpublish하고 public JSON/card `404`, canonical HTML
    unavailable과 authenticated private preview no-store를 확인한다.
11. Stage 5 시작 전 publication state는 private/unpublished로 유지한다.

### 검증

```bash
npx --yes --cache <task-cache> codex-usage-profile@0.1.0 submit --json
git diff --check
```

Public route matrix:

- `GET /?profile={handle}`
- `GET /api/profiles/public/{handle}`
- `GET|HEAD /u/{handle}/card.png`
- `GET /u/{handle}/card.png?locale=en`
- `GET /u/{handle}/card.png?locale=ko`
- `GET /u/{handle}/card.png?locale=unsupported`
- matching `If-None-Match`
- unpublish 후 같은 JSON/card URL

### 중단 조건

- 두 locale revision 준비 전 visibility가 public이 된다.
- public JSON이 allowlist 밖 identity/private/internal field를 반환한다.
- public PNG가 R2 stable object 대신 on-demand/no-store 또는 private data
  route를 사용한다.
- HEAD/GET/304의 ETag, content length/cache 의미가 일치하지 않는다.
- accepted submit이 stable URL을 바꾸거나 public JSON latest revision을
  갱신하지 못한다.
- render input이 달라졌는데 새 ETag를 materialize하지 못하거나, PNG bytes가
  같은데 content-addressed ETag가 달라진다.
- unpublish가 즉시 public JSON/card를 404로 닫지 못한다.

### 커밋

```text
Task #45 Stage 4: public profile과 stable R2 cache 검증
```

## Stage 5 — Gate B/C: 운영 rollback, backup/restore와 cleanup

### 실행 전 조건

- Stage 4 보고서 승인
- owner visibility private/unpublished와 public JSON/card `404`
- fresh owner/handle, D1/R2 plan, digest/count와 current access/environment
  revision read-only 재확인
- Gate B exact transition table 승인
- Gate C는 export/restore/delete 직전 fresh plan으로 별도 승인

### 산출물

신규:

- `mydocs/working/task_m100_45_stage5.md`

수정:

- `mydocs/plans/task_m100_45.md`
- `mydocs/plans/task_m100_45_impl.md`
- `scripts/sites-profile-maintenance.mjs`
- `scripts/__tests__/sites-profile-maintenance.test.js`

### Gate B 승인 입력

- current:
  - project/title/origin, public access revision, saved version 7/id
  - environment revision, service normal, maintenance disabled
  - owner-only custom policy는 owner 1명, 추가 user/group 0명
- transition:
  1. public→custom owner-only, anonymous platform gate와 owner health 확인
  2. custom→public, landing/health와 private JSON/card 404 확인
  3. maintenance disabled + service normal에서 fresh operator secret key를
     materialize하고 saved version 7 public deployment
  4. 기존 key를 같은 fresh secret으로 교체하면서 maintenance enabled +
     service normal로 전환하고 bounded operator plan 수렴 확인
  5. 검증된 operator secret을 유지하고 service mode만 maintenance로 전환,
     saved version 7 public deployment과 generic 503 확인
  6. 같은 검증된 operator secret을 유지하고 service mode만 normal로 전환,
     saved version 7 public deployment
  7. maintenance disabled + service normal로 닫되 operator secret key는
     Gate C까지 유지하고 saved version 7 public deployment
- 모든 deployment는 saved version 7만 사용하고 non-terminal status를 같은
  deployment id로 끝까지 조회한다.
- operator CLI 한 요청은 기본 15초 안에 종료되어야 하며, edge 수렴은
  timeout으로 종료된 요청을 포함해 bounded retry와 3회 연속 exact
  plan/backend 일치로 판정한다.
- operator secret key는 Gate C final cleanup에서만 제거한다. Gate B와
  Gate C 사이에는 maintenance disabled의 generic `404`를 재확인한다.
- 실패 시 public access, service normal, maintenance disabled와 secret 제거를
  먼저 복구한다.

### Gate B-R5 실행 기록

- revision 24 public/disabled/normal/secret-absent baseline과 saved version 7
  source를 재확인했다.
- revision 25에서 fresh operator secret key를 disabled/normal 상태로
  materialize하고 saved version 7 배포를 완료했다.
- revision 26에서 같은 key를 교체하면서 enabled/normal로 전환하고 saved
  version 7 배포를 완료했다.
- 첫 bounded exact plan은 owner count가 일치했지만 D1 owner-dependent
  행과 R2 객체를 합친 object count가 승인 기준 13에서 15로 달라졌고
  digest도 불일치했다.
- 중단 조건에 따라 후속 service maintenance 전환과 export/delete/cleanup을
  수행하지 않았다.
- revision 27에서 secret을 제거하고 disabled/normal로 원복한 뒤 saved
  version 7 배포를 완료했다. public access, landing와 `/healthz`, unauthenticated
  auth/operator route, private public JSON/card 상태를 다시 확인했다.
- object count 증가 원인과 새 exact digest/count 승인 없이는 Gate B/C를
  재개하지 않는다.

### Gate B-R6 원인 조사

- `createProfileSitesMaintenanceService()`의 owner plan은 D1
  `planOwnerDeletion()`과 R2 `planOwnerDeletion()`을 병렬 조회한 뒤 두
  `objectCount`를 더한다.
- D1 count에는 owner뿐 아니라 consumed OAuth state, active/revoked session,
  CLI challenge/token, latest snapshot/usage, submitted device와 rate-limit
  행이 포함된다. OAuth callback 1회는 owner에 연결된 OAuth state와 session
  각 1행을 남길 수 있고, 이 transient 행은 retention 시점 전까지 owner
  plan에 계속 포함된다.
- R2 count는 owner immutable revision 수에 stable publication 또는
  tombstone 1개를 더한다. 새 card content를 publish/refresh/repair하면
  `en`/`ko` revision 한 쌍이 늘 수 있다.
- saved version 7의 외부 plan response는 component summary를 합친
  digest/count만 제공한다. 따라서 현재 production contract만으로 `+2`가
  D1인지 R2인지 식별할 수 없다.
- Task #45는 release 검증 task이므로 component 진단용 endpoint나 새 saved
  version을 즉석 추가하지 않는다. owner/handle과 public `404` 경계를
  유지한 채, 짧은 사용자 활동 동결 창에서 fresh plan을 연속 조회해 안정된
  snapshot을 확보한다.

### Gate B-R6 승인 입력

- current:
  - public access revision 16
  - environment revision 27
  - service normal, maintenance disabled, operator secret absent
  - saved version 7과 승인된 source commit 유지
- transition:
  1. revision 28에서 fresh operator secret을 maintenance disabled +
     service normal 상태로 materialize하고 saved version 7 배포
  2. revision 29에서 같은 key를 같은 secret으로 교체하면서 maintenance
     enabled + service normal로 전환하고 saved version 7 배포
  3. Site GitHub login, CLI submit, publish/unpublish와 private preview
     요청을 중단한 최대 60초 진단 창에서 bounded owner plan을 실행
  4. 첫 성공 plan의 owner count, combined object count와 digest를 R6
     anchor로 잡고 뒤의 두 plan이 모두 동일한지 확인
  5. 세 plan 중 하나라도 timeout/error/drift이면 data mutation 없이 즉시
     public access, maintenance disabled, service normal, secret absent로
     원복
  6. 3회 수렴 뒤 revision 30에서 같은 secret을 유지하고 service
     maintenance로 전환해 generic `503`과 `Retry-After: 300` 확인
  7. revision 31에서 service normal로 복구해 auth `401`, health `200`과
     같은 plan 3회 수렴 재확인
  8. revision 32에서 maintenance disabled + service normal로 닫고
     operator secret key는 Gate C까지 유지
- R6는 plan/HTTP smoke만 수행한다. export, delete, restore, retention apply,
  owner/session/token cleanup은 포함하지 않는다.
- R6 anchor는 Gate B 수렴 증거일 뿐 Gate C mutation 승인이 아니다. Gate C는
  fresh plan/export의 exact digest/count를 다시 제시해 별도 승인받는다.

### Gate B-R6 실행 기록

- revision 28 disabled/normal에서 fresh operator secret을 materialize하고
  saved version 7 배포를 완료했다.
- revision 29 enabled/normal 배포 뒤 첫 fresh owner plan을 anchor로 잡았다.
  combined object count 15와 digest가 3회 연속 일치했다.
- revision 30 service maintenance 배포 뒤 landing과 health `200`, auth
  `503`, `Retry-After: 300`, unauthenticated operator route `404`를
  확인했다.
- revision 31 service normal 배포 뒤 owner plan 3회가 같은 anchor에
  일치했다. 그러나 배포 직후 병렬 실행한 단일 unauthenticated auth probe는
  기대 `401`과 달랐다.
- 승인된 stop/rollback 조건을 적용해 revision 32에서 operator secret을
  제거하고 maintenance disabled + service normal로 원복한 뒤 saved version
  7을 배포했다.
- 원복 뒤 public access, landing와 `/healthz` `200`, auth `401`, private
  public JSON/card와 unauthenticated operator route `404`를 재확인했다.
- D1/R2 export, delete, restore, retention apply와 cleanup은 수행하지
  않았다.
- 다음 재시도는 env deployment status 성공과 실제 edge HTTP 수렴을
  구분해야 한다. 최대 60초 bounded window에서 목표 HTTP contract가
  연속 3회 일치할 때 성공으로 판정하고, window 종료 전 단일 stale 응답만으로
  실패 처리하지 않는 계획 변경 승인이 필요하다.

### Gate B-R7 승인 입력

- current:
  - public access revision 16
  - environment revision 32
  - service normal, maintenance disabled, operator secret absent
  - saved version 7과 승인된 source commit 유지
  - R6 owner plan anchor는 combined object count 15와 내부 보관 digest
- transition:
  1. revision 33에서 fresh operator secret을 maintenance disabled +
     service normal 상태로 materialize하고 saved version 7 배포
  2. revision 34에서 같은 key를 같은 secret으로 교체하면서 maintenance
     enabled + service normal로 전환하고 saved version 7 배포
  3. 사용자 login/submit/publish/private preview 활동을 중단한 상태에서
     owner plan을 3회 실행해 R6 anchor count/digest와 모두 일치하는지 확인
  4. revision 35에서 같은 secret을 유지하고 service maintenance로 전환해
     saved version 7 배포
  5. 최대 60초 bounded HTTP convergence window에서 landing/health `200`,
     auth `503`, `Retry-After: 300`, unauthenticated operator `404`가
     연속 3회 일치하는지 확인
  6. revision 36에서 같은 secret을 유지하고 service normal로 전환해 saved
     version 7 배포
  7. 최대 60초 bounded HTTP convergence window에서 landing/health `200`,
     auth `401`, unauthenticated operator `404`가 연속 3회 일치하고 owner
     plan도 R6 anchor count/digest와 3회 일치하는지 확인
  8. revision 37에서 maintenance disabled + service normal로 닫고 operator
     secret key는 Gate C까지 유지한 채 saved version 7 배포
  9. 최대 60초 bounded HTTP convergence window에서 public baseline과
     operator `404`가 연속 3회 일치하는지 확인
- 각 HTTP request는 15초 이내로 제한하고 한 round의 독립 probe는 병렬
  실행한다. 목표 contract가 아닌 응답은 연속 성공 count만 초기화하며
  60초 window가 끝날 때까지 즉시 실패로 판정하지 않는다.
- window timeout, owner plan timeout/error/drift 또는 environment/version
  불일치 시 secret을 제거하고 public access, maintenance disabled, service
  normal로 즉시 원복한 뒤 saved version 7을 배포한다.
- R7는 plan/HTTP smoke만 수행한다. export, delete, restore, retention apply,
  owner/session/token cleanup은 포함하지 않는다.
- R7 성공 뒤 Gate C는 fresh plan/export exact digest/count로 다시
  승인받는다.

### Gate B-R7 실행 기록과 blocker

- revision 33 disabled/normal에서 fresh operator secret materialize와
  saved version 7 배포를 완료했다.
- revision 34 enabled/normal 배포를 완료했다.
- owner plan 세 번은 모두 owner count 1과 combined object count 15로
  유효했지만 digest가 R6 anchor와 달랐다.
- 승인된 drift 조건대로 service maintenance 전환 전에 중단하고 revision
  35에서 secret 제거, maintenance disabled, service normal로 원복해 saved
  version 7을 배포했다.
- 원복 environment와 public access, landing/health `200`, auth `401`,
  public JSON과 unauthenticated operator route `404`는 일치했다.
- public card만 최대 60초 bounded window에서 `404`로 수렴하지 않았고
  후속 status/header probe에서도 `200 image/png`와 public cache policy를
  반환했다. body는 수집·저장하지 않았다.
- combined count가 15로 유지되면서 digest만 달라진 점은 stable object
  count는 같지만 R2 stable state/content가 바뀐 경우와 일치한다. public
  JSON `404`와 함께 보면 D1 private owner와 R2 stable publication이
  불일치한 것으로 판정한다.
- export/delete/restore/retention apply/cleanup은 수행하지 않았다.

### Gate B-R7-E 긴급 차단 승인 입력

- current:
  - public access revision 16
  - environment revision 35
  - service normal, maintenance disabled, operator secret absent
  - public JSON `404`, public card `200`
- 권고안 A:
  1. Site access만 custom owner-only로 변경한다.
  2. environment, saved version, D1/R2와 OAuth 설정은 변경하지 않는다.
  3. anonymous landing/card가 platform access gate로 차단되고 owner
     landing/health가 유지되는지 확인한다.
  4. access revision과 owner-only policy를 기록하고 R2 inconsistency
     진단·복구 전까지 public으로 되돌리지 않는다.
- 권고안 B는 service maintenance 재배포지만 stable card 차단 여부를 추가
  검증해야 하고 Site platform 자체는 공개 상태로 남는다. 이미 검증된
  owner-only access gate를 사용하는 권고안 A보다 containment 확실성이
  낮다.
- R7-E는 access policy만 바꾸며 R2 unpublish/delete/cleanup을 포함하지
  않는다. R2 repair 또는 exact cleanup은 owner-only containment 뒤 새
  계획과 별도 승인을 받는다.

### Gate B-R7-E 실행 기록

- 변경 전 public access revision 16, environment revision 35,
  disabled/normal/secret-absent와 public card `200` blocker를 재확인했다.
- current user role field는 provider가 반환하지 않았지만 custom/public
  capability, 기존 allowed owner user 1명과 group 0명을 확인한 뒤에만
  access update를 실행했다.
- Site access를 custom owner-only revision 17로 변경했다. readback은 allowed
  user 1명, workspace/tenant/other group 0명이다.
- anonymous landing, `/healthz`, public JSON과 card는 모두 platform 4xx로
  차단됐다.
- owner browser에서는 signed-in account, private owner profile/card와
  landing application이 정상 로드됐다.
- environment revision 35, maintenance disabled, service normal, operator
  secret absent와 saved version 7은 그대로다.
- environment, OAuth, D1/R2와 source/version mutation은 수행하지 않았다.
- R2 stable publication inconsistency 복구와 owner/public boundary 검증 전에는
  access revision 17을 유지한다.

### Gate B-R8 exact stable repair 승인 입력

- current:
  - custom owner-only access revision 17
  - allowed owner user 1명, 추가 user/group 0명
  - environment revision 35
  - maintenance disabled, service normal, operator secret absent
  - D1 public JSON은 private `404`, contained R2 stable card는 publication
  - saved version 7과 승인된 source commit 유지
- transition:
  1. revision 36에서 fresh operator secret을 maintenance disabled +
     service normal 상태로 materialize하고 saved version 7 배포
  2. revision 37에서 같은 key를 같은 secret으로 교체하면서 maintenance
     enabled + service normal로 전환하고 saved version 7 배포
  3. 사용자 login/submit/publish/private preview 활동을 중단한 상태에서
     fresh owner plan을 3회 실행해 owner count 1, combined count 15와
     같은 digest 수렴을 확인
  4. repository 밖 temporary path에 mode `0600` exact export를 저장한다.
     raw path, owner internal id, usage와 publication metadata는 보고하지 않는다.
  5. backup contract/digest/count, exact owner/handle, desired visibility
     private와 stable state publication을 확인한다.
  6. export 뒤 fresh owner plan이 pre-export anchor와 일치할 때만 같은 backup,
     export digest/count와 exact owner confirmation으로 `restore --apply`한다.
  7. D1 restore가 idempotent durable match를 통과한 뒤 R2 stable
     publication을 current storage ETag 조건부 tombstone으로 바꾼다.
  8. post-repair owner plan을 3회 실행해 count가 유지되고 새 digest가
     수렴하는지 확인한다.
  9. owner browser에서 private owner card와 public card `404`를 확인한다.
     anonymous 경로는 owner-only platform 4xx를 유지한다.
  10. revision 38에서 maintenance disabled + service normal로 닫고 검증된
      operator secret은 Gate C까지 유지해 saved version 7을 배포한다.
  11. repair와 post-check가 모두 통과하면 R8 temporary backup을 exact path
      확인 뒤 제거한다. Gate C는 새 export를 별도 생성한다.
- 어느 precondition이든 불일치하면 restore를 호출하지 않고 secret 제거,
  disabled/normal로 원복하며 owner-only access를 유지한다.
- restore가 시작된 뒤 오류가 발생하면 owner-only access를 유지하고 fresh
  plan으로 stable state를 판정한 다음 별도 recovery 승인을 받는다.
- R8 승인 범위는 idempotent D1 restore와 R2 stable tombstone repair,
  temporary export 생성·삭제까지다. owner-dependent delete, immutable
  revision delete, retention apply, session/token cleanup과 public access
  복구는 포함하지 않는다.

### Gate B-R8 실행 기록

- revision 36 disabled/normal secret materialize와 revision 37
  enabled/normal overwrite를 owner-only private deployment로 완료했다.
- identity-less maintenance CLI의 첫 plan이 Sites platform owner-only
  gate에서 차단돼 valid JSON summary를 받지 못했다.
- export와 restore는 호출하지 않았고 D1/R2 mutation도 수행하지 않았다.
- revision 38에서 secret을 제거하고 disabled/normal로 원복한 뒤 saved
  version 7을 private deployment했다.
- custom owner-only access revision 17, allowed owner user 1명, group 0명과
  anonymous landing/card platform 차단을 재확인했다.
- SIWC bypass bearer token은 생성/rotate tool만 있고 명시적 revoke tool이
  없어 장기 bypass credential을 남기므로 사용하지 않는다.

### Gate B-R8-R1 service-maintenance bridge 승인 입력

- current:
  - custom owner-only access revision 17
  - environment revision 38
  - maintenance disabled, service normal, operator secret absent
  - saved version 7과 owner 1명/group 0명 유지
- transition:
  1. revision 39에서 fresh operator secret을 disabled/normal 상태로
     materialize하고 saved version 7 private deployment
  2. revision 40에서 같은 secret을 maintenance enabled + service
     maintenance로 교체하고 saved version 7 private deployment
  3. access를 public revision 18로 전환하되 service maintenance를 유지
  4. anonymous landing/auth/public JSON/card `503`, health `200`,
     unauthenticated operator `404`가 최대 60초 window에서 3회 연속
     일치하는지 확인
  5. exact maintenance token으로 owner plan을 3회 실행해 owner count 1,
     combined count 15와 같은 digest 수렴을 확인
  6. repository 밖 mode `0600` pre-repair export를 저장하고 exact
     owner/handle, private desired visibility, stable publication과
     contract/digest/count를 확인
  7. export 뒤 fresh plan이 anchor와 일치할 때만 같은 backup,
     export digest/count와 owner confirmation으로 `restore --apply`
  8. D1 durable restore idempotency 뒤 R2 stable publication을 current
     storage ETag 조건부 tombstone으로 변경
  9. post-repair plan을 3회 실행해 combined count 15와 새 digest 수렴을
     확인하고, 별도 mode `0600` post-export가 private desired visibility와
     stable unpublished를 반환하는지 확인
  10. temporary pre/post backup을 exact path 확인 뒤 제거
  11. service maintenance를 유지한 채 access를 custom owner-only revision
      19로 복구하고 anonymous platform 4xx를 확인
  12. revision 41에서 maintenance disabled + service normal로 닫되 검증된
      operator secret은 Gate C까지 유지하고 saved version 7 private
      deployment
  13. owner landing/private card 정상 로드와 environment/access readback을
      확인
- service maintenance는 `/healthz`와 exact maintenance route를 제외한 일반
  요청에 generic `503`을 반환하므로 public bridge 동안 stable card body를
  서빙하지 않는다.
- restore 전 불일치 시 access를 owner-only로 먼저 닫고 secret 제거,
  disabled/normal revision으로 private deployment한다.
- restore 호출 뒤 오류가 발생하면 public+maintenance 상태에서 fresh
  plan/export로 stable state만 판정하고, access를 owner-only로 닫은 뒤 별도
  recovery 승인을 받는다.
- R8-R1은 SIWC bypass token을 생성하지 않는다. owner-dependent delete,
  immutable revision delete, retention apply, session/token cleanup과 최종
  public access 복구는 포함하지 않는다.

### Gate B-R8-R1 실행 기록과 재시도 보정

- revision 39 disabled/normal secret materialize와 revision 40
  enabled/service-maintenance를 saved version 7 owner-only private
  deployment로 완료했다.
- access를 public revision 18로 바꾸는 Sites connector 호출은 workspace
  internet publishing policy로 거부됐다. access는 custom owner-only
  revision 17, owner 1명/group 0명에서 바뀌지 않았다.
- plan/export/restore는 호출하지 않았고 D1/R2 mutation도 수행하지 않았다.
- 승인된 fail-closed 경로에 따라 revision 41에서 secret을 제거하고
  disabled/normal로 원복한 뒤 saved version 7 private deployment와
  environment readback을 완료했다.
- connector 호출 주체와 달리 로그인된 Sites 설정 UI에서 public 전환이
  가능한지 확인하려면 Chrome 창을 여는 별도 사용자 허가가 필요하다.
- 재시도 transition의 environment revision은
  42 materialize→43 enabled/service-maintenance→44 disabled/normal로
  보정한다. access 계약은 17→18→19, HTTP/plan/export/restore 검증과
  실패 처리 계약은 위 승인 입력과 동일하다.

### Gate B-R8-R1 UI 재시도 기록과 R8-R2 제안

- 로그인된 Chrome Sites 설정 UI로 access revision 17→public 18 전환을
  완료했다.
- revision 42 disabled/normal secret materialize와 revision 43
  enabled/service-maintenance saved version 7 private deployment는
  통과했다.
- 익명 HTTP에서 auth, public JSON, card는 `503`, health는 `200`,
  unauthenticated operator는 `404`였지만 exact landing `/`은 `200`으로
  남아 승인 계약을 충족하지 못했다.
- plan/export/restore는 호출하지 않았고 D1/R2 mutation도 수행하지 않았다.
- access를 owner-only revision 19로 먼저 닫고 revision 44에서 secret을
  제거한 disabled/normal saved version 7 private deployment로 원복했다.
- saved version 7 Worker 소스는 operational stop을 asset handler보다 먼저
  수행하므로 public access 전환이 기존 정적 edge 응답을 유지한 것으로
  판정한다.
- Gate B-R8-R2 보정 transition:
  1. current owner-only revision 19, environment revision 44,
     disabled/normal/secret absent와 saved version 7을 재확인
  2. revision 45 fresh secret disabled/normal private deployment
  3. revision 46 enabled/service-maintenance private deployment
  4. Chrome Sites 설정 UI로 access public revision 20 전환
  5. 같은 saved version 7을 env revision 46으로 public production
     deployment하고 terminal success 확인
  6. exact `/`까지 포함해 landing/auth/public JSON/card `503`, health
     `200`, unauthenticated operator `404` 3회 수렴
  7. 이후 plan/export/restore/post-export 절차는 R8-R1 승인 입력과 동일
  8. 성공 시 service maintenance 상태에서 access owner-only revision
     21로 닫고 revision 47 disabled/normal private deployment
  9. public deployment 또는 HTTP 계약 실패 시 export/restore 없이 access
     owner-only revision 21로 먼저 닫고 revision 47
     disabled/normal/secret-absent private deployment
- 새 saved version이나 resource는 만들지 않는다. public production
  deployment와 revision 45→46→47, access 19→20→21은 별도 Gate B-R8-R2
  승인을 요구한다.

### Gate B-R8-R2 실행 기록과 R8-R3 제안

- revision 45 disabled/normal secret materialize와 revision 46
  enabled/service-maintenance owner-only private deployment를 완료했다.
- Chrome Sites 설정 UI로 access revision 19→public 20을 전환하고, 같은
  saved version 7을 env revision 46으로 public production 재배포했다.
- no-cache exact `/`은 재배포 뒤에도 `200`이었고, auth/public JSON/card는
  `503`, health는 `200`, unauthenticated operator는 `404`였다.
- HTTP 계약 불일치로 plan/export/restore를 호출하지 않았고 D1/R2
  mutation도 수행하지 않았다.
- access를 owner-only revision 21로 먼저 닫고 revision 47
  disabled/normal/secret-absent saved version 7 private deployment로
  원복했다.
- saved version 7 source `index.html`은 빈 client root와 public entry만
  포함한다. `HomePage` 개인화는 auth와 owner API 성공 뒤에만 수행되므로
  service-maintenance에서 `503`인 auth/public JSON/card와 분리된 generic
  marketing shell은 owner durable data를 포함하지 않는다.
- Gate B-R8-R3 보정 transition:
  1. current owner-only revision 21, environment revision 47,
     disabled/normal/secret absent와 saved version 7을 재확인
  2. revision 48 fresh secret disabled/normal private deployment
  3. revision 49 enabled/service-maintenance private deployment
  4. Chrome Sites 설정 UI로 access public revision 22 전환
  5. landing `200`의 HTML이 generic app shell이고 owner handle, account
     usage payload, publication metadata를 포함하지 않는지 확인
  6. auth/public JSON/card `503`, health `200`, unauthenticated operator
     `404`가 3회 수렴하는지 확인
  7. 이후 plan/export/restore/post-export 절차는 R8-R1 승인 입력과 동일
  8. 성공 시 service maintenance 상태에서 access owner-only revision
     23으로 닫고 revision 50 disabled/normal private deployment
  9. landing payload 또는 endpoint 계약 실패 시 export/restore 없이
     access owner-only revision 23으로 먼저 닫고 revision 50
     disabled/normal/secret-absent private deployment
- R8-R3은 새 saved version/public production deployment/resource를 만들지
  않는다. generic marketing landing `200`을 허용하는 보안 precondition
  변경과 revision 48→49→50, access 21→22→23은 별도 승인을 요구한다.

### Gate B-R8-R3 실행 기록과 R8-R4 제안

- revision 48 disabled/normal secret materialize와 revision 49
  enabled/service-maintenance owner-only private deployment를 완료했다.
- Chrome Sites 설정 UI로 access revision 21→public 22를 전환했다.
- landing은 `200`, HTML, 128 KiB bound를 충족하고 auth/public JSON/card는
  `503`, health는 `200`, unauthenticated operator는 `404`였다.
- landing payload absence 검사가 실패해 plan/export/restore를 호출하지
  않았고 D1/R2 mutation도 수행하지 않았다.
- access를 owner-only revision 23으로 먼저 닫고 revision 50
  disabled/normal/secret-absent saved version 7 private deployment로
  원복했다.
- local production artifact `index.html`은 402바이트이고 빈 client root,
  external module script와 stylesheet만 포함한다. R8-R3의 non-empty inline
  script 전면 금지는 Sites platform bootstrap도 owner payload로 오인할 수
  있어 과도하다.
- Gate B-R8-R4 보정 transition:
  1. current owner-only revision 23, environment revision 50,
     disabled/normal/secret absent와 saved version 7을 재확인
  2. revision 51 fresh secret disabled/normal private deployment
  3. revision 52 enabled/service-maintenance private deployment
  4. Chrome Sites 설정 UI로 access public revision 24 전환
  5. landing `200`, HTML, 128 KiB bound를 확인하고 executable inline
     bootstrap은 허용
  6. landing 전체에서 exact public handle과 owner card URL이 없고,
     `application/json`/JSON bootstrap을 구조적으로 순회해 owner ID,
     account usage, publication metadata payload가 없는지 확인
  7. auth/public JSON/card `503`, health `200`, unauthenticated operator
     `404`가 3회 수렴하는지 확인
  8. 이후 plan/export/restore/post-export 절차는 R8-R1 승인 입력과 동일
  9. 성공 시 service maintenance 상태에서 access owner-only revision
     25로 닫고 revision 53 disabled/normal private deployment
  10. landing payload 또는 endpoint 계약 실패 시 export/restore 없이
      access owner-only revision 25로 먼저 닫고 revision 53
      disabled/normal/secret-absent private deployment
- R8-R4는 새 saved version/public production deployment/resource를 만들지
  않는다. payload 검사의 bootstrap 보정과 revision 51→52→53, access
  23→24→25는 별도 승인을 요구한다.

### Gate B-R8-R4 실행 기록

- owner-only revision 23, environment revision 50
  disabled/normal/secret-absent와 saved version 7 preflight를 통과했다.
- revision 51에서 fresh operator secret을 materialize하고 revision 52에서
  enabled/service-maintenance로 전환했으며, 각 revision에 saved version 7
  private deployment를 적용했다.
- Chrome Sites 설정 UI로 access revision 23→public 24를 전환했다.
- landing `200`, HTML, 128 KiB bound와 executable bootstrap 허용 조건에서
  exact public handle/owner card URL이 없고 구조화된 JSON
  owner/usage/publication payload도 없음을 3회 확인했다.
- auth/public JSON/card `503`, health `200`, unauthenticated operator
  `404`가 3회 수렴했다.
- maintenance plan은 owner 1, object 15, 동일 digest로 3회 수렴했다.
  pre-export는 contract/schema v1, owner 1, object 6,
  `private/publication`, mode `0600`, 금지 필드 없음이었다.
- pre-export 뒤 fresh plan이 승인 anchor와 다시 일치한 경우에만 exact
  restore를 적용했다. restore summary는 contract/schema v1, owner 1,
  object 6과 입력 digest가 일치했다.
- post-plan은 owner 1, object 15의 변경된 digest로 3회 수렴했다.
  post-export는 contract/schema v1, owner 1, object 4,
  `private/unpublished`, mode `0600`, 금지 필드 없음이었다.
- 검증용 pre/post backup 두 파일과 전용 임시 디렉터리는 exact 경로를
  재검증한 뒤 삭제했으며 복구할 수 없다.
- 데이터 작업 뒤 access를 public 24→owner-only 25로 먼저 닫고,
  operator secret을 유지한 environment revision 53
  disabled/normal saved version 7 private deployment를 완료했다.
- 최종 connector/UI readback은 owner-only 사용자 1, group 0,
  environment revision 53, disabled/normal, operator secret stored와
  일치했다. 익명 root 요청은 `401`이었다.
- owner/session/token 삭제, retention apply, owner revision 삭제와 operator
  secret 제거는 수행하지 않았으며 Gate C 범위로 남긴다.

### Gate C 승인 입력

- exact owner GitHub login/handle와 visibility private/unpublished
- D1 owner-dependent record 종류별 count
- R2 stable tombstone과 immutable revision count
- export contract/schema version, D1 digest, R2 manifest digest/object count
- repository 밖 backup이 mode `0600`이고 path/value를 보고하지 않았다는 상태
- 순서:
  1. fresh plan
  2. export
  3. plan/export digest·count 재대조
  4. exact delete
  5. owner/public 404 확인
  6. same backup restore/repair
  7. restored digest·count 일치 확인
  8. fresh final delete plan
  9. exact final delete
  10. token/session/local credential cleanup
- 어느 시점이든 digest/count/owner/handle 불일치 시 apply 없이 safe state
  복구 후 중단한다.

### Gate C 실행 기록

- owner-only revision 25, environment revision 53 disabled/normal,
  operator secret stored와 saved version 7 preflight를 통과했다.
- revision 54에서 Gate C용 operator secret을 교체하고 revision 55에서
  enabled/service-maintenance로 전환했으며 각 revision을 owner-only private
  deployment로 적용했다.
- Sites connector public 변경은 workspace의 internet publishing API
  비활성화로 적용되지 않았고 access revision 25가 유지됨을 확인했다. 데이터
  작업을 시작하지 않은 상태에서 Chrome Sites 설정 UI로 public revision
  26을 전환하고 connector readback을 대조했다.
- public bridge에서 landing `200`, HTML/bound, exact handle/owner card
  URL과 구조화된 owner/usage/publication payload 부재, auth/public
  JSON/card `503`, health `200`, unauthenticated operator `404`가 3회
  수렴했다.
- fresh owner plan은 owner 1, object 15, 동일 digest로 3회 수렴했고
  retention 90일/recent revision 5 dry-run candidate는 0이었다.
- pre-delete export는 contract/schema v1, owner 1, object 4,
  `private/unpublished`, mode `0600`, 금지 필드 없음이었다. export 뒤 fresh
  plan이 owner 1/object 15/digest까지 anchor와 다시 일치한 경우에만 first
  exact delete를 적용했다.
- first delete summary는 owner 1/object 15/digest confirmation과
  일치했다. revision 56 enabled/normal saved version 7 public deployment
  뒤 첫 bounded HTTP convergence가 완료되지 않아 추가 mutation을
  중단했다. 단일 진단과 이어진 3회 검증에서 landing/health `200`, auth
  `401`, public JSON/card/operator `404`가 수렴했고 owner plan도
  `not_found`였다.
- 같은 backup restore summary는 owner 1/object 4와 입력 digest가
  일치했다. restore 뒤 public JSON/card `404`를 3회 확인했고 fresh final
  plan은 owner 1/object 4와 동일 digest로 3회 수렴했다.
- final exact delete summary는 owner 1/object 4/digest confirmation과
  일치했다. 이후 owner plan `not_found`, landing/health `200`, auth
  `401`, public JSON/card/operator `404`가 3회 수렴했고 final retention
  dry-run candidate는 0이었다.
- `0600` backup 파일과 전용 임시 디렉터리, task 전용 CLI
  config/cache/credential state는 exact path/content를 재검증한 뒤
  삭제했으며 복구할 수 없다. owner delete가 session/token record를
  제거했고 최종 auth `401`로 서버 측 무효화를 확인했다. 일반
  Codex/OpenAI/GitHub/ChatGPT credential과 브라우저 프로필은 변경하지
  않았다.
- revision 57에서 maintenance를 disabled, service를 normal로 복구하면서
  operator secret key를 제거하고 saved version 7 public production
  deployment를 완료했다.
- 최종 connector state는 public access revision 26, environment revision
  57, disabled/normal, operator secret absent, saved version 7이다. 익명
  landing/health `200`, auth `401`, disposable public JSON/card와 operator
  route `404`가 3회 수렴했다.
- retention candidate가 0이므로 retention apply는 실행하지 않았다.

### 실행 순서

1. operator CLI에 기본 15초 request timeout을 적용하고 응답 없는
   `fetchImpl`이 credential·URL·payload 비노출 `network_unavailable`로
   종료되는 회귀 테스트를 통과시킨다.
2. Gate B 승인 범위에서 access owner-only/public 왕복을 수행한다.
3. service normal + maintenance disabled에서 fresh secret key를 먼저
   materialize하고, 다음 revision에서 기존 key를 교체하면서 route를
   활성화한다. 인증 수렴 뒤 같은 secret을 유지하고 service mode만
   maintenance→normal로 전환한다.
4. maintenance route disabled/invalid token generic `404`,
   service maintenance generic `503`/`Retry-After`, normal health `200`을
   확인한다.
5. service normal + maintenance route enabled 상태에서 owner export plan과
   retention 90일 dry-run을 수행한다.
6. retention은 public stable/tombstone, referenced revision, owner+locale 최근
   5개와 90일 이내 revision을 candidate에서 제외해야 한다. apply하지 않는다.
7. Gate C exact 승인 뒤 repository 밖 backup을 `0600`으로 저장한다.
8. exact delete→public/owner 404→restore/repair→digest/count 비교→fresh final
   delete를 수행한다.
9. secondary/primary token과 browser session을 revoke/logout하고 task CLI
   credential file을 삭제한다.
10. maintenance disabled, service normal로 environment를 복구하되 operator
    secret key는 유지하고 saved version 7을 public deployment한다.
11. Site access public, landing/health `200`, disposable public JSON/card `404`,
    owner not-found와 D1/R2 final count를 확인한다.
12. Gate C final cleanup에서 operator secret key를 제거하고 disabled/normal
    saved version 7을 다시 public deployment한다.
13. task 전용 config/cache directory는 exact path와 contents를 확인한 뒤만
    제거한다.

### 검증

```bash
npm run sites:profile-maintenance -- plan --origin <canonical-origin> --owner-id <exact-owner-id> --handle <exact-handle>
npm run sites:profile-maintenance -- export --origin <canonical-origin> --owner-id <exact-owner-id> --handle <exact-handle> --output <outside-repository>
npm run sites:profile-maintenance -- retention --origin <canonical-origin> --retention-days 90
npm run sites:profile-maintenance -- delete-account --origin <canonical-origin> --owner-id <exact-owner-id> --handle <exact-handle>
npm run sites:profile-maintenance -- restore --origin <canonical-origin> --owner-id <exact-owner-id> --handle <exact-handle> --input <outside-repository>
npm run sites:profile-maintenance -- repair-publication --origin <canonical-origin> --owner-id <exact-owner-id> --handle <exact-handle>
node --test scripts/__tests__/sites-profile-maintenance.test.js
node --test src/profile-backend/__tests__/d1-maintenance.test.js
node --test src/profile-media/__tests__/r2-binding-maintenance.test.js
node --test src/profile-runtime/sites/__tests__/maintenance.test.js
git diff --check
```

실제 mutation command에는 tool이 요구하는 `--apply`와 fresh
owner/handle/digest/count confirmation을 Gate C 승인값 그대로 사용한다.
위 검증 block은 raw secret, backup path와 confirmation 값을 예시로 기록하지
않는다.

### 중단 조건

- access allowlist가 owner 1명/추가 user·group 0명이 아니다.
- Site version이 7이 아니거나 deployment가 failed/non-terminal로 남는다.
- environment 전환이 승인하지 않은 key를 변경하거나 secret 값을 노출한다.
- operator CLI 요청이 15초 timeout 뒤에도 종료되지 않거나 timeout error에
  credential·origin·payload가 노출된다.
- maintenance/normal/owner-only/public 응답이 계약과 다르다.
- retention이 protected stable/tombstone/revision을 candidate로 잡는다.
- plan/export/restore/final plan의 owner/handle/digest/count가 하나라도 다르다.
- delete/restore partial failure에서 일관성을 증명할 수 없다.

### 커밋

```text
Task #45 Stage 5: 운영 rollback과 exact production cleanup
```

## Stage 6 — release decision, 문서 drift와 handoff

### 산출물

신규:

- `mydocs/working/task_m100_45_stage6.md`

수정:

- QA가 실제 계약 drift를 확인한 경우에만:
  - `README.md`
  - `docs/production-hosting.md`
  - `docs/sites-operations.md`
  - `docs/cli-submit.md`
  - `docs/readme-card.md`
  - `packages/codex-usage-profile-cli/README.md`

### 실행 내용

1. Stage 1의 전체 local/registry/Sites read-only 검증을 재실행한다.
2. exact public npm version/dist-tag/integrity/provenance와 Node 20/22/24 clean
   install을 재확인한다.
3. Site public/version 7, service normal, maintenance disabled, health `200`,
   disposable owner/session/token/D1/R2/local credential 종료 상태를 확인한다.
4. recent error-only Worker log와 request/response/client allowlist를
   재확인한다.
5. Sites/D1/R2에서 추가 plan, 결제수단, 자동 초과 과금, quota/정책 blocker가
   관찰됐는지 판정한다.
6. 실제 UX/API/cache/운영 절차가 공식 문서와 다른 경우에만 기존 진실 원천을
   최소 수정한다. immutable registry `0.1.0` README는 수정할 수 없으므로
   기능/security blocker면 patch release 필요성을 별도 제시한다.
7. M100 공개·홍보 판정은 다음과 같이 고정한다.
   - PASS: 모든 release-blocking 수용 기준 통과, final safe state, 비용 stop
     trigger 없음
   - BLOCKED: security/privacy/data consistency/cleanup/rollback blocker,
     final state 불확실 또는 비용 stop trigger 존재
8. #43은 trigger가 실제 관찰된 경우에만 별도 수행계획 승인 후보로 넘긴다.
9. managed remote fault injection, same-owner fresh QA의 한계와 장기 가격
   불확실성을 잔여 위험에 남긴다.

### 검증

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

Remote final matrix:

- npm exact/latest/integrity/provenance/signatures
- Site public/version 7/normal/maintenance disabled/health `200`
- anonymous landing `200`, disposable public JSON/card `404`
- disposable owner/session/token/D1/R2/local credential final count
- recent error event, cost/quota/plan/automatic overage trigger
- official documentation drift

### 중단 조건

- final production safe state를 증명하지 못한다.
- release-blocking security/privacy/data consistency 결함이 남는다.
- registry/Sites artifact가 Stage 1 baseline과 승인 없이 달라진다.
- 비용 stop trigger가 발생했는데 public promotion PASS를 선언하려 한다.

### 커밋

```text
Task #45 Stage 6: release QA 판정과 final state 검증
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- Stage 2, 5의 remote mutation은 exact Gate 승인 전 실행하지 않는다.
- Stage 4의 publish/unpublish는 Stage 2 Gate A가 승인한 disposable owner
  범위와 Stage 3 승인 뒤에만 수행한다.
- report에는 safe status, digest/count, public ETag와 command 결과만 남기고
  secret, aggregate value, browser cookie, backup path/payload를 적지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는
  구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 구현계획서 자체는 오늘할일 갱신과 함께 다음 메시지로 커밋한다.

```text
Task #45: 구현 계획서 작성과 오늘할일 갱신
```

- 단계 커밋은 해당 Stage의 증적과
  `mydocs/working/task_m100_45_stage{N}.md`를 함께 묶는다.
- 단계 커밋 메시지는 각 Stage에 적은
  `Task #45 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- source/official document가 바뀌지 않는 Stage도 stage report를 커밋해 exact
  remote evidence와 승인 경계를 보존한다.

## 단계 의존성

- Stage 1은 구현계획 승인 뒤 시작한다.
- Stage 2는 Stage 1 보고서와 Gate A 승인 뒤 시작한다.
- Stage 3은 Stage 2 검증·보고서 승인 뒤 시작한다.
- Stage 4는 Stage 3 검증·보고서 승인 뒤 시작한다.
- Stage 5는 Stage 4 보고서 승인 뒤 시작하며 Gate B와 Gate C를 각각 별도
  승인받는다.
- Stage 6은 Stage 5 cleanup/final remote state와 보고서 승인 뒤 시작한다.
- Stage 보고서 승인은 다음 Stage의 code/read-only 작업만 승인하며 이후
  remote Gate mutation을 자동 승인하지 않는다.

## 위험과 대응

- **production identity/data 생성**: Gate A에서 exact owner/field/record와 종료
  목표를 승인받고 기존 owner가 있으면 시작하지 않는다.
- **payload/token 노출**: memory-only probe와 sanitized output만 사용하고
  secret·aggregate·path를 argv/file/report에 넣지 않는다.
- **browser cookie 노출**: same-origin browser context 안에서만 mutation하고
  cookie를 shell/tool output으로 추출하지 않는다.
- **운영 중단**: Gate B에 exact access/environment/version/원복 순서를
  제시하고 전환마다 public/normal safe state를 먼저 복구한다.
- **destructive cleanup**: Gate C fresh plan과 export의
  owner/handle/digest/count가 일치할 때만 apply한다.
- **partial restore**: 동일 digest/count를 증명하지 못하면 final delete나 PASS
  판정을 하지 않고 maintenance/owner-only safe state에서 복구 승인을
  요청한다.
- **immutable package blocker**: `0.1.0`을 overwrite/unpublish하지 않고 별도
  patch/deprecation task를 제안한다.
- **rate-limit self-abuse**: production request를 최소화하고 경쟁/failure는
  local suite로 대체한다.
- **Sites beta 비용·정책 변화**: 비용 stop trigger면 promotion을 중단하고
  #43을 별도 승인 대상으로 전환한다.
- **문서 과잉 수정**: QA evidence는 task report에만 두고 official contract가
  실제로 달라진 경우에만 기존 문서를 최소 수정한다.

## 승인 요청 사항

- 6개 Stage의 exact 산출물, 검증 명령, 중단 조건과 커밋 메시지
- Stage 1을 local/registry/Sites read-only baseline으로 먼저 실행하는 순서
- Stage 2의 Gate A 입력을 exact 값으로 제시하기 전에는 OAuth/submit을
  수행하지 않는 경계
- Stage 3의 memory-only retry/conflict probe와 browser cookie 비추출 원칙
- Stage 4에서 실제 Account Usage 변경만 사용하고 synthetic usage로 ETag
  변화를 강제하지 않는 원칙
- Stage 5에서 Gate B와 Gate C를 분리하고 saved version 7 외 version을
  배포하지 않는 원칙
- final state가 public/normal/maintenance disabled, disposable owner/data
  `0`, public JSON/card `404`일 때만 Stage 6 PASS 판정을 허용하는 기준
- source/runtime/schema/package blocker는 hotfix하지 않고 계획 변경 또는
  별도 issue 승인으로 넘기는 기준

승인되면 Stage 1의 local/registry/Sites read-only baseline과
`task_m100_45_stage1.md` 작성부터 진행한다.
