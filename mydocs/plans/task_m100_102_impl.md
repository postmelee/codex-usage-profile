# Task #102 구현계획서 — 모바일 Share Studio SNS 대상 정리와 X·Threads 공유 URL 보정

수행계획서: [`task_m100_102.md`](task_m100_102.md)
GitHub Issue: [#102](https://github.com/postmelee/codex-usage-profile/issues/102)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 모바일 대상과 provider URL 순수 계약 고정 | `src/profile-ui/shareStudio.js`, helper 단위 테스트 | navigator matrix, target 목록, X path, Threads raw encoding |
| 2 | Share Studio 연결과 모바일 한 줄 layout | `ShareStudio.jsx`, `styles.css`, mobile/desktop E2E | DOM·접근성, 320/390px 한 줄, 44px hit target |
| 3 | 사용자 문서 현행화와 전체 회귀 | `docs/readme-card.md`, 전체 검증 | Node·Playwright·build, #101 handoff |

## 문서 위치 확인

수행계획서에서 승인된 기존 공식 사용자 문서와 Hyper-Waterfall 산출물 위치를 그대로
사용한다. README, 아키텍처·운영 문서와 별도 기술 조사 문서는 수정하지 않는다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 사용자 공유 문서 | `docs/` | `docs/readme-card.md` | OK | Stage 3에서 모바일·desktop 대상 차이를 설명하는 기존 절만 최소 수정한다. |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_102_stage{1..3}.md` | OK | 각 Stage 소스·검증과 같은 단계 커밋에 포함한다. |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_102_report.md` | OK | Stage 3 승인 뒤 최종 보고 절차에서 작성한다. |
| 오늘할일 | `mydocs/orders/` | `mydocs/orders/20260813.md` | OK | 승인·단계 상태만 기존 행에서 갱신한다. |
| README·아키텍처·운영 문서 | 변경 없음 | 변경 없음 | OK | #84 production 상태와 #101 revision·cache 계약을 침범하지 않는다. |

## 공통 구현 계약

- `isMobileShareEnvironment(navigatorLike)`는 DOM·I/O 없이 boolean을 반환한다.
- `navigatorLike.userAgentData.mobile`이 boolean이면 `true`와 `false` 모두 최우선
  결과로 사용한다. 해당 값이 없을 때만 legacy `userAgent`와 iPadOS fallback을 본다.
- legacy UA는 iPhone, iPod, iPad, Android만 모바일로 분류한다. Windows·macOS desktop,
  viewport 폭과 touch 지원 단독 값은 모바일 판정 근거로 사용하지 않는다.
- iPadOS desktop-class UA는 `platform === "MacIntel" && maxTouchPoints > 1`일 때만
  모바일로 분류한다. 일반 Mac은 `maxTouchPoints`가 없거나 1 이하이므로 desktop이다.
- `buildShareTargets`의 기본값은 desktop 호환이다. `mobile: true`일 때만 LinkedIn과
  Facebook을 제외하고 X, Threads, Reddit 순서를 유지한다.
- X target은 `https://x.com/intent/tweet`과 `text`, `url`만 사용한다.
- Threads target은 `https://www.threads.net/intent/post`와 `text`, `url`을 유지하되 raw
  form space `+`를 `%20`으로 바꾼다. 실제 plus는 `%2B`로 남아 decode round-trip한다.
- LinkedIn, Facebook, Reddit의 desktop origin·path·query 계약은 변경하지 않는다.
- Share Studio는 첫 render에서 모바일 판정을 동기 계산해 target 수가 뒤늦게 바뀌지
  않게 한다. 모바일에서 제외된 target은 DOM과 접근성 트리에 생성하지 않는다.
- 모바일 primary action grid는 320px 이상에서 네 열 한 줄이다. desktop UA는 같은
  viewport에서도 여섯 action을 모두 유지하며 CSS wrapping은 허용한다.

## Stage 1 — 모바일 대상과 provider URL 순수 계약 고정

### 산출물

신규:

- `mydocs/working/task_m100_102_stage1.md`

수정:

- `src/profile-ui/shareStudio.js`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- `shareStudio.js`에 navigator-like 객체를 받는 `isMobileShareEnvironment`를 export한다.
- UA-CH boolean, iPhone·iPod·iPad·Android UA, MacIntel touch iPadOS, 일반 Mac·Windows,
  null/부분 입력을 table-driven 단위 테스트로 고정한다.
- `buildShareTargets`가 `mobile` option을 받고 기본 `false`에서 기존 다섯 SNS를,
  `true`에서 X·Threads·Reddit 세 SNS만 반환하게 한다.
- X target path를 `/intent/tweet`으로 바꾸고 origin과 query allowlist를 유지한다.
- `createTarget`에 provider별 raw space serialization option을 두거나 동등한 좁은 helper를
  사용해 Threads에만 `%20`을 적용한다. 전역 `encodeURIComponent` 재적용은 하지 않는다.
- 영어와 한국어 Threads `href`의 raw `text` 구간에 `+`가 없고 `%20`이 있는지 단언한다.
  profile URL path에 실제 `+`가 있는 fixture로 `%2B` round-trip도 확인한다.
- 기존 단위 테스트가 `new URL().searchParams.get()`만 확인해 raw bug를 가리던 공백을
  raw href assertion으로 보완한다.

### 검증

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js
git diff --check
```

### 완료 조건

- navigator matrix가 공통 구현 계약과 일치한다.
- desktop 기본 target은 5개, mobile target은 X·Threads·Reddit 3개다.
- X는 `/intent/tweet`, Threads 영어·한국어 space는 `%20`, 실제 plus는 `%2B`다.
- LinkedIn·Facebook·Reddit desktop query와 invalid profile URL 거부가 유지된다.

### 커밋

```text
Task #102 Stage 1: 모바일 공유 대상과 provider URL 계약 고정
```

## Stage 2 — Share Studio 연결과 모바일 한 줄 layout

### 산출물

신규:

- `mydocs/working/task_m100_102_stage2.md`

수정:

- `src/profile-ui/ShareStudio.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- `ShareStudio`가 `globalThis.navigator`를 최초 render에서 동기 판별하고 `mobile` 값을
  `buildShareTargets`에 전달한다. state/effect 기반 후처리는 추가하지 않는다.
- mobile target animation index와 Save index가 연속하도록 기존 `map`과
  `shareTargets.length` 계산을 그대로 활용한다.
- `max-width: 360px`에서 primary action을 두 열로 만드는 override를 제거하거나 네 열로
  한정한다. 다른 mobile layout 규칙은 변경하지 않는다.
- 기존 viewport-only 테스트를 `narrow desktop` 계약으로 명확히 하고 390px desktop에서
  여섯 action과 LinkedIn·Facebook 존재를 단언한다.
- iPhone 13 context와 Pixel 5 context에서 X·Threads·Reddit·Save 네 action만 존재하고
  LinkedIn·Facebook role/link가 없음을 검증한다.
- 모바일 context를 320px와 390px로 측정해 네 action의 `top`이 한 행 허용 오차 안에서
  같고, height가 44px 이상이며 body horizontal overflow가 없는지 확인한다.
- 모바일 dialog를 처음 연 직후 target 수가 4이고 animation 이후에도 바뀌지 않는지
  확인해 render flicker 회귀를 막는다.

### 검증

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|Share card dialog"
git diff --check
```

### 완료 조건

- iOS·Android DOM/접근성 트리에는 Facebook·LinkedIn이 없고 primary action은 4개다.
- 320px·390px mobile에서 네 action이 한 줄이고 hit target·overflow 기준을 지킨다.
- 390px desktop UA에는 여섯 action이 모두 남는다.
- Share Studio open/close, focus trap, card handoff와 Save·보조 action에 회귀가 없다.

### 커밋

```text
Task #102 Stage 2: 모바일 Share Studio 대상과 한 줄 layout 연결
```

## Stage 3 — 사용자 문서 현행화와 전체 회귀

### 산출물

신규:

- `mydocs/working/task_m100_102_stage3.md`

수정:

- `docs/readme-card.md`
- `mydocs/orders/20260813.md`

### 변경 내용

- `docs/readme-card.md`의 검증된 공유 흐름에서 desktop은 다섯 SNS target을 제공하고,
  모바일은 X·Threads·Reddit과 Save를 primary action으로 제공한다는 차이를 기록한다.
- Facebook·LinkedIn 모바일 앱 작성창과 본문 자동 입력을 보장하지 않아 모바일 primary
  action에서 제외하며 공유 링크 복사 fallback은 유지한다고 설명한다.
- X와 Threads의 사용자-facing 동작만 설명하고 내부 UA regex나 encoding 구현 세부는
  공식 사용자 문서에 넣지 않는다.
- full Node, Playwright와 build를 실행하고 기존 profile·public profile·Share Studio
  motion·copy/download·privacy 회귀를 확인한다.
- Stage 보고서에 #101 Stage 4가 최신 `devel`을 반영한 뒤 mobile target filter를 보존해야
  한다는 handoff를 남긴다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build
git diff --check
```

### 완료 조건

- 공식 사용자 문서와 실제 desktop/mobile action이 일치한다.
- 전체 Node·Playwright·build가 통과한다.
- README, 아키텍처·운영 문서, production 상태와 #101 revision 계약을 수정하지 않았다.
- 사용자가 실제 모바일에서 검증할 build/source 상태와 실행 절차가 준비됐다.

### 커밋

```text
Task #102 Stage 3: 모바일 공유 문서와 전체 회귀 검증
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- unit test는 decoded query뿐 아니라 raw provider href를 검증한다.
- mobile E2E는 viewport 변경만 사용하지 않고 실제 device context UA를 사용한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 계획 변경 승인을 받는다.
- Stage 3 뒤 실제 실기기 검증용 서버·validation target은 credential, 외부 배포와
  production mutation 여부를 확인한 뒤 승인된 안전한 경로만 사용한다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_102_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 위 Stage별 메시지를 정확히 사용한다.
- 구현계획서는 별도 `Task #102: 구현 계획서 작성` 커밋으로 먼저 고정한다.

## 단계 의존성

- Stage 2는 Stage 1의 helper·target·raw URL 계약과 단계 보고 승인 후 진행한다.
- Stage 3은 Stage 2의 실제 device context E2E와 단계 보고 승인 후 진행한다.
- #101 Stage 4는 #102 병합 뒤 최신 `devel`을 반영하고 mobile filter 회귀를 검증해야 한다.

## 위험과 대응

- **UA false positive/negative**: UA-CH boolean을 최우선으로 하고 Safari/iPadOS 최소 fallback만
  둔다. width·touch 단독 판정은 금지하고 table-driven fixture로 경계를 고정한다.
- **Threads 이중 인코딩**: URL 전체를 다시 인코딩하지 않고 raw form space marker만
  Threads provider에 한정해 바꾼다. decoded 값, raw space와 literal plus를 함께 테스트한다.
- **작은 화면 overflow**: 320px에서 실제 action bounds, 행 top과 body scrollWidth를 측정한다.
- **desktop 기능 손실**: narrow desktop device context를 별도 유지해 viewport와 환경 판정을
  분리한다.
- **실기기 테스트 접근성**: local frontend만으로 인증 owner profile을 재현할 수 없으면 임의
  production 배포를 하지 않는다. 승인된 validation site 또는 credential을 노출하지 않는
  local runtime 경로를 선택하고 필요 시 배포 직전 target·rollback 승인을 요청한다.
- **#101 충돌**: #102를 먼저 병합하고 #101 Stage 4에서 최신 target builder를 보존하도록
  계획·단계 보고서에 명시한다.

## 승인 요청 사항

- 위 3개 Stage 분할, 산출물, 완료 조건과 커밋 메시지
- Stage 1의 navigator matrix·mobile option·provider별 raw encoding 계약
- Stage 2의 synchronous first-render 판정과 320/390px 실제 device context 검증
- Stage 3의 `docs/readme-card.md` 최소 수정 및 전체 회귀 명령
- 실기기 테스트 환경은 production을 임의 변경하지 않고 local runtime 또는 별도 승인된
  validation target으로 준비하는 경계

승인되면 Stage 1의 순수 helper·target URL 계약부터 구현한다.
