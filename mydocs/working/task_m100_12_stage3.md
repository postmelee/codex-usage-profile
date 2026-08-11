# Task M100 #12 Stage 3 보고서

GitHub Issue: [#12](https://github.com/postmelee/codex-usage-profile/issues/12)
구현계획서: [`task_m100_12_impl.md`](../plans/task_m100_12_impl.md)
Stage: 3

## 단계 목적

Stage 3의 목적은 Stage 1-2에서 구현한 OAuth state, session, durable store contract를 HTTP runtime에 연결하고, CLI login challenge 승인을 로그인 session 기반으로 전환하는 것이다. 이 단계부터 웹 로그인 callback과 CLI submit 준비 흐름이 같은 owner 계정으로 묶인다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/http.js` | GitHub OAuth login redirect, browser callback, `/api/auth/me`, logout route 추가 및 CLI approve를 session owner 기반으로 변경 |
| `src/profile-backend/index.js` | HTTP redirect response helper export 추가 |
| `src/profile-backend/__tests__/http.test.js` | OAuth redirect/callback session, authenticated CLI approve, unauthenticated approve, logout 검증 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경이며 기존 #4 JSON API envelope는 유지했다. 기존 `POST /api/auth/github/callback`, CLI login start/exchange, snapshot submit/public lookup 경로는 보존했다. 공개 `POST /api/cli/login/approve`는 더 이상 body의 `ownerId`를 신뢰하지 않고 session cookie의 owner id만 사용한다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/cli-login.test.js
npm test
git diff --check
```

결과:

- OK: Stage 3 지정 테스트 14개 통과.
- OK: 전체 `npm test` 98개 통과.
- OK: `git diff --check` 통과.
- OK: OAuth callback에서 session cookie 발급, `/api/auth/me` 조회, logout 이후 session revoke가 검증됐다.
- OK: CLI challenge approve가 request body owner id 대신 session owner id를 사용하고, session 없는 approve는 401을 반환한다.

## 잔여 위험

- 실제 GitHub OAuth app client id/secret 주입과 production callback URL 설정은 Stage 4 문서/연동 범위다.
- HTTP handler는 framework-neutral `Request`/`Response` contract만 제공한다. 배포 runtime에서 cookie forwarding, HTTPS secure cookie option, reverse proxy 설정은 Stage 4 이후 hosting 선택에서 확인해야 한다.
- callback 이후 frontend redirect UI는 아직 연결하지 않았다. 현재 callback route는 JSON envelope와 `Set-Cookie`를 반환한다.

## 다음 단계 영향

- Stage 4에서는 frontend/API client가 `/api/auth/me`와 logout을 사용할 수 있게 얇은 client method를 추가한다.
- README에는 GitHub OAuth app 설정값, public base URL, secure cookie, durable store path, raw token 미저장 정책을 최소 범위로 정리해야 한다.
- #5 CLI 구현은 `POST /api/cli/login/start`로 browser URL을 열고, 웹 로그인 session이 `/api/cli/login/approve`를 승인한 뒤 `POST /api/cli/login/exchange`로 raw CLI token을 1회 수령하는 흐름을 이어받을 수 있다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 web/runtime integration과 설정 문서 정리로 진행한다.
