# Task M100 #6 Stage 4.3 완료 보고

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
구현계획서: [`task_m100_6_impl.md`](../plans/task_m100_6_impl.md)
Stage: 4.3

## 단계 목적

공통 topbar의 `Codex usage`, navigation, account action을 같은 수직 기준으로 정렬하고 `Sign in`의 descender가 잘리는 사용자 QA 문제를 수정한다.

## 원인

- 제목은 Stage 4.2에서 20px line box와 별도 padding을 사용했지만 navigation link는 28px control box를 사용해 두 요소의 시각 중심이 달랐다.
- account action은 `line-height: 1`을 유지하고 있어 `Sign in`처럼 descender가 있는 글자의 line box가 좁았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/styles.css` | topbar 제목, navigation, account action을 28px control box와 20px line-height로 통일하고 account label에 명시적 line box 적용 |
| `tests/profile-ui.spec.js` | 제목, `Profile`, `Sign in`의 높이·중심선·line-height와 account label clipping 회귀 검증 추가 |

## 본문 변경 정도 / 본문 무손실 여부

공통 topbar의 텍스트 geometry만 변경했다. OAuth endpoint, callback 목적지, card renderer, profile/settings 본문, 내부 scroll 동작은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run test:e2e -- --grep "Home shows the sample card|inside the frame"
npm test
npm run build
npm run test:e2e
git diff --check
```

결과:

- PASS: `Codex usage`, `Profile`, `Sign in`이 모두 28px 높이, 20px line-height, 동일한 center Y 사용
- PASS: `Sign in` label의 `scrollHeight`와 `clientHeight`가 모두 20px로 clipping 없음
- PASS: 1280px desktop과 390px mobile에서 topbar 정렬 및 document horizontal overflow 없음
- PASS: 전체 Node 테스트 209건 통과
- PASS: 전체 Playwright 11건 통과
- PASS: Vite production build 성공, 49 modules transformed

## 후속 UX 결정

- 별도 `/onboarding` route를 만들지 않고 메인 `/`을 인증 상태별 랜딩과 CLI Quickstart 화면으로 확장한다.
- 메인 로그인 CTA의 OAuth callback은 `/`로 복귀한다.
- 위 랜딩/온보딩은 #6 범위에 추가하지 않고 별도 issue에서 진행한다. 실제 CLI command와 상태 계약은 #5 완료 결과를 사용한다.

## 잔여 위험

- 없음.

## 다음 단계 영향

- Stage 4.3 사용자 QA 보정이 완료되었다. Task #6 최종 보고서 작성과 PR 게시 절차로 진행한다.
