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
| 4 | 전체 route·Sites artifact 회귀 검증 | 회귀 보정, Stage 4 보고서 | 전체 Node·Playwright·build·Sites verifier·제한 diff |

## 문서 위치 확인

수행계획서의 문서 위치 판단과 실제 Stage 산출물 경로가 일치한다. Codex 앱 appearance
분석은 #69 구현 판단에 종속되므로 별도 공식 문서나 장기 기술 노트로 확장하지 않고
구현계획서와 Stage 1 보고서에 필요한 근거만 기록한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_69.md`, `task_m100_69_impl.md` | OK | 승인 범위와 실행 계약 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_69_stage1.md`~`stage4.md` | OK | 단계별 구현·검증 근거 |
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
- card PNG/SVG 자체, backend/runtime/storage schema, CLI, package·lockfile,
  `.openai/hosting.json`, static asset은 변경하지 않는다.
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
- Home, Marketing, owner/public Profile, Settings, device, Share Studio의 대표 route/dialog를
  light/dark에서 순회한다.
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
- Stage 4는 Stage 1~3 승인 후 전체 회귀와 artifact 검증만 수행한다.
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

## 승인 요청 사항

- 위 4개 Stage 분할과 각 Stage 산출물·검증·커밋 메시지
- storage `null=system`, 저장 허용값 `light|dark`, key
  `codex-usage-profile:appearance` 계약
- `data-theme-preference`와 resolved `data-theme`을 분리하는 document 계약
- no-flash를 위해 두 HTML에 최소 blocking bootstrap을 두고 runtime parity test로 관리하는 방향
- Appearance panel을 인증과 무관하게 Settings에 노출하고 header quick toggle을 만들지 않는 방향
- Stage 1에서 Codex 앱을 읽기 전용으로 분석하고 관찰 가능한 동작·semantic mapping만 참고하는 경계
- Stage 4까지 production deploy 없이 local·artifact 검증만 수행하는 Gate

승인되면 Stage 1만 구현하고 검증·단계 보고서·커밋까지 완료한 뒤 다음 Stage 승인을 요청한다.
