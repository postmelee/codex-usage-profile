# Task M100 #15 Stage 2 완료 보고

## 단계 목표

Submitted device model과 settings device 관리 API를 구현했다. device는 analyzer snapshot 내부 field가 아니라 submit wrapper/service metadata로 저장하며, settings에서는 로그인 session owner 기준으로 목록 조회와 표시 이름 변경만 수행한다.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `src/profile-backend/devices.js` | submitted device service, device metadata/name 정규화, display label fallback 추가 |
| `src/profile-backend/store.js` | submitted device 저장, owner+deviceKey index, list/export/hydrate 추가 |
| `src/profile-backend/snapshots.js` | submit wrapper의 optional `device` metadata 허용 및 submit 성공 시 device upsert |
| `src/profile-backend/http.js` | `GET /api/settings/devices`, `PATCH /api/settings/devices/:deviceId` route 추가 |
| `src/profile-backend/index.js` | device service와 constants export 추가 |
| `src/profile-backend/__tests__/devices.test.js` | device service 단위 동작 검증 |
| `src/profile-backend/__tests__/store.test.js` | submitted device store/index/export/hydrate 검증 |
| `src/profile-backend/__tests__/snapshots.test.js` | submit device metadata 정규화와 저장 검증 |
| `src/profile-backend/__tests__/http.test.js` | settings device list/rename, session ownership, validation 검증 |
| `src/profile-backend/__tests__/security.test.js` | device metadata 내 credential-like 값 탐지 검증 |
| `mydocs/orders/20260614.md` | Stage 2 완료 상태 갱신 |

## 구현 내용

- `createSubmittedDeviceService`를 추가했다.
- device record 최소 필드를 `id`, `ownerId`, `deviceKey`, `displayName`, `createdAt`, `updatedAt`, `lastSubmittedAt`으로 두었다.
- `ownerId + deviceKey` 기준 upsert index를 memory store에 추가했다.
- `normalizeSnapshotSubmitPayload`가 optional `device` wrapper metadata를 허용한다.
- submit payload에 `device`가 없으면 `legacy-default` device로 기록한다.
- submit payload에 `device: { id, name }`이 있으면 해당 device를 등록하거나 `lastSubmittedAt`을 갱신한다.
- settings rename으로 바꾼 `displayName`은 이후 submit의 device name으로 덮어쓰지 않도록 보존한다.
- settings device list serializer는 `displayName`, `customName`, `deviceKey`, timestamp metadata만 반환한다.
- rename은 trim, empty reset, 최대 120자, control character 거부를 적용한다.
- 다른 owner의 device rename은 `not_found`로 처리한다.

## 검증

```bash
npm test -- src/profile-backend/__tests__/devices.test.js src/profile-backend/__tests__/snapshots.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js src/profile-backend/__tests__/store.test.js src/profile-backend/__tests__/durable-store.test.js
```

결과:

- OK: 61개 테스트 통과
- OK: device metadata가 submit wrapper로 정규화되고 snapshot 내부에는 추가되지 않음
- OK: legacy/default device fallback 기록
- OK: settings device list/rename route 동작 확인
- OK: session owner가 아닌 rename 요청은 404
- OK: device name validation 실패는 400
- OK: durable store가 기존 state와 함께 submitted device field를 보존

추가 검증:

```bash
git diff --check
```

결과:

- OK: whitespace 경고 없음

## 남은 작업

- Stage 3에서 Settings API Tokens UI를 Stage 1 backend route에 연결한다.
- Stage 4에서 Settings Devices UI를 Stage 2 backend route에 연결한다.

## 다음 단계 승인 요청

Stage 3 — Settings API Tokens UI 진행 승인을 요청한다.
