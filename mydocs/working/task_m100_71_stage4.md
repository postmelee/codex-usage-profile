# Task M100 #71 Stage 4 보고서 — Share Studio 단일 보간과 접근성 정리

GitHub Issue: [#71](https://github.com/postmelee/codex-usage-profile/issues/71)
연결 Issue: [#73](https://github.com/postmelee/codex-usage-profile/issues/73)
구현계획서: [`task_m100_71_impl.md`](../plans/task_m100_71_impl.md)
Stage: 4

## 단계 목적

Share Studio의 platform 포함 문구가 placeholder 자기 치환과 React의 수동 2차 치환을
거치지 않고 최종 target label로 한 번만 보간되게 한다. Profile의 Share 버튼은 보이는
문구를 유지하면서 영어·한국어에서 문맥이 분명한 접근성 이름을 제공한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/shareStudio.js` | platform 전용 message key를 두 개로 제한한 `formatShareStudioPlatformMessage`를 추가하고 일반 copy 생성 시 placeholder 자기 치환을 제거했다. |
| `src/profile-ui/ShareStudio.jsx` | instruction title과 composer label을 locale·target label이 있는 렌더 지점에서 전용 helper로 한 번만 보간하고 수동 `.replace` helper를 제거했다. |
| `src/profile-ui/ProfileShell.jsx` | 공통 topbar Share 버튼의 접근성 이름을 `common.shareProfile`로 분리했다. |
| `src/profile-ui/CardProfilePage.jsx` | 현재 `/profile` 화면에서 실제 소비되는 카드 Share 버튼에도 전용 접근성 이름을 적용하고 보이는 `Share`/`공유`는 유지했다. |
| `src/profile-ui/messages.js` | 영어 `Share profile`, 한국어 `프로필 공유` catalog key를 추가했다. |
| `src/profile-ui/__tests__/shareStudio.test.js` | 영어·한국어와 X·LinkedIn·Reddit의 instruction/composer 결과, placeholder 제거, invalid key·label 거부를 검증했다. |
| `src/profile-ui/__tests__/i18n.test.js` | locale catalog parity와 visible/accessibility Share 문구 분리를 고정했다. |
| `tests/profile-ui.spec.js` | owner Profile의 Share 버튼이 `Share profile` 접근성 이름과 `Share` 표시 문구를 함께 제공하고 Share Studio 동작을 유지하는지 검증했다. |
| `mydocs/working/task_m100_71_stage4.md` | Stage 4 변경·검증·잔여 위험과 다음 단계 경계를 기록했다. |

계획서에 포함된 `src/profile-ui/__tests__/cardShare.test.js`는 기존 localized card URL,
README snippet과 login target 계약을 수정 없이 통과했다. 실제 `/profile` 화면의 Share
action은 현재 `ProfileShell` topbar가 아니라 `CardProfilePage` 카드 하단에 있으므로 승인된
접근성 계약을 해당 소비 지점에도 적용했다.

## 본문 변경 정도 / 본문 무손실 여부

공유 대상의 label, X·LinkedIn·Reddit destination URL, social payload와 새 창 속성은
변경하지 않았다. `getShareStudioCopy(locale)`의 platform 비종속 copy 계약은 유지하고,
platform을 요구하는 두 key만 전용 formatter가 직접 `formatMessage`하도록 분리했다.

Profile Share 버튼은 DOM의 보이는 `Share`/`공유` 문구와 클릭·disabled 동작을 유지한다.
accessible name만 `Share profile`/`프로필 공유`로 구체화했다. Share Studio의 dialog focus,
keyboard, resize, reduced-motion, preview/clipboard failure와 make-private 흐름은 기존 E2E로
보존했다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/i18n.test.js \
  src/profile-ui/__tests__/cardShare.test.js
npx playwright test tests/profile-ui.spec.js --grep 'Share Studio|share button|accessib'
git diff --check
```

결과:

- OK — unit 19 tests, 19 pass, 0 fail.
- OK — 영어·한국어에서 X·LinkedIn·Reddit의 instruction title과 composer label을 한 번만
  보간하고 결과에 `{platform}`이 남지 않는다.
- OK — 지원하지 않는 platform message key와 빈 target label을 명시적으로 거부한다.
- OK — locale catalog id·placeholder parity와 visible/accessibility Share 문구 분리를
  확인했다.
- OK — Playwright 10 tests, 10 pass. Profile Share 접근성 이름, 영어·한국어 instruction,
  destination link, focus·keyboard·resize·reduced-motion·failure·privacy 흐름을 확인했다.
- OK — placeholder 자기 치환과 수동 platform `.replace`가 source에 남지 않았다.
- OK — `git diff --check`가 통과했다.

## 잔여 위험

- platform을 포함하는 새 Share 문구를 추가할 때는 `SHARE_PLATFORM_MESSAGE_IDS` allowlist와
  영어·한국어 placeholder parity test를 함께 갱신해야 한다. 누락 시 일반 copy가 빈
  placeholder를 생성하는 대신 전용 helper 계약에서 명시적으로 드러난다.
- 공통 `ProfileShell`의 topbar Share는 현재 주요 라우트에서 비활성화되어 있지만, 향후
  다시 사용해도 동일한 접근성 이름을 제공하도록 계약을 맞췄다.
- #74 카드 theme customization과 production 배포는 승인된 제외 범위로 유지했다.

## 다음 단계 영향

- Stage 5는 Stage 2~4 source를 추가 설계 변경하지 않고 세 이슈의 focused test와 전체
  Node/E2E/production/Sites artifact 회귀를 실행한다.
- 회귀가 없으면 오늘할일 상태와 Stage 5 보고서를 정리하고, 별도 최종 승인 후
  `task-final-report` 절차로 단일 PR 게시 준비를 진행한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 통합 회귀와 PR 준비로 진행한다.
