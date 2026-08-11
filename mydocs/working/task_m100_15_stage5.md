# Task M100 #15 Stage 5 완료 보고

## 단계 목표

Settings token/device 관리 기능의 통합 QA를 수행하고, GitHub OAuth 설정이 없을 때 browser login이 raw JSON 화면으로 떨어지는 문제를 hardening했다. 또한 GitHub OAuth callback이 browser navigation에서는 원래 app route로 돌아오도록 정리했다.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `src/profile-backend/http.js` | browser login/callback 요청에 대한 redirect 분기와 auth error redirect 추가 |
| `src/profile-backend/__tests__/http.test.js` | browser callback redirect, OAuth 설정 누락 redirect, API JSON 응답 유지 검증 추가 |
| `src/profile-ui/accountUi.js` | `auth_error` query를 Settings copy로 매핑하는 helper 추가 |
| `src/profile-ui/__tests__/accountUi.test.js` | auth error query copy 검증 추가 |
| `src/profile-ui/SettingsPage.jsx` | Settings anonymous 상태에서 auth error copy 표시 |
| `mydocs/orders/20260614.md` | Stage 5 완료 상태 갱신 |

## 구현 내용

- `GET /api/auth/github/callback`은 browser navigation 요청일 때 session cookie를 설정한 뒤 저장된 local redirect path로 302 redirect한다.
- JSON을 기대하는 API 요청은 기존 callback JSON envelope 응답을 유지한다.
- `GET /api/auth/github/login`은 browser navigation 요청에서 OAuth 설정 누락 등 backend auth error가 발생하면 `/settings?auth_error=...`로 redirect한다.
- JSON을 기대하는 API 요청은 기존 JSON error envelope을 유지한다.
- redirect target은 local path만 허용하고 외부 URL 또는 protocol-relative URL은 fallback으로 보낸다.
- Settings 화면은 `auth_error=github_oauth_not_configured`일 때 `Sign in unavailable` 상태와 안내 문구를 표시하고 반복 클릭 가능한 primary action을 숨긴다.
- Settings 화면은 `auth_error=github_login_failed`일 때 retry 가능한 sign-in 상태를 표시한다.

## 검증

```bash
npm test -- src/profile-backend/__tests__/http.test.js src/profile-ui/__tests__/accountUi.test.js src/profile-api/__tests__/client.test.js
npm run build
git diff --check
```

결과:

- OK: 36개 targeted 테스트 통과
- OK: Vite production build 통과
- OK: whitespace 경고 없음

전체 테스트:

```bash
npm test
```

결과:

- OK: 172개 전체 테스트 통과

Runtime smoke:

```text
GET /settings -> 200 text/html
GET /api/auth/github/login?redirect_to=/settings Accept:text/html -> 302 /settings?auth_error=github_oauth_not_configured
GET /api/auth/github/login?redirect_to=/settings Accept:application/json -> 400 application/json
GET /api/auth/github/login?redirect_to=/settings -L Accept:text/html -> 200 text/html /settings?auth_error=github_oauth_not_configured
```

브라우저 확인:

- OK: `/settings?auth_error=github_oauth_not_configured`에서 `Sign in unavailable` 제목 표시
- OK: `GitHub sign in is not configured for this environment.` 문구 표시
- OK: primary sign-in action 숨김

## 남은 작업

- 최종 보고서를 작성하고 PR 게시 절차로 이동한다.

## 다음 단계 승인 요청

최종 보고서 작성 및 PR 게시 준비 진행 승인을 요청한다.
