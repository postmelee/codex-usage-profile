# CLI 로그인과 사용량 제출

`codex-usage-profile` CLI는 로컬 Codex account usage를 읽어 GitHub 계정에 연결된 Codex Usage Profile로 제출한다. GitHub identity는 웹 로그인으로만 결정하며 CLI usage document에는 이름, 사용자명, 아바타 또는 account id가 없다.

> production service URL은
> `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`로
> 확정됐고 CLI 기본값에도 반영돼 있다. public npm release는
> `codex-usage-profile@0.1.1`이며 provenance와 production end-to-end
> smoke가 검증됐다. 이 immutable patch는 macOS app bundle 자동 탐색을
> 제공한다. 자동화에서는 registry에서 검증한 exact version을 고정한다.

## 요구사항

- Node.js 20 이상
- `PATH`에서 실행 가능한 최신 Codex CLI, 또는 macOS의 표준 system/user
  `Applications` 위치에 설치된 `ChatGPT.app`/`Codex.app`
- `account/usage/read`를 지원하는 ChatGPT 기반 Codex 로그인
- 웹사이트에서 GitHub로 연결할 수 있는 계정
- 선택적 terminal star 안내를 사용하려면 로컬 `gh` CLI와 authenticated
  GitHub account

API key-only와 Bedrock 인증은 이 account usage method를 제공하지 않는다. CLI는 OpenAI 또는 Codex token을 입력받지 않고 설치된 Codex 프로세스에 인증을 위임한다.

## Quickstart

공개 package에서는 `submit` 한 번으로 credential이 없을 때 browser
login을 시작하고 승인 후 같은 명령에서 제출을 계속한다.

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

## 선택적 GitHub star 안내

새 device `login` 또는 human-readable `submit`이 내부적으로 성공하면 CLI는
기존 성공 결과를 출력하기 전에 local `gh`의 active account가
`postmelee/codex-usage-profile`을 star할지 별도 안내 블록으로 묻는다.

```text
Help us grow! 🌱
A GitHub star helps others discover Codex Usage Profile.
Would you like to star it on GitHub as @octocat? (Y/n)
✓ Starred! Thank you for your support, @octocat. ⭐
```

Enter, `y`, `yes`는 동의이며 Enter 기본값은 **Yes**다. `n`, `no`는 star하지
않고 원래 login 또는 submit 결과를 계속 표시한다. 다른 입력은 `y` 또는
`n`을 다시 묻는다. 동의하면 브라우저를 열지 않고 다음 고정 작업과 같은
local `gh api` 요청을 실행한다.

안내 블록 앞뒤에는 빈 줄을 둔다. color를 지원하는 TTY에서는 제목을 cyan,
설명을 흐린 회색, 성공 문구를 green으로 표시한다. `NO_COLOR`가 설정됐거나
`TERM=dumb`이면 문구와 간격은 유지하고 ANSI escape 없이 평문으로 출력한다.

```bash
gh api --silent --method PUT \
  /user/starred/postmelee/codex-usage-profile
```

prompt의 `@octocat`은 Codex Usage Profile owner가 아니라 local `gh`가 선택한
active GitHub account다. CLI는 제품의 GitHub OAuth token이나 service submit
credential을 이 작업에 사용하거나 `gh` credential을 읽어 저장하지 않는다.
이미 star한 account이면 질문을 생략한다.

다음 경우에는 prompt와 star 요청을 모두 생략한다.

- 유효한 credential 때문에 `Already signed in`만 출력하는 `login`
- 실패한 login 또는 submit, `status`, `logout`, help와 version
- `submit --json`, stdin/stdout 중 하나라도 TTY가 아닌 pipe·redirection
- `CI` 환경변수가 활성화된 unattended execution
- `gh` 미설치·미인증, active account 조회 실패, 권한·network·timeout 오류

credential이 없어서 submit 중 auto-login한 경우에는 login 경계가 아니라
submit 성공 경계에서 한 번만 묻는다. `gh` 상태 확인이나 star 요청이 실패해도
raw stderr를 출력하지 않고 원래 login/submit 결과와 exit status를 보존한다.

## Codex 실행 파일 탐색

`codex-usage-analyzer@0.4.1`이 실행 파일을 다음 순서로 찾는다.

1. 현재 `PATH`의 executable `codex`
2. `/Applications/ChatGPT.app/Contents/Resources/codex`
3. `/Applications/Codex.app/Contents/Resources/codex`
4. `~/Applications/ChatGPT.app/Contents/Resources/codex`
5. `~/Applications/Codex.app/Contents/Resources/codex`

2~5번 fallback은 macOS에서만 사용한다. 따라서 ChatGPT 또는 Codex
desktop app이 위 표준 위치에 있으면
`PATH="/Applications/ChatGPT.app/Contents/Resources:$PATH"` 같은 일회성
prefix 없이 `npx codex-usage-profile@latest submit`을 실행할 수 있다.

Linux, Windows와 비표준 macOS 설치 위치에서는 공식 Codex CLI를 설치해
`codex`가 `PATH`에서 실행되게 한다. 모든 후보가 없거나 executable
file이 아니면 analyzer는 안전한 `CODEX_NOT_FOUND`만 반환한다. 검사 중
발생한 filesystem 오류, 후보 경로와 원본 예외는 CLI 출력으로 전달하지
않는다.

## Automation / 비대화형 실행

비대화형 실행은 일반적인 GitHub Actions 환경이 아니라 다음 조건을 충족하는 신뢰할 수 있는 machine을 전제로 한다.

- 실행 가능한 Codex CLI와 ChatGPT 기반 로그인이 이미 준비됨
- 웹 Settings에서 발급한 service submit token을 secret manager로 주입함
- browser device login이 필요하지 않음
- CLI package를 `@latest`가 아닌 정확한 version으로 고정함

```bash
export CODEX_USAGE_PROFILE_URL=https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
export CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>'
npx --yes codex-usage-profile@0.1.1 submit --json
```

여기서 `--yes`는 npm의 package 설치 확인을 의도적으로 생략한다. unattended execution에서는 재현성과 공급망 변경 통제를 위해 정확한 CLI version을 고정하고, version 갱신은 별도 검토 후 수행한다. `CODEX_USAGE_PROFILE_TOKEN`은 repository variable이나 command argument가 아니라 접근이 제한된 secret으로 관리한다.

`submit --json`, non-TTY와 활성화된 `CI` 환경에서는 선택적 GitHub star
prompt가 실행되지 않으므로 stdout은 추가 문구 없는 단일 JSON document로
유지된다.

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
npx --package=./codex-usage-profile-0.1.1.tgz \
  codex-usage-profile --help
```

tarball 이름의 version은 package version에 따라 달라질 수 있다.

## Browser 승인 흐름

1. CLI가 `POST /api/auth/device`를 호출한다.
2. verification URL과 user code를 출력하고 브라우저 열기를 시도한다.
3. 사용자가 웹에서 GitHub 로그인 후 code를 승인한다.
4. CLI가 server가 지정한 interval과 expiry를 지키며 `POST /api/auth/device/poll`을 호출한다.

지원되는 interactive terminal에서는 verification URL 자체가 cyan OSC 8 hyperlink로 표시되어 클릭할 수 있다. `Open` label과 뒤따르는 출력은 terminal 기본색을 유지한다. 파이프 출력, `submit --json`, `NO_COLOR`, `TERM=dumb` 또는 hyperlink 지원 신호가 없는 terminal에는 ANSI control sequence 없이 같은 plain URL을 출력한다. 브라우저 자동 열기가 실패해도 plain URL과 user code는 항상 남는다.
5. 승인된 poll 응답에서 raw service token을 한 번만 받고 로컬 credential file에 저장한다.
6. `submit`에서 시작한 경우 즉시 analyzer와 usage submit을 이어서 실행한다.

승인 완료 화면의 안내는 CLI가 device flow를 시작할 때 보낸 intent에 따라
달라진다.

- `submit`에서 시작한 승인은 현재 실행 중인 CLI process로 돌아가면
  analyzer와 usage submit이 계속되며 최종 성공·실패는 terminal에서
  확인하라고 안내한다. 브라우저의 `Device approved`는 device 인증
  완료만 의미하며 usage submit 성공을 의미하지 않는다.
- 명시적인 `login`에서 시작한 승인은 로그인만 완료한다. 다음
  `npx codex-usage-profile@latest submit` 명령을 화면에 제공하며, 사용자가
  copy button을 눌렀을 때만 clipboard에 복사한다.
- intent를 보내지 않는 이전 CLI의 승인은 특정 명령을 제안하지 않고
  terminal로 돌아가라고 안내한다.

local 또는 기본값이 아닌 service에서 `login --server <origin>`을 사용한
경우, 승인 화면이 제공하는 다음 submit 명령에도 같은 normalized origin의
`--server`가 포함된다. user code, URL query와 hash는 명령에 포함되지
않는다.

승인 완료 후 브라우저는 Home이나 profile로 자동 이동하지 않고,
clipboard에 자동으로 쓰거나 명령을 실행하지 않는다. 완료 상태와
Home/Profile 링크를 유지하므로 사용자가 다음 행동을 직접 선택할 수 있다.

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

account별 active CLI/API token 한도는 3개다. 반복 first-run test처럼 local
`logout` 뒤 새 device login을 여러 번 수행하면 server token은 폐기되지 않아
한도에 도달할 수 있다. browser 승인은 완료됐지만 token exchange가 한도로
거부되면 CLI는 다음처럼 조치 가능한 message를 표시한다.

```text
Active token limit reached. Revoke an API token in Settings, then try again.
```

웹 Settings의 **API Tokens**에서 이전 `Device login` token을 하나 이상
**Revoke**한 뒤 새 code로 다시 실행한다. 이 message는 device-login poll의 HTTP
409 conflict에만 적용하며 Account Usage submit conflict 안내는 변경하지 않는다.

## 제출 결과와 README

성공한 `submit`은 accepted 또는 unchanged 상태, capture time, Profile URL, stable card URL과 README Markdown을 반환한다. raw token, owner numeric id, usage value 전체와 opaque private revision은 출력하지 않는다.

```text
✓ Usage submitted successfully.
Captured: 2026-07-11T00:00:00.000Z

Links
  Profile: https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/?view=profile
  Card:    https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/octocat/card.png
  README:  ![Codex usage profile](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/octocat/card.png)
```

성공 표시는 결과 시작점을 나타내고 capture metadata 뒤의 빈 줄과 들여쓴
`Links` block은 복사 가능한 산출물을 구분한다. 지원되는 interactive terminal에서
`Links` 제목은 bright black으로 낮춰 표시하고, `Profile`과 `Card`의 URL만 device
login의 `Open` URL과 같은 cyan OSC 8 hyperlink로 표시한다. `README` 값은 GitHub
README에 그대로 복사할 Markdown 산출물이므로 ANSI·OSC 8을 넣지 않은 exact
plain text를 유지한다. `submit --json`은 기존 JSON schema를 유지한다. pipe·redirection,
`NO_COLOR`, `TERM=dumb`, hyperlink 미지원 terminal에서는 같은 줄바꿈·들여쓰기
구조를 유지하되 적용할 수 없는 색상과 hyperlink 없이 평문으로 출력한다.

같은 document의 network ambiguity retry는 server idempotency를 이용해 한 번만 수행한다. 두 요청이 모두 실패하면 결과가 불명임을 표시하며 같은 document를 다시 제출해도 안전하다.

카드를 public으로 전환한 뒤 README Markdown을 GitHub에 넣는다. 이후 `submit`은 같은 URL의 ETag를 바꾸므로 README를 수정할 필요가 없다. GitHub image proxy 때문에 실제 표시 갱신은 지연될 수 있다. 자세한 내용은 [README 카드와 cache](readme-card.md)를 참고한다.

## 오류와 문제 해결

| 오류 | 확인 사항 |
|---|---|
| `CODEX_NOT_FOUND` | macOS 표준 app 위치를 확인하거나 공식 Codex CLI를 설치해 `PATH`에 노출 |
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
- 선택적 repository star는 local `gh` active account가 GitHub API에 직접
  수행하며 제품 OAuth 또는 submit credential과 분리된다.
- production Sites는 TLS, D1 shared rate limiter, durable D1/R2,
  backup/restore, operator deletion과 manual retention 정책을 사용한다.
