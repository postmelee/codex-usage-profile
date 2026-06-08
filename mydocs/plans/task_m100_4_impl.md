# Task M100 #4 구현계획서

수행계획서: [`task_m100_4.md`](task_m100_4.md)  
GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Account/auth domain contract와 보안 boundary | `src/profile-backend/errors.js`, `security.js`, `store.js`, domain type docs/tests | `npm test`, forbidden secret scan test, `git diff --check` |
| 2 | GitHub identity와 CLI token lifecycle | `auth.js`, `accounts.js`, `cli-login.js`, `tokens.js` | owner upsert, login challenge, token lifecycle tests |
| 3 | Snapshot submit과 latest snapshot repository | snapshot submit service, latest snapshot repository methods | submit success/failure, audit metadata, token-like payload tests |
| 4 | HTTP API와 public handle 조회 | `http.js`, endpoint-level tests | GitHub callback, CLI token exchange, submit, public/private HTTP tests |
| 5 | Web integration 경계와 최종 검증 | `src/profile-api/client.js`, optional profile route integration, final stage report | `npm test`, `npm run build`, optional e2e, secret grep, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_4_impl.md` | `mydocs/plans/` | `mydocs/plans/task_m100_4_impl.md` | OK | 구현계획서 |
| `mydocs/working/task_m100_4_stage{N}.md` | `mydocs/working/` | `mydocs/working/task_m100_4_stage{N}.md` | OK | 단계 보고서 |
| `src/profile-backend/*` | repository source tree | `src/profile-backend/` | OK | backend domain/API 코드 |
| `src/profile-api/client.js` | repository source tree | `src/profile-api/client.js` | OK | frontend/backend 조회 경계 |
| 공식 사용자/API 문서 | 해당 없음 | 해당 없음 | OK | 이번 task에서는 만들지 않는다. CLI 사용법/API 문서는 후속 docs task에서 결정한다. |

## 구현 방식 결정

- #4는 pairing code 방식이 아니라 Tokscale-style `login -> submit` backend 기반으로 구현한다.
- 실제 npm CLI 패키지는 만들지 않는다. 대신 CLI caller가 사용할 수 있는 HTTP/domain contract와 token exchange endpoint를 고정한다.
- GitHub OAuth 실서비스 network call은 domain core에 직접 묶지 않는다. `auth.js`는 GitHub identity payload를 검증/정규화하는 경계와 callback handler seam을 제공하고, tests는 fake GitHub client를 사용한다.
- owner/account는 `authProvider`, `providerUserId`, `githubLogin`, `handle`, `visibility`를 가진다.
- `handle`은 GitHub login 기반 slug로 만들고, 중복 시 `login-2`, `login-3`처럼 deterministic suffix를 붙인다.
- CLI API token은 발급 직후 원문을 한 번 반환하고 store에는 digest만 남긴다.
- `access_token`, `refresh_token`, `auth.json`, `CODEX_ACCESS_TOKEN`, `api_key` 같은 token-like key/value는 snapshot submit wrapper와 snapshot 내부에서 저장 전 차단한다.
- HTTP adapter는 Node `Request`/`Response` 스타일 순수 handler를 우선 구현한다. 실제 server listen/deployment adapter는 후속 task에서 결정한다.

## Stage 1 — Account/auth domain contract와 보안 boundary

### 산출물

신규:

- `src/profile-backend/errors.js`
- `src/profile-backend/security.js`
- `src/profile-backend/store.js`
- `src/profile-backend/index.js`
- `src/profile-backend/__tests__/security.test.js`
- `src/profile-backend/__tests__/store.test.js`
- `mydocs/working/task_m100_4_stage1.md`

수정:

- `src/profile-snapshot/index.js` 필요 시 export 보강

### 변경 내용

- backend 공통 error class와 stable error code를 정의한다.
- token-like key/value 탐지 함수를 만든다.
- snapshot submit wrapper에서 저장 금지 필드를 검사하는 security helper를 만든다.
- in-memory repository interface를 owner, CLI auth challenge/token, latest snapshot 저장 영역으로 나눈다.
- repository는 테스트용 persistence seam이며 실제 DB 구현은 후속 task로 둔다.
- 수행계획서의 문서 위치 판단과 다르게 공식 문서는 만들지 않는다.

### 검증

```bash
npm test
git diff --check
```

추가 확인:

- `security.test.js`에서 token-like key/value 탐지
- `store.test.js`에서 in-memory repository 기본 CRUD와 clone/immutability

### 커밋

```text
Task #4 Stage 1: backend domain contract와 보안 boundary 추가
```

## Stage 2 — GitHub identity와 CLI token lifecycle

### 산출물

신규:

- `src/profile-backend/auth.js`
- `src/profile-backend/accounts.js`
- `src/profile-backend/cli-login.js`
- `src/profile-backend/tokens.js`
- `src/profile-backend/__tests__/accounts.test.js`
- `src/profile-backend/__tests__/cli-login.test.js`
- `src/profile-backend/__tests__/tokens.test.js`
- `mydocs/working/task_m100_4_stage2.md`

수정:

- `src/profile-backend/store.js`
- `src/profile-backend/index.js`

### 변경 내용

- GitHub identity payload를 owner/account record로 정규화한다.
- owner upsert는 `authProvider + providerUserId` 기준으로 idempotent하게 동작한다.
- handle collision policy를 구현한다.
- CLI login challenge lifecycle을 구현한다.
  - create: CLI가 browser login URL을 열기 전에 pending challenge 생성
  - approve: GitHub-authenticated owner가 challenge를 승인
  - exchange: CLI가 challenge를 API token으로 교환
  - reuse/expired/not-approved 상태는 실패
- CLI API token lifecycle을 구현한다.
  - 발급 시 raw token 1회 반환
  - store에는 digest와 metadata만 저장
  - 만료/폐기/owner mismatch 실패

### 검증

```bash
npm test
git diff --check
```

추가 확인:

- GitHub identity -> owner upsert
- handle collision deterministic suffix
- CLI login challenge 생성/승인/교환/재사용 실패
- API token digest 저장, 만료, 폐기, 검증 실패

### 커밋

```text
Task #4 Stage 2: GitHub identity와 CLI token lifecycle 구현
```

## Stage 3 — Snapshot submit과 latest snapshot repository

### 산출물

신규:

- `src/profile-backend/snapshots.js`
- `src/profile-backend/__tests__/snapshots.test.js`
- `mydocs/working/task_m100_4_stage3.md`

수정:

- `src/profile-backend/store.js`
- `src/profile-backend/index.js`
- 필요 시 `src/profile-snapshot/index.js`

### 변경 내용

- API token 인증 결과를 owner context로 변환한다.
- submit payload wrapper를 정의한다.
  - `snapshot`
  - `capturedAt`
  - optional `visibility`
  - optional `handle`
- 기존 `validateProfileSnapshot`으로 snapshot schema를 검증한다.
- 저장 전 token-like field를 거부한다.
- latest snapshot record에 `ownerId`, `handle`, `visibility`, `capturedAt`, `uploadedAt`, `schemaVersion`을 붙인다.
- 같은 owner가 다시 submit하면 latest snapshot이 갱신된다.

### 검증

```bash
npm test
git diff --check
```

추가 확인:

- valid snapshot submit 성공
- invalid snapshot submit 실패
- revoked/expired token submit 실패
- token-like key/value 포함 payload 실패
- latest snapshot update와 audit metadata 검증

### 커밋

```text
Task #4 Stage 3: snapshot submit과 latest 저장 구현
```

## Stage 4 — HTTP API와 public handle 조회

### 산출물

신규:

- `src/profile-backend/http.js`
- `src/profile-backend/__tests__/http.test.js`
- `mydocs/working/task_m100_4_stage4.md`

수정:

- `src/profile-backend/index.js`
- 필요 시 `package.json` scripts 보강

### 변경 내용

- Node `Request`/`Response` 스타일 route handler를 만든다.
- endpoint 초안:
  - `POST /api/auth/github/callback`
  - `POST /api/cli/login/start`
  - `POST /api/cli/login/approve`
  - `POST /api/cli/login/exchange`
  - `POST /api/snapshots/submit`
  - `GET /api/snapshots/public/:handle`
- response body는 `{ ok: true, data }` 또는 `{ ok: false, error: { code, message } }` 형태로 통일한다.
- private snapshot은 public endpoint에서 not found와 같은 응답으로 처리한다.
- HTTP tests는 fake request와 in-memory store로 endpoint status/body를 검증한다.

### 검증

```bash
npm test
git diff --check
```

추가 확인:

- GitHub callback owner upsert response
- CLI login start/approve/exchange response
- bearer token submit response
- public/private handle 조회 response
- malformed JSON, missing auth, unsupported route response

### 커밋

```text
Task #4 Stage 4: HTTP API와 public snapshot 조회 구현
```

## Stage 5 — Web integration 경계와 최종 검증

### 산출물

신규:

- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `mydocs/working/task_m100_4_stage5.md`

수정:

- `src/App.jsx`
- `src/profile-ui/profileRoutes.js`
- 필요 시 `tests/profile-ui.spec.js`

### 변경 내용

- frontend가 latest snapshot API를 조회할 때 사용할 client/adapter 경계를 만든다.
- #3 preview UX를 깨지 않도록 sample fixture fallback 또는 explicit preview mode 정책을 구현계획서 기준으로 고정한다.
- `README` PNG renderer는 구현하지 않고, 후속 renderer가 사용할 public JSON endpoint와 view-model 연결 지점만 기록한다.
- 최종 검증에서 secret grep, build, unit/e2e 필요성을 확인한다.

### 검증

```bash
npm test
npm run build
rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src tests mydocs
git diff --check
```

필요 시:

```bash
npm run test:e2e
```

### 커밋

```text
Task #4 Stage 5: web integration 경계와 최종 검증 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.
- `rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src tests mydocs`는 실제 credential 저장이 없음을 확인하기 위한 보안 점검으로 실행한다. 문서의 금지어 설명 때문에 match가 발생하면 위치와 맥락을 단계 보고서에 명시한다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_4_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #4 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 최종 보고 단계는 `task-final-report` 절차를 사용한다.

## 단계 의존성

- Stage 2는 Stage 1의 error/security/store contract 확정 후 진행한다.
- Stage 3은 Stage 2의 owner/token lifecycle 검증 후 진행한다.
- Stage 4는 Stage 3의 service contract 확정 후 HTTP adapter를 붙인다.
- Stage 5는 Stage 4의 public JSON endpoint가 확정된 뒤 frontend 조회 경계를 연결한다.

## 위험과 대응

- **OAuth network 의존성**: Stage 2/4는 fake GitHub client와 identity payload 기반으로 검증하고, 실제 provider secret/config는 후속 배포 task에서 다룬다.
- **CLI 미구현 상태**: 실제 npm package 없이도 HTTP/domain contract로 CLI caller가 필요한 token exchange와 submit 동작을 검증한다.
- **token 저장 위험**: raw API token은 발급 response 이후 저장하지 않고 digest만 저장하는 테스트를 필수로 둔다.
- **secret grep false positive**: 문서와 테스트명에는 금지어가 등장할 수 있다. 실제 source storage/fixture에 credential 값이 남지 않는지 맥락을 보고서에 적는다.
- **UI 회귀 위험**: Stage 5는 #3 UI를 재구현하지 않고 조회 client seam만 추가한다. rendered UI 변화가 생기면 `npm run test:e2e`를 실행한다.

## 승인 요청 사항

- 위 Stage 분할, 산출 파일, 검증 명령, 커밋 메시지를 승인해 달라.
- Stage 1 구현을 `src/profile-backend/`의 error/security/store contract부터 시작하는 것을 승인해 달라.
- 실제 npm CLI, README PNG renderer, GitHub README 자동 갱신 권한, 배포 DB/runtime adapter를 이번 task에서 제외하는 것을 재확인해 달라.
