# Task M100 #4 Stage 3 보고서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
구현계획서: [`task_m100_4_impl.md`](../plans/task_m100_4_impl.md)  
Stage: 3

## 단계 목적

CLI API token 인증 결과를 owner context로 변환해 Codex profile snapshot submit을 처리하고, 최신 snapshot repository record에 공개 조회에 필요한 metadata를 저장한다. 저장 전 token-like payload를 차단하고, 기존 `validateProfileSnapshot` schema를 통과한 snapshot만 latest record로 갱신한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/snapshots.js` | snapshot submit service, submit payload 정규화, public handle lookup helper 추가 |
| `src/profile-backend/__tests__/snapshots.test.js` | valid submit, latest update, public/private lookup, invalid snapshot, token-like payload, expired/revoked token, handle conflict 테스트 추가 |
| `src/profile-backend/store.js` | latest snapshot record 필수 metadata를 `visibility`, `capturedAt`, `uploadedAt`, `schemaVersion`까지 확장 |
| `src/profile-backend/__tests__/store.test.js` | latest snapshot metadata 강화에 맞춰 store fixture 갱신 |
| `src/profile-backend/index.js` | snapshot submit service export 추가 |
| `mydocs/orders/20260610.md` | 2026-06-10 오늘할일에 #4 Stage 3 진행 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

backend source와 테스트 중심 변경이다. 기존 profile snapshot schema, selector, UI 코드는 변경하지 않았다. Stage 1/2의 error, security, token service contract를 그대로 사용했고, latest snapshot record contract만 Stage 3 요구사항에 맞게 metadata 필수 저장으로 확장했다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

결과:

- OK: `npm test` 통과. `node --test` 기준 63개 테스트 전체 pass, fail 0.
- OK: `git diff --check` 통과. whitespace error 없음.

## 잔여 위험

- HTTP route는 아직 없다. Stage 4에서 bearer token parsing, malformed JSON, public/private handle 응답을 route 단위로 검증해야 한다.
- public lookup helper는 private snapshot을 `null`로 숨긴다. Stage 4에서는 이를 404/not found 형태로 통일해야 한다.
- 실제 DB persistence와 snapshot history는 이번 task 범위 밖이다. 현재는 latest snapshot만 in-memory store에 유지한다.

## 다음 단계 영향

- Stage 4 HTTP API는 `createSnapshotSubmitService().submitSnapshot()`과 `getPublicSnapshotByHandle()`을 그대로 route handler에 연결하면 된다.
- `POST /api/snapshots/submit`은 bearer token을 `token` 인자로 전달하고, request body를 submit payload로 넘기면 Stage 3 validation/security가 적용된다.
- `GET /api/snapshots/public/:handle`은 private record를 노출하지 않도록 `getPublicSnapshotByHandle()` 결과가 `null`일 때 not found 응답을 반환해야 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 — HTTP API와 public handle 조회 구현으로 진행한다.

