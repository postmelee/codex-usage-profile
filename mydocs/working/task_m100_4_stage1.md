# Task M100 #4 Stage 1 보고서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
구현계획서: [`task_m100_4_impl.md`](../plans/task_m100_4_impl.md)  
Stage: 1

## 단계 목적

GitHub login/CLI submit 기반 backend의 첫 경계로 공통 error contract, credential-like payload 차단 helper, in-memory repository seam을 만든다. Stage 2 이후 GitHub identity, CLI token lifecycle, snapshot submit service가 같은 error code와 store interface를 재사용할 수 있게 고정하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/errors.js` | backend 공통 `ProfileBackendError`, stable error code, HTTP status mapping, response body 변환 추가 |
| `src/profile-backend/security.js` | `access_token`, `refresh_token`, `auth.json`, `CODEX_ACCESS_TOKEN`, `api_key`, bearer/OpenAI/GitHub token, private key 형태 탐지 helper 추가 |
| `src/profile-backend/store.js` | owner, CLI login challenge, CLI token digest, latest snapshot을 다루는 in-memory repository와 key conflict 규칙 추가 |
| `src/profile-backend/index.js` | Stage 1 backend contract export surface 추가 |
| `src/profile-backend/__tests__/security.test.js` | 정상 token usage metric은 허용하고 credential-like key/value는 차단하는 보안 테스트 추가 |
| `src/profile-backend/__tests__/store.test.js` | owner/provider/handle 조회, conflict, clone/immutability, CLI token digest, latest snapshot 저장 및 key conflict 테스트 추가 |
| `mydocs/orders/20260608.md` | #4 명칭과 현재 진행 상태를 Stage 1 기준으로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

코드 신규 추가 중심이다. 기존 profile snapshot schema, normalizer, UI 경로는 변경하지 않았다. `security.js`는 `totalTextTokens`, `peakTokens`, `tokenDigest`, `apiKeyDigest`처럼 저장 가능한 metric/digest 필드를 credential로 오탐하지 않도록 테스트로 고정했다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

결과:

- OK: `npm test` 통과. `node --test` 기준 38개 테스트 전체 pass, fail 0.
- OK: `git diff --check` 통과. whitespace error 없음.

## 잔여 위험

- 이번 단계의 store는 테스트용 in-memory seam이다. 실제 영속 DB, OAuth callback, API token 원문 발급/저장은 Stage 2 이후에서 구현한다.
- credential-like detector는 보수적 규칙 기반이다. Stage 3 snapshot submit wrapper에서 실제 submit payload에 다시 적용하면서 false positive/negative를 추가 보정해야 한다.

## 다음 단계 영향

- Stage 2는 `ProfileBackendError`, `PROFILE_BACKEND_ERROR_CODES`, `createMemoryProfileBackendStore`를 사용해 GitHub identity owner upsert와 CLI login/token lifecycle을 구현한다.
- CLI token은 Stage 1 store의 `tokenDigest` index에만 저장하고 raw token은 발급 응답에서 한 번만 노출하는 정책으로 이어간다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 — GitHub identity와 CLI token lifecycle 구현으로 진행한다.
