# Task #91 Stage 3.2 보고서 — star prompt 터미널 UX 보정

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 3.2

## 단계 목적

사용량 제출·fresh login 성공 결과 전에 표시되는 GitHub star 질문을 다른 CLI 출력과 명확히 구분하고, 부담을 줄인 성장 안내 문구와 terminal color를 적용한다. 앞뒤 빈 줄, cyan 제목, 흐린 설명, 기본색 질문, green 성공 문구를 사용하되 제한된 terminal과 자동화 출력의 평문·무출력 계약은 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/github-star.js` | 안내 블록 문구·앞뒤 빈 줄·ANSI color와 `NO_COLOR`·`TERM=dumb` 평문 fallback을 추가했다. |
| `packages/codex-usage-profile-cli/test/github-star.test.js` | color·평문 exact output과 거절·invalid·EOF·실패 뒤 간격을 포함한 focused 회귀 test를 12개로 확장했다. |
| `packages/codex-usage-profile-cli/README.md` | 실제 안내 블록 예시와 color·평문 fallback 계약을 기록했다. |
| `docs/cli-submit.md` | canonical CLI guide의 prompt 예시와 terminal 표현 규칙을 실제 구현에 맞췄다. |
| `mydocs/plans/task_m100_91_impl.md` | 승인된 Stage 3.2 범위·완료 조건·검증·위험을 기록했다. |
| `mydocs/report/task_m100_91_report.md` | 최종 산출물·정량 지표·검증·잔여 위험을 Stage 3.2 결과로 갱신했다. |
| `mydocs/orders/20260812.md` | Task #91 Stage 3.2 진행과 완료 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

- GitHub repository·active account 조회, HTTP 404 분류, Enter 기본 Yes, fixed PUT, timeout, shell-free runner와 fail-soft 보안 경계는 변경하지 않았다.
- prompt가 실제로 표시되는 TTY 경로의 표현만 다중 행 블록으로 바꿨다. JSON·CI·비TTY·already-starred·`gh` unavailable 경로는 신규 문구나 ANSI를 출력하지 않는다.
- 신규 runtime dependency나 npm package entry는 추가하지 않았다.
- 공식 문서는 기존 login·submit 절만 최소 수정했으며 다른 사용자 안내 본문은 보존했다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test -- --test-reporter=dot
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

결과:

- OK — focused test 12개 통과, 실패·skip 0.
- OK — CLI package test 65개 통과, 실패·skip 0.
- OK — root test 745개 중 739개 통과, 환경 의존 6개 skip, 실패 0. Miniflare/D1 local socket이 필요한 전체 검증은 샌드박스 밖에서 실행했다.
- OK — local npm package smoke의 6개 경계 통과, exact entry 14개, package id `codex-usage-profile@0.1.1`, packed 17,445 bytes, unpacked 60,149 bytes.
- OK — public release surface 2,446개 blob 검사, blocker 0, large blob skip 0.
- OK — `git diff --check` 통과.
- OK — 실제 PTY 수동 확인에서 앞 빈 줄 → cyan `Help us grow! 🌱` → bright-black 설명 → 기본색 질문 → Enter → green 성공 문구 → 뒤 빈 줄 순서를 확인했다. 실제 `gh` mutation은 fake runner로 차단했다.

## 잔여 위험

- emoji 폭과 ANSI bright-black의 실제 명도는 terminal·font·theme에 따라 다를 수 있다. 문구와 줄 구조는 동일하며 `NO_COLOR`·`TERM=dumb`에서 ANSI 없는 평문으로 fallback한다.
- color 지원 여부는 실제 TTY, `NO_COLOR` 존재, `TERM=dumb`만으로 보수적으로 판단한다. 사용자가 별도 terminal 설정으로 color를 제한하는 모든 경우를 자동 탐지하지는 않는다.
- 외부 GitHub star mutation을 포함한 end-to-end test는 실행하지 않았다. 고정 `gh` argument와 출력 흐름은 fake runner와 사용자의 운영 수동 테스트로 확인했다.

## 다음 단계 영향

- 추가 구현 Stage는 없다. 이 보고서와 소스·문서를 한 커밋으로 묶어 기존 PR #93의 `publish/task91` head를 갱신하고 Node 20·22·24 CI를 재확인한다.

## 승인 요청

- 작업지시자의 `그렇게 적용해줘.` 지시로 Stage 3.2 구현·검증·기존 PR 반영까지 승인된 것으로 기록한다.
