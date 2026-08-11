# Task M100 #15 구현계획서

수행계획서: [`task_m100_15.md`](task_m100_15.md)
GitHub Issue: [#15](https://github.com/postmelee/codex-usage-profile/issues/15)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Token settings API | token list/create/revoke route, token list service/store methods, backend tests | `npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js` |
| 2 | Submitted device model and API | submitted device store/service, submit device metadata, list/rename route, backend tests | `npm test -- src/profile-backend/__tests__/devices.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js` |
| 3 | Settings API Tokens UI | API client methods, settings token section, one-time token reveal UX | `npm test -- src/profile-api/__tests__/client.test.js` |
| 4 | Settings Devices UI | settings device list/rename section, responsive/edit states | `npm test -- src/profile-api/__tests__/client.test.js` + browser QA |
| 5 | Integration hardening | full regression, build, final report, PR prep | `npm test`, `npm run build`, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_15.md` | `mydocs/plans/` | 작성 완료 | OK | 수행계획서 |
| `mydocs/orders/20260614.md` | `mydocs/orders/` | 갱신 완료 | OK | 오늘할일 |
| `mydocs/plans/task_m100_15_impl.md` | `mydocs/plans/` | 본 문서 | OK | 구현계획서 |
| 공식 사용자/API 문서 | 해당 없음 | 해당 없음 | OK | 실제 CLI 사용 문서는 #5에서 작성 |

## Stage 1 — Token settings API

### 산출물

신규:

- `mydocs/working/task_m100_15_stage1.md`

수정:

- `src/profile-backend/store.js`
- `src/profile-backend/tokens.js`
- `src/profile-backend/http.js`
- `src/profile-backend/index.js`
- `src/profile-backend/__tests__/tokens.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `mydocs/orders/20260614.md`

### 변경 내용

- `createCliTokenService`에 owner 기준 token list와 settings token 생성 metadata를 추가한다.
- store에 owner 기준 CLI token 목록 조회 method를 추가한다.
- HTTP route를 추가한다.
  - `GET /api/settings/tokens`
  - `POST /api/settings/tokens`
  - `DELETE /api/settings/tokens/:tokenId`
- settings token route는 session cookie로만 인증한다. bearer CLI token은 관리 API 인증 수단으로 사용하지 않는다.
- token list/create response에는 raw token digest를 절대 포함하지 않는다.
- token create response는 raw token을 생성 직후 한 번만 포함한다.
- revoke는 기존 `revokedAt` soft revoke 정책을 유지한다.
- device-code login으로 발급된 token은 `sourceChallengeId`와 label을 통해 list에서 식별 가능하게 한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
git diff --check
```

### 커밋

```text
Task #15 Stage 1: settings token API 구현
```

## Stage 2 — Submitted device model and API

### 산출물

신규:

- `src/profile-backend/devices.js`
- `src/profile-backend/__tests__/devices.test.js`
- `mydocs/working/task_m100_15_stage2.md`

수정:

- `src/profile-backend/store.js`
- `src/profile-backend/snapshots.js`
- `src/profile-backend/http.js`
- `src/profile-backend/index.js`
- `src/profile-backend/__tests__/snapshots.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `mydocs/orders/20260614.md`

### 변경 내용

- submitted device record를 `ownerId + deviceKey` 기준으로 저장한다.
- submit payload의 optional `device: { id, name }` metadata를 읽어 device를 upsert한다.
- device metadata가 없는 기존 submit은 legacy/default device로 처리한다.
- HTTP route를 추가한다.
  - `GET /api/settings/devices`
  - `PATCH /api/settings/devices/:deviceId`
- device rename은 trim, empty reset, 최대 길이, control character 거부를 적용한다.
- owner가 다른 device rename은 not found 계열로 처리한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/devices.test.js src/profile-backend/__tests__/snapshots.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
git diff --check
```

### 커밋

```text
Task #15 Stage 2: submitted device 관리 API 구현
```

## Stage 3 — Settings API Tokens UI

### 산출물

신규:

- 필요한 경우 `src/profile-ui/settingsUi.js`
- 필요한 경우 `src/profile-ui/__tests__/settingsUi.test.js`
- `mydocs/working/task_m100_15_stage3.md`

수정:

- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/SettingsPage.jsx`
- `src/styles.css`
- `mydocs/orders/20260614.md`

### 변경 내용

- API client에 settings token list/create/revoke method를 추가한다.
- `/settings` authenticated view에 API Tokens section을 추가한다.
- token name input, create button, loading/error 상태, empty state, token list, revoke action을 구현한다.
- created token reveal panel은 raw token을 한 번만 보여주고 copy 후 state에서 제거한다.
- raw token은 list state와 persisted UI state에 저장하지 않는다.

### 검증

```bash
npm test -- src/profile-api/__tests__/client.test.js
git diff --check
```

브라우저 확인:

```text
http://127.0.0.1:{port}/settings
```

### 커밋

```text
Task #15 Stage 3: settings token UI 구현
```

## Stage 4 — Settings Devices UI

### 산출물

신규:

- `mydocs/working/task_m100_15_stage4.md`

수정:

- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/SettingsPage.jsx`
- `src/styles.css`
- 필요한 UI helper/test
- `mydocs/orders/20260614.md`

### 변경 내용

- API client에 settings device list/rename method를 추가한다.
- `/settings` authenticated view에 Devices section을 추가한다.
- device empty state, list state, rename edit mode, Save/Cancel, Enter/Escape keyboard behavior를 구현한다.
- device display label은 custom name이 없을 때 fallback label을 사용한다.
- 좁은 viewport에서 token/device row와 action button이 겹치지 않도록 responsive CSS를 보강한다.

### 검증

```bash
npm test -- src/profile-api/__tests__/client.test.js
git diff --check
```

브라우저 확인:

```text
http://127.0.0.1:{port}/settings
```

### 커밋

```text
Task #15 Stage 4: settings device UI 구현
```

## Stage 5 — Integration hardening

### 산출물

- `mydocs/working/task_m100_15_stage5.md`
- `mydocs/report/task_m100_15_report.md`
- 필요한 최종 테스트 보강
- `mydocs/orders/20260614.md`

### 변경 내용

- 전체 backend/frontend 테스트를 실행한다.
- production build를 실행한다.
- token/digest/raw secret 노출 여부를 security regression으로 확인한다.
- in-app browser로 `/settings`를 확인한다.
- 최종 보고서와 PR 본문에 필요한 검증 결과를 정리한다.

### 검증

```bash
npm test
npm run build
git diff --check
```

### 커밋

```text
Task #15 Stage 5: token device 관리 통합 검증
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- browser QA에서 실제 GitHub session을 재현하지 못하면 helper/API 테스트 결과와 검증 한계를 단계 보고서에 명시한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_15_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #15 Stage {N}: {핵심 내용 요약}` 형식을 따른다.

## 단계 의존성

- Stage 2는 Stage 1의 token route와 session-only 관리 API 경계가 고정된 뒤 진행한다.
- Stage 3은 Stage 1 token API가 구현된 뒤 진행한다.
- Stage 4는 Stage 2 device API가 구현된 뒤 진행한다.
- Stage 5는 Stage 1~4 검증과 보고서가 완료된 뒤 진행한다.

## 위험과 대응

- **session-only route 누락**: settings route test에서 bearer token만 제공한 요청은 401을 기대한다.
- **raw token 보존**: create response 외 serializer/list/store snapshot에서 raw token과 digest를 노출하지 않는다.
- **device와 snapshot 결합**: device metadata는 submit wrapper/service metadata로 저장하고 UsageSnapshot 내부에는 추가하지 않는다.
- **UI state 비대화**: SettingsPage가 커지면 helper를 분리하되, 불필요한 새 상태 관리 라이브러리는 도입하지 않는다.

## 승인 요청 사항

수행계획서 승인에 따라 위 Stage 분할과 Stage 1 구현 진입을 승인받은 것으로 보고 진행한다.
