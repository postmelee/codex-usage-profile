# Task #91 Stage 3.1 완료 보고서 — PR 리뷰 EOF 차단 항목 보정

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 3.1

## 단계 목적

PR #93 owner review에서 확인된 실제 `readline.question()` EOF 미정착을 최소 범위로
보정한다. stdin이 Ctrl+D/EOF로 닫혀도 optional GitHub star 질문이 남아 login·submit의
성공 결과와 exit status를 억제하지 않게 하고, 주입 prompt가 아닌 기본 readline 경로의
실제 TTY stream 회귀로 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/github-star.js` | 질문 결과와 readline `close` event를 race하고 EOF를 `null`로 정규화 |
| `packages/codex-usage-profile-cli/test/github-star.test.js` | TTY `PassThrough` input/output과 `.end()`를 사용하는 실제 default prompt EOF 회귀 추가 |
| `mydocs/plans/task_m100_91_impl.md` | Stage 3.1 포함·제외 범위, 검증과 commit 경계 기록 |
| `mydocs/orders/20260812.md` | PR 리뷰 보정 진행·완료 상태 기록 |
| `mydocs/report/task_m100_91_report.md` | EOF 수용 기준, Stage 3.1 증적과 재검증 수치 반영 |

새 공식 제품 문서를 만들거나 수정하지 않았다. 명시적 No 기억, prompt 이전 `gh` 조회
지연 개선과 eligibility 중복 제거는 리뷰 Blocker 해결에 필요하지 않아 이번 단계에서
제외했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 변경 단계이므로 문서 본문 무손실 여부는 해당하지 않는다. Enter 기본 Yes,
`n`/`no` 거절, invalid input 재질문, 결과 이전 prompt 배치, local `gh` active account와
fixed repository를 사용하는 계약은 유지했다. EOF가 interface `close` event에서 거절과
동일한 `false`로 정착되는 경계만 보강했다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/github-star.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

보조 검증:

```text
TTY PTY에서 star prompt 표시 뒤 Ctrl+C 입력
```

결과:

- focused core: 실제 default readline EOF 회귀를 포함해 11/11 통과
- CLI package: 64/64 통과, 실패·skip 0
- 전체 repository: 744개 중 738개 통과, 외부 Postgres/S3 조건 6개 skip, 실패 0
- local npm package smoke: `checksVerified: 6`, `entryCount: 14`, `ok: true`
- public release scan: 2,436개 blob 검사, blocker 0, large blob skip 0
- `git diff --check`: 이상 없음
- 실제 PTY Ctrl+C: `result=false`, `calls=2`, exit 0으로 기존 fail-soft 동작 유지

분리 worktree의 첫 전체 test는 root `node_modules`가 연결되지 않아 font fixture를 찾지
못한 환경 오류 1건이 발생했다. root dependency를 임시 symlink한 뒤 해당 test 단독과
전체 suite가 통과했으며 검증 후 symlink를 제거했다. local package smoke의 첫 실행도
격리 npm install 네트워크 제한으로 중단되어 동일 명령을 네트워크 허용 환경에서
재실행해 통과했다.

## 잔여 위험

- 각 `gh` operation의 5초 timeout 때문에 account 조회와 star 상태 확인이 느린 환경에서는
  prompt 또는 성공 결과 표시 전 지연이 생길 수 있다.
- 명시적 No를 별도로 저장하지 않으므로 한 프로세스에서 helper가 여러 번 호출되는 새
  흐름이 도입되면 반복 질문 억제 정책을 별도 설계해야 한다. 현재 CLI command 흐름은
  대상 성공 경계에서 helper를 최대 한 번 호출한다.
- 실제 GitHub repository star mutation은 외부 상태 변경을 피하기 위해 fake runner로만
  검증했다.

## 다음 단계 영향

- 이 단계의 source·문서 commit을 기존 `publish/task91` PR #93에 push하고 CI를 확인한다.
- PR owner comment에는 EOF 원인, 실제 stream 회귀, Ctrl+C와 전체 검증 결과를 답변한다.
- 나머지 UX·latency 제안은 병합 차단 보정에 섞지 않고 필요 시 별도 이슈로 분리한다.

## 승인 요청

- 작업지시자가 Stage 3.1 EOF Blocker 보정을 승인했다. 산출물과 전체 검증 결과를 기존
  PR #93과 최종 보고서에 반영한다.
