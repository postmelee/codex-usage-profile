# Task #91 Stage 3.5 보고서 — submit 결과 Links block 가독성 보정

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 3.5

## 단계 목적

성공한 human-readable submit 결과에서 metadata와 복사 가능한 링크가 붙어 보이는 문제를 보정한다. 작업지시자가 선택한 두 번째 구조에 따라 성공 표시, capture metadata, 분리된 `Links` block의 시각 계층을 만들되 Stage 3.4의 Profile·Card hyperlink, README 평문과 automation fallback 계약을 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/output.js` | 성공 문구에 `✓`를 추가하고 capture 뒤 빈 줄, color TTY의 bright-black `Links` 제목, 들여쓰기·label 정렬을 적용했다. |
| `packages/codex-usage-profile-cli/test/output.test.js` | exact 성공 표시·Links 구조·color·hyperlink·평문 fallback과 profile 산출물 없음 회귀를 검증했다. |
| `packages/codex-usage-profile-cli/test/cli.test.js` | 실제 submit orchestration의 새 구조와 README exact line을 검증했다. |
| `packages/codex-usage-profile-cli/README.md` | npm 사용자가 보게 될 성공 결과 예시와 Links color·fallback 계약을 기록했다. |
| `docs/cli-submit.md` | canonical CLI guide 예시를 성공 표시·metadata·Links 구조로 갱신했다. |
| `mydocs/plans/task_m100_91_impl.md` | 승인된 Stage 3.5 범위·검증·완료 조건과 위험 대응을 기록했다. |
| `mydocs/report/task_m100_91_report.md` | 최종 산출물·정량 지표·검증 결과를 Stage 3.5 기준으로 갱신했다. |
| `mydocs/orders/20260812.md` | Stage 3.5 진행과 완료 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

- `projectSubmitOutput()`의 projection과 `--json` schema는 변경하지 않았다. human-readable display layout만 보정했다.
- Profile·Card의 유효한 HTTP(S) URL만 cyan OSC 8 hyperlink로 표시하는 Stage 3.4 경계를 유지했다.
- README Markdown 값 자체는 변경하지 않고 `  README:  ` label 뒤에 exact plain text로 출력한다.
- non-TTY, `NO_COLOR`, `TERM=dumb`에서는 같은 성공 표시·빈 줄·들여쓰기 구조를 ANSI 없이 유지한다.
- profile 산출물이 모두 없으면 빈 줄이나 `Links` 제목을 추가하지 않는다.
- star prompt·device login·credential·submit request·npm package entry와 runtime dependency는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/output.test.js packages/codex-usage-profile-cli/test/cli.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test -- --test-reporter=dot
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

결과:

- OK — output·CLI focused test 26개 통과, 실패·skip 0.
- OK — CLI package test 70개 통과, 실패·skip 0.
- OK — root test 750개 중 744개 통과, 환경 의존 6개 skip, 실패 0. Miniflare/D1 local socket이 필요한 전체 검증은 샌드박스 밖에서 실행했다.
- OK — local npm package smoke의 6개 경계 통과, exact entry 14개, package id `codex-usage-profile@0.1.1`, packed 18,232 bytes, unpacked 63,342 bytes.
- OK — public release surface 2,480개 blob 검사, blocker 0, large blob skip 0.
- OK — `git diff --check` 통과.
- OK — local preview에서 color·hyperlink 경로와 `NO_COLOR=1` 평문 경로 모두 성공 표시, capture 뒤 빈 줄, 들여쓴 Links block을 표시했다. preview는 외부 네트워크나 상태 변경을 수행하지 않았다.

## 잔여 위험

- 긴 URL과 README Markdown은 terminal 폭에 따라 줄바꿈된다. label 뒤 URL 본문에 인위적인 공백을 넣지 않아 복사 값은 보존한다.
- bright-black 명도와 OSC 8 click 방식은 terminal·theme마다 다르다. 제한된 환경에서는 같은 구조의 평문을 유지한다.
- `✓` glyph의 폭·모양은 font에 따라 다르지만 링크 label column 정렬과 분리되어 URL 정렬에는 영향을 주지 않는다.

## 다음 단계 영향

- 이 보고서와 Stage 3.5 산출물을 한 커밋으로 묶어 기존 PR #93의 `publish/task91` head를 갱신하고 Node 20·22·24 CI를 재확인한다.
- 작업지시자는 `FORCE_HYPERLINK=1 node /private/tmp/cup-task91-manual-first-run/preview-output.mjs`로 외부 변경 없이 새 구조를 확인할 수 있다.

## 승인 요청

- 작업지시자의 `두번째로 적용해줘,` 지시로 Stage 3.5 구현·검증·문서화·기존 PR 반영까지 승인된 것으로 기록한다.
