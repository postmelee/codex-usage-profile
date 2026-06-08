# Task M100 #3 Stage 3 보고서

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)
구현계획서: [`task_m100_3_impl.md`](../plans/task_m100_3_impl.md)
Stage: 3

## 단계 목적

Token activity heatmap을 static preview에서 실제 상호작용 가능한 컴포넌트로 승격한다. 이번 단계는 Daily / Weekly / Cumulative mode 변환, tab 전환, daily cell hover/focus tooltip, heatmap 단위 테스트를 구현하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/heatmap.js` | 52주 x 7일 heatmap 계산, daily/weekly/cumulative token value 변환, month label, tooltip text formatter를 추가했다. |
| `src/profile-ui/TokenActivityChart.jsx` | tab state, mode별 grid 렌더링, cell hover/focus tooltip을 가진 chart 컴포넌트를 추가했다. |
| `src/profile-ui/__tests__/heatmap.test.js` | missing day zero-fill, weekly aggregation, cumulative total, tooltip 문구, level 계산 단위 테스트를 추가했다. |
| `src/profile-ui/ProfilePage.jsx` | 기존 `TokenActivityPreview` inline 구현을 제거하고 `TokenActivityChart`를 연결했다. |
| `src/styles.css` | chart tab focus/selected state, button cell, tooltip, stable grid sizing 스타일을 추가했다. |
| `mydocs/orders/20260608.md` | #3 비고를 Stage 3 완료 승인 대기로 갱신했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없음이다. 기존 snapshot schema와 selector API는 변경하지 않았다. Stage 2에서 만든 profile layout은 유지하고 token activity 영역만 상호작용 가능한 컴포넌트로 교체했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
git diff --check
node --input-type=module -e 'import { chromium } from "playwright"; const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1512, height: 982 } }); await page.goto("http://127.0.0.1:5173/u/meleeisdeveloping", { waitUntil: "load" }); await page.locator("[data-token-cell][data-date=\"2025-07-20\"]").hover(); const tooltipDisplay = await page.locator("[data-token-cell][data-date=\"2025-07-20\"] .token-tooltip").evaluate((node) => getComputedStyle(node).display); const tooltipText = await page.locator("[data-token-cell][data-date=\"2025-07-20\"] .token-tooltip").textContent(); await page.getByRole("button", { name: "Weekly" }).click(); const weeklyMode = await page.locator(".token-grid").getAttribute("data-heatmap-mode"); const weeklyTooltip = await page.locator("[data-token-cell][data-date=\"2026-06-02\"]").getAttribute("data-tooltip"); await page.getByRole("button", { name: "Cumulative" }).click(); const cumulativeMode = await page.locator(".token-grid").getAttribute("data-heatmap-mode"); const cumulativeTooltip = await page.locator("[data-token-cell][data-date=\"2026-06-02\"]").getAttribute("data-tooltip"); await browser.close(); console.log(JSON.stringify({ tooltipDisplay, tooltipText, weeklyMode, weeklyTooltip, cumulativeMode, cumulativeTooltip }, null, 2));'
```

결과:

- OK: `npm test` 통과. 22개 node:test 모두 pass.
- OK: `npm run build` 통과. Vite production build 성공.
- OK: `git diff --check` 경고 없음.
- OK: daily hover tooltip 확인.
  - `tooltipDisplay`: `flex`
  - `tooltipText`: `0 tokens on Jul 20, 2025`
- OK: Weekly tab 전환 확인.
  - `weeklyMode`: `weekly`
  - `weeklyTooltip`: `2B tokens on week of May 31`
- OK: Cumulative tab 전환 확인.
  - `cumulativeMode`: `cumulative`
  - `cumulativeTooltip`: `3B tokens through week of May 31`

시각 확인:

- Codex in-app browser를 `http://127.0.0.1:5173/u/meleeisdeveloping`에서 새로고침했다.
- DOM 기준 `Daily`, `Weekly`, `0 tokens on Jul 20, 2025` 렌더링을 확인했다.
- in-app browser screenshot API는 `Page.captureScreenshot` timeout이 발생해, 독립 Playwright screenshot fallback으로 `/private/tmp/codex-usage-profile-stage3-preview.png`를 저장했다.

## 잔여 위험

- Stage 3의 tooltip은 CSS hover/focus 기반이다. Stage 4에서 Playwright e2e test로 회귀 검증을 고정해야 한다.
- Weekly/Cumulative tooltip 문구는 내부 구현 기준으로 정의했다. Codex 앱 내부 문구와 완전히 다르면 Stage 4 visual QA에서 조정한다.
- chart는 52주 x 7일 fixed grid이고, mobile에서는 horizontal scroll을 허용한다. Stage 4에서 screenshot QA로 overflow와 스크롤 동작을 다시 확인한다.

## 다음 단계 영향

- Stage 4는 `TokenActivityChart`의 tab/tooltip behavior를 Playwright e2e로 고정하면 된다.
- `src/profile-ui/heatmap.js`는 README card endpoint나 후속 screenshot generation에서도 재사용 가능한 chart transform 후보가 된다.
- 현재 in-app browser와 dev server는 사용자가 계속 확인할 수 있도록 유지했다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 시각 검증과 최종 정리로 진행한다.
