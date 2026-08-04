# Task M100 #69 Stage 3.7 보고서

GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
구현계획서: [`task_m100_69_impl.md`](../plans/task_m100_69_impl.md)
Stage: 3.7

## 단계 목적

Settings Appearance 제목이 fieldset 상단 border를 가르며 panel 밖에 걸쳐 보이는 시각 불일치와,
light theme Home Quickstart의 명령어 박스가 주변 배경과 거의 구분되지 않는 surface 불일치를
보정한다. native radio group 접근성, dark 기준선과 다른 code surface는 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_69_impl.md` | 승인된 Stage 3.7 범위·검증·변경 금지 경로와 Stage 4 의존성을 기록 |
| `src/profile-ui/SettingsPage.jsx` | 시각 panel wrapper와 native fieldset을 분리해 legend를 panel content 안쪽에 배치 |
| `src/styles.css` | border 없는 Appearance fieldset과 Home 전용 command surface token 적용 |
| `tests/profile-ui.spec.js` | panel 내부 legend 위치와 light/dark Quickstart·command surface 회귀 검증 추가 |
| `mydocs/working/task_m100_69_stage3_7.md` | 구현·검증·잔여 위험과 다음 단계 영향을 기록 |

## 본문 변경 정도 / 본문 무손실 여부

Appearance의 문구·radio name·description 연결·selection handler는 변경하지 않았다. 바깥
`section.settings-panel`과 안쪽 native `fieldset`으로 시각 역할만 분리해 `legend`와 radio group
semantics를 유지했다. Home command row는 전용 semantic token으로 교체했으며 명령어, 복사 기능,
layout과 다른 `--surface-code` 소비자는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/theme.test.js
npx playwright test tests/profile-ui.spec.js --grep "theme surfaces|appearance panel layout"
npm run build
npm run build:sites
git diff --check
git diff 16bce41 -- \
  .openai/hosting.json \
  package.json package-lock.json \
  packages/codex-usage-profile-cli \
  src/profile-backend src/profile-runtime src/profile-media \
  src/profile-card public
```

결과:

- OK — theme unit 10건 통과. shared provider와 native radio 계약 유지.
- OK — Playwright 4건 통과. Appearance group이 accessible name을 유지하고 legend가 panel의
  좌·상단 border보다 10px 이상 안쪽에 배치됨을 확인.
- OK — light Quickstart `#f3f3f2` 위 command row는 white, dark Quickstart `#151515` 위 command
  row는 기존 `#111111`로 계산되어 두 테마에서 surface가 구분됨을 확인.
- OK — 제품 Vite build 통과(1,821 modules transformed).
- OK — Sites client build 통과(27 modules transformed).
- OK — `git diff --check` 경고 없음.
- OK — Stage 3.6 기준 변경 금지 경로에 diff 없음. 호스팅 설정, package·lockfile, CLI,
  backend/runtime/media, card renderer와 public asset을 변경하지 않았다.

## 잔여 위험

- 브라우저의 native fieldset/legend 구현 차이는 가능하나 border를 fieldset에서 제거하고 layout
  위치와 accessible group을 Chromium E2E로 함께 고정했다. Stage 4 전체 회귀에서 재검증한다.
- 이 Stage는 production 배포를 수행하지 않는다.

## 다음 단계 영향

- Stage 4에서 Settings keyboard selection, mobile layout과 Home quickstart route 회귀를 포함해
  전체 E2E·Sites artifact를 다시 검증한다.
- 공개 카드 theme와 영속 customization은 후속 Issue #74 범위를 유지한다.

## 승인 요청

- Stage 3.7 산출물과 검증 결과를 승인하면 Stage 4 전체 회귀와 Sites artifact 검증으로 진행한다.
