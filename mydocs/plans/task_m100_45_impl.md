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
- source/runtime/schema/package 수정은 예상하지 않는다. QA blocker가 이를
  요구하면 production을 safe state로 복구하고 수행·구현 계획 변경 또는
  별도 issue 승인을 먼저 받는다.
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

- 없음

### Gate B 승인 입력

- current:
  - project/title/origin, public access revision, saved version 7/id
  - environment revision, service normal, maintenance disabled
  - owner-only custom policy는 owner 1명, 추가 user/group 0명
- transition:
  1. public→custom owner-only, anonymous platform gate와 owner health 확인
  2. custom→public, landing/health와 private JSON/card 404 확인
  3. fresh operator secret + maintenance route enabled + service normal,
     saved version 7 public deployment
  4. fresh operator secret + service maintenance, saved version 7 public
     deployment, generic 503 확인
  5. fresh operator secret + service normal, saved version 7 public deployment
  6. maintenance disabled + operator secret 제거, saved version 7 public
     deployment
- 모든 deployment는 saved version 7만 사용하고 non-terminal status를 같은
  deployment id로 끝까지 조회한다.
- 실패 시 public access, service normal, maintenance disabled와 secret 제거를
  먼저 복구한다.

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

### 실행 순서

1. Gate B 승인 범위에서 access owner-only/public 왕복을 수행한다.
2. maintenance route와 service mode를 transition마다 fresh secret으로
   교체하고 saved version 7을 재배포한다.
3. maintenance route disabled/invalid token generic `404`,
   service maintenance generic `503`/`Retry-After`, normal health `200`을
   확인한다.
4. service normal + maintenance route enabled 상태에서 owner export plan과
   retention 90일 dry-run을 수행한다.
5. retention은 public stable/tombstone, referenced revision, owner+locale 최근
   5개와 90일 이내 revision을 candidate에서 제외해야 한다. apply하지 않는다.
6. Gate C exact 승인 뒤 repository 밖 backup을 `0600`으로 저장한다.
7. exact delete→public/owner 404→restore/repair→digest/count 비교→fresh final
   delete를 수행한다.
8. secondary/primary token과 browser session을 revoke/logout하고 task CLI
   credential file을 삭제한다.
9. maintenance disabled, operator secret removed, service normal로 environment를
   복구하고 saved version 7을 public deployment한다.
10. Site access public, landing/health `200`, disposable public JSON/card `404`,
    owner not-found와 D1/R2 final count를 확인한다.
11. task 전용 config/cache directory는 exact path와 contents를 확인한 뒤만
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
