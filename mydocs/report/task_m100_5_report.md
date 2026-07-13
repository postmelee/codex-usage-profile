# Task M100 #5 최종 보고서

GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
마일스톤: M100

## 작업 요약

- 대상 이슈: #5 로컬 CLI npx submit 구현
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: GitHub owner에 연결된 product CLI가 공식 Account Usage Contract v1을 안전하게 제출하고 같은 Profile·README card URL을 최신 사용량으로 갱신하는 MVP 흐름을 완성한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-backend/account-usage-submit.js`, `http.js`, `errors.js`, `index.js` | Account Usage 전용 submit/status, owner binding, idempotency·conflict·rate limit·device 저장 구현 | downstream API와 durable latest usage |
| `src/profile-card/account-usage.js`, `index.js` | Account Usage Contract v1 exact validator와 card projection 구현 | card input 및 null semantics |
| `packages/codex-usage-profile-cli/**` | publish 가능한 `login/status/submit/logout` CLI, credential, device login, analyzer orchestration, safe output와 terminal hyperlink 구현 | Node.js 20+ product CLI package |
| `package-lock.json` | registry `codex-usage-analyzer@0.2.0` dependency 고정 | 설치·배포 dependency graph |
| `packages/codex-usage-analyzer/**` | 중복 workspace 사본 제거 | standalone npm package를 canonical upstream으로 전환 |
| `src/profile-snapshot/**` | legacy UsageSnapshot v2 validator·type·fixture를 profile 호환 계층으로 이전 | 기존 full-profile 호환 경로 |
| `README.md`, `docs/cli-submit.md`, `docs/codex-usage-analyzer.md`, `docs/readme-card.md`, `docs/usage-snapshot-v2.md` | MVP 흐름, CLI, analyzer ownership, card cache, legacy 계약 문서 정렬 | 사용자·통합·운영 문서 |
| `**/__tests__/**`, `packages/codex-usage-profile-cli/test/**` | contract, API, auth, credential, submit, ETag, safe output 회귀 테스트 추가 | 자동 검증 258개 |
| `mydocs/plans/task_m100_5*.md`, `mydocs/working/task_m100_5_stage*.md` | 계획과 Stage 1~5 검증 기록 | Hyper-Waterfall 작업 추적 |

총 변경은 `devel` 대비 61개 파일, 6,368줄 추가, 1,326줄 삭제다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | `README.md` | OK | MVP Quickstart와 보안 진입점 |
| `docs/cli-submit.md` | `docs/` | `docs/cli-submit.md` | OK | CLI login/submit/privacy 사용자 계약 |
| `docs/codex-usage-analyzer.md` | `docs/` | `docs/codex-usage-analyzer.md` | OK | standalone analyzer/downstream 경계 |
| `docs/readme-card.md` | `docs/` | `docs/readme-card.md` | OK | stable card URL과 cache 계약 |
| 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_5.md`, `task_m100_5_impl.md` | OK | 수행·구현 계획 위치 일치 |
| 단계·최종 보고서 | `mydocs/working/`, `mydocs/report/` | Stage 1~5 및 본 보고서 | OK | 장기 기록과 진행 문서 역할 분리 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---:|---:|
| 테스트 선언 수 | 209 | 258 |
| product CLI command | 0 | 4 (`login`, `status`, `submit`, `logout`) |
| Account Usage 전용 HTTP route | 0 | 2 (`submit`, `status`) |
| CLI package tarball allowlist | 없음 | 13개 파일 |
| CLI dependency | local analyzer workspace | registry `codex-usage-analyzer@0.2.0` |
| 실제 packed E2E | 미검증 | GitHub OAuth부터 stable card ETag 갱신까지 통과 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| publish 가능한 CLI entrypoint와 Node.js 20+ package | OK — 실제 tarball을 clean prefix에 설치하고 `--help`, `--version`, 4개 command 실행 |
| credential 부재 시 device login과 raw token 단일 수령 | OK — verification URL/code, poll interval·expiry·429, 단일 저장 검증 |
| 저장 credential 재사용과 안전한 logout | OK — 추가 OAuth 없는 status/submit, revoke 거부, local file 삭제 검증 |
| analyzer SDK `readAccountUsage()`와 Contract v1 제출 | OK — registry v0.2.0 실제 SDK smoke 및 contract 재검증 통과 |
| identity-free body와 Bearer owner binding | OK — unknown/identity/credential field 거부, body로 owner 선택 불가 테스트 통과 |
| latest usage·device 저장과 null semantics | OK — durable 저장, device upsert, null/empty bucket 보존 테스트 통과 |
| stale/future/replay/version 처리 | OK — exact retry idempotent, stale/conflict/future/unsupported 구분 |
| Profile/card/README 출력과 ETag 갱신 | OK — private 998x612, publish, 304 revalidation, changed submit 후 동일 URL ETag 변경 |
| credential·usage 비노출 | OK — argv/URL/stdout/stderr/payload/package scan과 digest-only backend 저장 검증 |
| terminal verification URL 접근성 | OK — iTerm2에서 URL-only cyan OSC 8 link를 사용자가 직접 확인, JSON/pipe plain fallback 테스트 통과 |
| 전체 회귀 | OK — 단위·통합 258개, Playwright E2E 11개, Vite build, pack allowlist, diff check 통과 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_5_stage1.md): Contract v1 validator, submit/status backend, owner binding, replay/rate limit, card ETag 연결
- [Stage 2](../working/task_m100_5_stage2.md): CLI package skeleton, device login, service URL과 `0700/0600` credential 경계
- [Stage 3](../working/task_m100_5_stage3.md): registry analyzer SDK, submit orchestration, device headers와 safe error/output
- [Stage 4](../working/task_m100_5_stage4.md): npm allowlist, package README, CLI/analyzer/card 문서와 dry-run preflight
- [Stage 5](../working/task_m100_5_stage5.md): packed 실제 OAuth·submit·publish·ETag·revoke/logout·secret QA와 terminal link 수동 검증

## 잔여 위험과 후속 작업

### 잔여 위험

- upstream analyzer는 일부 일반 terminal PATH에서 설치된 Codex 실행 파일을 발견하지 못할 수 있으며 upstream 탐색 보강 후 dependency smoke 재검증이 필요하다.
- npm registry publish, provenance/2FA와 production service default URL은 아직 완료하지 않았다.
- production은 shared rate limiter, durable database 동시성, backup/retention, account deletion과 secret management가 필요하다.
- GitHub image proxy는 origin ETag 변경 이후에도 README 표시를 지연할 수 있다.

### 후속 작업 후보

- 메인 `/`에 로그인 상태별 Quickstart와 copyable `npx ... submit` command를 제공한다.
- upstream Codex discovery 수정 release로 analyzer dependency를 갱신하고 plain user PATH에서 packed smoke를 반복한다.
- production origin 확정 후 package default, OAuth callback, 문서 예시와 npm release pipeline을 정렬한다.
- M100 마일스톤 설명의 legacy snapshot 표현을 현재 Account Usage Contract 흐름으로 갱신한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 기준으로 `devel` 대상 PR을 게시하고 리뷰·merge 승인을 요청한다.
