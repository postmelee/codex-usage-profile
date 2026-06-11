# Task M100 #13 구현계획서

수행계획서: [`task_m100_13.md`](task_m100_13.md)
GitHub Issue: [#13](https://github.com/postmelee/codex-usage-profile/issues/13)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Host adapter contract와 fake runtime test | host adapter module, fake runtime tests | handler routing, cookie forwarding, static fallback tests |
| 2 | GitHub OAuth client와 env 설정 | GitHub client module, env config, `.env.example`, README | OAuth exchange/user lookup tests, secret scan |
| 3 | Local dev server 통합과 browser smoke path | dev script/server entry, Vite/static integration, smoke docs | full test/build, local server smoke, browser 확인 |
| 4 | 통합 검증과 후속 handoff | stage report, final validation notes | full test/build, credential scan, #14/#5/#15/#6 handoff |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `README.md` | `README.md` | `README.md` | OK | Stage 2-3에서 local runtime 실행, OAuth App 설정, smoke test 절차를 보강한다. |
| `.env.example` | 저장소 루트 | `.env.example` 또는 README 내 env 표 | 보류 | 기존 구조를 확인한 뒤 Stage 2에서 실제 파일 여부를 확정한다. |
| `mydocs/plans/task_m100_13_impl.md` | `mydocs/plans/` | `mydocs/plans/task_m100_13_impl.md` | OK | 구현계획서 |
| `mydocs/working/task_m100_13_stage{N}.md` | `mydocs/working/` | `mydocs/working/task_m100_13_stage{N}.md` | OK | 단계 보고서 |
| `mydocs/report/task_m100_13_report.md` | `mydocs/report/` | `mydocs/report/task_m100_13_report.md` | OK | 최종 보고서 |

## 구현 방식 결정

- host adapter는 Node `http` server에 직접 결합하지 않고, 테스트 가능한 request dispatcher/adapter 함수를 먼저 만든다.
- production framework 선택은 하지 않는다. local dev에서 Vite fallback/static serving과 `/api/*` backend routing을 연결하는 최소 server를 구현한다.
- GitHub OAuth client는 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`을 env에서 읽고 GitHub token/user API를 호출하는 작은 module로 분리한다.
- test는 fake fetch/fake GitHub client로 실행해 네트워크와 실제 secret 없이 통과해야 한다.
- 실제 GitHub OAuth smoke test는 `.env`와 GitHub OAuth App callback URL이 필요하므로, 자동 검증 실패 조건으로 삼지 않고 수동 검증 절차와 결과/한계를 보고서에 기록한다.
- local durable store path는 env로 받되, 기본값은 git에 포함되지 않는 local data path로 둔다.
- 기존 `npm run dev`의 Vite-only preview와 새 full local runtime script의 역할을 구분한다. 기존 preview 회귀를 피하려면 `dev`를 유지하고 새 script를 추가하는 방향을 우선 검토한다.

## Stage 1 — Host adapter contract와 fake runtime test

### 산출물

신규:

- `src/profile-runtime/host-adapter.js`
- `src/profile-runtime/__tests__/host-adapter.test.js`
- `mydocs/working/task_m100_13_stage1.md`

수정:

- 필요 시 `src/profile-backend/index.js`

### 변경 내용

- host adapter가 다음 역할을 하도록 contract를 만든다.
  - `/api/*` request를 `createProfileBackendHttpHandler()`로 전달
  - API가 아닌 request는 frontend/static fallback handler로 전달
  - `Set-Cookie`, `Location`, status code, body를 그대로 보존
- Node `Request`/`Response` 기반으로 테스트 가능한 adapter를 우선 구현한다.
- fake backend handler와 fake static handler로 routing, redirect, cookie forwarding, 404 fallback을 검증한다.
- 실제 network listen/server bootstrap은 Stage 3에서 다룬다.

### 검증

```bash
npm test -- src/profile-runtime/__tests__/host-adapter.test.js
git diff --check
```

### 커밋

```text
Task #13 Stage 1: host adapter contract 구현
```

## Stage 2 — GitHub OAuth client와 env 설정

### 산출물

신규:

- `src/profile-runtime/github-oauth-client.js`
- `src/profile-runtime/config.js`
- `src/profile-runtime/__tests__/github-oauth-client.test.js`
- `src/profile-runtime/__tests__/config.test.js`
- 필요 시 `.env.example`
- `mydocs/working/task_m100_13_stage2.md`

수정:

- `README.md`
- 필요 시 `.gitignore`

### 변경 내용

- GitHub OAuth client를 구현한다.
  - authorization code를 GitHub token endpoint로 교환
  - access token으로 authenticated user endpoint 조회
  - token 원문은 호출 범위 안에서만 사용하고 저장하지 않는다.
- env config loader를 구현한다.
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `PUBLIC_BASE_URL`
  - `PROFILE_STORE_FILE`
  - `SESSION_SECURE_COOKIES`
- `.env`가 git에 포함되지 않도록 `.gitignore` 정책을 확인/보강한다.
- README 또는 `.env.example`에 placeholder만 기록하고 실제 secret은 쓰지 않는다.

### 검증

```bash
npm test -- src/profile-runtime/__tests__/github-oauth-client.test.js src/profile-runtime/__tests__/config.test.js
rg -n "(gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|GITHUB_CLIENT_SECRET=.*[A-Za-z0-9]{8,})" README.md .env.example src/profile-runtime
git diff --check
```

### 커밋

```text
Task #13 Stage 2: GitHub OAuth client와 env 설정 구현
```

## Stage 3 — Local dev server 통합과 browser smoke path

### 산출물

신규:

- `src/profile-runtime/dev-server.js` 또는 동등한 local runtime entry
- `src/profile-runtime/__tests__/dev-server.test.js`
- `mydocs/working/task_m100_13_stage3.md`

수정:

- `package.json`
- `README.md`
- 필요 시 `vite.config.js`

### 변경 내용

- local full runtime script를 추가한다.
  - 예: `npm run dev:runtime`
  - Vite frontend middleware 또는 built static fallback 중 프로젝트에 맞는 최소 구성을 선택
  - `/api/*`는 host adapter를 통해 backend handler로 전달
- default `npm run dev`가 계속 frontend preview 용도로 동작하는지 유지한다.
- browser smoke path를 확인한다.
  - secret 없는 환경: fake/validation route 수준에서 `/api/auth/github/login` redirect와 `/u/meleeisdeveloping` 유지 확인
  - secret 있는 환경: GitHub login/callback/session cookie/`/api/auth/me` 절차를 수동 검증
- 실제 GitHub OAuth App secret이 없으면 Stage 보고서에 manual smoke 미수행 사유와 필요한 절차를 기록한다.

### 검증

```bash
npm test
npm run build
git diff --check
```

가능 시:

```bash
npm run dev:runtime
```

브라우저 확인:

- `/u/meleeisdeveloping` profile preview 유지
- `/api/auth/github/login` GitHub authorization redirect 확인
- env 준비 시 callback/session `/api/auth/me` 확인

### 커밋

```text
Task #13 Stage 3: local dev runtime 통합
```

## Stage 4 — 통합 검증과 후속 handoff

### 산출물

신규:

- `mydocs/working/task_m100_13_stage4.md`

수정:

- 필요 시 `README.md`
- 필요 시 `mydocs/plans/task_m100_13_impl.md`

### 변경 내용

- 전체 test/build를 실행한다.
- source/README/env 예시 범위에서 실제 token-like 값이 남지 않았는지 점검한다.
- #14가 사용할 authenticated account 확인 경로를 정리한다.
  - dev runtime URL
  - `/api/auth/me`
  - logout
  - settings shell 진입 전제
- #5 CLI가 사용할 local runtime URL과 device-code login/submit handoff를 정리한다.
- #15 token/device 관리와 #6 card endpoint가 같은 host adapter에 route를 추가할 때의 주의점을 기록한다.

### 검증

```bash
npm test
npm run build
rg -n --glob '!src/**/__tests__/**' --glob '!mydocs/working/**' --glob '!mydocs/plans/**' "(^|[^A-Za-z0-9])(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|GITHUB_CLIENT_SECRET=[^<\\s]{8,}|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src README.md mydocs .env.example
git status --short
git diff --check
```

### 커밋

```text
Task #13 Stage 4: 통합 검증과 후속 handoff 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 실제 GitHub OAuth App secret이 없어 manual smoke test를 수행하지 못하면, 자동 테스트와 문서화로 가능한 범위를 완료하고 검증 한계에 명시한다.
- secret scan은 실제 credential 값이 source/docs/env 예시에 남지 않았는지 확인하기 위한 보안 점검으로 실행한다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_13_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #13 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 최종 보고 단계는 `task-final-report` 절차를 사용한다.

## 단계 의존성

- Stage 2는 Stage 1 host adapter contract가 확정된 뒤 진행한다.
- Stage 3은 Stage 1 adapter와 Stage 2 config/GitHub client가 확정된 뒤 local dev server에 연결한다.
- Stage 4는 Stage 3 local runtime smoke path가 정리된 뒤 수행한다.

## 위험과 대응

- **실제 GitHub OAuth App 부재**: fake client 자동 테스트와 수동 smoke 절차 문서화를 분리한다.
- **secret commit 위험**: `.env`는 ignore하고 `.env.example`에는 placeholder만 둔다. 각 단계에서 secret scan을 실행한다.
- **dev server 복잡도 증가**: 기존 Vite-only `npm run dev`는 유지하고 full runtime script를 별도로 추가하는 방향을 우선한다.
- **cookie/redirect origin 문제**: local full runtime은 same-origin을 우선하고 `PUBLIC_BASE_URL`을 callback URL source of truth로 둔다.
- **후속 route 충돌**: host adapter는 `/api/*` 위임과 frontend fallback만 책임지게 해 #14/#5/#15/#6 확장 여지를 남긴다.

## 승인 요청 사항

- 위 Stage 분할, 산출 파일, 검증 명령, 커밋 메시지를 승인해 달라.
- Stage 1을 `src/profile-runtime/host-adapter.js` 중심의 네트워크 없는 adapter contract부터 시작하는 것을 승인해 달라.
- 실제 GitHub OAuth App secret이 없는 경우 수동 smoke test는 절차와 한계로 보고하고, fake client 자동 테스트로 Stage 완료를 판단하는 것을 승인해 달라.
