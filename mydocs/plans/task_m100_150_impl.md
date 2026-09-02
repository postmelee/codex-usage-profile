# Task #150 구현계획서 — PNG·GIF 첨부 내보내기의 투명 모서리 제거 및 998×612 규격 통일

수행계획서: [`task_m100_150.md`](task_m100_150.md)
GitHub Issue: [#150](https://github.com/postmelee/codex-usage-profile/issues/150)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 첨부 canvas 계약과 PNG 저장 분리 | 공통 attachment surface, 브라우저 PNG Blob 생성, Share Studio 저장 경로 | `998×612`, 전 픽셀 불투명, theme별 corner·outline, stable URL 분리 |
| 2 | 불투명 GIF encoder와 모션 동등성 | Worker attachment 합성, opaque global palette, preset v3, GIF binary 계약 | 96개 불투명 frame, 기존 golden·phase·seam, 15MB 상한 |
| 3 | Share Studio·문서·전체 회귀 | E2E, 공식 사용자 문서, stable/OG 회귀와 production artifact 검증 | PNG/GIF 저장 UX, 세 출력 계약 분리, 전체 Node·Playwright·build |

## 문서 위치 확인

수행계획서가 첨부용 PNG/GIF를 공개 사용자 계약으로 판단했으므로 기존 공식 사용자 문서 `docs/readme-card.md`를 Stage 3에서 최소 수정한다. 구현 계획과 단계·최종 보고는 내부 작업 추적용 `mydocs/`에 둔다. 새 공식 문서나 `mydocs/manual/` 문서는 만들지 않는다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 카드·Share Studio 사용자 계약 | `docs/` | `docs/readme-card.md` | OK | 기존 문서가 stable PNG, OG와 GIF 저장 계약을 함께 소유 |
| Task #150 구현 계획 | `mydocs/` | `mydocs/plans/task_m100_150_impl.md` | OK | 승인 전 단계 경계 고정 |
| Task #150 단계 보고 | `mydocs/` | `mydocs/working/task_m100_150_stage{1,2,3}.md` | OK | 각 Stage 소스·검증과 함께 커밋 |
| Task #150 최종 보고 | `mydocs/` | `mydocs/report/task_m100_150_report.md` | OK | 모든 Stage 승인 후 생성 |

## Stage 1 — 첨부 canvas 계약과 PNG 저장 분리

### 산출물

신규:

- `src/profile-card/attachment-canvas.js`
- `src/profile-card/__tests__/attachment-canvas.test.js`
- `src/profile-ui/pngExport.js`
- `src/profile-ui/__tests__/pngExport.test.js`
- `mydocs/working/task_m100_150_stage1.md`

수정:

- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/messages.js`
- `src/profile-ui/shareStudio.js`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260902.md`

### 변경 내용

- `attachment-canvas.js`에 `499×306` logical, scale 2, `998×612`, radius 64px의 첨부 출력 preset을 정의한다. logical dimension과 radius는 기존 social/card 상수를 재사용하고 첨부용 output scale·surface만 별도 계약으로 둔다.
- 공통 canvas 합성 함수는 출력 전체를 theme surface로 먼저 채우고 source PNG를 `0,0,998,612` bounds에 그린다. 추가 padding, crop, translate 또는 content scale은 허용하지 않는다.
- 다크 surface는 `#181818`로 채우고 별도 정적 outline을 추가하지 않는다. 라이트 surface는 기존 `#F3F5F7`을 사용하고 2배 출력 기준 `2px #D0D7DE` outline을 1px inset, radius 63px로 그려 기존 1 logical px 경계를 유지한다.
- 합성 함수는 Canvas 2D 호환 context와 decoded image를 입력받아 Node test, 브라우저 PNG와 GIF Worker가 같은 계산을 사용하게 한다. context 크기와 theme를 검증하고 alpha를 지우는 `clearRect` 경로를 두지 않는다.
- `pngExport.js`는 same-origin PNG URL만 받아 `cache: no-cache`, `credentials: same-origin`으로 fetch하고 content type·실제 Blob 크기·redirect origin을 검증한다. decoded bitmap을 공통 합성 함수에 전달하고 `image/png` Blob으로 인코딩하며 abort와 bitmap close를 보장한다.
- PNG 생성은 Share Studio의 현재 source revision·theme·locale key에 묶는다. 사용자가 Save PNG를 누르면 한 번만 생성·다운로드하고 중복 클릭을 막으며, source 변경·dialog close·unmount에서는 진행 중 작업을 abort하고 임시 object URL을 revoke한다.
- 기존 PNG `<a href={selectedImageUrl}>` 직접 저장을 명시적 PNG 저장 action으로 교체한다. 이미지 URL 복사, README 복사, preview source와 이미지 clipboard 복사는 계속 stable/localized card URL을 사용한다.
- 비동기 PNG 생성 실패는 transparent stable PNG로 fallback하지 않는다. ko/en `imageSaveFailed` 메시지를 추가해 오류 toast를 제공하고 다시 Save할 수 있게 한다.
- mobile은 기존처럼 PNG action을 유지하며 GIF control을 새로 노출하지 않는다. 지원되는 canvas/toBlob 경계에서 같은 첨부 PNG를 저장한다.
- 단위 테스트는 다크 네 모서리 `rgba(24,24,24,255)`, 라이트 surface `#F3F5F7`, outline `#D0D7DE`, alpha min/max 255, 정확한 output dimension과 source content bounds를 확인한다.
- Playwright 집중 시나리오는 실제 download event의 파일명·MIME·PNG header·dimension·corner alpha를 확인하고 stable URL/README 복사 값이 바뀌지 않았음을 검증한다.
- 대표 dark/light PNG를 같은 source로 생성해 `/private/tmp/task150-stage1/`에 저장한다. 카드 내부 좌표와 비율, 라이트 모서리·경계를 작업지시자에게 제시하고 승인 전 Stage 2로 넘어가지 않는다.

### 검증

```bash
node --test src/profile-card/__tests__/attachment-canvas.test.js src/profile-ui/__tests__/pngExport.test.js src/profile-ui/__tests__/shareStudio.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #150|Share Studio.*PNG"
npm run build:production
git diff --check
```

추가 확인:

- 생성 PNG의 signature, `998×612`, `image/png`, alpha extrema와 네 모서리 RGBA를 픽셀 검사한다.
- stable `card.png` source와 첨부 PNG를 2배 logical 좌표로 정규화해 header, heatmap, stats의 content bounds가 같은지 비교한다.
- `git diff --name-only`에 Stage 1 산출물 외 파일이 없고 stable renderer, social renderer와 golden asset이 변경되지 않았는지 확인한다.

### 커밋

```text
Task #150 Stage 1: 불투명 첨부 PNG 계약과 저장 경로 구현
```

## Stage 2 — 불투명 GIF encoder와 모션 동등성

### 산출물

수정:

- `src/profile-card/gif-animation.js`
- `src/profile-card/gif-binary.js`
- `src/profile-card/gif-encoder.js`
- `src/profile-card/__tests__/gif-animation.test.js`
- `src/profile-card/__tests__/gif-binary.test.js`
- `src/profile-card/__tests__/gif-encoder.test.js`
- `src/profile-card/__tests__/gif-beam-frames.test.js`
- `src/profile-ui/gifExport.js`
- `src/profile-ui/gifExport.worker.js`
- `src/profile-ui/__tests__/gifExport.test.js`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260902.md`

신규:

- `mydocs/working/task_m100_150_stage2.md`

### 변경 내용

- `PROFILE_GIF_PRESET`의 width, height, scale과 border radius가 Stage 1의 attachment preset을 참조하도록 바꾼다. 수치는 계속 `998×612 / scale 2 / radius 64`이고 fps, duration, frame count, delay, loop, palette와 byte 상한은 변경하지 않는다.
- `GIF_EXPORT_PRESET_VERSION`을 3으로 올려 session cache와 Worker request가 이전 transparent 결과를 재사용하지 않게 한다.
- GIF Worker의 source decode 단계에서 `clearRect + drawImage` 대신 Stage 1 공통 attachment 합성 함수를 사용한다. source가 `1497×918`이어도 결과는 정확히 `998×612`이고 theme별 surface·outline 및 전 픽셀 alpha 255를 encoder 입력 전에 검사한다.
- `gif-encoder.js`는 opaque base를 필수로 검증하고 투명 픽셀이 있으면 실패시킨다. palette에서 예약 transparent color/index를 제거하고 최대 256개를 모두 opaque 색상에 사용할 수 있게 한다.
- global palette mapper는 alpha threshold 분기 없이 모든 픽셀을 가장 가까운 opaque palette entry로 매핑한다. frame 기록은 transparency flag와 transparent index를 설정하지 않고 full canvas를 disposal 1로 기록한다.
- `gif-binary.js`의 canonical contract는 모든 Graphic Control frame에서 transparency flag가 꺼져 있음을 요구한다. inspector는 flag가 꺼진 frame의 transparent index를 의미 없는 byte가 아니라 `null`로 정규화한다.
- 기존 다크·라이트 golden 파일과 loader SHA는 변경하지 않는다. effect renderer가 동일 base geometry 위에서 0°부터 356.25°까지 같은 96 phase를 적용하는지 대표 사분면과 95→0 seam으로 대조한다.
- encoder color fidelity 검증은 투명 index가 없는 256색 palette 기준으로 갱신한다. 다크 `#181818`과 라이트 surface·outline 색상이 palette에 안정적으로 유지되고 기존 edge RMSE 기준을 악화시키지 않는지 확인한다.
- Worker/controller 테스트 fixture를 opaque attachment base로 바꾸고 완료 metadata, source key v3, 진행률, cancel, timeout, oversize, invalid output과 theme handoff를 회귀한다.
- 실제 dark/light·ko/en 카드 4종을 Worker로 생성해 각각 `998×612 / 96 frames / 50ms / loop 0 / no transparency / 15MB 미만`인지 확인한다.
- 대표 dark/light GIF를 `/private/tmp/task150-stage2/`에 저장하고 Stage 1 PNG와 첫 frame의 content geometry, 전체 둘레 motion, 라이트 대비와 seam을 작업지시자에게 제시한다.

### 검증

```bash
node --test src/profile-card/__tests__/attachment-canvas.test.js src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #150|GIF"
npm run build:production
git diff --check
```

추가 확인:

- 각 GIF frame의 transparency flag가 false이고 디코딩 결과의 alpha min/max가 255인지 검사한다.
- dark/light golden asset SHA-256과 파일 크기를 Stage 시작 전 기준값과 비교해 무변경을 확인한다.
- PNG와 GIF 첫 frame의 카드 content bounds·radius·종횡비 및 theme surface가 동일한지 픽셀 대조한다.
- 0/24/48/72 frame의 Beam 중심이 기존과 같은 사분면 순서를 통과하고 95→0 seam이 인접 frame 수준인지 확인한다.

### 커밋

```text
Task #150 Stage 2: GIF 불투명 palette와 기존 모션 계약 적용
```

## Stage 3 — Share Studio·문서·전체 회귀

### 산출물

수정:

- `tests/profile-ui.spec.js`
- `docs/readme-card.md`
- `mydocs/orders/20260902.md`

신규:

- `mydocs/working/task_m100_150_stage3.md`

필요 시 회귀 보완:

- Stage 1·2에서 변경한 테스트 파일

### 변경 내용

- Share Studio의 PNG와 GIF 전환, PNG 즉시 생성·저장, GIF 생성·preview·저장, 중복 클릭, 실패·재시도, dialog close와 source/theme/locale 변경 시 abort·revoke를 실제 브라우저에서 검증한다.
- desktop에서는 PNG/GIF 모두 첨부용 `998×612` 파일을 저장하고, mobile은 PNG만 같은 불투명 계약으로 저장하며 GIF UI가 나타나지 않는지 확인한다.
- 이미지 URL·README·share link·image clipboard, social intent, Make private와 card handoff가 기존 stable/localized URL 및 UX를 유지하는지 회귀한다.
- stable README card를 직접 요청해 `1497×918`, corner alpha 0, ETag/revision URL 계약을 확인한다. OG social image는 `2400×1260`과 기존 dark transparent/light opaque surface·card placement를 유지하는지 확인한다.
- `docs/readme-card.md`의 GIF 표에서 transparent background 설명을 opaque attachment surface로 바꾼다. PNG Save도 같은 `998×612` 첨부 계약을 사용하며 README/image URL은 stable `1497×918` PNG를 계속 가리킨다는 차이를 짧게 명시한다.
- 대표 최종 dark/light PNG/GIF에 대해 파일 크기, alpha, corner color, 첫 frame geometry와 GIF motion을 다시 기록한다. X 실제 업로드 자체는 자동화하지 않으며 작업지시자가 첨부할 수 있는 검수 파일을 제공한다.
- 전체 Node test, Playwright, production build와 Sites artifact verifier를 실행한다. 실패가 있으면 Stage 3 안에서 회복하고 성공 전 보고서를 작성하지 않는다.

### 검증

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
git diff --check
```

추가 확인:

- `git diff --name-only`로 stable renderer, social layout과 golden binary 무변경을 확인한다.
- 최종 생성물 4종의 dimension·MIME·alpha·GIF metadata·byte 상한을 한 번에 검사한다.
- X 직접 첨부용 파일 경로와 재현 절차를 Stage 3 보고서에 기록하되 로컬 임시 산출물은 저장소에 커밋하지 않는다.

### 커밋

```text
Task #150 Stage 3: 첨부 출력 문서와 전체 회귀 검증
```

## 검증

- 각 Stage 검증 명령은 해당 단계의 `task-stage-report` 실행 전에 통과해야 한다.
- Stage 1과 Stage 2의 representative 파일은 작업지시자 시각 승인 전 다음 Stage로 넘기지 않는다.
- PNG/GIF alpha 검증은 파일 metadata의 alpha 지원 여부가 아니라 실제 모든 픽셀·frame의 alpha 값으로 판정한다.
- GIF metadata 검증은 logical screen뿐 아니라 각 frame의 transparency flag 부재, delay, disposal, global palette와 local palette 부재를 확인한다.
- stable README PNG와 OG social PNG는 기준 출력과 별도 회귀 계약으로 검사하고 attachment 결과와 혼용하지 않는다.
- 실패한 검증은 단계 완료로 처리하지 않으며 계획 변경이 필요하면 이 문서를 먼저 갱신하고 승인을 받는다.
- `git status --short`는 각 단계 커밋 후 빈 출력이어야 한다.
- `git diff --check`는 모든 단계에서 경고 없이 통과해야 한다.

## 커밋

- 구현계획서 승인 후 Stage 1부터 순차 진행한다.
- 각 Stage 소스·테스트·문서 변경과 `mydocs/working/task_m100_150_stage{N}.md`, 오늘할일 갱신을 같은 커밋에 묶는다.
- 커밋 메시지는 구현계획서에 고정한 `Task #150 Stage {N}: ...` 형식을 사용한다.
- 모든 Stage 승인 후에만 `task-final-report`로 최종 보고와 PR 게시 절차에 진입한다.

## 단계 의존성

- Stage 1은 공통 attachment canvas와 PNG 저장 계약을 확정한다. 작업지시자가 dark/light PNG를 승인해야 Stage 2를 시작한다.
- Stage 2는 승인된 Stage 1 합성 위에서 GIF encoder와 Worker만 불투명 계약으로 전환한다. GIF 시각·motion 승인과 단계 보고 승인 후 Stage 3로 진행한다.
- Stage 3는 Stage 1·2 출력 계약을 바꾸지 않고 통합 UX·문서·전체 회귀를 마감한다.
- 각 단계 범위를 넘어서는 UI 재설계, renderer 변경 또는 플랫폼별 특례가 필요하면 구현을 멈추고 계획 변경 승인을 받는다.

## 위험과 대응

- **세 출력 계약이 섞일 위험**: attachment preset을 별도 모듈로 소유하고 stable/OG renderer 호출부는 변경 금지 및 회귀 대상으로 둔다.
- **라이트 모서리 surface가 시각적으로 어색할 위험**: Stage 1에서 padding 없는 실제 `998×612` dark/light PNG를 먼저 검수하고 승인 없이 GIF에 확장하지 않는다.
- **PNG 비동기 download가 사용자 gesture를 잃을 위험**: 실제 Chromium download event로 검증하고 필요하면 클릭 시 동기 anchor 준비 후 Blob URL만 결합하는 지원 패턴을 사용한다.
- **모바일 canvas/download 호환성**: 기존 PNG action을 유지하되 capability 실패를 명시적으로 처리하고 mobile Playwright에서 GIF 미노출·PNG action 회귀를 확인한다.
- **opaque palette 전환으로 GIF 색상이나 용량이 달라질 위험**: 256색 global palette, no dithering과 edge color 예약을 유지하고 RMSE·15MB 검증을 양쪽 테마에 적용한다.
- **불투명 base가 Border Beam 합성을 가릴 위험**: golden을 바꾸지 않고 전체 96 frame effect 존재, 대표 phase 대비와 perimeter 순서를 검사한다.
- **이전 투명 GIF cache 재사용**: preset version 3과 source key 회귀로 이전 session 결과를 무효화한다.
- **Blob·bitmap resource 누수**: abort, bitmap close, object URL revoke를 성공·실패·source 변경·dialog close·unmount 각각 테스트한다.
- **문서와 실제 저장 파일 불일치**: Stage 3에서 브라우저 다운로드 결과를 실측한 뒤에만 `docs/readme-card.md` 값을 확정한다.

## 승인 요청 사항

- Stage 1→2→3의 단계 분할과 각 단계 산출물·검증·커밋 메시지
- Stage 1에서 공통 attachment canvas를 만들고 Save PNG만 browser Blob으로 분리하며 URL·README·clipboard 복사는 stable PNG를 유지하는 구현 경계
- Stage 2에서 GIF golden과 motion은 보존하고 source surface, palette, binary transparency contract와 preset version만 변경하는 구현 경계
- dark는 `#181818`, light는 `#F3F5F7 + #D0D7DE`를 padding 없이 기존 card bounds에 적용하는 theme 계약
- Stage 1 PNG와 Stage 2 GIF를 각각 시각 승인받은 뒤 다음 단계로 진행하는 검수 순서
- Stage 3에서 `docs/readme-card.md`만 최소 수정하고 production 배포와 원격 Site 변경은 하지 않는 범위

승인되면 Stage 1의 공통 attachment canvas, PNG 저장 분리와 집중 검증부터 진행한다.
