# Task #55 Stage 3.2 보고서

GitHub Issue: [#55](https://github.com/postmelee/codex-usage-profile/issues/55)
구현계획서: [`task_m100_55_impl.md`](../plans/task_m100_55_impl.md)
Stage: 3.2

## 단계 목적

Stage 3.1 시각 확인에서 제안된 실제 card header와 skeleton header의 차이를
보완한다. 실제 renderer와 같은 neutral avatar geometry와 identity text
위치를 사용하고, 사용자별 정보가 아닌 고정 `Codex` brand는 loading
중에도 같은 위치·크기로 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_55.md` | Stage 3.2 고정 header skeleton 보완 범위와 위험 대응을 기록했다. |
| `mydocs/plans/task_m100_55_impl.md` | neutral avatar, identity placeholder, 고정 brand와 exact 검증 계약을 추가했다. |
| `src/profile-marketing/MarketingLanding.jsx` | avatar 원형, display name/username placeholder와 고정 `Codex` brand 구조를 추가했다. |
| `src/styles.css` | renderer 기준 header geometry와 brand/shimmer layer 순서를 구현했다. |
| `tests/profile-ui.spec.js` | header 구조, identity 부재, exact geometry, brand color와 layer 검증을 추가했다. |
| `mydocs/orders/20260731.md` | Task #55를 Stage 3.2 완료·Stage 4 승인 대기로 기록했다. |
| `mydocs/working/task_m100_55_stage3_2.md` | Stage 3.2 산출물과 검증 결과를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. Home의 session,
profile, preload/decode와 fallback 상태 머신, public profile route, Share
Studio, backend와 Sites linkage는 변경하지 않았다.

skeleton의 avatar는 실제 image나 initial 없이 `#2f2f2f` 중립 원형만
표시하고 display name/username은 text 없는 두 줄 placeholder로 유지한다.
고정 `Codex` brand만 skeleton의 `aria-hidden` 경계 안에서 표시하므로
accessible tree와 loading surface에 owner identity 또는 usage payload가
추가되지 않는다.

## 검증 결과

실행 명령:

```bash
npm run test:e2e -- --grep "Home card transition"
npm run test:e2e -- --grep "Home"
git diff --check
```

결과:

- OK — Home card transition E2E 10건 통과.
- OK — Home과 Share Studio 관련 E2E 27건 통과.
- OK — neutral avatar가 renderer 기준 `x=36`, `y=36`, `44×44` 비율과
  원형 border radius를 유지한다.
- OK — display name과 username placeholder가 renderer의 `x=96` 시작점에
  있고 두 placeholder 모두 text가 없다.
- OK — `Codex` 1개가 renderer 기준 `x=439.5`, 최대 폭 57의 center와
  secondary color를 유지하며 독립 animation이 없다.
- OK — brand layer `z-index: 2`, shimmer layer `z-index: 1`로 고정
  glyph 위에 shimmer가 통과하지 않는다.
- OK — skeleton 전체가 `aria-hidden="true"`이고 실제 avatar, owner
  identity, usage 값이 markup에 없다.
- OK — 기존 26×7 heatmap 182개, stat 4개와 single shimmer 계약을
  유지한다.
- OK — desktop 1280×900, mobile 390×844, reduced-motion loading/ready
  screenshot을 비교했다. header 정렬, card/quickstart layout과 overflow
  회귀가 없다.
- OK — reduced-motion에서 shimmer와 crossfade가 제거되는 기존 계약을
  유지했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- 전체 unit/build, Sites production artifact, public release scanner와 전체
  E2E 통합 회귀는 Stage 4에서 최종 확인한다.
- production Site version, 배포, 접근 권한, 환경 변수와 D1/R2 linkage는
  이번 Stage에서 변경하지 않았다.

## 다음 단계 영향

- Stage 4는 확정된 header/heatmap/stats skeleton 구조를 유지하면서 전체
  Home/public profile/Share Studio E2E, browser storage, build와 Sites
  artifact를 검증한다.
- `.openai/hosting.json` 무변경과 production deploy 제외 경계를
  재확인한다.

## 승인 요청

- Stage 3.2 산출물과 검증 결과를 승인하면 Stage 4 — Sites artifact와
  통합 시각 QA로 진행한다.
