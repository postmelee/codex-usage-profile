# Task M100 #69 구현계획서

수행계획서: [`task_m100_69.md`](task_m100_69.md)
GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Appearance 계약 조사와 runtime 기반 | `theme.js`, `ThemeProvider.jsx`, 두 HTML bootstrap | resolver·storage·listener·bootstrap unit, product/Sites build |
| 2 | Semantic token과 전체 surface 이관 | `styles.css`, light/dark route mapping | CSS color audit, 대표 route computed style·Playwright |
| 3 | Settings Appearance control과 접근성 | `SettingsPage.jsx`, `messages.js`, UI tests | radio semantics, en/ko, persistence·system change E2E |
| 3.5 | 비공개 카드 미리보기 theme parity | owner card renderer·preview URL·tests | native/Worker light/dark parity, private cache 분리, public dark 불변 |
| 3.6 | 라이트 툴팁 surface 보정 | tooltip semantic token·computed style tests | light surface/text/border, dark 기준선 불변 |
| 3.7 | Settings panel·Home command surface 보정 | appearance fieldset 구조·home command token·tests | group semantics, panel 내부 제목, light/dark 대비 |
| 4 | 전체 route·Sites artifact 회귀 검증 | 회귀 보정, Stage 4 보고서 | 전체 Node·Playwright·build·Sites verifier·제한 diff |

## 문서 위치 확인

수행계획서의 문서 위치 판단과 실제 Stage 산출물 경로가 일치한다. Codex 앱 appearance
분석은 #69 구현 판단에 종속되므로 별도 공식 문서나 장기 기술 노트로 확장하지 않고
구현계획서와 Stage 1 보고서에 필요한 근거만 기록한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_69.md`, `task_m100_69_impl.md` | OK | 승인 범위와 실행 계약 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_69_stage1.md`~`stage4.md`, `task_m100_69_stage3_5.md` | OK | 단계별 구현·검증 근거 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_69_report.md` | OK | 전체 수용 기준과 잔여 위험 |
| 공식 제품 문서 | 변경 없음 | 해당 없음 | OK | 새 명령·API·배포 절차가 없고 Settings에서 발견 가능 |

## 공통 구현 계약

### 상태 모델과 저장

- React가 노출하는 preference는 `system | light | dark` 세 값이다.
- storage key는 `codex-usage-profile:appearance`로 고정한다.
- storage에는 override인 `light` 또는 `dark`만 저장한다. `system` 선택은 key를 제거한다.
- 값 부재, 알 수 없는 값, storage read/write 예외는 모두 `system`으로 fallback한다.
- 실제 resolved theme는 system preference일 때 `matchMedia("(prefers-color-scheme: dark)")`,
  명시 override일 때 해당 값으로 계산한다.
- document에는 `data-theme-preference`와 resolved `data-theme`을 분리해 기록하고
  `color-scheme`도 resolved theme와 동기화한다.

### 초기 paint와 runtime parity

- `index.html`과 `sites.html`의 `<head>`에서 CSS/React paint 전에 최소 blocking bootstrap을
  실행해 storage와 system media query를 읽고 두 data attribute를 설정한다.
- inline bootstrap은 import 없이 실행 가능해야 하므로 필요한 문자열이 일부 중복된다.
  대신 `theme.test.js`가 두 HTML의 storage key, 허용 mode, attribute 이름과 fallback을
  runtime 상수·결과와 비교해 drift를 차단한다.
- bootstrap은 storage·`matchMedia`·DOM 접근 실패를 삼키고 dark 고정 fallback이 아니라
  가용한 system 결과 또는 안전한 CSS system fallback을 사용한다.
- `ThemeProvider`는 bootstrap이 적용한 document 상태를 초기값으로 재사용해 hydration 전환
  없이 시작하고, 이후 storage와 system change를 단일 구독으로 관리한다.

### Settings control

- Settings의 Appearance panel은 device-local 설정이므로 인증 상태와 무관하게 표시한다.
- `fieldset`/`legend`와 세 radio 또는 동등한 native single-choice semantics를 우선한다.
- 선택 즉시 document theme를 갱신하고 `system` 복귀 시 storage override를 제거한다.
- 기존 account/token/device 영역의 인증 gating과 API 호출 계약은 유지한다.
- header/account menu에는 중복 quick toggle을 추가하지 않는다.

### CSS와 범위 경계

- component CSS는 `data-theme`를 직접 분기하지 않고 semantic custom property만 소비한다.
- theme별 token 선언에서만 light/dark 값을 분기한다. 색상 literal은 token 선언, gradient의
  구조적 stop, 카드 이미지 고유 효과 등 사전에 목록화한 예외에만 허용한다.
- 기존 dark 시각 결과를 기준선으로 유지하고 light theme를 추가한다.
- Stage 1~3은 card PNG/SVG, backend/runtime/storage schema, CLI, package·lockfile,
  `.openai/hosting.json`, static asset을 변경하지 않는다. 승인된 Stage 3.5에서는 owner-only
  on-demand 카드의 light/dark 렌더링과 private preview query 전달에 필요한 renderer·HTTP client/
  endpoint만 변경한다.
- 공개 `/u/{handle}/card.png`, query 없는 `publicCardUrl`, R2 stable object key·binary 기본 theme는
  계속 dark로 유지한다. D1/R2 schema, publish/unpublish, cleanup/retention 계약은 변경하지 않는다.
- Profile 카드 커스터마이징, 선택 저장, light/dark R2 이중 객체와 public query URL 복사는
  후속 Issue [#74](https://github.com/postmelee/codex-usage-profile/issues/74)로 분리한다.
- Stage 3.6은 Profile heatmap 툴팁의 semantic color token과 해당 computed style test만 보정한다.
  툴팁의 내용·위치·크기·motion, heatmap 데이터와 카드 renderer 계약은 변경하지 않는다.
- Stage 3.7은 Appearance의 native fieldset/radio semantics를 유지하면서 제목을 settings panel 내부에
  배치하고, Home 명령어 박스에 주변 Quickstart보다 명확히 구분되는 전용 surface token을 적용한다.
- production Sites deploy와 hosting handoff는 이 task에서 수행하지 않는다.

## Stage 1 — Appearance 계약 조사와 runtime 기반

### 산출물

신규:

- `src/profile-ui/theme.js`
- `src/profile-ui/ThemeProvider.jsx`
- `src/profile-ui/__tests__/theme.test.js`
- `mydocs/working/task_m100_69_stage1.md`

수정:

- `index.html`
- `sites.html`
- `src/main.jsx`
- `src/profile-marketing/sites-entry.jsx`

### 변경 내용

- 설치된 Codex 앱의 현재 appearance UI와 관찰 가능한 light/dark/system 동작을 읽기 전용으로
  조사한다. 참조 version, system 추종, override persistence, 초기 paint와 semantic 역할을
  Stage 1 보고서에 기록한다.
- 저장소에 직접 재사용할 수 있는 공개·호환 코드가 있는지 확인한다. 확인되지 않으면 동작과
  일반 design token 역할만 참고하고 코드·고유 자산은 복사하지 않았다고 기록한다.
- `THEME_PREFERENCES`, storage key, preference 정규화, safe storage adapter,
  resolved theme 계산, media-query subscription, document sync를 순수 helper로 구현한다.
- StrictMode에서 subscription이 중복되지 않도록 unsubscribe 가능한 API를 사용한다.
- `ThemeProvider`와 `useTheme()`가 `preference`, `resolvedTheme`, `setPreference`를 제공한다.
- 두 HTML head에 최소 no-flash bootstrap을 추가하고 두 React entry를 동일 Provider로 감싼다.
- JS가 비활성화되거나 bootstrap 일부 API가 없는 경우 CSS system fallback이 동작하도록
  Stage 2 token 선언과 연결할 attribute 계약을 먼저 확정한다.

### 검증

```bash
node --test src/profile-ui/__tests__/theme.test.js
npm run build
npm run build:sites
git diff --check
```

추가 확인:

- `theme.test.js`에서 `system/light/dark`, 손상 값, storage 예외, listener cleanup을 검증한다.
- `index.html`과 `sites.html`의 bootstrap parity 및 React mount 이전 위치를 source test한다.
- Stage 시작점 대비 `.openai/hosting.json`, package·lockfile, backend, CLI, renderer diff가 없다.

### 커밋

```text
Task #69 Stage 1: appearance runtime 계약과 초기 theme 적용
```

## Stage 2 — Semantic token과 전체 surface 이관

### 산출물

수정:

- `src/styles.css`
- `tests/profile-ui.spec.js`
- 필요 시 기존 theme 관련 단위 테스트

신규:

- `mydocs/working/task_m100_69_stage2.md`

### 변경 내용

- 현행 color literal을 역할별로 분류하고 token 선언부의 승인 예외 목록을 Stage 2 보고서에
  기록한다.
- 기존 `--bg`, `--surface`, text, line, heatmap token을 page/surface/text/border/action/focus/
  status/overlay/shadow/skeleton/heatmap 역할로 보강한다.
- dark token은 현재 시각 기준선을 보존하고 light token은 동일 의미와 충분한 대비를 갖게 한다.
- attribute가 아직 없는 경우 `prefers-color-scheme` 기반 system fallback을 제공한다.
- Home·Marketing landing·owner/public Profile·Settings·device approval·Share Studio와
  loading/skeleton/empty/error 상태의 hard-coded theme color를 semantic token으로 바꾼다.
- heatmap 5단계, tooltip, exact token control, account menu, modal overlay, toast,
  card preview border/beam/glare를 두 theme에서 분리 가능한 값으로 mapping한다.
- motion duration·구조는 유지하고 `prefers-reduced-motion` 계약을 건드리지 않는다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/accountUi.test.js \
  src/profile-ui/__tests__/heatmap.test.js \
  src/profile-ui/__tests__/homeCardTransition.test.js \
  src/profile-ui/__tests__/shareStudio.test.js
npx playwright test tests/profile-ui.spec.js --grep "theme surfaces"
git diff --check
```

추가 확인:

- CSS color inventory를 다시 실행해 token 선언·승인 예외 외 literal이 남지 않았는지 검사한다.
- Home, Profile, Settings, device, Share Studio의 대표 surface에서 computed background, text,
  border, focus token이 resolved theme에 따라 바뀌는지 검증한다.
- dark 기준 screenshot 또는 기존 대표 화면을 수동 비교해 회귀가 없는지 확인한다.

### 커밋

```text
Task #69 Stage 2: semantic theme token과 전체 surface 이관
```

## Stage 3 — Settings Appearance control과 접근성

### 산출물

수정:

- `src/profile-ui/SettingsPage.jsx`
- `src/profile-ui/messages.js`
- `src/profile-ui/__tests__/i18n.test.js`
- `src/profile-ui/__tests__/theme.test.js`
- `tests/profile-ui.spec.js`

신규:

- `mydocs/working/task_m100_69_stage3.md`

### 변경 내용

- Settings heading 아래에 인증 상태와 무관한 Appearance panel을 추가한다.
- system/light/dark를 native radio group semantics로 제공하고 `useTheme()`와 연결한다.
- 영어·한국어 title, description, option label, system 설명과 접근성 이름을 message catalog에
  추가하고 catalog·placeholder·literal ID parity test를 유지한다.
- anonymous/loading/unavailable Settings 상태에서도 Appearance는 사용할 수 있게 하되 기존
  account state 안내와 GitHub login CTA는 유지한다.
- 선택 즉시 반영, reload persistence, 새 browser context, system 복귀 시 key 제거,
  system media-query change 반영을 검증한다.
- keyboard Tab과 arrow-key selection, visible focus, checked state, disabled 없음 계약을 검증한다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/theme.test.js \
  src/profile-ui/__tests__/i18n.test.js \
  src/profile-ui/__tests__/accountUi.test.js
npx playwright test tests/profile-ui.spec.js --grep "appearance control|theme preference"
git diff --check
```

### 커밋

```text
Task #69 Stage 3: Settings appearance control과 접근성 추가
```

## Stage 3.5 — 비공개 카드 미리보기 theme parity

### 산출물

신규:

- `src/profile-card/theme.js`
- `mydocs/working/task_m100_69_stage3_5.md`

수정:

- `src/profile-card/renderer.js`
- `src/profile-card/worker-renderer.js`
- `src/profile-card/heatmap.js`
- `src/profile-card/view-model.js`
- `src/profile-card/service-core.js`
- `src/profile-card/index.js`
- `src/profile-backend/http.js`
- `src/profile-api/client.js`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- 관련 renderer·service·HTTP·client·UI 테스트

### 변경 내용

- 공개적으로 관찰 가능한 Codex light/dark 카드의 semantic 역할을 참고하되 내부 source·고유
  asset을 복사하거나 정확한 내부 token이라고 주장하지 않는다. dark palette는 현재 pixel 기준을
  유지하고 light palette는 white surface, dark text, light divider/empty heatmap과 같은 역할로
  명시한다.
- owner-only `/api/profile/card.png`가 `theme=light|dark`를 받아 native와 Worker renderer에
  동일하게 전달한다. 알 수 없는 값과 값 부재는 호환 기본값 `dark`로 정규화한다.
- renderer는 배경·text·divider·avatar fallback·5단계 heatmap을 하나의 공유 palette 계약으로
  선택한다. view model의 사용량·레이아웃·motion 효과는 theme와 무관하게 유지한다.
- private render source digest/cache는 light와 dark를 분리한다. dark 기본 digest와 pixel 결과는
  기존 public card와 호환되도록 유지하고 light만 theme discriminator를 추가한다.
- 로그인한 owner의 Home 카드, owner Profile 카드와 Share Studio 미리보기 URL에 현재
  `resolvedTheme`를 넣는다. system preference는 이미 해석된 `light|dark`만 전달한다.
- 공개 card route, R2 stable object, `publicCardUrl`, Share/README 복사 값은 theme query를
  추가하지 않고 기존 dark 결과를 유지한다.
- 저장 가능한 카드 preference, customization UI, D1 migration, light/dark R2 이중 object,
  `?theme=` 공개 URL은 #74 범위이므로 구현하지 않는다.

### 검증

```bash
node --test \
  src/profile-card/__tests__/*.test.js \
  src/profile-api/__tests__/client.test.js \
  src/profile-backend/__tests__/http.test.js
npx playwright test tests/profile-ui.spec.js --grep "themed card preview"
npm run build
npm run build:sites
git diff --check
```

추가 확인:

- 동일 owner/revision의 light와 dark private URL·source digest가 분리되고 각 palette가 native와
  Worker에서 같은 역할·heatmap level로 렌더링되는지 검증한다.
- theme query가 없는 private 카드와 모든 public 카드 요청은 기존 dark 결과를 유지한다.
- Settings에서 appearance를 바꾼 뒤 Home·Profile·Share Studio private preview만 새 URL로
  전환되고 공개 복사 URL은 바뀌지 않는지 확인한다.
- `.openai/hosting.json`, package·lockfile, CLI, D1/R2 migration, publish/cleanup 경로 diff가 없다.

### 커밋

```text
Task #69 [Stage 3.5]: theme-aware private card preview 추가
```

## Stage 3.6 — 라이트 툴팁 surface 보정

### 산출물

수정:

- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/plans/task_m100_69_impl.md`

신규:

- `mydocs/working/task_m100_69_stage3_6.md`

### 변경 내용

- Profile heatmap 툴팁의 light theme를 밝은 elevated surface, 어두운 primary text, 얕은 border와
  기존 floating shadow 조합으로 보정한다.
- dark theme의 현행 `#3f4042` surface와 밝은 text 기준선은 유지한다.
- component에는 theme 분기나 색상 literal을 추가하지 않고 기존 `--tooltip-*` semantic token만
  사용한다.
- 툴팁의 날짜·축약/정확 토큰 문구, 위치 계산, 32px 높이, enter motion은 변경하지 않는다.
- light/dark computed background, text, border를 Playwright에서 검증한다.
- backend, card renderer, public/R2 object, package·lockfile, `.openai/hosting.json`은 변경하지 않는다.

### 검증

```bash
npx playwright test tests/profile-ui.spec.js --grep "theme surfaces"
npm run build
npm run build:sites
git diff --check
```

제한 경로 확인:

```bash
git diff a55895d -- \
  .openai/hosting.json \
  package.json package-lock.json \
  packages/codex-usage-profile-cli \
  src/profile-backend src/profile-runtime src/profile-media \
  src/profile-card public
```

### 커밋

```text
Task #69 [Stage 3.6]: light tooltip surface 보정
```

## Stage 3.7 — Settings panel·Home command surface 보정

### 산출물

수정:

- `src/profile-ui/SettingsPage.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/plans/task_m100_69_impl.md`

신규:

- `mydocs/working/task_m100_69_stage3_7.md`

### 변경 내용

- Appearance의 시각 panel wrapper와 native fieldset을 분리한다. visible legend는 border 없는
  fieldset 내부에 두어 아래 Settings panel의 `h2`와 같은 content inset에서 시작하게 한다.
- `fieldset`/`legend`, radio name, description 연결과 keyboard 선택 semantics는 유지한다.
- Home Quickstart의 command row는 home 전용 semantic token을 사용한다. light에서는 주변
  `content-background-subtle`보다 밝은 white surface, dark에서는 현행 `#111111` surface를 유지한다.
- Profile empty state 등 다른 `surface-code` 소비자는 변경하지 않는다.
- E2E에서 Appearance legend가 panel border 안쪽에 위치하는지, light/dark command row surface가
  주변 Quickstart와 구분되는지 computed layout/style로 검증한다.
- backend, card renderer, public/R2 object, package·lockfile, `.openai/hosting.json`은 변경하지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/theme.test.js
npx playwright test tests/profile-ui.spec.js --grep "theme surfaces|appearance panel layout"
npm run build
npm run build:sites
git diff --check
```

제한 경로 확인:

```bash
git diff 16bce41 -- \
  .openai/hosting.json \
  package.json package-lock.json \
  packages/codex-usage-profile-cli \
  src/profile-backend src/profile-runtime src/profile-media \
  src/profile-card public
```

### 커밋

```text
Task #69 [Stage 3.7]: settings와 command surface 보정
```

## Stage 4 — 전체 route·Sites artifact 회귀 검증

### 산출물

수정:

- 검증에서 발견된 #69 범위 내 source·test 보정 파일
- `tests/profile-ui.spec.js`

신규:

- `mydocs/working/task_m100_69_stage4.md`

### 변경 내용

- light/dark/system과 storage 부재·손상·접근 실패 조합을 전체 E2E로 마감한다.
- product와 Sites entry의 첫 script 실행 직후부터 첫 화면까지 반대 theme가 노출되지 않는지
  attribute와 computed style 시점으로 검증한다.
- Home, Marketing, owner/public Profile, Settings, device, Share Studio의 대표 route/dialog와
  Stage 3.5 owner-only 카드 미리보기를 light/dark에서 순회한다.
- mobile viewport, keyboard focus, reduced-motion, system runtime change를 회귀 검증한다.
- full-stack·production artifact를 만들고 Sites verifier를 통과시킨다.
- 수행계획의 변경 금지 경로와 package·lockfile·static asset diff를 최종 감사한다.
- 실제 production deploy, environment/access/secret 변경은 수행하지 않는다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

제한 경로 확인:

```bash
git diff origin/devel...HEAD -- \
  .openai/hosting.json \
  package.json package-lock.json \
  packages/codex-usage-profile-cli \
  src/profile-backend src/profile-runtime src/profile-media \
  src/profile-card public
```

### 커밋

```text
Task #69 Stage 4: 전체 theme 회귀와 Sites artifact 검증
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- Playwright `--grep` 이름은 해당 Stage에서 추가하는 describe/test title과 정확히 맞춘다.
- CSS 시각 검증은 screenshot만으로 판단하지 않고 computed token·접근성 상태를 함께 확인한다.
- 외부 통합 환경이 필요한 기존 테스트가 skip되면 #69 변경 경로와의 관련성을 보고서에 적는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 계획서를 갱신하고 승인받는다.

## 커밋

- 단계 source, test와 `mydocs/working/task_m100_69_stage{N}.md`를 같은 커밋으로 묶는다.
- 커밋 메시지는 각 Stage에 명시한 형식을 사용한다.
- Stage 승인 전 다음 Stage source를 수정하지 않는다.
- 전체 Stage 승인 후에만 최종 보고서와 PR 게시 절차로 이동한다.

## 단계 의존성

- Stage 1은 Codex 앱 참고 범위와 theme runtime 계약을 확정한다.
- Stage 2는 Stage 1의 data attribute, Provider와 bootstrap 계약을 기준으로 CSS를 이관한다.
- Stage 3은 Stage 1 Provider와 Stage 2 token을 사용해 Settings control을 노출한다.
- Stage 3.5는 Stage 1~3의 resolved theme를 owner-only on-demand card preview에만 연결하고,
  공개 R2 card는 dark 호환 결과로 고정한다.
- Stage 4는 Stage 1~3.7 승인 후 전체 회귀와 artifact 검증만 수행한다.
- 각 Stage 종료 시 `task-stage-report`로 보고서·검증·커밋을 완료하고 다음 Stage 승인을 받는다.

## 위험과 대응

- **inline bootstrap 중복**: no-flash를 위해 두 HTML에 작은 코드가 필요하다. source parity test로
  storage key, mode, attribute와 fallback drift를 차단한다.
- **browser API 차이**: legacy `MediaQueryList.addListener` fallback과 표준
  `addEventListener("change")`를 adapter 내부에서 처리하고 cleanup을 검증한다.
- **인증 상태와 local preference 결합**: Appearance panel을 인증 분기 밖에 두고 API 없이
  동작시켜 theme 선택 실패가 account 기능에 영향을 주지 않게 한다.
- **CSS token 누락**: color inventory, hard-coded literal 예외 목록, route별 computed style
  검증을 Stage 2와 Stage 4에서 반복한다.
- **초기 paint 자동화 한계**: screenshot 한 장만으로 flash를 증명하지 않고 bootstrap 직후
  attribute, 최초 computed background와 first content paint 전후 값을 함께 확인한다.
- **Codex 앱 참고 범위**: 관찰 가능한 동작과 일반 semantic 역할만 기록한다. 라이선스가
  확인되지 않은 source나 제품 고유 자산은 복사하지 않는다.
- **Sites 범위 팽창**: 기존 Vite·Worker·hosting manifest를 유지하고 artifact 검증까지만 한다.
- **공개 카드 URL·cache 호환성**: theme discriminator는 light private render에만 추가하고 public
  route·R2 key·queryless URL·dark pixel 기준을 고정한다. 영속 customization은 #74로 격리한다.
- **라이트 툴팁 대비 회귀**: tooltip semantic token의 light/dark computed surface·text·border를
  같은 E2E에서 검증하고 dark 기준선을 함께 고정한다.
- **fieldset 시각 보정의 접근성 회귀**: panel wrapper와 fieldset을 분리하되 native legend/radio
  group을 유지하고 keyboard·accessible name 기존 테스트와 panel 내부 위치 검증을 함께 실행한다.
- **명령어 surface 범위 팽창**: Home 전용 token으로 제한해 다른 code surface와 public card에는
  영향을 주지 않는다.

## 승인 요청 사항

- 위 4개 정규 Stage와 승인된 Stage 3.5 분할, 각 Stage 산출물·검증·커밋 메시지
- storage `null=system`, 저장 허용값 `light|dark`, key
  `codex-usage-profile:appearance` 계약
- `data-theme-preference`와 resolved `data-theme`을 분리하는 document 계약
- no-flash를 위해 두 HTML에 최소 blocking bootstrap을 두고 runtime parity test로 관리하는 방향
- Appearance panel을 인증과 무관하게 Settings에 노출하고 header quick toggle을 만들지 않는 방향
- Stage 1에서 Codex 앱을 읽기 전용으로 분석하고 관찰 가능한 동작·semantic mapping만 참고하는 경계
- Stage 4까지 production deploy 없이 local·artifact 검증만 수행하는 Gate
- Stage 3.5에서 owner-only 미리보기만 resolved theme를 따르고 공개 R2 card는 dark로 유지하는 경계
- Stage 3.6에서 툴팁 semantic color만 보정하고 내용·layout·motion은 유지하는 경계
- Stage 3.7에서 Appearance group semantics를 유지하고 Home command surface만 분리하는 경계
- 영속 카드 customization과 light/dark R2 이중 객체는 #74로 분리하는 경계

Stage 3.7 변경안은 작업지시자의 Settings panel과 Home command surface 보정 지시로 승인되었으며, 구현·검증·단계
보고서·커밋을 완료한 뒤 Stage 4 진입 승인을 별도로 요청한다.
