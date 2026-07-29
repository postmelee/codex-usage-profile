# Task M100 #38 Stage 2 완료 보고

GitHub Issue: [#38](https://github.com/postmelee/codex-usage-profile/issues/38)
구현계획서: [`task_m100_38_impl.md`](../plans/task_m100_38_impl.md)
Stage: 2

## 단계 목적

Home의 실제 카드와 전체 화면 Share Studio의 중앙 카드를 하나의 연속된
대상처럼 보이게 하는 shared-card motion을 구현했다. 첨부 이미지의 desktop
구도를 기준으로 강한 dim/blur, 중앙 title/card/action column, 우측 상단 close와
네 개 원형 primary action을 정렬하고, 기존 기능은 낮은 대비 secondary row로
축약했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-marketing/MarketingLanding.jsx` | 선택형 source card ref와 transition suspension 경계를 추가하고, 공유 중 tilt와 Border Beam의 동작을 정지했다. 기본 marketing caller는 새 prop 없이 기존 동작을 유지한다. |
| `src/profile-ui/HomePage.jsx` | Share click 직전 source card rect를 snapshot하고 source ref/rect를 Studio에 전달하며, close 뒤 상태를 정리한다. |
| `src/profile-ui/ShareStudio.jsx` | source/target rect 기반 FLIP open·close, invalid source target-fade fallback, 중복 close 방어와 completion fallback timer를 구현했다. |
| `src/styles.css` | source decoration crossfade, staged scrim/title/action reveal, compact secondary row, close transition과 reduced-motion fade를 추가했다. |
| `tests/profile-ui.spec.js` | source layout 무손실, FLIP origin, transform/opacity 전용 keyframe, 중복 Escape, tilt 복구와 1280×900·1512×982 구도를 검증했다. |
| `mydocs/orders/20260729.md` | Stage 2 완료와 Stage 3 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기본
`MarketingLanding`/Sites caller는 신규 prop을 전달하지 않아 기존 카드 tilt와
Border Beam 동작이 유지된다. Home의 source card는 공유 중에도 layout 자리를
보존하며 opacity만 교차 전환한다. 기존 provider 공유, Image URL/README 복사,
PNG 저장, 비공개 전환과 modal focus lifecycle은 유지했다.

## 검증 결과

실행 명령:

```bash
npm run build
npm run test:e2e -- --grep "Share"
git diff --check
```

결과:

- OK — Vite production build 성공, 39 modules transformed.
- OK — Share 관련 Playwright E2E 12개 통과, 실패 0개.
- OK — `git diff --check` 출력 없음.
- OK — 1280×900에서 source card rect가 공유 중에도 0.75px 허용 범위 안에서
  유지되고, motion origin이 `source`이며 keyframe property가
  `transform`/`opacity`로 제한됨을 확인했다.
- OK — 1512×982에서 title/card/action 중심축 오차 1px 이하, card
  600×367.9px, title → card → action 순서와 우측 상단 close 위치를 확인했다.
- OK — settled desktop screenshot 2종을 첨부 이미지와 직접 비교해 strong
  dim/blur, 중앙 column, 원형 action과 compact secondary row 구도를 확인했다.
- OK — 중복 Escape 중 close/focus 복구가 한 번만 완료되고, source tilt가
  다시 활성화됨을 확인했다.

## 잔여 위험

- mobile·short viewport와 reduced-motion의 상세 회귀 및 source 없음·0-size·
  image failure 시나리오는 Stage 3에서 전용 검증을 추가해야 한다.
- source와 target 이미지가 네트워크 지연으로 서로 다른 시점에 decode되는
  경우의 placeholder 품질은 Stage 3 failure 검증에서 확인해야 한다.

## 다음 단계 영향

- Stage 3는 현재 desktop motion과 구도를 변경하지 않고 responsive spacing,
  short viewport scroll, reduced-motion의 공간 이동 제거와 failure fallback을
  고정해야 한다.
- 현재 FLIP 구현은 invalid rect 또는 detached source를 자동으로 target fade로
  낮추므로 Stage 3는 해당 fallback을 E2E로 증명하는 데 집중할 수 있다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3로 진행한다.
