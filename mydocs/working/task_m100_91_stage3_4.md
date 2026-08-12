# Task #91 Stage 3.4 보고서 — submit 결과 URL hyperlink 보정

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 3.4

## 단계 목적

성공한 human-readable submit 결과에서 사용자가 자주 여는 Profile·Card URL의 탐색성을 device login `Open:`과 동일하게 높인다. 복사용 README Markdown과 JSON·automation 출력에는 terminal control sequence가 섞이지 않도록 출력 계약을 분리하고, 외부 변경 없는 로컬 preview 경로를 제공한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/output.js` | 지원 TTY의 안전한 HTTP(S) Profile·Card URL만 cyan OSC 8 hyperlink로 표시하고 projection·README는 평문으로 유지했다. |
| `packages/codex-usage-profile-cli/src/cli.js` | CLI env와 hyperlink override를 submit output writer에 전달했다. |
| `packages/codex-usage-profile-cli/src/device-login.js` | 공통 terminal hyperlink eligibility에 `NO_COLOR` opt-out을 추가했다. |
| `packages/codex-usage-profile-cli/test/output.test.js` | exact Profile·Card OSC 8, README 평문, JSON·non-TTY·color opt-out fallback 회귀를 추가했다. |
| `packages/codex-usage-profile-cli/test/cli.test.js` | 실제 submit orchestration이 env를 writer에 전달해 link를 표시하고 README를 보존함을 검증했다. |
| `packages/codex-usage-profile-cli/test/device-login.test.js` | `NO_COLOR`에서 device login hyperlink도 비활성화됨을 검증했다. |
| `packages/codex-usage-profile-cli/README.md` | submit 결과 link 범위와 README·fallback 계약을 기록했다. |
| `docs/cli-submit.md` | canonical CLI guide의 성공 결과 예시에 link·복사·fallback 동작을 설명했다. |
| `mydocs/plans/task_m100_91_impl.md` | 승인된 Stage 3.4 범위·검증·완료 조건과 preview 위치를 기록했다. |
| `mydocs/report/task_m100_91_report.md` | 최종 산출물·정량 지표·검증·잔여 위험을 Stage 3.4 결과로 갱신했다. |
| `mydocs/orders/20260812.md` | Task #91 Stage 3.4 진행과 완료 상태를 반영했다. |
| `/private/tmp/cup-task91-manual-first-run/preview-output.mjs` | 네트워크·credential·star mutation 없이 실제 terminal link 표현을 재현한다. repository commit에는 포함하지 않는다. |

## 본문 변경 정도 / 본문 무손실 여부

- `projectSubmitOutput()`의 반환값과 JSON document는 기존 plain URL·Markdown을 그대로 유지한다. ANSI·OSC 8은 human display write 단계에만 적용한다.
- `Profile:`과 `Card:`의 유효한 HTTP(S) URL만 link 처리한다. `README:` 전체는 exact plain Markdown이며 ANSI나 OSC 8을 삽입하지 않는다.
- non-TTY, JSON, `NO_COLOR`, `TERM=dumb`, `FORCE_HYPERLINK=0`, hyperlink 미지원 terminal과 명시적 disable은 기존 평문 출력이다.
- device login·star prompt·token-limit message·credential redaction·submit 순서와 npm package entry는 변경하지 않았다.
- 신규 runtime dependency는 없다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/output.test.js packages/codex-usage-profile-cli/test/device-login.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test -- --test-reporter=dot
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

결과:

- OK — output·device-login focused test 14개 통과, 실패·skip 0. CLI orchestration까지 포함한 focused 확인은 32개 통과.
- OK — CLI package test 69개 통과, 실패·skip 0.
- OK — root test 749개 중 743개 통과, 환경 의존 6개 skip, 실패 0. Miniflare/D1 local socket이 필요한 전체 검증은 샌드박스 밖에서 실행했다.
- OK — local npm package smoke의 6개 경계 통과, exact entry 14개, package id `codex-usage-profile@0.1.1`, packed 17,941 bytes, unpacked 62,176 bytes.
- OK — public release surface 2,468개 blob 검사, blocker 0, large blob skip 0.
- OK — `git diff --check` 통과.
- OK — PTY preview에서 지원 환경은 Profile·Card를 link로 렌더링하고 `NO_COLOR=1`은 동일 세 줄을 평문으로 표시했다. preview는 외부 네트워크나 상태 변경을 수행하지 않았다.

## 잔여 위험

- OSC 8 클릭 방식은 terminal마다 단일 click 또는 modifier-click 등 상호작용이 다르다. 지원 신호가 없으면 평문 URL이 남는다.
- cyan의 실제 색감은 terminal theme에 따라 다르다. `NO_COLOR`와 `TERM=dumb`에서는 색·OSC 8을 모두 제거한다.
- preview runner는 현재 task91 worktree의 source 절대 경로를 import하므로 해당 worktree가 정리되면 사용할 수 없다. PR 검토 기간의 수동 확인 전용이다.

## 다음 단계 영향

- 이 보고서와 repository 산출물을 한 커밋으로 묶어 기존 PR #93의 `publish/task91` head를 갱신하고 Node 20·22·24 CI를 재확인한다.
- 작업지시자는 `FORCE_HYPERLINK=1 node /private/tmp/cup-task91-manual-first-run/preview-output.mjs`로 외부 변경 없이 즉시 확인하거나 기존 격리 runner의 `submit`으로 production 결과를 확인할 수 있다.

## 승인 요청

- 작업지시자의 `링크 변경도 적용해주고 내가 로컬에서 테스트할 수 있게 해줘.` 지시로 Stage 3.4 구현·검증·preview 제공·기존 PR 반영까지 승인된 것으로 기록한다.
