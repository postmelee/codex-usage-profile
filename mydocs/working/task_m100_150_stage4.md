# Task #150 Stage 4 보고서 — SNS-native PNG와 X 기준 GIF 경계 보완

GitHub Issue: [#150](https://github.com/postmelee/codex-usage-profile/issues/150)
구현계획서: [`task_m100_150_impl.md`](../plans/task_m100_150_impl.md)
Stage: 4

## 단계 목적

Stage 1~3 배포 후보를 X와 Reddit에 직접 첨부한 뒤 확인된 파일 내부 경계와 플랫폼 clipping의 중첩을 보완했다. 라이트 Save PNG에서는 별도 surface outline과 attachment radius를 제거해 플랫폼이 최종 clipping을 소유하게 하고, GIF에서는 기존 움직임·색상·타이밍을 유지하면서 effect perimeter만 X 표시 반경에 맞췄다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/attachment-canvas.js` | dark/light 투명 모서리를 각 카드 배경 `#181818`/`#FFFFFF`로 채우고 attachment outline stroke 제거 |
| `src/profile-card/gif-animation.js` | X 전용 effect 반경을 logical 16px/output 32px로 분리하고 export preset v4 적용 |
| `src/profile-card/gif-beam-frames.js` | radius 32로 독립 캡처한 dark/light Chrome golden v2 선택 |
| `src/profile-card/assets/ocean-beam-x-radius-v2.rgba-runs.bin` | 기존 dark preset·96 phase를 유지한 X 반경 effect layer |
| `src/profile-card/assets/ocean-light-keyline-x-radius-v2.rgba-runs.bin` | 기존 light 대비 preset·96 phase를 유지한 X 반경 effect layer |
| `src/profile-card/__tests__/attachment-canvas.test.js` | 라이트 corner·상단 중앙 `#FFFFFF`, outline null과 내부 geometry 무변경 검증 |
| `src/profile-card/__tests__/gif-animation.test.js` | preset v4·radius 32와 procedural perimeter·phase·seam 회귀 |
| `src/profile-card/__tests__/gif-beam-frames.test.js` | golden SHA, 양쪽 theme 사분면·seam, radius 32 판별 픽셀과 bounded loader 검증 |
| `src/profile-card/__tests__/gif-encoder.test.js` | radius 32 edge palette 품질 기준 갱신 |
| `src/profile-ui/__tests__/pngExport.test.js` | 실제 light PNG corner `#FFFFFF`와 opaque 출력 검증 |
| `src/profile-ui/__tests__/gifExport.test.js` | preset v4·light white base·dark/light/locale 실제 GIF 출력 검증 |
| `tests/profile-ui.spec.js` | light Save PNG의 플랫폼-native 무경계 다운로드 계약 검증 |
| `docs/readme-card.md` | Save PNG의 무경계 표면과 GIF의 X 32px 최적화·Reddit best-effort 경계 명시 |
| `mydocs/plans/task_m100_150.md` | 실제 SNS 검수에 따른 Stage 4 범위·리스크·승인 기록 |
| `mydocs/plans/task_m100_150_impl.md` | Stage 4 산출물·검증·커밋 계획 추가 |
| `mydocs/orders/20260902.md` | Stage 4 완료와 시제품 승인 대기 상태 반영 |

이전 radius 64용 `ocean-beam-golden-v1.rgba-runs.bin`과 `ocean-light-keyline-golden-v1.rgba-runs.bin`은 v4에서 참조되지 않아 제거했다. Git 이력에서는 복구할 수 있다.

## 본문 변경 정도 / 본문 무손실 여부

- stable `/u/{handle}/card.png`, Open Graph `/u/{handle}/social.png`, 라이브 `MarketingCardPreview`와 카드 내부 layout·typography·palette는 변경하지 않았다.
- source 이미지는 계속 `0,0,998,612`에 그려져 padding, crop, translation, content scale과 `499:306` 비율이 유지된다.
- 모션은 기존 96개 phase, 20fps, frame delay 50ms, 4.8초, 무한 반복과 dark/light 색상·opacity preset을 유지한다. Chrome 캡처의 border radius만 CSS 32px에서 16px로 바꿔 출력 반경을 64px에서 32px로 조정했다.
- PNG에는 정적 border 또는 radius를 추가하지 않는다. GIF에만 움직이는 effect perimeter 32px가 있으며 X의 표시 clipping과 정렬하는 목적이다.
- `motion-design` 검토에 따라 신규 움직임·easing·추가 layer를 만들지 않고 기존 ambient perimeter loop의 속도와 시각 서사를 보존했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/attachment-canvas.test.js src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/pngExport.test.js src/profile-ui/__tests__/gifExport.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #150|Share Studio.*PNG|GIF"
npm run build:production
git diff --check
```

결과:

- OK — 집중 Node 44/44 통과.
- OK — Share Studio Chromium E2E 7/7 통과. desktop dark/light PNG, GIF 생성·저장·실패·재시도·취소와 mobile PNG-only 경계를 확인했다.
- OK — production build 통과: server 63 modules, client 1841 modules. v2 golden asset은 dark 2,368,640 bytes, light 2,793,151 bytes로 포함됐다.
- OK — `npm run verify:sites-production`: `artifactBytes=10638208`, client 15 files, worker 2 files, bindings 3, migrations 6.
- OK — stable renderer, social renderer와 라이브 `MarketingLanding.jsx`는 기준 commit `e5eb6c6` 대비 diff가 없다.
- OK — `git diff --check` 경고 없음.

시제품:

| 파일 | 크기 | 검증 요약 |
|---|---:|---|
| `/private/tmp/task150-stage4/attachment-dark.png` | 109,360 bytes | 998×612, alpha 255, corner `#181818`, 정적 border 없음 |
| `/private/tmp/task150-stage4/attachment-light.png` | 102,081 bytes | 998×612, alpha 255, corner·상단 중앙 `#FFFFFF`, 정적 border 없음 |
| `/private/tmp/task150-stage4/attachment-dark.gif` | 6,186,701 bytes | 998×612, 96 frames, opaque, X radius 32 effect |
| `/private/tmp/task150-stage4/attachment-light.gif` | 5,973,842 bytes | 998×612, 96 frames, opaque, X radius 32 light effect |

golden 고정값:

- dark SHA-256: `93025a7294a4af8ef481f8723a5639aef1b328b39d1f6186f65462fbdbd08e1a`
- light SHA-256: `bb77b1f9484db082319707ff8037e8929082d5c13ec8021f22c5e1dbb03a358d`
- dark frame 95→0 delta / frame 0→1 delta: `0.975`, 기존 seamless 허용 범위 `0.95~1.05` 충족
- 양쪽 golden에서 `(0,0)`과 `(5,5)`는 effect alpha 0이고 `(9,10)`과 `(32,0)`에는 한 주기 중 effect가 나타나 radius 64가 아닌 radius 32 경로임을 확인

## 잔여 위험

- 하나의 GIF가 X의 rounded clipping과 Reddit의 square clipping에 동시에 정확히 맞을 수 없다. 이번 결과는 승인된 대로 X를 canonical로 하고 Reddit은 best-effort로 둔다.
- 로컬 시제품은 파일 자체 계약과 Chromium 다운로드까지 검증했다. X compose의 최종 시각 결과는 작업지시자가 시제품을 직접 첨부해 확인해야 한다.

## 다음 단계 영향

- Stage 4 시제품 승인 후 모든 Stage 결과를 반영한 최종 보고서와 PR 게시 절차로 진행한다.
- 시제품에서 X 곡률이 다시 다르게 관측되면 최종 보고 전에 Stage 4 안에서 effect radius만 재조정한다. PNG surface, 카드 geometry와 stable/OG 계약은 재변경하지 않는다.

## 승인 요청

- Stage 4 산출물과 검증 결과, 라이트 PNG 무경계 처리 및 X radius 32 GIF 시제품을 승인하면 최종 보고와 PR 단계로 진행한다.
