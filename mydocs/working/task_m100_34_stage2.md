# Task M100 #34 Stage 2 보고서

GitHub Issue: [#34](https://github.com/postmelee/codex-usage-profile/issues/34)
구현계획서: [`task_m100_34_impl.md`](../plans/task_m100_34_impl.md)
Stage: 2

## 단계 목적

기존 `/`의 card preview를 제품 첫 화면 신호로 유지하면서 session-aware landing과 Quickstart를 구현했다. 익명 사용자는 실제 card, GitHub login과 전체 흐름을 확인하고, 인증 사용자는 GitHub identity, owner profile 진입점, canonical submit command와 복사 interaction을 사용할 수 있다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/HomeQuickstart.jsx` | 인증 상태별 command/access surface, clipboard 상태, 5단계 ordered Quickstart 구현 |
| `src/profile-ui/HomePage.jsx` | supporting copy, landing section 구성, session-aware Quickstart 연결 |
| `src/styles.css` | card 중심 hero, framed command tool, 행 기반 단계 목록과 mobile 기본 layout 추가 |
| `tests/profile-ui.spec.js` | anonymous command 비노출, Quickstart 5단계, authenticated command copy E2E 추가 |
| `mydocs/orders/20260718.md` | Stage 2 완료와 Stage 3 승인 대기 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 `ProfileShell`, 실제 owner card preview/fallback, GitHub identity, `View profile`, AccountMenu Settings/logout과 Home OAuth `/` 복귀 계약을 보존했다. Profile, Settings, Device, public profile/card 구현은 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/homeOnboarding.test.js src/profile-ui/__tests__/accountUi.test.js src/profile-ui/__tests__/cardShare.test.js
npm run build
npm run test:e2e -- --grep "Home"
git diff --check
```

결과:

- OK — Node test 10개 통과, 실패·skip 없음.
- OK — Vite production build 완료, 33개 module transform 성공.
- OK — Home 관련 Playwright E2E 5개 통과.
- OK — anonymous DOM에서 canonical command가 노출되지 않고 GitHub login이 `/`로 복귀한다.
- OK — authenticated DOM에서 `npx codex-usage-profile@latest submit`이 표시되고 copy button이 정확한 문자열을 clipboard에 전달한다.
- OK — desktop screenshot에서 실제 card가 첫 화면의 중심을 유지하고 Quickstart 시작 부분이 같은 frame 안에 보인다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- 390x844 mobile에서 command wrapping, 단계 label과 account action의 세부 시각 검증은 Stage 3 범위다.
- clipboard API 실패 시 수동 복사 안내를 렌더링하지만 실패 branch E2E는 Stage 3에서 추가한다.
- keyboard tab order, screen reader heading/ordered-list semantic과 reduced-motion은 Stage 3에서 전체 검증한다.
- npm package와 production service availability는 변경하거나 검증하지 않았다.

## 다음 단계 영향

- Stage 3는 현재 landing 구조를 재설계하지 않고 desktop/mobile/짧은 viewport와 keyboard·clipboard failure 회귀를 고정한다.
- anonymous, loading, unavailable, authenticated 상태별 DOM과 layout 안정성을 검증한다.
- 기존 Home/Profile/Settings/Device/public route E2E를 함께 실행해 shell과 내부 scroll 회귀를 방지한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 반응형·접근성·브라우저 회귀 보강으로 진행한다.
