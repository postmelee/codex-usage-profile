# Task #39 Stage 1 보고서 — GIF 출력 계약과 encoder 고정

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 1

## 단계 목적

웹 전용 Animated GIF 생성 기능의 선행 계약을 코드로 고정했다. 카드 자체는
회전·기울기·확대 없이 정지시키고, 기존 웹 카드와 같은 Ocean Border Beam만
998×612 투명 캔버스에서 20fps·4.8초 동안 순환하도록 했다. 브라우저 Worker와
Share Studio를 연결하기 전에 frame phase, encoder, 전역 palette와 GIF binary
invariant를 독립적으로 검증할 수 있는 기반을 마련했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/gif-animation.js` | preset version 1, 998×612·96 frame 출력 계약, 웹 공통 Border Beam preset, 결정적 rounded-perimeter frame renderer 구현 |
| `src/profile-card/gif-encoder.js` | `gifenc@1.0.3` quantizer, 1-bit alpha, 단일 global palette, full-frame encoder와 결정적 palette mapper 구현 |
| `src/profile-card/gif-binary.js` | bounded cursor 기반 GIF89a·loop·frame·delay·transparency·palette·size inspector 구현 |
| `src/profile-card/__tests__/gif-animation.test.js` | preset, 0/90/180/270/356.25° phase, 고정 카드와 beam 사분면, 투명 모서리 검증 |
| `src/profile-card/__tests__/gif-encoder.test.js` | 96 frame encoder, 전역 palette 안정성, 투명 source 거부, 대표 public card 15MB 상한 검증 |
| `src/profile-card/__tests__/gif-binary.test.js` | 정상 GIF metadata와 malformed/contract failure 검증 |
| `src/profile-marketing/MarketingLanding.jsx` | 기존 `<BorderBeam>` 값을 공통 preset으로 교체 |
| `package.json` | production dependency `gifenc: 1.0.3` exact version 추가 |
| `package-lock.json` | `gifenc@1.0.3` registry integrity와 MIT license 고정 |
| `mydocs/orders/20260827.md` | Stage 1 완료와 Stage 2 승인 대기 상태 반영 |
| `mydocs/working/task_m100_39_stage1.md` | Stage 1 산출물·검증·잔여 위험 기록 |

총 신규 제품·테스트 코드 1,026줄을 추가했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 웹 카드의 Border Beam
동작 값(`ocean`, `4.8s`, `brightness 1.05`, `md`, `strength 0.82`)은 변경하지 않고
공통 상수로 이동했다. 현재 사용자 UI와 PNG 생성·저장 동작도 변경하지 않았다.

구현계획의 `gifenc.applyPalette(..., "rgba4444")`는 대표 GIF 시각 검증에서 같은
정적 배경색이 beam 위치에 따라 다른 palette index로 선택되는 cache 충돌이
확인되어 그대로 사용하지 않았다. `rgba4444` quantize와 단일 global palette는
유지하되, exact RGB key를 animation 전체에서 재사용하는 결정적 nearest-color
mapper로 교체해 카드 내용의 frame 간 색상 고정을 보장했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-card/__tests__/gif-binary.test.js
npm run build:production
git diff --check
```

결과:

- OK — GIF 관련 10개 단위 테스트 통과, 실패·skip 없음.
- OK — server 63 modules, client 1,835 modules production build 통과.
- OK — `git diff --check` 출력 없음.
- OK — 대표 public card 출력은 3,811,436 bytes로 15,000,000 bytes 미만이다.
- OK — binary inspector 기준 998×612, 96 frames, frame delay 5cs, repeat 0,
  global palette 256색, local palette 0개, 모든 frame transparency/disposal 1이다.
- OK — frame 0→1, 94→95, 95→0 변화량은 각각 73,439, 73,354,
  73,476으로 loop seam이 인접 frame과 같은 수준이다.
- OK — final prototype의 0/24/48/72/95 frame과 비교해 카드 고정, 투명
  tight canvas, Ocean beam 위치·폭·강도·falloff를 확인했다.
- OK — `gifenc@1.0.3` exact 설치, MIT license, runtime dependency 0개,
  production vulnerability 0개와 browser ESM bundle 가능 여부를 확인했다.

## 잔여 위험

- Stage 1 encoder는 Node와 browser-target bundle까지 확인했지만 실제 module
  Worker의 PNG fetch/decode·cancel·timeout·transfer lifecycle은 Stage 2 범위다.
- dark 대표 카드의 실제 용량은 충분하지만 light·locale 조합과 서로 다른 avatar
  source의 15MB 상한은 Stage 2 fixture에서 추가 확인해야 한다.
- X 게시물 첨부 후 플랫폼 측 재처리 결과는 제품 코드가 통제할 수 없으며, 최종
  통합 시 실제 저장 파일을 수동 첨부해 확인해야 한다.

## 다음 단계 영향

- Stage 2는 `GIF_EXPORT_PRESET_VERSION`, source 10MB 상한, 60초 timeout과
  renderer/encoder/inspector를 그대로 module Worker에 연결한다.
- Worker completion 전에 `assertProfileGifContract`를 통과시켜야 하며, bytes가
  15MB 이상이면 adaptive downgrade 없이 `too_large`로 종료해야 한다.
- palette mapping은 `createGifGlobalPaletteMapper` 인스턴스 하나를 96 frame 동안
  재사용해야 정적 카드 색상이 흔들리지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 browser Worker 생성 pipeline으로
  진행한다.
