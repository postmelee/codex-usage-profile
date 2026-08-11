# Task M100 #69 Stage 3 보고서

GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
구현계획서: [`task_m100_69_impl.md`](../plans/task_m100_69_impl.md)
Stage: 3

## 단계 목적

Stage 1의 theme runtime 계약과 Stage 2의 semantic token을 Settings의 사용자 제어와 연결했다.
인증 상태와 무관하게 사용할 수 있는 Appearance panel에서 `system | light | dark`를 선택하고,
선택 즉시 반영·기기 로컬 저장·system 복귀와 OS theme 변경 추적을 수행하도록 했다. 영어·한국어
catalog와 native radio keyboard semantics를 함께 적용해 기존 account 상태 안내와 독립적으로
동작하게 했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/SettingsPage.jsx` | 인증 분기 밖 Appearance fieldset, native radio group, `useTheme()` 연결 추가 |
| `src/profile-ui/messages.js` | Appearance 제목·설명과 system/light/dark option의 영어·한국어 catalog 추가 |
| `src/styles.css` | semantic token만 사용하는 option card, checked·hover·focus-visible, mobile layout 추가 |
| `src/profile-ui/__tests__/i18n.test.js` | 지원 theme preference의 영·한 catalog와 system 설명 계약 검증 추가 |
| `src/profile-ui/__tests__/theme.test.js` | Settings가 shared Provider·preference 목록·native radio를 사용하는 source 계약 추가 |
| `tests/profile-ui.spec.js` | 인증 상태·locale, 즉시 반영·reload·새 context·system 복귀·media change·keyboard 접근성 검증 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 항목은 해당 없음이다. 기존 Settings의 GitHub account, API
token, device 관리와 anonymous/loading/unavailable account 안내·GitHub login CTA는 유지했다.
Appearance는 account API와 분리된 기기 로컬 설정이며 backend/API, CLI, card renderer,
public asset, package·lockfile, hosting manifest는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/theme.test.js \
  src/profile-ui/__tests__/i18n.test.js \
  src/profile-ui/__tests__/accountUi.test.js
npx playwright test tests/profile-ui.spec.js --grep "appearance control|theme preference"
npm run build
npx playwright test tests/profile-ui.spec.js
git diff --check
```

결과:

- OK — 지정 단위 테스트 `25 passed, 0 failed`
- OK — Stage 3 Appearance Playwright `3 passed, 0 failed`
- OK — authenticated·anonymous·unavailable Settings에서 Appearance 표시, 한국어 catalog 확인
- OK — light 즉시 반영, reload와 storage state를 전달한 새 browser context에서 preference 유지
- OK — system 선택 시 `codex-usage-profile:appearance` key 제거, OS dark→light 변경 실시간 반영
- OK — native radio ArrowRight 선택, checked·focused 상태와 visible outline, disabled option 없음
- OK — product Vite build `1821 modules transformed`
- OK — 전체 profile UI 회귀 `62 passed, 0 failed`
- OK — `git diff --check`

## 잔여 위험

- 기기 로컬 preference는 browser storage 기준이므로 다른 browser/profile/device에는 자동
  동기화되지 않는다. 이는 Stage 1에서 승인한 account 비종속 계약이다.
- 실제 production 배포와 hosted system theme 수동 검증은 승인 범위에서 제외했다.
- card PNG/SVG 자체는 theme 대상이 아니며 기존 고정 dark 표현을 유지한다.

## 다음 단계 영향

- Stage 4는 새 Appearance control을 포함한 전체 route, product·Sites artifact와 production
  verification 명령을 실행하되 source 변경은 회귀에서 발견된 #69 범위 보정에 한정한다.
- Appearance control은 `ThemeProvider`와 semantic token만 사용하므로 Stage 4에서 별도 theme
  selector나 palette를 추가하지 않는다.
- production deploy는 수행하지 않고 local·artifact 검증까지만 진행한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 전체 route·Sites artifact 회귀 검증으로
  진행한다.
