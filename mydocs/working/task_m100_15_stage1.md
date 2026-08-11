# Task M100 #15 Stage 1 완료 보고

## 단계 목표

Settings 화면에서 사용할 API token 관리 backend contract를 구현했다. 이번 단계의 핵심은 browser session cookie로만 token 관리 API를 허용하고, raw token은 생성 응답에서만 한 번 반환하며, list/revoke/store에는 digest와 raw token을 노출하지 않는 것이다.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `src/profile-backend/store.js` | owner 기준 CLI token 목록 조회 method 추가 |
| `src/profile-backend/tokens.js` | `listCliTokens` service method 추가, revoked token 기본 제외 |
| `src/profile-backend/http.js` | `GET/POST /api/settings/tokens`, `DELETE /api/settings/tokens/:tokenId` route 추가 |
| `src/profile-backend/__tests__/tokens.test.js` | owner별 token list와 revoked 제외 동작 검증 |
| `src/profile-backend/__tests__/http.test.js` | settings token create/list/revoke, device-code token list, bearer-only 관리 거부, revoke 후 submit 실패 검증 |
| `src/profile-backend/__tests__/security.test.js` | settings token response와 store의 raw token/digest 노출 범위 검증 |
| `mydocs/orders/20260614.md` | Stage 1 완료 상태 갱신 |

## 구현 내용

- `tokenService.listCliTokens({ ownerId })`를 추가했다.
- store에 `listCliTokensByOwnerId(ownerId)`를 추가했고, 생성일 내림차순으로 반환한다.
- settings token route는 `sessionService.verifySessionFromCookie`만 사용한다.
- token create route는 `label` 또는 `name`을 받아 trim하고, 빈 값이면 `CLI token`, 최대 100자로 정규화한다.
- token create response는 `{ token, tokenRecord }`를 반환하되, `tokenRecord`에는 raw token과 digest가 없다.
- token list/revoke response는 serializer를 통해 raw token과 digest를 제외한다.
- revoke는 기존 soft revoke 정책인 `revokedAt` 갱신을 유지한다.
- revoked token은 기본 list에서 제외된다.

## 검증

```bash
npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
```

결과:

- OK: 28개 테스트 통과
- OK: settings token create/list/revoke route 동작 확인
- OK: device-code login으로 발급된 token이 settings token list에 표시됨
- OK: bearer token만 있는 settings 관리 요청은 401
- OK: revoke 후 해당 token으로 submit 시 410
- OK: raw token은 create response 외 list/revoke/store에 남지 않음

## 남은 작업

- Stage 2에서 submitted device model과 device list/rename API를 구현한다.
- Stage 3에서 settings API Tokens UI를 backend route에 연결한다.

## 다음 단계 승인 요청

Stage 2 — submitted device model and API 진행 승인을 요청한다.
