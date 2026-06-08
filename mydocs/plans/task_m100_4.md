# Task M100 #4 수행계획서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
마일스톤: M100

## 목적

로컬 CLI가 Codex profile snapshot을 웹 서비스로 안전하게 push할 수 있는 backend 기반을 만든다. 웹은 one-time pairing code를 발급하고, CLI는 pairing code를 upload token으로 교환한 뒤 snapshot만 업로드한다.

이번 task의 핵심은 OpenAI/ChatGPT credential을 서버가 보관하지 않는 데이터 sync 경계를 코드와 테스트로 고정하는 것이다. Profile page와 README card renderer는 이후 task에서 같은 latest snapshot API를 조회할 수 있어야 한다.

## 배경

이번 세션에서 웹사이트가 OpenAI 계정으로 직접 Codex 데이터를 가져오는 방식은 채택하지 않기로 했다. Codex 인증 문서는 Codex CLI가 ChatGPT 로그인/API key/enterprise access token을 사용할 수 있고, local credential cache에 access token이 포함될 수 있음을 설명한다. 따라서 이 서비스는 `auth.json`, `CODEX_ACCESS_TOKEN`, ChatGPT access token, API key 같은 credential을 업로드하거나 저장하지 않는 구조여야 한다.

OpenAI Apps SDK 인증 문서도 사용자별 데이터 또는 write action을 노출하는 경우 자체 authorization server/OAuth 2.1 같은 인증 경계를 둬야 한다고 설명한다. 다만 #4는 OpenAI 계정 OAuth 로그인 자체를 제외하고, 웹 session/profile과 CLI upload token만 다루는 MVP backend로 제한한다.

선행 작업:

- #2: 저장 가능한 profile snapshot schema, normalizer, selector와 secret-like field 방어 기반
- #3: snapshot 기반 profile UI preview와 heatmap/e2e 검증

## 범위

### 포함

- 웹 session/profile 단위의 one-time pairing code 생성 API
- pairing code 검증/소비 API
- CLI용 upload token 발급, 만료, 폐기 정책
- upload token 인증 기반 latest snapshot upload endpoint
- latest snapshot 저장 모델과 repository interface
- public handle 기반 latest snapshot 조회 API
- profile visibility 기본값과 public/private 조회 경계
- upload audit metadata: `capturedAt`, `uploadedAt`, `schemaVersion`
- token/secret 유사 필드가 포함된 payload 저장 방지 검증
- API/domain unit tests와 HTTP-level tests

### 제외

- 로컬 CLI 구현
- 전체 Profile UI 재구현
- README PNG renderer 구현
- OpenAI 계정 OAuth 로그인 구현
- 결제, 팀/조직 관리
- 장기 히스토리 분석
- plugin/skill icon metadata enrichment (#8)

## 설계 방향

- backend core는 runtime에 덜 묶이도록 `src/profile-backend/` 아래 domain/service/repository/API handler로 분리한다.
- 현재 저장소는 React + Vite + Node ESM 기반이므로, 우선 Node 20 내장 API와 기존 `node --test` 흐름을 활용하고 불필요한 backend framework 의존성은 도입하지 않는다.
- storage는 MVP 단계에서 repository interface를 먼저 고정하고, 테스트는 in-memory repository로 검증한다. 실제 배포 DB 선택은 별도 task로 미룬다.
- upload token은 서버 저장 시 원문 토큰을 보관하지 않고 digest를 저장한다. API 응답으로 원문 token을 돌려주는 시점은 발급 직후 1회로 제한한다.
- pairing code는 single-use이며, 소비 후 재사용을 실패시킨다. 만료된 code와 token도 실패해야 한다.
- public 조회는 `visibility === "public"` profile만 반환한다. private profile은 존재 여부를 과도하게 노출하지 않도록 404 또는 동일한 not-found 응답 형태를 사용한다.
- snapshot upload body는 기존 `validateProfileSnapshot` 계약을 재사용한다. wrapper와 snapshot 전체에 대해 token-like key/value 검사를 수행해 credential 저장을 막는다.
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

공식 사용자/기여자/API 문서는 이번 task에서 만들지 않는다. API 소비자 문서가 필요해지면 #4 구현 후 별도 docs task에서 위치를 확정한다.

## 예상 변경 파일

신규:

- `src/profile-backend/index.js`
- `src/profile-backend/http.js`
- `src/profile-backend/errors.js`
- `src/profile-backend/pairing.js`
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

- **Stage 1 — Backend domain contract와 보안 boundary**
  - pairing/upload/public 조회 use case, error shape, audit metadata, forbidden secret scan 정책을 코드 계약으로 정의한다.
  - snapshot validator 재사용 경계를 정하고 unit test를 추가한다.
- **Stage 2 — Pairing code와 upload token lifecycle**
  - one-time pairing code 생성/소비, upload token 발급/만료/폐기, digest 저장을 구현한다.
  - reuse/expired/invalid token test를 추가한다.
- **Stage 3 — Snapshot upload와 latest snapshot repository**
  - upload token 인증 후 latest snapshot을 저장하고 audit metadata를 붙이는 service를 구현한다.
  - token-like payload 거부/제거와 latest snapshot update test를 추가한다.
- **Stage 4 — HTTP API와 public handle 조회**
  - Node HTTP adapter 또는 API handler를 구현해 pairing, token exchange, upload, public snapshot 조회 endpoint를 제공한다.
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
  - pairing code 생성/소비/재사용 실패 test
  - upload token 만료/폐기/digest 저장 test
  - `git diff --check`
- Stage 3
  - `npm test`
  - snapshot upload 성공/실패 test
  - token-like field 포함 payload 저장 방지 test
  - `git diff --check`
- Stage 4
  - `npm test`
  - HTTP endpoint tests: pairing 생성, pairing 소비, snapshot upload, public/private 조회
  - `git diff --check`
- Stage 5
  - `npm test`
  - `npm run build`
  - 필요 시 `npm run test:e2e`
  - `rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src tests mydocs`
  - `git diff --check`

### 통합 검증

- 사용자가 웹에서 pairing code를 만들 수 있다.
- CLI 역할의 caller가 pairing code로 upload token을 얻을 수 있다.
- CLI 역할의 caller가 snapshot을 업로드하면 latest snapshot이 갱신된다.
- public handle 조회 API가 최신 public snapshot을 반환한다.
- private profile은 public endpoint에서 snapshot을 노출하지 않는다.
- OpenAI/ChatGPT credential 필드는 저장되지 않는다.
- `git status --short`가 PR 준비 전 빈 출력이다. 단, 작업 전부터 존재한 untracked `codex-extracted/`는 이번 task 산출물로 취급하지 않는다.
- `git diff --check`가 경고 없이 통과한다.

## 리스크

- **backend runtime 선택 범위 증가**: 아직 배포 플랫폼이 정해지지 않았다. Node HTTP/domain core 중심으로 구현해 framework/vendor lock-in을 피하고, 배포 adapter는 후속 task로 분리한다.
- **인증 경계 오해**: #4는 OpenAI OAuth가 아니라 웹 session/profile과 CLI upload token만 구현한다. OpenAI/ChatGPT credential은 업로드 payload에서 금지한다.
- **storage 영속성 한계**: MVP에서 repository interface를 고정하고 실제 DB 선택은 후속 task로 미룬다. 테스트는 in-memory repository로 정확한 도메인 동작을 보장한다.
- **public/private 정보 노출**: private profile 조회는 not-found와 동일한 응답 형태를 사용해 존재 여부 노출을 줄인다.
- **후속 UI/CLI 의존성**: 실제 CLI push와 README PNG renderer는 별도 task이므로, 이번 task는 API contract와 backend foundation 검증으로 한정한다.

## 승인 요청 사항

- #4 범위를 pairing API, upload token, latest snapshot 저장/조회, visibility boundary, secret 저장 방지 검증으로 한정하는 것을 승인해 달라.
- OpenAI 계정 OAuth 로그인, 로컬 CLI 구현, README PNG renderer, plugin icon enrichment를 이번 task에서 제외하는 것을 승인해 달라.
- backend는 `src/profile-backend/`의 dependency-light Node ESM domain/API handler 구조로 시작하고, 실제 배포 DB/runtime adapter는 후속 task로 분리하는 방향을 승인해 달라.
- 공식 사용자/API 문서는 이번 task에서 만들지 않고, 작업 기록은 `mydocs/`에 남기는 문서 위치 판단을 승인해 달라.

승인되면 `task_m100_4_impl.md`에서 단계별 산출물, 검증 명령, 커밋 메시지를 구체화한다.
