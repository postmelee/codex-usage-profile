# Task M100 #3 Stage 4.3 완료 보고

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)  
대상 화면: `http://127.0.0.1:5173/u/meleeisdeveloping`

## 목적

Stage 4.2에서 중간 폭 heatmap 압축을 막기 위해 grid 폭을 `829px`로 고정했으나, 전체화면에서는 원본 Codex 프로필보다 heatmap이 좁아 보이는 회귀가 생겼다. 좁은 화면의 minimum geometry와 오른쪽 기본 scroll은 유지하면서, 넓은 화면에서는 heatmap이 profile content 폭을 채우도록 보정한다.

## 원인

Stage 4.2의 `13px` cell + `3px` gap 고정 계산은 `52 * 13px + 51 * 3px = 829px`을 모든 viewport에 적용했다. 이 방식은 900px 전후 중간 폭에서는 cell 압축을 막지만, profile stage가 `880px`까지 확보되는 desktop에서는 grid가 남는 폭을 사용하지 않아 시각적으로 작아 보였다.

## 변경 사항

- heatmap cell size를 `13px` minimum, `16px` maximum 범위로 clamp한다.
- `ResizeObserver`로 `.token-grid-wrap`의 실제 폭을 측정하고, 사용 가능한 폭에서 gap 총합을 제외한 값을 52개 column에 분배한다.
- wrapper가 좁으면 기존처럼 `13px` cell과 `829px` grid minimum을 유지해 horizontal overflow를 발생시킨다.
- wrapper가 넓으면 cell size를 키워 grid와 month label width가 wrapper 폭에 가깝게 확장되도록 했다.
- CSS의 고정 `--heatmap-cell-size` 선언을 fallback 변수로 바꿔 React에서 계산한 CSS 변수가 실제 grid/cell 크기에 반영되게 했다.
- e2e desktop 테스트에 heatmap이 wrapper 폭까지 확장되고 desktop horizontal scroll이 생기지 않는 검증을 추가했다.

## 검증

| 항목 | 결과 | 비고 |
|---|---:|---|
| `npm test` | PASS | 22 tests pass |
| `npm run build` | PASS | Vite production build |
| `npm run test:e2e` | PASS | 5 tests pass. sandbox listen 제한으로 escalated 실행 |
| `git diff --check` | PASS | whitespace issue 없음 |
| Browser/IAB 900px 확인 | PASS | 기존 minimum geometry와 오른쪽 기본 scroll 유지 |
| Browser/IAB 1512px 확인 | PASS | desktop에서 wrapper 폭까지 heatmap 확장 |

## Browser/IAB 확인 메모

중간 폭 viewport: `900x982`

- cell width/height: `13px / 13px`
- row/column gap: `3px / 3px`
- heatmap grid width: `829px`
- wrapper width: `730px`
- max scrollLeft: `99`
- initial scrollLeft: `99`
- document horizontal overflow: 없음

Desktop viewport: `1512x982`

- cell width/height: `13.98px / 13.98px`
- row/column gap: `3px / 3px`
- heatmap grid width: `879.95px`
- wrapper width: `880px`
- max scrollLeft: `0`
- document horizontal overflow: 없음
- mode interaction: `Daily -> Weekly -> Daily` 정상 전환
- console warning/error: 없음

## 잔여 리스크

- desktop 확장 상한은 `16px`로 제한했다. 현재 profile stage 최대 폭(`880px`)에서는 wrapper 폭에 맞게 확장되지만, 향후 profile stage 자체가 더 넓어질 경우 Codex 원본과의 비율을 다시 조정할 수 있다.
