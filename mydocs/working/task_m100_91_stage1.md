# Task #91 Stage 1 보고서 — GitHub star prompt core와 fail-soft 경계

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 1

## 단계 목적

CLI command와 분리된 GitHub star prompt core를 구현한다. interactive TTY에서만 local `gh` active account와 기존 star 상태를 확인하고, 명시적인 HTTP 404일 때 `(Y/n)`을 표시한다. Enter 기본 Yes와 고정 repository PUT을 지원하되 optional `gh`의 모든 실패가 제품 login/submit 결과에 전파되지 않는 fail-soft 경계를 먼저 확정하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/github-star.js` | 5초 timeout·16 KiB output 상한의 shell-free `gh` runner, TTY/JSON/CI gate, active account·star 상태 확인, `(Y/n)` 입력 처리와 고정 PUT을 구현했다. |
| `packages/codex-usage-profile-cli/test/github-star.test.js` | 실제 `gh`를 호출하지 않는 11개 focused test로 기본 Yes, 명시적 No, 재질문, fixed args, bounded subprocess, already-starred와 fail-soft 경계를 검증했다. |
| `mydocs/working/task_m100_91_stage1.md` | Stage 1 구현 범위, 검증 결과, 잔여 위험과 Stage 2 전달 사항을 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 CLI command, public package export와 login/submit 동작은 수정하지 않았고 신규 내부 module과 독립 test만 추가했다. Stage 2에서 이 helper를 CLI orchestration에 연결하기 전까지 기존 사용자 동작은 그대로다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
git diff --check
```

결과:

- OK — focused test 11개 통과, 실패·취소·건너뜀 0개.
- OK — JSON, CI, stdin/stdout non-TTY에서 `gh` 호출이 0회임을 확인했다.
- OK — Enter·`y`·`yes`는 고정 PUT 한 번, `n`·`no`는 PUT 0회이며 잘못된 입력은 재질문함을 확인했다.
- OK — existing star, unavailable/unauthenticated/unknown status, prompt 종료·예외와 PUT 실패가 throw 없이 종료됨을 확인했다.
- OK — child process는 executable `gh`와 고정 argument array를 사용하고, timeout 5초·maxBuffer 16 KiB·browser/shell 미사용을 확인했다.
- OK — HTTP status 분류 외 raw error·stderr의 secret marker가 결과나 사용자 출력에 포함되지 않음을 확인했다.
- OK — `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- 실제 login/submit 결과 출력 경계에는 아직 연결되지 않았다. Stage 2에서 helper await 순서와 single-prompt를 CLI test로 검증해야 한다.
- `gh api`의 HTTP 404 표시는 CLI stderr의 안정적인 `HTTP 404` 표기를 분류한다. 그 표기를 얻지 못하는 unknown failure는 안전하게 prompt를 생략하므로 잘못된 star mutation은 발생하지 않지만 안내가 표시되지 않을 수 있다.
- 실제 GitHub account나 network를 사용하는 test는 의도적으로 제외했다. local `gh` 설치·인증 상태와 무관하게 재현 가능한 fake runner 검증만 수행했다.

## 다음 단계 영향

- Stage 2는 `maybePromptGithubStar({ stdin, stdout, env, json })`를 주입 가능한 helper로 사용한다.
- fresh login에서는 device login resolve 뒤 `Login complete.` 직전, submit에서는 server 성공 응답 뒤 `writeSubmitOutput()` 직전에 helper를 await한다.
- existing credential login shortcut과 JSON·비TTY·CI에서는 helper 또는 내부 `gh` 실행이 발생하지 않게 orchestration 회귀 test를 추가한다.
- auto-login submit은 login 경계가 아니라 submit 경계에서 한 번만 helper를 호출한다.

## 승인 요청

- Stage 1의 GitHub star prompt core, focused test와 검증 결과를 승인하면 Stage 2 login·submit 성공 흐름 통합으로 진행한다.
