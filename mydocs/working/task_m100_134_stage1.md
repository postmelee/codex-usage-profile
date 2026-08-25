# Task #134 Stage 1 완료보고서 — 파일 credential 재인증과 제출 재개

GitHub Issue: [#134](https://github.com/postmelee/codex-usage-profile/issues/134)
구현계획서: [`task_m100_134_impl.md`](../plans/task_m100_134_impl.md)
Stage: 1

## 단계 목적

저장된 file credential로 제출한 최초 요청이 HTTP 401/410이면 기존 credential을 선제 삭제하지 않고
device approval을 한 번 다시 수행한 뒤, 같은 Account Usage Contract document를 새 credential로 정확히
한 번 재제출하도록 CLI orchestration을 보정한다. environment credential과 인증 외 오류는 자동
재인증에서 제외하고 JSON stdout의 단일 document 계약을 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/cli.js` | JSON 전용 login output stream, file auth recovery 1회, submit credential helper와 analyzer document memoization 추가 |
| `packages/codex-usage-profile-cli/test/cli.test.js` | file 401/410, 실패 보존, 두 번째 auth failure, environment/non-auth 분리와 JSON output matrix 추가 |
| `mydocs/orders/20260825.md` | Stage 1 완료와 Stage 2 승인 대기 상태 기록 |
| `mydocs/working/task_m100_134_stage1.md` | Stage 1 구현·검증·잔여 위험 기록 |

소스 변경량은 `cli.js` 82줄 추가·32줄 제거, `cli.test.js` 239줄 추가다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. server API, device-login API, credential schema,
`submit.js`의 analyzer/error/network retry 계약은 변경하지 않았다. 기존 credential 없음 자동 login,
정상 file/environment submit, star prompt eligibility와 human/JSON 최종 결과 형식은 유지했다.

구체적인 동작 변경은 다음에 한정된다.

- file credential의 최초 `submit_auth_failed`만 reconnect 안내와 device login 뒤 한 번 복구한다.
- analyzer result를 command 범위에서 memoize해 최초·재시도 요청이 같은 document object를 사용한다.
- 재인증 성공 전 credential remove/save를 추가하지 않았고 device login의 기존 atomic save에 맡긴다.
- environment credential 401/410은 login 없이 `CODEX_USAGE_PROFILE_TOKEN` unset과 submit 재실행을
  안내한다.
- JSON submit의 device approval 안내는 stderr, 최종 JSON은 stdout으로 분리한다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js packages/codex-usage-profile-cli/test/submit.test.js
git diff --check
```

결과:

- OK — Node test 30개 통과, 실패·취소·skip 0개.
- OK — file HTTP 401/410 모두 analyzer 1회, login 1회, submit 2회 상한과 새 token 사용을 확인했다.
- OK — 최초와 재시도 request의 Account Usage Contract document identity가 동일했다.
- OK — device login 실패에서는 submit 1회로 종료되고 이전 token·record ID·device ID가 유지됐다.
- OK — 교체 credential도 401/410이면 추가 login 없이 두 번째 submit 오류로 종료됐다.
- OK — environment 401은 login을 호출하거나 credential token을 교체·삭제하지 않고 unset 안내를
  반환했다.
- OK — 409 인증 외 오류는 login 없이 기존 `submit_conflict`로 종료됐다.
- OK — credential 없음과 revoked file의 JSON login 안내는 stderr에만 존재하고 stdout은 한 번
  `JSON.parse` 가능한 submit 결과였다.
- OK — old/new/environment token과 raw login failure 문자열이 stdout·stderr에 노출되지 않았다.
- OK — `git diff --check` 경고 없음.

분리 worktree에 `node_modules`가 없어 최초 실행은 module resolution 전에 중단됐다. 주 worktree의 이미
설치된 dependency directory를 임시 read-only source로 연결해 위 명령을 다시 실행했고, 검증 후 연결을
제거해 task 산출물에는 남기지 않았다.

## 잔여 위험

- 실제 production device approval과 submit API를 이용한 수동 smoke는 Stage 1 범위에 포함하지 않았다.
  Stage 4 package smoke와 별도 release gate에서 실제 게시·배포 전 확인해야 한다.
- 두 번째 credential도 인증 실패하면 기존 `submit_auth_failed` 문구가 `login` 수동 실행을 안내한다.
  추가 loop를 막기 위한 의도된 fail-closed 동작이며 Stage 3 상세 가이드에서 경계를 설명한다.
- command별 help와 invalid input hint는 Stage 2, 웹·README의 사용자 안내 정합성은 Stage 3에 남아 있다.

## 다음 단계 영향

- Stage 2는 `cli.js`의 전역 usage/parser를 보정하되 Stage 1의 `loginOutput`, `loginForSubmit`,
  `submitWithCredential`, analyzer memoization과 auth recovery catch를 변경하지 않는다.
- help/version은 credential store load, client 생성과 analyzer 실행 전에 반환해 Stage 1 side effect를
  만들지 않아야 한다.
- Stage 3 문서에는 file credential은 자동 재승인·재제출되고 environment credential은 unset이
  필요하다는 최종 계약을 반영한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 전역·명령별 help와 오류 탐색성 구현으로 진행한다.
