# Task M100 #68 Stage 2 완료보고서

GitHub Issue: [#68](https://github.com/postmelee/codex-usage-profile/issues/68)
구현계획서: [`task_m100_68_impl.md`](../plans/task_m100_68_impl.md)
Stage: 2 — 공통 shell·온보딩·관리 화면 이관

## 단계 목적

Stage 1의 전역 locale 기반을 Home과 Sites marketing mirror, 공통 shell/account menu,
Settings, device approval에 연결한다. 영어·한국어에서 화면 문구와 접근성 문구가 같은
locale을 따르도록 하되 인증, 카드 전환, 승인 상태 machine과 Sites의 sample-only·무API
경계는 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/messages.js` | account, shell, Home, Quickstart, Settings, device approval의 영어·한국어 동등 메시지 계약 추가 |
| `src/profile-ui/accountUi.js` | 계정 상태·fallback·avatar alt·OAuth 오류 copy에 선택 locale을 받는 호환 API 추가 |
| `src/profile-ui/deviceApproval.js` | 승인 오류를 안전한 메시지 ID로 분류하고 intent 안내를 locale별로 생성 |
| `src/profile-ui/ProfileShell.jsx` | topbar, 페이지 작업 ARIA, Share와 세션 상태 문구 이관 |
| `src/profile-ui/AccountMenu.jsx` | 로그인·프로필·설정·로그아웃·ARIA·실패 상태 이관과 raw 오류 제거 |
| `src/profile-ui/HomePage.jsx` | Provider locale을 카드 URL·hero·상태·CTA·alt에 연결하고 raw mutation 오류 제거 |
| `src/profile-ui/HomeQuickstart.jsx` | product Quickstart 안내·단계·복사·세션 상태 이관 |
| `src/profile-marketing/MarketingLanding.jsx` | product와 Sites가 같은 기본 locale copy를 사용하되 명시 custom copy는 보존 |
| `src/profile-ui/SettingsPage.jsx` | GitHub 계정, token/device 관리, 날짜, 빈 상태·실패·ARIA 문구 이관 |
| `src/profile-ui/DeviceApprovalPage.jsx` | 승인 입력·상태·성공 안내·복사·navigation 문구 이관과 메시지 ID 상태 보관 |
| `src/profile-ui/__tests__/accountUi.test.js` | 한국어 상태·OAuth 오류·fallback·avatar 접근성 계약 추가 |
| `src/profile-ui/__tests__/deviceApproval.test.js` | 안전한 오류 fallback, 메시지 ID와 한국어 승인 안내 계약 추가 |
| `src/profile-ui/__tests__/homeOnboarding.test.js` | 모든 Quickstart 단계의 영어·한국어 메시지 존재 검증 추가 |
| `tests/profile-ui.spec.js` | 한국어 shell·onboarding·device·Settings E2E와 browser 언어 fixture 추가 |
| `mydocs/orders/20260803.md` | Task #68을 Stage 3 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 항목은 해당 없다. 기존 영어 copy의 의미와 사용자
흐름을 메시지 사전으로 옮겼으며 사용자 이름, GitHub handle, Codex·GitHub 고유명사,
CLI 명령과 URL은 번역하지 않았다. `navigator.languages`로 선택된 Provider locale을
Home 카드 locale에도 사용하므로 UI와 카드 요청 언어가 일치한다.

인증·route·clipboard·card transition·visibility mutation·device approval 상태 전이는
변경하지 않았다. 알려진 실패는 메시지 ID로 보관하며 서버가 반환한 임의 오류 문자열을
화면에 직접 렌더링하지 않는다. 새 dependency, backend/D1/R2/CLI, card renderer,
`.openai/hosting.json`, package·lockfile, static asset과 공식 제품 문서 변경은 없다.

## 구현 결과

- product와 Sites marketing의 기본 hero·Quickstart·CTA가 같은 메시지 사전을 사용한다.
  기존 marketing config에 명시적으로 전달된 custom copy는 그대로 우선한다.
- account helper는 기본 인자를 영어로 유지해 기존 순수 API와 테스트 호환성을 보존하며,
  React 화면에서는 Provider locale을 전달한다.
- Settings의 token/device 날짜는 전역 `Intl.DateTimeFormat` cache를 사용하고, 편집하지 않은
  기본 token 이름은 `languagechange` 뒤 새 locale로 동기화된다.
- device approval은 invalid/expired, transient, unknown 실패를 안정된 message ID로 분류한다.
  locale 변경 뒤에도 이전 언어의 오류 문자열이 state에 남지 않는다.
- 한국어 E2E fixture는 구현 계약과 같은 `navigator.languages` 우선순위를 사용한다.
- Sites marketing E2E에서 API 요청은 0건이며 sample card와 canonical app CTA만 유지된다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/accountUi.test.js src/profile-ui/__tests__/deviceApproval.test.js src/profile-ui/__tests__/homeOnboarding.test.js
node --test src/profile-marketing/__tests__/*.test.js
npm test
npm run test:e2e -- --grep "locale shell|locale onboarding|locale device|locale settings"
npm run test:e2e
npm run build
npm run build:sites
git diff --check
```

결과:

- OK — account/device/onboarding 단위 테스트 15건 통과, 실패·skip 없음.
- OK — marketing/Sites config 단위 테스트 12건 통과, 실패·skip 없음.
- OK — 전체 Node 테스트 548건 중 542건 통과, 환경 의존 6건 skip, 실패 0건.
- OK — Stage 2 핵심 locale E2E 4건 통과. 한국어 shell, sample-only Sites onboarding,
  device 승인 성공, Settings 빈 상태를 검증했다.
- OK — 전체 Playwright E2E 50건 통과. 기존 영어 Home·공유·Profile·Settings와 한국어
  Share Studio 회귀를 함께 확인했다.
- OK — `npm run build`: 1,819 modules transformed, product bundle 생성 성공.
- OK — `npm run build:sites`: 25 modules transformed, marketing Sites bundle 생성 성공.
- OK — `git diff --check` 경고 없음.

전체 Node 테스트의 skip 6건은 기존 `TEST_DATABASE_URL` 미설정 PostgreSQL 검증 5건과
`TEST_S3_*` 미설정 외부 S3 endpoint 검증 1건이다. Miniflare D1 fixture가 임시 로컬
포트를 사용하는 전체 테스트는 허용된 로컬 포트 환경에서 통과했다.

## 잔여 위험

- Profile, token activity heatmap, Share Studio의 전체 문구·숫자·날짜 formatter 이관은
  승인된 Stage 3 범위다. 해당 화면에는 기존 독립 영어·한국어 adapter가 남아 있다.
- 실제 `languagechange`에 따른 전 화면 재렌더와 혼합 literal 탐지는 Stage 4의 전역
  정합성 E2E에서 최종 확인한다.
- PostgreSQL·외부 S3 환경 의존 검증 6건은 이번 frontend locale 변경과 무관하게
  기존 정책대로 skip됐다.

## 다음 단계 영향

- Stage 3 컴포넌트는 `useLocale()`과 공통 formatter를 사용하고 별도 browser locale
  판정을 추가하지 않는다.
- Profile의 heatmap tooltip·exact token·summary stat와 Share Studio copy는 공통 사전으로
  연결하되 UTC bucket, intensity, visibility/share 상태와 animation 계약을 보존한다.
- `resolveShareLocale`와 기존 Share Studio 순수 helper는 호환 adapter로 유지한다.
- Stage 3 완료보고서 승인 전 전역 literal 감사와 production artifact QA는 시작하지 않는다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 — Profile·heatmap·공유 흐름 이관으로
  진행한다.
