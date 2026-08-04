# Task M100 #71 통합 구현계획서 — Profile locale·format·share 계약 정리

수행계획서: [`task_m100_71.md`](task_m100_71.md)
GitHub Issue: [#71](https://github.com/postmelee/codex-usage-profile/issues/71)
연결 Issue: [#72](https://github.com/postmelee/codex-usage-profile/issues/72), [#73](https://github.com/postmelee/codex-usage-profile/issues/73)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 공통 계약 특성화와 구현계획 | Codex compact 경계 matrix, 본 구현계획서 | 앱 version·runtime matrix·정적 소비 경로·문서 diff |
| 2 | #71 숫자 축약 formatter 통합 | Profile 통계·heatmap 공용 compact formatter | formatter·heatmap unit, 경계·exact count 회귀 |
| 3 | #72 Marketing copy source 계약 | id-only quickstart와 explicit per-key override | config·Sites·onboarding unit, sample-only E2E |
| 4 | #73 Share Studio 보간·접근성 | 단일 platform 보간과 Profile Share 접근성 이름 | share unit, locale·target·접근성 E2E |
| 5 | 통합 회귀와 PR 준비 | 교차 범위 보정·최종 검증·최종 보고서 | 전체 test·E2E·production/Sites artifact |

## 문서 위치 확인

수행계획서의 문서 위치 판단과 실제 산출물 경로가 일치한다. 이번 통합 작업은 새
사용자 명령, 공개 API 또는 배포 절차를 만들지 않으므로 공식 `docs/`는 수정하지
않는다. 설치된 앱 분석은 구현 판단에 종속된 읽기 전용 근거이므로 장기 제품 문서로
확장하지 않고 이 구현계획서와 Stage 1 보고서에만 남긴다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현계획서 | `mydocs/plans/` | `task_m100_71.md`, `task_m100_71_impl.md` | OK | 세 이슈의 승인·실행 계약 |
| 단계 보고서 | `mydocs/working/` | `task_m100_71_stage1.md`~`stage5.md` | OK | 단계별 검증 근거 |
| 최종 보고서 | `mydocs/report/` | `task_m100_71_report.md` | OK | 세 이슈 수용 기준과 잔여 위험 |
| 공식 제품 문서 | 변경 없음 | 해당 없음 | OK | 명령·API·배포·사용자 흐름 비변경 |

## Stage 1 특성화 결과

### 참조 artifact와 재사용 경계

- 읽기 전용 참조 artifact는 설치된 ChatGPT/Codex 앱 `26.727.51351`과 bundled
  `codex-cli 0.146.0-alpha.9.2`다.
- production bundle은 minified artifact이며 FormatJS/`Intl.NumberFormat` 경로는
  확인되지만 Profile 전용 formatter를 안정적으로 분리해 저장소 코드로 재사용할 수
  있는 형태는 아니다. 앱 source나 고유 asset은 복사하지 않는다.
- 따라서 구현은 앱의 공개적으로 관찰 가능한 locale-native compact 표시와 현재
  Profile의 Intl runtime 결과를 계약으로 삼는다. 이는
  `Intl.NumberFormat(resolveLocale(locale), { notation: "compact",
  maximumFractionDigits: 1 })`과 동등하다.

### compact 경계 matrix

| 입력 | 영어 | 한국어 | fallback locale |
|---:|---:|---:|---:|
| `999` | `999` | `999` | `999` |
| `1,000` | `1K` | `1천` | `1K` |
| `1,500` | `1.5K` | `1.5천` | `1.5K` |
| `999,499` | `999.5K` | `99.9만` | `999.5K` |
| `999,949` | `999.9K` | `100만` | `999.9K` |
| `999,999` | `1M` | `100만` | `1M` |
| `1,000,000` | `1M` | `100만` | `1M` |
| `99,999,999` | `100M` | `1억` | `100M` |
| `999,999,999` | `1B` | `10억` | `1B` |
| `999,999,999,999` | `1T` | `1조` | `1T` |
| `1,000,000,000,000` | `1T` | `1조` | `1T` |

- fallback locale은 현재 `resolveLocale` 계약에 따라 영어다.
- 단위 직전 값이 반올림으로 다음 compact unit에 승격되는 결과를 그대로 유지한다.
  수동 나눗셈으로 `1000K`, `1000M`, `10000만`, `10000억`을 만들지 않는다.
- exact token count는 compact formatter를 사용하지 않고 locale별 그룹 구분자가 있는
  반올림 없는 정수로 유지한다.

### 현재 중복과 회귀 원인

- Profile 통계는 이미 공용 `formatCompactNumber`의 Intl compact 경로를 사용한다.
- heatmap tooltip의 `formatTokenCount`는 영어 `K/M/B/T`, 한국어 `만/억/조`를
  수동 선택하고 있어 임계값 승격과 한국어 `천` 단위가 공용 경로와 다르다.
- Marketing은 normalized `copy` 값과 `DEFAULT_MARKETING_COPY` 문자열의 값 동등성을
  비교해 caller가 명시한 override 의도를 잃는다.
- Share Studio는 `{platform}`을 placeholder 자기 값으로 먼저 보간한 다음 React에서
  `.replace`해 두 번 처리하며, Profile Share 버튼의 접근성 이름은 보이는 `Share`와
  동일해 문맥을 충분히 설명하지 못한다.

## 공통 구현 계약

### #71 compact와 exact number

- `src/profile-ui/formatters.js`의 `formatCompactNumber`를 Profile 통계와 heatmap
  compact tooltip의 단일 진실 원천으로 사용한다.
- `heatmap.js`의 수동 단위 선택을 제거하고 compact tooltip은 공용 helper에 위임한다.
- exact tooltip은 기존 localized integer 경로를 유지하며 원본 token 값, bucket,
  level, Daily/Weekly/Cumulative mode 계산은 변경하지 않는다.
- 숫자가 아니거나 음수인 입력의 기존 정규화·오류 계약은 focused test로 보존한다.

### #72 Marketing copy source

- 공개 입력 `createMarketingConfig({ copy })`는 유지한다.
- normalized config에는 완성된 `copy`와 별도로 caller가 명시한 key만 담는 immutable
  `copyOverrides`를 둔다. `copy`가 생략되면 override map은 비어 있다.
- `resolveMarketingCopy`는 값 비교 없이 `copyOverrides`의 own key 여부로 source를
  결정한다. 명시 key는 custom 문자열을, 누락 key는 현재 locale catalog를 사용한다.
- custom 값이 기본 영어 문자열과 같아도 명시 override로 처리한다.
- `MARKETING_QUICKSTART_STEPS`는 실제 소비되는 안정적인 `id`만 보존한다. title과
  description은 locale message catalog를 단일 진실 원천으로 사용한다.
- sample-only Marketing, canonical app CTA, API 요청 없음 계약은 변경하지 않는다.

### #73 Share Studio interpolation과 접근성

- platform이 필요한 message key는 `shareInstructionsTitle`, `openComposer` 두 개로
  제한하고 `formatShareStudioPlatformMessage(locale, key, platform)`에서 최종 문자열을
  한 번만 `formatMessage`한다.
- `getShareStudioCopy`는 platform과 무관한 문자열만 즉시 해석한다. React render 지점은
  target label과 locale을 위 helper에 넘기며 `.replace`를 사용하지 않는다.
- X, LinkedIn, Reddit의 label, destination URL, social payload와 새 창 속성은 유지한다.
- message catalog에 `common.shareProfile`을 영어·한국어로 추가하고 Profile topbar의
  Share 버튼 접근성 이름에 사용한다. 보이는 `common.share` 문구는 유지한다.
- locale catalog key parity와 placeholder 검증을 통과해야 한다.

## Stage 1 — 공통 계약 특성화와 구현계획

### 산출물

신규:

- `mydocs/plans/task_m100_71_impl.md`
- `mydocs/working/task_m100_71_stage1.md`

### 변경 내용

- 설치 앱 version, 재사용 경계와 runtime compact 경계 matrix를 기록한다.
- #71·#72·#73의 current consumer, 변경 계약, test matrix와 commit 경계를 고정한다.
- 수행계획서에 승인된 #74·배포 제외 범위와 문서 위치 판단을 유지한다.

### 검증

```bash
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
  /Applications/ChatGPT.app/Contents/Info.plist
/Applications/ChatGPT.app/Contents/Resources/codex --version
node --input-type=module -e '<compact 경계 matrix 확인 script>'
rg -n 'formatCompactNumber|formatTokenCount|DEFAULT_MARKETING_COPY|resolveMarketingCopy|formatCopy|platform' \
  src/profile-ui src/profile-marketing tests/profile-ui.spec.js
git diff --check
```

### 커밋

```text
Task #71 Stage 1: 통합 locale 계약과 구현계획 확정
```

## Stage 2 — #71 숫자 축약 formatter 통합

### 산출물

수정:

- `src/profile-ui/formatters.js`
- `src/profile-ui/heatmap.js`
- `src/profile-ui/__tests__/formatters.test.js`
- `src/profile-ui/__tests__/heatmap.test.js`

신규:

- `mydocs/working/task_m100_71_stage2.md`

### 변경 내용

- heatmap compact tooltip을 `formatCompactNumber`에 위임하고 수동 unit formatter를
  제거한다.
- 영어·한국어·fallback locale과 단위 직전·직후 반올림 승격 matrix를 table-driven
  test로 고정한다.
- compact off 상태의 exact localized integer와 heatmap mode·level 계산을 보존한다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/formatters.test.js \
  src/profile-ui/__tests__/heatmap.test.js
git diff --check
```

### 커밋

```text
Task #71 Stage 2: Profile 숫자 축약 formatter 통합
```

## Stage 3 — #72 Marketing copy source 계약 정리

### 산출물

수정:

- `src/profile-marketing/marketing-config.js`
- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-marketing/__tests__/marketing-config.test.js`
- `src/profile-marketing/__tests__/sites-config.test.js`
- `src/profile-ui/homeOnboarding.js`
- `src/profile-ui/__tests__/homeOnboarding.test.js`
- 필요 시 `tests/profile-ui.spec.js`

신규:

- `mydocs/working/task_m100_71_stage3.md`

### 변경 내용

- Quickstart step을 id-only frozen record로 줄이고 dead title·description을 제거한다.
- normalized config에 frozen `copyOverrides`를 추가하고 per-key explicit source로
  Marketing copy를 선택한다.
- undefined copy, partial custom, 전 key custom, 기본 영어값과 동일한 explicit custom,
  invalid key value의 계약을 unit test로 고정한다.
- 영어·한국어 Marketing과 Home onboarding이 locale catalog를 사용하며 Sites build가
  sample-only이고 API 요청을 만들지 않는지 회귀 검증한다.

### 검증

```bash
node --test \
  src/profile-marketing/__tests__/marketing-config.test.js \
  src/profile-marketing/__tests__/sites-config.test.js \
  src/profile-ui/__tests__/homeOnboarding.test.js
npx playwright test tests/profile-ui.spec.js --grep 'marketing|sample-only'
git diff --check
```

### 커밋

```text
Task #71 Stage 3: Marketing copy source 계약 명시화
```

## Stage 4 — #73 Share Studio 보간·접근성 정리

### 산출물

수정:

- `src/profile-ui/shareStudio.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/messages.js`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `src/profile-ui/__tests__/i18n.test.js`
- `src/profile-ui/__tests__/cardShare.test.js`
- `tests/profile-ui.spec.js`

신규:

- `mydocs/working/task_m100_71_stage4.md`

### 변경 내용

- platform message 전용 formatter를 추가하고 placeholder 자기 치환과 React의 수동
  `.replace`를 제거한다.
- 영어·한국어에서 X, LinkedIn, Reddit instruction/composer 문자열을 실제 platform
  이름으로 한 번만 보간하는지 검증한다.
- `common.shareProfile` catalog key와 Profile Share 버튼 접근성 이름을 추가한다.
- 기존 destination URL, visible Share 문구, dialog focus·keyboard·publish 상태를
  보존한다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/i18n.test.js \
  src/profile-ui/__tests__/cardShare.test.js
npx playwright test tests/profile-ui.spec.js --grep 'Share Studio|share button|accessib'
git diff --check
```

### 커밋

```text
Task #71 Stage 4: Share Studio 단일 보간과 접근성 정리
```

## Stage 5 — 통합 회귀와 PR 준비

### 산출물

수정:

- Stage 2~4 회귀 발견 시 승인 범위 안의 관련 source·test
- `mydocs/orders/20260804.md`

신규:

- `mydocs/working/task_m100_71_stage5.md`
- 최종 단계 승인 후 `mydocs/report/task_m100_71_report.md`

### 변경 내용

- 세 이슈의 focused test를 한 번 더 함께 실행해 공통 locale catalog와 consumer 간
  교차 회귀를 확인한다.
- 전체 Node, browser E2E, production build와 Sites verifier를 실행한다.
- #71·#72·#73 수용 기준, 제외 범위와 잔여 위험을 최종 보고서에 기록한다.
- 최종 PR은 `devel` 대상 `publish/task71`로 게시하고 `Closes #71`, `Closes #72`,
  `Closes #73`을 각각 명시한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

추가 확인:

- Stage 시작점 대비 package·lockfile, backend/API, CLI, card renderer,
  `.openai/hosting.json`과 배포 설정 diff가 없다.
- tracked working tree가 깨끗하고 세 이슈의 수용 기준이 test·보고서에 연결된다.

### 커밋

```text
Task #71 Stage 5: 통합 locale 회귀 검증 완료
```

최종 보고서 커밋은 `task-final-report` 절차의 형식을 따른다.

## 단계 의존성

- Stage 2는 Stage 1의 compact 경계 matrix와 구현계획 승인 후 진행한다.
- Stage 3은 Stage 2의 formatter 통합 검증과 단계 승인 후 진행한다.
- Stage 4는 Stage 3의 copy source 계약 검증과 단계 승인 후 진행한다.
- Stage 5는 Stage 4의 보간·접근성 검증과 단계 승인 후 진행한다.
- #74와 production 배포는 이 통합 PR merge 후 별도 타스크에서 진행한다.

## 위험과 대응

- **minified 앱 artifact 오판**: 내부 구현 복사를 피하고 version·UI 관찰·Intl runtime
  경계값을 함께 계약으로 기록한다.
- **compact rollover drift**: 대표 단위값뿐 아니라 직전 반올림 승격값을 test한다.
- **config shape 하위 호환**: 기존 `copy`와 public factory input을 유지하고 additive
  `copyOverrides`만 내부 source 판별에 사용한다.
- **partial override locale 손실**: own key만 custom으로 처리하고 누락 key는 catalog로
  복구하는 영어·한국어 test를 둔다.
- **placeholder 누락**: platform 전용 key를 allowlist하고 locale catalog parity와 세
  platform의 실제 결과를 test한다.
- **통합 PR 원인 추적 저하**: 이슈별 Stage·커밋·focused validation을 분리한다.

## 승인 요청 사항

- Stage 1의 Codex compact 경계 matrix와 fallback·exact count 계약
- #71의 공용 formatter 위임, #72의 additive `copyOverrides`, #73의 platform 전용
  formatter와 `common.shareProfile` 설계
- Stage 2~5의 파일 범위, 검증 명령과 커밋 경계
- #74·배포와 backend/API/card renderer를 제외하는 범위 유지
