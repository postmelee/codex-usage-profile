# Task M100 #35 Stage 1 보고서

GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
구현계획서: [`task_m100_35_impl.md`](../plans/task_m100_35_impl.md)
Stage: 1

## 단계 목적

카드 PNG 위에 동일한 위치의 상호작용 영역을 배치할 수 있도록 native canvas와
Sites Worker SVG renderer가 공유하는 heatmap geometry를 단일 계약으로 분리했다.
다음 Stage의 overlay가 사용할 locale별 tooltip 문자열, column-major keyboard 이동,
card·viewport 경계 placement 계산도 DOM과 분리된 pure helper로 고정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/geometry.js` | logical card와 26×7 heatmap bounds, cell 좌표·percentage 계산 계약 추가 |
| `src/profile-card/heatmap.js` | 기존 count export를 유지하면서 geometry 상수를 재사용하도록 변경 |
| `src/profile-card/renderer.js` | native canvas heatmap이 공유 geometry를 사용하도록 변경 |
| `src/profile-card/worker-renderer.js` | Worker SVG heatmap이 공유 geometry를 사용하도록 변경 |
| `src/profile-card/index.js` | 웹 UI가 geometry 상수와 helper를 사용할 수 있도록 공개 export 추가 |
| `src/profile-card/__tests__/geometry.test.js` | card/heatmap 불변값, 첫·마지막 cell, 잘못된 좌표 검증 추가 |
| `src/profile-card/__tests__/renderer.test.js` | native renderer pixel 검증을 공유 cell 중심 좌표에 연결 |
| `src/profile-card/__tests__/worker-renderer.test.js` | Worker SVG의 182개 cell과 첫·마지막 좌표 검증 추가 |
| `src/profile-ui/cardHeatmapTooltip.js` | data availability, UTC locale 포맷, keyboard 이동, tooltip placement helper 추가 |
| `src/profile-ui/__tests__/cardHeatmapTooltip.test.js` | `en`/`ko`, 0·단수 token, 이동 경계, placement clamp·fallback 검증 추가 |

## 본문 변경 정도 / 본문 무손실 여부

기존 카드 크기, heatmap 좌표·색상·cell 수와 native/Worker 출력 계약을 유지했다.
renderer version, static sample asset, API·route·저장소·배포 설정은 변경하지 않았다.
새 tooltip helper는 아직 화면에 연결하지 않아 사용자 동작 변화가 없다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/geometry.test.js src/profile-card/__tests__/heatmap.test.js
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-ui/__tests__/cardHeatmapTooltip.test.js
npm run build
git diff --check
```

결과:

- OK — geometry·heatmap unit test 6건 통과
- OK — native canvas·Worker SVG renderer test 7건 통과
- OK — tooltip formatting·navigation·placement unit test 8건 통과
- OK — Vite production build 성공, 1,809 modules transformed
- OK — `git diff --check` 오류 없음

## 잔여 위험

- 실제 DOM overlay와 tooltip 측정·배치는 Stage 2 범위이므로 browser interaction은
  아직 검증하지 않았다.
- hover, keyboard, touch와 transformed card 경계 동작은 Stage 2 focused E2E 및
  Stage 3 통합 QA에서 검증한다.

## 다음 단계 영향

- Stage 2 overlay는 `getCardHeatmapCellGeometry`의 percentage 좌표를 사용해 PNG와
  같은 좌표계에 182개 interaction target을 배치한다.
- 최초 keyboard focus는 고정 상수가 아니라 현재 `heatmap.todayIso`와 일치하는
  cell을 실제 데이터에서 선택해야 한다.
- daily bucket이 비어 있으면 `hasCardHeatmapData` 결과에 따라 overlay를 만들지
  않아야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
