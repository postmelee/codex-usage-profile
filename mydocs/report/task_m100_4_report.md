# Task M100 #4 최종 보고서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
마일스톤: M100

## 작업 요약

- 대상 이슈: #4
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: GitHub login/CLI submit 기반으로 Codex profile snapshot을 저장하고 public handle로 조회할 수 있는 backend/API/client 경계를 구축한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-backend/*` | error/security/store, GitHub identity, CLI login/token, snapshot submit, HTTP API handler 추가 | backend domain contract, token lifecycle, public/private 조회 경계 |
| `src/profile-backend/__tests__/*.test.js` | backend service와 HTTP route 단위 테스트 추가 | 인증/권한/보안/저장/조회 회귀 방지 |
| `src/profile-api/client.js` | frontend/consumer용 public snapshot 조회와 submit client 추가 | web integration, 후속 README/card renderer 연동 지점 |
| `src/profile-api/__tests__/client.test.js` | client envelope, error, bearer submit 테스트 추가 | API client contract 검증 |
| `src/App.jsx`, `src/profile-ui/profileRoutes.js` | sample preview 유지, unknown `/u/:handle` API-backed lookup 경계 추가 | 기존 profile UI 경로와 public lookup UX |
| `src/profile-ui/__tests__/profileRoutes.test.js` | sample/API-backed route 상태 테스트 추가 | route fallback 회귀 방지 |
| `README.md` | 개발 명령과 Security/Privacy note 추가 | 사용자/기여자 보안 경계 안내 |
| `mydocs/plans/task_m100_4.md`, `mydocs/plans/task_m100_4_impl.md` | pairing 폐기, CLI submit 방식, Stage 분할, README 보안 고지 범위 반영 | 작업 계획 기록 |
| `mydocs/working/task_m100_4_stage1.md` ~ `task_m100_4_stage5.md` | 단계별 산출물과 검증 결과 기록 | 리뷰/감사 추적 |
| `mydocs/orders/20260608.md`, `mydocs/orders/20260610.md` | 오늘할일 진행/완료 상태 갱신 | Hyper-Waterfall 작업 보드 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_4.md` | `mydocs/plans/` | `mydocs/plans/task_m100_4.md` | OK | 수행계획서 위치 판단과 일치 |
| `mydocs/plans/task_m100_4_impl.md` | `mydocs/plans/` | `mydocs/plans/task_m100_4_impl.md` | OK | 구현계획서 위치 판단과 일치 |
| `mydocs/working/task_m100_4_stage{N}.md` | `mydocs/working/` | `mydocs/working/` | OK | 단계 보고서 위치 판단과 일치 |
| `mydocs/report/task_m100_4_report.md` | `mydocs/report/` | `mydocs/report/task_m100_4_report.md` | OK | 수행계획서 최종 보고서 위치 판단과 일치 |
| `README.md` | repository root | `README.md` | OK | Stage 5 전 작업지시자 승인 후 수행계획서/구현계획서에 최소 보안 고지 위치를 반영 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| backend profile API 코드 | 없음 | `src/profile-backend/` 10개 module |
| profile API client | 없음 | `src/profile-api/client.js` |
| unit 테스트 | 기존 profile snapshot/UI 테스트 | 79개 pass |
| e2e 테스트 | #3 UI 회귀 테스트 | 6개 pass |
| 변경량 | 기준 `devel` | 32 files changed, 4222 insertions, 4 deletions |
| 보안 문서 | 없음 | `README.md` Security And Privacy section |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| GitHub identity로 owner/account 생성 또는 조회 | OK — `accounts.test.js`, `http.test.js`에서 callback/upsert 검증 |
| CLI login challenge 승인/교환으로 API token 발급 | OK — `cli-login.test.js`, `http.test.js`에서 start/approve/exchange 검증 |
| API token으로 snapshot submit 시 latest snapshot 갱신 | OK — `snapshots.test.js`, `http.test.js`에서 submit/update/audit metadata 검증 |
| public handle 조회 API가 최신 public snapshot 반환 | OK — `snapshots.test.js`, `http.test.js`, `client.test.js`에서 public lookup 검증 |
| private profile은 public endpoint에서 노출하지 않음 | OK — `snapshots.test.js`, `http.test.js`에서 private 조회 not found 검증 |
| OpenAI/ChatGPT credential 필드 저장 방지 | OK — `security.test.js`, `snapshots.test.js`, secret grep에서 검증 |
| GitHub/OAuth token 원문 장기 저장 방지 | OK — identity normalize와 HTTP serializer가 token/digest 노출을 제한하는 테스트로 검증 |
| frontend sample preview 유지와 API-backed route 경계 | OK — `profileRoutes.test.js`, Playwright UI e2e 6개 pass |
| PR 준비 전 diff 품질 | OK — `git diff --check` 통과 |

### 단계별 검증 결과

- Stage 1: [task_m100_4_stage1.md](../working/task_m100_4_stage1.md) — backend error/security/store contract, `npm test`, `git diff --check` 통과.
- Stage 2: [task_m100_4_stage2.md](../working/task_m100_4_stage2.md) — GitHub identity와 CLI token lifecycle, `npm test`, `git diff --check` 통과.
- Stage 3: [task_m100_4_stage3.md](../working/task_m100_4_stage3.md) — snapshot submit/latest 저장, `npm test`, `git diff --check` 통과.
- Stage 4: [task_m100_4_stage4.md](../working/task_m100_4_stage4.md) — HTTP API/public 조회, `npm test`, `git diff --check` 통과.
- Stage 5: [task_m100_4_stage5.md](../working/task_m100_4_stage5.md) — web integration/README 보안 고지, `npm test`, `npm run build`, secret grep, `npm run test:e2e`, `git diff --check` 통과.

### 최종 통합 검증

- OK: `npm test` — 79 tests pass.
- OK: `npm run build` — Vite production build 완료.
- OK: secret-like token pattern grep — `src`, `README.md`, `mydocs`의 비테스트/비계획/비보고서 범위에서 match 없음.
- OK: `npm run test:e2e` — Playwright 6 tests pass.
- OK: `git diff --check` — whitespace error 없음.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 production OAuth session, CSRF/state 검증, TLS, rate limit, durable DB, secret management는 아직 배포 adapter 밖이다.
- npm CLI 패키지, README PNG renderer, GitHub README 자동 갱신 권한은 이번 task 범위에서 제외했다.
- README는 최소 보안 고지만 제공한다. 전체 API reference와 운영 보안 체크리스트는 별도 문서가 필요하다.
- 작업 전부터 존재한 untracked `codex-extracted/`는 이번 task 산출물로 포함하지 않았다.

### 후속 작업 후보

- npm CLI `login`/`submit` 패키지 구현과 배포.
- README/card PNG renderer endpoint 구현.
- GitHub README 자동 갱신 권한과 workflow 설계.
- 배포 runtime, DB persistence, OAuth session/CSRF/rate-limit 보안 hardening.
- plugin/skill icon metadata enrichment (#8).

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 `publish/task4` 원격 브랜치 push와 `devel` 대상 PR 게시 절차로 진행한다.

