# Task M100 #5 수행계획서

GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
마일스톤: M100

## 목적

사용자가 `npx codex-usage-profile@latest submit`으로 현재 Codex 계정 사용량을 수집해 자신의 GitHub 계정에 연결된 Profile 서비스로 제출할 수 있게 한다. 최초 실행은 기존 device-code login API로 GitHub account binding과 submit token 발급을 완료하고, 이후 실행은 저장 token을 재사용한다.

로컬 사용량 수집은 별도 npm package `codex-usage-analyzer` v0.2.0의 `readAccountUsage()` SDK에 위임한다. profile CLI와 backend는 identity-free Account Usage Contract v1만 전달·검증하며, GitHub identity, 인증, device, 저장, 공개 설정, card URL과 README Markdown은 downstream인 이 서비스가 소유한다.

## 배경

선행 #17은 `POST /api/auth/device`, browser approval과 poll token exchange를 구현했고, #15/#27은 downstream submit token과 device 관리 및 active token 제한을 구현했다. #6은 GitHub owner와 `latestUsages`를 병합해 private preview, public README PNG, ETag와 Share UX를 구현했다. 현재 남은 단절은 실제 CLI가 analyzer contract를 얻어 `latestUsages`에 저장하는 경로다.

기존 #5 계획은 workspace 내부 analyzer와 UsageSnapshot v2를 전제로 했으나 현재 canonical analyzer는 독립 npm package v0.2.0이다. 이 package는 공식 Codex app-server `account/usage/read`를 호출하고 다음 identity-free Account Usage Contract v1을 반환한다.

```json
{
  "contractVersion": 1,
  "capturedAt": "2026-07-11T00:00:00.000Z",
  "summary": {
    "lifetimeTokens": 1234567890,
    "peakDailyTokens": 45600000,
    "longestRunningTurnSec": 754,
    "currentStreakDays": 3,
    "longestStreakDays": 21
  },
  "dailyUsageBuckets": []
}
```

참조 문서:

- [Downstream Integration Guide](https://github.com/postmelee/codex-usage-analyzer/blob/main/docs/downstream-integration.md)
- [Account Usage Contract](https://github.com/postmelee/codex-usage-analyzer/blob/main/docs/account-usage-contract.md)
- [codex-usage-analyzer npm package](https://www.npmjs.com/package/codex-usage-analyzer)

`codex-usage-profile` npm 이름은 현재 registry 조회에서 존재하지 않았고, `codex-usage-analyzer@0.2.0`은 Node.js 20 이상, ESM SDK export와 CLI bin이 게시된 상태다.

## 범위

### 포함

- publish 가능한 전용 CLI workspace package와 `codex-usage-profile` bin
- `submit`, `login`, `status`, `logout`, `--help`, `--version` command
- `codex-usage-analyzer@^0.2.0`의 `readAccountUsage({ timeoutMs })` SDK 연동
- 기존 `packages/codex-usage-analyzer` workspace 사본 제거와 standalone npm dependency 전환
- Account Usage Contract v1의 downstream 재검증
  - exact keys와 `contractVersion: 1`
  - nullable summary와 `dailyUsageBuckets: null | [] | rows` 보존
  - safe integer, 날짜, 중복 bucket, 미래 `capturedAt` 검사
- Account Usage 전용 authenticated submit endpoint
  - exact contract document body
  - Bearer token owner binding
  - JSON content type와 64 KiB body limit
  - stale/replay/idempotent retry 정책
- contract 밖의 downstream device metadata 전달·저장
- #17 device start/poll/approval 연동과 poll interval 준수
- submit token 환경 변수 override와 owner-only local credential file 저장·삭제
- `CodexUsageError.code`, auth/network/server/contract 오류의 안전한 CLI message와 exit code
- submit 성공 후 owner Profile URL, stable card URL, README Markdown 출력
- submit 후 `latestUsages`, submitted device timestamp, #6 card ETag/PNG 갱신 연결
- CLI/API/privacy/security 사용자 문서와 package tarball preflight
- mock analyzer/backend와 실제 package API를 사용하는 자동·수동 통합 검증

### 제외

- Codex app-server protocol, raw RPC 또는 credential reader 재구현
- 로컬 session/log/auth file 스캔
- Account Usage Contract에 identity, device, visibility, card URL을 추가하는 변경
- OpenAI/ChatGPT/Codex/GitHub credential 업로드
- GitHub OAuth/session, device approval, Settings token/device UI 재구현
- 기존 UsageSnapshot v1/v2 public profile endpoint 제거
- GitHub README 파일 자체 commit/push
- plugin/skill metadata: #8
- account deletion·backup retention 전체 정책: 별도 privacy/deployment task
- npm registry publish 실행, production deployment와 production 기본 service URL 확정
- 메인 `/` 랜딩과 Quickstart UI: #5 완료 후 별도 task

## 설계 방향

- 전용 workspace는 `packages/codex-usage-profile-cli`에 두고 package name과 bin을 `codex-usage-profile`로 지정한다. root web app은 계속 `private: true`를 유지한다.
- CLI는 analyzer subprocess stdout을 parsing하지 않고 typed SDK `readAccountUsage()`를 직접 호출한다. analyzer의 stable `CodexUsageError.code`만 사용자-facing 오류 분기에 사용하고 raw app-server stderr/RPC payload는 출력하지 않는다.
- backend는 `POST /api/account-usage/submit`을 추가한다. body는 Account Usage Contract 문서 자체이며 username, owner id, visibility 또는 device wrapper를 받지 않는다.
- device metadata는 usage contract를 오염시키지 않도록 product-namespaced HTTP header로 전달한다. server는 길이·문자열을 제한하고 existing submitted device service에만 전달한다.
- valid contract는 `capturedAt`과 `contractVersion`을 record metadata로, `summary`와 `dailyUsageBuckets`를 #6 card service가 이미 소비하는 `usage`로 저장한다.
- 더 오래된 `capturedAt`은 conflict로 거부한다. 같은 timestamp와 같은 content는 idempotent 성공, 같은 timestamp의 다른 content는 conflict로 처리한다.
- `capturedAt`은 server 현재보다 최대 5분 앞선 값까지만 허용한다. source date인 bucket `startDate`는 timezone rebucketing하지 않는다.
- credential precedence는 `CODEX_USAGE_PROFILE_TOKEN` 환경 변수, local credential file 순이다. token은 command argument, URL, stdout/stderr, logs에 넣지 않는다.
- local credential 위치는 OS config directory를 사용하고 directory `0700`, file `0600`을 적용한다. permission을 보장할 수 없는 환경에서는 명확히 실패하고 환경 변수 사용을 안내한다.
- service URL precedence는 `--server`, `CODEX_USAGE_PROFILE_URL`, package default 순으로 설계한다. 이번 task의 local/tarball smoke는 명시적 local `--server`를 사용하며 production default URL은 배포 task에서 확정한다.
- `logout`은 local credential을 삭제한다. server-side 즉시 revoke는 Settings의 기존 revoke UI/API로 제공하며 CLI에는 token을 body나 URL에 다시 노출하는 별도 revoke flow를 추가하지 않는다.
- existing UsageSnapshot submit path는 호환성을 위해 유지한다. 새 CLI와 README card는 account usage path만 사용한다.
- request body limit과 rate-limit은 HTTP/service 경계에서 주입 가능하게 구현한다. process-local 기본 limiter의 다중 instance 한계는 deployment handoff에 기록한다.

## 문서 위치 판단

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
|---|---|---|---|---|---|
| `docs/cli-submit.md` | 공식 사용자 문서 | CLI 사용자 | `docs/` | `README.md` 단독 | login, token, submit, 오류와 privacy를 상세히 설명하는 제품 사용 계약 |
| `README.md` | 공식 진입 안내 | 사용자와 기여자 | 저장소 루트 | `docs/cli-submit.md` 단독 | 최소 Quickstart와 상세 문서 링크를 발견 가능하게 배치 |
| `docs/codex-usage-analyzer.md` | 공식 통합 문서 | 기여자·downstream 개발자 | `docs/` | 삭제 | 기존 workspace/UsageSnapshot 설명을 standalone v0.2.0 경계로 갱신할 필요가 있음 |
| `mydocs/plans/task_m100_5*.md`와 단계·최종 보고서 | 작업 산출물 | 내부 작업자 | `mydocs/` | `docs/` | 승인, 구현 단계와 검증 기록은 제품 문서와 분리 |

## 예상 변경 파일

신규:

- `packages/codex-usage-profile-cli/package.json`
- `packages/codex-usage-profile-cli/bin/codex-usage-profile.js`
- `packages/codex-usage-profile-cli/src/*.js`
- `packages/codex-usage-profile-cli/test/*.test.js`
- `src/profile-backend/account-usage-submit.js`
- `src/profile-backend/__tests__/account-usage-submit.test.js`
- `docs/cli-submit.md`

수정:

- `package.json`
- `package-lock.json`
- `src/profile-backend/http.js`
- `src/profile-backend/index.js`
- `src/profile-backend/devices.js`
- `src/profile-backend/store.js`, 필요한 경우
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `src/profile-card/account-usage.js`
- `src/profile-card/__tests__/account-usage.test.js`
- `README.md`
- `docs/codex-usage-analyzer.md`

삭제:

- `packages/codex-usage-analyzer/**`

이번 task 산출물:

- `mydocs/orders/20260713.md`
- `mydocs/plans/task_m100_5.md`
- `mydocs/plans/task_m100_5_impl.md`
- `mydocs/working/task_m100_5_stage{1..5}.md`
- `mydocs/report/task_m100_5_report.md`

## 잠정 단계

- **Stage 1 — Account Usage Contract와 submit backend**
  - contract validator, authenticated endpoint, body limit, stale/replay와 latest usage/device 저장을 구현한다.
  - owner binding, null/date semantics, secret rejection과 card ETag 변경을 backend test로 고정한다.
- **Stage 2 — CLI package와 device login·credential 경계**
  - 전용 workspace, command parser, service client, device poll, config/credential store와 login/status/logout을 구현한다.
  - raw token one-time 처리, permission, polling, safe error와 local logout을 검증한다.
- **Stage 3 — analyzer SDK submit orchestration**
  - analyzer dependency, `readAccountUsage()`, submit command, device metadata와 성공 URL/Markdown 출력을 연결한다.
  - analyzer error code, auth retry, contract·HTTP 실패와 secret 미노출을 검증한다.
- **Stage 4 — package 전환과 사용자 문서**
  - 이전 workspace analyzer 사본을 제거하고 lockfile을 npm v0.2.0 dependency로 전환한다.
  - README, CLI 문서, analyzer integration 문서를 갱신하고 `npm pack --dry-run`을 검증한다.
- **Stage 5 — end-to-end smoke와 최종 보안 QA**
  - local runtime, tarball CLI, device approval, 실제 또는 opt-in analyzer usage submit, Profile/card 갱신을 검증한다.
  - 전체 test/build, package contents, credential scan과 배포 handoff를 정리한다.

## 검증 계획

### 단계별 검증

- Stage 1
  - `node --test src/profile-backend/__tests__/account-usage-submit.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js src/profile-card/__tests__/account-usage.test.js src/profile-card/__tests__/service.test.js`
- Stage 2
  - `node --test packages/codex-usage-profile-cli/test/*.test.js src/profile-backend/__tests__/http.test.js`
- Stage 3
  - `node --test packages/codex-usage-profile-cli/test/*.test.js src/profile-backend/__tests__/account-usage-submit.test.js src/profile-backend/__tests__/http.test.js`
- Stage 4
  - `npm install`
  - `npm pack --dry-run --workspace packages/codex-usage-profile-cli`
  - `npm test`
  - `npm run build`
- Stage 5
  - local runtime + packed CLI device login/submit smoke
  - 실제 analyzer SDK `readAccountUsage()` opt-in smoke
  - `npm test`
  - `npm run build`
  - `git diff --check`

### 통합 검증

- 신규 사용자는 CLI에서 device login을 시작하고 브라우저 GitHub session으로 승인할 수 있다.
- 승인 후 raw downstream token은 한 번만 수령되고 owner-only credential file 또는 환경 변수로만 사용된다.
- `submit`은 analyzer SDK가 반환한 Account Usage Contract v1만 backend에 전송한다.
- payload에는 identity, OpenAI/Codex/GitHub credential, device/card metadata가 없다.
- backend는 Bearer token owner의 `latestUsages`와 submitted device를 갱신한다.
- submit 이후 같은 stable card URL의 ETag와 PNG가 변경된다.
- null daily usage와 nullable summary가 0으로 변환되지 않는다.
- stale/future/replayed/unsupported contract와 revoked token은 안전하고 구분 가능한 오류를 반환한다.
- 성공 출력에는 Profile URL, image URL과 README Markdown이 있고 token은 없다.
- packed CLI가 Node.js 20 이상에서 `--help`, `--version`, `login`, `status`, `logout`, `submit`을 실행한다.
- `git status --short`가 PR 준비 전 빈 출력이다.
- `git diff --check`가 경고 없이 통과한다.

## 리스크

- **production service URL 미정**: 실제 registry publish 전 package default URL이 필요하다. 이번 task는 `--server`와 환경 변수로 local/tarball E2E를 검증하고 배포 task에 결정 사항을 넘긴다.
- **두 submit model 공존**: 기존 UsageSnapshot path와 Account Usage path가 동시에 존재한다. endpoint와 store를 분리하고 card CLI가 새 path만 사용하도록 테스트한다.
- **workspace dependency shadowing**: 기존 analyzer workspace가 npm v0.2.0을 가릴 수 있다. Stage 4에서 사본을 제거하고 lockfile resolved package를 검증한다.
- **credential file 노출**: permission 보장이 실패하면 저장하지 않고 환경 변수 사용을 안내한다. raw token은 로그·오류·test snapshot에 포함하지 않는다.
- **device polling 과다 요청**: server `intervalSeconds`를 준수하고 rate-limit/slow-down 응답에서 backoff한다.
- **stale/replay 경쟁**: owner별 latest capturedAt과 content digest를 비교해 idempotent retry와 conflict를 명확히 분리한다.
- **process-local rate limit**: 단일 runtime에서는 보호되지만 다중 instance 공통 제한은 production adapter에서 외부 store로 교체해야 한다.
- **실제 analyzer 환경 차이**: Codex 미설치, API-key-only/Bedrock, old app-server와 timeout을 stable analyzer error code로 안내한다.
- **account deletion 부재**: token revoke와 public disable은 있지만 identity/usage 완전 삭제는 별도 privacy/deployment 이슈가 필요하다.

## 승인 요청 사항

- standalone `codex-usage-analyzer@^0.2.0` SDK를 canonical usage reader로 사용하고 이전 workspace 사본을 제거한다.
- backend submit body는 Account Usage Contract v1 문서 자체로 고정하고 identity/device/public field를 포함하지 않는다.
- 새 endpoint는 `/api/account-usage/submit`, existing UsageSnapshot endpoint는 호환용으로 유지한다.
- device metadata는 product-namespaced HTTP header로 분리한다.
- stale/replay 정책은 older conflict, same timestamp+same content idempotent success, same timestamp+different content conflict로 고정한다.
- local credential은 환경 변수 우선, owner-only OS config file fallback으로 저장한다.
- production 기본 URL과 실제 npm publish는 제외하고, 이번 task는 `--server`/환경 변수와 packed tarball로 end-to-end를 닫는다.
- 메인 `/` 랜딩·Quickstart는 #5 완료 후 별도 task로 진행한다.

승인되면 `task_m100_5_impl.md`에서 단계별 산출물, 검증 명령, commit 메시지를 구체화한다.
