# CLI 로그인과 사용량 제출

`codex-usage-profile` CLI는 로컬 Codex account usage를 읽어 GitHub 계정에 연결된 Codex Usage Profile로 제출한다. GitHub identity는 웹 로그인으로만 결정하며 CLI usage document에는 이름, 사용자명, 아바타 또는 account id가 없다.

> production service URL은
> `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`로
> 확정됐고 CLI 기본값에도 반영돼 있다. npm package 공개는 #44에서 진행하므로
> 그 전에는 source checkout 또는 검토한 local tarball을 사용한다.

## 요구사항

- Node.js 20 이상
- `PATH`에서 실행 가능한 최신 Codex CLI
- `account/usage/read`를 지원하는 ChatGPT 기반 Codex 로그인
- 웹사이트에서 GitHub로 연결할 수 있는 계정

API key-only와 Bedrock 인증은 이 account usage method를 제공하지 않는다. CLI는 OpenAI 또는 Codex token을 입력받지 않고 설치된 Codex 프로세스에 인증을 위임한다.

## Quickstart

package가 npm에 공개된 뒤에는 `submit` 한 번으로 credential이 없을 때 browser login을 시작하고 승인 후 같은 명령에서 제출을 계속한다.

```bash
npx codex-usage-profile@latest submit
```

명시적으로 단계를 나눌 수도 있다.

```bash
npx codex-usage-profile@latest login
npx codex-usage-profile@latest submit
npx codex-usage-profile@latest status
```

CLI는 production Sites origin을 기본값으로 사용하고 첫 로그인에서 credential과 함께 저장한다. `--server`는 local development 또는 명시적으로 검토한 대체 deployment에만 사용한다. 첫 실행에서 npm이 설치할 package와 version을 표시하고 확인을 요청할 수 있으므로 두 값을 확인한 뒤 승인한다.

raw token을 command argument, URL 또는 shell history에 넣는 옵션은 제공하지 않는다.

## Automation / 비대화형 실행

비대화형 실행은 일반적인 GitHub Actions 환경이 아니라 다음 조건을 충족하는 신뢰할 수 있는 machine을 전제로 한다.

- 실행 가능한 Codex CLI와 ChatGPT 기반 로그인이 이미 준비됨
- 웹 Settings에서 발급한 service submit token을 secret manager로 주입함
- browser device login이 필요하지 않음
- CLI package를 `@latest`가 아닌 정확한 version으로 고정함

```bash
export CODEX_USAGE_PROFILE_URL=https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
export CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>'
npx --yes codex-usage-profile@0.1.0 submit --json
```

여기서 `--yes`는 npm의 package 설치 확인을 의도적으로 생략한다. unattended execution에서는 재현성과 공급망 변경 통제를 위해 정확한 CLI version을 고정하고, version 갱신은 별도 검토 후 수행한다. `CODEX_USAGE_PROFILE_TOKEN`은 repository variable이나 command argument가 아니라 접근이 제한된 secret으로 관리한다.

## 로컬과 tarball 검증

source checkout에서는 workspace bin을 직접 실행할 수 있다.

```bash
npm install
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js --help
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js login \
  --server http://127.0.0.1:5177
```

publish 전 package artifact는 tarball로 검증한다.

```bash
npm pack --workspace packages/codex-usage-profile-cli
npx --package=./codex-usage-profile-0.1.0.tgz \
  codex-usage-profile --help
```

tarball 이름의 version은 package version에 따라 달라질 수 있다.

## Browser 승인 흐름

1. CLI가 `POST /api/auth/device`를 호출한다.
2. verification URL과 user code를 출력하고 브라우저 열기를 시도한다.
3. 사용자가 웹에서 GitHub 로그인 후 code를 승인한다.
4. CLI가 server가 지정한 interval과 expiry를 지키며 `POST /api/auth/device/poll`을 호출한다.

지원되는 interactive terminal에서는 verification URL 자체가 cyan OSC 8 hyperlink로 표시되어 클릭할 수 있다. `Open` label과 뒤따르는 출력은 terminal 기본색을 유지한다. 파이프 출력, `submit --json`, `TERM=dumb` 또는 hyperlink 지원 신호가 없는 terminal에는 ANSI control sequence 없이 같은 plain URL을 출력한다. 브라우저 자동 열기가 실패해도 plain URL과 user code는 항상 남는다.
5. 승인된 poll 응답에서 raw service token을 한 번만 받고 로컬 credential file에 저장한다.
6. `submit`에서 시작한 경우 즉시 analyzer와 usage submit을 이어서 실행한다.

브라우저 자동 열기가 실패해도 출력된 URL과 code로 계속 진행할 수 있다. `429` 응답은 `Retry-After`를 따르며 expiry 이후 polling을 중단한다.

## 명령과 옵션

| 명령 | 동작 |
|---|---|
| `login` | 기존 credential을 확인하고 필요하면 device login 시작 |
| `submit` | 필요 시 로그인, account usage 분석, downstream 제출 |
| `status` | 연결된 handle, token metadata, 최신 제출 시각과 profile URL 확인 |
| `logout` | 로컬 credential file 삭제 |

| 옵션 | 적용 | 설명 |
|---|---|---|
| `--server <origin>` | login, submit, status | service origin. HTTPS 필수이며 HTTP는 loopback만 허용 |
| `--timeout <ms>` | login, submit, status | 1~120000ms. analyzer와 service request timeout |
| `--json` | submit, status | allowlist된 machine-readable metadata 출력 |
| `--help` | 전체 | app-server를 시작하지 않고 help 출력 |
| `--version` | 전체 | app-server를 시작하지 않고 version 출력 |

file credential은 발급한 service origin에 묶인다. 다른 `--server` 또는 `CODEX_USAGE_PROFILE_URL`로 `status`를 실행하면 token을 전송하기 전에 거부한다. 새 origin에서 `login`하면 새 인증 흐름을 시작한다.

## 전송되는 데이터

CLI dependency로 설치된 `codex-usage-analyzer`의 `readAccountUsage()`가 Account Usage Contract v1을 반환한다. CLI는 complete shape를 다시 검증한 뒤 wrapper 없이 document 자체를 `POST /api/account-usage/submit` body로 보낸다.

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

예시 값은 실제 계정과 무관한 synthetic data다. `null`은 unavailable이며 zero로 바꾸지 않는다. `dailyUsageBuckets: null`과 `[]`도 서로 다른 의미를 유지한다.

추가 request metadata:

| 위치 | 값 |
|---|---|
| `Authorization` | 웹 서비스가 발급한 narrow Bearer submit token |
| `x-codex-usage-profile-device-id` | 로컬에서 생성한 stable random device id |
| `x-codex-usage-profile-device-name` | machine display name |

CLI가 전송하지 않는 값:

- OpenAI/Codex access token, refresh token, cookie, API key와 로컬 인증 파일
- GitHub OAuth token, 이름, login, avatar, email과 account id
- prompt, response, tool input/output와 로컬 session file
- profile visibility, public handle, image URL, README Markdown와 private revision
- raw app-server RPC, stderr와 로컬 filesystem path

GitHub identity와 visibility는 웹 서비스의 authenticated owner record만 신뢰한다.

## Credential 저장

기본 credential file:

| OS | 위치 |
|---|---|
| macOS | `~/Library/Application Support/codex-usage-profile/credentials.json` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/codex-usage-profile/credentials.json` |
| Windows | `%APPDATA%\\codex-usage-profile\\credentials.json` |

macOS와 Linux에서는 directory `0700`, file `0600`을 사용한다. 저장은 temporary file 작성 후 atomic rename으로 교체하며 symlink, 비정상 file type과 과도하게 열린 permission을 거부한다. 저장 값은 service token, service origin, token record id와 stable device id로 제한된다.

`CODEX_USAGE_PROFILE_TOKEN`이 있으면 file token보다 우선하고 환경 token 자체는 디스크에 기록하지 않는다. stable device id만 token 없는 metadata state로 저장할 수 있다. `logout`은 file만 삭제하므로 환경변수는 shell에서 직접 unset해야 한다.

token 또는 machine을 더 이상 신뢰하지 않으면 웹 Settings의 API Tokens에서 즉시 **Revoke**한다. revoked token의 다음 submit은 거부된다.

## 제출 결과와 README

성공한 `submit`은 accepted 또는 unchanged 상태, capture time, Profile URL, stable card URL과 README Markdown을 반환한다. raw token, owner numeric id, usage value 전체와 opaque private revision은 출력하지 않는다.

```text
Usage submitted successfully.
Captured: 2026-07-11T00:00:00.000Z
Profile: https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/profile
Card: https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/octocat/card.png
README: ![Codex usage profile](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/octocat/card.png)
```

같은 document의 network ambiguity retry는 server idempotency를 이용해 한 번만 수행한다. 두 요청이 모두 실패하면 결과가 불명임을 표시하며 같은 document를 다시 제출해도 안전하다.

카드를 public으로 전환한 뒤 README Markdown을 GitHub에 넣는다. 이후 `submit`은 같은 URL의 ETag를 바꾸므로 README를 수정할 필요가 없다. GitHub image proxy 때문에 실제 표시 갱신은 지연될 수 있다. 자세한 내용은 [README 카드와 cache](readme-card.md)를 참고한다.

## 오류와 문제 해결

| 오류 | 확인 사항 |
|---|---|
| `CODEX_NOT_FOUND` | Codex 설치와 `PATH` 확인 |
| `APP_SERVER_START_FAILED`, `APP_SERVER_EXITED` | 설치된 Codex가 `codex app-server`를 시작할 수 있는지 확인 |
| `APP_SERVER_TIMEOUT` | connectivity 확인 후 timeout 범위 안에서 재시도 |
| `APP_SERVER_RPC_ERROR` | Codex update와 ChatGPT 기반 로그인 확인 |
| `APP_SERVER_PROTOCOL_ERROR`, `INVALID_ACCOUNT_USAGE_RESPONSE` | Codex와 analyzer package update |
| HTTP `401`, `410` | credential이 invalid/expired/revoked. file은 자동 삭제하지 않으므로 다시 login |
| HTTP `409` | stored revision보다 오래되었거나 같은 timestamp의 내용 충돌 |
| HTTP `429` | 출력된 retry delay 이후 다시 실행 |
| HTTP `413`, `415` | CLI와 service contract version 불일치 가능성 확인 |

CLI는 raw upstream stderr, RPC message, local path와 service error body를 그대로 출력하지 않는다. 버그 보고에는 CLI version, analyzer version, Codex version, Node.js version, OS, safe error code만 포함한다.

## 보안 경계

- 웹 서비스는 Codex/OpenAI credential을 요구하지 않는다.
- analyzer는 설치된 Codex 프로세스에 인증을 위임한다.
- submit token은 한 GitHub owner의 usage update에만 사용한다.
- usage document의 identity/device/wrapper/unknown field는 거부된다.
- public card visibility는 CLI가 아니라 웹 profile 설정에서만 변경한다.
- production Sites는 TLS, D1 shared rate limiter, durable D1/R2,
  backup/restore, operator deletion과 manual retention 정책을 사용한다.
