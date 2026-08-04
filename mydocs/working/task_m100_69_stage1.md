# Task M100 #69 Stage 1 보고서

GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
구현계획서: [`task_m100_69_impl.md`](../plans/task_m100_69_impl.md)
Stage: 1

## 단계 목적

`system | light | dark` appearance 계약을 device-local preference와 resolved theme로 분리하고,
product와 Sites 진입점 모두에서 첫 React paint 전에 같은 theme 상태를 적용할 runtime 기반을
마련했다. Stage 2의 semantic CSS token 이관 전에 저장·시스템 추종·문서 동기화 경계를 먼저
고정했다.

설치된 Codex 앱 `26.727.51351`의 관찰 가능한 appearance message 계약을 읽기 전용으로
확인했다. 앱은 Theme 항목에 `System`, `Light`, `Dark`를 제공하고 "Use light, dark, or match
your system" 동작을 안내한다. 이번 구현은 이 일반적인 상태 모델과 system 추종 방식만
참고했으며, 앱 source·제품 고유 theme 자산·색상값은 복사하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/theme.js` | preference 정규화, safe storage, system resolution, document sync, 표준·legacy media/storage 구독 구현 (191줄) |
| `src/profile-ui/ThemeProvider.jsx` | bootstrap 상태 재사용과 `preference`, `resolvedTheme`, `setPreference` context 제공 (94줄) |
| `src/profile-ui/__tests__/theme.test.js` | 상태·예외·listener cleanup·두 HTML bootstrap parity 검증 9건 추가 (354줄) |
| `index.html` | product entry보다 먼저 실행되는 최소 blocking theme bootstrap 추가 |
| `sites.html` | product와 byte-equivalent인 Sites theme bootstrap 추가 |
| `src/main.jsx` | product React tree를 `ThemeProvider`로 감쌈 |
| `src/profile-marketing/sites-entry.jsx` | Sites React tree를 같은 `ThemeProvider`로 감쌈 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 항목은 해당 없음이다. 기존 route, 인증, locale, marketing
config, card renderer와 API 동작은 유지했다. HTML head bootstrap과 React 최상위 Provider만
추가했으며 CSS token과 화면 색상은 Stage 2 범위로 남겼다.

저장 계약은 다음과 같이 구현했다.

- key: `codex-usage-profile:appearance`
- 저장값: 명시적 override인 `light | dark`만 허용
- `system`: key 제거, `(prefers-color-scheme: dark)` 결과 추종
- 손상 값·storage 접근 실패·`matchMedia` 부재: 화면 로드를 막지 않고 안전한 system/light
  fallback 사용
- 문서 상태: `data-theme-preference`와 resolved `data-theme`, `color-scheme` 동기화

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/theme.test.js
npm run build
npm run build:sites
git diff --check
```

결과:

- OK — theme 단위 테스트 `9 passed, 0 failed`
- OK — product Vite build, `1821 modules transformed`
- OK — Sites Vite build, `27 modules transformed`
- OK — `git diff --check`
- OK — `.openai/hosting.json`, package·lockfile, CLI, backend/API/runtime/media,
  card renderer, `public/` 변경 없음
- OK — 두 HTML bootstrap source 일치, module entry 이전 위치, storage·system·예외 실행 검증

## 잔여 위험

- Stage 1은 runtime attribute와 Provider 기반만 추가했다. 현재 CSS는 여전히 dark token
  기준이므로 light 화면은 Stage 2 semantic token 이관 전까지 완성되지 않는다.
- inline bootstrap은 no-flash를 위해 두 HTML에 중복된다. 단위 테스트가 storage key,
  attribute, media query와 전체 source parity를 차단하지만 HTML 변경 시 테스트를 함께
  유지해야 한다.
- 실제 production Sites 배포와 hosted environment 검증은 승인 범위에서 제외했다.

## 다음 단계 영향

- Stage 2는 `data-theme`와 기존 CSS token을 연결하고 dark 기준선을 보존하면서 light token을
  추가해야 한다.
- component는 theme attribute를 직접 분기하지 않고 semantic custom property만 소비해야 한다.
- Home, Marketing, Profile, Settings, device, Share Studio와 loading/empty/error surface 전체를
  color inventory와 computed style 검증 대상으로 삼는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 semantic token과 전체 surface 이관으로
  진행한다.
