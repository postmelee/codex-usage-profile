# Task M100 #35 Stage 2 보고서

GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
구현계획서: [`task_m100_35_impl.md`](../plans/task_m100_35_impl.md)
Stage: 2

> **계획 변경 상태 — 2026-08-02**
>
> 이 단계는 당시 승인된 Home/public card overlay 계획에 따라 완료되었으나,
> 작업지시자가 card tooltip을 제거하고 owner/public Profile 52주 heatmap으로
> 이동하는 변경안 A를 승인했다. 구현·검증 기록은 보존하며 overlay와 관련
> integration은 Stage 3에서 최종 제품 범위에서 제거한다.

## 단계 목적

Stage 1에서 고정한 card heatmap geometry와 tooltip pure contract를 실제 카드 위의
재사용 overlay로 구현했다. Home의 owner/operator/sample source와 공개 Profile이
현재 화면에 표시하는 카드 데이터에만 overlay를 연결하고 hover, roving keyboard,
touch toggle 및 card·viewport 경계 placement를 제공했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/CardHeatmapOverlay.jsx` | 26×7 transparent grid, roving focus, hover·keyboard·touch 상태, tooltip 측정·배치 구현 |
| `src/profile-ui/HomePage.jsx` | 보이는 owner/operator/anonymous sample source의 daily bucket만 overlay에 연결하고 loading·no-usage·Share Studio에서 제거 |
| `src/profile-ui/PublicProfilePage.jsx` | 공개 카드 image와 overlay를 동일 ratio wrapper에 합성하고 공개 usage만 사용 |
| `src/profile-ui/__tests__/publicProfileRoutes.test.js` | 공개 profile route가 실제 daily bucket 구조를 보존하는 fixture로 강화 |
| `src/styles.css` | transparent cell, focus-visible, tooltip layer·100ms feedback, reduced-motion과 public wrapper 스타일 추가 |
| `tests/profile-ui.spec.js` | owner hover·keyboard, operator source, loading/no-usage, public touch·outside close E2E 추가 |

## 본문 변경 정도 / 본문 무손실 여부

기존 PNG와 native/Worker renderer, card source transition, Share Studio, API·route,
D1/R2와 배포 설정은 변경하지 않았다. overlay는 PNG를 다시 그리지 않고 완성된
card 위에 투명한 상호작용 영역만 추가한다. authenticated no-usage sample에는
tooltip을 만들지 않으며 operator profile 조회 실패도 기존 card fallback을 막지 않는다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/cardHeatmapTooltip.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js
npm run test:e2e -- --grep "heatmap tooltip"
npm run build
git diff --check
```

추가 인접 회귀 확인:

```bash
npm run test:e2e -- --grep "Home shows the signed-in|Home card transition decodes the anonymous operator|public profile renders the API-backed"
```

결과:

- OK — tooltip helper와 public profile route unit test 12건 통과
- OK — owner hover·keyboard, operator data, loading/no-usage, public touch E2E 4건 통과
- OK — 기존 owner/operator/public card 인접 회귀 E2E 3건 통과
- OK — Vite production build 성공, 1,816 modules transformed
- OK — `git diff --check` 오류 없음

## 잔여 위험

- 전체 Home/public/Share Studio 회귀와 `ko` locale, reduced-motion, short viewport,
  transformed tilt·glare 조합은 Stage 3 전체 E2E에서 확정한다.
- Sites production artifact는 Stage 3에서 검증하며 이 Stage에서는 배포하지 않았다.

## 다음 단계 영향

- Stage 3는 `.card-heatmap-overlay`, `.card-heatmap-cell`,
  `.card-heatmap-tooltip`을 기준으로 전체 source matrix와 horizontal overflow를 검증한다.
- source가 바뀌면 interaction의 `sourceKey`가 일치하지 않아 이전 tooltip을 즉시
  숨기며, effect에서 focus와 placement 상태도 초기화된다.
- tooltip motion은 corporate 성격의 100ms entrance만 사용하고
  `prefers-reduced-motion`에서는 제거한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3로 진행한다.
