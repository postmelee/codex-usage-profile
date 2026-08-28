# Task #39 구현계획서 — 웹 전용 Animated GIF 생성 및 저장

수행계획서: [`task_m100_39.md`](task_m100_39.md)
GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
마일스톤: M100

## 구현 전제

- 2026-08-27 작업지시자가 `task_m100_39.md`의 browser-only 웹 GIF 생성·저장
  범위를 승인했다.
- GitHub Issue #39 제목과 본문은 같은 날 승인 범위로 정렬됐다.
- 제품 코드는 이 구현계획 승인 전까지 수정하지 않는다.
- 출력 preset은 하나만 제공한다.
  - 998×612, 20fps, 4.8초, 96 frames, 50ms delay
  - transparent background, infinite loop
  - rotate·tilt·scale·이동 glare 없음
  - Ocean Border Beam만 0°부터 356.25°까지 순환
  - global palette 최대 256색, dithering 없음
  - `image/gif`, 15,000,000 bytes 미만
- GIF는 same-origin public PNG를 source로 데스크톱 브라우저의 module Worker에서
  생성한다. 서버·Cloudflare Worker·D1·R2·외부 API에는 GIF bytes를 보내지 않는다.
- mobile은 PNG-only로 유지하고, GIF 선택 시 자동 생성·Web Share·GIF clipboard·X
  자동 첨부는 구현하지 않는다. desktop ready 상태만 GIF preview를 제공한다.
- production 배포와 원격 Site saved version 변경은 이 task 범위가 아니다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | GIF 출력 계약과 encoder 고정 | `src/profile-card/gif-*.js`, `gifenc@1.0.3` | phase·palette·binary·reference frame·build |
| 2 | browser Worker 생성 pipeline | `src/profile-ui/gifExport.js`, `gifExport.worker.js` | one-job·progress·cancel·Blob·15MB·Worker |
| 3 | Share Studio GIF 생성·저장 UX | `ShareStudio.jsx`, messages/CSS/E2E | desktop 생성·저장, mobile PNG-only, 접근성·회귀 |
| 4 | 공식 문서와 통합 시각 QA | `docs/readme-card.md` | 전체 test/e2e/build/Sites, representative GIF 수동 QA |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/readme-card.md` | 기존 공식 사용자 문서 최소 수정 | `docs/readme-card.md` | OK | 웹 생성·저장과 X·Reddit 수동 첨부 경계만 추가 |
| GIF UI copy·상태 | 제품 UI | `src/profile-ui/` | OK | 실제 capability와 상태의 진실 원천 |
| GIF 출력 preset·encoder 계약 | 제품 코드 | `src/profile-card/` | OK | 제품 고유 animation/export 계약 |
| 수행·구현계획서 | 작업 산출물 | `mydocs/plans/` | OK | 승인 범위와 단계 고정 |
| 단계·최종 보고서 | 작업 산출물 | `mydocs/working/`, `mydocs/report/` | OK | 단계별 검증과 최종 결과 보존 |

## 공통 구현 계약

### 출력 preset

- `src/profile-card/gif-animation.js`에 `GIF_EXPORT_PRESET_VERSION = 1`과
  다음 상수를 export한다.
  - logical: `499×306`
  - scale: `2`
  - output: `998×612`
  - fps: `20`
  - duration: `4_800ms`
  - frame count: `96`
  - frame delay: `50ms` 또는 GIF centisecond `5`
  - loop repeat: `0` (`forever`)
  - palette max: `256`
  - max output bytes: `15_000_000` 미만
  - source max bytes: `10_000_000`
  - job timeout: `60_000ms`
- Border Beam preset은 기존 웹 카드의 값을 공통 상수로 옮긴다.
  - `colorVariant: "ocean"`
  - `duration: 4.8`
  - `brightness: 1.05`
  - `size: "md"`
  - `strength: 0.82`
- `MarketingLanding.jsx`의 `<BorderBeam>`과 GIF frame renderer가 이 공통 상수를
  사용한다. persistent `cardStyle` schema나 publication revision에는 effect를
  추가하지 않는다.
- frame `n`의 normalized phase는 `n / 96`, degree는 `n * 3.75`다. frame 95는
  356.25°이고 360° 중복 frame은 없다.
- card radius는 PNG renderer의 logical `32`를 2배한 `64px`를 기준으로 한다.
  canvas는 998×612 자체가 card bounds이며, rounded corner 바깥 alpha는 0이다.
- beam geometry·색·falloff는 final prototype을 만든 installed Chrome에서
  `--beam-angle-id`를 0°부터 356.25°까지 3.75° 간격으로 고정해 캡처한 96개
  투명 RGBA frame을 진실 원천으로 삼는다. frame은 visible row run만 담은 versioned
  binary asset으로 gzip 압축하고 Worker에서 bounded 검증·해제한 뒤 source-over로
  합성한다. runtime random, wall-clock time과 devicePixelRatio는 사용하지 않는다.

### encoder 선택과 palette

- encoder는 `gifenc@1.0.3` exact version을 production dependency로 선택한다.
  - MIT license
  - transitive runtime dependency 없음
  - browser/Node ESM과 Web Worker에서 실행 가능
  - animation, transparency, global palette와 indexed bitmap을 직접 제어
  - 공식 문서: https://github.com/mattdesl/gifenc
- lockfile에는 registry integrity를 고정하고 `package.json`은 caret 없이
  `"gifenc": "1.0.3"`으로 기록한다.
- 첫 pass에서 static base 최빈 exact RGB 16색과 animation edge 최빈 exact RGB
  48색을 보존하고, 96 frame을 frame별 offset과 128px stride로 균등 sampling한다.
  보존색을 제외한 sample은 `rgb565`로 quantize해 나머지 palette를 채운다.
- alpha는 threshold 127의 1-bit transparency로 분리하고 index 0에 투명색을 둔다.
  최대 256색의 한 global palette만 기록하며 local palette는 쓰지 않는다.
- 두 번째 pass에서 각 frame을 같은 global palette의 결정적 nearest-color index로
  변환해 다음 options로 full-frame write한다.
  - `delay: 50`
  - `repeat: 0`
  - `transparent: true`
  - `transparentIndex`
  - `dispose: 1`
- dithering, interlacing, per-frame palette와 adaptive quality downgrade는 사용하지
  않는다. 15MB를 넘으면 자동으로 해상도·fps를 낮추지 않고 `too_large` 오류로
  저장을 차단한다.
- `gifenc`는 최근 publish가 오래된 작은 low-level dependency이므로 Stage 1에서
  설치 artifact, exported API, license, build output과 source를 직접 확인한다.
  계획과 다른 API·security·bundle 문제가 확인되면 구현을 멈추고 dependency
  변경 승인을 요청한다.

### binary 검증 계약

- `src/profile-card/gif-binary.js`는 생성 bytes를 읽는 최소 parser/inspector를
  제공한다. decoder나 playback engine을 만들지 않고 다음 invariant만 확인한다.
  - `GIF89a` signature와 trailer
  - logical screen `998×612`
  - Netscape loop extension repeat `0`
  - 96 image descriptors와 full-frame dimensions
  - 96 graphic control extensions
  - 각 delay `5` centiseconds, transparency flag/index와 disposal `1`
  - global color table 최대 256색, local color table 부재
  - byte length `> 0 && < 15_000_000`
- Worker completion과 Blob 생성 전 inspector를 통과해야 한다. parser는 malformed
  length/sub-block에 bounded cursor를 사용해 out-of-range와 무한 loop를 막는다.

### browser Worker와 message contract

- 한 generation마다 module Worker 하나만 생성한다. 여러 Worker로 frame을 병렬
  처리해 RGBA/chunk 배열을 쌓지 않고, 단일 Worker에서 96 frame을 순차 처리한다.
- main → Worker:
  - `{ type: "generate", jobId, sourceUrl, sourceKey, presetVersion }`
- Worker → main:
  - `{ type: "progress", jobId, completedFrames, totalFrames }`
  - `{ type: "complete", jobId, bytes, metadata }` — `ArrayBuffer` transfer
  - `{ type: "error", jobId, code }`
- Worker는 `sourceUrl`이 현재 origin의 HTTP(S) URL인지 다시 확인하고
  `credentials: "same-origin"`, `cache: "no-cache"`로 fetch한다. response가 2xx,
  `image/png`, non-empty, 10MB 이하일 때만 decode한다.
- PNG decode는 Worker의 `createImageBitmap` + `OffscreenCanvas` 2D context를 쓴다.
  `imageSmoothingEnabled = true`, `imageSmoothingQuality = "high"`로 998×612 base
  RGBA를 한 번 rasterize한다. 승인 Chrome beam asset은 GIF 선택 시 Worker에서
  한 번 fetch·gzip 해제·검증하고 96개 sparse frame run을 순서대로 재사용한다.
  palette sampling과 encode는 두 pass로 처리하되 frame RGBA/index buffer는 한
  장씩 덮어쓴다.
- progress는 첫 frame, 매 4 frame과 완료 시점에만 post해 main-thread event 폭주를
  막고 항상 단조 증가하게 한다.
- cancel/source change/dialog unmount/60초 timeout은 main이 Worker를 terminate한다.
  늦게 도착한 message는 `jobId`와 `sourceKey`가 현재 job과 다르면 폐기한다.
- capability는 `Worker`, module URL, `createImageBitmap`, `OffscreenCanvas`와
  transferable `ArrayBuffer`를 확인한다. 부족하면 `unsupported`로 종료하고 PNG
  기능은 유지한다. 숨은 main-thread encoder fallback은 두지 않는다.

### client controller·cache·Blob 생명주기

- `src/profile-ui/gifExport.js`는 Worker constructor와 URL API를 주입 가능한
  controller/hook으로 감싸 단위 테스트 가능하게 한다.
- 상태는 다음 finite set으로 제한한다.
  - `idle`
  - `generating` (`progress: 0..1`)
  - `ready` (`blobUrl`, `byteLength`)
  - `error` (`unsupported | source_failed | encode_failed | invalid_output |
    too_large | timed_out`)
- 한 controller에는 active job 하나만 허용한다. generating 중 반복 입력은 새
  Worker를 만들지 않는다.
- source key는 `selectedImageUrl + shareRevision + cardTheme + cardLocale +
  GIF_EXPORT_PRESET_VERSION`의 canonical string으로 만든다.
- ready result는 Share Studio가 열린 session의 현재 source key에만 재사용한다.
  source key 변경, retry replacement와 unmount에서 이전 object URL을 정확히 한 번
  revoke한다. dialog reopen은 새 session이므로 다시 생성한다.
- bytes가 binary inspector를 통과한 뒤에만 `Blob([bytes], {type:"image/gif"})`와
  object URL을 만든다. raw bytes와 source PNG는 IndexedDB, Cache Storage,
  localStorage, server에 저장하지 않는다.

### Share Studio UX·접근성

- desktop에서 card preview와 primary action row 사이에 `PNG | GIF` segmented
  control을 둔다. mobile 환경에서는 control을 렌더링하지 않고 format을 `png`로
  고정한다.
- PNG 선택 시 현재 `Save PNG` link와 모든 동작을 유지한다.
- GIF 선택 즉시 생성을 시작하고 기존 save slot 하나는 다음 상태로 바꾼다.
  - idle/generating/error: disabled `Save GIF` button
  - generating: 카드 경계와 같은 skeleton, `role="status"` progress
  - error: typed error와 별도 `Retry` button
  - ready: object URL을 가리키는 `Save GIF` download link
- GIF format으로 바꾼 직후에는 skeleton을 표시한다. 생성이 ready가 되면 상단
  `<img>`를 session GIF Blob으로 교체하고 PNG 복귀 시 static PNG로 되돌린다.
  `prefers-reduced-motion`에서는 생성·저장은 유지하되 ready 뒤에도 static PNG다.
- format selector와 generation status를 tab order에 포함하고 visible focus,
  `aria-pressed`/radio semantics, live status와 ko/en copy를 제공한다.
- close·Escape·source 변경 시 generation을 cancel하되 기존 Share Studio close
  handoff와 focus restore를 기다리게 하지 않는다.
- `Save GIF` filename은 `codex-usage-profile.gif`다. 완료 문구는 저장 후 X 또는
  Reddit에 사용자가 직접 첨부해야 하며 social button이 파일을 붙이지 않는다는 경계를
  짧게 안내한다.

## Stage 1 — GIF 출력 계약과 encoder 고정

### 산출물

신규:

- `src/profile-card/gif-animation.js`
- `src/profile-card/gif-encoder.js`
- `src/profile-card/gif-binary.js`
- `src/profile-card/__tests__/gif-animation.test.js`
- `src/profile-card/__tests__/gif-encoder.test.js`
- `src/profile-card/__tests__/gif-binary.test.js`
- `mydocs/working/task_m100_39_stage1.md`

수정:

- `src/profile-marketing/MarketingLanding.jsx`
- `package.json`
- `package-lock.json`

### 변경 내용

- 공통 GIF/export·Border Beam preset과 결정적 frame phase를 구현한다.
- base RGBA를 고정한 채 승인 Chrome beam frame만 source-over 합성하는 순수
  renderer를 구현하고 card 외부 alpha를 0으로 유지한다.
- `gifenc@1.0.3`을 exact dependency로 추가하고 global palette·transparency·loop
  options를 고정한 encoder를 구현한다.
- bounded GIF inspector로 생성 결과의 binary invariant를 검증한다.
- synthetic base frame과 representative public PNG에서 96-frame GIF를 생성하고
  final prototype의 0/24/48/72/95 frame과 loop seam을 비교한다.
- final prototype과 의미 있는 시각 차이가 있으면 Stage 1 안에서 beam geometry를
  조정하고, dimension/fps/duration/palette를 변경해야 하면 작업을 멈춰 승인을
  요청한다.

### 검증

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-card/__tests__/gif-binary.test.js
npm run build:production
git diff --check
```

수동/fixture 확인:

- frame phase `0, 90, 180, 270, 356.25°`와 3.75° seam
- 998×612 tight canvas, rounded-corner transparency와 외부 shadow 부재
- 96 frames, 50ms, repeat 0, one global palette, local palette 0개
- final prototype 대비 Ocean beam 색·폭·강도·falloff
- dependency MIT license, zero runtime dependencies와 production bundle 포함 방식

### 커밋

```text
Task #39 Stage 1: GIF 출력 계약과 encoder 고정
```

## Stage 2 — browser Worker 생성 pipeline

### 산출물

신규:

- `src/profile-ui/gifExport.js`
- `src/profile-ui/gifExport.worker.js`
- `src/profile-ui/__tests__/gifExport.test.js`
- `mydocs/working/task_m100_39_stage2.md`

수정:

- `src/profile-card/gif-animation.js`
- `src/profile-card/gif-encoder.js`
- `src/profile-card/gif-binary.js`

### 변경 내용

- same-origin PNG fetch/decode, sequential frame generation, encoding과 transferable
  completion을 module Worker에 연결한다.
- finite state controller, source key, one-job lock, progress, 60초 timeout,
  terminate cancel, stale message 폐기와 retry를 구현한다.
- output inspector, 15MB guard, Blob/object URL 생성·재사용·revoke 생명주기를
  연결한다.
- Worker/canvas capability가 없거나 source/encoder/output이 실패해도 PNG와 다른
  Share 기능에 영향을 주지 않는 typed error를 보장한다.
- dark/light, en/ko와 representative avatar public PNG fixture를 생성해 모두
  15,000,000 bytes 미만인지 확인한다.

### 검증

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-ui/__tests__/gifExport.test.js
npm run build:production
git diff --check
```

집중 검증:

- source allowlist, content type/empty/10MB 초과/fetch/decode 실패
- duplicate generate, monotonic progress와 stale job message 무시
- source change, cancel, retry, timeout과 unmount terminate
- object URL create/reuse/revoke 정확한 호출 수
- malformed/oversize output에서 Blob 미생성
- 4개 theme/locale 조합과 representative avatar의 binary invariant·byte length

### 커밋

```text
Task #39 Stage 2: browser Worker 생성 pipeline
```

## Stage 3 — Share Studio GIF 생성·저장 UX

### 산출물

수정:

- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/shareStudio.js`
- `src/profile-ui/messages.js`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`

신규:

- `mydocs/working/task_m100_39_stage3.md`

### 변경 내용

- desktop-only `PNG | GIF` segmented control과 선택 즉시 생성되는 GIF preview를
  배치한다.
- save slot을 PNG link 또는 비활성/활성 `Save GIF`로 전환하고 생성 중 skeleton,
  progress·error·retry·수동 X·Reddit 첨부 안내를 ko/en으로 연결한다.
- GIF 원본은 이미 로드한 owner card source URL을 우선해 public preview가 아직
  materialize되지 않은 로컬·초기 상태에서도 생성 가능하게 한다.
- PNG 모드는 기존 X·Threads·LinkedIn·Facebook·Reddit을 유지하고 GIF 모드는
  X·Reddit만 노출하며, PNG로 돌아오면 5개 대상을 즉시 복원한다.
- PNG 대상은 기존처럼 작성 창을 바로 열고, GIF의 X·Reddit 대상은 모달 안에서
  `GIF 저장 → 작성 창 열기 → 저장한 GIF 첨부` 3단계 안내를 연다. 생성 중에는
  안내 안의 GIF 저장도 비활성화하고 ready 뒤 같은 Blob 다운로드로 활성화한다.
- 형식 전환 action row는 180ms 단일 opacity·position·scale 모션으로 교체하고
  유지·신규 child의 기존 stagger를 재실행하지 않아 X만 정적으로 남는 회귀를 막는다.
- ready 뒤 상단 preview를 생성된 GIF Blob으로 교체하고 PNG 복귀 시 static PNG를
  복원한다. reduced motion에서는 GIF ready 뒤에도 static PNG를 유지한다.
- mobile에서는 GIF DOM과 Worker generation이 모두 없고 현재 PNG 저장을
  유지한다.
- close/Escape/source change에서 즉시 job·object URL을 정리하면서 기존 handoff,
  focus trap/restore와 scroll lock을 보존한다.
- short desktop에서 selector/status/action이 겹치거나 modal overflow를 만들지
  않게 하고, reduced motion에서 기존 spatial motion 제거와 static preview 계약을
  유지한다.
- Playwright happy path는 실제 Worker/encoder로 생성·download하고 error branch는
  deterministic source/capability fixture로 검증한다.

### Stage 3.2 보정 — 승인 Chrome frame pipeline

- 초기 procedural conic 근사 renderer는 최종 시제품과 유사하지만 동일한 browser
  rasterization·filter·edge alpha를 재현하지 못하므로 production Worker 경로에서는
  사용하지 않는다.
- 최종 시제품 생성에 사용한 installed Chrome에서 카드 본문을 숨기고 998×612,
  DPR 2, 96개 phase의 Border Beam만 캡처한다. 투명 pixel은 버리고 visible row run만
  저장한 version 1 asset을 gzip으로 압축한다.
- asset은 `.bin`으로 배포해 Vite/static server가 HTTP `Content-Encoding: gzip`으로
  오인하지 않게 한다. Worker의 `DecompressionStream("gzip")`이 raw compressed
  bytes를 한 번 해제한다.
- parser는 magic·version·frame count·run bounds·decoded/encoded size와 trailing
  bytes를 검증한다. renderer는 검증된 run만 base PNG에 source-over로 합성한다.
- compressed asset SHA-256과 대표 frame SHA-256을 테스트로 고정하고 실제 browser
  Worker 생성·preview·download를 E2E로 검증한다.

### Stage 3.3 보정 — GIF 첨부 안내 복원

- Open Graph link만 공유하던 PNG 대상은 direct composer anchor를 유지한다.
- 자동 파일 첨부가 불가능한 GIF 모드의 X·Reddit 대상은 기존 ShareInstructions를
  다시 연결하되 PNG 복사·붙여넣기 문구를 GIF 저장·수동 첨부 흐름으로 교체한다.
- 대상 버튼의 `aria-expanded`·`aria-pressed`와 안내 영역 `aria-controls`를 연결하고,
  대상/형식 변경·닫기·Escape에서 선택 상태를 초기화한다.
- 기존 panel open 160ms ease-out, close 120ms ease-in 전환을 그대로 사용하며 format
  action row의 단일 180ms 전환과 child stagger 미재실행 계약은 변경하지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/gifExport.test.js
npm run test:e2e -- --grep "Share Studio|GIF"
npm run build:production
git diff --check
```

desktop E2E:

- PNG default와 기존 `Save PNG`
- GIF select → 자동 generating skeleton·비활성 `Save GIF` → ready·활성 `Save GIF`
- GIF 선택 시 X·Reddit만 남고 PNG 복귀 시 기존 5개 SNS가 모두 복원됨
- GIF X·Reddit 클릭 시 저장·작성 창·첨부 안내, generating 저장 비활성, ready 저장 활성
- PNG 대상은 안내 없이 기존 direct composer link를 유지하고 형식 변경 시 안내 닫힘
- format 전환 row의 180ms 단일 모션과 child stagger 미재실행
- 생성 중 skeleton, ready 뒤 GIF Blob, PNG 복귀와 reduced motion의 static PNG
- download filename, MIME, 998×612/96-frame/size binary 확인
- generating 중 비활성 저장, close, Escape, reopen과 source change
- unsupported/source/encode/invalid/too-large/timed-out 오류와 retry
- keyboard tab order, focus visible, live status와 ko/en copy
- 1280×900, 1512×982, 1280×620 layout와 horizontal overflow 0
- reduced motion에서도 ready GIF Blob을 preview에 연결하지 않고 static PNG 유지

mobile·회귀 E2E:

- iPhone/Android 환경에 GIF selector·Save GIF DOM과 Worker 호출 부재
- `Save PNG`, social intent, Copy share link/Image URL/README/Image와 Make private
- Share Studio open/close handoff, focus restore와 preview failure 경로

### 커밋

```text
Task #39 Stage 3: Share Studio GIF 생성과 저장 UX
```

## Stage 4 — 공식 문서와 통합 시각 QA

### 산출물

수정:

- `docs/readme-card.md`
- 필요 시 Stage 1~3 테스트의 fixture·기대값 보정

신규:

- `mydocs/working/task_m100_39_stage4.md`

### 변경 내용

- 기존 Share Studio 사용자 문서에 desktop web GIF generation, Save GIF,
  X·Reddit 수동 첨부와 X 웹 15MB 경계를 추가한다.
- mobile GIF, public GIF URL, Web Share, clipboard와 자동 업로드를 제공하지 않는
  범위를 짧고 명확하게 기록한다.
- dark/light·ko/en representative GIF의 전체 loop를 확인하고 카드 고정,
  transparent tight bounds, beam motion과 seam을 final prototype과 비교한다.
- 전체 Node/Playwright/production build/Sites artifact 회귀를 수행한다.
- 실제 X·Reddit 게시나 production 배포는 하지 않는다. 외부 수동 업로드
  검증이 필요하면 저장된 파일을 작업지시자에게 전달해 별도 확인받는다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
git diff --check
```

수동 시각 QA:

- dark/en, dark/ko, light/en, light/ko 대표 GIF
- 998×612·20fps·4.8초·96 frames·15MB 미만
- card rotation/scale/highlight 없음, Ocean Border Beam만 이동
- frame 95 → 0 seam에 pause·jump·역행·중복 endpoint 없음
- rounded corner 밖 alpha 0, canvas 외부 여백·drop shadow 없음
- 저장 파일의 filename과 `image/gif` MIME가 X 웹에서 선택 가능한 형식인지 로컬 확인

### 커밋

```text
Task #39 Stage 4: 통합 시각 QA와 사용자 문서
```

## 검증

- 각 Stage 검증 명령은 해당 단계 보고서 작성 전에 실행한다.
- 생성 binary 검증은 filename이나 Blob type만 보지 않고 inspector로 frame·delay·
  transparency·loop·palette·size를 확인한다.
- 시각 QA는 final prototype과 대표 frame/전체 loop를 모두 비교한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- output preset, encoder dependency, Worker fallback, 문서 위치나 mobile 범위를
  바꿔야 하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- production 배포, X 업로드·게시와 외부 계정 mutation은 자동 검증 범위가 아니다.

## 커밋

- 각 Stage 구현과 `mydocs/working/task_m100_39_stage{N}.md`를 같은 commit에
  묶는다.
- 계획서만 승인받기 위한 이번 commit은 다음을 사용한다.

```text
Task #39: 구현 계획서 작성과 오늘할일 갱신
```

- 단계 commit은 다음 exact message를 사용한다.
  - `Task #39 Stage 1: GIF 출력 계약과 encoder 고정`
  - `Task #39 Stage 2: browser Worker 생성 pipeline`
  - `Task #39 Stage 3: Share Studio GIF 생성과 저장 UX`
  - `Task #39 Stage 4: 통합 시각 QA와 사용자 문서`

## 단계 의존성

- Stage 1은 encoder와 output contract를 고정하며 다른 Stage보다 먼저 완료한다.
- Stage 2는 Stage 1의 preset·encoder·binary inspector 승인을 받은 뒤 시작한다.
- Stage 3은 Stage 2의 real Worker happy path와 failure/lifecycle 검증 승인 후
  Share Studio에 연결한다.
- Stage 4는 Stage 3 desktop/mobile UX 승인 후 공식 문서와 전체 회귀를 수행한다.
- 각 Stage는 `task-stage-report` 절차로 검증·보고·commit하고 작업지시자 승인을
  받은 뒤 다음 Stage로 이동한다.

## 위험과 대응

- **final prototype과 beam 차이**: browser Canvas가 CSS filter rasterization을
  근사하지 않도록 승인 시제품을 만든 Chrome의 96개 RGBA phase를 versioned sparse
  asset으로 고정한다. compressed/decompressed size·SHA와 frame contract를 gate로
  두며 asset load·decode가 실패하면 typed GIF generation error로 종료한다.
- **avatar로 인한 palette 품질·용량 변화**: static base 최빈 16색과 animation edge
  최빈 48색을 exact RGB로 보존하고 전체 균등 sample로 나머지 global palette를
  구성한다. 승인 sample의 exact-pixel ratio와 RMSE, 4개 theme/locale 및
  representative avatar를 검사한다. 15MB 초과 시 자동 품질 하향 없이 중단한다.
- **gifenc 유지보수 주기**: exact version, integrity, source·license·export API와
  zero runtime dependencies를 검증한다. 계획과 다르면 대체 dependency를 임의로
  도입하지 않는다.
- **Worker browser 차이**: module Worker·ImageBitmap·OffscreenCanvas capability를
  선확인하고 main-thread fallback 없이 unsupported를 표시한다. production 대상
  desktop browser의 실제 build/E2E에서 확인한다.
- **CPU·memory pressure**: 한 Worker·한 job, 재사용 RGBA/index frame과 bounded
  animation palette sample을 사용한다. 10MB source, 15MB output, 60초 timeout으로
  상한을 둔다.
- **stale GIF 저장**: source key와 jobId를 revision/theme/locale/preset에 묶고
  source change에서 Worker·Blob URL을 폐기한다.
- **Share Studio 회귀**: save slot만 format state에 따라 교체하고 social/copy/privacy,
  modal handoff와 mobile PNG 계약을 집중 E2E로 유지한다.
- **외부 X 정책 변화**: 15MB는 X 공식 문서를 근거로 하되 제품 hard cap과 문서
  링크를 분리한다. 변경은 후속 issue에서 검토한다.
- **실제 X 업로드 미검증**: 이 task는 파일 생성·저장까지다. 자동으로 X 계정을
  조작하지 않으며 최종 파일의 실제 업로드는 작업지시자 수동 확인으로 남긴다.

## 승인 요청 사항

- `gifenc@1.0.3` exact dependency, static exact RGB + animation-wide `rgb565`
  sampling, 1-bit alpha, 단일 global 256색 palette, dithering 없음의 encoder 계약
- common Border Beam preset + 승인 Chrome 96-frame sparse asset + deterministic
  source-over renderer와 asset/frame SHA 비교 방식
- 단일 module Worker, sequential 96-frame 처리, 60초 timeout, no main-thread
  fallback과 source/output/resource 상한
- output binary inspector와 15MB 초과 시 자동 품질 하향 없이 오류 처리하는 정책
- desktop `PNG | GIF`, 선택 즉시 생성·skeleton·비활성 `Save GIF`, ready 뒤 GIF Blob
  preview와 활성 `Save GIF`, reduced-motion static preview와 mobile PNG-only UX
- Stage 1~4의 산출물·검증·exact commit message와 단계별 승인 gate
- `docs/readme-card.md`만 최소 수정하고 실제 X 업로드·production 배포를 제외하는
  문서·외부 작업 경계

승인 후 Stage 1만 구현하고 검증·단계 보고서와 commit을 작성한 뒤 다음 Stage
승인을 요청한다.
