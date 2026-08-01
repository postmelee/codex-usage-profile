# Task M100 #35 구현계획서

수행계획서: [`task_m100_35.md`](task_m100_35.md)
GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 공유 geometry와 tooltip data contract | `src/profile-card/geometry.js`, `src/profile-ui/cardHeatmapTooltip.js` | geometry/renderer/formatting unit test, build |
| 2 | 재사용 overlay와 Home/public profile 통합 | `src/profile-ui/CardHeatmapOverlay.jsx`, Home/public 연결, CSS | focused Playwright desktop/mobile·accessibility |
| 3 | browser 통합·Sites artifact QA | `tests/profile-ui.spec.js`, 회귀 보정 | 전체 unit/E2E/build/Sites artifact |

## 문서 위치 확인

수행계획서에서 공식 제품 문서는 변경하지 않고 이슈별 설계·승인·검증 기록만
표준 task 산출물에 남기기로 승인받았다. 실제 Stage 문서도 같은 위치를 사용한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_35*.md` | OK | 범위와 단계 승인 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_35_stage{N}.md` | OK | 각 Stage 소스와 함께 커밋 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_35_report.md` | OK | 모든 Stage 완료 후 작성 |
| 공식 제품 문서 | 변경하지 않음 | 해당 없음 | OK | route, API, CLI와 배포 절차 비변경 |

## Stage 1 — 공유 geometry와 tooltip data contract

### 산출물

신규:

- `src/profile-card/geometry.js`
- `src/profile-card/__tests__/geometry.test.js`
- `src/profile-ui/cardHeatmapTooltip.js`
- `src/profile-ui/__tests__/cardHeatmapTooltip.test.js`
- `mydocs/working/task_m100_35_stage1.md`

수정:

- `src/profile-card/heatmap.js`
- `src/profile-card/renderer.js`
- `src/profile-card/worker-renderer.js`
- `src/profile-card/index.js`
- `src/profile-card/__tests__/heatmap.test.js`
- `src/profile-card/__tests__/renderer.test.js`
- `src/profile-card/__tests__/worker-renderer.test.js`

### 변경 내용

- `geometry.js`에 다음 불변값과 pure 계산을 둔다.
  - logical card `499 × 306`
  - heatmap bounds `x=32`, `y=96`, `width=435`, `height=115`
  - cell `14 × 14`, `26 columns × 7 rows`
  - column/row step, cell rect/center와 card 대비 percentage 계산
- geometry 입력은 유한 숫자와 유효한 column/row만 허용하고 반환 객체는
  mutation되지 않도록 고정한다.
- `heatmap.js`의 count 상수는 기존 import compatibility를 유지하면서 geometry
  module의 값을 재사용한다.
- Node canvas renderer와 Sites worker SVG renderer는 같은 geometry를 import해
  기존 x/y/size/step과 pixel output을 유지한다. renderer version과 static asset은
  변경하지 않는다.
- `index.js`는 기존 export를 깨지 않고 웹 UI가 geometry helper를 사용할 수 있게
  명시적으로 re-export한다.
- `cardHeatmapTooltip.js`에 다음 pure contract를 구현한다.
  - `en`/`ko` locale 정규화와 date/token tooltip 문자열
  - active cell index에서 ArrowLeft/Right/Up/Down으로 이동하는 column-major
    roving grid 계산과 경계 clamp
  - cell/card/viewport rect를 입력받는 좌우 clamp 및 위/아래 placement 계산
  - bucket 배열이 비어 있으면 overlay를 만들지 않는 data availability 판정
- tooltip token 값은 기존 `formatCardTokenCount`를 재사용하고 date는 UTC 기준
  `Intl.DateTimeFormat`으로 포맷해 timezone에 따른 하루 이동을 방지한다.
- unit test는 첫/마지막/모서리 cell, 열·행 step, sample fixture의 날짜 매핑,
  `en`/`ko`, zero token, keyboard 경계와 placement fallback을 고정한다.
- Stage 종료 시 `task-stage-report` 절차로 Stage 1 보고서를 작성하고 소스와 함께
  커밋한다.

### 검증

```bash
node --test src/profile-card/__tests__/geometry.test.js src/profile-card/__tests__/heatmap.test.js
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-ui/__tests__/cardHeatmapTooltip.test.js
npm run build
git diff --check
```

### 커밋

```text
Task #35 Stage 1: 카드 heatmap geometry와 tooltip 계약 구현
```

## Stage 2 — 재사용 overlay와 Home/public profile 통합

### 산출물

신규:

- `src/profile-ui/CardHeatmapOverlay.jsx`
- `mydocs/working/task_m100_35_stage2.md`

수정:

- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/publicProfileRoutes.js` — usage shape guard가 필요한 경우에만 수정
- `src/profile-ui/__tests__/publicProfileRoutes.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`

### 변경 내용

- `CardHeatmapOverlay`는 완성된 `buildCardHeatmap` 결과와 locale을 props로 받고
  26 × 7 transparent grid, roving tab stop과 `role="tooltip"`을 렌더한다.
- 각 cell은 geometry helper가 만든 percentage 좌표를 CSS custom property로
  전달한다. PNG 색이나 시각 cell은 다시 그리지 않고 focus-visible 표시만 card
  디자인을 해치지 않는 최소 outline로 제공한다.
- interaction state는 다음 규칙으로 분리한다.
  - fine pointer: enter/move와 leave로 hover tooltip 표시·해제
  - keyboard: focus와 Arrow key로 활성 cell 이동, Escape로 tooltip 닫기
  - touch/coarse pointer: tap toggle, 다른 cell tap 전환, 외부 pointer로 닫기
  - unmount/source 변경/loading 전환 시 active state 즉시 초기화
- tooltip은 실제 DOM 크기를 측정한 뒤 Stage 1 placement helper 결과로 배치한다.
  `aria-label`에는 날짜와 token을 모두 포함하고 tooltip id는 현재 active cell에만
  연결한다.
- `MarketingCardPreview`는 optional heatmap overlay를 card image와 같은
  `.home-card-media` 좌표계에 합성한다. skeleton이 active하거나 Share Studio
  transition이 진행 중일 때 overlay를 inert/hidden 처리한다.
- Home의 데이터 선택을 보이는 source와 함께 계산한다.
  - owner: `profile.usage.usage.dailyUsageBuckets`
  - operator: `HOME_MARKETING_CONFIG.operatorCardHandle`의 public profile payload가
    성공하고 handle이 일치할 때만 사용
  - fallback static sample: anonymous 상태에서 sample fixture 사용
  - authenticated no-usage personalized sample: overlay 없음
- bucket 배열이 최소 한 건 있을 때만 `buildCardHeatmap`을 호출한다. 이로써
  empty bucket이 현재 날짜로 재해석되어 stable PNG와 어긋나는 경우를 막는다.
- operator profile 조회 실패는 card 표시를 실패시키지 않으며 tooltip만 fail-safe로
  비활성화한다. auth/session state나 card image transition에는 결합하지 않는다.
- public profile은 image와 overlay를 동일한 ratio wrapper로 감싸고 이미 받은
  `profile.usage.usage.dailyUsageBuckets`만 사용한다. public payload guard가 usage
  중첩 구조를 허용하는지 focused test로 고정한다.
- CSS stacking은 image < interaction targets < tooltip < glare/skeleton의 의도를
  명시하되 glare는 pointer를 가로채지 않는다. transformed tilt 안에서 overlay가
  같은 transform을 받고 document horizontal overflow를 만들지 않게 한다.
- Playwright fixture는 actual owner/public/sample/operator/no-usage payload를
  분리하고 tooltip text가 visible card source와 일치하는지 검증한다.
- Stage 종료 시 `task-stage-report` 절차로 Stage 2 보고서를 작성하고 소스와 함께
  커밋한다.

### 검증

```bash
node --test src/profile-ui/__tests__/cardHeatmapTooltip.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js
npm run test:e2e -- --grep "heatmap tooltip"
npm run build
git diff --check
```

수동/시나리오 확인:

- 1280×900 fine pointer에서 Home owner/operator/sample hover와 keyboard
- 390×844 touch viewport에서 tap toggle, 다른 cell 전환과 외부 tap 닫기
- public profile 첫/마지막 column과 상·하단 row placement
- authenticated no-usage, operator API 실패와 loading skeleton에서 overlay 부재
- tilt enabled/reduced-motion, glare, Border Beam과 share transition 회귀

### 커밋

```text
Task #35 Stage 2: 카드 heatmap overlay와 상호작용 통합
```

## Stage 3 — browser 통합·Sites artifact QA

### 산출물

신규:

- `mydocs/working/task_m100_35_stage3.md`

수정:

- `tests/profile-ui.spec.js`
- Stage 1·2 대상 파일 — 통합 검증에서 확인된 범위 내 보정만 허용

### 변경 내용

- Playwright 시나리오를 최종 수용 기준 단위로 정리한다.
  - desktop hover와 tooltip leave
  - Tab 1회 진입, Arrow key 이동, focus text와 Escape
  - mobile tap toggle, outside tap과 emulated mouse 중복 방지
  - `en`/`ko` locale date/token formatting
  - card 네 모서리에서 card/viewport clipping과 위/아래 placement
  - owner/operator/sample/public/no-usage/error/loading source matrix
  - tilt/glare/Border Beam, skeleton과 Share Studio open/close 회귀
- tooltip DOM이 source transition/unmount 뒤 남지 않고 owner data가 logout 후
  sample/operator 화면에 노출되지 않는지 확인한다.
- `prefers-reduced-motion`, desktop/mobile/short viewport와 document horizontal
  overflow를 검증한다.
- 전체 Node test와 Playwright, standard/production build, Sites full-stack와
  production artifact verifier를 실행한다.
- `.openai/hosting.json`, backend/API/D1/R2, package dependency, static sample asset과
  card endpoint output이 변경되지 않았음을 diff로 확인한다.
- visual 또는 source mismatch가 발견되면 Stage 1·2 계약 안에서만 보정한다.
  API나 renderer pixel 디자인 변경이 필요하면 중단하고 계획 변경 승인을 요청한다.
- Stage 종료 시 `task-stage-report` 절차로 Stage 3 보고서를 작성하고 소스와 함께
  커밋한다.

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

위 제한 경로 diff는 빈 출력이어야 한다. production 배포와 원격 데이터 작업은
실행하지 않는다.

### 커밋

```text
Task #35 Stage 3: heatmap tooltip 통합 QA와 회귀 보정
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않고 같은 Stage 범위에서 원인을 보정한다.
- 수동 browser 확인은 Playwright 결과와 별도로 viewport, input mode와 관찰 결과를
  단계 보고서에 기록한다.
- production Sites 검증은 local artifact까지만 수행하며 deployment/access/data
  mutation은 하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를
  갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_35_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 다음 값을 사용한다.
  - `Task #35 Stage 1: 카드 heatmap geometry와 tooltip 계약 구현`
  - `Task #35 Stage 2: 카드 heatmap overlay와 상호작용 통합`
  - `Task #35 Stage 3: heatmap tooltip 통합 QA와 회귀 보정`
- Stage 승인 전 다음 Stage 소스 변경을 시작하지 않는다.

## 단계 의존성

- Stage 1은 renderer와 overlay가 공유할 geometry와 pure interaction contract를
  먼저 확정한다.
- Stage 2는 Stage 1 보고서 승인 후 해당 contract 위에 React overlay와 source
  mapping을 구현한다.
- Stage 3은 Stage 2 보고서 승인 후 전체 browser/Sites 회귀를 검증한다.
- 각 Stage 결과가 수행계획의 source-aligned data 또는 비배포 경계를 깨면 다음
  Stage로 진행하지 않는다.

## 위험과 대응

- **geometry export compatibility**: 기존 `heatmap.js`, `renderer.js`, `index.js`
  import를 유지하거나 re-export test로 보호해 downstream break를 막는다.
- **stable card 기준일 drift**: daily bucket이 비어 있으면 현재 날짜를 임의 기준으로
  만들지 않고 overlay를 비활성화한다. non-empty data는 renderer와 동일하게 최신
  bucket 날짜를 기준으로 heatmap을 만든다.
- **operator 추가 요청 비용**: anonymous operator payload는 public profile API
  한 번만 조회하고 실패를 card error로 승격하지 않는다. component lifetime과
  handle 변경에 맞춰 stale response를 무시한다.
- **접근성 과부하**: grid에는 roving tab stop 하나만 두고 cell 변경은 Arrow key로
  처리한다. screen reader label과 visual tooltip은 같은 formatter를 사용한다.
- **pointer event 충돌**: overlay event가 `hover-tilt` pointer tracking을 차단하지
  않도록 bubbling과 stacking을 검증하며, glare/skeleton pointer contract를 명시한다.
- **privacy/source leak**: logout 또는 owner 변경 시 owner heatmap과 active tooltip을
  즉시 제거하고 operator/sample payload와 섞이지 않는 E2E를 둔다.
- **범위 확장**: Share Studio export, backend/API, card pixel 디자인, deployment에서
  요구가 발생하면 해당 Stage를 중단하고 별도 승인 또는 issue로 분리한다.

## 승인 요청 사항

- Stage 1을 shared geometry·pure tooltip contract, Stage 2를 React/source 통합,
  Stage 3을 전체 browser/Sites QA로 나누는 3단계 구현 순서
- Stage별 산출물, focused test와 최종 통합 검증 명령
- 빈 bucket에는 overlay를 만들지 않고 stable card 기준일 drift를 차단하는 세부 정책
- anonymous operator public profile 조회 실패를 tooltip-only fail-safe로 처리하는 정책
- 각 Stage 소스와 `task_m100_35_stage{N}.md`를 같은 규칙의 커밋으로 묶는 방식
- production 배포와 원격 environment/access/data 작업을 실행하지 않는 경계
