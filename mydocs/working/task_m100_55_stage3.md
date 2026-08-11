# Task #55 Stage 3 보고서

GitHub Issue: [#55](https://github.com/postmelee/codex-usage-profile/issues/55)
구현계획서: [`task_m100_55_impl.md`](../plans/task_m100_55_impl.md)
Stage: 3

## 단계 목적

Home 카드의 비동기 전환 동안 이전 카드 내용과 identity가 보이지 않도록
불투명한 neutral skeleton을 제공한다. loading/ready/fallback 상태를
접근성 속성과 연결하고, Corporate motion 기준의 낮은 대비 shimmer와
240ms opacity 전환을 적용하되 reduced-motion에서는 모든 loading motion을
제거한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-marketing/MarketingLanding.jsx` | card box 내부 skeleton veil, polite loading status와 loading 중 tilt/beam 정지를 추가했다. |
| `src/profile-ui/HomePage.jsx` | Home 카드에 영문 loading status label을 전달했다. |
| `src/styles.css` | 불투명 neutral skeleton shape와 shimmer/crossfade를 구현하고 reduced-motion 정적 표현을 추가했다. 기존 card spatial reveal은 box 불변 계약을 위해 제거했다. |
| `tests/profile-ui.spec.js` | desktop loading/ready/fallback, mobile layout, reduced-motion과 접근성 상태를 자동 측정하고 screenshot 검증을 추가했다. |
| `mydocs/orders/20260730.md` | Task #55를 Stage 3 완료·Stage 4 승인 대기로 갱신했다. |
| `mydocs/working/task_m100_55_stage3.md` | Stage 3 산출물과 검증 결과를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 Home 카드의
API, backend, public profile route, Share Studio source ref와 카드 비율은
변경하지 않았다. loading 상태에서는 skeleton이 기존 픽셀을 완전히
가리고 ready/fallback에서만 실제 source를 보여 준다. 이전 spatial reveal은
loading/ready 간 card box 이동을 유발해 제거했으며, 의도한 opacity 전환만
유지했다.

## 검증 결과

실행 명령:

```bash
npm run test:e2e -- --grep "Home card transition"
npm run test:e2e -- --grep "Home"
git diff --check
```

결과:

- OK — Home card transition E2E 10건 통과.
- OK — Home 관련 E2E 27건 통과.
- OK — desktop 1280×900의 loading, ready, fallback screenshot을 비교해
  불투명 skeleton과 identity 비노출을 확인했다.
- OK — mobile 390×844에서 horizontal overflow가 없고 loading/ready card와
  quickstart 위치 오차가 1px 이하임을 확인했다.
- OK — reduced-motion에서 skeleton pseudo-element의 animation이 `none`,
  opacity transition duration이 `0s`, tilt가 비활성 상태임을 확인했다.
- OK — loading에서 `aria-busy="true"`와 polite
  `Loading card preview` status가 제공되고 ready에서 해제됨을 확인했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- 전체 Home/public profile/Share Studio 회귀, production Sites build와
  artifact verifier, public release scanner는 Stage 4에서 최종 검증한다.
- production Site version, 배포, 접근 권한, 환경 변수와 D1/R2 linkage는
  이번 Stage에서 변경하지 않았다.

## 다음 단계 영향

- Stage 4는 확정된 skeleton/accessibility 계약을 유지하면서 전체 E2E,
  browser storage, root test, Sites production artifact와 release scanner를
  검증한다.
- `.openai/hosting.json` 무변경과 production deploy 제외 경계를 재확인한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 — Sites artifact와 통합
  시각 QA로 진행한다.
