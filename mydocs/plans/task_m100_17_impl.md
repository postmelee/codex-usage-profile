# Task M100 #17 구현계획서

수행계획서: [`task_m100_17.md`](task_m100_17.md)
GitHub Issue: [#17](https://github.com/postmelee/codex-usage-profile/issues/17)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Device login domain model | `src/profile-backend/cli-login.js`, `src/profile-backend/store.js`, backend domain tests | `npm test -- src/profile-backend/__tests__/cli-login.test.js` |
| 2 | HTTP API and OAuth/session bridge | `src/profile-backend/http.js`, related HTTP tests | `npm test -- src/profile-backend/__tests__/http.test.js` |
| 3 | Minimal device approval UI | `src/profile-ui/DeviceApprovalPage.jsx`, `src/profile-api/client.js`, route/client tests | `npm test -- src/profile-api/__tests__/client.test.js` |
| 4 | Security and integration hardening | security tests, full build/test, final report | `npm test`, `npm run build`, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_17.md` | `mydocs/plans/` | 작성 완료 | OK | 수행계획서 |
| `mydocs/orders/20260613.md` | `mydocs/orders/` | 갱신 완료 | OK | 오늘할일 |
| `mydocs/plans/task_m100_17_impl.md` | `mydocs/plans/` | 본 문서 | OK | 구현계획서 |
| 공식 API/사용자 문서 | 해당 없음 | 해당 없음 | OK | #5 CLI 구현 시점으로 이월 |

## Stage 1 — Device login domain model

### 산출물

신규:

- 없음

수정:

- `src/profile-backend/cli-login.js`
- `src/profile-backend/store.js`
- `src/profile-backend/index.js`
- `src/profile-backend/__tests__/cli-login.test.js`
- `src/profile-backend/__tests__/store.test.js`
- `mydocs/working/task_m100_17_stage1.md`

### 변경 내용

- CLI login challenge에 `deviceCodeDigest`, `userCode`, `verificationUri`, `verificationUriComplete`, `intervalSeconds`를 추가한다.
- raw device code를 반환하되 store에는 digest만 저장한다.
- user code normalization과 lookup helper를 store에 추가한다.
- poll semantics를 domain method로 분리해 `pending`, `approved`, `expired`, `exchanged` 상태를 안정적으로 반환한다.
- 기존 `startCliLogin`, `approveCliLogin`, `exchangeCliLogin` 테스트가 깨지지 않도록 legacy challenge id 기반 흐름을 유지한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/cli-login.test.js
git diff --check
```

### 커밋

```text
Task #17 Stage 1: device login domain model 구현
```

## Stage 2 — HTTP API and OAuth/session bridge

### 산출물

- `src/profile-backend/http.js`
- `src/profile-backend/__tests__/http.test.js`
- `mydocs/working/task_m100_17_stage2.md`

### 변경 내용

- `POST /api/auth/device` start route를 추가한다.
- `POST /api/auth/device/authorize` route를 추가하고 session owner로 user code를 승인한다.
- `POST /api/auth/device/poll` route를 추가하고 device code 기반 polling과 1회 token exchange를 제공한다.
- GitHub OAuth login/callback에서 device user code 또는 challenge id를 승인 흐름에 연결한다.
- serializer에서 raw token/digest가 불필요하게 노출되지 않도록 응답 형태를 고정한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/http.test.js
git diff --check
```

### 커밋

```text
Task #17 Stage 2: device auth HTTP API 구현
```

## Stage 3 — Minimal device approval UI

### 산출물

- `src/profile-api/client.js`
- `src/profile-ui/DeviceApprovalPage.jsx`
- `src/App.jsx`
- `src/profile-ui/profileRoutes.js`
- `src/styles.css`
- 필요한 UI/API 테스트
- `mydocs/working/task_m100_17_stage3.md`

### 변경 내용

- `/device` route에서 user code를 입력 또는 URL query로 확인할 수 있는 최소 승인 화면을 만든다.
- 로그인 상태를 확인하고, 로그인되지 않은 사용자는 GitHub login으로 이동할 수 있게 한다.
- approve API 호출과 성공/실패 상태를 표시한다.
- #14 Settings shell과 겹치지 않도록 account menu/settings 구현은 제외한다.

### 검증

```bash
npm test -- src/profile-api/__tests__/client.test.js
npm test
git diff --check
```

### 커밋

```text
Task #17 Stage 3: device approval UI 구현
```

## Stage 4 — Security and integration hardening

### 산출물

- `src/profile-backend/__tests__/security.test.js`
- 필요한 보안/통합 테스트 보강
- `mydocs/working/task_m100_17_stage4.md`
- `mydocs/report/task_m100_17_report.md`

### 변경 내용

- raw device code, raw CLI token, OAuth token, token digest 노출 여부를 점검한다.
- expired, duplicate approval, duplicate exchange, invalid code, missing session 케이스를 보강한다.
- 전체 테스트/build를 실행하고 최종 보고서를 작성한다.

### 검증

```bash
npm test
npm run build
git diff --check
```

### 커밋

```text
Task #17 Stage 4: device login 보안 검증 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_17_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #17 Stage {N}: {핵심 내용 요약}` 형식을 따른다.

## 단계 의존성

- Stage 2는 Stage 1의 domain model이 확정된 뒤 진행한다.
- Stage 3은 Stage 2의 HTTP API 응답 contract가 확정된 뒤 진행한다.
- Stage 4는 Stage 1~3 검증과 보고서가 완료된 뒤 진행한다.

## 위험과 대응

- **legacy route 회귀**: Stage 1~2에서 기존 `/api/cli/login/*` 테스트를 유지한다.
- **token-like 값 노출**: raw device code는 start 응답에서만 반환하고 저장소에는 digest만 남긴다.
- **UI 범위 확장**: `/device` 최소 승인 화면 외 account menu/settings는 #14로 남긴다.
- **analyzer 진행과 혼선**: #17은 analyzer 없이 인증 API 단독으로 검증한다.

## 승인 요청 사항

- 수행계획서 승인에 따라 위 Stage 분할과 Stage 1 구현 진입을 승인받은 것으로 보고 진행한다.
