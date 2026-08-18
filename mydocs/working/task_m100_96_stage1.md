# Task #96 Stage 1 보고서 — 테마 text와 Skeleton ownership 회귀 고정

GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
구현계획서: [`task_m100_96_impl.md`](../plans/task_m100_96_impl.md)
Stage: 1

## 단계 목적

사용자가 실제 모바일에서 관찰한 후행 text snap과 light Profile Skeleton의 검정 shimmer를 제품
소스 변경 없이 selector·token ownership 계약과 Chromium·WebKit expected failure로 고정한다.
page theme와 card theme가 섞인 모든 공용 Skeleton surface를 audit해 Stage 2·3의 최소 변경 경계를
확정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/__tests__/themeSurfaceContract.test.js` | primary heading direct color, page Skeleton token, card theme variant 3개 source 계약을 TODO known failure로 고정 |
| `tests/profile-ui.spec.js` | light public Profile loading에서 page placeholder는 밝고 내부 기본 card Skeleton은 dark여야 하는 expected failure 추가 |
| `mydocs/working/task_m100_96_stage1.md` | text·Skeleton ownership matrix와 Stage 2·3 경계 기록 |
| `mydocs/orders/20260812.md` | Stage 1 완료와 Stage 2 진행 상태 기록 |

## ownership audit

### Text surface

| surface | 현재 ownership | 판정 | Stage 2 |
|---|---|---|---|
| Home hero h1 | `--text-primary` 직접 소유 | 유지 | 변경 없음 |
| Home Quickstart h2 | `body`/section 상속 | 결함 재현 대상 | `--text-primary` 직접 소유 |
| Home Quickstart step h3 | 상속 | 결함 재현 대상 | `--text-primary` 직접 소유 |
| Home owner identity strong | 상속 | 동일 primary heading/copy 조건 | `--text-primary` 직접 소유 |
| Profile display name h1/h2 | 상속 | 결함 재현 대상 | `--text-primary` 직접 소유 |
| Profile empty/error h2 | 상속 | 동일 stage heading 조건 | `--text-primary` 직접 소유 |
| Device h1 | 상속 | 같은 page primary heading 조건 | `--text-primary` 직접 소유 |
| public/settings/card/share heading | semantic token 직접 소유 | 유지 | 변경 없음 |
| status·link·action·card 내부 text | 각 status/link/card token 직접 소유 | 유지 | 범위 제외 |

### Skeleton surface

| surface | 현재 token/context | 판정 | Stage 3 |
|---|---|---|---|
| owner/public Profile page placeholder | dark card `--card-preview-placeholder-subtle`와 밝은 card sheen | 결함 | site theme page token으로 분리 |
| Profile 내부 card placeholder | dark card token, theme context 없음 | canonical dark 기본값으로 허용 | 명시적 `data-card-theme=dark` |
| Home owner/operator/sample card | dark card token, URL/profile theme는 상위에서만 계산 | light owner card에서 결함 가능 | `cardTheme` 전달 |
| owner/public Profile ready card | 실제 URL은 theme-aware, Skeleton context 없음 | 결함 가능 | profile card theme 전달 |
| public card intro | 실제 URL은 theme-aware, Skeleton context 없음 | 결함 가능 | public profile theme 전달 |
| Share Studio | `cardTheme` prop은 있으나 frame에 미전달 | 결함 가능 | frame에 전달 |
| settings/owner draft preview | draft theme URL은 있으나 frame에 미전달 | 결함 가능 | draft theme 전달 |

## 본문 변경 정도 / 본문 무손실 여부

제품 CSS·React·API·URL·storage와 공개 문서는 변경하지 않았다. 새 Node 계약은 TODO로, Playwright는
`test.fail()` expected failure로 표시해 현재 결함이 재현될 때 Stage 검증 자체는 통과하고 Stage 2·3
보정 뒤 annotation을 제거하지 않으면 unexpected pass가 되도록 구성했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/themeSurfaceContract.test.js
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --grep "Task #96" --workers=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --browser=webkit --grep "Task #96" --workers=1
git diff --check
```

결과:

- OK — Node source contract 3건이 각각 text semantic ownership, page Skeleton token, card light variant
  부재를 TODO known failure로 재현했다. 실패 0건으로 runner가 종료됐다.
- OK — Chromium expected failure 1건이 light page placeholder의 평균 RGB lightness가 41로 dark-card
  palette임을 재현했고 기본 내부 card Skeleton은 dark라는 분리 기준을 유지했다.
- OK — WebKit expected failure 1건이 동일 조건을 재현했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- 실제 모바일에서 보인 240ms 종료 뒤 한 프레임 snap은 자동 브라우저 timing만으로 항상 재현되지
  않는다. Stage 2는 source ownership을 진실 원천으로 고정하고 computed intermediate/final color를
  양 엔진에서 함께 검증한다.
- light card palette 값은 실제 renderer를 바꾸지 않고 기존 light PNG와 충분한 대비가 나도록
  Stage 3 computed style matrix에서 확정해야 한다.

## 다음 단계 영향

- Stage 2는 audit된 primary text selector에만 `--text-primary`를 직접 부여한다.
- status/link/action/card 내부 text와 이미 semantic token을 소유한 heading은 건드리지 않는다.
- text source contract TODO를 정상 assertion으로 전환하고 Chromium·WebKit dark↔light 이력을 추가한다.

## 승인 요청

- 작업지시자가 #96 PR 생성까지 승인했으므로 Stage 1 결과를 기준으로 Stage 2를 계속한다.
