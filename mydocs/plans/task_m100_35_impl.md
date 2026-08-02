# Task M100 #35 구현계획서

수행계획서: [`task_m100_35.md`](task_m100_35.md)
GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
마일스톤: M100
계획 변경 승인: 2026-08-02

## 단계 개요

| Stage | 제목 | 상태 | 주요 산출 |
|---|---|---|---|
| 1 | 공유 card geometry와 tooltip contract | 완료 기록 보존·방향 대체 | 기존 Stage 1 보고서 |
| 2 | Home/public card overlay 통합 | 완료 기록 보존·방향 대체 | 기존 Stage 2 보고서 |
| 3 | 방향 전환 정리와 Profile heatmap data contract | 완료 | card overlay 제거, 52주 mode builder |
| 4 | owner/public Profile 통합 | 완료 | Profile token activity UI·interaction |
| 5 | Profile 설정·홈 카드 parity 보정 및 QA | 완료 | exact token 설정, 공유 card 표현 통일, 전체 artifact 검증 |

## 계획 변경 처리 원칙

- 기존 Stage 1·2 커밋과 보고서는 당시 구현·검증 기록으로 유지한다.
- Git history를 reset 또는 rewrite하지 않는다.
- Stage 3에서 최종 제품 방향에 필요 없는 card overlay와 geometry 변경을 명시적으로
  제거해 PR final diff를 Profile 기능에 맞춘다.
- Stage 1의 pure formatting/navigation 개념은 재사용할 수 있지만 card geometry와
  결합된 파일을 그대로 유지하지 않는다.
- 기존 Stage 3 계획은 취소하고 아래 Stage 3~5로 대체한다.

## 문서 위치 확인

수행계획서의 변경된 문서 위치 판단을 그대로 따른다.

| 파일 | 위치 | 비고 |
|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | 변경 범위와 단계 승인 기록 |
| 단계 보고서 | `mydocs/working/` | Stage 1·2 대체 이력 및 Stage 3~5 검증 |
| 최종 보고서 | `mydocs/report/` | 최종 수용 기준과 잔여 위험 |
| 공식 제품 문서 | 변경하지 않음 | route, API, CLI 절차 비변경 |

## Stage 3 — 방향 전환 정리와 Profile heatmap data contract

### 목적

카드 위 interaction을 최종 제품에서 제거하고, Account Usage Contract v1의 실제
daily bucket을 owner/public Profile이 공유할 수 있는 52주 heatmap data contract로
정규화한다.

### 제거·원복 대상

- `src/profile-ui/CardHeatmapOverlay.jsx`
- `src/profile-ui/cardHeatmapTooltip.js`
- `src/profile-ui/__tests__/cardHeatmapTooltip.test.js`
- `src/profile-card/geometry.js`
- `src/profile-card/__tests__/geometry.test.js`
- `HomePage.jsx`, `PublicProfilePage.jsx`, `styles.css`, `tests/profile-ui.spec.js`의
  card overlay 전용 부분
- renderer와 `profile-card/index.js`의 card overlay만을 위한 geometry refactor

원복은 Stage 1 이전 동작을 기준으로 필요한 본문을 명시적으로 수정한다. 다른 task나
작업지시자가 만든 변경을 되돌리지 않으며 `origin/devel`과 파일별 diff를 확인한다.

### 구현 대상

- `src/profile-ui/heatmap.js` 또는 동등한 pure module을 실제
  `dailyUsageBuckets[{ startDate, tokens }]` 입력 계약으로 정리한다.
- 52주 UTC 범위와 미래 날짜 제외 규칙을 고정한다.
- daily cell은 날짜별 raw token 값을 갖는다.
- weekly mode는 Sunday~Saturday token 합계와 week range를 갖는다.
- cumulative mode는 52주 시작부터 해당 week까지의 running total을 갖는다.
- daily는 364개 cell, weekly/cumulative는 52개 semantic week target을 반환한다.
- mode별 값으로 intensity 0~4를 독립 계산한다.
- month label, latest scroll anchor와 grid geometry metadata를 pure 결과로 제공한다.
- `en`/`ko` formatter는 축약값과 locale grouping을 적용한 정확한 raw token을 함께
  반환한다.
- 잘못된 날짜, 음수·비정수 token, 중복 날짜와 정렬되지 않은 입력의 처리 규칙을
  Account Usage normalize contract와 일치시킨다.

### 테스트

- 정확히 52주 범위, 첫/마지막 날짜와 leap/year 경계
- 빈 날짜 0, 미래 날짜 제외, latest captured date anchor
- daily/weekly/cumulative 합계와 intensity max
- weekly/cumulative target 수 52와 중복 focus 제거
- `en`/`ko`, 0/단수/대형 token의 축약·정확 값
- card renderer와 static/public card output의 기존 테스트 통과
- Home/public card에 `.card-heatmap-overlay`가 남지 않음

### 검증

```bash
node --test src/profile-ui/__tests__/heatmap.test.js
node --test src/profile-card/__tests__/heatmap.test.js src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
npm run build
git diff --check
```

추가 확인:

```bash
git diff origin/devel -- src/profile-card src/profile-ui/HomePage.jsx public/assets
```

card renderer와 static asset에는 Task #35 최종 변경이 없어야 한다.

### Stage 보고·커밋

- `mydocs/working/task_m100_35_stage3.md`
- 커밋: `Task #35 Stage 3: Profile heatmap 데이터 계약으로 전환`

## Stage 4 — owner/public Profile 통합

### 목적

재사용 가능한 token activity heatmap을 owner `/profile`과 공개 Profile에 통합하고,
참고 화면의 정보 계층을 현재 Site shell 안에서 구현한다.

### 구현 대상

- `TokenActivityChart`를 Account Usage Profile 전용 재사용 component로 정리한다.
- identity와 summary stats 다음에 `Token activity` section을 배치한다.
- mode control은 `Daily`, `Weekly`, `Cumulative`를 제공하고 현재 mode를
  `aria-pressed` 또는 tab pattern으로 명시한다.
- owner Profile은 기존 card preview, visibility mutation과 Share Studio를 별도
  card section으로 유지한다.
- public Profile은 owner mutation 없이 identity, stats, token activity와 공개 card를
  표시한다.
- mode별 target에 hover/focus/tap tooltip을 제공한다.
- daily grid는 roving ArrowLeft/Right/Up/Down, weekly/cumulative는 좌우 이동을
  제공한다.
- Escape, blur, outside pointer, mode/source 변경, resize/scroll에서 tooltip을 닫는다.
- 좁은 화면은 chart wrapper만 가로 스크롤하고 최근 주로 정렬한다.
- tooltip은 viewport clamp, 위/아래 fallback과 reduced-motion을 지원한다.
- no-usage는 기존 submit CTA를 유지하고 heatmap demo 값을 표시하지 않는다.

### 수정 후보

- `src/profile-ui/TokenActivityChart.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/publicProfileRoutes.js`
- `src/profile-ui/__tests__/publicProfileRoutes.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`

### 테스트

- owner actual usage identity/stats/daily mode
- owner weekly/cumulative mode와 정확한 합계 tooltip
- public actual usage와 private/missing public profile fail-close
- desktop hover와 keyboard roving/Escape
- mobile tap toggle/outside tap
- mode 전환 시 stale tooltip 제거
- 1280×900, 390×844, short viewport와 page horizontal overflow 없음
- owner visibility/share/card preview 회귀
- loading/no-usage/error 상태에서 profile data leak 없음

### 검증

```bash
node --test src/profile-ui/__tests__/heatmap.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js
npm run test:e2e -- --grep "Token activity|Profile heatmap"
npm run build
git diff --check
```

### Stage 보고·커밋

- `mydocs/working/task_m100_35_stage4.md`
- 커밋: `Task #35 Stage 4: owner와 public Profile heatmap 통합`

## Stage 5 — Profile 설정·홈 카드 parity 보정 및 browser·Sites artifact QA

### 목적

작업지시자 UI 확인에서 발견된 tooltip 정보 밀도와 owner card 표현 차이를 보정하고,
변경된 Profile interaction과 기존 card/share/visibility 흐름을 전체 환경에서 검증해
production 배포 전 local artifact 수용 기준을 확정한다.

### 구현 보정

- heatmap 우측 아래에 `Show exact token count` checkbox를 제공한다.
- 기본값은 OFF이며 tooltip은 locale compact token만 표시한다. ON일 때만 locale
  grouping을 적용한 반올림하지 않은 raw token을 괄호로 함께 표시한다.
- 설정은 owner/public Profile의 공유 component에 동일하게 적용하고 원격·browser
  storage에는 저장하지 않는다.
- checkbox 변경 시 열려 있던 tooltip을 닫아 이전 표현이 남지 않게 한다.
- owner의 `Your Codex card`는 Home의 `MarketingCardPreview`를 직접 재사용해 동일한
  600px 최대 크기, BorderBeam, hover tilt, glare, shadow와 reduced-motion을 적용한다.
- owner card 아래에 Home과 동일한 identity/action 계층을 적용한다. private은
  `Publish card`, public은 `Share`를 표시한다.
- 중복 action을 피하기 위해 owner Profile topbar Share를 제거하고 card 아래 action을
  단일 진입점으로 사용한다.
- Share Studio에는 Home과 동일한 source element ref·snapshot rect·suspended 상태를
  전달해 card-origin 전환을 사용한다.
- 기존 visibility mutation, preview revision, Share Studio의 make-private 흐름은
  그대로 유지한다.

### 검증 시나리오

- owner/public daily, weekly, cumulative 합계와 exact token tooltip
- exact token checkbox 기본 OFF, ON/OFF tooltip 전환과 mode 변경 뒤 상태
- `en`/`ko` locale과 UTC month/year 경계
- desktop hover/leave, keyboard focus/Arrow/Escape
- touch tap/전환/outside 닫기와 emulated mouse 중복 방지
- mode 변경, logout, owner/public source 변경 뒤 stale tooltip 부재
- mobile/reduced-motion/short viewport와 chart-only horizontal scroll
- identity/stats, no-usage CTA, publish/unpublish, Share Studio와 public card 회귀
- owner card와 Home card의 component, 600px geometry, tilt/beam/glare/reduced-motion
  parity 및 card-origin Share Studio 전환
- Home/static/README card에 tooltip overlay가 없는지 확인
- API, backend, D1/R2, CLI, package, hosting manifest와 static asset 비변경 확인

### 검증

```bash
npm test
npm run test:e2e
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

추가 확인:

```bash
git diff origin/devel -- .openai/hosting.json src/profile-backend src/profile-runtime/sites packages package.json package-lock.json public/assets
git status --short
```

제한 경로 diff는 빈 출력이어야 한다. production 배포와 원격 data/environment/access
mutation은 실행하지 않는다.

### Stage 보고·커밋

- `mydocs/working/task_m100_35_stage5.md`
- 커밋: `Task #35 Stage 5: Profile heatmap 통합 QA와 회귀 보정`

## 단계 의존성과 승인

- 계획 변경 문서와 GitHub Issue 갱신 후 Stage 3 소스 구현 승인을 요청한다.
- Stage 3 보고서 승인 전 Stage 4 소스를 수정하지 않는다.
- Stage 4 보고서 승인 전 Stage 5 검증·보정을 시작하지 않는다.
- API, renderer pixel, public payload 또는 공식 문서 변경이 필요하면 해당 Stage를
  중단하고 수행계획 변경 승인을 다시 요청한다.

## 위험과 대응

- **대체 코드 누락**: 최종 diff에 card overlay/geometry가 남지 않도록 Stage 3에서
  파일 단위로 `origin/devel`과 대조한다.
- **legacy chart와 canonical usage 혼용**: UI component 입력과 pure builder를
  `dailyUsageBuckets`로 고정하고 `credits` alias를 만들지 않는다.
- **weekly/cumulative 접근성 중복**: visual week column과 semantic target 수를
  분리하고 unit/E2E에서 52개로 고정한다.
- **owner/public drift**: 동일 component와 builder를 사용하고 data source만 분리한다.
- **privacy/source leak**: public payload 밖의 owner data fallback을 금지하고 source
  변경 시 active state를 제거한다.
- **MVP 범위 확장**: Account Usage Contract에 없는 insight/plugin/skill 정보와
  profile customization은 별도 issue로 남긴다.
