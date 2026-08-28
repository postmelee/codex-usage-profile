# Task #39 Stage 3.2 보고서 — 승인 Chrome frame pipeline 교정

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 3.2

## 단계 목적

Stage 3의 procedural conic renderer가 출력 계약은 충족하지만 최종 승인 시제품의
browser rasterization·filter·edge alpha와 시각적으로 일치하지 않는 문제를
교정했다. 시제품을 만든 installed Chrome의 96개 Border Beam phase를 직접
versioned sparse asset으로 고정하고, desktop browser Worker가 원본 카드 PNG에
동일 frame을 합성하도록 변경했다. 998×612·20fps·4.8초·96 frame·투명 배경·256색
no-dither·15MB 미만 계약과 Share Studio UX는 유지했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/assets/ocean-beam-golden-v1.rgba-runs.bin` | installed Chrome에서 캡처한 승인 Border Beam 96 phase를 visible row run으로 저장한 gzip binary asset |
| `src/profile-card/gif-beam-frames.js` | compressed/decompressed 상한, magic·version·run bounds parser와 결정적 source-over renderer |
| `src/profile-card/__tests__/gif-beam-frames.test.js` | asset SHA-256·frame contract·대표 render SHA·malformed asset 회귀 검증 |
| `src/profile-card/gif-animation.js`, `gif-encoder.js` | 검증된 Chrome beam frame renderer를 palette sampling과 96-frame encode에 전달 |
| `src/profile-ui/gifExport.worker.js` | GIF job 시작 시 beam asset을 한 번 load·해제하고 encoder에 전달 |
| `src/profile-ui/gifExport.js` | `DecompressionStream`을 desktop GIF capability 계약에 추가 |
| `src/profile-ui/__tests__/gifExport.test.js` | asset-backed Worker의 dark/light·ko/en 실제 encoder와 capability 회귀 검증 |
| `mydocs/plans/task_m100_39_impl.md` | procedural 근사 대신 승인 Chrome frame asset을 최종 진실 원천으로 정정 |
| `mydocs/orders/20260828.md` | Stage 3.2 완료와 Stage 3.3 진행 상태 반영 |

compressed asset은 2,450,742 bytes, decoded row-run payload는 19,767,832 bytes이며
compressed SHA-256은
`aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680`이다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 PNG/GIF selector,
skeleton·progress·error·retry, GIF preview·save, X·Reddit allowlist, object URL과
Worker lifecycle, mobile PNG-only, handoff/focus/reduced-motion 동작은 보존했다.

asset은 gzip bytes지만 파일 확장자를 `.bin`으로 둔다. `.gz`는 Vite preview가
HTTP `Content-Encoding: gzip`으로 해석해 브라우저가 body를 자동 처리한 뒤 Worker의
`DecompressionStream`과 충돌했다. `.bin`은 raw compressed bytes를
`application/octet-stream`으로 전달하며 Worker에서만 한 번 해제한다.

작업지시자에게 전달했던 `Taegyu Lee` 진단 GIF는 기존 GIF를 역산해 다시 인코딩한
이중 양자화 파일이었고 production 경로가 아니다. 실제 제품은 1497×918 원본 PNG를
high-quality로 998×612 rasterize한 뒤 승인 beam frame을 직접 합성한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/gif-beam-frames.test.js src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/gifExport.test.js
npm run test:e2e -- --grep "Share Studio|GIF"
npm run build:production
git diff --check
```

결과:

- OK — 관련 단위 테스트 30개 통과, 실패·skip 없음.
- OK — Share Studio·GIF Playwright E2E 20개 통과, 실패·skip 없음.
- OK — 실제 Chromium Worker 생성·preview·download happy path가 4.2초에 완료됐다.
- OK — production server 63 modules, client 1,838 modules build 통과. beam binary는
  2,450.74KB, Worker artifact는 30.11KB로 분리됐다.
- OK — 대표 public sample은 5,969,872 bytes로 15MB 미만이며 998×612,
  20fps, 4.8초, 96 frame, infinite loop 계약을 충족한다.
- OK — 승인 시제품 decoded GIF 대비 전체 RGB RMSE 0.951/255, PSNR 48.57dB이며
  차이는 global palette 양자화 수준이다.
- OK — 96 frame 모두 rounded card 외부에 후보만 불투명한 pixel이 0개이고 모서리
  pixel은 투명하다.
- OK — 로컬 mock 계정 production UI에서 GIF 선택 즉시 생성, Blob preview와
  `GIF 저장` 활성화를 실제 browser로 확인했다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- GIF는 256색과 1-bit alpha 형식이므로 CSS의 반투명 glow와 완전히 같은 continuous
  alpha를 표현할 수 없다. 승인 시제품도 같은 GIF 제약 안에서 생성됐다.
- `DecompressionStream`이 없는 desktop browser는 GIF unsupported로 처리하고 기존
  PNG 기능을 유지한다.
- 2.45MB beam asset은 GIF를 선택한 Worker에서만 load하며 일반 PNG 화면의 초기
  bundle에는 포함하지 않는다.

## 다음 단계 영향

- Stage 3.3은 Task #78에서 연결 해제된 `ShareInstructions` shell과 motion을 GIF
  모드의 X·Reddit에만 다시 연결한다.
- GIF clipboard와 자동 첨부는 구현하지 않고 `GIF 저장 → 작성 창 열기 → 저장한
  GIF 첨부`의 3단계 안내를 제공한다. PNG의 현재 OG direct link는 유지한다.
- Stage 3.3 완료 뒤 Stage 4 공식 문서와 전체 통합 QA로 이동한다.

## 승인 요청

- 작업지시자가 2026-08-28 시각 결과를 승인하고 다음 작업 진행을 지시했으므로
  Stage 3.2를 완료하고 승인된 Stage 3.3 GIF 첨부 안내 복원으로 진행한다.
