# Task M100 #38 Stage 3 완료 보고

GitHub Issue: [#38](https://github.com/postmelee/codex-usage-profile/issues/38)
구현계획서: [`task_m100_38_impl.md`](../plans/task_m100_38_impl.md)
Stage: 3 (피드백 보정 3.3 포함)

## 단계 목적

Stage 2에서 확정한 desktop 구도와 shared-card motion을 유지하면서 mobile,
short viewport, reduced-motion과 실패 경계를 회귀 테스트로 고정했다.
390×844에서는 모든 공유 action을 가로 overflow 없이 배치하고 터치 대상을
44px 이상으로 유지했다. 1280×620과 720px 이하의 짧은 desktop에서는
available height에 따라 card를 축소하고 title, action, close와 toast가
겹치지 않도록 safe spacing을 적용했다.

`prefers-reduced-motion: reduce`에서는 FLIP, scale, translate, stagger와
backdrop blur를 제거하고 110~140ms opacity feedback만 유지했다. viewport
resize, invalid/detached source와 preview load failure는 spatial animation을
중단하고 target layout으로 settle한다. preview와 clipboard가 실패해도
provider link, stable Image URL/README action, PNG 저장과 close는 계속
사용할 수 있게 했다.
작업지시자 피드백에 따라 390px mobile의 primary action을 화면 폭 전체에
균등 분산하지 않고 60px column 4개와 12px gap으로 구성한 276px 그룹으로
중앙 정렬했다. 360px 이하에서는 같은 밀도의 2×2 fallback을 유지한다.
후속 피드백에서는 mobile 안내 panel의 시각적 요소가 desktop보다 커 보이는
문제를 보정했다. 제목·단계 text는 13px, action의 보이는 box는 28px로
축소하되 투명한 pseudo-element로 실제 button/link touch target은 44px를
유지했다. 후속 피드백으로 세 행 높이를 모두 32px, 행 gap을 12px로 맞춰
1→2와 2→3의 중심 간격을 동일한 44px로 고정하면서 panel 높이는 180px
이하로 유지했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ShareStudio.jsx` | reduced-motion opacity-only frame, resize/orientation target settle, invalid/detached source fallback과 preview error placeholder를 추가했다. |
| `src/profile-ui/shareStudio.js` | 영어·한국어 preview unavailable 안내 문구를 추가했다. |
| `src/profile-ui/__tests__/shareStudio.test.js` | preview unavailable copy의 영어 fallback 계약을 고정했다. |
| `src/styles.css` | mobile 44px touch target과 중앙 정렬 compact grid, short viewport card sizing/safe spacing, preview placeholder 및 opacity-only reduced-motion을 구현했다. 390px에서는 276px 폭의 4열 그룹을 사용하고, mobile 안내 panel의 13px text·28px visual action과 44px 확장 touch target을 분리했다. |
| `tests/profile-ui.spec.js` | mobile compact action 폭·card 중심축과 안내 panel 높이·font·visual/touch box, short/reduced geometry, resize·source detach·preview/clipboard failure, download, making-private guard와 focus/inert 복원을 검증했다. |
| `mydocs/plans/task_m100_38_impl.md` | 승인된 backdrop click 무시와 X/Escape 전용 close 계약을 공통·Stage 검증 항목에 반영했다. |
| `mydocs/orders/20260729.md` | Stage 3 완료와 Stage 4 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 1280×900과
1512×982 desktop layout, 정상 motion timing, provider allowlist,
Image URL/README copy, PNG 저장, 비공개 전환과 X/Escape close 계약은
유지했다. motion 접근성 보정은 사용자가 reduced-motion을 요청한 경우에만
적용되며 일반 환경의 Stage 2 animation에는 영향을 주지 않는다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/cardShare.test.js \
  src/profile-ui/__tests__/shareStudio.test.js
npm run build
npm run test:e2e -- --grep "Share"
npx playwright test tests/profile-ui.spec.js
git diff --check
```

결과:

- OK — card/share Node 단위 테스트 7개 통과, 실패 0개.
- OK — Vite production build 성공, 40 modules transformed.
- OK — 구현계획서의 Share focused Playwright E2E 18개 통과, 실패 0개.
- OK — profile UI Playwright E2E 23개 통과, 실패 0개.
- OK — `git diff --check` 출력 없음.
- OK — 390×844에서 primary action 4개와 secondary action의 hit target이
  모두 44px 이상이고 horizontal overflow가 없음을 확인했다.
- OK — 390×844 primary action group이 280px 이하의 compact 폭으로 card
  중심축과 1px 이내 정렬되며, 네 label과 원형 icon이 잘리지 않음을
  screenshot으로 확인했다.
- OK — mobile 안내 panel이 180px 이하, 제목과 action text가 13px,
  action visual box가 30px 이하로 렌더링되며 `::before` 상하 8px 확장으로
  44px touch target을 유지함을 확인했다.
- OK — mobile 안내 1·2·3번 행이 모두 32px이고 중심 간격이
  `[44px, 44px]`로 동일함을 geometry assertion과 screenshot으로 확인했다.
- OK — 1280×620 resize 직후 motion origin이 `target`으로 settle하고 card
  width가 600px 미만으로 축소되며 action, secondary row와 close가 viewport
  안에 남는 것을 확인했다.
- OK — reduced-motion에서 card motion과 모든 subtree keyframe에 유효한
  spatial transform이 없고 backdrop blur 및 action icon transition이
  제거되는 것을 확인했다.
- OK — preview load와 clipboard write가 실패해도 safe placeholder,
  provider 작성 창 link, Image URL failure status, PNG download와 close가
  유지되는 것을 확인했다.
- OK — invalid source geometry는 target fade로 낮아지고 source가 detach된
  close에서도 dialog unmount, Share trigger focus, inert와 body overflow가
  정확히 복구됨을 확인했다.
- OK — 비공개 전환 요청 중 action이 `Making private` disabled state로
  바뀌고 중복 mutation이 발생하지 않은 뒤 정상 종료됨을 확인했다.
- OK — mobile, short, reduced-motion, preview failure screenshot을 직접
  비교해 title/card/action/panel과 toast safe spacing을 확인했다.

## 잔여 위험

- 360px 이하에서는 primary action을 2×2 grid로 낮추지만 Stage 3 자동
  screenshot 기준은 계획서에 지정된 390×844까지만 수행했다.
- 실제 외부 provider의 UI와 popup 정책은 제어 범위 밖이므로 allowlisted
  origin/path/query, `_blank`와 `noopener noreferrer`까지만 검증했다.
- production Sites artifact와 실제 배포 환경의 시각 회귀는 Stage 4 통합
  검증 대상으로 남아 있다.

## 다음 단계 영향

- Stage 4는 현재 motion/responsive 값을 변경하지 않고 전체 test/build,
  production artifact와 공식 `docs/readme-card.md`의 실제 사용자 흐름을
  대조해야 한다.
- Stage 4 시각 QA에서는 desktop/wide/mobile/short/reduced/failure
  screenshot을 최종 수용 기준으로 사용한다.
- 원격 배포, Site version 저장과 access 변경은 구현계획서 범위 밖이므로
  수행하지 않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4로 진행한다.
