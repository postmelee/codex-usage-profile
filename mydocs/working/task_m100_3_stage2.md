# Task M100 #3 Stage 2 보고서

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)
구현계획서: [`task_m100_3_impl.md`](../plans/task_m100_3_impl.md)
Stage: 2

## 단계 목적

Profile 본문 정적 구조를 snapshot 값으로 렌더링한다. 이번 단계는 Stage 1 placeholder를 제거하고 Codex Profile 화면의 header, stat bar, token activity preview, Activity insights, Most used plugins 영역을 실제 데이터 기반 UI로 채우는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ProfileHeader.jsx` | avatar, display name, username, plan pill 렌더링을 추가했다. avatar URL 실패 시 Codex reference에 가까운 fallback avatar를 표시한다. |
| `src/profile-ui/ProfileStats.jsx` | 5개 profile stat bar 컴포넌트를 추가했다. |
| `src/profile-ui/ActivityInsights.jsx` | Activity insights와 Most used plugins 리스트 렌더링을 추가했다. |
| `src/profile-ui/PluginIcon.jsx` | Most used plugins 행에 쓰는 작은 plugin icon을 추가했다. |
| `src/profile-ui/Icons.jsx` | top action용 inline SVG icon set을 추가했다. |
| `src/profile-ui/formatters.js` | compact token, duration, percent, integer, reasoning effort formatter를 추가했다. |
| `src/profile-ui/ProfilePage.jsx` | placeholder grid를 제거하고 header/stat/token preview/activity grid를 조합했다. |
| `src/profile-ui/ProfileShell.jsx` | 사용자의 sidebar 제거 피드백에 맞춰 Profile 본문 중심 shell과 top action structure로 조정했다. |
| `src/styles.css` | 실제 Profile layout, stat bar, static token activity preview, activity/plugin 2열, mobile collapse 스타일을 추가했다. |
| `src/profile-snapshot/fixtures/sample-snapshot.js` | Most used plugins가 reference처럼 5행으로 보이도록 sample top invocation 2개를 보강했다. |
| `src/profile-snapshot/__tests__/selectors.test.js` | sample fixture의 default most used invocation 개수 변경을 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없음이다. 기존 snapshot schema와 selector API는 변경하지 않았고, sample fixture의 `topInvocations`만 reference 화면에 맞춰 5행으로 보강했다.

추가 피드백 반영:

- Stage 2 최초 완료 후 작업지시자가 "사이드 바는 없어도 될 것 같다"고 피드백했다.
- 이에 따라 수행계획서와 구현계획서의 sidebar 포함 범위를 Profile 본문 중심 shell로 갱신했다.
- `SettingsShell.jsx`는 제거하고 `ProfileShell.jsx`로 대체했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
git diff --check
node --input-type=module -e 'import { chromium } from "playwright"; const browser = await chromium.launch({ headless: true }); async function inspect(width, height) { const page = await browser.newPage({ viewport: { width, height } }); await page.goto("http://127.0.0.1:5173/u/meleeisdeveloping", { waitUntil: "load" }); const data = await page.evaluate(() => ({ title: document.querySelector(".profile-heading h2")?.textContent, stats: [...document.querySelectorAll(".profile-stat dd")].map((node) => node.textContent), plugins: [...document.querySelectorAll(".plugin-name")].map((node) => node.textContent), bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, activityGridColumns: getComputedStyle(document.querySelector(".activity-grid")).gridTemplateColumns, activityGridWidth: Math.round(document.querySelector(".activity-grid").getBoundingClientRect().width) })); await page.close(); return { width, height, ...data }; } const result = [await inspect(1512, 982), await inspect(390, 844)]; await browser.close(); console.log(JSON.stringify(result, null, 2));'
node --input-type=module -e 'import { chromium } from "playwright"; const browser = await chromium.launch({ headless: true }); async function inspect(width, height) { const page = await browser.newPage({ viewport: { width, height } }); await page.goto("http://127.0.0.1:5173/u/meleeisdeveloping", { waitUntil: "load" }); const data = await page.evaluate(() => ({ title: document.querySelector(".profile-heading h2")?.textContent, hasSidebar: Boolean(document.querySelector("aside")), frameWidth: Math.round(document.querySelector(".app-frame").getBoundingClientRect().width), bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, activityGridColumns: getComputedStyle(document.querySelector(".activity-grid")).gridTemplateColumns, stats: [...document.querySelectorAll(".profile-stat dd")].map((node) => node.textContent) })); await page.close(); return { width, height, ...data }; } const result = [await inspect(1512, 982), await inspect(390, 844)]; await browser.close(); console.log(JSON.stringify(result, null, 2));'
```

결과:

- OK: `npm test` 통과. 17개 node:test 모두 pass.
- OK: `npm run build` 통과. Vite production build 성공.
- OK: `git diff --check` 경고 없음.
- OK: desktop 1512x982 검사에서 title/stat/plugin 값이 snapshot과 일치하고 `bodyOverflow=false`였다.
- OK: mobile 390x844 검사에서 title/stat/plugin 값이 snapshot과 일치하고 `bodyOverflow=false`였다.
- OK: mobile activity grid 폭이 `356px`로 정상 collapse됐다.
- OK: sidebar 제거 후 desktop/mobile 모두 `hasSidebar=false`, `bodyOverflow=false`였다.

검증된 주요 값:

- title: `postmelee`
- stats: `10.3B`, `703M`, `1h 53m`, `46 days`, `46 days`
- plugins: `$pr-merge-cleanup`, `$task-start`, `$task-register`, `$task-final-report`, `$task-stage-report`

시각 확인:

- Vite dev server를 `http://127.0.0.1:5173/`에서 실행했다.
- Codex in-app browser를 visible 상태로 열고 `http://127.0.0.1:5173/u/meleeisdeveloping`로 이동했다.
- DOM 기준 `postmelee`, `Activity insights`, `$task-final-report` 렌더링을 확인했다.
- 현재 사용자가 볼 수 있도록 in-app browser와 dev server를 유지했다.

## 잔여 위험

- Token activity는 Stage 3 전이므로 static preview grid만 구현되어 있다. Daily / Weekly / Cumulative tab 전환과 tooltip은 아직 동작하지 않는다.
- avatar는 실제 Codex profile photo asset이 없는 경우 fallback avatar를 사용한다. 실제 사용자 avatar upload/cache 정책은 후속 API/CLI task와 연결된다.
- inline SVG icon은 reference의 정확한 Lucide/internal icon과 완전히 같지는 않다. Stage 4 visual QA에서 조정 여지를 남긴다.

## 다음 단계 영향

- Stage 3은 `TokenActivityPreview`를 `TokenActivityChart`로 승격하고 heatmap transform, tab state, daily tooltip을 구현하면 된다.
- Stage 2에서 추가한 formatter는 Stage 3 tooltip/token 값 표시에도 재사용할 수 있다.
- sample fixture는 Most used plugins 5행을 제공하므로 이후 Playwright test에서 reference 값 검증이 가능하다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 Token activity heatmap 상호작용 구현으로 진행한다.
