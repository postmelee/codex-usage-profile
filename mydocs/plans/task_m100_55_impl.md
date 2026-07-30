# 구현계획서 — Task #55: 운영자 랜딩 카드와 세션 로딩 전환 개선

수행계획서: [`task_m100_55.md`](task_m100_55.md)
GitHub Issue: [#55](https://github.com/postmelee/codex-usage-profile/issues/55)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 운영자 카드 config와 전환 상태 계약 | `marketing-config.js`, `homeCardTransition.js` | config/state unit test |
| 2 | preload/decode와 identity-safe 전환 | `HomePage.jsx`, `MarketingLanding.jsx` | slow session/image/logout E2E |
| 3 | skeleton motion과 접근성 | `styles.css`, visual E2E | desktop/mobile/reduced-motion screenshot |
| 4 | Sites artifact와 통합 시각 QA | 전체 회귀와 Stage 4 보고서 | test/build/e2e/artifact/scanner |

## 승인된 수행계획 반영

- 작업지시자가 수행계획서와 권고안 A를 승인했다.
- 운영자 example은 same-origin `postmelee` stable public card로 고정하고,
  unavailable이면 기존 static sample로 대체한다.
- visible/pending image와 generation을 분리하고 preload/decode 완료 뒤에만
  새 source를 commit한다.
- loading veil은 기존 card content를 완전히 가리는 neutral skeleton으로
  구현한다.
- 기본 motion은 Corporate personality의 낮은 대비 shimmer와 약 240ms
  crossfade이며 reduced-motion에서는 모두 제거한다.
- owner identity와 preview URL은 React memory 외 browser storage에
  저장하지 않는다.
- 기존 `.openai/hosting.json`의 project `appgprj_6a62f58721788191a7cd82f37320f244`,
  D1 `DB`, R2 `PROFILE_MEDIA` linkage를 수정하지 않는다.
- production Sites deployment/access/environment 변경은 이번 task에서
  수행하지 않는다.
- 모든 Stage는 `task-stage-report` 절차로
  `mydocs/working/task_m100_55_stage{N}.md`를 작성하고, 단계 변경과 함께
  commit한 뒤 다음 Stage 승인을 받는다.

## 문서 위치 확인

수행계획서의 공식 문서 미변경 판단을 유지한다. source, test와 task
산출물만 변경하며 환경 변수를 새로 만들지 않는다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_55*.md` | OK | 이슈별 승인 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_55_stage{N}.md` | OK | 단계별 검증 증적 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_55_report.md` | OK | PR 전 최종 결과 |
| 공식 제품·운영 문서 | 변경 없음 | 해당 없음 | OK | API/환경/운영 계약 불변 |

## 공통 실행 규칙

- 작업 경로는 `/private/tmp/codex-usage-profile-task55`, branch는
  `local/task55`로 고정한다.
- main worktree, `local/task43`과 사용자 소유 변경을 수정·삭제·merge·rebase
  하지 않는다.
- operator handle은 public marketing config의 `postmelee` 한 값으로
  고정한다. owner id, session id, credential 또는 API response를 config에
  복사하지 않는다.
- public card와 owner preview는 same-origin 상대 URL만 사용한다. external
  image origin이나 credential-bearing URL은 허용하지 않는다.
- image loader는 `load`만으로 ready를 판단하지 않고 가능한 경우
  `decode()`까지 완료해야 한다. decode API가 없는 test/browser는
  `complete && naturalWidth > 0` 경계를 사용한다.
- generation이 current target과 일치할 때만 state를 commit한다. cleanup된
  effect, logout 이전 request와 stale locale/revision 응답은 무시한다.
- skeleton이 active인 동안 owner identity overlay를 render하지 않고
  Share/Publish action을 ready gate에 맞춰 disabled한다.
- `localStorage`, `sessionStorage`, IndexedDB, URL query와 service worker
  cache에 owner identity 또는 preview URL을 새로 기록하지 않는다.
- E2E fixture는 synthetic owner/card만 사용하며 production account,
  session, D1/R2 또는 공개 card를 변경하지 않는다.
- screenshot은 Playwright test output으로만 생성하고 repository에 binary
  artifact를 추가하지 않는다.
- implementation 완료 후 existing Sites capability build를 검증하되
  production deploy/save/access 변경은 하지 않는다.

## Stage 1 — 운영자 카드 config와 전환 상태 계약

### 실행 전 조건

- 수행계획서와 본 구현계획서 승인
- `local/task55`가 최신 `origin/devel` 기준이고 clean 상태

### 산출물

신규:

- `src/profile-ui/homeCardTransition.js`
- `src/profile-ui/__tests__/homeCardTransition.test.js`
- `mydocs/working/task_m100_55_stage1.md`

수정:

- `src/profile-marketing/marketing-config.js`
- `src/profile-marketing/__tests__/marketing-config.test.js`
- `mydocs/orders/20260730.md`

### 변경 내용

1. `MARKETING_OPERATOR_CARD_HANDLE`을 `postmelee`로 정의한다.
2. operator handle을 public handle 문법으로 검증하고 locale `en`/`ko`만
   `/u/{handle}/card.png?locale={locale}`로 만드는 helper를 추가한다.
3. config는 operator stable path와 static sample fallback을 함께
   반환한다. absolute/external URL, path traversal, query가 섞인 handle은
   거부한다.
4. home card state를 최소한 다음 값으로 모델링한다.
   - visible kind/source
   - pending kind/source
   - generation
   - `loading`, `ready`, `fallback`
5. begin/ready/failure/reset transition을 pure function으로 고정한다.
   generation이 다르면 ready/failure가 visible state를 변경하지 않는다.
6. operator failure는 sample target으로 한 번 전환하고 sample failure는
   neutral unavailable 상태로 끝내 무한 retry를 막는다.
7. anonymous/logout reset은 owner kind/source/overlay를 즉시 제거하고 새
   operator generation을 시작한다.

### 검증

```bash
node --test \
  src/profile-marketing/__tests__/marketing-config.test.js \
  src/profile-ui/__tests__/homeCardTransition.test.js
git diff --check
```

검증 항목:

- default `postmelee`, locale-aware stable URL과 static fallback
- invalid handle/external URL/traversal fail-close
- begin → ready 단일 commit
- stale ready/failure 무시
- operator → sample fallback 한 번
- logout/reset 뒤 owner 정보 부재
- input mutation과 browser storage 접근 부재

### 중단 조건

- operator config가 production environment/secret 또는 backend 조회를
  요구한다.
- transition state가 owner identity나 preview URL을 browser storage에
  기록한다.
- stale generation이 current visible source를 변경할 수 있다.

### 커밋

```text
Task #55 Stage 1: 운영자 카드 config와 전환 상태 계약
```

## Stage 2 — preload/decode와 identity-safe 전환

### 실행 전 조건

- Stage 1 보고서 승인
- config/state transition 계약 확정

### 산출물

수정:

- `src/profile-ui/homeCardTransition.js`
- `src/profile-ui/__tests__/homeCardTransition.test.js`
- `src/profile-ui/HomePage.jsx`
- `src/profile-marketing/MarketingLanding.jsx`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260730.md`

신규:

- `mydocs/working/task_m100_55_stage2.md`

### 변경 내용

1. browser image를 생성해 load와 `decode()`를 기다리는 abort-safe loader를
   dependency-injectable helper로 추가한다.
2. Home은 auth status, owner profile, locale와 preview revision에서 target
   kind/source를 계산하되 visible source를 즉시 덮어쓰지 않는다.
3. 초기/anonymous target은 operator stable card, authenticated profile이
   ready이고 usage가 있으면 owner preview, usage가 없으면 static sample과
   current owner overlay다.
4. pending image가 decode된 뒤 current generation일 때만 visible source와
   alt/overlay를 한 번 교체한다.
5. operator `404`/`503`/network/decode failure는 static sample로
   대체한다. owner preview failure도 static sample로 대체하되 owner
   overlay는 authenticated ready 상태에서만 표시한다.
6. auth/profile/image loading 중 `HomeCardAction`을 disabled loading으로
   유지한다. Share는 decoded owner source가 ready일 때만 연다.
7. logout/anonymous 전환은 pending owner load를 무효화하고 owner
   alt/overlay/source를 render tree에서 즉시 제거한다.
8. `MarketingCardPreview`에 state/data/ARIA 연결점을 추가하되 Stage 3 전에는
   기존 layout과 Share source ref를 유지한다.

### 검증

```bash
node --test \
  src/profile-marketing/__tests__/marketing-config.test.js \
  src/profile-ui/__tests__/homeCardTransition.test.js
npm run test:e2e -- --grep "Home card transition"
npm test
git diff --check
```

E2E 시나리오:

- anonymous operator success와 static fallback
- slow session 동안 owner source/identity 부재
- authenticated slow owner image와 decode 뒤 단일 source commit
- stale owner response 뒤 logout
- owner image `404`/`503`/decode failure
- profile action loading/disabled와 ready 전환
- local/session storage에 owner/preview 값 부재

### 중단 조건

- image ready 전에 owner preview/overlay가 visible 또는 accessible tree에
  노출된다.
- logout 뒤 stale request가 owner source를 복원한다.
- existing Share Studio source ref나 public profile route를 변경해야 한다.

### 커밋

```text
Task #55 Stage 2: preload decode와 identity-safe 전환
```

## Stage 3 — skeleton motion과 접근성

### 실행 전 조건

- Stage 2 보고서 승인
- functional transition과 failure/logout 시나리오 통과

### 산출물

수정:

- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260730.md`

신규:

- `mydocs/working/task_m100_55_stage3.md`

### 변경 내용

1. 기존 499:306 card box 안에 absolute neutral skeleton veil을 추가한다.
   veil은 card content를 완전히 가리고 border radius를 그대로 상속한다.
2. skeleton 내부 shape는 실제 card의 header/stat/heatmap 밀도만 암시하되
   text나 identity 모사 요소는 넣지 않는다.
3. active loading은 `aria-busy="true"`와 polite status
   `Loading card preview`를 제공하고 ready/fallback에서 해제한다.
4. shimmer는 낮은 대비의 horizontal progress layer 하나만 사용한다.
   중요한 spatial movement, scale, bounce 또는 stagger는 추가하지 않는다.
5. ready 전환은 skeleton opacity를 약 240ms
   `cubic-bezier(0.2, 0, 0, 1)`로 제거한다. card box position/size는
   변경하지 않는다.
6. loading 동안 tilt, beam/glare와 Share handoff animation을 정지한다.
7. `prefers-reduced-motion: reduce`에서는 shimmer, crossfade와 loading
   관련 tilt/beam motion을 모두 제거하고 static skeleton을 즉시
   ready state로 교체한다.
8. desktop/mobile/reduced-motion에서 card bounding box와 quickstart
   위치가 loading 전후 동일한지 측정한다.

### 검증

```bash
npm run test:e2e -- --grep "Home card transition"
npm run test:e2e -- --grep "Home"
git diff --check
```

시각 검증:

- desktop 1280×900: loading, ready, failure
- mobile 390×844: overflow와 card ratio
- reduced-motion: `animation-name: none`, transition duration 0
- loading/ready bounding box 오차 1px 이하
- skeleton opacity와 owner identity 비노출
- screenshot output의 loading/ready/fallback 비교

### 중단 조건

- skeleton이 반투명해 이전 card text/avatar를 식별할 수 있다.
- reduced-motion에서 shimmer/crossfade/tilt가 남는다.
- layout shift, horizontal overflow 또는 Share Studio visual regression이
  발생한다.

### 커밋

```text
Task #55 Stage 3: skeleton motion과 접근성
```

## Stage 3.1 — card-accurate skeleton 구조 보완

### 실행 전 조건

- Stage 3 시각 확인 뒤 작업지시자가 card-accurate skeleton 보완안 승인
- 기존 opacity, identity veil, reduced-motion과 layout 불변 계약 통과

### 산출물

수정:

- `mydocs/plans/task_m100_55.md`
- `mydocs/plans/task_m100_55_impl.md`
- `src/profile-marketing/MarketingLanding.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260731.md`

신규:

- `mydocs/working/task_m100_55_stage3_1.md`

### 변경 내용

1. skeleton hierarchy를 실제 share card와 같은
   `neutral header → heatmap → stats` 순서로 정렬한다.
2. heatmap은 renderer 계약과 같은 26열×7행, 총 182개 cell을 사용한다.
   모든 cell은 level 0의 동일한 neutral 색으로 표시하고 usage intensity,
   날짜, tooltip 또는 identity data를 넣지 않는다.
3. heatmap 아래에 4개 stat column을 배치하고 각 column에 text 없는
   value placeholder와 label placeholder를 한 줄씩 둔다.
4. stat column 사이에 실제 card와 같은 3개의 세로 divider를 둔다.
5. 182개 cell과 stat placeholder에는 개별 animation이나 stagger를
   적용하지 않는다. 기존 card 전체의 낮은 대비 shimmer 하나와 240ms
   opacity transition만 유지한다.
6. `prefers-reduced-motion: reduce`의 static skeleton, loading 중
   tilt/beam 정지, opaque identity veil과 card/quickstart box 불변 계약을
   그대로 유지한다.
7. desktop/mobile screenshot과 DOM/computed style 검증으로 cell/stat
   개수, hierarchy, neutral color, overflow와 layout shift를 확인한다.

### 검증

```bash
npm run test:e2e -- --grep "Home card transition"
npm run test:e2e -- --grep "Home"
git diff --check
```

시각·구조 검증:

- heatmap cell 182개, `data-column-count="26"`,
  `data-row-count="7"`
- 모든 heatmap cell이 동일한 neutral level-0 color
- heatmap 아래 stat 4개와 value/label placeholder 각 4개
- header → heatmap → stats의 vertical hierarchy
- desktop 1280×900, mobile 390×844, reduced-motion screenshot
- loading/ready card와 quickstart bounding box 오차 1px 이하
- skeleton text/identity/usage payload 부재

### 중단 조건

- cell 크기·gap 또는 stat 위치가 실제 card hierarchy와 식별 가능하게
  어긋난다.
- skeleton markup에 owner identity, usage value 또는 실제 label이 들어간다.
- cell별 animation, layout shift, horizontal overflow 또는
  reduced-motion 회귀가 생긴다.

### 커밋

```text
Task #55 [Stage 3.1]: card-accurate skeleton 구조
```

## Stage 4 — Sites artifact와 통합 시각 QA

### 실행 전 조건

- Stage 3.1 보고서 승인
- desktop/mobile/reduced-motion screenshot과 접근성 경계 확정

### 산출물

수정:

- `tests/profile-ui.spec.js`의 통합 회귀가 필요한 경우에만 보완
- `mydocs/orders/20260730.md`

신규:

- `mydocs/working/task_m100_55_stage4.md`

### 변경 내용

1. anonymous/slow session/authenticated/slow image/failure/logout 시나리오를
   한 test group에서 최종 재현한다.
2. Home, public profile과 Share Studio 기존 E2E를 모두 실행한다.
3. local/session storage를 검사해 owner handle, avatar, private preview URL
   또는 API response가 기록되지 않았음을 확인한다.
4. root unit/integration test, standard Vite build와 Sites full-stack
   production build/artifact verifier를 실행한다.
5. public release scanner로 새 operator handle 외 credential/private path
   blocker가 없는지 확인한다.
6. `.openai/hosting.json`이 base commit과 byte-for-byte 동일한지 확인한다.
7. Sites production deploy/version save/access change는 실행하지 않고
   Stage 4 보고서에 명시한다.

### 검증

```bash
npm test
npm run build
npm run build:production
npm run verify:sites-production
npm run smoke:sites-production:local
npm run test:e2e
npm run scan:public-release
git diff --exit-code origin/devel -- .openai/hosting.json
git diff --check
git status --short
```

### 중단 조건

- unit/build/e2e/artifact verifier가 실패한다.
- browser storage, screenshot 또는 markup에 이전 owner identity가 남는다.
- public release scanner blocker가 1개 이상 생긴다.
- hosting manifest, production Site version/access나 D1/R2 linkage가
  변경된다.

### 커밋

```text
Task #55 Stage 4: Sites artifact와 통합 시각 QA
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- E2E screenshot은 layout, identity veil과 reduced-motion 확인용이며
  repository에 binary로 commit하지 않는다.
- production network/data를 읽거나 변경하는 smoke는 실행하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을
  받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는
  구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 commit은 단계 산출물과
  `mydocs/working/task_m100_55_stage{N}.md`를 함께 묶는다.
- commit 메시지는 `Task #55 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- source와 test를 stage별 explicit file list로 add하고 다른 task/사용자
  변경을 포함하지 않는다.

## 단계 의존성

- Stage 2는 Stage 1의 config/state contract 승인 뒤 진행한다.
- Stage 3은 Stage 2의 functional preload/logout/failure 경계 승인 뒤
  진행한다.
- Stage 4는 Stage 3의 motion/accessibility/visual 결과 승인 뒤 진행한다.
- 모든 Stage 뒤 `task-final-report`로 최종 보고서와 `publish/task55`
  PR을 준비한다.

## 위험과 대응

- **async generation drift**: generation/token과 effect cleanup을 동시에
  적용하고 stale completion을 unit/E2E 양쪽에서 검증한다.
- **decode compatibility**: `decode()` 우선, load/naturalWidth fallback을
  dependency injection으로 분리하고 실패는 sample로 수렴시킨다.
- **identity flash**: owner overlay는 decoded ready에서만 render하고
  opaque skeleton과 logout reset을 함께 사용한다.
- **duplicate animation**: card reveal, beam/tilt와 skeleton이 동시에
  실행되지 않게 loading state가 기존 motion을 suspend한다.
- **E2E flake**: 임의 timeout 대신 route gate, image request count,
  explicit ready data attribute와 bounding box poll을 사용한다.
- **deployment overreach**: build와 artifact verifier까지만 실행하고
  Sites save/deploy/access tool은 호출하지 않는다.

## 승인 요청 사항

- 4개 Stage의 파일 경계, state/preload/motion 분할과 커밋 메시지
- `postmelee` same-origin stable card, sample fallback과 generation
  fail-close의 구체 계약
- Corporate skeleton/crossfade와 reduced-motion의 exact 검증 기준
- unit/E2E/build/Sites artifact/scanner 검증 명령
- production deployment와 공식 제품 문서를 변경하지 않는 경계

승인되면 Stage 1의 operator config와 pure transition state 계약부터
구현한다.
