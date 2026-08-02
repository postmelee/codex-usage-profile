# Task M100 #35 Stage 4 보고서

GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
구현계획서: [`task_m100_35_impl.md`](../plans/task_m100_35_impl.md)
Stage: 4

## 단계 목적

Account Usage Contract v1의 실제 집계 데이터를 사용하는 재사용 Profile 영역을
owner `/profile`과 공개 Profile에 통합했다. identity와 summary stats 다음에 일별·주간·
누적 token activity를 배치하고, 기존 card preview·visibility·Share Studio는 독립된
card section으로 유지했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/AccountUsageProfile.jsx` | owner/public이 공유하는 identity, 5개 summary stat, token activity 구성 추가 |
| `src/profile-ui/TokenActivityChart.jsx` | canonical daily bucket 입력, 3개 mode, viewport 보정 tooltip, roving keyboard, touch toggle, 최근 주 scroll 구현 |
| `src/profile-ui/CardProfilePage.jsx` | 실제 owner usage Profile을 표시하고 기존 공개 설정·card preview·Share Studio를 별도 section으로 유지 |
| `src/profile-ui/PublicProfilePage.jsx` | 공개 payload만으로 identity, stats, token activity와 공개 card를 표시 |
| `src/profile-ui/publicProfileRoutes.js` | 공개 Profile의 UTC capturedAt과 Account Usage read result를 검증해 private·누락·손상 payload를 동일 unavailable 상태로 fail-close |
| `src/profile-ui/ProfileHeader.jsx`, `src/profile-ui/formatters.js` | 재사용 가능한 h1 identity와 Account Usage의 longest turn·streak 표기 지원 |
| `src/styles.css` | 52주 grid, mode별 week span, chart-only 가로 scroll, tooltip clamp motion과 reduced-motion, Profile card section 계층 구현 |
| `tests/profile-ui.spec.js`, `src/profile-ui/__tests__/publicProfileRoutes.test.js` | owner/public actual usage, mode 합계, hover·keyboard·touch, fail-close와 기존 share/card 회귀 추가 |

## 상호작용·접근성 결과

- Daily는 364개 시각 cell을 유지하고 미래 cell을 pointer·focus 대상에서 제외했다.
- Weekly와 Cumulative는 중복 focus target 없이 각 52개 의미 단위로 제공한다.
- mode control은 `aria-pressed`, heatmap은 명명된 `grid`, cell은 roving tab stop을
  사용한다.
- Daily는 좌우·상하 방향키, Weekly/Cumulative는 좌우 방향키로 이동하며 Escape,
  blur, 외부 pointer, mode/source 변경, resize/scroll에서 tooltip을 닫는다.
- touch는 같은 cell을 다시 누르면 닫히며 emulated mouse 경로와 분리했다.
- tooltip은 viewport 좌우 clamp와 위/아래 fallback을 적용하고 100ms corporate motion,
  `prefers-reduced-motion` 정적 표현을 제공한다.
- 좁은 화면에서는 page가 아니라 chart wrapper만 가로 scroll하고 최근 주를 우측에
  맞춘다.

## 본문 변경 정도 / 본문 무손실 여부

Account Usage Contract, backend, CLI, card renderer, public card URL, visibility mutation과
Share Studio API는 변경하지 않았다. no-usage 상태는 기존 submit CTA를 유지하며 demo
heatmap을 표시하지 않는다. 공개 화면은 공개 API payload의 owner와 usage만 사용하고,
owner 전용 mutation이나 내부 식별자를 fallback으로 참조하지 않는다.

## 검증 결과

계획서 지정 명령:

```bash
node --test src/profile-ui/__tests__/heatmap.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js
npm run test:e2e -- --grep "Token activity|Profile heatmap"
npm run build
git diff --check
```

결과:

- OK — heatmap data contract와 public route 단위 테스트 12건 통과
- OK — owner daily keyboard/hover, weekly/cumulative 합계, public mobile touch E2E 3건 통과
- OK — Vite production build 성공, 1,816 modules transformed
- OK — `git diff --check` 오류 없음

추가 회귀 확인:

```bash
npm run test:e2e -- --grep "Profile and Settings canvases|Public profile"
```

- OK — 기존 Share Studio, visibility/card preview, loading/no-usage/error, Settings,
  public desktop/mobile/fail-close를 포함한 12건 통과

## 잔여 위험

- 전체 browser matrix, `ko` locale의 실제 렌더링, reduced-motion과 짧은 viewport는
  Stage 5의 전체 E2E·artifact QA에서 다시 확인해야 한다.
- 이번 단계는 local Site 구현과 검증만 수행했다. production 배포, 원격 data,
  environment/access mutation은 수행하지 않았다.

## 다음 단계 영향

- Stage 5는 owner/public 세 mode와 tooltip lifecycle을 전체 E2E에서 재검증하고,
  Sites fullstack·production artifact 및 제한 경로 무변경을 확인한다.
- Home/static/README card에는 cell tooltip overlay가 없어야 하며 공개·비공개 card와
  Share Studio 회귀를 함께 확인한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 browser·Sites artifact QA로 진행한다.
