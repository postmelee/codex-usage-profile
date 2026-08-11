# Task M100 #35 Stage 3 보고서

GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
구현계획서: [`task_m100_35_impl.md`](../plans/task_m100_35_impl.md)
Stage: 3

## 단계 목적

승인된 방향 전환에 따라 Home과 공개 card image 위의 cell interaction을 최종 제품
코드에서 제거하고, Account Usage Contract v1의
`dailyUsageBuckets[{ startDate, tokens }]`를 owner/public Profile이 함께 사용할 수 있는
52주 UTC heatmap data contract로 정리했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/heatmap.js` | canonical daily bucket 검증·정렬, 52주 UTC geometry, daily 364 cell, weekly/cumulative 52 target, mode별 intensity, month/scroll metadata와 `en`/`ko` tooltip formatter 구현 |
| `src/profile-ui/__tests__/heatmap.test.js` | leap/year 경계, 미래 제외, 빈 날짜, 일별·주간·누적 합계, semantic target 수, locale·exact token과 입력 검증 회귀 추가 |
| Stage 1·2 card overlay 관련 파일 | `geometry.js`, `CardHeatmapOverlay.jsx`, tooltip helper와 전용 테스트를 제거하고 renderer, Home/public card, style, fixture를 `origin/devel` 동작으로 명시적 복원 |

## 본문 변경 정도 / 본문 무손실 여부

공개 API, Account Usage Contract v1 payload, native/Worker card renderer pixel, Home card
전환, 공개 card asset과 배포 설정은 변경하지 않았다. Stage 1·2의 보고서와 커밋 이력은
보존하되 대체된 card overlay 구현만 최종 diff에서 제거했다. 최종 제품 diff는 Profile
heatmap pure module과 그 단위 테스트에 한정된다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/heatmap.test.js
node --test src/profile-card/__tests__/heatmap.test.js src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
npm run build
git diff --check
git diff origin/devel -- src/profile-card src/profile-ui/HomePage.jsx public/assets
```

추가 잔존 코드 확인:

```bash
rg -n "card-heatmap-overlay|CardHeatmapOverlay|cardHeatmapTooltip|profile-card/geometry" src tests
```

결과:

- OK — Profile heatmap unit test 8건 통과
- OK — 기존 card heatmap·native renderer·Worker renderer 회귀 9건 통과
- OK — Vite production build 성공, 1,809 modules transformed
- OK — `git diff --check` 오류 없음
- OK — `origin/devel` 대비 `src/profile-card`, `HomePage.jsx`, `public/assets` diff 없음
- OK — 제거 대상 overlay·geometry 식별자 잔존 검색 결과 없음

## 잔여 위험

- 이번 단계는 pure data contract까지만 확정했다. 현재 사용되지 않는 legacy
  `TokenActivityChart`와 owner/public Profile route의 실제 UI 연결은 Stage 4 범위다.
- daily의 현재 주 미래 cell은 52주 geometry 보존을 위해 반환하되 token 0과
  `interactive: false`로 표시한다. Stage 4는 해당 값을 focus·pointer target에서
  제외해야 한다.
- weekly/cumulative target은 한 주당 1개로 고정했으므로 Stage 4의 시각적 7행 표현과
  semantic overlay 정렬을 browser test로 검증해야 한다.

## 다음 단계 영향

- Stage 4는 `buildTokenHeatmap(dailyUsageBuckets, { capturedAt, locale, mode })`를
  owner와 public Profile에서 동일하게 사용한다.
- mode별 `cells`는 daily 364개, weekly/cumulative 52개이며 `rowSpan`, `column`,
  `latestTargetKey`, `monthLabels`, `grid` metadata를 UI geometry와 최근 주 scroll에
  사용한다.
- tooltip과 `aria-label`은 cell의 `tooltip` 문자열을 공유해 locale·exact token 표시가
  drift하지 않게 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 owner/public Profile 통합으로 진행한다.
