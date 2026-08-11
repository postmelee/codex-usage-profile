# Task M100 #12 Stage 1 보고서

GitHub Issue: [#12](https://github.com/postmelee/codex-usage-profile/issues/12)
구현계획서: [`task_m100_12_impl.md`](../plans/task_m100_12_impl.md)
Stage: 1

## 단계 목적

Stage 1의 목적은 GitHub OAuth login runtime과 browser session의 domain contract를 코드와 테스트로 고정하는 것이다. 이후 Stage 2 durable store와 Stage 3 HTTP runtime 연결이 사용할 OAuth state, session, cookie, callback 처리 경계를 먼저 만들었다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/session.js` | session 생성/검증/폐기, session cookie serialize/parse, logout cookie 처리 service 추가 |
| `src/profile-backend/oauth-runtime.js` | GitHub authorization URL 생성, OAuth state 생성/소비, callback owner upsert, session 발급 service 추가 |
| `src/profile-backend/store.js` | memory store에 OAuth state와 session 저장/조회 method 추가 |
| `src/profile-backend/index.js` | Stage 1 신규 service, 상수, helper export 추가 |
| `src/profile-backend/__tests__/session.test.js` | session cookie, 만료, revoke, ownerless session, cookie name validation 테스트 추가 |
| `src/profile-backend/__tests__/oauth-runtime.test.js` | OAuth start/callback, state replay/expiry, access token 미저장, logout 테스트 추가 |
| `src/profile-backend/__tests__/store.test.js` | OAuth state/session clone 저장과 필수 field validation 테스트 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경이며 기존 public snapshot, CLI token, HTTP submit contract는 보존했다. 기존 `profile-backend` API는 제거하지 않고 export만 확장했다. OAuth access token은 GitHub user lookup에만 사용하고 store record에는 저장하지 않는 테스트를 추가했다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-backend/__tests__/session.test.js src/profile-backend/__tests__/oauth-runtime.test.js
npm test -- src/profile-backend/__tests__/store.test.js src/profile-backend/__tests__/accounts.test.js src/profile-backend/__tests__/cli-login.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/snapshots.test.js src/profile-backend/__tests__/security.test.js
npm test
git diff --check
```

결과:

- OK: Stage 1 신규 테스트 9개 통과.
- OK: backend 관련 회귀 테스트 48개 통과.
- OK: 전체 `npm test` 89개 통과.
- OK: `git diff --check` 통과.

## 잔여 위험

- Stage 1은 domain/runtime service contract까지만 구현했다. 실제 HTTP route 연결은 Stage 3에서 수행한다.
- session은 memory store에 저장된다. process restart 이후 유지 검증과 durable adapter는 Stage 2 범위다.
- cookie secure option은 service option으로 열어뒀지만 production runtime config 연결은 Stage 4에서 README 설정과 함께 확인한다.

## 다음 단계 영향

- Stage 2 durable store는 `saveOAuthState/getOAuthState`, `saveSession/getSession` method를 memory store와 같은 의미로 구현해야 한다.
- Stage 3 HTTP runtime은 CLI challenge approve 시 request body의 `ownerId`를 신뢰하지 않고 Stage 1 session owner를 사용해야 한다.
- Stage 4 README에는 OAuth/session env와 secure cookie 설정 방향을 최소 안내로 반영하면 된다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 durable store adapter 구현으로 진행한다.
