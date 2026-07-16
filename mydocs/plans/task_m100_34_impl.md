# Task M100 #34 구현계획서

수행계획서: [`task_m100_34.md`](task_m100_34.md)
GitHub Issue: [#34](https://github.com/postmelee/codex-usage-profile/issues/34)
마일스톤: M100

## 구현 전제

- 별도 `/onboarding` route를 만들지 않고 기존 `/`를 제품 소개와 Quickstart의 단일 진입점으로 확장한다.
- Home에서 시작한 GitHub OAuth는 `/`로 복귀하고, `/profile`과 `/settings`에서 시작한 로그인은 기존 route 복귀 의도를 유지한다.
- 사용자 기본 명령은 `npx codex-usage-profile@latest submit`으로 고정하며 `--yes` 또는 `-y`를 포함하지 않는다.
- 익명 사용자는 제품 가치, 실제 card preview, GitHub 로그인과 전체 흐름 개요를 확인할 수 있다.
- 인증 사용자는 GitHub identity, Profile/Settings 진입점, 복사 가능한 submit 명령과 다음 단계 안내를 확인할 수 있다.
- Quickstart 순서는 device 승인, usage submit, owner profile 확인, card publish, README Markdown 복사로 고정한다.
- 기존 `ProfileShell`, `AccountMenu`, profile card asset/client를 재사용하며 landing 전용 별도 app 또는 중복 card 구현을 만들지 않는다.
- 명령, 단계와 상태 문구는 JSX에 산재시키지 않고 순서와 의미가 검증 가능한 UI contract로 관리한다.
- i18n framework는 도입하지 않지만 긴 번역 문자열에서도 버튼, command, 단계 제목이 겹치거나 잘리지 않는 layout을 사용한다.
- landing DOM에는 credential, token digest, device secret, 내부 owner id와 저장소 metadata를 노출하지 않는다.
- npm package와 production service 배포는 범위 밖이다. landing은 canonical 제품 명령을 안내하되 현재 배포가 완료됐다고 주장하지 않는다.
- 상세 CLI 계약의 진실 원천은 `docs/cli-submit.md`이며, 실제 모순이 발견된 경우에만 Stage 4에서 최소 수정한다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Home onboarding contract와 로그인 복귀 의도 | command/step contract, `/` OAuth redirect, 단위·route test | focused Node tests, Home E2E |
| 2 | Session-aware landing과 Quickstart UI | `HomeQuickstart`, card hero, copy interaction | UI unit test, build, focused E2E |
| 3 | 반응형·접근성·브라우저 회귀 | desktop/mobile layout, clipboard/a11y, existing route regression | full UI E2E, build |
| 4 | 통합 시각·보안 QA와 문서 일관성 | runtime smoke, DOM allowlist, docs consistency | full test/build/e2e, manual screenshots |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/cli-submit.md` | 기존 공식 문서 위치 유지 | Stage 4 조건부 수정 | OK | landing과 실제 CLI 계약이 충돌할 때만 최소 수정 |
| `mydocs/plans/task_m100_34.md` | `mydocs/plans/` | 승인 완료 | OK | 수행 범위와 UX 방향 |
| `mydocs/plans/task_m100_34_impl.md` | `mydocs/plans/` | 본 문서 | OK | Stage별 구현 계약 |
| 단계·최종 보고서 | `mydocs/working`, `mydocs/report` | 각 Stage 및 최종 절차 | OK | Hyper-Waterfall 검증 기록 |

## Stage 1 — Home onboarding contract와 로그인 복귀 의도

### 산출물

신규:

- `src/profile-ui/homeOnboarding.js`
- `src/profile-ui/__tests__/homeOnboarding.test.js`
- `mydocs/working/task_m100_34_stage1.md`

수정:

- `src/App.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/__tests__/accountUi.test.js`, login href 공통 계약 보강이 필요한 경우
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260717.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. `homeOnboarding.js`에 landing에서 사용하는 순수 UI contract를 정의한다.
   - canonical command는 `npx codex-usage-profile@latest submit`이다.
   - `--yes`, `-y`, credential, API token과 실제 사용자 식별값을 포함하지 않는다.
   - Quickstart 단계는 device 승인, submit, profile 확인, publish, README 복사 순서를 보존한다.
   - 단계 id와 label을 분리해 번역 문자열 변경이 순서나 동작 selector를 깨뜨리지 않게 한다.
2. Home GitHub login href를 현재 route인 `/`로 복귀하도록 변경한다.
   - `buildAccountLoginHref(client, location)`의 route-aware 계약을 재사용한다.
   - `App.jsx`가 `HomePage`에 현재 location을 전달해 browser global 의존성을 테스트 밖으로 격리한다.
   - `buildProfileLoginHref()`의 `/profile` owner preview 복귀 계약은 변경하지 않는다.
3. Home의 현재 anonymous/authenticated 분기를 새 contract와 연결할 준비만 한다.
   - Stage 1에서는 대규모 visual 변경을 하지 않는다.
   - 기존 sample card, ProfileShell과 account menu 동작을 보존한다.
4. 단위 테스트로 command와 step order, root redirect encoding, profile redirect 비회귀를 고정한다.
5. Home E2E의 anonymous login 기대값을 `redirect_to=%2F`로 갱신하고 기존 authenticated profile CTA를 보존한다.

### 검증

```bash
node --test src/profile-ui/__tests__/homeOnboarding.test.js src/profile-ui/__tests__/accountUi.test.js src/profile-ui/__tests__/cardShare.test.js
npm run test:e2e -- --grep "Home shows the sample card"
git diff --check
```

검증 관점:

- Home에서 시작한 GitHub login만 `/`로 복귀한다.
- Profile과 Settings의 route-aware login 복귀 동작은 유지된다.
- canonical command에 자동 설치 승인 flag와 secret이 없다.
- Quickstart 단계 순서가 id 기반 test로 고정된다.
- Stage 1 변경으로 Home card와 authenticated CTA가 사라지지 않는다.

### 커밋

```text
Task #34 Stage 1: Home onboarding 계약과 login return 고정
```

## Stage 2 — Session-aware landing과 Quickstart UI

### 산출물

신규:

- `src/profile-ui/HomeQuickstart.jsx`
- `src/profile-ui/__tests__/HomeQuickstart.test.js`, DOM interaction test runtime이 현재 구성에서 가능한 경우
- `mydocs/working/task_m100_34_stage2.md`

수정:

- `src/profile-ui/HomePage.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260717.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. `/`의 첫 화면을 제품명, 짧은 value proposition, 실제 profile card preview가 즉시 보이는 landing으로 구성한다.
   - marketing 전용 거대 hero나 중첩 card를 만들지 않는다.
   - profile card는 기존 고정 aspect ratio asset을 그대로 사용한다.
   - 첫 viewport에서 Quickstart 시작 부분이 보이도록 높이와 간격을 제한한다.
2. session state별 primary action을 명확히 분리한다.
   - loading: layout을 이동시키지 않는 중립 상태를 사용한다.
   - anonymous/unavailable: GitHub sign-in을 primary action으로 제공하고 `/` 복귀 intent를 포함한다.
   - authenticated: GitHub avatar/name/login, Profile 진입과 기존 AccountMenu의 Settings/logout을 제공한다.
3. 인증 사용자에게 실행 가능한 Quickstart를 제공한다.
   - command surface에 `npx codex-usage-profile@latest submit`을 표시한다.
   - familiar copy icon button과 tooltip을 사용한다.
   - copy 성공/실패 상태는 `aria-live`로 알리고 실패 시 command text를 선택·복사할 수 있게 유지한다.
4. 익명 사용자에게는 전체 흐름의 의미와 로그인 단계를 보여주되 실행 command는 인증 후에 노출한다.
5. ordered Quickstart를 구현한다.
   - device approval: 터미널 link를 열고 web session으로 device를 승인한다.
   - submit: CLI가 usage contract를 전송한다.
   - profile: owner preview에서 갱신값을 확인한다.
   - publish: card를 public으로 전환한다.
   - README: stable image URL 또는 Markdown을 복사한다.
6. command와 단계는 긴 번역 문자열에서도 줄바꿈 가능하고 icon/button이 축소되지 않는 grid/flex 제약을 둔다.
7. 현재 release readiness를 넘는 표현을 피한다.
   - production package가 이미 게시됐다는 badge나 문구를 추가하지 않는다.
   - 실제 deployment URL, version과 availability를 hardcode하지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/homeOnboarding.test.js
npm run build
npm run test:e2e -- --grep "Home"
git diff --check
```

검증 관점:

- anonymous와 authenticated 상태의 CTA 및 정보 노출이 구분된다.
- authenticated landing에서 identity, command, Profile/Settings 경로를 찾을 수 있다.
- copy button은 icon, tooltip, accessible name과 비동기 status를 가진다.
- 익명 DOM에는 실행 command와 owner-only 정보가 없다.
- card가 실제 profile/card surface와 동일한 비율로 표시된다.
- landing이 section/card 중첩 없이 scan 가능한 흐름을 제공한다.

### 커밋

```text
Task #34 Stage 2: session-aware landing과 Quickstart UI 구현
```

## Stage 3 — 반응형·접근성·브라우저 회귀

### 산출물

신규:

- `mydocs/working/task_m100_34_stage3.md`

수정:

- `src/profile-ui/HomePage.jsx`, browser QA에서 semantic 보강이 필요한 경우
- `src/profile-ui/HomeQuickstart.jsx`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260717.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. Playwright에 session-aware landing 시나리오를 추가한다.
   - anonymous login href가 `/` 복귀 intent를 가진다.
   - authenticated identity, primary command, Profile link와 Settings account menu를 검증한다.
   - clipboard success를 검증하고 command 문자열 전체가 복사되는지 확인한다.
2. keyboard와 screen reader 계약을 검증한다.
   - navigation, sign-in, copy, Profile, account menu가 논리적인 tab order를 가진다.
   - icon button에 accessible name과 tooltip이 있다.
   - copy 결과와 unavailable state는 focus를 강제로 이동하지 않고 발표된다.
   - heading level과 ordered step semantic을 유지한다.
3. desktop/mobile/짧은 desktop viewport를 고정한다.
   - 1280x900, 390x844, 1280x620에서 확인한다.
   - page frame 내부 scrolling을 유지하고 document horizontal overflow를 만들지 않는다.
   - header label, identity, command, 가장 긴 step label과 button text가 잘리지 않는다.
   - card aspect ratio와 command surface의 안정된 치수를 유지한다.
4. 기존 Profile, Settings, Device, public profile/card E2E를 함께 실행해 route와 shell 회귀를 제거한다.
5. reduced-motion 환경에서 필수 정보나 interaction이 사라지지 않게 한다.

### 검증

```bash
npm run build
npm run test:e2e
git diff --check
```

검증 관점:

- 세 viewport에서 horizontal overflow, incoherent overlap과 clipped text가 없다.
- 내부 frame scroll로 Quickstart 끝까지 접근할 수 있다.
- keyboard-only로 login, command copy, Profile, Settings에 접근할 수 있다.
- clipboard interaction이 실패해도 command를 수동 복사할 수 있다.
- 기존 owner/public/settings/device flow가 모두 유지된다.

### 커밋

```text
Task #34 Stage 3: landing responsive와 접근성 회귀 보강
```

## Stage 4 — 통합 시각·보안 QA와 문서 일관성

### 산출물

신규:

- `mydocs/working/task_m100_34_stage4.md`

수정:

- `tests/profile-ui.spec.js`, 통합 QA에서 발견된 최소 보강이 필요한 경우
- `src/profile-ui/HomePage.jsx`, `src/profile-ui/HomeQuickstart.jsx`, `src/styles.css`, QA 수정이 필요한 경우
- `docs/cli-submit.md`, landing과 실제 CLI 계약이 충돌하는 경우에만 최소 수정
- `mydocs/orders/20260717.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. 실제 local runtime에서 anonymous → GitHub login → Home 복귀 → command 확인 → Profile/Settings 이동을 smoke 검증한다.
2. 기존 device login/submit runtime이 준비된 환경에서는 landing command부터 device 승인, submit, profile/card 갱신까지 연결한다.
   - upstream 또는 release prerequisite로 실행 불가능한 부분은 제품 결함과 외부 선행조건을 구분해 보고한다.
   - credential 값과 실제 사용량 원문은 보고서나 screenshot에 기록하지 않는다.
3. desktop/mobile screenshot으로 visual QA를 수행한다.
   - 실제 card가 first-viewport signal인지 확인한다.
   - header baseline, text clipping, nested card, command overflow와 background/card contrast를 점검한다.
4. security/privacy allowlist를 확인한다.
   - landing DOM과 browser console에 session cookie, token, digest, device secret, owner id와 local path가 없어야 한다.
   - command와 copied value에는 public package command만 포함한다.
   - anonymous state는 GitHub identity와 owner-only 실행 command를 노출하지 않는다.
5. `docs/cli-submit.md`와 landing의 기본 명령, device flow, Profile/publish/README 순서가 일치하는지 점검한다.
   - 문서에 의도된 deployment 전제와 local/source 실행 예시가 이미 정확하면 수정하지 않는다.
   - `--yes`는 기본 사용자 Quickstart에 다시 추가하지 않는다.
6. full test/build/e2e가 모두 통과한 뒤 Stage 4 보고서를 작성한다.

### 검증

```bash
rg -n -- "npx codex-usage-profile@latest submit|--yes|-y" src/profile-ui tests/profile-ui.spec.js docs/cli-submit.md README.md
rg -n "credential|tokenDigest|deviceSecret|ownerId|storagePath" src/profile-ui tests/profile-ui.spec.js
npm test
npm run build
npm run test:e2e
git diff --check
```

검증 관점:

- canonical command가 UI, clipboard와 문서에서 의도대로 일치한다.
- 사용자용 기본 명령에는 `--yes`와 `-y`가 없다.
- package/service가 배포됐다는 검증되지 않은 주장이 없다.
- anonymous/authenticated 전환과 `/` 복귀 UX가 실제 browser에서 확인된다.
- landing DOM/console/screenshot에 credential 또는 내부 metadata가 없다.
- Home, Profile, Settings, Device, public profile/card의 전체 회귀가 통과한다.

### 커밋

```text
Task #34 Stage 4: landing 통합 QA와 문서 일관성 완료
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- Playwright grep 이름은 실제 test title에 맞춰 구현 시 확정하되 검증 범위를 축소하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_34_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #34 Stage {N}: {핵심 내용 요약}` 형식을 따른다.

## 단계 의존성

- Stage 2는 Stage 1의 command, step order와 login return 계약 승인 후 진행한다.
- Stage 3은 Stage 2의 session-aware landing과 copy interaction 승인 후 진행한다.
- Stage 4는 Stage 3의 responsive/accessibility/browser 회귀 승인 후 진행한다.
- 각 Stage 완료 후 보고서와 검증 결과를 공유하고 다음 Stage의 명시 승인을 받는다.

## 위험과 대응

- **배포 전 canonical command**: package/service release는 별도 선행조건이다. landing은 canonical 명령을 제공하되 availability를 확정적으로 주장하지 않고, runtime smoke의 미충족 조건을 분리 기록한다.
- **Home login redirect 회귀**: root와 owner/settings login intent를 별도 test로 고정해 Home 변경이 기존 protected route를 덮지 않게 한다.
- **세션 상태 layout shift**: loading/anonymous/authenticated header와 action 영역에 안정된 최소 치수를 둔다.
- **clipboard API 제한**: 실패 상태와 selectable command fallback을 함께 제공한다.
- **긴 번역 문자열**: 고정 font scaling을 피하고 wrapping 가능한 content track과 축소되지 않는 icon action을 사용한다.
- **landing 과밀화**: 실제 card와 Quickstart를 핵심으로 제한하고 settings/token/device 관리 상세는 기존 page와 공식 문서로 연결한다.
- **민감 정보 노출**: UI contract와 E2E allowlist에서 public command, GitHub public identity, 공개 route만 허용한다.

## 승인 요청 사항

- 4개 Stage 분할과 각 Stage 산출물, 검증 명령, 커밋 메시지를 승인 요청한다.
- Stage 1에서 canonical command/step contract와 Home OAuth `/` 복귀를 먼저 고정하는 순서를 승인 요청한다.
- 별도 `/onboarding` route 없이 `/`에서 landing과 Quickstart를 제공하는 구현 경계를 승인 요청한다.
- npm/service 배포는 범위 밖으로 유지하고 landing에서 배포 완료를 주장하지 않는 정책을 승인 요청한다.
