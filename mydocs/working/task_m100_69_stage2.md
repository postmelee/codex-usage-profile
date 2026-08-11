# Task M100 #69 Stage 2 보고서

GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
구현계획서: [`task_m100_69_impl.md`](../plans/task_m100_69_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 확정한 `data-theme`와 `color-scheme` 계약을 전체 화면 CSS에 연결했다. 기존 dark
화면을 기준선으로 보존하면서 light palette를 추가하고, component가 theme attribute를 직접
분기하지 않고 역할 기반 custom property만 소비하도록 Home, Marketing, owner/public Profile,
Settings, device approval, Share Studio와 상태 surface를 이관했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/styles.css` | page/surface/text/border/action/focus/status/overlay/shadow/skeleton/heatmap 역할 token과 light/dark/system mapping 추가, 전체 surface 이관 |
| `tests/profile-ui.spec.js` | dark 기준 test 환경 고정, CSS literal inventory, product·Sites 대표 route의 light/dark computed style 검증 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 항목은 해당 없음이다. component 구조, route, API, motion
duration, reduced-motion, card renderer와 public asset은 변경하지 않았다. 기존 dark 값은 각
semantic token의 dark branch에 그대로 유지했다.

color literal은 다음 두 범주에만 남겼다.

- `:root` token 선언: light/dark palette, 고정 dark card preview·skeleton effect,
  shadow·glare·status·heatmap 역할 값
- 승인한 구조적 artwork 예외: `.avatar-fallback`, `.avatar-face-*`, `.plugin-icon`,
  `.plugin-icon-face-*`

Playwright source inventory가 위 예외를 제거한 component CSS에 raw hex/RGB literal과 이전
`--bg`, `--surface`, `--text`, `--line`, `--cell-*` 참조가 남지 않도록 차단한다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/accountUi.test.js \
  src/profile-ui/__tests__/heatmap.test.js \
  src/profile-ui/__tests__/homeCardTransition.test.js \
  src/profile-ui/__tests__/shareStudio.test.js
npx playwright test tests/profile-ui.spec.js --grep "theme surfaces"
npx playwright test tests/profile-ui.spec.js --reporter=dot
npm run build
npm run build:sites
git diff --check
```

결과:

- OK — 관련 단위 테스트 `28 passed, 0 failed`
- OK — Stage 2 theme surface Playwright `3 passed, 0 failed`
- OK — 전체 profile UI 회귀 `59 passed, 0 failed`
- OK — CSS inventory에서 token 선언·승인 artwork 예외 외 color literal `0건`
- OK — Home, Marketing, Settings, device, owner/public Profile, heatmap tooltip,
  Share Studio action surface의 light/dark computed color 확인
- OK — 기존 dark `#000`, `#0d0d0d`, `#171717`, heatmap `#242424`, tooltip
  `#3f4042`, Share action `#f4f4f4` 기준 유지
- OK — product Vite build `1821 modules transformed`
- OK — Sites Vite build `27 modules transformed`
- OK — `git diff --check`
- OK — `.openai/hosting.json`, package·lockfile, CLI, backend/API/runtime/media,
  card renderer, `public/` 변경 없음

## 잔여 위험

- Stage 2는 theme 선택 UI를 추가하지 않았다. 현재 명시 override는 runtime/storage 계약으로만
  사용할 수 있고, Settings Appearance control은 Stage 3 범위다.
- product·Sites production 배포와 hosted environment 검증은 승인 범위에서 제외했다.
- card PNG/SVG 자체는 theme 대상이 아니므로 card preview 내부는 고정 dark token을 유지한다.

## 다음 단계 영향

- Stage 3 Appearance panel은 이번 Stage의 semantic token과 `ThemeProvider`만 사용하면 되며,
  component별 theme selector나 별도 palette를 추가하지 않는다.
- Settings 인증 여부와 무관하게 `system | light | dark` radio semantics를 제공하고 영어·한국어
  catalog, 저장·system 복귀, keyboard focus를 검증해야 한다.
- Stage 2 Playwright suite는 기존 dark 시각 회귀를 위해 browser media를 dark로 고정한다.
  Stage 3 preference 테스트는 명시 storage 값 또는 system media를 각각 설정해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 Settings Appearance control과 접근성 구현으로
  진행한다.
