# Task M100 #17 Stage 1 보고서

GitHub Issue: [#17](https://github.com/postmelee/codex-usage-profile/issues/17)
구현계획서: [`task_m100_17_impl.md`](../plans/task_m100_17_impl.md)
Stage: 1

## 단계 목적

Device-code login API의 HTTP route를 만들기 전에 backend domain model을 확장했다. 기존 CLI login challenge 흐름은 유지하면서 raw device code는 저장하지 않고 digest로 조회하며, user code approval과 device code polling이 가능한 상태 전이를 추가하는 것이 Stage 1 목적이었다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/cli-login.js` | device code/user code 생성, digest 저장, verification URI, poll interval, user code approval, device code poll, 1회 token exchange domain logic 추가 |
| `src/profile-backend/store.js` | CLI login challenge를 device code digest와 user code로 조회하는 index 추가 및 conflict/update 처리 |
| `src/profile-backend/index.js` | device login domain 상수와 digest helper export 추가 |
| `src/profile-backend/__tests__/cli-login.test.js` | device code start, raw code 미저장, user code approval, pending/expired poll, token 1회 반환 테스트 추가 |
| `src/profile-backend/__tests__/store.test.js` | device digest/user code index clone/update/conflict 테스트 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. 기존 `startCliLogin`, `approveCliLogin`, `exchangeCliLogin`의 challenge id 기반 contract는 유지했다. 새 device-code 필드는 추가 형태로 저장되며, 기존 `/api/cli/login/*` route는 아직 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-backend/__tests__/cli-login.test.js
npm test -- src/profile-backend/__tests__/store.test.js
git diff --check
```

결과:

- OK: `cli-login.test.js` 7개 테스트 통과
- OK: `store.test.js` 16개 테스트 통과
- OK: `git diff --check` 경고 없음
- 참고: 분리 worktree에 `node_modules`가 없어 최초 테스트가 dependency resolution에서 실패했고, `npm install` 후 재검증했다. 패키지 파일 변경은 발생하지 않았다.

## 잔여 위험

- HTTP serializer/route는 아직 새 device fields를 노출하지 않는다. Stage 2에서 `POST /api/auth/device`, authorize, poll route를 추가해야 한다.
- OAuth callback이 user code 기반 approval로 돌아오는 흐름은 아직 기존 challenge id query 중심이다. Stage 2에서 bridge를 정리한다.

## 다음 단계 영향

- Stage 2는 `pollCliLogin({ deviceCode })`와 `approveCliLogin({ userCode })`를 그대로 HTTP route에 연결하면 된다.
- start route는 `deviceCode`, `userCode`, `verificationUri`, `verificationUriComplete`, `expiresAt`, `intervalSeconds`를 CLI 응답으로 직렬화해야 한다.
- raw device code는 start 응답에서만 반환하고 store/serialized challenge에는 포함하면 안 된다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 HTTP API and OAuth/session bridge로 진행한다.
