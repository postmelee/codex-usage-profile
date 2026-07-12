# Task M100 #6 Stage 4.2 완료 보고

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
구현계획서: [`task_m100_6_impl.md`](../plans/task_m100_6_impl.md)
Stage: 4.2

## 단계 목적

Home을 포함한 모든 페이지의 공통 topbar 제목에서 `Codex usage`의 `g` descender가 잘리는 사용자 QA 문제를 수정한다.

## 원인

`.profile-topbar h1`의 `font-size`는 15px인데 `line-height: 1`과 `overflow: hidden`이 함께 적용되어 line box 높이도 15px로 제한됐다. 이 때문에 baseline 아래로 내려가는 `g`와 같은 글리프 영역이 잘렸다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/styles.css` | topbar `h1` line-height를 20px로 확대하고 상하 1px padding을 추가해 글리프 영역 확보 |
| `tests/profile-ui.spec.js` | Home/Profile/Settings에서 line-height, client/scroll height를 확인하는 clipping 회귀 추가 |

## 본문 변경 정도 / 본문 무손실 여부

공통 topbar 제목의 line box만 변경했다. navigation, sticky header, 내부 scroll, 카드와 backend 동작은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run test:e2e -- --grep "inside the frame"
npm test
npm run build
npm run test:e2e
git diff --check
```

결과:

- PASS: Home/Profile/Settings에서 computed line-height `20px`, client height `22px` 확인
- PASS: 모든 페이지에서 title `scrollHeight <= clientHeight` 확인
- PASS: 전체 Node 테스트 209건 통과
- PASS: Vite production build 성공, 49 modules transformed
- PASS: 전체 Playwright 11건 통과
- PASS: desktop Home screenshot에서 `Codex usage`의 `g` descender가 잘리지 않음을 직접 확인
- PASS: `git diff --check` 경고 없음

## 잔여 위험

- 없음.

## 다음 단계 영향

- Stage 4.2 사용자 QA 보정이 완료되었다. 다음 절차는 Task #6 최종 보고서 작성과 PR 게시다.
- 실행 중인 `http://127.0.0.1:5177` runtime은 HMR로 수정 사항을 반영한다.

## 승인 요청

- Stage 4.2 산출물과 검증 결과를 승인하면 Task #6 최종 보고와 PR 게시 절차로 진행한다.
