# Task #99 Stage 2 보고서 — Home 최근 업데이트 표시 연결

GitHub Issue: [#99](https://github.com/postmelee/codex-usage-profile/issues/99)
구현계획서: [`task_m100_99_impl.md`](../plans/task_m100_99_impl.md)
Stage: 2

## 단계 목적

인증 사용자의 Home 카드 아래에 최신 usage 제출 시각을 낮은 시각적 위계로 표시한다.
owner profile이 ready이고 `usage.uploadedAt`이 유효한 경우에만 표시하며,
anonymous·loading·empty·error 상태에서는 문구와 빈 slot을 만들지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/HomePage.jsx` | `usage.uploadedAt`을 공통 `LastUpdatedTime`에 전달하고 카드와 identity 사이의 인증 사용자 전용 2행 layout에 연결 |
| `src/styles.css` | 중앙 정렬 tertiary update text, desktop/mobile 인증 사용자 layout, 기존 240ms semantic theme transition 연결 |
| `tests/profile-ui.spec.js` | loading→ready, empty·error 비렌더링, mobile 기하·overflow·reduced-motion, theme transition 회귀 검증 추가 |
| `mydocs/orders/20260813.md` | Task #99를 Stage 2 완료·Stage 3 진행 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

- 기존 카드 source 선택·decode·share handoff·visibility mutation 로직은 변경하지 않았다.
- 인증 사용자 identity와 action의 기존 가로 관계를 내부 `home-account-content`로 보존하고,
  그 위에 유효한 update text만 별도 행으로 배치했다.
- mobile에서는 기존 identity·action 세로 배치를 새 wrapper 안에서 그대로 유지한다.
- Home update text에 새로운 translate·scale·stagger·opacity motion을 추가하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/lastUpdatedTime.test.js src/profile-ui/__tests__/homeOnboarding.test.js src/profile-ui/__tests__/theme.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #99.*Home" --workers=1
git diff --check
```

결과:

- OK — 공통 time, Home onboarding, theme 단위 테스트 15개 통과
- OK — Task #99 Home Playwright 3개 통과
- OK — profile fetch 전 비렌더링 후 ready에서 `<time datetime="2026-06-11T00:01:00.000Z">` 표시
- OK — no usage와 profile 503에서 update text 미표시
- OK — 390px mobile에서 카드 → update → identity 순서와 가로 overflow 없음
- OK — tertiary color token, 240ms semantic color transition, reduced-motion에서 별도 animation 없음
- OK — `git diff --check` 공백 오류 없음

## 잔여 위험

- owner/public Profile heading과 loading Skeleton에는 아직 update slot이 없어 Stage 3에서 정합해야 한다.
- 실제 브라우저 현지 시간대의 표시와 전체 Home 회귀는 Stage 4 통합 검증에서 다시 확인한다.

## 다음 단계 영향

- Stage 3은 `AccountUsageProfile`의 공통 owner/public 경로에서 같은 `usage.uploadedAt`을
  `ProfileHeader`로 전달한다.
- ready header update slot과 `ProfileLoadingSkeleton` placeholder의 높이·간격을 맞춰
  loading→ready layout shift를 제한해야 한다.

## 승인 요청

- 작업지시자의 “로컬에서 직접 테스트할 수 있을 때까지 계속 진행” 지시에 따라
  Stage 3 — owner/public Profile과 Skeleton 정합 진입이 승인되었다.
