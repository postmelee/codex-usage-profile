# Task #91 Stage 3.6 보고서 — 재리뷰 범위·terminal prompt 정합성 보정

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
재리뷰: [PR #93 issuecomment-5267591084](https://github.com/postmelee/codex-usage-profile/pull/93#issuecomment-5267591084)
Stage: 3.6

## 단계 목적

재리뷰에서 확인된 가장 중요한 범위 추적성 문제와 실제 readline 사각지대를 보정한다. Issue #91에 작업지시자가 승인한 Stage 3.3~3.6의 추가 범위·수용·검증 기준을 기록하고, 최신 `devel` 반영으로 생긴 PR 충돌을 해소하며, `TERM=dumb`에서 default readline이 cursor escape를 내지 않게 한다. Enter 기본 Yes로 외부 mutation을 실행하기 전에 active account뿐 아니라 exact repository도 표시한다.

## 산출물

| 파일·외부 산출물 | 변경 요약 |
|---|---|
| GitHub Issue #91 본문 | Stage 3.3~3.6의 작업지시자 승인 문구, 추가 수용 기준과 검증 기준을 추가했다. |
| merge commit `c805635` | 최신 `origin/devel`의 Task #92를 병합하고 `mydocs/orders/20260812.md` 충돌에서 Task #91·#92를 모두 보존했다. |
| `packages/codex-usage-profile-cli/src/github-star.js` | 설명줄에 `postmelee/codex-usage-profile`을 표시하고 prompt에 env를 전달하며 `TERM=dumb`에서 readline terminal mode를 비활성화했다. |
| `packages/codex-usage-profile-cli/test/github-star.test.js` | exact repository 문구를 고정하고 실제 `PassThrough` TTY·default readline의 TERM=dumb Enter·PUT·ESC 0개 회귀를 추가했다. |
| `packages/codex-usage-profile-cli/README.md` | exact repository를 예시에 표시하고 `NO_COLOR` color SGR과 `TERM=dumb` cursor-control 계약을 구분했다. |
| `docs/cli-submit.md` | canonical CLI 문서에 exact repository와 실제 prompt의 color·cursor fallback 차이를 기록했다. |
| `mydocs/plans/task_m100_91.md` | 초기 범위 이후 승인된 Stage 3.3~3.6 범위 확장과 추적 위치를 추가했다. |
| `mydocs/plans/task_m100_91_impl.md` | Stage 3.6 산출물·검증·완료 조건과 후속 제외 범위를 고정했다. |
| `mydocs/working/task_m100_91_stage3_2.md` | 당시 주입 prompt가 실제 readline cursor control을 우회했다는 사실과 Stage 3.6 superseding 계약을 기록했다. |
| `mydocs/report/task_m100_91_report.md` | 범위·산출물·수치·ANSI 계약·후속 후보를 Stage 3.6 결과로 갱신했다. |
| `mydocs/orders/20260812.md` | Task #91 Stage 3.6 진행과 Task #92 완료 기록을 함께 유지했다. |

## 본문 변경 정도 / 본문 무손실 여부

- Issue #91의 기존 배경·목표·초기 범위·수용 기준·label·milestone은 유지하고 승인된 범위 확장 절만 덧붙였다.
- `maybePromptGithubStar()`의 TTY·JSON·CI eligibility, active account와 star 상태 조회, HTTP 404 분류, Enter 기본 Yes, fixed GET/PUT, timeout, fail-soft와 secret 비노출 계약은 변경하지 않았다.
- `promptForAnswer()`에 이미 상위 helper가 보유한 env를 전달하고 `TERM=dumb`일 때만 readline의 `terminal` option을 false로 바꿨다. `NO_COLOR`는 color SGR opt-out이며 실제 interactive readline cursor control까지 끄는 신호로 확대하지 않았다.
- prompt 설명줄만 exact repository를 포함하도록 보강했다. command argument와 endpoint는 계속 고정 상수에서 생성된다.
- 최신 `devel` 병합에서 Task #92의 source·test·문서를 수정하지 않았고, 충돌한 오늘할일 한 파일에서 두 task 행을 모두 보존했다.
- JSON schema, submit projection, device-login token-limit mapping, Profile·Card hyperlink, README Markdown과 npm entry는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test -- --test-reporter=tap
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

결과:

- OK — star focused test 13개 통과. 실제 default readline에서 TERM=dumb Enter가 fixed PUT 한 번으로 이어지고 전체 output에 ESC byte가 없음을 확인했다.
- OK — CLI package test 71개 통과, 실패·skip 0.
- OK — 최신 devel의 Task #92를 포함한 root test 758개 중 752개 통과, 환경 의존 6개 skip, 실패 0. Miniflare/D1 local socket이 필요한 전체 검증은 샌드박스 밖에서 실행했다.
- OK — local npm package smoke의 6개 경계 통과, exact entry 14개, package id `codex-usage-profile@0.1.1`, packed 18,325 bytes, unpacked 63,639 bytes.
- OK — public release surface 2,500개 blob 검사, blocker 0, large blob skip 0.
- OK — `git diff --check` 통과.
- OK — GitHub Issue #91 본문에서 Stage 3.3~3.6 승인 근거와 추가 수용·검증 기준을 확인했다.
- OK — `origin/devel` merge conflict는 `mydocs/orders/20260812.md` 한 파일이었고 Task #91 진행·Task #92 완료 행을 모두 보존해 merge commit `c805635`로 해결했다.

## 잔여 위험

- `NO_COLOR=""`도 color를 끄는 현재 계약은 test로 고정돼 있지만 공식 NO_COLOR의 non-empty 관례와 엄밀히 다르다. 호환성 영향을 판단하는 별도 이슈가 적절하다.
- Profile·Card의 unsafe URL은 hyperlink가 되지 않지만 raw 평문으로는 출력될 수 있다. 기존 동작이며 output schema·진단성까지 판단해야 하므로 별도 hardening 범위로 남긴다.
- ANSI·terminal helper가 세 module에 분산돼 있다. 공통 module 분리는 동작 보정과 분리된 구조 작업이 적절하다.
- backend public error가 generic `conflict`이므로 device-login 409를 active token 한도로 문맥 매핑한다. `active_token_limit` 구체 code는 backend·client API 변경으로 별도 이슈가 적절하다.

## 다음 단계 영향

- Stage 3.6 소스·문서·보고서를 한 커밋으로 묶어 `publish/task91`에 push하고 PR #93의 Node 20·22·24 CI와 merge 상태를 재확인한다.
- PR 본문의 Stage 3.6·검증 수치·ANSI 계약을 갱신한 뒤 작업지시자가 요청한 보정 반영 comment를 재리뷰 thread에 게시한다.
- 원격 CI와 PR 상태가 확정되기 전에는 merge 가능으로 보고하지 않는다.

## 승인 요청

- 작업지시자의 `보정 진행해줘. 완료 후 보정 반영 내용을 코멘트로 게시해줘.` 지시로 Stage 3.6 구현·검증·Issue·PR 반영까지 승인된 것으로 기록한다.
