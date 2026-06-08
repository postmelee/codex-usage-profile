# Task M100 #3 Stage 4.1 완료 보고

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)  
대상 화면: `http://127.0.0.1:5173/u/meleeisdeveloping`

## 목적

작은 반응형 화면에서 heatmap 오른쪽 끝 cell hover 시 tooltip이 scroll container 또는 viewport 경계에 의해 잘리는 문제를 수정한다.

## 원인

기존 구조는 각 `.token-cell` 내부에 `.token-tooltip`을 absolute로 렌더링했다. 모바일에서는 `.token-grid-wrap`에 `overflow-x: auto`가 적용되므로, tooltip이 cell 기준으로 떠도 scroll container 밖으로 나가는 영역이 잘릴 수 있었다.

첨부 동영상에서 추출한 프레임에서도 오른쪽 끝 cell tooltip의 우측 문구가 잘리는 현상을 확인했다.

## 변경 사항

- `TokenActivityChart`에서 cell 내부 tooltip을 제거했다.
- hover/focus된 cell의 `getBoundingClientRect()`를 기준으로 section 레벨 floating tooltip 하나를 렌더링한다.
- tooltip은 `position: fixed`로 렌더링하고, 실제 tooltip 크기 측정 후 viewport 안쪽으로 좌우 clamp한다.
- 상단 공간이 부족하면 cell 아래쪽으로 표시하고, 하단도 viewport 안쪽으로 clamp한다.
- resize/scroll 시 tooltip을 숨겨 stale position을 피한다.
- Playwright e2e에 모바일 오른쪽 끝 cell hover clipping 회귀 테스트를 추가했다.

## 검증

| 항목 | 결과 | 비고 |
|---|---:|---|
| `npm test` | PASS | 22 tests pass |
| `npm run build` | PASS | Vite production build |
| `npm run test:e2e` | PASS | 4 tests pass. sandbox listen 제한으로 escalated 재실행 |
| `git diff --check` | PASS | whitespace issue 없음 |
| Browser/IAB 확인 | PASS | 390x844 viewport, 오른쪽 끝 cell focus tooltip viewport 내부 표시 |

## Browser/IAB 확인 메모

- Page identity: `Codex Usage Profile`, `/u/meleeisdeveloping`
- Console warning/error: 없음
- 작은 viewport: `390x844`
- 오른쪽 끝 cell tooltip: `158M tokens on Jun 6`
- tooltip rect: left `214.93`, right `382.07`, viewport width `390`
- 결과: viewport 내부 표시 확인

검증 screenshot:

- `/private/tmp/codex-usage-profile-mobile-tooltip-focus-fixed.png`
- `/private/tmp/codex-usage-profile-mobile-tooltip-fixed.png`

## 잔여 리스크

- Browser/IAB 자동화에서 pointer move만으로 hover 이벤트가 잡히지 않아, in-app browser 시각 검증은 같은 positioning 경로를 타는 focus 이벤트로 확인했다.
- 실제 hover 경로는 `npm run test:e2e`의 Playwright hover 테스트에서 검증했다.
