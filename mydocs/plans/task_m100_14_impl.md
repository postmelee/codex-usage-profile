# Task M100 #14 구현계획서

수행계획서: [`task_m100_14.md`](task_m100_14.md)
GitHub Issue: [#14](https://github.com/postmelee/codex-usage-profile/issues/14)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Account topbar and menu | `AccountMenu.jsx`, `accountUi.js`, `ProfileShell.jsx`, related tests | `npm test -- src/profile-ui/__tests__/accountUi.test.js src/profile-api/__tests__/client.test.js` |
| 2 | Settings shell route | `SettingsPage.jsx`, `App.jsx`, route helper/tests, styles | `npm test -- src/profile-ui/__tests__/profileRoutes.test.js src/profile-ui/__tests__/accountUi.test.js` |
| 3 | Interaction and responsive QA | logout state wiring, keyboard/outside close, responsive styles, browser QA report | `npm test`, browser checks, `git diff --check` |
| 4 | Integration hardening and final report | full verification, final report, PR prep | `npm test`, `npm run build`, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_14.md` | `mydocs/plans/` | 작성 완료 | OK | 수행계획서 |
| `mydocs/orders/20260614.md` | `mydocs/orders/` | 갱신 완료 | OK | 오늘할일 |
| `mydocs/plans/task_m100_14_impl.md` | `mydocs/plans/` | 본 문서 | OK | 구현계획서 |
| 공식 사용자/API 문서 | 해당 없음 | 해당 없음 | OK | #5/#15에서 사용자-facing 문서를 다룸 |

## Stage 1 — Account topbar and menu

### 산출물

신규:

- `src/profile-ui/AccountMenu.jsx`
- `src/profile-ui/accountUi.js`
- `src/profile-ui/__tests__/accountUi.test.js`
- `mydocs/working/task_m100_14_stage1.md`

수정:

- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/ProfilePage.jsx`
- `src/profile-ui/Icons.jsx`
- `src/profile-api/__tests__/client.test.js` 또는 필요 시 유지
- `src/styles.css`
- `mydocs/orders/20260614.md`

### 변경 내용

- `ProfileShell`이 `authState`, `client`, `onAuthStateChange`, `title` 또는 동등한 props를 받아 account menu를 표시할 수 있게 한다.
- `AccountMenu`는 authenticated, anonymous, loading, unavailable 상태별 topbar control을 렌더링한다.
- authenticated 상태에서는 GitHub avatar, display name/login, settings link, logout action을 제공한다.
- anonymous 상태에서는 GitHub login link를 제공하고, loading/unavailable 상태는 비파괴적인 상태 표시로 처리한다.
- account 상태 label, owner 표시명, avatar fallback, GitHub login URL 같은 순수 계산은 `accountUi.js`로 분리해 Node test로 고정한다.
- logout은 `client.logout()` 호출 후 `onAuthStateChange({ account: null, status: "anonymous" })`로 frontend 상태를 갱신하는 contract를 둔다.

### 검증

```bash
npm test -- src/profile-ui/__tests__/accountUi.test.js src/profile-api/__tests__/client.test.js
git diff --check
```

### 커밋

```text
Task #14 Stage 1: account topbar menu 구현
```

## Stage 2 — Settings shell route

### 산출물

신규:

- `src/profile-ui/SettingsPage.jsx`
- 필요 시 `src/profile-ui/appRoutes.js`
- `mydocs/working/task_m100_14_stage2.md`

수정:

- `src/App.jsx`
- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/profileRoutes.js` 또는 route helper tests
- `src/profile-ui/__tests__/profileRoutes.test.js`
- `src/styles.css`
- `mydocs/orders/20260614.md`

### 변경 내용

- `/settings` route를 `App.jsx`에서 `/device`보다 뒤, public profile route보다 앞에서 명확히 분기한다.
- `SettingsPage`는 account menu가 붙은 shell 안에서 계정 overview section을 보여준다.
- authenticated 상태에서는 GitHub avatar, display name, `@githubLogin`, profile URL, handle/visibility 등 가능한 account metadata를 읽기 전용으로 표시한다.
- anonymous 상태에서는 GitHub login CTA를 표시하고, loading/unavailable 상태는 각각 스켈레톤/상태 메시지로 처리한다.
- API token/device list, rename, revoke UI는 넣지 않고 후속 #15 범위임을 layout상 과도하게 드러내지 않는다.

### 검증

```bash
npm test -- src/profile-ui/__tests__/profileRoutes.test.js src/profile-ui/__tests__/accountUi.test.js
git diff --check
```

### 커밋

```text
Task #14 Stage 2: settings shell route 구현
```

## Stage 3 — Interaction and responsive QA

### 산출물

수정:

- `src/App.jsx`
- `src/profile-ui/AccountMenu.jsx`
- `src/profile-ui/SettingsPage.jsx`
- `src/styles.css`
- 필요한 테스트 파일
- `mydocs/working/task_m100_14_stage3.md`

### 변경 내용

- menu open/close, Escape close, outside click close, logout pending/error 상태를 정리한다.
- logout 성공 후 profile/settings 양쪽에서 anonymous UI로 전환되도록 App의 auth state update path를 검증한다.
- 좁은 viewport에서 Share와 account control이 겹치지 않도록 topbar layout을 조정한다.
- in-app browser로 `/u/meleeisdeveloping`과 `/settings`를 확인한다.
- authenticated 상태 browser check는 가능한 경우 `/api/auth/me` 응답 mocking 또는 runtime fixture를 사용하고, 불가능하면 helper/unit test와 브라우저 anonymous/unavailable 확인으로 검증 한계를 보고서에 명시한다.

### 검증

```bash
npm test
git diff --check
```

브라우저 확인:

```text
http://127.0.0.1:{port}/u/meleeisdeveloping
http://127.0.0.1:{port}/settings
```

### 커밋

```text
Task #14 Stage 3: account UI 상호작용 QA 정리
```

## Stage 4 — Integration hardening and final report

### 산출물

- `mydocs/working/task_m100_14_stage4.md`
- `mydocs/report/task_m100_14_report.md`
- 필요한 최종 테스트 보강
- `mydocs/orders/20260614.md`

### 변경 내용

- 전체 테스트와 production build를 실행한다.
- 기존 profile page layout, Share button, `/device` approval route가 회귀하지 않았는지 확인한다.
- 최종 보고서와 PR 본문 작성에 필요한 검증 결과를 정리한다.

### 검증

```bash
npm test
npm run build
git diff --check
```

### 커밋

```text
Task #14 Stage 4: account settings 통합 검증 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- browser QA에서 실제 OAuth session을 검증하지 못하면 검증 한계로 남기고, UI state contract는 unit/helper test로 보완한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_14_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #14 Stage {N}: {핵심 내용 요약}` 형식을 따른다.

## 단계 의존성

- Stage 2는 Stage 1에서 account menu contract가 확정된 뒤 진행한다.
- Stage 3은 profile/settings 양쪽 route가 존재한 뒤 interaction과 responsive QA를 수행한다.
- Stage 4는 Stage 1~3 검증과 보고서가 완료된 뒤 진행한다.

## 위험과 대응

- **React DOM 테스트 부재**: 기존 Node test 패턴을 유지하기 위해 UI 상태 계산을 helper로 분리하고, 실제 DOM은 browser QA로 보완한다.
- **로그아웃 상태 동기화 누락**: App이 auth state의 단일 owner가 되도록 `onAuthStateChange` path를 명시한다.
- **route 충돌**: `/device`, `/settings`, `/u/:handle` 분기 순서를 명확히 하고 route helper test로 고정한다.
- **범위 확장**: API token/device 관리 UI는 #15로 넘기고 settings shell에는 읽기 전용 account overview만 포함한다.

## 승인 요청 사항

- 수행계획서 승인에 따라 위 Stage 분할과 Stage 1 구현 진입을 승인받은 것으로 보고 진행한다.
