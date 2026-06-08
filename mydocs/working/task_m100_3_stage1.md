# Task M100 #3 Stage 1 보고서

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)
구현계획서: [`task_m100_3_impl.md`](../plans/task_m100_3_impl.md)
Stage: 1

## 단계 목적

프론트엔드 scaffold와 route 기반을 추가해 #2 snapshot을 웹 화면에 연결할 수 있는 최소 실행 환경을 만든다. 이번 단계는 Profile 본문 완성 전의 앱 진입점, Vite build, `/u/:handle` route, 기본 상태 shell을 확정하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `.gitignore` | `node_modules/`, `dist/`, Playwright report/output을 stage 대상에서 제외했다. 구현계획서 산출물에는 없었지만 Stage 1 의존성 설치와 build 검증에 필요한 generated output 정리용 파일이다. |
| `package.json` | `dev`, `build` script와 React/Vite/Playwright dependency를 추가했다. |
| `package-lock.json` | npm dependency lockfile을 생성했다. |
| `index.html` | Vite HTML entry를 추가했다. |
| `vite.config.js` | React plugin 기반 Vite 설정을 추가했다. |
| `src/main.jsx` | React root render entry를 추가했다. |
| `src/App.jsx` | sample snapshot route resolution과 profile view model 연결을 추가했다. |
| `src/profile-ui/profileRoutes.js` | `/`, `/u/:handle`, `state=loading|empty|unavailable` preview route resolver를 추가했다. |
| `src/profile-ui/SettingsShell.jsx` | Codex settings 화면의 sidebar/topbar shell 골격을 추가했다. |
| `src/profile-ui/ProfilePage.jsx` | ready/loading/empty/unavailable 상태 렌더링과 기본 profile placeholder를 추가했다. |
| `src/styles.css` | dark settings shell, sidebar, topbar, profile placeholder, mobile collapse 기본 스타일을 추가했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없음이다. 기존 `src/profile-snapshot` API는 수정하지 않았고, 새 UI는 `sampleProfileSnapshot`과 `selectProfileViewModel`을 소비하는 방식으로 연결했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
git diff --check
node --input-type=module -e 'import { chromium } from "playwright"; const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1512, height: 982 } }); await page.goto("http://127.0.0.1:5173/u/meleeisdeveloping", { waitUntil: "networkidle" }); const title = await page.locator("h2").first().textContent(); const topbar = await page.locator("h1").first().textContent(); const statsPlaceholder = await page.getByText("Stats bar").isVisible(); await page.goto("http://127.0.0.1:5173/u/unknown?state=empty", { waitUntil: "networkidle" }); const emptyTitle = await page.locator("h2").first().textContent(); await browser.close(); console.log(JSON.stringify({ topbar, title, statsPlaceholder, emptyTitle }, null, 2));'
```

결과:

- OK: `npm test` 통과. 17개 node:test 모두 pass.
- OK: `npm run build` 통과. Vite production build 성공.
- OK: `git diff --check` 경고 없음.
- OK: Playwright route render 확인 통과.
  - `topbar`: `Profile`
  - `title`: `postmelee`
  - `statsPlaceholder`: `true`
  - `emptyTitle`: `No profile activity yet`

추가 기록:

- sandbox 안에서는 `127.0.0.1:5173` bind가 `EPERM`으로 막혀 Vite dev server를 권한 상승으로 실행했다.
- Browser/IAB 직접 조작 도구가 tool search에 노출되지 않아 Playwright 검증으로 fallback했다.
- Playwright Chromium binary가 없어 `npx playwright install chromium`으로 Chromium만 설치했다.
- node REPL 내부 Chromium 실행은 macOS Mach port 권한 문제로 실패해, sandbox 밖 단일 Node 명령으로 route 렌더링을 확인했다.
- 검증 후 Vite dev server는 종료했다.

## 잔여 위험

- Stage 1의 화면은 placeholder 수준이다. 실제 stat bar, token activity, insights/plugins fidelity는 Stage 2-3에서 구현해야 한다.
- `.gitignore`는 구현계획서 Stage 1 산출물에 명시되지 않았지만, dependency/build output을 안전하게 제외하기 위한 필수 scaffold 파일이다.
- Playwright e2e config와 자동화된 screenshot test는 아직 없다. Stage 4에서 추가한다.

## 다음 단계 영향

- Stage 2는 `ProfilePage.jsx`, `SettingsShell.jsx`, `styles.css` 위에 실제 Profile header/stat/insights/plugins 컴포넌트를 채우면 된다.
- `/u/meleeisdeveloping` route가 sample snapshot preview URL로 동작한다.
- `state=loading|empty|unavailable` query는 이후 상태 화면 QA에 재사용할 수 있다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 Profile 본문 정적 구조 재현으로 진행한다.
