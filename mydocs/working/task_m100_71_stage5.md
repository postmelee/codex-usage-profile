# Task M100 #71 Stage 5 보고서 — 통합 locale 회귀 검증

GitHub Issue: [#71](https://github.com/postmelee/codex-usage-profile/issues/71)
연결 Issue: [#72](https://github.com/postmelee/codex-usage-profile/issues/72), [#73](https://github.com/postmelee/codex-usage-profile/issues/73)
구현계획서: [`task_m100_71_impl.md`](../plans/task_m100_71_impl.md)
Stage: 5

## 단계 목적

Stage 2~4에서 구현한 compact number formatter, Marketing locale custom copy 계약과 Share
Studio 단일 보간·접근성 이름을 함께 검증한다. 전체 Node·browser E2E·production build와
Sites artifact 검증을 실행하고 #71·#72·#73 통합 PR의 최종 보고 단계 진입 조건을 확인한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `tests/profile-ui.spec.js` | Profile Share 버튼의 Stage 4 접근성 이름과 기존 theme·locale 회귀 선택자 4곳을 정렬했다. |
| `mydocs/orders/20260804.md` | #71·#72·#73의 구현·통합 회귀 완료와 최종 보고·PR 승인 대기 상태를 기록했다. |
| `mydocs/working/task_m100_71_stage5.md` | Stage 5 전체 검증 결과, 제외 범위와 잔여 위험을 기록했다. |

전체 E2E 첫 실행에서 발생한 4건은 버튼의 보이는 `Share`/`공유` 문구를 찾던 기존
Profile 한정 선택자가 Stage 4에서 구체화한 `Share profile`/`프로필 공유` 접근성 이름을
따르지 않은 회귀 test drift였다. 제품 동작은 변경하지 않고 해당 선택자만 새 접근성
계약으로 정렬한 뒤 전체 E2E를 다시 실행했다.

## 본문 변경 정도 / 본문 무손실 여부

제품 source, locale catalog, formatter, Marketing config, share destination과 social payload는
Stage 5에서 변경하지 않았다. Profile Share 버튼의 보이는 문구와 클릭 동작도 유지했다.
package·lockfile, backend/API, CLI, card renderer, `.openai/hosting.json`과 배포 설정에는
Stage 시작점 대비 diff가 없다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- OK — Node 전체 575 tests, 569 pass, 0 fail, 6 skip. skip은 환경 변수가 없는 기존
  PostgreSQL·S3 integration test이다.
- OK — Playwright 전체 64 tests, 64 pass. 영어·한국어·fallback locale, Marketing,
  Profile, Settings, Share Studio와 public profile 회귀를 확인했다.
- OK — production Sites full-stack client·server build가 완료되었다.
- OK — `verify:sites-fullstack`은 client 7 files, worker 2 files, migrations 3 files와
  hosted mode를 확인했다.
- OK — `verify:sites-production`은 client 7 files, worker 2 files, migrations 3 files,
  expected bindings 3개를 확인했다.
- OK — `git diff --check`가 통과했다.
- OK — `devel...HEAD`와 Stage 5 working diff를 확인해 package·lockfile, backend/API,
  CLI, card renderer, `.openai/hosting.json`과 배포 설정 변경이 없음을 확인했다.
- OK — #71 compact 경계·exact count, #72 default/partial custom locale source, #73
  platform 보간·공유 접근성 수용 기준이 Stage 2~4 unit/E2E와 보고서에 연결되어 있다.

## 잔여 위험

- `TEST_DATABASE_URL`과 test S3 환경이 없어 PostgreSQL·S3 integration 6건은 기존대로
  skip되었다. 이번 변경은 데이터 저장소·API·배포 설정을 수정하지 않으며 관련 unit,
  browser와 artifact 회귀는 모두 통과했다.
- #74 카드 theme customization과 production 배포는 승인된 통합 PR 제외 범위다.
- 최종 보고서 작성, publish branch push와 PR 게시에는 별도 승인이 필요하다.

## 다음 단계 영향

- 승인 후 `task-final-report` 절차로 `mydocs/report/task_m100_71_report.md`를 작성하고
  오늘할일을 완료 처리한다.
- 최종 커밋 후 `publish/task71`을 원격에 게시하고 `devel` 대상 단일 PR에
  `Closes #71`, `Closes #72`, `Closes #73`을 각각 명시한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시 단계로 진행한다.
