# Task M100 #61 구현계획서

수행계획서: [`task_m100_61.md`](task_m100_61.md)
GitHub Issue: [#61](https://github.com/postmelee/codex-usage-profile/issues/61)
마일스톤: M100

## 승인된 결정과 구현 해석

작업지시자가 승인한 수행계획서와 권고안을 다음 구현 경계로 고정한다.

- 기존 `ProfileShell`의 topbar만 공통 전역 header로 사용하고 병렬 shell이나
  별도 navigation 체계를 만들지 않는다.
- 공통 header의 `Codex Usage` brand는 모든 제품 route에서 `/`로 이동하는
  link다. 각 route의 실제 제목은 main content 안의 단일 `h1`으로 둔다.
- owner `/profile`, public `/?profile={handle}`·legacy `/u/{handle}`와 Settings는
  fullscreen document canvas를 사용한다. 기존 card, account/token/device
  panel과 Share 동작은 내부 surface로 유지한다.
- Device Approve는 공통 header 아래의 fullscreen canvas를 사용하되 승인
  form을 감싸는 중앙 작업 card는 유지한다. device challenge, OAuth return,
  approval state와 완료 안내 계약은 변경하지 않는다.
- 계정 menu는 `Profile` → `Settings` → `Log out` 순서를 사용한다. menu가
  열리면 첫 item으로 focus하고 ArrowUp/ArrowDown·Home/End를 지원하며 Escape는
  menu를 닫고 trigger로 focus를 돌려준다. Tab을 가두지 않는다.
- Settings의 page heading은 `Settings`, GitHub 동기화 identity section은
  `GitHub account`로 구분한다.
- `.openai/hosting.json`, app-owned GitHub OAuth, backend/API, D1/R2, canonical
  origin과 card renderer는 변경하지 않는다. Sites production artifact까지
  검증하되 save/deploy/access 변경은 수행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 공통 header와 계정 menu 계약 | brand Home link, Profile menuitem, keyboard focus | focused Playwright, build |
| 2 | Profile·Settings page canvas 정렬 | fullscreen owner/public/settings, semantic heading | route·mutation·responsive E2E |
| 3 | Device Approve 공통 shell 통합 | global header, 중앙 approval card, auth callback | device unit·E2E, build |
| 4 | 통합 browser·Sites artifact QA | 전체 회귀와 비배포 경계 증적 | test/E2E/build/artifact/local smoke |

각 Stage는 소스와 `mydocs/working/task_m100_61_stage{N}.md`를 함께
커밋한다. 단계 보고 후 작업지시자 승인 없이는 다음 Stage로 진행하지 않는다.

## 문서 위치 확인

수행계획서에서 승인한 문서 위치를 그대로 사용한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_61*.md` | OK | 범위·결정·단계 승인 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_61_stage{N}.md` | OK | 단계별 구현·검증 증적 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_61_report.md` | OK | 모든 Stage 승인 후 작성 |
| 공식 제품 문서 | 변경하지 않음 | 해당 없음 | OK | route·API·사용자 실행 계약 불변 |

`README.md`, `docs/`, `mydocs/manual/`과 architecture/API/roadmap 문서는
수정하지 않는다. 구현 중 공개 route나 사용자 실행 절차 변경이 필요해지면
해당 Stage를 중단하고 문서 위치를 포함한 계획 변경 승인을 받는다.

## Stage 1 — 공통 header와 계정 menu 계약

### 산출물

신규:

- `mydocs/working/task_m100_61_stage1.md`

수정:

- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/AccountMenu.jsx`
- `src/profile-ui/Icons.jsx` — 기존 `user` icon으로 Profile 의미를 충분히
  표현할 수 없는 경우에만 최소 수정
- `src/styles.css`
- `tests/profile-ui.spec.js`

### 변경 내용

- `ProfileShell` topbar의 첫 요소를 route title이 아닌 항상 동일한
  `Codex Usage` Home link로 만든다. topbar가 `h1`을 소유하지 않게 하고
  main content가 route별 heading을 소유하도록 책임을 분리한다.
- fullscreen header의 높이, sticky 위치, content width와 action slot을 공통
  contract로 고정한다. 기존 Home의 brand, account 상태와 Share action 동작은
  유지한다.
- 비-home route에 별도로 표시되던 `Home` navigation은 brand link와 기능이
  중복되므로 제거한다. 이 변경은 route 자체를 제거하지 않는다.
- 인증된 계정 menu에 `Profile` link를 `Settings` 앞에 추가하고 기본 href를
  `/profile`로 둔다. 기존 Settings href와 logout API는 유지한다.
- trigger와 menuitem ref를 관리해 open 시 첫 item focus,
  ArrowUp/ArrowDown 순환, Home/End 이동과 Escape trigger focus 복원을
  구현한다. 외부 pointer는 menu만 닫고 사용자가 선택한 외부 target focus를
  빼앗지 않으며, Tab은 native 이동을 허용한다.
- menu action, disabled logout과 error feedback의 기존 동작을 보존하고
  `aria-expanded`, `aria-controls`, `role=menu/menuitem`을 실제 open 상태와
  일치시킨다.
- Playwright에서 item 순서와 href, pointer 진입, keyboard 순환, Escape focus
  복원, 외부 click, logout 요청 1회와 mobile header를 검증한다.

### 검증

```bash
npm run test:e2e -- --grep "account menu|Home stays readable"
npm run build
git diff --check
```

focused E2E는 anonymous/loading/unavailable account surface를 포함한 기존
header 회귀도 유지한다. menu keyboard 구현을 위해 별도 pure helper가
실제로 필요해지는 경우에만 `src/profile-ui/accountMenu.js`와 대응 unit test를
추가하며 Stage 범위를 넓히지 않는다.

### 커밋

```text
Task #61 Stage 1: 공통 header와 계정 menu 접근성 정렬
```

### Stage 1.1 시각 피드백 보정

작업지시자의 Stage 1 로컬 검토에 따라 계정 menu에서 임시로 작성한 SVG path를
사용하지 않고 ChatGPT macOS 앱의 제3자 고지에도 포함된 공개
`lucide-react` 아이콘을 사용한다. 앱 bundle 내부 자산은 복사하지 않으며,
`UserRound`·`Settings`·`LogOut`을 menu 의미에 맞게 적용한다. 변경 범위는
`AccountMenu`, dependency manifest·lockfile과 focused E2E assertion으로
제한하고 다른 surface의 기존 icon은 후속 범위로 확장하지 않는다.

```text
Task #61 [Stage 1.1]: 계정 menu 공식 icon set 적용
```

작업지시자의 후속 로컬 검토에서 Lucide icon의 15px box와 menu text의 18px
line box가 flex 시작점에 맞춰진 시각 불일치가 확인되었다. Stage 1.2에서는
menu row의 수직 중심선을 명시하고 실제 browser bounding box 중심 차이를
검증한다. icon 종류·크기·menu 기능과 Stage 2 범위는 변경하지 않는다.

```text
Task #61 [Stage 1.2]: 계정 menu icon과 text 중심선 정렬
```

## Stage 2 — Profile·Settings page canvas 정렬

### 산출물

신규:

- `mydocs/working/task_m100_61_stage2.md`

수정:

- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/SettingsPage.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`

필요한 경우에만 수정:

- `src/profile-ui/ProfilePage.jsx` — production import 또는 유지 중인 test가
  같은 shell contract를 요구할 때만 적용

### 변경 내용

- owner Profile, public Profile과 Settings가 `ProfileShell`의 fullscreen
  document canvas를 사용하도록 해 화면 전체를 감싸는 border, radius,
  shadow와 내부 frame scroll을 제거한다.
- owner Profile의 ready/loading/empty/error 상태에 page 수준 단일 `h1`을
  제공한다. ready 상태의 `Your Codex card`, visibility, preview와 publish
  action의 기능·문구는 유지한다.
- public Profile의 ready heading `Codex card for {displayName}`과
  loading/unavailable heading을 각각 단일 `h1`으로 올린다. 공개 payload
  최소화와 stable card URL 계약은 변경하지 않는다.
- Settings main heading을 `Settings`로 두고 GitHub identity panel에
  `GitHub account` section heading을 추가한다. identity sync note,
  API token과 device list의 load/create/edit/revoke 동작은 변경하지 않는다.
- page content max-width와 vertical spacing을 document scroll 기준으로
  조정한다. 1280×900, 390×844와 1280×620에서 sticky header가 content를
  가리지 않고 horizontal overflow가 없도록 한다.
- Share Studio의 source card, open/close, inert와 z-index가 fullscreen 전환
  뒤에도 유지되는지 회귀 검증한다.

### 검증

```bash
npm run test:e2e -- --grep "Profile|profile|Settings|app surfaces|Share Studio"
npm run build
git diff --check
```

E2E에는 owner ready/empty/error, public ready/loading/unavailable,
Settings anonymous/authenticated와 token/device mutation의 기존 대표
시나리오를 포함한다. viewport별로 document scroll과 body overflow를
검증하고 repository에 screenshot asset을 추가하지 않는다.

### 커밋

```text
Task #61 Stage 2: Profile과 Settings page canvas 정렬
```

## Stage 3 — Device Approve 공통 shell 통합

### 산출물

신규:

- `mydocs/working/task_m100_61_stage3.md`

수정:

- `src/App.jsx`
- `src/profile-ui/DeviceApprovalPage.jsx`
- `src/profile-ui/__tests__/deviceApproval.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`

### 변경 내용

- `DeviceApprovalPage`를 공통 `ProfileShell`의 fullscreen canvas 안에
  합성하고 Share action을 숨긴다. header brand Home link와 인증 상태별
  account surface를 다른 route와 동일하게 제공한다.
- `App`에서 기존 `handleAuthStateChange`를 Device Approve에도 전달해 공통
  account menu의 logout 뒤 app auth state가 일치하도록 한다. 새로운 auth
  request나 redirect 경로는 추가하지 않는다.
- `Authorize device`를 main content의 단일 `h1`으로 유지한다. form을 감싸는
  `device-panel`은 집중 작업 card로 남기되 app 전체를 감싸는 별도 window처럼
  보이지 않도록 크기·border·radius·padding만 정렬한다.
- query의 `user_code`, GitHub login return path, double-submit guard,
  retryable/terminal error, approved/exchanged success, intent별 안내, clipboard,
  Home/Profile link와 no-auto-redirect 계약은 그대로 보존한다.
- 공통 header 도입 후 form label/live region/focus 순서, mobile/short viewport,
  reduced-motion과 document overflow를 검증한다.

### 검증

```bash
node --test src/profile-ui/__tests__/deviceApproval.test.js
npm run test:e2e -- --grep "device approval"
npm run build
git diff --check
```

focused Playwright는 authenticated/anonymous, submit/login/null intent,
double click, retry, terminal error, clipboard, reduced-motion, Home/Profile
link와 account logout state를 포함한다. backend authorize request·response
shape는 변경하지 않는다.

### 커밋

```text
Task #61 Stage 3: Device Approve 공통 shell 통합
```

## Stage 4 — 통합 browser·Sites artifact QA

### 산출물

신규:

- `mydocs/working/task_m100_61_stage4.md`

수정:

- Stage 1~3 검증이 승인 범위 안의 stale assertion 또는 layout 회귀를
  드러낸 경우에 한해 해당 UI test와 `src/styles.css`

### 변경 내용

- `/`, `/profile`, `/?profile={handle}`, `/u/{handle}`, `/?view=settings`,
  `/settings`와 `/?view=device`를 desktop/mobile/short viewport에서 다시
  검증한다.
- global header brand Home link, route별 단일 `h1`, account menu 순서·focus,
  document scroll, no horizontal overflow와 내부 card/panel 보존을 통합
  확인한다.
- Share Studio, Settings mutation과 Device Approve state machine의 대표
  시나리오를 전체 Playwright에서 재검증한다.
- root unit test, standard build, production Sites full-stack build와 artifact
  verifier, local full-stack smoke를 실행한다.
- `.openai/hosting.json`, auth/backend/API, D1/R2 schema, card renderer와
  canonical origin에 변경이 없고 Sites save/deploy/access 또는 remote data
  작업이 수행되지 않았음을 diff와 Stage 보고서에 기록한다.
- 통합 검증이 승인 범위 밖 변경을 요구하면 임의 보정하지 않고 Stage를
  중단해 계획 변경 승인을 요청한다.

### 검증

```bash
npm test
npm run test:e2e
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
git diff --check
git diff origin/devel -- \
  .openai/hosting.json \
  db/migrations \
  packages/codex-usage-profile-cli \
  src/profile-backend \
  src/profile-runtime \
  src/profile-ui/deviceApproval.js
```

마지막 보호 경계 diff는 빈 출력이어야 한다. test skip, 환경 제약이나 외부
dependency 한계는 Stage 보고서에 정확히 기록하고 실패 또는 미실행을 통과로
표현하지 않는다. Sites hosting 단계는 명시적으로 생략한다.

### 커밋

```text
Task #61 Stage 4: 공통 page shell 통합 검증 완료
```

## 단계 의존성과 중단 조건

- Stage 2는 Stage 1의 global header와 account menu 접근성 계약 승인 후
  진행한다.
- Stage 3는 Stage 1 공통 shell API가 확정된 뒤 시작하며 Stage 2 layout token을
  재사용한다. Stage 2 승인 내용을 되돌리지 않는다.
- Stage 4는 Stage 1~3 단계 보고 승인 후 실행한다.
- 공통 header 구현이 route 변경, 새 auth state, backend/API 또는 database
  변경을 요구하면 즉시 중단한다.
- fullscreen 전환이 Share Studio나 Settings mutation을 유지할 수 없거나
  card renderer 변경을 요구하면 임의로 범위를 넓히지 않고 계획 변경 승인을
  요청한다.
- production Sites build가 실제 hosting/deploy를 요구하더라도 Task #61에서는
  실행하지 않고 후속 공개 release Gate로 넘긴다.

## 최종 불변 조건

- 모든 제품 route는 동일한 `Codex Usage` Home link와 account surface를 가진다.
- 각 route의 main landmark에는 상태별로 의미가 맞는 단일 page `h1`이 있다.
- account menu는 `Profile` → `Settings` → `Log out` 순서이며 pointer와
  keyboard로 접근 가능하다.
- owner/public Profile과 Settings에는 page 전체를 감싸는 큰 window frame이
  없고 기존 내부 card/panel·mutation 동작은 유지된다.
- Device Approve의 중앙 작업 card와 승인 state machine은 유지되며 app 전체
  frame만 공통 page canvas로 바뀐다.
- auth/session, public profile payload, card/media/publication과 CLI contract는
  바뀌지 않는다.
- `.openai/hosting.json`, D1/R2, canonical URL과 production 외부 상태는
  바뀌지 않는다.
- 각 Stage는 보고서, 검증 결과와 커밋을 가진 뒤 다음 승인 Gate에서 멈춘다.

## 위험과 대응

- **heading·landmark 중복**: header brand는 link로만 두고 각 page 상태의
  `h1` 개수와 accessible name을 E2E에서 고정한다.
- **menu focus 손실**: close 원인별 focus 정책을 분리하고 Escape만 trigger
  복원을 강제한다. 외부 pointer와 Tab의 native focus 이동은 보존한다.
- **scroll·overlay 회귀**: frame 내부 scroll 의존 assertion을 document scroll
  contract로 바꾸고 short viewport와 Share Studio inert/z-index를 함께
  검증한다.
- **Approve 인증 회귀**: 기존 login URL builder와 `user_code` redirect를
  그대로 사용하고 공통 shell에는 auth callback만 전달한다.
- **검증 범위 과대화**: Stage별 focused E2E를 먼저 실행하고 전체 E2E와 Sites
  artifact 검증은 Stage 4에서 한 번 수행한다.

## 승인 요청 사항

- 4개 Stage 분할과 각 단계의 산출물·검증 명령·커밋 메시지
- header brand를 항상 `Codex Usage` Home link로 두고 중복 Home navigation을
  제거하는 구체 구현
- Profile·Settings는 fullscreen document canvas, Approve는 같은 canvas 안의
  중앙 작업 card로 유지하는 layout 경계
- account menu의 roving keyboard navigation과 close 원인별 focus 처리
- 공식 제품 문서와 production 배포를 제외하고 Stage 4에서 Sites artifact와
  local smoke까지만 검증하는 경계

승인되면 Stage 1 구현을 시작하고 완료보고서와 검증 결과를 제출한 뒤 다음
Stage 승인 전 멈춘다.
