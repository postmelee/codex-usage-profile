# Task M100 #4 수행계획서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
마일스톤: M100

## 목적

로컬 CLI가 `npx ... submit` 같은 한 줄 명령으로 Codex profile snapshot을 웹 서비스에 업데이트할 수 있는 backend 기반을 만든다. 기존 one-time pairing code 방식은 폐기하고, Tokscale과 유사하게 `CLI login -> GitHub auth -> CLI API token 저장 -> submit` 흐름을 기본 방향으로 삼는다.

이번 task의 핵심은 "사용자는 GitHub 계정으로 소유자를 증명하고, CLI는 우리 서비스의 upload token/API token으로 snapshot만 업로드한다"는 경계를 코드와 테스트로 고정하는 것이다. OpenAI/ChatGPT credential은 서버에 업로드하거나 저장하지 않는다. Profile page와 README card renderer는 이후 task에서 같은 latest snapshot API를 조회할 수 있어야 한다.

## 배경

이번 세션에서 웹사이트가 OpenAI 계정으로 직접 Codex 데이터를 가져오는 방식은 채택하지 않기로 했다. Codex 인증 문서는 Codex CLI가 ChatGPT 로그인/API key/enterprise access token을 사용할 수 있고, local credential cache에 access token이 포함될 수 있음을 설명한다. 따라서 이 서비스는 `auth.json`, `CODEX_ACCESS_TOKEN`, ChatGPT access token, API key 같은 credential을 업로드하거나 저장하지 않는 구조여야 한다.

추가 논의에서 사용자는 웹에서 pairing code를 발급해 CLI에 입력하는 방식보다 Tokscale처럼 로컬 터미널에서 `submit` 명령을 실행해 자기 계정 정보를 업데이트하는 UX를 선호했다. Tokscale은 public profile/README embed를 제공하면서도 GitHub login과 CLI submit token을 통해 데이터 소유자를 연결한다. 우리 프로젝트도 같은 계정/submit 구조를 따르는 것이 CLI 기반 사용 흐름에 더 자연스럽다.

다만 #4에서 완전한 npm 배포 CLI를 만들지는 않는다. #4는 GitHub login callback, owner/account 모델, CLI API token 발급/검증, latest snapshot upload/store/public lookup backend foundation을 만든다. 실제 CLI 패키지와 README PNG renderer는 후속 task로 분리한다.

선행 작업:

- #2: 저장 가능한 profile snapshot schema, normalizer, selector와 secret-like field 방어 기반
- #3: snapshot 기반 profile UI preview와 heatmap/e2e 검증

## 범위

### 포함

- GitHub OAuth callback 이후 owner/account를 생성하거나 찾는 backend boundary
- CLI login flow를 위한 pending auth/session 또는 one-time CLI login challenge 모델
- CLI용 API token 발급, 만료, 폐기, rotation 정책
- API token digest 저장과 원문 token 1회 반환 정책
- API token 인증 기반 snapshot submit endpoint
- latest snapshot 저장 모델과 repository interface
- public handle 기반 latest snapshot 조회 API
- profile visibility 기본값과 public/private 조회 경계
- upload audit metadata: `capturedAt`, `uploadedAt`, `schemaVersion`
- token/secret 유사 필드가 포함된 payload 저장 방지 검증
- API/domain unit tests와 HTTP-level tests

### 제외

- npm CLI 패키지 구현과 배포
- 전체 Profile UI 재구현
- README PNG renderer 구현
- OpenAI 계정 OAuth 로그인 구현
- GitHub README 자동 갱신 권한 연결
- 결제, 팀/조직 관리
- 장기 히스토리 분석
- plugin/skill icon metadata enrichment (#8)

## 설계 방향

- backend core는 runtime에 덜 묶이도록 `src/profile-backend/` 아래 domain/service/repository/API handler로 분리한다.
- 현재 저장소는 React + Vite + Node ESM 기반이므로, 우선 Node 20 내장 API와 기존 `node --test` 흐름을 활용하고 불필요한 backend framework 의존성은 도입하지 않는다.
- storage는 MVP 단계에서 repository interface를 먼저 고정하고, 테스트는 in-memory repository로 검증한다. 실제 배포 DB 선택은 별도 task로 미룬다.
- `ownerId`는 내부 stable identifier이고, public URL은 `handle`을 사용한다. 기본 handle은 GitHub username 기반으로 만들되 충돌 정책은 service 계층에서 명시한다.
- owner/account는 `authProvider: "github"`를 기본으로 하고, 테스트와 로컬 개발을 위해 `authProvider: "dev"` 또는 mock identity를 허용한다.
- GitHub OAuth access token은 장기 저장하지 않는다. #4 MVP에서는 GitHub identity 확인에 필요한 최소 user profile 응답만 owner record에 반영하고, repo 권한이 필요한 README 자동 갱신은 후속 task에서 별도 token/scope 정책을 정한다.
- CLI API token은 서버 저장 시 원문 토큰을 보관하지 않고 digest를 저장한다. API 응답으로 원문 token을 돌려주는 시점은 발급 직후 1회로 제한한다.
- CLI login challenge는 single-use이며, 승인/교환 후 재사용을 실패시킨다. 만료된 challenge와 token도 실패해야 한다.
- public 조회는 `visibility === "public"` profile만 반환한다. private profile은 존재 여부를 과도하게 노출하지 않도록 404 또는 동일한 not-found 응답 형태를 사용한다.
- snapshot submit body는 기존 `validateProfileSnapshot` 계약을 재사용한다. wrapper와 snapshot 전체에 대해 token-like key/value 검사를 수행해 credential 저장을 막는다.
- frontend profile page는 이번 task에서 API 조회를 최소 연결하되, backend 부재 또는 not-found 시 sample snapshot fallback을 유지할지 구현계획서에서 세부 확정한다.
- README card endpoint는 이번 task에서 PNG renderer를 만들지 않고, 후속 renderer가 latest snapshot을 읽을 수 있는 JSON selector/API 경계만 마련한다.

## 문서 위치 판단

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
|---|---|---|---|---|---|
| `mydocs/plans/task_m100_4.md` | 작업 수행계획서 | 내부 작업자/에이전트 | `mydocs/plans/` | `docs/` | Hyper-Waterfall task 계획 기록이며 사용자용 공식 문서가 아니다. |
| `mydocs/plans/task_m100_4_impl.md` | 구현계획서 | 내부 작업자/에이전트 | `mydocs/plans/` | `docs/` | Stage별 산출물과 검증 명령을 고정하는 작업 산출물이다. |
| `mydocs/working/task_m100_4_stage{N}.md` | 단계 보고서 | 내부 작업자/에이전트 | `mydocs/working/` | `docs/` | 단계별 구현/검증 로그는 작업 기록이다. |
| `mydocs/report/task_m100_4_report.md` | 최종 보고서 | 내부 작업자/에이전트/리뷰어 | `mydocs/report/` | `docs/` | PR 전 최종 결과와 검증 결과 보관용이다. |
| `src/profile-backend/*` | 제품 코드 | 개발자/에이전트 | repository source tree | `mydocs/` | 실행되는 backend 계약과 검증은 제품 코드로 유지해야 한다. |

공식 사용자/기여자/API 문서는 이번 task에서 만들지 않는다. CLI 사용법, GitHub login setup, API 소비자 문서가 필요해지면 #4 구현 후 별도 docs task에서 위치를 확정한다.

## 예상 변경 파일

신규:

- `src/profile-backend/index.js`
- `src/profile-backend/http.js`
- `src/profile-backend/errors.js`
- `src/profile-backend/auth.js`
- `src/profile-backend/accounts.js`
- `src/profile-backend/cli-login.js`
- `src/profile-backend/tokens.js`
- `src/profile-backend/store.js`
- `src/profile-backend/security.js`
- `src/profile-backend/__tests__/*.test.js`
- 필요 시 `src/profile-api/client.js`

수정:

- `package.json`
- `src/App.jsx`
- `src/profile-ui/profileRoutes.js`
- `src/profile-snapshot/index.js`
- 필요 시 `vite.config.js`, `playwright.config.js`, `tests/profile-ui.spec.js`

이번 task 산출물:

- `mydocs/orders/20260608.md`
- `mydocs/plans/task_m100_4.md`
- `mydocs/plans/task_m100_4_impl.md`
- `mydocs/working/task_m100_4_stage{N}.md`
- `mydocs/report/task_m100_4_report.md`

## 잠정 단계

- **Stage 1 — Account/auth domain contract와 보안 boundary**
  - owner/account, auth provider identity, CLI login challenge, submit/public 조회 use case, error shape, audit metadata, forbidden secret scan 정책을 코드 계약으로 정의한다.
  - snapshot validator 재사용 경계를 정하고 unit test를 추가한다.
- **Stage 2 — GitHub identity와 CLI token lifecycle**
  - GitHub OAuth callback 이후 owner/account 생성 또는 조회 service를 구현한다.
  - CLI login challenge 승인/교환, API token 발급/만료/폐기, digest 저장을 구현한다.
  - challenge reuse/expired/invalid token test를 추가한다.
- **Stage 3 — Snapshot submit과 latest snapshot repository**
  - API token 인증 후 latest snapshot을 저장하고 audit metadata를 붙이는 service를 구현한다.
  - token-like payload 거부/제거와 latest snapshot update test를 추가한다.
- **Stage 4 — HTTP API와 public handle 조회**
  - Node HTTP adapter 또는 API handler를 구현해 GitHub auth callback, CLI login token exchange, snapshot submit, public snapshot 조회 endpoint를 제공한다.
  - visibility별 public 조회와 HTTP status/error response test를 추가한다.
- **Stage 5 — Web integration 경계와 최종 검증**
  - profile page가 latest snapshot API를 조회할 수 있는 client 경계를 마련한다.
  - API 미연결/fixture fallback 정책과 README card 후속 연동 지점을 정리하고 최종 검증을 수행한다.

## 검증 계획

### 단계별 검증

- Stage 1
  - `npm test`
  - forbidden secret scan unit test
  - `git diff --check`
- Stage 2
  - `npm test`
  - GitHub identity -> owner upsert test
  - CLI login challenge 생성/승인/교환/재사용 실패 test
  - API token 만료/폐기/digest 저장 test
  - `git diff --check`
- Stage 3
  - `npm test`
  - snapshot submit 성공/실패 test
  - token-like field 포함 payload 저장 방지 test
  - `git diff --check`
- Stage 4
  - `npm test`
  - HTTP endpoint tests: GitHub auth callback, CLI token exchange, snapshot submit, public/private 조회
  - `git diff --check`
- Stage 5
  - `npm test`
  - `npm run build`
  - 필요 시 `npm run test:e2e`
  - `rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src tests mydocs`
  - `git diff --check`

### 통합 검증

- GitHub identity를 통해 owner/account가 생성되거나 조회된다.
- CLI 역할의 caller가 login challenge를 승인/교환해 API token을 얻을 수 있다.
- CLI 역할의 caller가 API token으로 snapshot을 submit하면 latest snapshot이 갱신된다.
- public handle 조회 API가 최신 public snapshot을 반환한다.
- private profile은 public endpoint에서 snapshot을 노출하지 않는다.
- OpenAI/ChatGPT credential 필드는 저장되지 않는다.
- GitHub OAuth token 원문은 장기 저장되지 않는다.
- `git status --short`가 PR 준비 전 빈 출력이다. 단, 작업 전부터 존재한 untracked `codex-extracted/`는 이번 task 산출물로 취급하지 않는다.
- `git diff --check`가 경고 없이 통과한다.

## 리스크

- **backend runtime 선택 범위 증가**: 아직 배포 플랫폼이 정해지지 않았다. Node HTTP/domain core 중심으로 구현해 framework/vendor lock-in을 피하고, 배포 adapter는 후속 task로 분리한다.
- **GitHub auth 범위 증가**: pairing code 방식보다 owner/account 경계가 명확하지만 OAuth callback과 token 발급 경계가 추가된다. #4에서는 repo 권한 없이 identity 확인과 CLI token 발급까지만 구현한다.
- **인증 경계 오해**: #4는 OpenAI OAuth가 아니라 GitHub identity와 우리 서비스 CLI API token을 구현한다. OpenAI/ChatGPT credential은 업로드 payload에서 금지한다.
- **storage 영속성 한계**: MVP에서 repository interface를 고정하고 실제 DB 선택은 후속 task로 미룬다. 테스트는 in-memory repository로 정확한 도메인 동작을 보장한다.
- **public/private 정보 노출**: private profile 조회는 not-found와 동일한 응답 형태를 사용해 존재 여부 노출을 줄인다.
- **후속 UI/CLI 의존성**: 실제 npm CLI submit과 README PNG renderer는 별도 task이므로, 이번 task는 API contract와 backend foundation 검증으로 한정한다.

## 승인 요청 사항

- #4 범위를 GitHub identity 기반 owner/account, CLI login challenge, API token, latest snapshot submit/조회, visibility boundary, secret 저장 방지 검증으로 재정의하는 것을 승인해 달라.
- pairing code 발급/검증 방식을 폐기하고, Tokscale-style `login -> submit` 흐름을 기본 UX로 삼는 것을 승인해 달라.
- OpenAI 계정 OAuth 로그인, npm CLI 구현, README PNG renderer, GitHub README 자동 갱신 권한, plugin icon enrichment를 이번 task에서 제외하는 것을 승인해 달라.
- backend는 `src/profile-backend/`의 dependency-light Node ESM domain/API handler 구조로 시작하고, 실제 배포 DB/runtime adapter는 후속 task로 분리하는 방향을 승인해 달라.
- 공식 사용자/API 문서는 이번 task에서 만들지 않고, 작업 기록은 `mydocs/`에 남기는 문서 위치 판단을 승인해 달라.

승인되면 `task_m100_4_impl.md`에서 단계별 산출물, 검증 명령, 커밋 메시지를 구체화한다.
