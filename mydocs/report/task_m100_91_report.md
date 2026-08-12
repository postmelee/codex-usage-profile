# Task #91 최종 보고서 — CLI GitHub star 프롬프트

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
마일스톤: M100

## 작업 요약

- 대상 이슈: #91
- 마일스톤: M100
- 단계 수: 3 + PR·사용자 검토 보정 하위 단계 5
- 작업 목적: interactive login·submit 성공 결과를 표시하기 전에 local `gh` active account로 프로젝트를 star할지 `(Y/n)`으로 묻고 Enter를 기본 Yes로 처리하며, 부담을 줄인 안내 블록과 성공 표시·분리된 Links block·terminal link·color로 결과를 구분한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `packages/codex-usage-profile-cli/src/github-star.js` | TTY/JSON/CI gate, local `gh` account·star 상태 조회, `(Y/n)` 입력과 fixed PUT, bounded fail-soft runner, readline EOF 정착과 color 안내 블록을 추가했다. | interactive CLI의 선택적 GitHub 통합 |
| `packages/codex-usage-profile-cli/src/cli.js` | fresh login과 성공한 human submit의 기존 결과 직전에 star helper를 await하고 env를 output writer에 전달한다. | login·submit orchestration |
| `packages/codex-usage-profile-cli/src/device-login.js` | device-login poll의 409 conflict를 actionable token-limit message로 정규화하고 `NO_COLOR` hyperlink opt-out을 제공한다. | first-run 오류·terminal link 안내 |
| `packages/codex-usage-profile-cli/src/output.js` | 성공 표시와 metadata 뒤의 들여쓴 Links block을 구성하고 지원 TTY에서 Profile·Card URL만 cyan OSC 8 hyperlink로 표시하며 README·JSON·projection을 평문으로 유지한다. | submit 결과 UX·automation 출력 |
| `packages/codex-usage-profile-cli/test/github-star.test.js` | 실제 GitHub mutation 없는 12개 focused test, 실제 TTY stream EOF와 color·평문 exact output 회귀를 추가했다. | core command·입력·오류·표현 경계 회귀 방지 |
| `packages/codex-usage-profile-cli/test/cli.test.js` | 결과 대기 순서, single prompt, link env 전달, 제외 command·환경, 실패·helper rejection 회귀를 검증한다. | CLI 출력·exit status 계약 |
| `packages/codex-usage-profile-cli/test/device-login.test.js` | token-limit 안전 경계와 `NO_COLOR` hyperlink fallback을 검증한다. | device login 오류·표현 경계 |
| `packages/codex-usage-profile-cli/test/output.test.js` | 성공 표시·Links 계층·Profile·Card exact OSC 8·README 평문과 JSON·non-TTY·color opt-out fallback을 검증한다. | submit output 표현·복사 계약 |
| `scripts/verify-npm-release.mjs` | `src/github-star.js`를 exact npm package allowlist에 추가했다. | npm tarball 배포 surface |
| `docs/cli-submit.md` | 기본 Yes, active `gh` account, 적용·제외 조건과 credential 분리 경계를 설명한다. | 공식 CLI 사용자·보안 문서 |
| `packages/codex-usage-profile-cli/README.md` | 배포 package 사용자를 위한 optional `gh` 요구사항과 핵심 계약을 추가했다. | npm package 사용자 문서 |
| `mydocs/plans/task_m100_91.md` | 목적, 범위, 설계, 문서 위치와 잠정 Stage를 기록했다. | task 수행 기준 |
| `mydocs/plans/task_m100_91_impl.md` | 3개 Stage와 Stage 3.1~3.5 보정의 산출물·검증·완료 조건을 고정했다. | task 구현 기준 |
| `mydocs/working/task_m100_91_stage1.md` | core와 fail-soft 검증 결과를 기록했다. | Stage 1 증적 |
| `mydocs/working/task_m100_91_stage2.md` | login·submit 통합 검증 결과를 기록했다. | Stage 2 증적 |
| `mydocs/working/task_m100_91_stage3.md` | 문서·package·전체 통합 검증 결과를 기록했다. | Stage 3 증적 |
| `mydocs/working/task_m100_91_stage3_1.md` | 실제 readline EOF Blocker 보정과 재검증 결과를 기록했다. | Stage 3.1 증적 |
| `mydocs/working/task_m100_91_stage3_2.md` | prompt 문구·간격·color·평문 fallback 보정과 재검증 결과를 기록했다. | Stage 3.2 증적 |
| `mydocs/working/task_m100_91_stage3_3.md` | first-run token 한도 오류 안내와 local logout·server revoke 경계를 기록했다. | Stage 3.3 증적 |
| `mydocs/working/task_m100_91_stage3_4.md` | submit 결과 hyperlink·README 평문·fallback과 local preview 결과를 기록했다. | Stage 3.4 증적 |
| `mydocs/working/task_m100_91_stage3_5.md` | submit 결과 성공 표시·Links 계층·정렬·fallback과 local preview 결과를 기록했다. | Stage 3.5 증적 |
| `mydocs/orders/20260812.md` | Task #91 진행과 완료 시각을 반영했다. | 당일 작업 보드 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/cli-submit.md` | `docs/` | `docs/cli-submit.md` | OK | 기존 canonical login·submit·보안 guide의 관련 절만 최소 수정했다. |
| `packages/codex-usage-profile-cli/README.md` | CLI package root | `packages/codex-usage-profile-cli/README.md` | OK | npm tarball 사용자가 optional integration을 package 안에서 확인할 수 있다. |
| `mydocs/working/task_m100_91_stage{N}.md` | `mydocs/working/` | `mydocs/working/task_m100_91_stage1.md`~`stage3.md`, `stage3_1.md`~`stage3_5.md` | OK | 제품 사용법이 아닌 단계별 구현·검증 증적만 내부 문서로 보관했다. |

root `README.md`와 `mydocs/manual/`은 수행계획서의 문서 위치 판단대로 수정하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| GitHub star prompt core | 없음 | 신규 module 1개, 197줄 |
| core focused test | 없음 | 12개, 모두 통과 |
| CLI package 전체 test | star prompt 회귀 기준 없음 | 70개 통과, 실패 0 |
| npm package exact entry | 13개 | 14개 (`src/github-star.js` 포함) |
| local package smoke | 신규 helper 미포함 | 6개 경계 통과 |
| branch 변경량(Stage 1~3.5 및 계획·보고 문서) | 0 | 23개 파일, +2,551/-20줄 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| fresh interactive login 성공 결과 전에 prompt가 완료된다. | OK — deferred helper test에서 prompt resolve 전 `Login complete.` 미출력을 확인했다. |
| 성공한 human submit 결과 전에 prompt가 완료된다. | OK — server success 뒤 writer 전 await와 결과 대기 순서를 확인했다. |
| Enter·`y`·`yes`는 fixed repository star, `n`·`no`는 skip이다. | OK — focused test에서 고정 PUT 1회 또는 PUT 0회를 검증했다. |
| active local `gh` account를 표시하고 browser·제품 credential을 사용하지 않는다. | OK — `gh api user --jq .login`, fixed argument array와 helper 전달 allowlist를 검증했다. |
| already-starred·unknown `gh` failure는 prompt를 생략하고 제품 결과를 보존한다. | OK — HTTP 404만 not-starred로 분류하고 나머지 실패·timeout·helper rejection을 fail-soft 처리했다. |
| 실제 default readline prompt에서 EOF가 발생해도 성공 결과와 exit status를 보존한다. | OK — TTY `PassThrough` stdin의 `.end()`가 helper를 `false`로 정착시키고 PUT을 호출하지 않음을 확인했다. |
| prompt 블록의 문구·간격·color가 합의한 표현을 따르고 제한된 terminal에서는 평문으로 동작한다. | OK — 실제 PTY에서 앞뒤 빈 줄, cyan 제목, bright-black 설명, 기본색 질문과 green 성공 문구를 확인했고 `NO_COLOR`·`TERM=dumb` exact output에는 ANSI가 없음을 검증했다. |
| browser 승인 뒤 active token 한도에 도달하면 해결 가능한 안전한 오류를 표시한다. | OK — device-login poll의 status 409·code `conflict`만 전용 code와 `Revoke an API token in Settings` message로 바꾸고 credential 비저장·raw message 비노출을 검증했다. |
| submit 성공 결과는 metadata와 Links가 구분되고 Profile·Card는 클릭 가능하되 README·automation 출력은 복사 가능한 평문이다. | OK — `✓` 성공 표시, capture 뒤 빈 줄, bright-black Links 제목과 정렬된 label을 확인했다. 지원 TTY에서 안전한 HTTP(S) Profile·Card만 cyan OSC 8이고 README exact line에는 escape가 없으며 JSON·non-TTY·`NO_COLOR`·`TERM=dumb` fallback을 검증했다. |
| JSON·CI·비TTY와 비대상 command는 prompt나 `gh`를 실행하지 않는다. | OK — helper/runner 호출 0회 및 JSON 단일 document parsing을 확인했다. |
| auto-login submit은 submit 성공 경계에서 한 번만 prompt한다. | OK — CLI orchestration test에서 호출 1회를 확인했다. |
| npm package가 신규 helper를 정확히 포함하고 추가 파일 거부 정책을 유지한다. | OK — exact entry 14개, release verifier와 격리 tarball smoke가 통과했다. |
| 전체 repository 계약에 회귀가 없다. | OK — root test 750개 중 744개 통과, 환경 의존 6개 skip, 실패 0. |
| public release surface에 blocker가 없다. | OK — 2,480개 blob 검사, blocker 0, large blob skip 0. |

### 단계별 검증 결과

- Stage 1: [`task_m100_91_stage1.md`](../working/task_m100_91_stage1.md) — core focused test 11개와 shell-free bounded runner·fail-soft 경계 통과.
- Stage 2: [`task_m100_91_stage2.md`](../working/task_m100_91_stage2.md) — login·submit 결과 순서와 eligibility·failure 회귀를 포함한 package test 통과.
- Stage 3: [`task_m100_91_stage3.md`](../working/task_m100_91_stage3.md) — 공식 문서, exact npm allowlist, root test·tarball smoke·release scan 통과.
- Stage 3.1: [`task_m100_91_stage3_1.md`](../working/task_m100_91_stage3_1.md) — 실제 readline EOF 정착, PTY Ctrl+C와 전체 재검증 통과.
- Stage 3.2: [`task_m100_91_stage3_2.md`](../working/task_m100_91_stage3_2.md) — 안내 블록 문구·간격·color·평문 fallback, 실제 PTY와 전체 재검증 통과.
- Stage 3.3: [`task_m100_91_stage3_3.md`](../working/task_m100_91_stage3_3.md) — active token 한도 오류 안내, raw detail 비노출과 local logout·server revoke 경계 재검증 통과.
- Stage 3.4: [`task_m100_91_stage3_4.md`](../working/task_m100_91_stage3_4.md) — Profile·Card cyan OSC 8, README 평문, automation fallback과 무변경 local preview 검증 통과.
- Stage 3.5: [`task_m100_91_stage3_5.md`](../working/task_m100_91_stage3_5.md) — 성공 표시, capture와 Links 분리, label 정렬, color·hyperlink·평문 fallback과 무변경 local preview 검증 통과.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 GitHub account의 star 상태를 변경하는 end-to-end test는 외부 mutation을 피하기 위해 실행하지 않았다. local `gh` 동작은 fake runner와 packed artifact 경계로 검증했다.
- 각 `gh` operation timeout은 5초이므로 느린 local/network 환경에서는 기존 성공 결과 표시가 선택적 확인 동안 지연될 수 있다. 상태를 확정할 수 없으면 prompt를 생략한다.
- Enter가 외부 star mutation을 수행하므로 terminal prompt와 두 공식 문서에 `(Y/n)`, active account와 대상 repository를 명시했다.
- 명시적 No를 별도로 기억하지 않지만 현재 CLI command 흐름은 helper를 최대 한 번 호출한다. 향후 한 프로세스에서 여러 성공 작업을 처리하는 흐름이 추가되면 반복 질문 억제를 별도 설계해야 한다.
- emoji 폭과 bright-black 명도는 terminal·font·theme에 따라 다를 수 있다. `NO_COLOR` 또는 `TERM=dumb`에서는 같은 문구와 간격을 ANSI 없는 평문으로 표시한다.
- device-login poll의 409 conflict는 active token 한도로 안내한다. backend error envelope가 세부 원인을 숨기므로 극히 드문 storage conflict도 같은 message가 될 수 있지만, endpoint·status·code를 함께 제한해 submit과 다른 conflict는 보존했다.
- OSC 8 link 활성 신호와 click 방식은 terminal마다 다르다. 미지원 terminal은 plain URL을 유지하고 수동 확인에는 `FORCE_HYPERLINK=1` preview를 제공한다.
- 긴 URL과 README Markdown은 terminal 폭에 따라 자연스럽게 줄바꿈된다. 짧은 label column만 정렬하고 URL 본문에는 padding을 넣지 않아 복사 값을 보존한다.

### 후속 작업 후보

- 실제 운영에서 prompt 전 `gh` 조회 지연이 문제로 관찰되면 전체 latency budget 또는 상태 조회 병렬화·cache를 별도 이슈로 분리한다.
- local `gh` 버전별 호환 또는 한 프로세스 내 반복 prompt 요구가 생기면 이번 EOF Blocker와 분리해 다룬다.
- preview runner는 task91 worktree source의 절대 경로를 사용하므로 PR 검토 기간의 수동 확인 전용이며 worktree 정리 뒤에는 제거된다.

## 작업지시자 승인 요청

- 기존 PR #93의 owner review와 작업지시자의 terminal UX·first-run·submit link·결과 계층 검토를 반영했다. Stage 3.5 commit을 `publish/task91`에 게시하고 수용 기준과 CI를 다시 확인한다.
