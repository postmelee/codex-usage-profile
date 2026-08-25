# Task #134 구현계획서 — CLI 재인증 복구와 도움말·온보딩 UX 정합성 개선

수행계획서: [`task_m100_134.md`](task_m100_134.md)
GitHub Issue: [#134](https://github.com/postmelee/codex-usage-profile/issues/134)
마일스톤: M100

## 승인된 결정과 구현 해석

- 정상 사용자 경로는 `npx codex-usage-profile@latest submit` 한 번이다. 자격 증명이 없거나 파일에
  저장된 자격 증명이 만료·폐기됐으면 같은 프로세스에서 device approval을 마친 뒤 제출까지 이어간다.
- 자동 재인증은 최초 제출이 `submit_auth_failed`로 정규화되고 활성 credential source가 `file`인
  경우에만 한 번 허용한다. 두 번째 제출 실패, 인증 외 오류와 환경 변수 credential은 반복하지 않는다.
- 재인증 전 기존 credential file을 삭제하지 않는다. device approval과 기존 atomic save가 성공한
  뒤에만 새 credential로 교체하며 실패·취소·만료에서는 기존 파일을 보존한다.
- `CODEX_USAGE_PROFILE_TOKEN`은 파일보다 우선하는 기존 계약을 유지한다. 이 값이 401/410이면 자동
  로그인이나 파일 mutation 없이 환경 변수를 해제한 뒤 다시 실행하라는 오류로 종료한다.
- `--json` 재인증의 verification URL·code와 진행 안내는 stderr로 분리하고 최종 submit JSON만
  stdout에 기록한다. human 실행은 기존처럼 승인 안내와 성공 결과를 stdout에서 제공한다.
- 표준 help 표면은 전역과 각 command의 `-h`, `--help`다. 비표준 `-help` alias는 추가·문서화하지
  않고 unknown option 오류와 올바른 help 실행 예를 반환한다.
- 루트·npm README는 일반 사용자 명령과 목적을 표로 제공하고 `--server`를 노출하지 않는다. 상세
  option, 환경 변수와 origin override는 `docs/cli-submit.md` 및 실제 CLI help에 유지한다.
- 웹은 로컬 credential 상태를 탐지하지 않는다. 빈 Profile은 아래 submit 명령이 필요 시 browser
  approval을 안내하고 제출까지 계속한다는 기대만 영어·한국어로 설명한다.
- server API·credential schema·npm version/publish·Sites 원격 배포는 변경하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 파일 credential 재인증과 제출 재개 | `cli.js`, CLI auth recovery tests | source별 401/410·bounded retry·credential/JSON 보존 |
| 2 | 전역·명령별 help와 오류 탐색성 | `cli.js`, CLI help/parser tests | global·4 command help, version, invalid input hint |
| 3 | 웹 빈 상태와 공개 문서 정합성 | messages, Profile E2E, root/npm/docs README | EN/KO onboarding, Commands 표, recovery 계약 |
| 4 | package·Sites 통합 회귀와 release 인계 | 전체 test/smoke/build, 단계 보고 | Node·Playwright·npm package·Sites artifact |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_134_impl.md` | OK | Stage 산출물·검증·커밋 경계를 고정 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_134_stage{1..4}.md` | OK | 각 Stage source와 같은 commit에 포함 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_134_report.md` | OK | 모든 Stage 승인 뒤 작성 |
| GitHub 사용자 안내 | 저장소 루트 | `README.md` | OK | 프로젝트 첫 진입점의 command 계약 |
| npm 사용자 안내 | package 루트 | `packages/codex-usage-profile-cli/README.md` | OK | npm registry에 게시되는 CLI 문서 |
| CLI 상세 안내 | `docs/` | `docs/cli-submit.md` | OK | 옵션·credential source·복구 경계의 제품 문서 |

## 공통 상태 계약

### Submit 인증 복구 행렬

| 최초 credential | 최초 submit 결과 | 동작 | 재시도 상한 | credential file |
|---|---|---|---|---|
| 없음 | 해당 없음 | device approval 후 submit | login 1회, submit 1회 | 승인·atomic save 성공 뒤 생성 |
| file | 성공 | 그대로 완료 | submit 1회 | 유지 |
| file | 401/410 → 재승인 → 성공 | device approval 후 새 credential로 다시 submit | login 1회, submit 총 2회 | 재승인 성공 뒤에만 교체 |
| file | 401/410 → 재승인 실패·취소·만료 | 안전한 오류로 종료 | login 1회, submit 1회 | 기존 값 유지 |
| file | 401/410 → 재승인 → 두 번째 실패 | 두 번째 오류로 종료, 추가 login 없음 | login 1회, submit 총 2회 | 승인된 새 값 유지 |
| environment | 401/410 | `CODEX_USAGE_PROFILE_TOKEN` 해제 안내 후 종료 | submit 1회 | token 교체·삭제 없음, 기존 device metadata 계약 유지 |
| file/environment | 인증 외 확정 오류 | 기존 오류로 종료 | 기존 submit 내부 정책만 적용 | auth recovery mutation 없음 |

### 출력 계약

- human 실행은 token, owner ID, raw service response를 출력하지 않는다.
- JSON 실행은 stdout에 최종 JSON document 하나만 기록한다. device approval URL/code와 재연결 안내는
  stderr에만 기록하며 ANSI hyperlink를 사용하지 않는다.
- 재인증 뒤 최종 성공에서 GitHub star prompt의 기존 eligibility를 유지하되 JSON·CI·non-TTY에서는
  실행하지 않는다. 실패 경로에서는 prompt를 호출하지 않는다.
- unknown command/option은 기존 nonzero exit과 safe argument redaction을 유지하고, stderr에 전역 또는
  해당 command의 실행 가능한 help 명령을 덧붙인다.

### Help 표면

| 입력 | 출력 범위 | credential/client/analyzer side effect |
|---|---|---|
| 빈 argv, `-h`, `--help` | 전역 command 목록과 공통 option | 없음 |
| `<command> -h`, `<command> --help` | 해당 command의 usage·지원 option | 없음 |
| `-v`, `--version` | version 한 줄 | 없음 |
| unknown command | 오류 + 전역 help 명령 | 없음 |
| `<command> <unknown option>` | 오류 + command help 명령 | 없음 |

## Stage 1 — 파일 credential 재인증과 제출 재개

### 진입 조건

- 수행계획서와 본 구현계획서의 복구 행렬, 출력 계약, 네 Stage와 제외 범위가 승인됐다.
- `local/task134` worktree는 task-start와 구현계획서 commit만 포함하고 clean하다.

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `mydocs/orders/20260825.md`

신규:

- `mydocs/working/task_m100_134_stage1.md`

`submit.js`, service client, device API와 credential schema는 변경하지 않는다. 현재
`submitAccountUsage`가 401/410을 `submit_auth_failed`로 정규화하므로 command orchestration에서만 복구한다.

### 변경 내용

1. `runCli`에서 JSON 여부에 따라 device login 안내용 stream을 선택한다. human은 stdout, JSON은
   stderr를 사용하고 `runSubmit`에 명시적으로 전달한다.
2. `runSubmit`의 credential 없음 login과 만료 file credential re-login이 같은 내부 helper로 새
   credential을 load·resolve하도록 구성한다. helper는 `intent: "submit"`, 현재 service origin과 기존
   device-login option을 유지한다.
3. 한 command 안에서 analyzer 호출 결과를 memoize해 최초 제출과 인증 복구 뒤 재시도가 같은
   Account Usage Contract document를 사용하고 analyzer는 한 번만 실행되게 한다.
4. 최초 `submitAccountUsage` 호출만 catch하고 `error.code === "submit_auth_failed"`를 판정한다.
   credential source가 file이면 안전한 reconnect 안내 후 device approval을 한 번 실행한다.
5. approval 뒤 store를 다시 load하고 environment precedence와 service-origin binding을 다시 적용한다.
   사용할 수 있는 새 file credential이 없으면 `login_required`로 종료한다.
6. 새 credential의 device ID를 다시 계산한 뒤 동일 account usage 제출을 한 번 더 호출한다. 두 번째
   호출은 auth recovery catch로 감싸지 않아 추가 login·submit loop를 차단한다.
7. 최초 credential source가 environment이면 login을 호출하지 않고 `CODEX_USAGE_PROFILE_TOKEN`을
   해제한 뒤 submit을 다시 실행하라는 actionable `environment_token_invalid` 오류로 변환한다.
8. 409, 413/415/422, 429, 5xx·network unknown과 analyzer failure는 기존 submit 내부 정책과 오류를
   그대로 유지하며 auth login을 시작하지 않는다.
9. 재인증 성공 전에 `credentialStore.remove()`나 선제 `save()`를 호출하지 않는다. login 실패 fixture에서
   기존 token/device metadata가 그대로 load되는지 확인한다.
10. CLI 테스트에 다음 matrix를 추가한다.
   - file 401과 410 각각 analyzer 1회·login 1회·submit 2회, 두 번째 요청은 새 token과 다시 load한
     device metadata 사용, 두 요청 document identity 동일
   - login 실패·취소 시 submit 1회, 기존 credential 유지, secret 비노출
   - 새 credential 뒤 두 번째 401/410은 login 1회·submit 2회로 종료
   - environment 401/410은 login 0회·credential token 교체/삭제 0회와 unset 안내
   - 인증 외 오류는 login 0회
   - `--json` reauth는 approval 안내가 stderr, stdout은 parse 가능한 JSON 하나
11. 집중 검증 통과 뒤 `task-stage-report`로 source·보고서·오늘할일을 한 commit으로 묶고 Stage 2
    승인을 요청한다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js packages/codex-usage-profile-cli/test/submit.test.js
git diff --check
```

### 완료·중단 조건

- 완료: 복구 행렬의 모든 source/result 조합, 요청 횟수 상한, credential 보존과 JSON 채널이 테스트로
  고정되고 집중 테스트가 통과한다.
- 중단: `submit_auth_failed` 외 submit/service error 계약 변경, credential schema 변경 또는 device API
  변경이 필요하면 구현계획서를 먼저 보정하고 승인받는다.

### 커밋

```text
Task #134 Stage 1: 파일 credential 재인증과 제출 재개
```

## Stage 2 — 전역·명령별 help와 오류 탐색성

### 진입 조건

- Stage 1 보고서와 submit 복구·출력 계약이 승인됐다.

### 산출물

수정:

- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `mydocs/orders/20260825.md`

신규:

- `mydocs/working/task_m100_134_stage2.md`

### 변경 내용

1. 전역 usage와 `login`, `status`, `submit`, `logout` command usage를 하나의 상수/생성 함수 구조로
   둬 parser, 출력과 테스트가 같은 진실 원천을 사용하게 한다.
2. 빈 argv, 전역 `-h/--help`는 기존 전역 usage를 반환한다. valid command 뒤 `-h/--help`는 option
   validation이나 credential load 전에 해당 command usage를 반환한다.
3. command별 help는 실제 지원 범위만 표시한다.
   - `login`: network option과 help
   - `status`: network option, `--json`과 help
   - `submit`: network option, `--json`과 help
   - `logout`: help만 표시하며 network option을 안내하지 않음
4. 전역 `-v/--version`의 한 줄 출력과 무부작용을 유지한다. command 뒤 version은 새 alias로 확장하지
   않고 현재 전역 option parsing 호환 범위 안에서 테스트로 고정한다.
5. unknown command는 원래 safe argument 오류 뒤 `npx codex-usage-profile@latest --help`를,
   unknown/missing/unsupported command option은 원래 오류 뒤 해당 command `--help`를 안내한다.
6. `-help`는 unknown option으로 유지하되 올바른 `--help` 실행 예를 제공한다.
7. 테스트에서 전역·4 command의 `-h/--help`, `-v/--version`, supported option 문구, unsupported option
   부재, credential/client/analyzer 무호출, nonzero invalid input와 secret redaction을 검증한다.
8. 집중 검증 통과 뒤 `task-stage-report`로 source·보고서·오늘할일을 commit하고 Stage 3 승인을
   요청한다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js
git diff --check
```

### 완료·중단 조건

- 완료: global·command help가 실제 option과 일치하고 help/version/invalid input에서 credential·network·
  analyzer side effect가 없으며 기존 valid argv가 회귀하지 않는다.
- 중단: command parser 전체 교체, 새 dependency 또는 기존 command/option 제거가 필요하면 계획을 먼저
  보정하고 승인받는다.

### 커밋

```text
Task #134 Stage 2: 명령별 help와 오류 안내 추가
```

## Stage 3 — 웹 빈 상태와 공개 문서 정합성

### 진입 조건

- Stage 2 보고서와 최종 CLI help·오류 문구가 승인됐다.

### 산출물

수정:

- `src/profile-ui/DeviceApprovalPage.jsx`
- `src/profile-ui/messages.js`
- `tests/profile-ui.spec.js`
- `README.md`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `mydocs/orders/20260825.md`

신규:

- `mydocs/working/task_m100_134_stage3.md`

### 변경 내용

1. Profile no-usage 영어·한국어 제목을 첫 카드 생성 행동으로 바꾸고 설명에 다음 계약을 담는다.
   - 터미널에서 표시된 `submit` 명령 하나를 실행한다.
   - 필요하면 CLI가 browser approval을 안내한다.
   - 승인 뒤 제출을 이어가며 이후 업데이트에도 같은 명령을 사용한다.
2. command box, copy feedback, aggregated-data privacy notice, loading/error state와 desktop/mobile
   geometry는 변경하지 않는다.
3. 기기 승인 전에는 setup guide link를 유지하고 승인 성공 뒤에는 완료 안내의 `Home`·`Profile` 후속
   탐색 링크와 같은 위계로 혼동되지 않도록 setup guide link를 숨긴다.
4. 기존 Profile E2E의 exact copy를 영어 새 문구로 갱신하고 locale 전환 경로에서 한국어 제목·설명과
   동일 submit command를 검증한다. heading 수, copy, 링크, privacy, 72/48px offset과 overflow 회귀를
   유지한다.
5. 루트 README와 npm README의 `Commands` code block을 `Command | What it does` 표로 통일한다.
   `submit`, `login`, `status`, `logout`, `--help`/`-h`, `--version`/`-v`를 실제 역할과 one-command
   submit 계약에 맞게 설명한다.
6. 공개 README 표에는 `--server`, 환경 변수, credential 저장 경로와 release/production 전환 표현을
   넣지 않는다. npm README는 루트 README와 같은 command 명칭·순서를 사용한다.
7. `docs/cli-submit.md` command/option 표에 command별 help 예를 반영하고 stale file credential의
   401/410은 submit이 한 번 재인증한 뒤 계속한다는 동작을 기록한다. environment token 401/410은
   자동 교체되지 않으며 `CODEX_USAGE_PROFILE_TOKEN`을 unset한 뒤 다시 실행해야 함을 구분한다.
8. 문서의 `--help`·`--version` 표기는 실제 `-h`·`-v` alias와 맞추고 비표준 `-help`를 추가하지 않는다.
9. 집중 Node/E2E와 README command 계약 대조가 통과하면 `task-stage-report`로 source·공식 문서·
   보고서·오늘할일을 commit하고 Stage 4 승인을 요청한다.

### 검증

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js
npx playwright test tests/profile-ui.spec.js --grep "owner Profile loading, empty, and error states keep one visual heading|locale"
rg -n "codex-usage-profile@latest (submit|login|status|logout)|--help|--version" README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md
git diff --check
```

### 완료·중단 조건

- 완료: EN/KO 빈 상태, 승인 전/후 setup guide 위계, 두 공개 README 표와 상세 가이드가 Stage 1~2
  실제 동작과 일치하고 공개 README에 `--server`가 새로 노출되지 않는다.
- 중단: 웹에서 local credential을 탐지하거나 새 API/UI interaction을 추가해야 문구를 성립시킬 수
  있다면 범위를 확장하지 않고 계획 보정 승인을 요청한다.

### 커밋

```text
Task #134 Stage 3: 온보딩 문구와 사용자 문서 정합성 보정
```

## Stage 4 — package·Sites 통합 회귀와 release 인계

### 진입 조건

- Stage 3 보고서와 공개 문서·웹 copy가 승인됐다.
- Stage 1~3 source와 보고서가 각각 commit되어 working tree가 clean하다.

### 산출물

수정:

- `mydocs/orders/20260825.md`

신규:

- `mydocs/working/task_m100_134_stage4.md`

제품 source와 공식 문서는 Stage 4에서 수정하지 않는다. 검증 실패 해결에 source 변경이 필요하면
해당 Stage 보정 또는 구현계획 변경 승인을 먼저 받는다.

### 실행 순서

1. 전체 Node test를 순차 concurrency로 실행해 CLI, backend, renderer와 문서 계약 회귀를 확인한다.
2. 전체 Playwright E2E로 Profile 외 Home, Settings, Share Studio와 locale·responsive 회귀를 확인한다.
3. local npm package smoke에서 packed CLI의 전역·command help, submit/status command와 package README
   포함 여부를 검증한다.
4. Sites full-stack artifact를 build하고 artifact verifier로 frontend/server bundle 계약을 확인한다.
5. task diff에서 server API, credential schema, package version, hosting manifest와 배포 설정이 변경되지
   않았는지 path/package-level로 확인한다.
6. npm publish와 production deploy가 이 task에 포함되지 않음을 Stage 4 보고서와 최종 release handoff에
   기록한다.
7. `task-stage-report`로 전체 검증 결과·오늘할일을 commit하고 최종 보고 단계 승인을 요청한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run smoke:npm-package:local
npm run build:sites-fullstack
npm run verify:sites-fullstack
git diff --exit-code origin/devel...HEAD -- src/profile-backend packages/codex-usage-profile-cli/src/credentials.js packages/codex-usage-profile-cli/package.json .openai/hosting.json
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: 전체 test/E2E/package smoke/Sites build·verifier가 통과하고 변경 경로가 승인된 CLI orchestration,
  Profile copy/tests, 공식 문서와 task 문서에만 한정된다.
- 중단: package smoke·Sites artifact·제외 path 검사가 실패하거나 npm publish/remote deploy가 필요하면
  Stage를 완료 처리하지 않고 원인과 별도 release gate를 보고한다.

### 커밋

```text
Task #134 Stage 4: package와 Sites 통합 회귀 완료
```

## 검증

- 각 Stage 검증은 단계 보고서 작성 전에 실행하고 실패한 Stage는 완료 처리하지 않는다.
- auth recovery 테스트는 analyzer·login·submit 호출 횟수, 두 요청 document identity·token/device,
  store의 최종·실패 상태를 함께
  판정한다. 성공 문구만으로 판단하지 않는다.
- JSON test는 stdout을 `JSON.parse`하고 verification URL/code·ANSI·secret이 stdout에 없는지 확인한다.
- command help test는 문구뿐 아니라 credential load, client 생성, analyzer 호출이 0회인지 확인한다.
- Profile E2E는 EN/KO copy, command copy, guide link, privacy notice, heading 수와 responsive geometry를
  함께 확인한다.
- 문서 검증은 루트·npm README의 command 표 정합성과 공개 `--server` 비노출을 확인한다. 기존 상세
  가이드의 origin override 설명은 제거하지 않는다.
- 계획 밖 source/API/schema/version/hosting 변경이 필요하면 구현계획서를 먼저 갱신하고 승인받는다.
- npm publish, production deploy, account/data mutation과 remote Site 변경은 수행하지 않는다.

## 커밋

- Stage source, `mydocs/working/task_m100_134_stage{N}.md`와 오늘할일 갱신을 각 Stage commit으로 함께
  묶는다.
- 단계 보고서에 실행 명령, pass/fail, 요청 횟수·출력 채널 등 관찰 가능한 계약과 잔여 위험을 기록한
  뒤 다음 Stage 승인을 요청한다.
- 모든 Stage 승인 뒤 최종 보고와 PR은 `task-final-report` 절차를 별도로 적용한다.

## 단계 의존성

- Stage 2는 Stage 1 auth recovery·credential·JSON 계약과 보고서 승인 뒤 진행한다.
- Stage 3은 Stage 2 command help·invalid input 문구와 보고서 승인 뒤 진행한다.
- Stage 4는 Stage 3 웹·문서 정합성 검증과 보고서 승인 뒤 진행한다.
- 최종 보고서는 Stage 4 전체 test/smoke/build/verifier와 제외 path 검증 승인 뒤 작성한다.

## 위험과 대응

- **중복 제출 또는 무한 재인증**: 최초 file auth failure만 recovery catch에서 처리하고 두 번째 submit은
  catch 밖에서 한 번 호출해 login 1회·submit 최대 2회를 테스트한다.
- **환경 토큰 덮어쓰기**: 최초 source가 environment이면 login과 credential token 교체·삭제 없이 unset
  안내로 종료하고, 기존 device-only metadata 생성·유지 계약과 environment precedence를 재확인한다.
- **기존 credential 유실**: re-login 전 remove/save를 호출하지 않고 실패·취소 fixture에서 이전
  credential의 token/device metadata가 유지되는지 검증한다.
- **새 credential의 origin 혼합**: approval 뒤 store를 다시 resolve하고 현재 service origin에 bind한
  credential만 재시도에 사용한다.
- **network unknown 의미 훼손**: `submitAccountUsage` 내부 ambiguous network retry를 변경하지 않고
  orchestration은 `submit_auth_failed`만 분기한다.
- **재인증 중 중복 분석**: command 범위에서 analyzer document를 한 번 memoize하고 두 submit 요청의
  object identity와 analyzer 1회 호출을 테스트한다.
- **JSON stdout 오염**: device approval output stream을 JSON일 때 stderr로 분리하고 stdout 단일 JSON
  parse test로 고정한다.
- **help와 parser 불일치**: command usage를 단일 구조로 두고 각 help의 supported/unsupported option과
  무부작용을 matrix test로 검증한다.
- **공개 문서 과다 노출**: 루트·npm README는 일반 command 표만 제공하고 advanced option은
  `docs/cli-submit.md`에 유지한다.
- **웹이 보장할 수 없는 상태 약속**: local credential 감지나 자동 browser open 성공을 약속하지 않고
  CLI가 필요할 때 승인 흐름을 안내한다는 표현만 사용한다.
- **병렬 작업 충돌**: 모든 변경과 commit은 `/private/tmp/codex-usage-profile-task134`의
  `local/task134`에만 남기고 주 worktree의 사용자 변경을 건드리지 않는다.

## 승인 요청 사항

- 위 네 Stage 분할과 file/environment credential 복구 행렬을 승인해 주세요.
- Stage 1은 CLI orchestration과 테스트만 변경하고 server API·credential schema는 건드리지 않습니다.
- Stage 2는 전역·command help와 invalid input hint만 변경하며 비표준 `-help` alias는 추가하지 않습니다.
- Stage 3은 EN/KO Profile 빈 상태와 공식 사용자 문서를 같은 one-command 계약으로 맞춥니다.
- Stage 4는 전체 test/package/Sites artifact 검증만 수행하며 npm publish와 production deploy는 하지
  않습니다.
- 각 Stage source와 완료 보고서를 규정된 commit으로 묶고 다음 Stage 전에 승인을 다시 받습니다.

승인되면 Stage 1의 파일 credential 재인증·제출 재개와 집중 테스트부터 진행한다.
