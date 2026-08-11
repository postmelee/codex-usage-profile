# Task M100 #68 구현계획서

수행계획서: [`task_m100_68.md`](task_m100_68.md)
GitHub Issue: [#68](https://github.com/postmelee/codex-usage-profile/issues/68)
마일스톤: M100
수행계획·권고안 A 승인: 2026-08-03

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 전역 locale 기반과 메시지 계약 | `messages.js`, `i18n.js`, `LocaleProvider.jsx` | resolver·fallback·formatter 단위 테스트, 기본 build |
| 2 | 공통 shell·온보딩·관리 화면 이관 | Home/marketing, menu/shell, Settings, device approval | 기능별 단위 테스트, 영어·한국어 핵심 E2E |
| 3 | Profile·heatmap·공유 흐름 이관 | owner/public Profile, token activity, Share Studio, card locale adapter | formatter·share 회귀, Profile locale E2E |
| 4 | 전역 locale 정합성·Sites artifact QA | 혼합 문구 탐지, 전체 Node/E2E/build/Sites 검증 | 전체 회귀와 제한 경로 diff |

## 공통 구현 계약

- `en`을 완전한 기준 메시지 사전으로 두고 `ko`는 동일한 ID 집합을 갖는다. 한국어
  메시지가 누락되면 영어로 fallback하며 메시지 ID 자체를 사용자에게 표시하지 않는다.
- 메시지 ID는 `home.hero.title`, `profile.tokenActivity.daily`처럼 기능과 의미를 나타내는
  이름을 사용한다. UI는 사전 객체를 직접 읽지 않고 locale hook 또는 순수 formatter를
  사용한다.
- 값 보간은 `{name}` 형식만 지원한다. 복수형·날짜·숫자·token 표시는 별도 locale
  formatter가 담당해 외부 ICU runtime을 추가하지 않는다.
- locale 결정 순서는 `navigator.languages`에서 처음 발견되는 지원 언어,
  `navigator.language`, `en`이다. `ko`와 `ko-*`만 `ko`로 정규화한다.
- 최초 mount 전에 결정한 locale을 React Provider와 `<html lang>`이 공유한다. 실행 중
  `languagechange`가 발생하면 resolver를 다시 실행하고 두 상태를 함께 갱신한다.
- 사용자 이름, GitHub handle, Codex·GitHub·LinkedIn·Reddit·X, CLI 명령, URL,
  API/error code는 번역하지 않는다.
- 알려진 화면 상태와 오류는 메시지 ID로 매핑한다. 알 수 없는 서버 문자열은 직접
  노출하지 않고 locale별 일반 오류를 사용한다.
- card renderer 내부 사전은 수정하지 않는다. 웹 UI locale은 기존 card URL helper와
  Share Studio에만 전달하고 영어 기본/`?locale=ko` 계약을 유지한다.
- 새 npm dependency, browser locale 저장, 수동 선택기, backend/CLI/hosting manifest
  변경은 금지한다.

## 문서 위치 확인

수행계획서와 동일하게 공식 제품 문서는 수정하지 않고 task 산출물만 `mydocs/`에 기록한다.
자동 감지 이외의 사용자 설정이나 외부 계약이 필요해지면 해당 Stage를 중단하고 계획 변경
승인을 요청한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_68*.md` | OK | 승인된 범위·구현 계약 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_68_stage{N}.md` | OK | 단계별 산출물·검증 기록 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_68_report.md` | OK | 전체 수용 기준과 잔여 위험 기록 |
| 공식 제품 문서 | 변경 없음 | 해당 없음 | OK | 새 명령·설정·공개 API가 없음 |

## Stage 1 — 전역 locale 기반과 메시지 계약

### 산출물

신규:

- `src/profile-ui/messages.js`
- `src/profile-ui/i18n.js`
- `src/profile-ui/LocaleProvider.jsx`
- `src/profile-ui/__tests__/i18n.test.js`
- `mydocs/working/task_m100_68_stage1.md`

수정:

- `index.html`
- `src/main.jsx`
- `src/profile-marketing/sites-entry.jsx`

### 변경 내용

- `messages.js`에 영어 기준 사전과 동일 ID를 가진 한국어 사전을 만든다. Stage 1에서는
  기반 메시지만 넣고, Stage 2·3에서 기능별 메시지를 같은 사전에 추가한다.
- `i18n.js`에 지원 locale, locale 정규화, 브라우저 언어 목록 resolver, 메시지
  lookup·보간, locale number/date formatter cache를 순수 함수로 구현한다.
- resolver는 빈 값, 대소문자, underscore, 미지원 언어, 지원 언어가 두 번째 이후에 있는
  `navigator.languages`까지 처리한다. 출력 locale은 `en|ko`만 반환한다.
- 영어·한국어 사전 ID 집합 불일치를 검출한다. 미등록 ID는 개발·테스트에서 탐지하고
  사용자 화면에는 영어 일반 fallback만 반환한다.
- `LocaleProvider`는 초기 locale, `t(id, values)`, formatter API를 제공하고
  `languagechange` listener를 mount/unmount한다.
- 두 React entry는 mount 전에 같은 resolver로 `<html lang>`을 설정하고 Provider로
  root를 감싼다. `index.html`의 `lang="en"`은 JavaScript 비실행 fallback으로 유지한다.
- UI 문구 이관은 시작하지 않고 기존 영어 화면 동작을 유지한다.

### 검증

```bash
node --test src/profile-ui/__tests__/i18n.test.js
npm test
npm run build
npm run build:sites
git diff --check
```

추가 수용 기준:

- `en-US`, `ko`, `ko-KR`, `KO_kr`, 미지원 locale과 다중 언어 목록 fixture가 계약대로
  `en|ko`를 반환한다.
- 영어·한국어 메시지 ID 집합 불일치와 누락 ID fallback을 테스트가 검출한다.
- 두 React entry가 같은 Provider/bootstrap 경로를 사용하고 새 dependency가 없다.

### 커밋

```text
Task #68 Stage 1: 전역 locale 기반과 메시지 계약 구현
```

## Stage 2 — 공통 shell·온보딩·관리 화면 이관

### 산출물

수정:

- `src/profile-ui/messages.js`
- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-ui/AccountMenu.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/HomeQuickstart.jsx`
- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/SettingsPage.jsx`
- `src/profile-ui/DeviceApprovalPage.jsx`
- 활성 경로에서 위 컴포넌트가 사용하는 상태 helper
- 관련 `src/profile-ui/__tests__/*.test.js`
- 관련 `src/profile-marketing/__tests__/*.test.js`
- `tests/profile-ui.spec.js`
- `mydocs/working/task_m100_68_stage2.md`

### 변경 내용

- Home/marketing landing의 hero, sample card alt, GitHub 로그인, Quickstart, 단계 설명,
  복사 상태와 CTA를 메시지 ID로 이관한다.
- 공통 topbar, account menu, profile/settings/logout 링크, loading·anonymous·unavailable
  상태, 이미지 alt와 ARIA label을 이관한다.
- Settings의 GitHub account, visibility, token/device 관리, 확인·실패·빈 상태를
  locale 메시지로 이관하되 identity와 token/device 데이터는 원문을 유지한다.
- device approval의 입력 label, approve/pending/approved/expired/not-found/error,
  terminal 안내와 Home/Profile 링크를 이관한다. 서버 임의 문자열은 직접 노출하지 않는다.
- clipboard·mutation·route/auth contract는 바꾸지 않고 문구 공급 방식만 교체한다.
- anonymous product landing과 `/sites.html` mirror가 같은 locale 문구를 사용하되
  Sites marketing의 sample-only·무API 격리를 유지한다.

### 검증

```bash
node --test src/profile-ui/__tests__/accountUi.test.js src/profile-ui/__tests__/deviceApproval.test.js src/profile-ui/__tests__/homeOnboarding.test.js
node --test src/profile-marketing/__tests__/*.test.js
npm test
npm run test:e2e -- --grep "locale shell|locale onboarding|locale device|locale settings"
npm run build
npm run build:sites
git diff --check
```

추가 수용 기준:

- 영어·한국어에서 Home, marketing mirror, menu, Settings, device approval의 핵심
  loading·empty·success·error와 ARIA 문구가 한 locale로 표시된다.
- 미지원 locale은 영어와 동일하며 product/Sites landing의 레이아웃·sample-only·무API
  계약이 유지된다.
- 언어 변경 후 조건부 UI를 다시 열어도 이전 locale 문구가 남지 않는다.

### 커밋

```text
Task #68 Stage 2: 공통 화면과 온보딩 문구 이관
```

## Stage 3 — Profile·heatmap·공유 흐름 이관

### 산출물

수정:

- `src/profile-ui/messages.js`
- `src/profile-ui/AccountUsageProfile.jsx`
- `src/profile-ui/ActivityInsights.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/ProfileHeader.jsx`
- `src/profile-ui/ProfileStats.jsx`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/TokenActivityChart.jsx`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/cardShare.js`
- `src/profile-ui/formatters.js`
- `src/profile-ui/heatmap.js`
- `src/profile-ui/shareStudio.js`
- 관련 `src/profile-ui/__tests__/*.test.js`
- `tests/profile-ui.spec.js`
- `mydocs/working/task_m100_68_stage3.md`

### 변경 내용

- owner/public Profile의 identity alt, summary stat, empty/loading/unavailable, visibility,
  card preview, publish/private/share action 문구를 이관한다.
- `formatters.js`의 `en-US` 고정을 제거하고 locale을 받는 숫자·날짜·기간·token
  formatter로 정리한다. compact 값 의미는 유지하고 exact 값에는 locale grouping을 쓴다.
- token activity의 Daily/Weekly/Cumulative, month label, tooltip, exact count checkbox,
  keyboard/touch ARIA를 이관한다. locale 변경 시 stale tooltip 문구를 남기지 않는다.
- heatmap의 독립 locale 정규화는 공통 resolver에 연결한다. UTC bucket 합계, intensity,
  semantic target 수는 변경하지 않는다.
- Share Studio 사전을 전역 메시지 사전 또는 호환 adapter에 연결한다.
  `getShareStudioCopy`와 target URL helper의 순수 API는 보존한다.
- `resolveShareLocale`는 공통 resolver의 호환 alias로 유지하거나 위임한다.
  영어는 locale query 제거, 한국어는 `locale=ko` 설정 계약을 유지한다.
- card renderer, public payload, visibility mutation과 Share Studio animation은 변경하지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/cardShare.test.js src/profile-ui/__tests__/heatmap.test.js src/profile-ui/__tests__/profileRoutes.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js src/profile-ui/__tests__/shareStudio.test.js
npm test
npm run test:e2e -- --grep "locale profile|locale heatmap|locale share"
npm run build
git diff --check
```

추가 수용 기준:

- owner/public Profile의 stat, 일별·주간·누적 tooltip, exact token, 공개 상태와 공유
  문구가 영어·한국어 formatter 결과와 일치한다.
- 한국어 UI는 한국어 카드 URL, 영어·fallback UI는 영어 기본 카드 URL을 사용한다.
- locale 변경 뒤 identity·usage·visibility/share 상태가 초기화되거나 다른 값으로 바뀌지 않는다.
- 기존 card renderer와 static sample asset에는 diff가 없다.

### 커밋

```text
Task #68 Stage 3: Profile과 공유 흐름 locale 통합
```

## Stage 3.1 — Profile 상태 안내 위치 보정

Stage 3 로컬 시각 검토에서 anonymous owner Profile의 `로그인 필요` 안내가 화면
중앙보다 아래에 떠 보이는 문제가 확인되었다. 원인은 공통 `.card-profile-message`가
세로 중앙 정렬과 추가 상단 margin을 사용하고, Task #61의 상단 정렬 보정은 usage
empty state에만 적용된 데 있다.

### 산출물

수정:

- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/working/task_m100_68_stage3_1.md`

### 변경 내용

- anonymous, loading, unavailable Profile 상태 안내를 usage empty state와 같은 header
  하단 content 시작점에 배치한다.
- desktop 72px, mobile 48px의 기존 Profile content top offset을 재사용한다.
- 인증 상태 판정, 로그인 URL, Profile payload와 ready/empty card UI는 변경하지 않는다.

### 검증

```bash
npm run test:e2e -- --grep "anonymous owner Profile|owner Profile loading"
npm run build
git diff --check
```

### 커밋

```text
Task #68 [Stage 3.1]: Profile 상태 안내 상단 정렬
```

## Stage 4 — 전역 locale 정합성·Sites artifact QA

### 산출물

수정:

- `src/profile-ui/messages.js` 및 활성 UI의 누락 문구
- 관련 단위·E2E 테스트
- `mydocs/working/task_m100_68_stage4.md`

### 변경 내용

- 활성 route import graph를 기준으로 사용자 노출 literal을 다시 조사한다. 테스트 fixture,
  CSS selector, API code, 고유명사와 사용자 데이터는 오탐으로 분리한다.
- 영어·한국어 사전 ID parity, 빈 번역, 미등록 ID, 사용자 화면의 메시지 ID 노출을 검증한다.
- E2E에서 `en-US`, `ko-KR`, 미지원 locale을 고정해 Home, owner/public Profile,
  Settings, device approval, Share Studio를 검증한다.
- `languagechange` 시 UI 문구, 날짜·숫자 formatter와 `<html lang>`이 함께 바뀌는지
  확인하고 수동 선택기나 browser storage locale key가 생기지 않았는지도 검증한다.
- full Node/E2E/build와 Sites fullstack/production artifact verifier를 실행한다.
- production 배포, D1/R2 migration, environment/access/secret 변경은 실행하지 않는다.

### 검증

```bash
npm test
npm run test:e2e
npm run build
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

제한 경로 확인:

```bash
git diff origin/devel -- .openai/hosting.json src/profile-backend src/profile-runtime/sites packages package.json package-lock.json public/assets
```

추가 수용 기준:

- 제한 경로 diff는 빈 출력이다.
- 영어·한국어·fallback의 활성 화면에 혼합 locale, 빈 label, 메시지 ID, raw server
  message 노출이 없다.
- `<html lang>`은 초기 렌더와 `languagechange` 후 각각 표시 언어와 일치한다.
- production artifact는 검증되지만 원격 Sites 배포나 공개 설정 변경은 없다.

### 커밋

```text
Task #68 Stage 4: 전역 locale과 Sites artifact 검증
```

## 검증

- 각 Stage 검증은 단계 보고서 작성 전에 실행하고 실패 시 같은 Stage에서 수정한다.
- Stage 보고서는 해당 Stage 소스와 함께 커밋한다.
- E2E 이름은 위 `--grep` 표현을 포함하도록 작성해 단계별 선택 실행을 보장한다.
- `npm test`의 환경 의존 skip은 기존 backend/storage 제한과 이번 변경 경로를 대조해
  단계 보고서에 기록한다.
- 계획 밖 제품 파일, 새 dependency, backend/card renderer/공식 문서 변경이 필요하면
  구현 전에 수행·구현계획 변경 승인을 요청한다.

## 커밋

- Stage 1: `Task #68 Stage 1: 전역 locale 기반과 메시지 계약 구현`
- Stage 2: `Task #68 Stage 2: 공통 화면과 온보딩 문구 이관`
- Stage 3: `Task #68 Stage 3: Profile과 공유 흐름 locale 통합`
- Stage 3.1: `Task #68 [Stage 3.1]: Profile 상태 안내 상단 정렬`
- Stage 4: `Task #68 Stage 4: 전역 locale과 Sites artifact 검증`

각 커밋은 제품 변경과 `mydocs/working/task_m100_68_stage{N}.md`를 함께 포함한다.

## 단계 의존성

- Stage 1 완료보고서 승인 전 Stage 2 소스를 수정하지 않는다.
- Stage 2 완료보고서 승인 전 Stage 3 소스를 수정하지 않는다.
- Stage 3 완료보고서 승인 전 Stage 4 정합성 보정과 전체 검증을 시작하지 않는다.
- 각 Stage에서 범위·문서 위치·외부 계약이 달라지면 다음 Stage로 진행하지 않고 계획
  변경 승인을 요청한다.

## 위험과 대응

- **초기 locale 불일치**: main과 Sites entry가 같은 resolver 결과를 Provider와
  `<html lang>`에 전달하도록 단일 bootstrap 함수를 사용한다.
- **번역 누락**: 영어·한국어 ID parity 단위 테스트와 E2E의 메시지 ID 노출 검사를 쓴다.
- **문구 이관 중 동작 회귀**: UI 구조나 상태 machine을 바꾸지 않고 기존 기능 테스트에
  locale assertion을 추가한다.
- **날짜·token 의미 변경**: 기존 raw 값과 UTC 합계 fixture를 유지하고 locale 출력만
  별도 assertion으로 추가한다.
- **한국어 card/share drift**: 공통 resolver adapter와 기존 card URL 회귀 테스트로
  renderer 계약을 격리한다.
- **오류 진단 약화**: 안정적 error code/status는 유지하고 사용자 문구만 사전에 매핑한다.
- **Sites 범위 확장**: 기존 capability path와 artifact verifier만 사용하고 hosting 배포는
  실행하지 않는다.

## 승인 요청 사항

- 위 공통 구현 계약과 4개 Stage의 파일 범위, 검증 명령, 커밋 메시지를 승인한다.
- Stage 1에서는 locale 기반·Provider·bootstrap·기반 사전만 구현하고 전체 UI 이관은
  Stage 2·3으로 분리한다.
- 신규 i18n dependency 없이 프로젝트 소유의 경량 메시지 사전을 구현한다.
- 공식 제품 문서, backend/API/D1/R2/CLI/card renderer/hosting manifest와 production
  배포를 제외한다.
- 승인 후 Stage 1 구현과 검증까지만 진행하고 단계 완료보고서에서 다음 승인을 요청한다.
