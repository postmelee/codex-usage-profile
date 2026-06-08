# Task M100 #3 구현계획서

수행계획서: [`task_m100_3.md`](task_m100_3.md)
GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 프론트엔드 scaffold와 route 기반 | `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, route/state shell | `npm test`, `npm run build`, `git diff --check` |
| 2 | Profile 본문 정적 구조 재현 | `src/profile-ui/ProfilePage.jsx`, shell/header/stats/insights/plugins components, `src/styles.css` | `npm test`, `npm run build`, browser desktop/mobile 확인, `git diff --check` |
| 3 | Token activity heatmap 상호작용 | `src/profile-ui/heatmap.js`, `TokenActivityChart.jsx`, heatmap unit tests | `npm test`, Playwright tab/tooltip 확인, `git diff --check` |
| 4 | 시각 검증과 최종 정리 | `playwright.config.js`, `tests/profile-ui.spec.js`, 최종 stage/report | `npm test`, `npm run build`, `npm run test:e2e`, CSS token 검토, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `해당 없음` | 공식 문서 없음 | 해당 없음 | OK | 사용자용 공식 문서는 이번 task에서 만들지 않는다. |
| `mydocs/working/task_m100_3_stage{N}.md` | `mydocs/working/` | Stage 1-4 | OK | 단계별 구현/검증 기록으로 작성한다. |
| `mydocs/report/task_m100_3_report.md` | `mydocs/report/` | 최종 보고 | OK | PR 직전 최종 결과와 잔여 리스크를 정리한다. |

## 구현 방식 결정

현재 repository root는 dependency-free Node ESM 패키지이며 UI scaffold가 없다. 승인된 수행계획에 따라 React + Vite를 도입한다.

- framework: React + Vite
- package scripts:
  - `dev`: Vite local dev server
  - `build`: Vite production build
  - `test`: Node 내장 `node --test` 기반 unit test
  - `test:e2e`: Playwright test
- UI 입력: `src/profile-snapshot/fixtures/sample-snapshot.js`와 `selectProfileViewModel`
- route: `/u/:handle`을 우선 지원하고 root는 sample profile로 redirect 또는 동일 preview를 렌더링한다.
- 시각 기준: 작업지시자가 제공한 Codex Profile 스크린샷과 `codex-extracted/` 분석 결과를 승인된 reference로 삼는다. 이번 task는 clone-like interface 재현이므로 ImageGen으로 새 콘셉트를 만들지 않는다.
- 검증 기준: Browser/IAB 우선 확인 후, Playwright로 desktop/mobile screenshot과 tab/tooltip 동작을 자동 검증한다. Browser/IAB 도구가 불안정하면 Playwright screenshot을 fallback으로 사용하고 단계 보고서에 기록한다.
- QA artifact: Playwright screenshot은 검증 중 생성하되, 저장소에 남길 필요가 없으면 커밋하지 않는다.

## Stage 1 — 프론트엔드 scaffold와 route 기반

### 산출물

신규:

- `package-lock.json`
- `index.html`
- `vite.config.js`
- `src/main.jsx`
- `src/App.jsx`
- `src/profile-ui/profileRoutes.js`
- `src/profile-ui/ProfilePage.jsx`
- `src/profile-ui/SettingsShell.jsx`
- `src/styles.css`
- `mydocs/working/task_m100_3_stage1.md`

수정:

- `package.json`

### 변경 내용

- React, React DOM, Vite, Playwright test runner 의존성을 도입한다.
- Vite entry와 root render를 추가한다.
- `/u/:handle` route를 URL pathname 기반으로 처리한다.
- `sampleProfileSnapshot`과 `selectProfileViewModel`을 연결해 page component에 전달한다.
- loading, empty, unavailable 상태를 처리할 수 있는 최소 상태 shell을 만든다.
- Codex settings 화면의 기본 dark token, body 배경, 앱 shell 치수를 CSS token으로 둔다.

### 검증

```bash
npm test
npm run build
git diff --check
```

### 커밋

```text
Task #3 Stage 1: 프론트엔드 scaffold와 route 기반 추가
```

## Stage 2 — Profile 본문 정적 구조 재현

### 산출물

신규:

- `src/profile-ui/ProfileHeader.jsx`
- `src/profile-ui/ProfileStats.jsx`
- `src/profile-ui/ActivityInsights.jsx`
- 필요 시 `src/profile-ui/PluginIcon.jsx`
- `mydocs/working/task_m100_3_stage2.md`

수정:

- `src/profile-ui/ProfilePage.jsx`
- `src/profile-ui/SettingsShell.jsx`
- `src/styles.css`
- 필요 시 `src/profile-snapshot/fixtures/sample-snapshot.js`

### 변경 내용

- settings sidebar, window chrome dots, top action row, main content shell을 스크린샷 구조에 맞춘다.
- avatar, display name, username, plan pill을 snapshot header 값으로 렌더링한다.
- Lifetime tokens, Peak tokens, Longest task, Current streak, Longest streak stat bar를 구현한다.
- Activity insights와 Most used plugins 리스트를 snapshot 값으로 렌더링한다.
- 숫자 formatter를 UI 전용 helper로 추가한다.
- desktop과 mobile에서 본문 영역, stat bar, lists의 wrapping/overflow 제약을 둔다.

### 검증

```bash
npm test
npm run build
git diff --check
```

추가 확인:

- Browser/IAB 또는 Playwright screenshot으로 1512px급 desktop viewport 확인
- Browser/IAB 또는 Playwright screenshot으로 mobile viewport 확인
- header, stat bar, insights, plugins 텍스트 겹침 여부 확인

### 커밋

```text
Task #3 Stage 2: profile 본문 정적 구조 재현
```

## Stage 3 — Token activity heatmap 상호작용

### 산출물

신규:

- `src/profile-ui/TokenActivityChart.jsx`
- `src/profile-ui/heatmap.js`
- `src/profile-ui/__tests__/heatmap.test.js`
- `mydocs/working/task_m100_3_stage3.md`

수정:

- `src/profile-ui/ProfilePage.jsx`
- `src/styles.css`
- 필요 시 `src/profile-snapshot/index.js`

### 변경 내용

- Daily / Weekly / Cumulative mode별 heatmap cell 변환 함수를 구현한다.
- 최근 12개월 기준 month label과 grid cell 배열을 만든다.
- Daily mode cell hover/focus tooltip을 `{tokens} tokens on {date}` 형식으로 표시한다.
- tab button selected state와 keyboard focus state를 구현한다.
- chart cell 크기, gap, label 영역을 고정해 hover나 label 변화가 layout shift를 만들지 않게 한다.

### 검증

```bash
npm test
git diff --check
```

추가 확인:

- heatmap 변환 unit test
- Playwright 또는 Browser/IAB로 Daily / Weekly / Cumulative tab 전환 확인
- Playwright 또는 Browser/IAB로 daily tooltip 문구 확인

### 커밋

```text
Task #3 Stage 3: token activity heatmap 상호작용 추가
```

## Stage 4 — 시각 검증과 최종 정리

### 산출물

신규:

- `playwright.config.js`
- `tests/profile-ui.spec.js`
- `mydocs/working/task_m100_3_stage4.md`
- `mydocs/report/task_m100_3_report.md`

수정:

- `package.json`
- 필요 시 `src/profile-ui/*`
- 필요 시 `src/styles.css`

### 변경 내용

- Playwright web server 설정과 e2e script를 확정한다.
- `/u/meleeisdeveloping` 또는 동등한 sample route에서 profile page가 렌더링되는지 검증한다.
- desktop/mobile screenshot test를 추가한다.
- tab 전환과 tooltip test를 추가한다.
- Browser/IAB 확인 또는 Playwright screenshot을 통해 reference screenshot 대비 fidelity ledger를 작성한다.
- CSS color/theme token을 검토하고 불필요한 단색 편향, 텍스트 겹침, mobile overflow를 정리한다.
- 최종 보고서에 실행한 검증, 남은 차이, 후속 #4/#5/#6 의존성을 정리한다.

### 검증

```bash
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

추가 확인:

- CSS color/theme token grep 또는 수동 검토
- Browser/IAB 또는 Playwright screenshot으로 desktop/mobile layout 확인
- `codex-extracted/`가 task 산출물로 stage되지 않았는지 확인

### 커밋

```text
Task #3 Stage 4: profile UI 시각 검증과 최종 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- Playwright Chromium 또는 browser binary가 없어서 e2e 실행이 막히면, 필요한 설치 명령은 작업지시자 승인 후 실행하고 단계 보고서에 기록한다.
- Browser/IAB 확인이 불가능하면 Playwright screenshot과 `view_image` 검토를 fallback으로 사용한다.
- `git status --short`는 기존 untracked `codex-extracted/`가 계속 남을 수 있으므로, stage 산출물 기준 미정리 변경이 없는지 함께 해석한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_3_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #3 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 구현계획서 승인 전에는 Stage 1 구현 파일을 만들지 않는다.
- 최종 보고서와 PR 게시 단계는 `task-final-report` 절차에서 별도 커밋으로 처리한다.

## 단계 의존성

- Stage 2는 Stage 1의 Vite route와 snapshot view model 연결이 확정된 뒤 진행한다.
- Stage 3은 Stage 2의 profile 본문 구조가 안정된 뒤 chart 영역을 추가한다.
- Stage 4는 Stage 1-3 UI와 상호작용이 모두 구현된 뒤 e2e/visual QA를 수행한다.

## 위험과 대응

- **의존성 설치 네트워크 실패**: React/Vite/Playwright 설치가 sandbox 네트워크 제한에 막히면 승인된 escalation으로 재시도한다. 그래도 실패하면 구현계획서를 갱신해 dependency-free 또는 사전 설치 도구 기반 대안을 승인받는다.
- **Playwright browser 부재**: `@playwright/test`는 설치되어도 Chromium binary가 없을 수 있다. 설치 필요 여부를 확인하고, 필요하면 승인 후 설치한다.
- **Codex reference fidelity**: 실제 Codex bundle을 embed하지 않으므로 pixel-perfect clone은 제한된다. 스크린샷 기반 skeleton, spacing, color token, typography, information hierarchy를 우선 맞추고 차이는 fidelity ledger에 기록한다.
- **sample snapshot 데이터 부족**: #2 fixture는 chart가 14일만 포함한다. 12개월 chart 재현을 위해 UI 변환에서 missing day를 0 token cell로 채우고, 필요하면 fixture 보강은 Stage 2 또는 Stage 3에서 최소 범위로 수행한다.
- **mobile layout 재해석**: 원본 스크린샷은 desktop 중심이다. mobile은 같은 정보 구조를 유지하되 sidebar를 compact 처리하는 승인된 responsive variant로 구현한다.

## 승인 요청 사항

- Stage 1-4 분할과 각 단계 산출물/검증 명령/커밋 메시지를 승인해 달라.
- React + Vite scaffold, Playwright e2e 검증, `package-lock.json` 생성을 승인해 달라.
- 작업지시자가 제공한 Codex 스크린샷과 `codex-extracted/` 분석 결과를 시각 기준으로 삼고, ImageGen 신규 콘셉트는 만들지 않는 예외를 승인해 달라.
- 승인되면 Stage 1 구현을 시작하고, Stage 1 완료 후 단계 보고서와 함께 다시 승인 요청한다.
