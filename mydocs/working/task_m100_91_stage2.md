# Task #91 Stage 2 보고서 — login·submit 성공 흐름 통합

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 2

## 단계 목적

Stage 1의 optional GitHub star helper를 실제 CLI 성공 경계에 연결한다. fresh login은 device login 완료 뒤 기존 `Login complete.` 직전에, human submit은 server submit 성공 뒤 기존 결과 writer 직전에 helper 응답을 기다린다. machine-readable·unattended·실패 경로와 기존 로그인 shortcut은 기존 출력과 실행 특성을 그대로 보존한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/cli.js` | stdin과 star helper를 주입 가능하게 만들고 fresh login·human submit 성공 결과 직전에 helper를 await했다. JSON·CI·비TTY gate와 helper rejection fail-soft wrapper를 추가했다. |
| `packages/codex-usage-profile-cli/test/cli.test.js` | 결과 출력 대기 순서, active shortcut과 비대상 command, auto-login single prompt, JSON·CI·비TTY 생략, login/submit 실패와 helper rejection 회귀 test를 추가했다. |
| `mydocs/working/task_m100_91_stage2.md` | Stage 2 구현·검증 결과, 잔여 위험과 Stage 3 전달 사항을 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 `writeSubmitOutput()`과 status/logout/help/version 경로는 수정하지 않았다. login·submit의 원래 성공 문구와 JSON projection도 바꾸지 않고, 승인된 interactive human 경계에서만 optional helper await를 삽입했다. helper에는 env와 stdin/stdout, JSON 여부만 전달하며 submit credential이나 성공 응답은 전달하지 않는다.

## 검증 결과

실행 명령:

```bash
npm --workspace packages/codex-usage-profile-cli test
git diff --check
```

결과:

- OK — CLI package 전체 test 64개 통과, 실패·취소·건너뜀 0개.
- OK — fresh login과 human submit에서 helper 진입 뒤 resolve 전까지 `Login complete.` 또는 `Usage submitted successfully.`가 출력되지 않음을 확인했다.
- OK — helper에는 active env, stdin/stdout과 `json: false`만 전달되고 credential이나 submit 응답은 전달되지 않음을 확인했다.
- OK — 자동 login submit에서 helper가 submit 성공 경계에서 정확히 1회 호출됨을 확인했다.
- OK — 유효 credential login shortcut, status, logout, help, version, JSON, CI, stdin/stdout non-TTY에서는 helper 호출이 0회임을 확인했다.
- OK — login/submit 자체 실패에서는 helper 호출이 0회이고, helper rejection에서는 원래 성공 결과와 exit code 0이 보존되며 raw 오류 marker가 출력되지 않음을 확인했다.
- OK — JSON submit stdout이 prompt 없이 parse 가능한 단일 document로 유지됨을 확인했다.
- OK — `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- 사용자에게 보이는 optional `gh` 요구사항, active account 경계, Enter 기본 Yes와 제외 환경은 아직 공식 문서에 반영되지 않았다. Stage 3에서 구현과 일치하게 문서화해야 한다.
- default helper의 실제 local `gh`·network 동작은 Stage 1의 fake runner test로 검증하며 test suite에서 외부 star mutation은 의도적으로 실행하지 않는다.
- CLI와 core가 각각 eligibility를 확인한다. 이중 gate는 JSON·CI·비TTY에서 injected helper 호출까지 막고 default helper에서도 재확인하기 위한 방어이며, Stage 3 문서의 적용 조건은 두 gate의 공통 계약과 맞춰야 한다.

## 다음 단계 영향

- Stage 3은 `docs/cli-submit.md`와 `packages/codex-usage-profile-cli/README.md`만 수정한다.
- 문서에는 fresh login과 성공한 interactive human submit의 결과 직전 prompt, auto-login submit 1회, existing shortcut과 JSON·CI·비TTY·실패 경로 제외를 명시한다.
- `(Y/n)`의 Enter 기본 Yes, active local `gh` account가 star 주체임, browser와 제품 OAuth/submit credential을 사용하지 않는 경계를 설명한다.
- package test, root test, local npm package smoke와 public release surface scan으로 최종 통합 검증을 수행한다.

## 승인 요청

- Stage 2의 login·submit 성공 흐름 통합, CLI 회귀 test와 검증 결과를 승인하면 Stage 3 사용자 문서와 package 통합 검증으로 진행한다.
