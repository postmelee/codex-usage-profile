# Task M100 #17 Stage 3 보고서

GitHub Issue: [#17](https://github.com/postmelee/codex-usage-profile/issues/17)
구현계획서: [`task_m100_17_impl.md`](../plans/task_m100_17_impl.md)
Stage: 3

## 단계 목적

Stage 2에서 만든 device authorization API를 사용자가 브라우저에서 승인할 수 있도록 최소 UI를 연결했다. CLI가 제공하는 `verificationUriComplete` 또는 사용자가 직접 입력한 user code를 기준으로 GitHub login session 사용자가 device login challenge를 승인할 수 있게 만드는 것이 목적이었다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-api/client.js` | `authorizeDeviceLogin({ userCode })` client method와 user code validation 추가 |
| `src/profile-api/__tests__/client.test.js` | device authorize request가 same-origin session credentials와 normalized user code를 사용하는지 검증 |
| `src/profile-ui/DeviceApprovalPage.jsx` | `/device`용 최소 승인 화면 추가, query user code prefill, login redirect, approve 상태 표시 구현 |
| `src/App.jsx` | `/device` 최상위 route 분기 추가 |
| `src/styles.css` | device approval 화면 스타일 추가 |
| `mydocs/orders/20260614.md` | #17 Stage 3 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. 기존 public profile route와 프로필 화면 컴포넌트는 유지했고, `/device` 최상위 경로만 `App.jsx`에서 별도 분기한다. 구현계획서의 예정 산출물에 포함했던 `src/profile-ui/profileRoutes.js`는 사용자 프로필 slug route 전용이라 이번 단계에서는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-api/__tests__/client.test.js
npm test
npm run build
git diff --check
```

브라우저 확인:

```text
http://127.0.0.1:5175/device?user_code=ABCD-1234
```

결과:

- OK: `client.test.js` 11개 테스트 통과
- OK: 전체 테스트 144개 통과
- OK: production build 성공
- OK: `git diff --check` 경고 없음
- OK: `/device?user_code=ABCD-1234`에서 `Authorize device` 화면 렌더링, 입력값 `ABCD-1234` prefill 확인
- OK: 브라우저 콘솔 error 없음

## 잔여 위험

- 로컬 Vite 단독 실행에서는 backend auth endpoint가 없어 인증 상태가 `unavailable`로 표시된다. 실제 GitHub login redirect와 session 기반 승인 흐름은 backend와 함께 구동하는 Stage 4 통합 검증에서 확인해야 한다.
- 이번 단계는 최소 승인 UI만 포함한다. account menu, settings shell, token management UI는 별도 이슈 범위로 남긴다.

## 다음 단계 영향

- Stage 4는 raw device code/token-like 값 노출 여부와 duplicate/expired/invalid/missing session 케이스를 보강한다.
- Stage 4에서 backend를 포함한 device login 통합 흐름을 검증하면 #5 CLI submit 연동의 인증 전제 조건이 갖춰진다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 security and integration hardening으로 진행한다.
