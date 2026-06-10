# Task M100 #12 구현계획서

수행계획서: [`task_m100_12.md`](task_m100_12.md)
GitHub Issue: [#12](https://github.com/postmelee/codex-usage-profile/issues/12)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Session/OAuth runtime contract | `src/profile-backend/session.js`, `oauth-runtime.js`, tests | OAuth state, session cookie, callback/logout service tests |
| 2 | Durable store adapter | `src/profile-backend/durable-store.js`, store tests | restart simulation, clone/immutability, existing store contract |
| 3 | Authenticated account와 CLI challenge 승인 연결 | `src/profile-backend/http.js`, runtime HTTP tests | `/me`, logout, authenticated challenge approve, visibility boundary |
| 4 | Web/runtime integration과 설정 문서 | `src/profile-api/client.js`, `App.jsx`, `README.md` | account client, build, README env/security check |
| 5 | 통합 보안 검증과 MVP handoff | final stage report, full validation | full test/build, secret scan, #5/#6 handoff |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `README.md` | `README.md` | `README.md` | OK | Stage 4에서 OAuth/session/durable store 로컬 설정과 보안 주의점을 최소 범위로 보강한다. |
| `mydocs/plans/task_m100_12_impl.md` | `mydocs/plans/` | `mydocs/plans/task_m100_12_impl.md` | OK | 구현계획서 |
| `mydocs/working/task_m100_12_stage{N}.md` | `mydocs/working/` | `mydocs/working/task_m100_12_stage{N}.md` | OK | 단계 보고서 |
| `mydocs/report/task_m100_12_report.md` | `mydocs/report/` | `mydocs/report/task_m100_12_report.md` | OK | 최종 보고서 |

## 구현 방식 결정

- #4의 backend domain service와 HTTP envelope 형식을 유지한다.
- GitHub OAuth 실서비스 호출은 injectable client로 둔다. 테스트는 fake client로 `exchangeCodeForToken`, `getAuthenticatedUser` 흐름을 검증한다.
- OAuth state와 session은 server-owned id 중심으로 다룬다. OAuth access token은 GitHub user lookup 직후 폐기하고 장기 저장하지 않는다.
- session cookie는 `HttpOnly`, `SameSite=Lax`, path 제한, production secure option을 적용할 수 있는 옵션 구조로 만든다.
- CLI login challenge 승인은 runtime에서는 로그인 session의 owner id를 사용한다. body의 `ownerId`를 신뢰하는 테스트용 경로는 공개 승인 경로와 분리하거나 session 필요 경로로 보강한다.
- durable store는 production DB를 확정하지 않고 JSON/file 기반 최소 adapter 또는 동등한 restart 검증 가능한 adapter로 시작한다.
- frontend는 profile viewer를 재구성하지 않고 account/session 확인 경계만 얇게 연결한다.
- 정식 API 문서 루트는 만들지 않는다. README에는 로컬 개발자가 OAuth/session runtime을 실행할 수 있는 최소 설정만 둔다.

## Stage 1 — Session/OAuth runtime contract

### 산출물

신규:

- `src/profile-backend/session.js`
- `src/profile-backend/oauth-runtime.js`
- `src/profile-backend/__tests__/session.test.js`
- `src/profile-backend/__tests__/oauth-runtime.test.js`
- `mydocs/working/task_m100_12_stage1.md`

수정:

- `src/profile-backend/store.js`
- `src/profile-backend/index.js`

### 변경 내용

- OAuth login state record를 생성, 검증, 1회 소비하는 service를 만든다.
- session record를 생성, 검증, 폐기하는 service를 만든다.
- session cookie serialize/parse 정책을 구현한다.
- GitHub OAuth callback service를 만든다.
  - authorization code와 state를 검증한다.
  - fake/injected GitHub client로 identity를 조회한다.
  - owner/account를 upsert한다.
  - OAuth token 원문은 저장하지 않는다.
- state mismatch, expired state, replay, logout 이후 session invalidation을 테스트한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/session.test.js src/profile-backend/__tests__/oauth-runtime.test.js
git diff --check
```

### 커밋

```text
Task #12 Stage 1: session과 OAuth runtime contract 구현
```

## Stage 2 — Durable store adapter

### 산출물

신규:

- `src/profile-backend/durable-store.js`
- `src/profile-backend/__tests__/durable-store.test.js`
- `mydocs/working/task_m100_12_stage2.md`

수정:

- `src/profile-backend/store.js`
- `src/profile-backend/index.js`
- 필요 시 `src/profile-backend/__tests__/store.test.js`

### 변경 내용

- 기존 memory store interface에 Stage 1에서 필요한 OAuth state/session 저장 method를 추가한다.
- durable adapter가 owner, OAuth state, session, CLI login challenge, CLI token digest, latest snapshot을 저장/조회하도록 구현한다.
- 저장 파일 또는 adapter 내부 snapshot에는 raw CLI token, OAuth access token, refresh token이 남지 않도록 한다.
- restart simulation 테스트로 같은 저장소를 다시 열었을 때 owner/token/snapshot이 유지되는지 검증한다.
- clone/immutability와 handle conflict 등 기존 store contract가 유지되는지 확인한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/durable-store.test.js src/profile-backend/__tests__/store.test.js
git diff --check
```

### 커밋

```text
Task #12 Stage 2: durable store adapter 구현
```

## Stage 3 — Authenticated account와 CLI challenge 승인 연결

### 산출물

신규:

- `mydocs/working/task_m100_12_stage3.md`

수정:

- `src/profile-backend/http.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/index.js`
- 필요 시 `src/profile-backend/cli-login.js`

### 변경 내용

- runtime HTTP route를 확장한다.
  - `GET /api/auth/github/login`
  - `GET /api/auth/github/callback`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
  - authenticated `POST /api/cli/login/approve`
- GitHub login URL 생성 시 OAuth state에 optional CLI login challenge id를 묶는다.
- callback 성공 시 owner/account를 upsert하고 session cookie를 발급한다.
- CLI challenge approve는 로그인 session의 owner id를 사용한다.
- unauthenticated approve, expired challenge, reused challenge, private visibility lookup을 검증한다.
- 기존 #4의 JSON API contract가 필요한 범위에서 호환되는지 확인한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/cli-login.test.js
git diff --check
```

### 커밋

```text
Task #12 Stage 3: authenticated CLI challenge 승인 연결
```

## Stage 4 — Web/runtime integration과 설정 문서

### 산출물

신규:

- `mydocs/working/task_m100_12_stage4.md`

수정:

- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/App.jsx`
- `README.md`
- 필요 시 `src/profile-ui/ProfilePage.jsx`

### 변경 내용

- frontend/API consumer가 현재 login session을 확인할 수 있는 client method를 추가한다.
- profile page의 기존 snapshot 렌더링을 깨지 않는 범위에서 account/session 상태 연결 지점을 만든다.
- README에 다음을 최소 범위로 추가한다.
  - GitHub OAuth app 설정에 필요한 env 이름
  - session secret/public base URL 설정
  - durable store local path 또는 adapter 설정
  - raw OAuth token과 CLI token 원문 저장 금지 정책
- 정식 사용자/API 문서 루트는 만들지 않는다.

### 검증

```bash
npm test
npm run build
git diff --check
```

### 커밋

```text
Task #12 Stage 4: web runtime 경계와 설정 문서 정리
```

## Stage 5 — 통합 보안 검증과 MVP handoff

### 산출물

신규:

- `mydocs/working/task_m100_12_stage5.md`

수정:

- 필요 시 `README.md`
- 필요 시 `mydocs/plans/task_m100_12_impl.md`

### 변경 내용

- 전체 test/build를 실행해 Stage 1-4 변경이 통합되는지 확인한다.
- source/README 범위에서 실제 token-like 값이 남지 않았는지 점검한다.
- #5 CLI 구현자가 사용할 runtime contract를 정리한다.
  - CLI login start URL
  - browser approval/callback 흐름
  - challenge exchange
  - submit authorization 방식
- #6 카드 endpoint가 사용할 public/private visibility 경계를 정리한다.
- 남은 production hosting, DB, rate limit, npm publish 리스크는 최종 보고서로 넘긴다.

### 검증

```bash
npm test
npm run build
rg -n --glob '!src/**/__tests__/**' --glob '!mydocs/working/**' --glob '!mydocs/plans/**' "(^|[^A-Za-z0-9])(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src README.md mydocs
git status --short
git diff --check
```

필요 시:

```bash
npm run test:e2e
```

### 커밋

```text
Task #12 Stage 5: 통합 보안 검증과 MVP handoff 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.
- secret grep은 실제 credential 값이 source/docs에 남지 않았는지 확인하기 위한 보안 점검으로 실행한다. 테스트 fixture와 단계 보고서는 제외한다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_12_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #12 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 최종 보고 단계는 `task-final-report` 절차를 사용한다.

## 단계 의존성

- Stage 2는 Stage 1의 OAuth state/session store method 확정 후 진행한다.
- Stage 3은 Stage 1-2의 session 검증과 durable persistence가 확정된 뒤 HTTP runtime에 연결한다.
- Stage 4는 Stage 3의 authenticated account API가 확정된 뒤 frontend/client 경계를 연결한다.
- Stage 5는 Stage 4의 runtime 설정 문서와 API client 변경이 검증된 뒤 수행한다.

## 위험과 대응

- **session 보안 누락**: cookie option, state replay, logout invalidation을 Stage 1 test로 먼저 고정한다.
- **기존 API contract 회귀**: #4에서 만든 endpoint tests를 Stage 3에서 같이 실행하고, breaking change가 필요하면 구현계획서를 갱신한다.
- **durable adapter 과설계**: DB/provider를 확정하지 않고 restart 검증 가능한 최소 adapter로 제한한다.
- **브라우저 UI 범위 확대**: Stage 4는 로그인 UI 전체 디자인이 아니라 account/session 경계 연결과 설정 문서에 한정한다.
- **secret grep false positive**: 테스트와 계획/보고서의 정책 설명은 제외하고 source/README의 실제 secret-like 값 노출 여부를 검토한다.

## 승인 요청 사항

- 위 Stage 분할, 산출 파일, 검증 명령, 커밋 메시지를 승인해 달라.
- Stage 1 구현을 `session.js`, `oauth-runtime.js`, 관련 store method와 테스트부터 시작하는 것을 승인해 달라.
- CLI package 구현은 #5, README card endpoint는 #6, plugin/skill icon enrichment는 #8로 유지하는 것을 재확인해 달라.
