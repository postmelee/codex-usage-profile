# Task M100 #13 Stage 3 보고서

GitHub Issue: [#13](https://github.com/postmelee/codex-usage-profile/issues/13)
구현계획서: [`task_m100_13_impl.md`](../plans/task_m100_13_impl.md)
Stage: 3

## 단계 목적

Stage 3의 목적은 Stage 1 host adapter contract와 Stage 2 GitHub OAuth/env 설정을 실제 local dev runtime에 연결해, 같은 origin에서 frontend와 `/api/*` backend route를 함께 확인할 수 있게 만드는 것이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/dev-server.js` | Node HTTP + Vite middleware 기반 local runtime entry 추가 |
| `src/profile-runtime/__tests__/dev-server.test.js` | env loader, Node request/response 변환, API/frontend routing, OAuth redirect smoke 단위 테스트 추가 |
| `package.json` | `npm run dev:runtime` script 추가 |
| `README.md` | frontend-only `dev`와 same-origin `dev:runtime` 역할, credential 없는 smoke 범위 문서화 |
| `mydocs/working/task_m100_13_stage3.md` | Stage 3 완료 보고서 |

## 구현 내용

- `npm run dev`는 기존 Vite frontend preview로 유지했다.
- `npm run dev:runtime`은 `.env`를 선택적으로 읽고, `/api/*`는 `createProfileBackendHttpHandler()`로 보내며, non-API route는 Vite middleware로 위임한다.
- `.env`가 없어도 frontend와 비로그인 API smoke를 수행할 수 있게 했다.
- `GITHUB_CLIENT_ID`만 있으면 GitHub authorization redirect 생성까지 확인할 수 있고, 실제 callback 완료는 `GITHUB_CLIENT_SECRET`이 있을 때 가능하다.
- Node request stream을 fetch `Request`로 바꾸고, fetch `Response`의 status/header/body/`Set-Cookie`를 Node response로 쓰는 변환 계층을 테스트로 고정했다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-runtime/__tests__/dev-server.test.js src/profile-runtime/__tests__/host-adapter.test.js src/profile-runtime/__tests__/github-oauth-client.test.js src/profile-runtime/__tests__/config.test.js
npm test
npm run build
git diff --check
```

결과:

- OK: Stage 3 관련 테스트 20개 통과.
- OK: 전체 테스트 122개 통과.
- OK: production build 통과.
- OK: `git diff --check` 통과.

## Runtime smoke 결과

실행:

```bash
PORT=5174 PUBLIC_BASE_URL=http://127.0.0.1:5174 GITHUB_CLIENT_ID=github_client_smoke npm run dev:runtime
```

확인:

- OK: `GET /api/auth/me`는 비로그인 상태에서 401 `Session cookie is required`를 반환한다.
- OK: `GET /api/auth/github/login?redirect_to=/u/meleeisdeveloping`는 GitHub authorization URL로 302 redirect를 반환한다.
- OK: `GET /u/meleeisdeveloping`는 Vite frontend HTML 200을 반환한다.
- OK: in-app browser에서 `http://127.0.0.1:5174/u/meleeisdeveloping` 렌더링을 확인했다.

## 잔여 위험

- 실제 GitHub OAuth App credential로 callback/session cookie까지 완료하는 수동 smoke는 아직 수행하지 않았다.
- 현재 local runtime은 개발용 Vite middleware를 사용한다. 배포용 host adapter나 production static serving은 후속 이슈/단계에서 별도 결정이 필요하다.
- #14 settings/account UI는 아직 이 runtime 위에 얹히지 않았다.

## 다음 단계 영향

- Stage 4에서는 전체 통합 검증과 secret scan, #14/#5/#15/#6 handoff 메모를 정리한다.
- #14는 `npm run dev:runtime`과 `/api/auth/me`, `/api/auth/logout`을 사용해 account/settings UI smoke를 진행할 수 있다.
- MVP CLI auth는 후속 #17 device-code API가 담당하고, #5 CLI는 같은 origin runtime에서 device login과 `POST /api/snapshots/submit`을 이어받을 수 있다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 통합 검증과 후속 handoff 정리로 진행한다.
