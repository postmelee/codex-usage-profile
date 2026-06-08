# Task M100 #3 Stage 4.2 완료 보고

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)  
대상 화면: `http://127.0.0.1:5173/u/meleeisdeveloping`

## 목적

모바일 breakpoint로 전환되기 전의 중간 폭에서 heatmap cell 간격이 비정상적으로 압축되는 문제를 수정한다. 또한 최신 사용량이 오른쪽 끝에 있으므로, overflow가 발생하는 폭에서는 기본 표시 위치를 오른쪽 끝으로 맞춘다.

## 원인

기존 heatmap은 `grid-auto-columns: minmax(0, 1fr)`를 사용했다. 52개 주 column이 container 폭을 나눠 갖는 구조라, chart 실제 폭이 안정적인 최소 폭보다 작아지는 순간 cell이 가로로 압축됐다.

기존 모바일 처리는 `@media (max-width: 760px)`에서만 `min-width: 820px`와 horizontal scroll을 적용했기 때문에, 760px보다 큰 중간 폭에서는 scroll 모드가 켜지지 않고 grid만 압축됐다.

## 변경 사항

- heatmap cell size를 `13px`, gap을 `3px`로 고정했다.
- heatmap 전체 폭을 `52 * 13px + 51 * 3px = 829px`로 계산해 CSS 변수 `--heatmap-width`로 전달한다.
- grid와 month label이 같은 fixed width를 사용하도록 정리했다.
- `.token-grid-wrap`이 모든 폭에서 horizontal overflow를 담당하도록 변경했다.
- overflow가 발생하면 초기 렌더와 mode 변경 시 scroll 위치를 오른쪽 끝으로 맞춘다.
- native scrollbar는 숨겨 원본과 다른 시각적 bar가 label을 덮지 않게 했다.
- e2e에 900px 중간 폭 geometry 회귀 테스트를 추가했다.

## 검증

| 항목 | 결과 | 비고 |
|---|---:|---|
| `npm test` | PASS | 22 tests pass |
| `npm run build` | PASS | Vite production build |
| `npm run test:e2e` | PASS | 5 tests pass. sandbox listen 제한으로 escalated 실행 |
| `git diff --check` | PASS | whitespace issue 없음 |
| Browser/IAB 확인 | PASS | 900x982 viewport, fixed geometry와 오른쪽 기본 scroll 확인 |

## Browser/IAB 확인 메모

- 작은 desktop/tablet viewport: `900x982`
- cell width/height: `13px / 13px`
- row/column gap: `3px / 3px`
- heatmap grid width: `829px`
- month labels width: `829px`
- wrapper width: `730px`
- max scrollLeft: `99`
- initial scrollLeft: `99`
- scrollbar style: `none`

검증 screenshot:

- `/private/tmp/codex-usage-profile-stage4-2-tablet-heatmap-clean.png`

## 잔여 리스크

- horizontal scroll 자체는 유지하되 scrollbar를 숨겼다. 최신 구간을 기본 표시하므로 일반 조회 흐름에는 맞지만, 과거 구간 탐색 가능성을 더 명확히 보여주는 UI는 후속 polish에서 별도 판단할 수 있다.
