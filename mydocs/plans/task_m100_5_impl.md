# Task M100 #5 구현계획서

수행계획서: [`task_m100_5.md`](task_m100_5.md)
GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
마일스톤: M100

## 구현 전제

- canonical local reader는 npm `codex-usage-analyzer@^0.2.0`의 `readAccountUsage()`다.
- analyzer가 반환하는 Account Usage Contract의 현재 지원 version은 `1`이다.
- usage document에는 identity, device, visibility, card URL과 credential이 없다.
- GitHub identity와 owner binding은 browser OAuth로 생성된 downstream owner record만 신뢰한다.
- #17 device login, #15/#27 token·device 관리, #6 `latestUsages` card renderer와 public endpoint는 완료된 선행 계약이다.
- 기존 `/api/snapshots/submit`과 UsageSnapshot public profile 경로는 호환을 위해 유지한다.
- 실제 npm registry publish와 production service URL 확정은 이번 task에서 실행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Account Usage submit backend | contract validator, `/api/account-usage/submit`, status, replay/rate-limit | backend/card unit tests |
| 2 | CLI 인증과 credential 경계 | CLI workspace, command parser, device login, config/token store | CLI auth/config tests |
| 3 | analyzer SDK submit orchestration | npm analyzer dependency, `submit`, device headers, safe errors/output | CLI/backend integration tests |
| 4 | package와 사용자 문서 | package files, README, CLI/analyzer docs, tarball preflight | `npm pack`, full test/build |
| 5 | end-to-end와 보안 QA | local runtime + packed CLI smoke, real analyzer opt-in, handoff | full regression, credential scan |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/cli-submit.md` | `docs/` | Stage 4 신규 | OK | CLI login/submit/token/privacy 사용자 계약 |
| `README.md` | 저장소 루트 | Stage 4 수정 | OK | 최소 Quickstart와 상세 문서 링크 |
| `docs/codex-usage-analyzer.md` | `docs/` | Stage 4 수정 | OK | standalone v0.2.0 downstream 경계로 갱신 |
| `mydocs/plans/task_m100_5.md` | `mydocs/plans/` | 작성·승인 완료 | OK | 수행 범위와 정책 기록 |
| `mydocs/plans/task_m100_5_impl.md` | `mydocs/plans/` | 본 문서 | OK | 단계별 구현 계약 |
| 단계·최종 보고서 | `mydocs/working`, `mydocs/report` | 각 Stage와 최종 절차 | OK | Hyper-Waterfall 검증 기록 |

## Stage 1 — Account Usage Contract와 submit backend

### 산출물

신규:

- `src/profile-backend/account-usage-submit.js`
- `src/profile-backend/__tests__/account-usage-submit.test.js`
- `mydocs/working/task_m100_5_stage1.md`

수정:

- `src/profile-card/account-usage.js`
- `src/profile-card/index.js`
- `src/profile-card/__tests__/account-usage.test.js`
- `src/profile-card/__tests__/service.test.js`
- `src/profile-backend/http.js`
- `src/profile-backend/index.js`
- `src/profile-backend/errors.js`, 필요한 경우
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `src/profile-backend/__tests__/durable-store.test.js`, 필요한 경우
- `mydocs/orders/20260713.md`

### 변경 내용

1. Account Usage Contract v1 downstream validator를 구현한다.
   - root exact keys: `contractVersion`, `capturedAt`, `summary`, `dailyUsageBuckets`
   - `contractVersion`은 integer `1`만 허용
   - summary exact keys와 각 nullable non-negative safe integer 확인
   - daily bucket은 `null`, `[]` 또는 exact `{ startDate, tokens }` row
   - valid date-only string, duplicate date, unsafe integer와 unknown field 거부
   - `capturedAt`은 valid UTC instant이며 server `now + 5분`을 넘으면 거부
   - `null`은 zero 또는 empty array로 변환하지 않음
2. card input projection을 분리한다.
   - stored record metadata: `contractVersion`, `capturedAt`, `uploadedAt`, content digest
   - renderer input: `{ summary, dailyUsageBuckets }`
   - source `startDate`를 timezone rebucketing하지 않음
3. `createAccountUsageSubmitService()`를 구현한다.
   - Bearer token은 existing token service로 검증하고 owner id는 token에서만 결정
   - owner/usage visibility와 handle은 existing owner record 기준
   - valid submit은 `saveLatestUsage()`와 existing submitted device upsert를 실행
   - previous보다 오래된 `capturedAt`은 conflict
   - same timestamp + same digest는 저장을 중복하지 않고 idempotent success
   - same timestamp + different digest는 conflict
4. product-specific device header contract를 정의한다.
   - `x-codex-usage-profile-device-id`
   - `x-codex-usage-profile-device-name`
   - UTF-8 문자열 길이와 허용 문자/최대 길이를 existing device normalization에 맞춤
   - header가 없어도 legacy-default device로 처리
5. HTTP route를 추가한다.
   - `POST /api/account-usage/submit`
   - `Content-Type: application/json` 필수
   - decoded body 최대 64 KiB
   - body는 contract document 자체이며 wrapper/identity field 없음
   - 신규 저장 201, idempotent retry 200, stale/conflict 409
   - 성공 response는 `capturedAt`, `uploadedAt`, opaque revision, profile URL, image URL, README Markdown을 반환
6. CLI status용 Bearer read route를 추가한다.
   - `GET /api/account-usage/status`
   - owner handle, token metadata, latest usage metadata와 downstream URL만 반환
   - raw token, digest, usage value 전체는 반환하지 않음
7. process-local owner/token rate limiter를 주입 가능한 경계로 추가한다.
   - submit burst와 sustained window를 제한
   - `429`와 `Retry-After` 반환
   - test에서는 deterministic clock과 limiter를 주입
8. 기존 snapshot submit/public lookup은 변경하지 않고 회귀 테스트로 보존한다.

### 검증

```bash
node --test src/profile-backend/__tests__/account-usage-submit.test.js
node --test src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
node --test src/profile-card/__tests__/account-usage.test.js src/profile-card/__tests__/service.test.js
npm test
git diff --check
```

검증 관점:

- exact contract v1과 nullable semantics가 통과한다.
- identity/device/wrapper/unknown field와 unsupported version은 거부된다.
- token owner 외 owner id를 body/header로 선택할 수 없다.
- valid submit은 `latestUsages`와 device timestamp를 갱신한다.
- stale/future/conflicting replay가 구분되고 exact retry는 idempotent다.
- 새 usage는 같은 stable card URL의 ETag와 PNG를 변경한다.
- content type, body size, rate limit과 safe error body가 고정된다.
- 기존 UsageSnapshot submit과 public Profile 회귀가 없다.

### 커밋

```text
Task #5 Stage 1: Account Usage submit backend 구현
```

## Stage 2 — CLI package와 device login·credential 경계

### 산출물

신규:

- `packages/codex-usage-profile-cli/package.json`
- `packages/codex-usage-profile-cli/bin/codex-usage-profile.js`
- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/src/config.js`
- `packages/codex-usage-profile-cli/src/credentials.js`
- `packages/codex-usage-profile-cli/src/device-login.js`
- `packages/codex-usage-profile-cli/src/service-client.js`
- `packages/codex-usage-profile-cli/src/errors.js`
- `packages/codex-usage-profile-cli/src/index.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `packages/codex-usage-profile-cli/test/config.test.js`
- `packages/codex-usage-profile-cli/test/credentials.test.js`
- `packages/codex-usage-profile-cli/test/device-login.test.js`
- `packages/codex-usage-profile-cli/test/service-client.test.js`
- `mydocs/working/task_m100_5_stage2.md`

수정:

- `package.json`, workspace pattern이 필요한 경우만
- `mydocs/orders/20260713.md`

### 변경 내용

1. publish 가능한 CLI workspace를 추가한다.
   - package name/bin: `codex-usage-profile`
   - initial version: `0.1.0`
   - ESM, Node.js `>=20`, MIT
   - runtime files allowlist와 executable bin
2. command parser와 help/version contract를 구현한다.
   - `submit`, `login`, `status`, `logout`
   - global `--server`, `--timeout`, `--json`은 필요한 command에만 적용
   - unknown option/command는 usage와 non-zero exit
   - token을 받는 command argument는 만들지 않음
3. service URL을 정규화한다.
   - precedence: `--server` > `CODEX_USAGE_PROFILE_URL` > package default
   - 이번 task에서 package default가 없으면 actionable config error
   - HTTP는 loopback만 허용하고 비-loopback은 HTTPS만 허용
   - path/query/userinfo가 있는 origin은 거부
4. credential store를 구현한다.
   - token precedence: `CODEX_USAGE_PROFILE_TOKEN` > local file
   - macOS/Linux/Windows OS config directory resolver
   - directory `0700`, file `0600`, atomic temp-write + rename
   - token, service origin, token record id와 stable random device id만 최소 저장
   - symlink/non-regular file과 unsafe permission은 거부
   - injected fs/home/platform/env로 실제 user file을 건드리지 않는 test
5. device login client를 구현한다.
   - `POST /api/auth/device` start
   - relative verification URL을 service origin으로 resolve
   - `intervalSeconds`, `expiresAt` 준수
   - `POST /api/auth/device/poll` pending/approved/exchanged/expired 처리
   - 429 `Retry-After`와 network transient는 expiry 안에서 backoff
   - approved poll의 raw token을 한 번 저장하고 stdout에 출력하지 않음
6. command 동작을 연결한다.
   - `login`: existing credential이 있으면 status 확인 후 재로그인 여부 결정
   - `status`: local state와 `GET /api/account-usage/status` 결과 표시
   - `logout`: local file credential만 삭제, env token은 삭제할 수 없음을 안내
   - browser 자동 open은 best-effort로 두고 항상 verification URL/user code를 text로 출력
7. 모든 IO, fetch, clock, sleep, filesystem은 주입 가능한 seam으로 테스트한다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js
node --test packages/codex-usage-profile-cli/test/config.test.js packages/codex-usage-profile-cli/test/credentials.test.js
node --test packages/codex-usage-profile-cli/test/device-login.test.js packages/codex-usage-profile-cli/test/service-client.test.js
node --test src/profile-backend/__tests__/http.test.js
git diff --check
```

검증 관점:

- help/version/unknown command/option exit code가 안정적이다.
- token은 argv, URL, stdout/stderr와 thrown message에 없다.
- credential file은 safe permission과 atomic write를 사용한다.
- env token은 disk에 저장하거나 logout에서 삭제하지 않는다.
- device poll interval/expiry/429를 준수하고 raw token은 한 번만 소비한다.
- status는 token metadata와 URL만 표시하고 usage value·credential을 노출하지 않는다.

### 커밋

```text
Task #5 Stage 2: CLI 인증과 credential 경계 구현
```

## Stage 3 — analyzer SDK submit orchestration

### 산출물

신규:

- `packages/codex-usage-profile-cli/src/submit.js`
- `packages/codex-usage-profile-cli/src/output.js`
- `packages/codex-usage-profile-cli/test/submit.test.js`
- `packages/codex-usage-profile-cli/test/output.test.js`
- `packages/codex-usage-profile-cli/test/integration.test.js`
- `mydocs/working/task_m100_5_stage3.md`

수정:

- `packages/codex-usage-profile-cli/package.json`
- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/src/service-client.js`
- `package-lock.json`
- `src/profile-backend/__tests__/account-usage-submit.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-card/__tests__/service.test.js`
- `mydocs/orders/20260713.md`

삭제:

- `packages/codex-usage-analyzer/**`

### 변경 내용

1. npm dependency를 canonical standalone package로 전환한다.
   - CLI package dependency: `codex-usage-analyzer@^0.2.0`
   - 이전 local analyzer workspace를 먼저 제거해 npm workspace shadowing 방지
   - lockfile에서 registry package version/resolved/integrity 확인
2. `submit` orchestration을 구현한다.
   - credential이 없으면 `login` flow를 실행한 뒤 이어서 submit
   - `readAccountUsage({ timeoutMs })` 호출
   - returned document의 `contractVersion`과 complete shape를 CLI에서도 재확인
   - body는 document 자체로 JSON serialize
   - device id/name은 product header로 전달
   - auth 401/410은 local credential을 자동 삭제하지 않고 재로그인 안내
   - network ambiguity에서 same document를 제한적으로 retry해 server idempotency 사용
3. analyzer error mapping을 구현한다.
   - `CODEX_NOT_FOUND`
   - `APP_SERVER_START_FAILED`, `APP_SERVER_EXITED`
   - `APP_SERVER_TIMEOUT`
   - `APP_SERVER_PROTOCOL_ERROR`, `APP_SERVER_RPC_ERROR`
   - `INVALID_ACCOUNT_USAGE_RESPONSE`
   - unknown error는 safe generic message
   - raw RPC/app-server stderr, path, credential은 출력하지 않음
4. 성공 output을 구현한다.
   - human: accepted/idempotent 상태, captured time, Profile URL, card URL, README Markdown
   - `--json`: downstream response metadata만 machine-readable JSON
   - raw token, owner numeric id, private revision 내부값은 제외
5. server response와 #6 card 연결을 integration test한다.
   - first submit 201
   - exact retry 200 idempotent
   - later usage changes ETag
   - device lastSubmittedAt update
   - public/private card visibility는 owner 설정 유지

### 검증

```bash
npm install
node --test packages/codex-usage-profile-cli/test/*.test.js
node --test src/profile-backend/__tests__/account-usage-submit.test.js src/profile-backend/__tests__/http.test.js
node --test src/profile-card/__tests__/service.test.js
npm test
git diff --check
```

검증 관점:

- lockfile이 registry `codex-usage-analyzer` v0.2.x를 가리키고 local workspace를 가리키지 않는다.
- CLI request body가 analyzer Account Usage Contract와 deep-equal이다.
- body에 identity/device/card field가 없고 device는 header로만 전달된다.
- every analyzer error code와 HTTP auth/conflict/rate-limit 오류가 안전하게 mapping된다.
- successful submit output에 usable URL/Markdown이 있고 secret은 없다.
- submit 후 `latestUsages`와 card ETag가 실제로 바뀐다.

### 커밋

```text
Task #5 Stage 3: analyzer SDK submit orchestration 구현
```

## Stage 4 — package 전환과 사용자 문서

### 산출물

신규:

- `docs/cli-submit.md`
- `mydocs/working/task_m100_5_stage4.md`

수정:

- `packages/codex-usage-profile-cli/package.json`
- `packages/codex-usage-profile-cli/README.md`, 필요한 경우
- `README.md`
- `docs/codex-usage-analyzer.md`
- `docs/readme-card.md`
- `.gitignore`, credential/example output exclusion이 필요한 경우
- `mydocs/orders/20260713.md`

### 변경 내용

1. package publish allowlist를 검토한다.
   - bin/source/README/LICENSE만 포함
   - test, local credential, runtime store, `.env`, fixture secret은 제외
   - executable bit와 shebang 확인
2. `docs/cli-submit.md`를 작성한다.
   - requirements: Node 20+, installed Codex, ChatGPT-backed sign-in
   - local/tarball Quickstart와 `--server`/환경 변수
   - login → browser approval → submit → Profile/publish/README 흐름
   - status/logout, env token과 local credential file
   - 실제 전송 field와 전송하지 않는 identity/credential 목록
   - analyzer error code와 troubleshooting
   - token revoke는 Settings에서 즉시 수행
3. README의 오래된 UsageSnapshot submit 설명을 Account Usage Contract path로 갱신한다.
4. `docs/codex-usage-analyzer.md`를 standalone npm v0.2.0 책임 경계와 upstream/downstream 링크로 갱신한다.
5. `docs/readme-card.md`의 CLI submit 설명과 endpoint contract를 실제 구현에 맞춘다.
6. package dry-run 결과를 allowlist와 비교한다.

### 검증

```bash
npm pack --dry-run --workspace packages/codex-usage-profile-cli --json
npm test
npm run build
git diff --check
```

검증 관점:

- package tarball에 credential, `.env`, runtime store, test artifact가 없다.
- bin은 설치 후 `codex-usage-profile --help`를 실행할 수 있다.
- README/CLI/card 문서의 command, endpoint, contract version과 privacy 설명이 일치한다.
- standalone analyzer와 downstream의 책임이 다시 섞이지 않는다.
- 실제 publish와 production URL을 완료했다고 오해시키는 문구가 없다.

### 커밋

```text
Task #5 Stage 4: CLI package와 사용자 문서 정리
```

## Stage 5 — end-to-end smoke와 최종 보안 QA

### 산출물

신규:

- `mydocs/working/task_m100_5_stage5.md`

수정:

- smoke에서 발견된 최소 보강 파일
- `mydocs/orders/20260713.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. clean temporary directory에서 package tarball을 설치한다.
2. local runtime을 임시 durable store와 OAuth config로 실행한다.
3. packed CLI 시나리오를 검증한다.
   - `--help`, `--version`
   - `login --server http://127.0.0.1:{port}`
   - browser GitHub login과 device approval
   - credential file permission
   - `status`
   - `submit`
   - `logout`
4. 실제 analyzer SDK opt-in smoke를 실행한다.
   - 현재 Codex login account의 Account Usage Contract v1 획득
   - raw JSON/credential을 로그·보고서에 남기지 않고 field name/contract version만 확인
5. submit 전후를 검증한다.
   - owner Profile usage 존재
   - private preview 998x612
   - publish 후 stable public card URL
   - second changed fixture submit 후 ETag 변경
   - revoked token submit 거부
6. credential/security scan을 실행한다.
   - tracked file과 package tarball에 token-like value, `.env`, local auth path 없음
   - stdout/stderr snapshot에 raw token 없음
7. production handoff를 정리한다.
   - service default URL
   - npm publish provenance/2FA
   - distributed rate limiter
   - account deletion/retention
   - 메인 `/` landing/Quickstart 후속 issue

### 검증

```bash
npm test
npm run build
npm run test:e2e
npm pack --dry-run --workspace packages/codex-usage-profile-cli --json
git diff --check
```

수동/통합 시나리오:

```text
packed CLI -> device login -> GitHub approval -> analyzer -> account usage submit
           -> owner Profile -> publish -> stable README card -> ETag update
```

검증 관점:

- 실제 사용자 흐름이 source checkout 없이 packed CLI로 완료된다.
- raw token과 account usage value를 보고서/로그에 복사하지 않는다.
- local credential과 runtime store는 temporary path만 사용하고 종료 후 정리한다.
- #6 stable URL이 submit 이후 최신 card를 반환한다.
- production에서만 가능한 항목은 수행하지 않은 이유와 handoff를 명시한다.

### 커밋

```text
Task #5 Stage 5: packed CLI 통합과 보안 QA 완료
```

## 검증 운영

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- analyzer SDK, fetch, filesystem, clock, sleep을 주입해 unit test가 실제 credential과 network를 읽지 않게 한다.
- 실제 analyzer smoke는 작업지시자의 로컬 Codex 환경을 사용하되 usage 값, account id, token과 raw RPC를 출력·문서화하지 않는다.
- browser device approval은 사용자 session을 사용하므로 제출 또는 공개 전환 전에 현재 action을 명확히 알린다.
- 실제 GitHub OAuth smoke에는 local `.env`를 사용할 수 있지만 secret 값을 출력·commit하지 않는다.
- package tarball과 git tracked file은 별도로 credential scan한다.
- 구현 중 endpoint/body/version 정책 변경이 필요하면 구현계획서를 먼저 갱신하고 승인을 받는다.

## 단계 의존성

- Stage 2는 Stage 1의 submit/status HTTP contract가 고정된 뒤 진행한다.
- Stage 3은 Stage 2의 service client, credential과 device login 경계가 검증된 뒤 진행한다.
- 이전 analyzer workspace 제거는 npm dependency shadowing을 방지하기 위해 Stage 3 dependency 설치 직전에 수행한다.
- Stage 4는 Stage 3의 actual command/output/package dependency가 고정된 뒤 문서를 작성한다.
- Stage 5는 Stage 1~4 단계 보고서 승인 후 packed artifact로만 end-to-end를 검증한다.
- 후속 landing task는 #5의 실제 command, output과 account usage status contract를 소비한다.

## 위험과 대응

- **production URL 미정**: CLI는 explicit `--server`와 env를 우선 구현하고, package default가 없을 때 actionable error를 반환한다. publish task에서 URL을 확정한다.
- **npm workspace shadowing**: local analyzer 사본을 제거한 뒤 install하고 lockfile `resolved`/`integrity`를 검증한다.
- **root/CLI package 이름 중복**: root는 `private: true`, publish command는 workspace path를 명시하고 tarball name/bin을 검사한다.
- **credential file race/symlink**: owner-only directory, atomic rename, regular-file와 permission 확인으로 방어한다.
- **token 노출**: token argv 미지원, safe error mapping, stdout/stderr snapshot과 tarball scan으로 검증한다.
- **device poll 과다 호출**: server interval과 `Retry-After`를 준수하고 expiry 이후 즉시 중단한다.
- **replay race**: capturedAt+digest 비교를 submit service의 단일 저장 경계에서 수행한다. production distributed adapter는 conditional write가 필요하다.
- **rate limiter 다중 instance**: injectable process-local default만 구현하고 shared limiter requirement를 deployment handoff에 남긴다.
- **contract version rollout**: backend support를 먼저 배포하고 CLI analyzer version을 올리는 순서를 문서화한다.
- **account deletion 미지원**: 이번 task에 섞지 않고 privacy/deployment 후속 이슈로 등록한다.

## 승인 요청 사항

- 위 5개 Stage 분할과 Stage 1 구현 진입 승인을 요청한다.
- Stage 1은 Account Usage submit/status backend와 validator만 구현하고 CLI package는 Stage 2부터 추가한다.
- 이전 analyzer workspace 제거와 npm v0.2.0 dependency 전환은 shadowing 방지를 위해 Stage 3에서 함께 수행한다.
- 각 Stage 완료 후 `task-stage-report` 절차로 보고서와 commit을 만든 뒤 다음 승인 지점에서 멈춘다.
