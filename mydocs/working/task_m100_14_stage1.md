# Task M100 #14 Stage 1 보고서

GitHub Issue: [#14](https://github.com/postmelee/codex-usage-profile/issues/14)
구현계획서: [`task_m100_14_impl.md`](../plans/task_m100_14_impl.md)
Stage: 1

## 단계 목적

프로필 화면 상단 Share 옆에 로그인 계정 상태를 표시할 수 있는 account topbar/menu 기반을 추가했다. Stage 1의 목적은 settings route 구현 전에도 authenticated/anonymous/loading/unavailable 상태별 계정 control과 logout action contract를 고정하는 것이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/AccountMenu.jsx` | 상태별 account control, authenticated popover, settings link, logout action 추가 |
| `src/profile-ui/accountUi.js` | account display name/login/avatar/login redirect 계산 helper 추가 |
| `src/profile-ui/__tests__/accountUi.test.js` | account summary, fallback, status label, login redirect helper 테스트 추가 |
| `src/profile-ui/ProfileShell.jsx` | topbar에 `AccountMenu` 연결, shell title/client/auth change props 추가 |
| `src/profile-ui/ProfilePage.jsx` | `ProfileShell`로 client와 auth state update callback 전달 |
| `src/App.jsx` | App auth state update callback을 단일 경로로 추가 |
| `src/profile-ui/Icons.jsx` | account menu에 필요한 user/settings/logout icon path 추가 |
| `src/styles.css` | account topbar button, avatar, popover, menu item 스타일 추가 |
| `mydocs/orders/20260614.md` | #14 Stage 1 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. 기존 profile content, Share button, `/device` approval route는 유지했고, `ProfileShell` topbar에 account menu를 추가했다. logout은 기존 `profileApiClient.logout()` contract를 그대로 사용하고 성공 시 App의 auth state만 anonymous로 갱신한다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-ui/__tests__/accountUi.test.js src/profile-api/__tests__/client.test.js
npm run build
git diff --check
```

결과:

- OK: account UI/client 대상 테스트 15개 통과
- OK: production build 성공
- OK: `git diff --check` 경고 없음

## 잔여 위험

- menu outside click, Escape close, responsive viewport QA는 Stage 3에서 정리한다.
- `/settings` route는 아직 없으므로 account menu의 settings link는 Stage 2에서 실제 화면과 연결된다.

## 다음 단계 영향

- Stage 2는 `ProfileShell`의 `title`, `client`, `onAuthStateChange` props와 `AccountMenu`를 재사용해 `/settings` shell을 구현하면 된다.
- Settings route가 추가되면 account menu의 settings link가 실제 페이지로 연결된다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 settings shell route로 진행한다.
