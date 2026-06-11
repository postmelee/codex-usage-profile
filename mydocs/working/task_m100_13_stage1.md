# Task M100 #13 Stage 1 보고서

GitHub Issue: [#13](https://github.com/postmelee/codex-usage-profile/issues/13)
구현계획서: [`task_m100_13_impl.md`](../plans/task_m100_13_impl.md)
Stage: 1

## 단계 목적

Stage 1의 목적은 local runtime server 구현 전에 `/api/*` 요청을 backend handler로 보내고 나머지를 frontend/static fallback으로 보내는 host adapter contract를 먼저 확정하는 것이다. 이 단계는 network listen이나 Vite 통합 없이 `Request`/`Response` 기반 함수로 검증 가능한 경계를 만든다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/host-adapter.js` | `/api` 및 `/api/*` routing, frontend fallback, API prefix 정규화/검증 helper 추가 |
| `src/profile-runtime/__tests__/host-adapter.test.js` | backend/frontend routing, status/header/cookie/body 보존, default 404 fallback, custom prefix, 입력 검증 테스트 추가 |
| `mydocs/working/task_m100_13_stage1.md` | Stage 1 완료 보고서 |

## 본문 변경 정도 / 본문 무손실 여부

코드 신규 추가이며 기존 backend/frontend 동작은 변경하지 않았다. `createProfileBackendHttpHandler()` contract를 감싸는 host adapter layer만 새로 추가했고, 실제 server listen과 GitHub OAuth client wiring은 Stage 2-3으로 남겼다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-runtime/__tests__/host-adapter.test.js
git diff --check
```

결과:

- OK: host adapter 테스트 5개 통과.
- OK: `/api/auth/me`와 `/api`는 backend handler로 routing된다.
- OK: `/u/meleeisdeveloping` 같은 non-api path는 frontend handler로 routing된다.
- OK: backend response의 status, `Location`, `Set-Cookie`, custom header와 request body/headers가 보존된다.
- OK: `git diff --check` 통과.

## 잔여 위험

- 실제 Node `http` server listen, Vite/static fallback, GitHub OAuth client wiring은 아직 없다.
- adapter는 `/api` prefix 기반 routing만 책임진다. 후속 Stage에서 dev server가 request URL, body stream, static fallback을 어떻게 전달하는지 추가 검증해야 한다.

## 다음 단계 영향

- Stage 2는 이 adapter contract 위에 GitHub OAuth client와 env config를 추가한다.
- Stage 3 local dev server는 `createProfileHostAdapter()`를 사용해 `/api/*` backend routing과 frontend fallback을 연결하면 된다.
- #14/#5/#15/#6은 후속 route를 backend handler에 추가하더라도 host adapter routing 구조를 바꿀 필요가 없다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 GitHub OAuth client와 env 설정 구현으로 진행한다.
