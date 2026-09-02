# Task #150 Stage 2 보고서 — 불투명 GIF encoder와 모션 동등성

GitHub Issue: [#150](https://github.com/postmelee/codex-usage-profile/issues/150)
구현계획서: [`task_m100_150_impl.md`](../plans/task_m100_150_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 승인된 `998×612` 첨부 surface를 GIF Worker와 encoder에 연결해 X 첨부 시 드러나던 투명 모서리를 제거한다. 카드 크기·배치·종횡비와 기존 다크·라이트 Beam 자산, `96 frame / 20fps / 4.8초` motion phase는 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/gif-animation.js` | GIF preset을 attachment preset과 공유하고 cache version을 3으로 갱신 |
| `src/profile-card/gif-binary.js` | 모든 frame의 transparency flag 비활성화와 transparent index 부재를 canonical 계약으로 검증 |
| `src/profile-card/gif-encoder.js` | opaque RGBA 입력·palette를 강제하고 256개 global palette entry를 모두 불투명 색에 사용 |
| `src/profile-ui/gifExport.worker.js` | source PNG를 공통 attachment surface로 합성하고 encoder 전 전체 alpha를 검사 |
| `src/profile-card/__tests__/gif-animation.test.js` | preset v3, 불투명 corner와 기존 phase·seam 회귀 보강 |
| `src/profile-card/__tests__/gif-binary.test.js` | no-transparency binary metadata 회귀 보강 |
| `src/profile-card/__tests__/gif-encoder.test.js` | opaque 입력·palette, 색상 충실도와 15MB 상한 검증 |
| `src/profile-card/__tests__/gif-beam-frames.test.js` | 불투명 base에서도 기존 96-frame golden motion·seam 보존 검증 |
| `src/profile-ui/__tests__/gifExport.test.js` | dark/light·ko/en 실제 Worker GIF, corner·outline·첫 frame geometry 검증 |
| `tests/profile-ui.spec.js` | Share Studio 실제 저장 GIF의 모든 frame이 불투명인지 검증 |
| `mydocs/orders/20260902.md` | Task #150 진행 상태를 Stage 2 완료로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 항목은 해당하지 않는다. stable README PNG renderer와 OG social renderer는 변경하지 않았다. GIF의 카드 source bounds는 `0,0,998,612`로 유지했고, fps·duration·frame count·delay·loop·radius·byte 상한 및 다크·라이트 golden Beam 파일과 phase 계산도 그대로 보존했다. 변경 범위는 attachment surface 합성, opaque palette/binary 계약과 그 회귀 검증으로 한정했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/attachment-canvas.test.js src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #150|GIF"
npm run build:production
git diff --check
```

결과:

- OK — 집중 Node 검증 `40/40` 통과.
- OK — Chromium 집중 E2E `6/6` 통과. 실제 Share Studio 저장 GIF의 `998×612 / 96 frames / loop 0 / no transparency`를 확인했다.
- OK — production build 성공. server `63 modules`, client `1841 modules`, GIF Worker artifact 생성과 finalization을 확인했다.
- OK — 대표 다크 GIF `6,211,471 bytes`, 라이트 GIF `5,573,674 bytes`로 모두 `15,000,000 bytes` 미만이다.
- OK — Sharp로 양쪽 GIF 전체 `96` frame을 디코딩해 `998×612`, alpha min/max `255/255`를 확인했다.
- OK — 첫 frame 네 모서리는 다크 `rgba(24,24,24,255)`, 라이트 `rgba(243,245,247,255)`이며 라이트 상단 outline은 `rgba(208,215,222,255)`다.
- OK — Stage 1 attachment PNG 대비 첫 frame 내부 RGB는 다크 `RMSE 0.727 / 최대 delta 25`, 라이트 `RMSE 0.826 / 최대 delta 27`로 카드 geometry와 내용 배치를 보존했다.
- OK — golden Beam SHA-256은 다크 `aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680`, 라이트 `1a1368c9b9c36e234fea3da7305da62565594c824c2261e9feb1aab988b76d1c`로 기준값과 동일하다.
- OK — `git diff --check` 경고 없음.

대표 시제품:

- `/private/tmp/task150-stage2/attachment-dark.gif`
- `/private/tmp/task150-stage2/attachment-light.gif`

## 잔여 위험

- X가 실제 업로드 후 적용하는 재인코딩·border radius는 저장소 자동화 범위 밖이므로 최종 첨부 확인은 작업지시자의 수동 검수가 필요하다.
- 전체 Node·Playwright·Sites production artifact 회귀와 공개 사용자 문서 갱신은 Stage 3에 남아 있다.

## 다음 단계 영향

- Stage 3에서는 이번 단계의 출력 계약이나 motion을 바꾸지 않고 Share Studio 통합 흐름, stable PNG·OG 분리 계약, 공식 사용자 문서와 전체 회귀만 마감한다.
- Stage 2의 다크·라이트 GIF 시각·motion 승인을 받은 뒤에만 Stage 3로 진입한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3으로 진행한다.
