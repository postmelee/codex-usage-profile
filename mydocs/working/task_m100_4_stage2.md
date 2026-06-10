# Task M100 #4 Stage 2 보고서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
구현계획서: [`task_m100_4_impl.md`](../plans/task_m100_4_impl.md)  
Stage: 2

## 단계 목적

GitHub login/CLI submit 방식의 계정 연결과 CLI API token lifecycle을 domain service로 구현한다. 실제 GitHub network call과 HTTP adapter는 후속 Stage에서 붙일 수 있도록 fake 가능한 seam을 만들고, owner upsert, handle collision, CLI login challenge 승인/교환, token digest 저장·검증·폐기를 테스트로 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/auth.js` | GitHub identity 정규화와 fake 가능한 `githubClient` callback seam 추가 |
| `src/profile-backend/accounts.js` | `authProvider + providerUserId` 기준 owner upsert, handle slug/suffix collision, visibility 검증 추가 |
| `src/profile-backend/cli-login.js` | CLI browser login challenge 생성, 승인, token 교환, 만료·재사용 실패 처리 추가 |
| `src/profile-backend/tokens.js` | CLI raw token 발급, SHA-256 digest 저장, 검증, owner mismatch, 만료, 폐기 lifecycle 추가 |
| `src/profile-backend/index.js` | Stage 2 public export surface 추가 |
| `src/profile-backend/__tests__/accounts.test.js` | GitHub identity normalize, fake client seam, idempotent owner upsert, deterministic handle collision 테스트 추가 |
| `src/profile-backend/__tests__/cli-login.test.js` | CLI login start/approve/exchange, not-approved, reuse, expired challenge 테스트 추가 |
| `src/profile-backend/__tests__/tokens.test.js` | raw token one-time return, digest-only storage, verify last-used, expired/revoked/mismatched token 테스트 추가 |
| `mydocs/orders/20260608.md` | #4 진행 상태를 Stage 2 검증 완료 기준으로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

신규 backend domain service 추가와 `src/profile-backend/index.js` export 보강이 중심이다. 기존 Stage 1 error/security/store contract와 profile snapshot/UI 코드는 변경하지 않았다. GitHub OAuth access token은 `resolveGitHubIdentityFromCode` 내부에서 fake client seam으로만 전달되고, 정규화된 identity/owner record에는 복사하지 않는다. CLI raw token은 `exchangeCliLogin` 또는 `issueCliToken` 결과에서 한 번 반환되며 store에는 `tokenDigest`만 저장한다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

결과:

- OK: `npm test` 통과. `node --test` 기준 55개 테스트 전체 pass, fail 0.
- OK: `git diff --check` 통과. whitespace error 없음.

## 잔여 위험

- GitHub OAuth 실서비스 호출, session/cookie, CSRF state 검증은 아직 HTTP adapter 밖의 fake seam 수준이다. Stage 4에서 endpoint를 만들 때 request boundary 검증을 추가해야 한다.
- CLI login challenge는 browser URL의 opaque challenge id로 연결한다. 수동 pairing code 방식은 쓰지 않지만, 실제 배포 시에는 challenge id entropy와 TTL을 deployment 환경에 맞게 재검토해야 한다.
- token digest는 in-memory store에 저장된다. 실제 DB/secret rotation/audit 정책은 후속 persistence 또는 운영 task에서 결정해야 한다.

## 다음 단계 영향

- Stage 3 snapshot submit service는 `createCliTokenService().verifyCliToken()` 결과의 `owner` context를 사용해 submit 권한을 결정한다.
- Stage 3 저장 전 payload 보안 검사는 Stage 1의 `assertNoForbiddenSecrets`와 Stage 2 token lifecycle을 함께 사용해 raw token이나 OAuth token이 snapshot 저장소에 들어가지 않도록 고정한다.
- Stage 4 HTTP API는 `resolveGitHubIdentityFromCode`, `createAccountService`, `createCliLoginService`, `createCliTokenService`를 route handler 경계에서 조합하면 된다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 — Snapshot submit과 latest snapshot repository 구현으로 진행한다.

