# Task #99 구현계획서 — Home과 Profile에 최근 업데이트 시각 표시

- 수행계획서: [`task_m100_99.md`](task_m100_99.md)
- GitHub Issue: [#99](https://github.com/postmelee/codex-usage-profile/issues/99)
- 마일스톤: M100 — v1.0 MVP
- 상태: 구현 승인 대기

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | timestamp 표시 계약과 공통 컴포넌트 | formatter, locale 문구, `LastUpdatedTime`, 단위 테스트 | ko/en·timezone·invalid, `<time dateTime>` |
| 2 | Home 최근 업데이트 표시 | authenticated Home 연결, tertiary 스타일, Home 회귀 | ready/empty/error, mobile·theme·reduced motion |
| 3 | owner/public Profile과 Skeleton 정합 | Profile identity 세 번째 행, Skeleton slot, route·geometry 회귀 | owner/public/preview, loading→ready geometry |
| 4 | 통합 회귀·production artifact 검증 | 전체 검증, 로컬/모바일 handoff, 승인 근거 | Node·Playwright·build·Sites verify/smoke |

## 표시 계약 불변식

### 시각과 locale

- 표시 기준은 owner/public profile 응답의 `usage.uploadedAt`만 사용한다.
- `capturedAt`, owner `updatedAt`, 카드 미디어 revision 시각은 표시 계산에 사용하지 않는다.
- 포맷터는 UI locale을 `en-US` 또는 `ko-KR`로 해석하고 월·일·시·분을
  `Intl.DateTimeFormat` 의 locale 기본 시계로 표시한다.
- production에서 timezone option을 주입하지 않아 브라우저 현지 시간대를 사용한다.
  단위 테스트는 `timeZone` option으로 `Asia/Seoul`·`UTC`를 명시해 결정적으로 실행한다.
- null·빈 문자열·무효 날짜·무효 `timeZone`은 formatter 결과 `null`이며 표시하지 않는다.
- `datetime`은 유효성이 검증된 API ISO 문자열을 보존한다. 표시용 문자열만
  현지화하며 상대 시간·자동 갱신 타이머를 만들지 않는다.

### DOM·레이아웃

- `LastUpdatedTime` 컴포넌트는 유효한 값에서만 `<time dateTime={uploadedAt}>`을 렌더링한다.
- Home은 owner profile이 ready이고 usage가 있으며 formatter가 유효한 경우에만 카드 아래,
  identity 위에 중앙 정렬한다. anonymous·loading·empty·error에서는 slot도 만들지 않는다.
- Profile은 이름·handle 아래에 update slot을 두고, 유효한 시각이 없어도 사용량
  Profile의 identity 기하가 급변하지 않도록 최소 높이를 유지한다. 빈 slot은
  스크린리더에 노출되지 않는다.
- `ProfileLoadingSkeleton`의 update placeholder는 ready update slot과 같은 행·높이·간격을 사용한다.
  Profile header·stats·activity·card의 기존 좌표는 허용 오차 내에서 유지한다.

### 시각적 위계·motion

- update text는 site `--text-tertiary`, 작은 글꼴과 정상 자간을 사용하고 링크·버튼처럼 보이지 않게 한다.
- 테마 전환 중 update text는 기존 semantic text와 같은 240ms color window에서 전환되되,
  상태색·card-internal text를 포함하는 전역 selector를 추가하지 않는다.
- 새로운 translate·scale·stagger·단독 opacity motion을 추가하지 않는다. `prefers-reduced-motion`
  설정에서도 레이아웃과 문구는 같다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_99*.md` | OK | 내부 구현·승인 경계 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_99_stage{N}.md` | OK | 단계별 증거와 함께 커밋 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_99_report.md` | OK | 전체 검증·PR 근거 |
| README·공개 문서 | 변경 없음 | 해당 없음 | OK | 기존 API·사용자 흐름·외부 계약 유지 |

## Stage 1 — timestamp 표시 계약과 공통 컴포넌트

### 산출물

신규:

- `src/profile-ui/LastUpdatedTime.jsx`
- `src/profile-ui/__tests__/lastUpdatedTime.test.js`
- `mydocs/working/task_m100_99_stage1.md`

수정:

- `src/profile-ui/formatters.js`
- `src/profile-ui/messages.js`
- `src/profile-ui/__tests__/formatters.test.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- `formatLastUpdatedAt(uploadedAt, locale, options)` 순수 함수를 추가한다. 함수는 유효한
  문자열만 해석하고 `{ dateTime, label }` 또는 `null`을 반환한다.
- 표시 날짜는 `month: "short|long"`, `day: "numeric"`, `hour: "numeric"`,
  `minute: "2-digit"`를 locale별로 적용한다. prefix와 구분자는 `messages.js`의
  하나의 interpolation 문구로 조합한다.
- invalid date·timezone에서 `RangeError`를 외부로 던지지 않고 `null`을 반환한다.
- `LastUpdatedTime` 컴포넌트는 locale context와 formatter를 결합하고, 유효한 값에만
  호출자가 지정한 class와 `<time dateTime>`을 출력한다.
- formatter 테스트는 ko/en·`Asia/Seoul`·`UTC`·DST 비의존 예시·invalid를 고정한다.
  컴포넌트 테스트는 두 locale의 문구, `datetime`, invalid 비렌더링을 검증한다.

### 검증

```bash
node --test src/profile-ui/__tests__/formatters.test.js src/profile-ui/__tests__/lastUpdatedTime.test.js
git diff --check
```

### 커밋

```text
Task #99 Stage 1: 최근 업데이트 표시 계약 고정
```

## Stage 2 — Home 최근 업데이트 표시

### 산출물

신규:

- `mydocs/working/task_m100_99_stage2.md`

수정:

- `src/profile-ui/HomePage.jsx`
- `src/styles.css`
- `src/profile-ui/__tests__/homeOnboarding.test.js` 또는 Home 표시를 담당하는 기존 단위 테스트
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- `AuthenticatedHome`에 owner `profile.usage.uploadedAt`을 전달하고, 유효한 ready usage일 때
  identity 위에 `LastUpdatedTime`을 렌더링한다.
- 업데이트 표시는 카드와 identity 중앙선에 맞추고 `--text-tertiary`·작은 글꼴·
  안전한 줄바꿈을 사용한다. Home의 카드·share handoff·identity·action 좌표는 제외한다.
- loading·idle·error·no usage에서 update text가 없는지, authenticated ready 전환 중 이전
  시각이 잔류하지 않는지 단위 및 Playwright로 검증한다.
- desktop/mobile에서 ko/en 줄바꿈과 정렬을 검증하고, light↔dark 중 tertiary text가
  기존 240ms theme transition 창 안에서 변환되며 reduced motion에서 즉시 변환되는지 확인한다.

### 검증

```bash
node --test src/profile-ui/__tests__/lastUpdatedTime.test.js src/profile-ui/__tests__/homeOnboarding.test.js src/profile-ui/__tests__/theme.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #99.*Home" --workers=1
git diff --check
```

### 커밋

```text
Task #99 Stage 2: Home 최근 업데이트 표시 연결
```

## Stage 3 — owner/public Profile과 Skeleton 정합

### 산출물

신규:

- `mydocs/working/task_m100_99_stage3.md`

수정:

- `src/profile-ui/AccountUsageProfile.jsx`
- `src/profile-ui/ProfileHeader.jsx`
- `src/profile-ui/ProfileLoadingSkeleton.jsx`
- `src/styles.css`
- `src/profile-ui/__tests__/profileRoutes.test.js`
- `src/profile-ui/__tests__/publicProfileRoutes.test.js`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- `AccountUsageProfile` → `ProfileHeader`로 `usage.uploadedAt`을 전달하고 Profile heading에
  `LastUpdatedTime`을 렌더링한다. 이 공통 경로로 owner, public, private-owner-preview를 모두
  커버하고 페이지별 복제 표시를 만들지 않는다.
- Profile heading update slot에 안정적인 최소 높이를 부여하고, 시각이 무효한 경우
  비어 있는 자리만 유지하여 문구를 위조하지 않는다.
- `ProfileLoadingSkeleton`에 update row placeholder를 추가하고 실제 update slot과 height·margin·width
  계약을 맞춘다. 기존 page-theme Skeleton palette·shimmer·reduced-motion 계약을 재사용한다.
- route 단위 테스트로 owner/public의 valid·invalid·loading 마크업을 고정한다. Playwright는
  Skeleton→ready에서 header 아래 stats·activity·card 시작 좌표가 허용 오차 이내인지 비교한다.
- mobile에서 update text가 한 줄을 우선하되 320px 폭에서 필요하면 자연스럽게
  줄바꿈되고 이름·handle·stats를 가리지 않는지 확인한다.

### 검증

```bash
node --test src/profile-ui/__tests__/lastUpdatedTime.test.js src/profile-ui/__tests__/profileRoutes.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js src/profile-ui/__tests__/theme.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #99.*Profile" --workers=1
git diff --check
```

### 커밋

```text
Task #99 Stage 3: Profile 최근 업데이트와 Skeleton 정합
```

## Stage 4 — 통합 회귀·production artifact 검증

### 산출물

신규:

- `mydocs/working/task_m100_99_stage4.md`

수정:

- 검증 중 재현된 Task #99 범위의 최소 보정 파일
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- 전체 Node·Playwright·production Sites build·artifact verifier·local full-stack smoke를 실행한다.
- Chromium과 WebKit에서 Home·owner/public Profile의 ko/en, light/dark, reduced motion을 재검증한다.
- API·DB·migration·카드 PNG·social image·OG metadata 파일이 diff에 포함되지 않았는지
  검사한다.
- 로컬 runtime을 LAN 접속 가능하게 실행하고 작업지시자에게 Home·owner/public Profile
  확인 URL과 모바일 체크리스트를 제공한다. 실제 Sites 배포는 이 Stage의 자동 범위가 아니며
  별도 배포 승인 전에는 실행하지 않는다.
- #100·#101과 병합할 때 `mydocs/orders/20260813.md`와 `tests/profile-ui.spec.js`를 현재 devel 기준으로
  재검토할 수 있도록 최종 보고서에 충돌 예상 지점을 기록한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #99" --workers=1
git diff --check
git status --short
```

### 커밋

```text
Task #99 Stage 4: 최근 업데이트 통합 검증 handoff
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 실제 생성된 테스트 파일이 예상 경로와 다르면 단계 보고서에 이유를 기록하고,
  범위·설계가 달라지면 구현계획서를 먼저 갱신해 승인받는다.
- 통합 검증에서 정보를 표시하는 backend·media·OG diff가 발생하면 즉시 중단하고
  범위 확장 승인을 받는다.

## 커밋

- 단계 커밋은 해당 Stage 소스·테스트·`mydocs/working/task_m100_99_stage{N}.md`·
  `mydocs/orders/20260813.md` 상태 갱신을 함께 묶는다.
- 커밋 메시지는 `Task #99 Stage {N}: {content}` 형식을 따른다.
- 단계 필수 검증과 `git diff --check`가 통과하고 단계 보고서가 작성된 뒤에만
  커밋한다.

## 단계 의존성

- Stage 2는 Stage 1의 formatter·locale·컴포넌트 계약 확정 후 진행한다.
- Stage 3은 Stage 1의 공통 컴포넌트를 사용하고 Stage 2 승인 후 진행한다.
- Stage 4는 Stage 1–3의 검증·보고·승인이 완료된 후 진행한다.
- 각 Stage 사이에 `task-stage-report` 절차로 단계 보고서와 소스 커밋을 묶고
  작업지시자 승인을 받는다.

## 위험과 대응

- **문구·날짜 중복 조합**: `Intl.DateTimeFormat` 산출물에 prefix를 문자열로 직접
  이어 붙이지 않고 locale message interpolation으로 조합한다.
- **무효 시각 레이아웃**: 무효 값은 표시하지 않되 Profile slot의 기하는 유지해
  loading→ready 이동을 줄인다.
- **공유 컴포넌트 과잉 설계**: Home과 Profile의 외부 layout class는 호출자가 소유하고,
  `LastUpdatedTime`은 문구·시각대·시맨틱 마크업만 소유하게 해 surface 결합을 막는다.
- **공유 E2E 충돌**: #100·#101의 `tests/profile-ui.spec.js`·orders 변경을 덮어쓰지 않고,
  병합 시 현재 devel 기준으로 세 task의 assertion을 모두 보존한다.
- **검증 시간 증가**: 포괄 조합은 Stage 4로 제한하고 Stage 1–3은 수정 표면의
  집중 테스트로 빠른 피드백을 얻는다.

## 승인 요청 사항

- 위 4단계 분할과 단계별 산출물·검증·커밋 메시지
- formatter의 invalid·timezone `null` 계약과 locale message interpolation
- Home은 ready valid usage에서만 표시하고 Profile은 표시 여부와 관계없이 identity
  update slot 기하를 유지하는 정책
- Stage 4에서 로컬/LAN 모바일 확인은 준비하되, 실제 Sites 배포는 별도 승인 전에
  실행하지 않는 경계

승인되면 Stage 1부터 시작하고, 각 Stage 완료 시 `task-stage-report` 절차로 검증·
보고·커밋 후 다음 단계 승인을 요청한다.
