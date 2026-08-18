# Task #96 Stage 3 보고서 — site/card Skeleton palette 분리

GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
구현계획서: [`task_m100_96_impl.md`](../plans/task_m100_96_impl.md)
Stage: 3

## 단계 목적

사이트의 light/dark mode와 카드 이미지 자체의 light/dark theme를 서로 독립된 축으로 분리한다. Profile
페이지 구조를 대신하는 Skeleton은 사이트 테마를 따르고, Home·owner/public Profile·public intro·Share
Studio에 공통으로 쓰이는 카드 Skeleton은 실제 카드 테마를 따르게 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/styles.css` | page Skeleton token과 card Skeleton token 분리, light card palette variant 추가 |
| `src/profile-marketing/MarketingLanding.jsx` | 공용 card frame에 정규화된 `data-card-theme` context 부여 |
| `src/profile-ui/HomePage.jsx` | owner card에 저장된 theme, operator/sample card에 canonical dark 전달 |
| `src/profile-ui/CardProfilePage.jsx` | owner draft theme를 preview Skeleton에 전달 |
| `src/profile-ui/PublicProfilePage.jsx` | 공개 카드와 intro에 공개 profile theme 전달 |
| `src/profile-ui/PublicCardIntro.jsx` | intro frame에 card theme 전달 |
| `src/profile-ui/ShareStudio.jsx` | share preview frame에 card theme 전달 |
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | profile load 중 아직 알 수 없는 card theme를 canonical dark로 명시 |
| `src/profile-ui/__tests__/themeSurfaceContract.test.js` | palette 분리와 모든 공용 callsite의 explicit context 계약 고정 |
| `tests/profile-ui.spec.js` | site/card theme 교차 조합과 owner draft 전환을 Chromium·WebKit에서 검증 |
| `mydocs/working/task_m100_96_stage3.md` | Stage 3 변경·검증·잔여 범위 기록 |
| `mydocs/orders/20260812.md` | Stage 3 완료와 Stage 4 진행 상태 기록 |

## palette ownership 결과

| surface | palette 기준 | 결과 |
|---|---|---|
| Profile identity/stats/activity placeholder | site theme | light site에서 밝은 base와 어두운 sheen 사용 |
| Profile loading 내부 카드 | canonical card dark | profile 응답 전에도 site theme와 독립 |
| Home owner card | 저장된 card theme | owner source에만 profile theme 전달 |
| Home operator/sample card | canonical card dark | 고정 dark artwork와 Skeleton 일치 |
| owner Profile preview | draft card theme | 저장 전 radio 변경에도 즉시 Skeleton palette 일치 |
| public Profile·intro | 공개 profile card theme | site dark + card light 조합도 light Skeleton 사용 |
| Share Studio | 저장된 card theme | warm/cold preview 공용 frame에서 동일 context 사용 |

light card placeholder는 renderer의 `CARD_THEME_PALETTES.light` 배경·avatar·divider·text 의미와 맞췄다.
컴포넌트 selector에는 raw color를 두지 않고 root token을 재매핑해 기존 token ownership 계약을 유지했다.

## 본문 변경 정도 / 본문 무손실 여부

문구·레이아웃·card PNG renderer·API·URL·storage·migration·공개 문서는 변경하지 않았다. 로딩 중
placeholder의 color ownership과 공용 frame의 theme metadata만 변경했다. 실제 카드가 로드된 뒤 이미지와
share handoff 동작은 기존 경로를 그대로 사용한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/themeSurfaceContract.test.js
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --grep "Task #96" --workers=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --browser=webkit --grep "Task #96" --workers=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --grep "theme surfaces keep raw colors|Home card transition keeps a stable skeleton box on mobile|card appearance keeps the last decoded preview|Share Studio hands off the decoded source|public profile moves from a neutral loading state|profile loading Skeleton stops" --workers=1
npm run build:production
git diff --check
```

결과:

- OK — Node source contract 4건 통과, TODO 0건.
- OK — Chromium Task #96 5건 통과.
- OK — WebKit Task #96 5건 통과.
- OK — 기존 Home mobile Skeleton, Share Studio warm handoff, owner draft preview, public profile reveal,
  reduced motion, raw color token 계약 6건 통과.
- OK — production build 통과.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- 실제 iOS Safari·Chrome의 화면 캡처는 자동 WebKit 검증과 별도로 작업지시자가 두 PR merge 전 로컬
  확인에서 수행한다.
- 전체 Node·Chromium suite와 Sites artifact·route smoke는 Stage 4에서 최종 검증한다.

## 다음 단계 영향

- Stage 4에서 전체 회귀, production/Sites artifact 검증, route smoke를 실행한다.
- 실제 Sites 배포는 수행하지 않고 로컬 검증 가능한 PR까지만 게시한다.

## 승인 상태

- 작업지시자가 #96 PR 생성까지 승인했으므로 Stage 3 결과를 기준으로 Stage 4를 계속한다.
