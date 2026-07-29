# Task M100 #38 구현계획서

수행계획서: [`task_m100_38.md`](task_m100_38.md)
GitHub Issue: [#38](https://github.com/postmelee/codex-usage-profile/issues/38)
마일스톤: M100

## 구현 전제

- 작업지시자가 수행계획서의 참조 화면 해석과 전체 범위를 승인했다.
- 참조 화면의 Codex 설정 sidebar/window chrome는 복제하지 않는다. 현재
  Home landing을 강하게 dim·blur하고 title, card, action row와 close의
  상대 구도를 재현한다.
- X, LinkedIn, Reddit은 stable public profile URL을 브라우저 share
  composition 화면에 전달하는 일반 HTTPS link다. provider API, OAuth,
  credential, binary upload와 자동 게시를 사용하지 않는다.
- 참조 화면과 같은 네 개의 원형 primary action은 X, LinkedIn, Reddit,
  Save다. issue 수용 기준인 Image URL/README Markdown copy와 Make private는
  같은 화면의 compact secondary action으로 유지한다.
- Share Studio copy와 card locale은 `ko`/`en`을 지원한다. `ko` 제목은
  `활동 공유하기`, `en` 제목은 `Share activity`다. 별도 i18n framework는
  도입하지 않는다.
- 현재 Home의 card tilt, glare와 Border Beam은 Share Studio 밖에서
  유지한다. Studio 안의 preview는 안정적인 PNG 자체를 강조하고 tilt를
  적용하지 않는다.
- shared-card animation은 portal + FLIP 방식으로 구현한다. 새 animation
  dependency와 View Transitions API 필수 의존을 추가하지 않는다.
- `prefers-reduced-motion`에서는 source→target 위치/scale 전환과 stagger를
  제거하고 target 위치의 짧은 opacity transition만 사용한다.
- current production Sites saved version 7과 Task #45 QA baseline을
  변경하지 않는다. 이 branch에서는 원격 배포, Site version 저장과 access
  변경을 수행하지 않는다.
- 단계 변경과 보고는 `/private/tmp/codex-usage-profile-task38`,
  `local/task38`에서만 수행한다. main worktree, `local/task45`,
  `local/task43`과 사용자의 다른 변경을 수정·merge·rebase하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Share contract와 accessible Studio 골격 | `shareStudio.js`, `ShareStudio.jsx`, locale/share intent/copy/download/privacy contract | focused Node test, Share modal E2E, build |
| 2 | shared-card motion과 desktop 참조 구도 | source card ref, portal FLIP state, desktop overlay/motion CSS | 1280×900·1512×982 geometry/screenshot, Share E2E |
| 3 | responsive·reduced-motion·failure 회귀 | mobile/short layout, reduced fallback, resize/load/clipboard/provider 경계 | mobile/short/reduced E2E, keyboard/focus/download |
| 4 | 통합 시각 QA와 공식 문서 | `docs/readme-card.md`, 전체 regression과 Sites artifact evidence | full test/build/production artifact/E2E |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| Share Studio UI copy와 motion | 제품 UI source | `src/profile-ui/`, `src/profile-marketing/`, `src/styles.css` | OK | 실제 interaction과 style이 진실 원천 |
| card publish/share 사용자 흐름 | 기존 공식 `docs/` | `docs/readme-card.md` | OK | Stage 4에서 현재 UI와 달라진 부분만 최소 수정 |
| 수행·구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_38*.md` | OK | 승인된 범위와 단계 계약 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_38_stage{N}.md` | OK | 단계 source·검증과 같은 커밋에 포함 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_38_report.md` | OK | 전체 수용 기준과 잔여 위험 보존 |

별도 Share Studio 공식 문서, 디자인 사양서와 `mydocs/manual` 변경은
만들지 않는다. 공식 문서 수정이 수행계획서의 사용자 흐름 범위를 넘으면
Stage 4 전에 계획 변경 승인을 받는다.

## 공통 구현 계약

### component와 상태 경계

- 기존 `ShareDialog.jsx`는 `ShareStudio.jsx`로 교체한다.
- `HomePage`는 Studio에 다음 값만 전달한다.
  - `open`, `locale`, `previewUrl`, `publicCardUrl`
  - public owner `handle`
  - source card element/ref
  - `makingPrivate`, `onMakePrivate`, `onClose`
- raw session, token, internal owner id, usage document와 storage metadata는
  Studio props, DOM, share URL과 log에 넣지 않는다.
- Studio phase는 `closed → opening → open → closing → closed`로 고정한다.
  closing 중 재호출과 중복 close는 무시하고, source restore와 focus restore가
  한 번만 실행되게 한다.
- React portal root는 `document.body`를 사용한다. server/build 환경에서
  `document`가 없으면 open되지 않은 상태로 안전하게 렌더링한다.

### share URL과 copy 계약

- `shareStudio.js`에 다음 순수 helper를 둔다.
  - `getShareStudioCopy(locale)`
  - `buildPublicProfileShareUrl(origin, handle)`
  - `buildShareTargets({ profileUrl, locale })`
  - 필요 시 filename/title normalization
- public profile URL은 canonical Sites 계약인
  `/?profile={encodeURIComponent(handle)}`를 사용한다. private preview
  `/api/profile/card.png`는 social target에 사용하지 않는다.
- provider target은 다음 browser composition endpoint로 제한한다.
  - X: `https://x.com/intent/post`
  - LinkedIn: `https://www.linkedin.com/sharing/share-offsite/`
  - Reddit: `https://www.reddit.com/submit`
- 각 target은 `URL`/`URLSearchParams`로 구성하고 provider별 허용 query만
  넣는다.
  - X: localized short text와 public profile `url`
  - LinkedIn: public profile `url`
  - Reddit: localized title과 public profile `url`
- social anchor는 `target="_blank"`와 `rel="noopener noreferrer"`를
  사용한다. provider page가 열리지 않아도 Studio와 copy/save 기능은
  그대로 남는다.
- stable Image URL과 README Markdown은 기존 `buildLocalizedCardUrl()`과
  `buildReadmeCardSnippet()`을 재사용한다.
- clipboard 성공·실패는 focus를 이동시키지 않는 `aria-live` status로
  알린다. 실패 시 URL/Markdown text를 선택 가능한 fallback으로 남긴다.
- PNG download는 localized stable `imageUrl`과
  `download="codex-usage-profile.png"`를 유지한다.

### reference layout

- overlay는 `position: fixed; inset: 0`이고 app frame보다 높은 단일
  stacking layer다.
- desktop Studio column은 다음 순서를 사용한다.
  1. localized title
  2. 499:306 card preview
  3. X/LinkedIn/Reddit/Save 원형 action row와 label
  4. URL/README copy 및 Make private compact secondary action
  5. `aria-live` status
- close는 viewport safe-area를 반영한 우측 상단에 고정한다.
- desktop card target width는 `min(600px, calc(100vw - 48px))`를 기준으로
  하고 available height가 작으면 title/action의 최소 간격과 499:306 비율을
  유지한 채 축소한다.
- 원형 primary action의 pointer target은 최소 56px, keyboard focus ring과
  text label은 44px hit target 기준을 충족한다.
- overlay는 검은색에 가까운 background alpha와
  `backdrop-filter: blur(...)`를 함께 사용한다. blur 미지원 시에도 dim만으로
  뒤 content가 주요 초점으로 보이지 않아야 한다.
- 참조 화면의 빈 공간과 중앙축을 우선하고 secondary action은 낮은 대비와
  작은 높이로 배치해 primary action보다 시각적으로 앞서지 않게 한다.

### motion token과 FLIP

CSS token:

| token | 값 | 용도 |
|---|---|---|
| `--share-motion-quick` | `140ms` | button/focus/copy feedback |
| `--share-motion-standard` | `340ms` | title/action entrance |
| `--share-motion-slow` | `460ms` | card/background entrance |
| `--share-motion-exit` | `240ms` | Studio close |
| `--share-ease-enter` | `cubic-bezier(0.2, 0, 0, 1)` | primary entrance |
| `--share-ease-settle` | `cubic-bezier(0.4, 0, 0.2, 1)` | background/secondary |
| `--share-ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | close |

- open 직전 source card `DOMRect`를 읽고 target shell을 target 위치에
  layout한다. 최초 preview transform은 target rect 기준 source delta와
  scale로 설정한 뒤 다음 animation frame에 identity로 전환한다.
- `top/left/width/height`는 target layout을 한 번 잡는 용도로만 사용하며
  animation은 `translate3d`, `scale`, `opacity`로 수행한다.
- source card는 `data-share-source-hidden` 동안 `visibility: hidden` 또는
  동등한 layout-preserving 방식으로 숨기고 pointer hit target을 제거한다.
- source rect와 target rect의 중심 이동이 viewport 1/3을 넘으면 55%
  keyframe에서 scale/distance 속도를 나눠 장거리 단일 이동을 피한다.
- title은 card motion 시작 후 약 70ms, action row는 약 110ms 뒤에
  translateY 12~16px + opacity로 진입한다. secondary action은 action row와
  동시 또는 30ms 뒤에 나타나며 전체 stagger는 200ms 미만이다.
- backdrop opacity/blur는 card보다 먼저 시작하고 card settle보다 약간 먼저
  완료한다. continuous ambient loop는 사용하지 않는다.
- close는 title/action을 먼저 짧게 dissolve하고 card를 source rect로
  되돌린다. exit 완료 뒤 source visibility, app inert/scroll, focus 순서로
  복구한다.
- `prefers-reduced-motion: reduce`에서는 source rect를 사용하지 않고 target
  card/title/action을 120~180ms opacity로 함께 표시한다. spatial transform,
  scale, stagger와 blur animation은 제거한다.

### modal과 accessibility

- Studio root는 `role="dialog"`, `aria-modal="true"`와 localized title
  `aria-labelledby`를 가진다.
- open 당시 active element를 기록하고 close 완료 뒤 그 element가 document에
  남아 있을 때만 focus를 복원한다.
- 초기 focus는 참조 화면의 우측 상단 close button이다.
- Tab/Shift+Tab은 Studio 안의 enabled button/link만 순환한다.
- Escape, close button과 backdrop pointer down은 같은 guarded close path를
  사용한다. 내부 card/action click은 backdrop close를 발생시키지 않는다.
- app frame은 open 동안 기존 `inert`/`aria-hidden` 값을 보존한 채 modal
  뒤 탐색 대상에서 제외하고 close 시 정확히 원복한다.
- `document.body`와 app 내부 scroll container의 기존 overflow/scroll
  position을 저장하고 close 시 복구한다.
- CSS animation이 끝나지 않거나 event가 누락되어도 duration 기반 fallback
  timer가 closing phase를 완료한다.

### 검증과 시각 기준

- Playwright selector는 visible copy만 의존하지 않고 role/name과 stable
  `data-testid`를 필요한 최소 범위에서 사용한다.
- desktop 기준:
  - 1280×900: 기존 E2E 회귀 기준
  - 1512×982: 참조 화면에 가까운 wide viewport
- responsive 기준:
  - 390×844 mobile
  - 1280×620 short desktop
- screenshot은 `share-studio-desktop`, `share-studio-wide`,
  `share-studio-mobile`, `share-studio-short`,
  `share-studio-reduced-motion`으로 구분한다.
- geometry assertion:
  - card aspect ratio `499 / 306`
  - title/card/action center 축 차이 허용 범위
  - close safe-area와 viewport 경계
  - source/target layout shift 부재
  - body/document horizontal overflow 부재
- 외부 provider는 E2E에서 실제 게시하지 않는다. href의 origin, pathname,
  allowlisted query, `target`과 `rel`만 검증한다.

## Stage 1 — Share contract와 accessible Studio 골격

### 산출물

신규:

- `src/profile-ui/shareStudio.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `mydocs/working/task_m100_38_stage1.md`

수정:

- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/ShareDialog.jsx` — 교체 후 제거
- `src/profile-ui/cardShare.js`
- `src/profile-ui/Icons.jsx`
- `src/profile-ui/__tests__/cardShare.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260729.md`

### 변경 내용

1. `shareStudio.js`에 locale copy와 public profile/provider target builder를
   구현한다.
   - input empty/invalid handle과 URL은 `null` 또는 empty target으로
     fail closed한다.
   - `ko-KR`, `en-US`, unsupported locale fallback을 검증한다.
   - provider query에 private preview URL, credential-like text와 unknown
     field가 들어갈 경로를 만들지 않는다.
2. X, LinkedIn, Reddit과 필요한 원형 action icon을 local inline SVG path로
   추가한다.
   - 외부 icon font/script/image를 로드하지 않는다.
   - icon은 decorative `aria-hidden`, accessible name은 anchor/button이
     소유한다.
3. `ShareStudio.jsx`에 portal, localized title, preview, primary/secondary
   action과 guarded modal lifecycle을 구현한다.
   - Stage 1은 target 위치 fade와 현재 dialog 수준의 안정된 layout을
     사용한다.
   - focus trap/restore, Escape, backdrop, app inert와 scroll lock을 먼저
     완성한다.
4. Home의 기존 `ShareDialog` 호출을 `ShareStudio`로 바꾸고 public owner
   handle과 current card source 연결점만 준비한다.
5. existing Image URL/README clipboard, Save PNG와 Make private 시나리오를
   새 accessible name과 structure에 맞게 갱신한다.
6. unit test와 focused E2E로 provider href, copy/download, modal/focus,
   privacy mutation을 고정한다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/cardShare.test.js \
  src/profile-ui/__tests__/shareStudio.test.js
npm run build
npm run test:e2e -- --grep "Share"
git diff --check
```

검증 관점:

- `ko`/`en` copy와 unsupported fallback이 안정적이다.
- provider link는 public profile URL과 allowlisted query만 포함한다.
- Studio는 keyboard focus를 가두고 Escape/backdrop/close에서 같은 방식으로
  닫힌다.
- close 뒤 Share trigger focus와 기존 scroll position이 복구된다.
- copy/download/Make private 기능이 기존보다 줄지 않는다.
- Stage 1은 source card geometry animation을 시작하지 않는다.

### 커밋

```text
Task #38 Stage 1: Share contract와 accessible Studio 골격
```

## Stage 2 — shared-card motion과 desktop 참조 구도

### 산출물

신규:

- 없음
- `mydocs/working/task_m100_38_stage2.md`

수정:

- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/ShareStudio.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260729.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. `MarketingCardPreview`/`MarketingCardTilt`에 source card ref와
   Studio transition suspension 경계를 추가한다.
   - 기본 `MarketingLanding` caller와 Sites marketing build는 새 prop 없이
     기존과 동일하게 동작한다.
   - Home만 source card ref와 `shareOpen` 상태를 전달한다.
2. Studio preview shell에 source/target rect 측정과 phase state를 연결한다.
   - rect가 valid하고 motion 허용 시 FLIP path를 사용한다.
   - zero-size, detached source, image not loaded와 resize race는 target fade로
     fallback한다.
3. open transition에서 source card 장식과 preview PNG를 120ms 안에
   crossfade해 다른 카드로 바뀐 것처럼 보이지 않게 한다.
4. close transition에서 target card를 source rect로 되돌리고, transition
   completion/fallback timer 뒤에 source visibility와 focus를 복구한다.
5. desktop reference layout을 구현한다.
   - strong dim과 backdrop blur
   - title/card/action의 중앙 column
   - 우측 상단 close
   - 네 개 원형 primary action
   - 낮은 대비 compact secondary action
6. 1280×900과 1512×982 E2E에서 geometry와 screenshot을 기록하고
   reference image와 직접 비교한다.

### 검증

```bash
npm run build
npm run test:e2e -- --grep "Share"
git diff --check
```

검증 관점:

- open 직전과 animation 첫 frame의 source card rect가 시각적으로 이어진다.
- source layout 자리는 유지되고 Home content가 jump하지 않는다.
- card/title/action의 중심축과 spacing이 reference composition에 맞는다.
- transition은 transform/opacity만 animation하며 layout-triggering property
  animation이 없다.
- close 중 중복 click/Escape가 source/focus를 두 번 복구하지 않는다.
- Home tilt/glare/Border Beam은 Studio close 뒤 다시 동작한다.

### 커밋

```text
Task #38 Stage 2: shared-card motion과 desktop 참조 구도
```

## Stage 3 — responsive·reduced-motion·failure 회귀

### 산출물

신규:

- 없음
- `mydocs/working/task_m100_38_stage3.md`

수정:

- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/shareStudio.js`, failure/geometry helper 보강이 필요한 경우
- `src/profile-ui/__tests__/shareStudio.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260729.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. mobile 390×844에서 card, action과 secondary action을 viewport 안에
   배치한다.
   - primary action은 2×2 또는 모든 label이 보이는 compact grid다.
   - 44px 미만 hit target, 가로 scroll과 card/action overlap을 허용하지
     않는다.
2. 1280×620 short viewport에서 title/card/action이 세로로 잘리지 않도록
   card width와 vertical gap을 available height 기반으로 줄인다.
   - Studio 자체의 제한된 vertical scroll은 최후 fallback으로만 사용한다.
   - close button은 항상 viewport 안에 남는다.
3. `prefers-reduced-motion`에서 rect/FLIP/stagger/blur animation을 제거한다.
   - target layout, 기능, focus와 aria-live는 동일하다.
4. viewport resize/orientation, source detach와 preview load failure를
   bounded fallback으로 처리한다.
   - open 동안 resize 시 card가 offscreen이면 target rect를 다시 계산하고
     spatial animation 없이 settle한다.
   - preview image failure는 safe message와 stable URL/download/copy action을
     남기고 blank dialog가 되지 않게 한다.
5. clipboard unavailable/rejected, popup/link navigation, download와
   `makingPrivate` 상태를 검증한다.
6. keyboard tab/shift-tab, repeated Escape/backdrop, focus restore와 inert
   원복을 mobile/reduced 환경까지 확장한다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/cardShare.test.js \
  src/profile-ui/__tests__/shareStudio.test.js
npm run build
npm run test:e2e -- --grep "Share"
git diff --check
```

검증 관점:

- 390×844, 1280×620에서 horizontal overflow와 clipped primary action이 없다.
- reduced-motion computed style에 spatial keyframe/transition이 남지 않는다.
- touch와 keyboard로 모든 action을 실행하고 Studio를 닫을 수 있다.
- clipboard/provider/image failure가 다른 share action과 close를 막지 않는다.
- resize와 close 경쟁 뒤 source visibility, inert, overflow와 focus가
  원래 값으로 정확히 복구된다.

### 커밋

```text
Task #38 Stage 3: responsive와 reduced-motion 회귀
```

## Stage 4 — 통합 시각 QA와 공식 문서

### 산출물

신규:

- 없음
- `mydocs/working/task_m100_38_stage4.md`

수정:

- `docs/readme-card.md`
- `src/profile-ui/ShareStudio.jsx`, 최종 QA 보정이 필요한 경우
- `src/styles.css`, 최종 QA 보정이 필요한 경우
- `tests/profile-ui.spec.js`, 최종 회귀 보강이 필요한 경우
- `mydocs/orders/20260729.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. `docs/readme-card.md` 사용자 흐름을 실제 Share Studio와 일치시킨다.
   - Publish 뒤 Share Studio에서 stable Image URL, README Markdown과 PNG
     저장을 사용한다는 최소 설명
   - X/LinkedIn/Reddit은 URL-only browser share이고 이미지 자동 업로드나
     게시를 보장하지 않는다는 경계
   - private 전환과 stable public endpoint `404` 계약 유지
2. desktop/wide/mobile/short/reduced screenshot을 reference composition과
   직접 비교한다.
   - title/card/action/close 상대 위치
   - dim/blur와 text/action contrast
   - card 비율과 크기
   - primary/secondary action hierarchy
3. existing Home, public profile, owner profile, Settings와 device E2E를
   함께 실행해 app shell/route/focus 회귀를 확인한다.
4. source와 production artifact에서 external provider script, credential,
   private preview URL과 unknown query가 없는지 검사한다.
5. 전체 Node, Vite, Sites full-stack/production artifact와 Playwright를
   실행하고 잔여 위험을 Stage 보고서에 기록한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run test:e2e
git diff --check
```

추가 수동 검증:

- 1280×900, 1512×982, 390×844, 1280×620 screenshot 비교
- normal/reduced-motion open·close와 focus restore
- X/LinkedIn/Reddit href allowlist, PNG download, URL/README copy
- Home tilt/glare/Border Beam 복구와 document/app scroll position
- public stable URL과 private/unpublished 404 계약 무변경

### 커밋

```text
Task #38 Stage 4: 통합 시각 QA와 Share 문서
```

## 검증

- 각 Stage 검증 명령은 해당 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하거나 커밋하지 않는다.
- screenshot은 자동 통과만으로 승인하지 않고 reference image와 직접
  비교한 결과를 Stage 보고서에 기록한다.
- external provider page에 실제 게시하지 않는다. href와 browser composition
  진입까지만 bounded manual smoke를 허용한다.
- Stage 4 full regression은 source branch에서만 수행하고 production Site를
  배포하거나 변경하지 않는다.
- 구현 중 새로운 dependency, product document와 provider API/OAuth가
  필요해지면 즉시 멈추고 수행·구현계획 변경 승인을 받는다.
- `git diff --check`와 Stage별 focused test가 모두 통과해야 단계 보고서를
  작성한다.
- PR 준비 전 `git status --short`가 빈 출력인지 확인한다.

## 커밋

- 단계 source와 `mydocs/working/task_m100_38_stage{N}.md`, 해당 날짜
  `mydocs/orders/{yyyymmdd}.md` 갱신을 하나의 Stage 커밋으로 묶는다.
- 커밋 메시지는 다음 형식을 사용한다.
  - `Task #38 Stage 1: Share contract와 accessible Studio 골격`
  - `Task #38 Stage 2: shared-card motion과 desktop 참조 구도`
  - `Task #38 Stage 3: responsive와 reduced-motion 회귀`
  - `Task #38 Stage 4: 통합 시각 QA와 Share 문서`
- 수행계획서나 구현계획서의 factual correction이 필요하면 변경 사유를
  Stage 보고서에 명시하고 같은 Stage 커밋에 포함한다.

## 단계 의존성

- Stage 1 승인 전 Stage 2 source를 수정하지 않는다.
- Stage 2는 accessible Studio contract와 desktop source/target element
  구조를 전제로 한다.
- Stage 3은 Stage 2 motion phase와 desktop geometry가 승인된 뒤
  responsive/reduced fallback을 확장한다.
- Stage 4는 Stage 1~3의 기능·시각 승인 뒤 공식 문서와 전체 회귀를
  완료한다.
- #45가 먼저 완료되지 않아도 local implementation과 test는 진행할 수
  있지만 production 배포와 #45 baseline 변경은 별도 승인 없이는 하지
  않는다.

## 위험과 대응

- **source ref가 custom element에 연결되지 않음**:
  `hover-tilt`/fallback wrapper 양쪽에서 실제 bounding box를 제공하는
  공통 wrapper ref를 사용하고 tilt web component load 전후를 E2E로
  검증한다.
- **portal과 app inert 충돌**: Studio를 app frame 밖 `body`에 portal한 뒤
  app frame만 inert 처리한다. 기존 inert/aria-hidden 값을 저장해 exact
  restore한다.
- **닫기 animation과 React unmount 경쟁**: `closing` phase와 fallback
  timer를 분리하고 Home은 `onExited` 이후에만 final closed state로 전환한다.
- **external provider endpoint 변화**: provider URL builder를 별도 순수
  contract로 두고 href smoke와 fallback copy를 유지한다. provider 실패는
  product blocker가 아니라 해당 external action unavailable로 격리한다.
- **social share가 이미지 업로드로 오인됨**: UI label과 공식 문서에 URL
  공유임을 명시하고 binary upload, OAuth/API code를 source에 추가하지
  않는다.
- **참조 화면보다 secondary action이 복잡함**: primary 원형 row와 충분한
  간격을 두고 secondary action을 낮은 대비의 compact 영역으로 유지한다.
  시각 계층이 깨지면 기능을 제거하지 않고 disclosure/spacing 후보를
  작업지시자에게 제시한다.
- **short/mobile overflow**: card 최대폭만 보지 않고 available height로도
  scale을 제한하고 close/action hit target을 우선한다.
- **motion sickness와 성능**: transform/opacity만 animation하고
  reduced-motion에서 spatial movement를 제거한다. blur는 overlay 한 장에만
  적용하며 animation frame 중 DOMRect를 반복 측정하지 않는다.
- **#45와 orders 충돌**: `mydocs/orders/20260729.md`의 #38/#45 두 행을
  후속 integration에서 모두 보존한다. branch rebase/merge는 별도 승인
  없이 수행하지 않는다.

## 승인 요청 사항

- 4개 Stage의 분할, Stage별 산출물·검증 명령과 커밋 메시지
- Stage 1에서 share contract와 accessible Studio를 먼저 완성하고 Stage 2에서
  shared-card motion을 별도 구현하는 순서
- public profile URL을 social share target으로 사용하고 stable image URL은
  copy/download에 사용하는 데이터 경계
- X `x.com/intent/post`, LinkedIn `linkedin.com/sharing/share-offsite`,
  Reddit `reddit.com/submit` browser composition link를 provider API 없이
  사용하는 contract
- reference layout과 motion token, portal + FLIP, reduced-motion fallback
- Stage 4에서 `docs/readme-card.md`만 최소 수정하고 production 배포는 하지
  않는 문서·운영 경계

승인되면 Stage 1의 share contract와 accessible Studio 골격 구현을 시작한다.
