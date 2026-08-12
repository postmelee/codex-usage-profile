# Task #91 구현계획서 — CLI GitHub star 프롬프트

수행계획서: [`task_m100_91.md`](task_m100_91.md)
GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | GitHub star prompt core와 fail-soft 경계 | `src/github-star.js`, `test/github-star.test.js` | focused Node test |
| 2 | login·submit 성공 흐름 통합 | `src/cli.js`, `test/cli.test.js` | CLI package test |
| 3 | 사용자 문서와 package 통합 검증 | `docs/cli-submit.md`, CLI package `README.md` | package/root/smoke/release 검증 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/cli-submit.md` | `docs/` | `docs/cli-submit.md` | OK | 기존 canonical CLI·보안 guide의 login/submit 절을 최소 수정한다. |
| `packages/codex-usage-profile-cli/README.md` | CLI package root | `packages/codex-usage-profile-cli/README.md` | OK | npm package 사용자가 배포물 안에서 optional `gh` 동작을 확인하게 한다. |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_91_stage{N}.md` | OK | 제품 문서가 아닌 단계별 구현·검증 증적이다. |

새 공식 문서를 만들거나 이동하지 않는다. repository root `README.md`와 `mydocs/manual/`은 수행계획서의 위치 판단대로 변경하지 않는다.

## 공통 구현 경계

- star 대상은 `postmelee/codex-usage-profile`로 고정하고 사용자 입력을 executable 또는 argument에 포함하지 않는다.
- GitHub 작업은 제품 OAuth token이나 submit credential이 아닌 로컬 `gh` active account로만 실행한다.
- prompt는 stdin과 stdout이 모두 TTY이고 JSON 출력이 아닐 때만 허용한다. 조건을 충족하지 않으면 `gh` process도 시작하지 않는다.
- `gh`는 shell 없이 Node child process API의 executable과 argument array로 실행한다. 각 호출은 5초 timeout과 제한된 output buffer를 사용한다.
- active account 조회나 star 상태를 확정할 수 없으면 prompt를 생략한다. 이미 starred이면 생략하고, GET이 명시적으로 HTTP 404를 반환한 경우에만 질문한다.
- `gh` 미설치·미인증·권한 부족·network·timeout·PUT 실패와 prompt helper 자체의 예외는 원래 login/submit 성공 및 exit status를 바꾸지 않는다.
- raw `gh` stderr·응답 body·GitHub token·submit credential은 terminal output이나 test failure message에 포함하지 않는다.
- 빈 입력·`y`·`yes`는 동의, `n`·`no`는 거절로 해석한다. 다른 입력은 허용값을 다시 묻고 mutation하지 않는다.

## Stage 1 — GitHub star prompt core와 fail-soft 경계

### 산출물

신규:

- `packages/codex-usage-profile-cli/src/github-star.js`
- `packages/codex-usage-profile-cli/test/github-star.test.js`
- `mydocs/working/task_m100_91_stage1.md`

### 변경 내용

- 고정 repository metadata, GET/PUT endpoint, subprocess timeout과 output 상한을 module 상수로 정의한다.
- `maybePromptGithubStar()`를 구현하고 input, output, JSON 여부, `gh` runner와 prompt reader를 주입할 수 있게 구성한다.
- eligible TTY 여부를 가장 먼저 판단해 비TTY와 JSON에서는 subprocess 및 prompt가 전혀 실행되지 않게 한다.
- `gh api user --jq .login`으로 active account를 조회하고 유효한 login을 얻은 경우에만 이후 단계를 진행한다.
- `gh api --silent --method GET /user/starred/postmelee/codex-usage-profile`의 exit 결과를 starred, 명시적 HTTP 404 not-starred, unknown failure로 분류한다.
- not-starred일 때 active `@login`, 고정 repository와 `(Y/n)`을 포함한 prompt를 표시한다.
- Enter·`y`·`yes` 응답에서 `gh api --silent --method PUT /user/starred/postmelee/codex-usage-profile`을 한 번 호출하고, `n`·`no`에서는 호출하지 않는다.
- 예상하지 못한 입력은 재질문하며 EOF 또는 I/O failure는 거절과 동일하게 fail-soft 처리한다.
- 직접 child process runner는 shell을 사용하지 않고 timeout·output 제한을 적용한다. 외부 오류는 내부 상태로 정규화하고 raw 오류 내용을 출력하지 않는다.
- focused test는 실제 `gh`를 실행하지 않고 주입된 runner와 prompt reader로 eligibility, command argument, account 표시, 기존 star 생략, 기본 Yes, 명시적 No, invalid input 재질문과 모든 fail-soft 경로를 검증한다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
git diff --check
```

### 완료 조건

- Enter 입력이 고정 PUT endpoint 한 번으로 이어지고 `n`은 mutation 없이 종료된다.
- 이미 starred, unavailable `gh`, 인증·network·timeout·unknown GET 실패는 질문이나 throw 없이 종료된다.
- 비TTY와 JSON 조건에서는 `gh` runner를 호출하지 않는다.
- 테스트가 로컬 GitHub 계정이나 실제 repository star 상태를 읽거나 변경하지 않는다.

### 커밋

```text
Task #91 Stage 1: GitHub star prompt core 구현
```

## Stage 2 — login·submit 성공 흐름 통합

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`

신규:

- `mydocs/working/task_m100_91_stage2.md`

### 변경 내용

- `runCli()`의 기본 stdin을 `process.stdin`으로 설정하고 test가 stdin을 주입할 수 있게 한다.
- `maybePromptGithubStar`도 option으로 주입할 수 있게 해 CLI orchestration test가 실제 `gh`나 readline을 실행하지 않게 한다.
- 신규 `login`은 device login이 resolve된 뒤, 기존 `Login complete.` 출력 전에 helper를 await한다.
- 유효한 기존 credential로 `Already signed in`을 출력하는 login shortcut에는 helper를 호출하지 않는다.
- `submit`은 `submitAccountUsage()` 성공 결과를 확보한 뒤, `writeSubmitOutput()` 호출 전에 helper를 한 번 await한다.
- auto-login이 포함된 submit에서도 login 경계가 아니라 submit 성공 경계에서만 한 번 질문한다.
- `submit --json`은 helper를 호출하지 않아 stdout이 parse 가능한 단일 JSON document로 유지되게 한다.
- stdin/stdout TTY 여부, JSON flag와 I/O를 Stage 1 helper에 전달하고 helper failure를 흡수해 기존 성공 결과와 exit code를 보존한다.
- CLI test에 prompt 호출 순서, 응답 전에 성공 결과가 출력되지 않는 경계, fresh login, existing-login shortcut, human submit, auto-login single prompt, JSON·비TTY 생략, helper rejection fail-soft 회귀를 추가한다.

### 검증

```bash
npm --workspace packages/codex-usage-profile-cli test
git diff --check
```

### 완료 조건

- fresh login과 성공한 interactive human submit에서만 결과 출력 직전에 helper가 호출된다.
- prompt가 resolve되기 전에는 `Login complete.` 또는 submit 결과가 출력되지 않는다.
- auto-login submit은 한 번만 호출되고 shortcut login, JSON, 비TTY, 실패한 login/submit에서는 호출되지 않는다.
- helper failure 이후에도 기존 결과 내용과 exit code가 유지되며 secret이 출력되지 않는다.

### 커밋

```text
Task #91 Stage 2: login과 submit에 star prompt 연결
```

## Stage 3 — 사용자 문서와 package 통합 검증

### 산출물

수정:

- `docs/cli-submit.md`
- `packages/codex-usage-profile-cli/README.md`

신규:

- `mydocs/working/task_m100_91_stage3.md`

### 변경 내용

- official CLI guide의 login·submit 흐름에 성공 결과 직전 optional GitHub star prompt를 설명한다.
- `(Y/n)`에서 Enter가 Yes임과 active local `gh` account가 star 주체임을 명시한다.
- 로컬 `gh` 미설치·미인증·권한·network 실패가 제품 login/submit을 실패시키지 않는 fail-soft 경계를 설명한다.
- 이미 starred, non-TTY, pipe/redirection, CI, `submit --json`, 기존 login shortcut과 실패 경로에서는 prompt가 나오지 않음을 문서화한다.
- 제품 OAuth/submit credential을 GitHub star에 사용하거나 저장하지 않으며 브라우저를 열지 않는다는 보안 경계를 기록한다.
- npm package README에도 동일한 핵심 계약과 local `gh` optional requirement를 간결하게 반영한다.
- package test, root test, local npm package smoke, public release surface scan을 실행해 package contents와 기존 계약을 검증한다.

### 검증

```bash
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

### 완료 조건

- 공식 CLI guide와 배포 package README가 실제 구현의 적용·제외 조건, 기본 Yes와 active account 경계를 일치하게 설명한다.
- package/root test와 local package smoke가 모두 통과한다.
- public release scan에서 credential, token, raw stderr 또는 내부 task 문서가 배포 surface에 새로 노출되지 않는다.
- 전체 변경이 승인된 수행계획 범위와 문서 위치 판단을 벗어나지 않는다.

### 커밋

```text
Task #91 Stage 3: star prompt 문서화와 통합 검증
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 외부 GitHub mutation이 가능한 test는 작성하지 않으며 모든 `gh` 동작을 fake runner로 검증한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 각 단계 완료 시 `task-stage-report` 절차로 단계 보고서를 작성하고 단계 산출물과 함께 커밋한 뒤 다음 단계 승인을 요청한다.
- 계획 변경이 필요하면 이 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_91_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #91 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 구현계획서 승인 전에 제품 소스·test·공식 사용자 문서를 수정하지 않는다.

## 단계 의존성

- Stage 2는 Stage 1의 helper API와 fail-soft 동작이 검증되고 Stage 1 보고서가 승인된 뒤 진행한다.
- Stage 3은 Stage 2의 login·submit 통합 검증과 보고서가 승인된 뒤 진행한다.
- Stage 3 완료 뒤 전체 task 검증 결과를 확인하고 `task-final-report` 절차로 최종 보고서와 PR 게시를 진행한다.

## 위험과 대응

- **Enter의 외부 mutation**: `(Y/n)`과 active `@account`, 대상 repository를 한 prompt에 표시하고 TTY에서 보인 질문에만 Enter 기본 Yes를 적용한다.
- **제품 계정과 `gh` 계정 불일치**: 제품 credential을 재사용하지 않고 active `gh` account를 조회·표시하며 문서에도 star 주체를 분리해 설명한다.
- **상태 확인 오류를 not-starred로 오인**: HTTP 404만 질문 가능한 not-starred로 분류하고 인증·권한·network·timeout 오류는 모두 prompt 생략으로 처리한다.
- **optional subprocess 지연**: 각 `gh` call을 5초로 제한하고 unknown 상태에서는 결과 출력으로 계속 진행한다.
- **JSON과 automation 오염**: TTY/JSON gate를 subprocess보다 먼저 적용하고 CLI test에서 helper 호출 여부와 JSON parsing을 함께 검증한다.
- **shell injection과 secret 노출**: shell을 사용하지 않고 고정 argument array만 전달하며 raw child process 오류를 terminal이나 assertion output에 반영하지 않는다.
- **플랫폼 차이**: shell 문법이나 browser open에 의존하지 않고 missing executable을 정상적인 optional-unavailable 상태로 다룬다.

## 승인 요청 사항

- Stage 1 core·fail-soft, Stage 2 login/submit 통합, Stage 3 문서·통합 검증의 산출물과 의존성
- HTTP 404만 not-starred로 간주하고 5초 timeout의 모든 unknown `gh` failure를 prompt 생략으로 처리하는 경계
- Enter·`y`·`yes`를 동의로 해석하고 잘못된 입력을 재질문하는 `(Y/n)` 계약
- 각 Stage 검증 명령, 완료 조건과 커밋 메시지
- Stage 1부터 한 단계씩 구현하고 단계 보고서 승인 전에는 다음 Stage로 넘어가지 않는 진행 방식
