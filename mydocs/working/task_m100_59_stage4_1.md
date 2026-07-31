# Task M100 #59 Stage 4.1 완료보고서

GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
구현계획서: [`task_m100_59_impl.md`](../plans/task_m100_59_impl.md)
Stage: 4.1

## 단계 목적

local QA에서 device authorization은 성공했지만 downstream analyzer가
실패한 경우에도 브라우저가 `Approved`를 표시해 usage submit까지
성공한 것으로 오해할 수 있음을 확인했다. 브라우저의 책임을 device
authorization 완료로 명확히 한정하고, 최종 제출 성공·실패는 terminal에서
확인하도록 문구와 회귀 test를 정렬한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/deviceApproval.js` | submit/login/no-intent별 authorization 완료와 terminal 후속 행동 문구 분리 |
| `src/profile-ui/DeviceApprovalPage.jsx` | terminal button을 `Device approved`로 변경하고 authorization-scoped aria label 적용 |
| `src/profile-ui/__tests__/deviceApproval.test.js` | 세 intent의 exact guidance 문구 검증 |
| `tests/profile-ui.spec.js` | button accessible name과 submit/no-intent 완료 문구 회귀 검증 |
| `docs/cli-submit.md` | `Device approved`가 usage submit 성공을 의미하지 않는다고 명시 |
| `packages/codex-usage-profile-cli/README.md` | npm 사용자를 위한 device 승인과 final submit 결과 책임 분리 |
| `mydocs/plans/task_m100_59_impl.md` | 승인된 Stage 4.1 범위·검증·커밋 계획 반영 |
| `mydocs/orders/20260731.md` | Task #59를 Stage 4.1 완료보고 승인 대기로 갱신 |
| `mydocs/working/task_m100_59_stage4_1.md` | 문구 보정과 검증 결과 기록 |

## 본문 변경 정도 / 본문 무손실 여부

device approval state machine, backend response, token exchange, intent,
retry/error와 motion은 변경하지 않았다. 성공 button의 visible label과
success guidance만 device-scoped 의미로 바꿨다.

verification URL query의 `user_code` 자동 채움은 유지한다. 이 값은
service/Codex token이 아니라 단기 one-time user code이며, 사용자가
`Approve device`를 눌러야만 승인된다. 자동 submit, redirect, clipboard,
command execution과 browser storage write를 추가하지 않았다.

공식 문서는 기존 Browser 승인 흐름을 보존하면서 승인 완료와 usage submit
성공이 다른 상태라는 설명만 추가했다. `.openai/hosting.json`과 production
runtime/backend는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/deviceApproval.test.js
npm run build
npm run test:e2e -- --grep "device approval"
git diff --check
git diff 7b3e8ec -- .openai/hosting.json
```

결과:

- OK — device approval helper unit: 5 tests, 5 pass, 0 fail.
- OK — Vite production build: 42 modules transformed.
- OK — focused Playwright: 4 tests, 4 pass, 0 fail.
- OK — `Device approved` accessible name, submit final-result 안내,
  login local command, no-intent authorization 완료 문구를 검증.
- OK — double submit 방지, terminal success, error retry/lock,
  reduced-motion, clipboard, URL/storage 무변경 계약 유지.
- OK — `git diff --check` 경고 없음.
- OK — Stage 4 commit 기준 `.openai/hosting.json` diff 없음.
- 실제 Sites deploy와 production API 호출은 수행하지 않았다.

첫 focused Playwright 실행은 사용자가 실행한 `npm ci`로 Playwright
revision이 lockfile 기준으로 변경된 뒤 해당 Chromium이 없어 시작 전에
실패했다. 요구 revision을 설치하고 같은 4건을 재실행해 모두 통과했다.
제품 assertion 실패는 없었다.

## 잔여 위험

- 브라우저는 구조상 downstream analyzer/usage submit 결과를 알지 못한다.
  이번 문구가 이 책임 경계를 명시하며, browser에 최종 submit 결과를
  동기화하는 별도 job/channel은 MVP 범위에 추가하지 않았다.
- `Device approved` 이후 Codex 미설치, analyzer 오류, network 오류 등은
  terminal에서 최종 확인해야 한다.

## 다음 단계 영향

- Task #59 구현 Stage가 모두 완료됐다. 다음 절차는 `task-final-report`를
  사용한 최종 보고서 작성과 `publish/task59` PR 게시다.
- 최종 보고서에는 `Device approved`가 device authorization 완료만
  의미하고 최종 submit 결과는 terminal 소유라는 경계를 포함해야 한다.

## 승인 요청

- Stage 4.1 산출물과 검증 결과를 승인하면 Task #59 최종 보고서와 PR
  게시 절차로 진행한다.
