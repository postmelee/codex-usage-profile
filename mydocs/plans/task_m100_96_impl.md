# Task #96 구현계획서 — 테마 전환 텍스트와 Skeleton 팔레트 정합성 보정

- 수행계획서: [`task_m100_96.md`](task_m100_96.md)
- GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
- 마일스톤: M100 — v1.0 MVP
- 상태: 구현 승인

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | text·Skeleton ownership audit와 회귀 재현 | source contract, computed-color·palette expected failure E2E, ownership matrix | Node source audit, Chromium·WebKit baseline |
| 2 | semantic text color ownership 보정 | Profile/Home 관련 heading의 직접 semantic color | color transition 이력, system/light/dark, reduced-motion |
| 3 | site/card Skeleton palette 분리 | page Skeleton token, card theme context·variant, 조합별 회귀 | page×card theme matrix, geometry/readiness 유지 |
| 4 | 통합 검증과 비배포 로컬 확인 handoff | 전체 검증, Sites 산출물, 로컬·실제 모바일 merge Gate | unit/E2E/build/verify/smoke, 배포 미수행 감사 |

## 상태·token ownership 불변식

### Text semantic ownership

- page 주요 heading은 상위 `body`·stage의 inherited color에 의존하지 않고 목적에 맞는 semantic
  token을 직접 소유한다.
- Profile display name, Home Quickstart title·step title은 `--text-primary`를 직접 사용한다.
- 설명·handle·step description은 기존 `--text-secondary`, step number는 `--text-tertiary`를 유지한다.
- status danger/success, link, action text와 card-internal text는 이번 primary heading selector에 포함하지
  않아 의미별 상태색을 덮어쓰지 않는다.
- `data-theme-animating` window는 기존 240ms를 유지한다. 일반 motion과 hover transition을 영구적으로
  느리게 하지 않는다.

### Skeleton palette ownership

- `profile-loading-shimmer`처럼 page layout의 구조를 대신하는 placeholder는 site theme token만 쓴다.
  light에서는 밝은 중성 base와 어두운 반투명 sheen, dark에서는 기존 dark base와 밝은 sheen을 쓴다.
- `.home-card-skeleton`처럼 PNG card 안의 content를 대신하는 placeholder는 card theme token만 쓴다.
  site가 light여도 dark card preview는 dark palette, site가 dark여도 light card preview는 light palette다.
- card theme context는 preview URL 또는 기존 saved card style에서 이미 계산되는 `light|dark` 값을
  DOM에 명시한다. 새 storage/API/state를 만들지 않는다.
- card theme를 알 수 없는 sample/operator는 기존 canonical dark preview 의미를 기본값으로 유지한다.
- background·placeholder·divider·muted·sheen만 theme variant로 분리하고 geometry, radius, opacity,
  animation duration, readiness와 z-index는 변경하지 않는다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_96*.md` | OK | 내부 구현·승인 경계 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_96_stage{N}.md` | OK | 단계별 증거와 함께 커밋 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_96_report.md` | OK | 전체 검증·merge Gate 기록 |
| README·공개 문서 | 변경 없음 | 해당 없음 | OK | 공개 계약 변경 없음 |

## Stage 1 — text·Skeleton ownership audit와 회귀 재현

### 산출물

신규:

- `mydocs/working/task_m100_96_stage1.md`
- 필요 시 `src/profile-ui/__tests__/themeSurfaceContract.test.js`

수정:

- `tests/profile-ui.spec.js`
- `mydocs/orders/20260812.md`

### 변경 내용

- `src/styles.css`와 Profile/Home JSX를 읽어 page text를 direct semantic color와 inherited color로
  분류한다. Profile display name, Home Quickstart h2·step h3를 확정 재현 대상에 포함한다.
- page Skeleton과 card Skeleton이 참조하는 CSS custom property를 surface별로 목록화한다. owner/public
  Profile, Home, public card intro, Share Studio, settings preview에서 실제 `.home-card-skeleton`의
  card theme context 유무를 확인한다.
- source contract 테스트는 문제 selector가 아직 직접 `color`를 소유하지 않고 page shimmer가
  dark-card token을 참조하는 현재 기준선을 expected failure로 고정한다. Stage 2·3 뒤 unexpected pass가
  되지 않도록 단계별 annotation을 분리한다.
- Playwright는 theme toggle 직전과 `data-theme-animating` 중간·attribute 제거 직후의 computed color를
  수집한다. CSS transitionrun/end event, elapsed time과 requestAnimationFrame sample을 사용해 중간색
  부재 또는 종료 뒤 snap을 재현한다.
- light owner/public Profile loading을 지연해 page placeholder base·`::after` gradient의 computed
  값을 기록한다. dark card Skeleton과 같은 dark base를 사용하는 현재 결함을 expected failure로 둔다.
- card Skeleton은 Home와 설정 preview에서 site theme를 바꿔도 card theme가 같으면 palette가
  유지되어야 한다는 조합 계약을 정의한다. context가 없는 surface는 Stage 1 보고서에 gap을 기록한다.
- 제품 source와 public 문서는 이 Stage에서 변경하지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/theme.test.js src/profile-ui/__tests__/themeSurfaceContract.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #96" --workers=1
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #96" --workers=1
git diff --check
```

별도 source contract 파일을 만들지 않으면 해당 명령에서 제거하고 기존 `theme.test.js`에 배치한
근거를 Stage 1 보고서에 기록한다.

### 커밋

```text
Task #96 Stage 1: 테마 text와 Skeleton ownership 회귀 고정
```

## Stage 2 — semantic text color ownership 보정

### 산출물

신규:

- `mydocs/working/task_m100_96_stage2.md`

수정:

- `src/styles.css`
- Stage 1 source contract·E2E
- `mydocs/orders/20260812.md`

### 변경 내용

- `.profile-heading h1/h2`, `.profile-stage h2`, `.home-quickstart-heading h2`,
  `.home-quickstart-steps h3`에 `color: var(--text-primary)`를 직접 부여한다.
- audit에서 같은 공통 조건이 증명된 page heading만 함께 보정한다. 이미 direct token을 가진
  public/settings/section heading이나 상태색·button/link는 중복 selector에 넣지 않는다.
- source contract expected failure를 정상 assertion으로 전환해 모든 문제 selector가 semantic primary
  token을 직접 소유하는지 확인한다.
- Playwright에서 dark→light와 light→dark의 120ms 중간 computed color가 양 끝 색과 다르고, 240ms
  안에 최종 색으로 수렴하며 `data-theme-animating` 제거 뒤 추가 color change가 없는지 검증한다.
- system preference 변경은 기존 설정 control의 system mode 경로에서 같은 direct semantic color를
  사용하게 한다. reduced-motion에서는 `markThemeTransition`이 attribute를 만들지 않는 기존 계약을
  유지하고 즉시 최종 color에 도달하는지 확인한다.
- CSS 외 React·theme state 구조는 바꾸지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/theme.test.js src/profile-ui/__tests__/themeSurfaceContract.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #96.*text|theme preference" --workers=1
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #96.*text" --workers=1
git diff --check
```

### 커밋

```text
Task #96 Stage 2: semantic text theme transition 보정
```

## Stage 3 — site/card Skeleton palette 분리

### 산출물

신규:

- `mydocs/working/task_m100_96_stage3.md`

수정:

- `src/styles.css`
- card theme context가 필요한 최소 `src/profile-ui/*.jsx`와 marketing Skeleton component
- 관련 source contract·E2E
- `mydocs/orders/20260812.md`

### 변경 내용

- site page Skeleton용 `--page-skeleton-base`, `--page-skeleton-sheen-edge`,
  `--page-skeleton-sheen-center`를 light-dark semantic token으로 추가한다.
- `profile-loading-shimmer`와 page layout placeholder만 page token으로 교체한다. mask용 black/transparent,
  avatar artwork와 card image Skeleton은 page token 대상에서 제외한다.
- card Skeleton token은 dark 기본값과 light variant를 명시한다. light variant는 실제 light PNG palette의
  background·muted·divider 대비에 맞추되 renderer 출력 자체는 변경하지 않는다.
- `CardImageMedia`/`CardImageSkeleton` 경계에서 기존 preview theme를 `data-card-theme` 또는 동등한
  existing variant로 전달한다. Home·Profile owner preview, public card intro, Share Studio, settings
  preview가 실제 요청 URL/saved style의 theme와 일치하는지 확인한다.
- theme context를 전달할 수 없는 operator/sample은 canonical dark default를 사용하고 이 fallback을
  source contract에 명시한다.
- page light/dark × card light/dark 4조합에서 page placeholder는 site theme에 따라 바뀌고 card
  placeholder는 card theme만 따라가는지 computed style로 검증한다.
- 기존 Skeleton geometry, `aria-busy`, data-active, crossfade, motion handoff와 reduced-motion assertion을
  전체 관련 surface에서 재실행한다.

### 검증

```bash
node --test src/profile-ui/__tests__/theme.test.js src/profile-ui/__tests__/themeSurfaceContract.test.js src/profile-ui/__tests__/cardImageReadiness.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #96|Skeleton|card appearance preview keeps" --workers=1
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #96" --workers=1
git diff --check
```

### 커밋

```text
Task #96 Stage 3: site와 card Skeleton palette 분리
```

## Stage 4 — 통합 검증과 비배포 로컬 확인 handoff

### 산출물

신규:

- `mydocs/working/task_m100_96_stage4.md`

수정:

- 검증 중 재현된 Task #96 범위의 최소 보정 파일
- `mydocs/orders/20260812.md`

### 변경 내용

- 전체 Node·Playwright, production Sites build·artifact verifier·local full-stack smoke를 실행한다.
- Chromium과 WebKit에서 Task #96 text transition과 palette matrix를 다시 실행한다.
- 실제 배포 없이 로컬 확인 URL과 실제 모바일 Safari·Chrome 체크리스트를 제공한다.
  1. Home dark↔light에서 Quickstart와 모든 step title 동시 전환
  2. Profile dark↔light에서 display name·stats·activity 동시 전환
  3. light owner/public Profile slow loading에서 밝은 page Skeleton
  4. site light/dark와 card light/dark를 교차 변경해 card Skeleton이 card theme만 따르는지 확인
  5. reduced-motion 설정에서 shimmer·불필요 transition 미실행 확인
- 작업지시자 요청대로 실제 Sites 배포는 하지 않는다. PR 게시 뒤 실제 모바일 확인을 merge Gate로
  남기고, #95·#96 merge 뒤 별도 동시 배포 요청을 기다린다.
- 결과를 #84 exact release candidate Gate C 재개 조건으로 기록한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #96" --workers=1
git diff --check
git status --short
```

### 커밋

```text
Task #96 Stage 4: 테마와 Skeleton 통합 검증 handoff 완료
```
