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
| 3.1 | PR 리뷰 EOF 차단 항목 보정 | `src/github-star.js`, 실제 readline EOF 회귀 test | focused/package/root/smoke/release 재검증 |
| 3.2 | star prompt 터미널 UX 보정 | 안내 블록·ANSI color·평문 fallback·공식 문서 | focused/package/root/smoke/release 재검증 |
| 3.3 | first-run token 한도 오류 안내 보정 | device-login context message·회귀 test·사용자 문서 | focused/package/root/smoke/release 재검증 |
| 3.4 | submit 결과 URL hyperlink 보정 | Profile·Card cyan OSC 8·README 평문·fallback·preview runner | focused/package/root/smoke/release 재검증 |
| 3.5 | submit 결과 Links block 가독성 보정 | 성공 표시·Links 제목·들여쓰기·정렬·fallback | focused/package/root/smoke/release 재검증 |
| 3.6 | 재리뷰 범위·terminal prompt 정합성 보정 | Issue 범위 확장 기록·devel 충돌 해소·TERM=dumb readline·repository slug | focused/package/root/smoke/release·CI 재검증 |

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
- `scripts/verify-npm-release.mjs`

신규:

- `mydocs/working/task_m100_91_stage3.md`

### 변경 내용

- official CLI guide의 login·submit 흐름에 성공 결과 직전 optional GitHub star prompt를 설명한다.
- `(Y/n)`에서 Enter가 Yes임과 active local `gh` account가 star 주체임을 명시한다.
- 로컬 `gh` 미설치·미인증·권한·network 실패가 제품 login/submit을 실패시키지 않는 fail-soft 경계를 설명한다.
- 이미 starred, non-TTY, pipe/redirection, CI, `submit --json`, 기존 login shortcut과 실패 경로에서는 prompt가 나오지 않음을 문서화한다.
- 제품 OAuth/submit credential을 GitHub star에 사용하거나 저장하지 않으며 브라우저를 열지 않는다는 보안 경계를 기록한다.
- npm package README에도 동일한 핵심 계약과 local `gh` optional requirement를 간결하게 반영한다.
- 신규 배포 파일 `src/github-star.js`를 npm release verifier의 exact package allowlist에 추가해 package entry count와 source·tarball 검증이 새 배포 surface를 명시적으로 허용하게 한다.
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
- npm release verifier가 `src/github-star.js`를 포함한 exact package candidate를 승인하고 그 밖의 추가 파일은 계속 거부한다.
- 전체 변경이 승인된 수행계획 범위와 문서 위치 판단을 벗어나지 않는다.

### 커밋

```text
Task #91 Stage 3: star prompt 문서화와 통합 검증
```

## Stage 3.1 — PR 리뷰 EOF 차단 항목 보정

보정 승인: 2026-08-12 작업지시자 지시 `보정을 진행해줘.`

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/github-star.js`
- `packages/codex-usage-profile-cli/test/github-star.test.js`
- `mydocs/plans/task_m100_91_impl.md`
- `mydocs/report/task_m100_91_report.md`
- `mydocs/orders/20260812.md`

신규:

- `mydocs/working/task_m100_91_stage3_1.md`

### 변경 내용

- PR #93 owner review가 지적한 실제 `readline.question()` EOF 미정착을 재현하고, stdin 종료 시 질문 promise가 남지 않도록 `close` event와 질문 결과를 함께 기다린다.
- EOF는 기존 계약대로 거절과 동일한 `null` 응답으로 정규화해 login/submit 성공 결과와 exit status를 보존한다.
- TTY로 표시한 `PassThrough` stdin/stdout과 기본 prompt reader를 사용해 stdin `.end()`가 `maybePromptGithubStar()`를 `false`로 정착시키고 PUT을 호출하지 않는 회귀 test를 추가한다.
- 기존 `prompt: async () => undefined` 주입 test는 실제 default readline 경로를 검증하는 test로 교체한다.
- Ctrl+C, 질문 예외와 PUT 실패의 기존 fail-soft 계약은 유지하고 focused test 및 수동 PTY 확인 결과를 단계 보고서에 기록한다.
- 명시적 No를 세션에 기억하는 UX, prompt 이전 `gh` 조회 timeout 개선, eligibility 중복 제거는 이번 EOF Blocker 보정 범위에서 제외한다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

### 완료 조건

- 실제 default readline 경로에서 stdin EOF가 발생해도 helper가 `false`로 정착하고 PUT을 호출하지 않는다.
- fresh login과 성공한 interactive submit의 결과가 EOF 뒤 정상 출력되며 기존 성공 exit status가 유지된다.
- Enter 기본 Yes, 명시적 No, invalid input 재질문, Ctrl+C와 모든 기존 fail-soft 경계에 회귀가 없다.
- package/root/smoke/release 검증이 모두 통과하고 배포 surface는 변경되지 않는다.

### 커밋

```text
Task #91 [Stage 3.1]: EOF prompt fail-soft 보정
```

## Stage 3.2 — star prompt 터미널 UX 보정

보정 승인: 2026-08-12 작업지시자 지시 `그렇게 적용해줘.`

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/github-star.js`
- `packages/codex-usage-profile-cli/test/github-star.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `mydocs/plans/task_m100_91.md`
- `mydocs/plans/task_m100_91_impl.md`
- `mydocs/report/task_m100_91_report.md`
- `mydocs/working/task_m100_91_stage3_2.md`
- `mydocs/orders/20260812.md`

신규:

- `mydocs/working/task_m100_91_stage3_2.md`

### 변경 내용

- star prompt가 실제로 표시될 때 기존 login/submit 출력과 구분되도록 블록 앞뒤에 빈 줄을 한 줄씩 둔다.
- 합의한 문구를 `Help us grow! 🌱`, `A GitHub star helps others discover Codex Usage Profile.`, `Would you like to star it on GitHub as @<active-gh-account>? (Y/n)` 순서로 표시한다.
- 성공 시 `✓ Starred! Thank you for your support, @<active-gh-account>. ⭐`를 표시한다.
- 실제 TTY color-capable 환경에서는 제목 cyan, 설명 bright black, 성공 문구 green을 dependency 추가 없이 ANSI SGR로 표시한다.
- `NO_COLOR`가 설정되면 CLI가 추가하는 color SGR을 비활성화한다. `TERM=dumb`이면 color SGR뿐 아니라 default readline의 terminal cursor control도 비활성화해 escape 없는 평문으로 출력한다.
- JSON·CI·비TTY·already-starred·`gh` unavailable 경로는 기존처럼 안내 블록과 ANSI를 모두 출력하지 않는다.
- Enter 기본 Yes, `n`/`no` 거절, invalid input 재질문, EOF/Ctrl+C와 `gh` failure의 fail-soft 계약을 유지한다.
- 공식 CLI guide와 npm package README의 예시를 실제 다중 행 안내 블록과 color fallback 계약으로 갱신한다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

### 완료 조건

- color-capable TTY에서 앞뒤 빈 줄, cyan 제목, 흐린 설명, 기본색 질문과 green 성공 문구가 합의한 순서로 출력된다.
- `NO_COLOR`에서는 문구와 간격을 유지하며 color SGR이 없고, `TERM=dumb`의 실제 default readline 경로에는 ESC byte가 전혀 없다.
- 거절·EOF·실패에서도 prompt 블록 뒤 빈 줄이 유지되고 기존 성공 결과와 exit status가 보존된다.
- prompt 제외 경로와 JSON output에는 신규 문구·emoji·ANSI가 나타나지 않는다.
- package/root/smoke/release 검증이 모두 통과하고 신규 runtime dependency나 배포 entry가 추가되지 않는다.

### 커밋

```text
Task #91 [Stage 3.2]: star prompt terminal UX 보정
```

## Stage 3.3 — first-run token 한도 오류 안내 보정

보정 승인: 2026-08-12 작업지시자 지시 `제안한 메세지 보완도 적용하고.`

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/device-login.js`
- `packages/codex-usage-profile-cli/test/device-login.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `mydocs/plans/task_m100_91_impl.md`
- `mydocs/report/task_m100_91_report.md`
- `mydocs/orders/20260812.md`

신규:

- `mydocs/working/task_m100_91_stage3_3.md`

### 변경 내용

- 수동 first-run에서 browser device approval 뒤 token exchange가 활성 CLI token 3개 한도로 HTTP 409 `conflict`를 반환하는 경로를 재현한다.
- device-login poll의 `ServiceClientError`가 status 409와 code `conflict`를 함께 가질 때만 `Active token limit reached. Revoke an API token in Settings, then try again.`으로 변환한다.
- Account Usage submit의 stale·same-time conflict와 다른 service 요청의 일반 conflict mapping은 변경하지 않는다.
- raw server message, token 수·id·digest와 credential은 출력하지 않고 사용자가 취할 수 있는 최소 조치만 안내한다.
- `logout`은 local credential만 삭제하므로 반복 first-run test에서 server token이 누적될 수 있으며 웹 Settings의 API Tokens에서 기존 token을 revoke해야 함을 공식 CLI guide와 package README에 기록한다.
- Profile·Card의 cyan clickable hyperlink 적용은 UX상 권장하지만 README Markdown의 복사 무손실과 함께 별도 승인이 필요한 output 계약 변경으로 분리해 이번 Stage에서는 구현하지 않는다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/device-login.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

### 완료 조건

- device-login poll의 409 conflict가 승인된 actionable message와 전용 CLI code로 정규화된다.
- network·timeout·rate limit retry, expired·invalid login과 submit conflict 메시지는 기존 동작을 유지한다.
- message에 raw service detail, credential 또는 내부 storage 상태가 포함되지 않는다.
- 반복 first-run에서 local logout과 server token revoke의 차이를 두 공식 문서가 설명한다.
- package/root/smoke/release 검증이 모두 통과하고 배포 entry나 runtime dependency는 변하지 않는다.

### 커밋

```text
Task #91 [Stage 3.3]: device login token limit 안내 보정
```

## Stage 3.4 — submit 결과 URL hyperlink 보정

보정 승인: 2026-08-12 작업지시자 지시 `링크 변경도 적용해주고 내가 로컬에서 테스트할 수 있게 해줘.`

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/output.js`
- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/src/device-login.js`
- `packages/codex-usage-profile-cli/test/output.test.js`
- `packages/codex-usage-profile-cli/test/device-login.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `mydocs/plans/task_m100_91_impl.md`
- `mydocs/report/task_m100_91_report.md`
- `mydocs/orders/20260812.md`

신규:

- `mydocs/working/task_m100_91_stage3_4.md`
- `/private/tmp/cup-task91-manual-first-run/preview-output.mjs` (로컬 preview 전용, repository commit 제외)

### 변경 내용

- human-readable submit 결과의 `Profile:` URL과 `Card:` URL만 device login의 `Open:`과 동일한 cyan ANSI SGR + OSC 8 clickable hyperlink로 표시한다.
- `README:` 뒤의 Markdown 전체는 GitHub README에 복사·붙여넣는 산출물이므로 ANSI와 OSC 8을 삽입하지 않고 원문 그대로 유지한다.
- hyperlink는 stdout이 TTY이고 지원 terminal signal이 있으며 `NO_COLOR`가 없고 `TERM=dumb`가 아닐 때만 활성화한다.
- non-TTY, JSON, `NO_COLOR`, `TERM=dumb`, 명시적 hyperlink disable에서는 Profile·Card·README를 ANSI 없는 기존 평문으로 출력한다.
- `writeSubmitOutput()`이 반환하는 projection과 JSON document에는 terminal escape를 넣지 않고 display write 단계에서만 hyperlink를 적용한다.
- device login `Open:`도 `NO_COLOR` 존재 시 평문으로 fallback해 terminal color opt-out을 일관되게 적용한다.
- 네트워크·credential·GitHub mutation 없이 실제 terminal에서 링크 표현을 확인할 수 있는 임시 preview runner를 제공한다. 기존 격리 runner의 `submit`으로 production end-to-end도 선택적으로 확인할 수 있다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/output.test.js packages/codex-usage-profile-cli/test/device-login.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

### 완료 조건

- 지원 TTY에서 Profile·Card URL만 cyan clickable OSC 8이며 README Markdown은 exact plain text다.
- JSON·non-TTY·`NO_COLOR`·`TERM=dumb`에서 ANSI와 OSC 8이 없고 기존 output schema와 문구가 유지된다.
- projection 반환값, credential redaction과 star prompt 출력 순서에 회귀가 없다.
- preview runner가 외부 mutation 없이 로컬 terminal 표현을 재현한다.
- package/root/smoke/release 검증이 모두 통과하고 신규 runtime dependency나 npm entry는 추가되지 않는다.

### 커밋

```text
Task #91 [Stage 3.4]: submit 결과 URL hyperlink 보정
```

## Stage 3.5 — submit 결과 Links block 가독성 보정

보정 승인: 2026-08-12 작업지시자 지시 `두번째로 적용해줘,`

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/output.js`
- `packages/codex-usage-profile-cli/test/output.test.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `mydocs/plans/task_m100_91_impl.md`
- `mydocs/report/task_m100_91_report.md`
- `mydocs/orders/20260812.md`

신규:

- `mydocs/working/task_m100_91_stage3_5.md`

### 변경 내용

- human-readable 성공 문구 앞에 `✓`를 붙여 submit 결과의 시작점을 분명히 한다. idempotent 결과에도 같은 성공 표시를 사용한다.
- `Captured:` 다음에 빈 줄을 두고, Profile·Card·README가 하나라도 있을 때만 `Links` 블록을 출력한다.
- `Links` 제목은 color 지원 TTY에서 bright black으로 낮춰 표시하고, 각 항목은 두 칸 들여쓰기와 정렬된 label(`Profile:`, `Card:`, `README:`)을 사용한다.
- Stage 3.4의 hyperlink 경계를 유지해 Profile·Card URL만 cyan OSC 8 hyperlink로 표시하고 README Markdown은 ANSI 없는 평문으로 보존한다.
- non-TTY, JSON, `NO_COLOR`, `TERM=dumb`에서는 ANSI 없이 같은 줄바꿈·들여쓰기 구조를 출력한다.
- profile 산출물이 모두 비어 있으면 불필요한 빈 줄과 `Links` 제목을 출력하지 않는다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/output.test.js packages/codex-usage-profile-cli/test/cli.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

### 완료 조건

- human-readable 결과가 성공 표시, capture metadata, 분리된 Links 블록 순서로 읽힌다.
- Profile·Card·README label이 들여쓰기와 정렬을 유지하며 좁은 terminal의 자연 줄바꿈을 방해하는 padding은 URL 본문에 삽입하지 않는다.
- 지원 TTY에서 `Links`만 흐린 계층으로 표시되고 Profile·Card hyperlink와 README 평문 계약이 유지된다.
- JSON·non-TTY·`NO_COLOR`·`TERM=dumb`에서 escape 없이 동일한 정보 구조가 유지된다.
- package/root/smoke/release 검증이 모두 통과하고 신규 runtime dependency나 npm entry는 추가되지 않는다.

### 커밋

```text
Task #91 [Stage 3.5]: submit 결과 Links block 가독성 보정
```

## Stage 3.6 — 재리뷰 범위·terminal prompt 정합성 보정

보정 승인: 2026-08-12 작업지시자 지시 `보정 진행해줘. 완료 후 보정 반영 내용을 코멘트로 게시해줘.`

재리뷰: [PR #93 issuecomment-5267591084](https://github.com/postmelee/codex-usage-profile/pull/93#issuecomment-5267591084)

### 산출물

수정:

- GitHub Issue #91 본문
- `packages/codex-usage-profile-cli/src/github-star.js`
- `packages/codex-usage-profile-cli/test/github-star.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `mydocs/plans/task_m100_91_impl.md`
- `mydocs/report/task_m100_91_report.md`
- `mydocs/orders/20260812.md`
- PR #93 본문과 재리뷰 대응 comment

신규:

- `mydocs/working/task_m100_91_stage3_6.md`

### 변경 내용

- Issue #91 본문에 작업지시자가 같은 thread에서 승인한 Stage 3.3 token-limit 안내, Stage 3.4 submit hyperlink, Stage 3.5 Links block과 Stage 3.6 재리뷰 보정의 범위·추가 수용 기준·검증 기준을 기록한다.
- 최신 `origin/devel`을 진행 중인 `local/task91`에 merge하고 PR #93의 충돌을 해결한다. 기존 Task #91 변경과 Task #92 산출물을 모두 보존한다.
- default readline prompt가 `TERM=dumb`에서 terminal cursor control을 사용하지 않게 `createInterface()`의 `terminal` 여부를 TTY와 `TERM`으로 결정한다.
- 주입 prompt가 아닌 실제 `promptForAnswer()` 경로를 사용하는 회귀 test에서 `TERM=dumb`의 escape 0개, Enter 기본 Yes와 fixed PUT을 함께 검증한다.
- star 설명줄에 정확한 mutation 대상 `postmelee/codex-usage-profile`을 표시해 Enter 기본 Yes 전에 account와 repository가 모두 드러나게 한다.
- 문서의 `NO_COLOR` 계약은 색상 SGR 비활성화로 정확히 표현한다. `TERM=dumb`는 readline cursor control까지 포함해 escape 없는 평문으로 기록한다.
- `NO_COLOR=""` 처리 관례, unsafe URL raw 출력, terminal helper 분리, backend `active_token_limit` 구체 code는 실질 Blocker가 아니며 별도 설계가 필요한 후속 후보로 남긴다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
gh pr checks 93 --watch --interval 10
```

### 완료 조건

- Issue #91에서 Stage 3.3~3.6의 승인 근거와 추가 수용·검증 기준을 직접 확인할 수 있다.
- PR #93이 최신 `devel`과 충돌하지 않고 Task #92의 병합 산출물을 보존한다.
- 실제 readline 경로의 `TERM=dumb` output에는 ESC byte가 없고 Enter는 fixed repository PUT 한 번으로 이어진다.
- prompt가 active `@account`뿐 아니라 정확한 `postmelee/codex-usage-profile` 대상도 mutation 전에 표시한다.
- `NO_COLOR`와 `TERM=dumb` 문서가 실제 제어문자 계약을 과장하지 않는다.
- package/root/smoke/release와 Node 20·22·24 CI가 모두 통과한다.

### 커밋

```text
Task #91 [Stage 3.6]: 재리뷰 terminal prompt 정합성 보정
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 외부 GitHub mutation이 가능한 test는 작성하지 않으며 모든 `gh` 동작을 fake runner로 검증한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 각 단계 완료 시 `task-stage-report` 절차로 단계 보고서를 작성하고 단계 산출물과 함께 커밋한 뒤 다음 단계 승인을 요청한다. 승인된 PR 리뷰 Blocker 보정은 Stage 3.1로 기록한다.
- 계획 변경이 필요하면 이 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_91_stage{N}.md`를 함께 묶는다. 하위 단계는 `_stage3_1.md`~`_stage3_6.md`처럼 소수점을 밑줄로 표기한다.
- 커밋 메시지는 일반 단계는 `Task #91 Stage {N}: {핵심 내용 요약}`, 하위 단계는 `Task #91 [Stage {N.M}]: {핵심 내용 요약}` 형식을 따른다.
- 구현계획서 승인 전에 제품 소스·test·공식 사용자 문서를 수정하지 않는다.

## 단계 의존성

- Stage 2는 Stage 1의 helper API와 fail-soft 동작이 검증되고 Stage 1 보고서가 승인된 뒤 진행한다.
- Stage 3은 Stage 2의 login·submit 통합 검증과 보고서가 승인된 뒤 진행한다.
- Stage 3 완료 뒤 전체 task 검증 결과를 확인하고 `task-final-report` 절차로 최종 보고서와 PR 게시를 진행한다.
- Stage 3.1은 PR #93 리뷰 Blocker의 보정 승인을 받은 뒤 진행하며, 검증·보고서·커밋 후 기존 PR head와 최종 보고서를 갱신한다.
- Stage 3.2는 작업지시자의 terminal UX 보정 승인을 받은 뒤 진행하며, 검증·보고서·커밋 후 기존 PR head와 사용자 문서를 갱신한다.
- Stage 3.3은 작업지시자의 first-run token 한도 오류 안내 보정 승인을 받은 뒤 진행하며, output hyperlink 제안과 분리해 검증·보고서·커밋 후 기존 PR head를 갱신한다.
- Stage 3.4는 작업지시자의 output hyperlink 승인을 받은 뒤 진행하며, Profile·Card URL만 link로 표시하고 README Markdown의 복사 무손실을 보존한 채 기존 PR head를 갱신한다.
- Stage 3.5는 작업지시자가 선택한 두 번째 output 구조 승인 뒤 진행하며, 성공 표시와 Links 계층만 보정하고 Stage 3.4의 hyperlink·fallback·README 무손실 계약을 유지한 채 기존 PR head를 갱신한다.
- Stage 3.6은 작업지시자의 재리뷰 보정·comment 게시 승인 뒤 진행하며, Issue 범위 추적성·최신 devel 충돌·실제 readline의 TERM=dumb 계약·repository 대상 표시를 보정한 뒤 기존 PR head와 CI를 갱신한다.

## 위험과 대응

- **Enter의 외부 mutation**: `(Y/n)`과 active `@account`, 대상 repository를 한 prompt에 표시하고 TTY에서 보인 질문에만 Enter 기본 Yes를 적용한다.
- **제품 계정과 `gh` 계정 불일치**: 제품 credential을 재사용하지 않고 active `gh` account를 조회·표시하며 문서에도 star 주체를 분리해 설명한다.
- **상태 확인 오류를 not-starred로 오인**: HTTP 404만 질문 가능한 not-starred로 분류하고 인증·권한·network·timeout 오류는 모두 prompt 생략으로 처리한다.
- **optional subprocess 지연**: 각 `gh` call을 5초로 제한하고 unknown 상태에서는 결과 출력으로 계속 진행한다.
- **JSON과 automation 오염**: TTY/JSON gate를 subprocess보다 먼저 적용하고 CLI test에서 helper 호출 여부와 JSON parsing을 함께 검증한다.
- **shell injection과 secret 노출**: shell을 사용하지 않고 고정 argument array만 전달하며 raw child process 오류를 terminal이나 assertion output에 반영하지 않는다.
- **플랫폼 차이**: shell 문법이나 browser open에 의존하지 않고 missing executable을 정상적인 optional-unavailable 상태로 다룬다.
- **readline EOF 미정착**: 질문 결과뿐 아니라 interface `close` event를 함께 기다리고 실제 stream EOF 회귀 test로 성공 결과 억제를 방지한다.
- **ANSI와 terminal 호환성**: TTY prompt에만 color를 적용하고 `NO_COLOR`의 color SGR opt-out과 `TERM=dumb`의 readline terminal-mode opt-out을 실제 default prompt 경로에서 구분해 검증한다.
- **generic conflict 오분류**: device-login poll에서 status 409와 code `conflict`가 함께 확인된 경우에만 token 한도 message로 바꾸고 submit·다른 endpoint의 conflict는 기존 mapping을 유지한다.
- **OSC 8 복사·log 오염**: display write 단계에서 지원 TTY의 Profile·Card에만 escape를 적용하고 README·JSON·non-TTY·color opt-out에는 exact plain text를 유지한다.
- **과도한 장식과 좁은 terminal wrapping**: 결과 블록에는 성공 표시 하나와 흐린 제목만 추가하고 링크별 emoji·줄간격은 늘리지 않으며, 짧은 label column만 정렬한다.

## 승인 요청 사항

- Stage 1 core·fail-soft, Stage 2 login/submit 통합, Stage 3 문서·통합 검증의 산출물과 의존성
- HTTP 404만 not-starred로 간주하고 5초 timeout의 모든 unknown `gh` failure를 prompt 생략으로 처리하는 경계
- Enter·`y`·`yes`를 동의로 해석하고 잘못된 입력을 재질문하는 `(Y/n)` 계약
- 각 Stage 검증 명령, 완료 조건과 커밋 메시지
- Stage 1부터 한 단계씩 구현하고 단계 보고서 승인 전에는 다음 Stage로 넘어가지 않는 진행 방식
