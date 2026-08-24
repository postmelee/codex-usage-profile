# Task M100 #59 Stage 1 완료보고서

GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
구현계획서: [`task_m100_59_impl.md`](../plans/task_m100_59_impl.md)
Stage: 1

## 단계 목적

CLI device login 시작 요청에 optional `login | submit` intent를 추가하고,
server challenge와 durable store에 표시 전용 metadata로 보존한다.
intent를 보내지 않는 기존 CLI는 `null`로 호환하고 unknown 값은 request
또는 server validation 경계에서 거부한다.

D1과 Postgres에는 기존 row를 보존하는 nullable forward migration을
추가한다. poll, credential, usage document, 인증·권한과 token 발급 흐름은
변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/cli.js` | `login`과 무인증 `submit` caller에 각각 정확한 intent 지정 |
| `packages/codex-usage-profile-cli/src/device-login.js` | intent를 device start 요청에만 전달 |
| `packages/codex-usage-profile-cli/src/service-client.js` | optional intent 직렬화와 client-side enum 검증 |
| `packages/codex-usage-profile-cli/test/cli.test.js` | login/submit caller intent와 기존 credential 분기 검증 |
| `packages/codex-usage-profile-cli/test/device-login.test.js` | start 요청 intent 전달 검증 |
| `packages/codex-usage-profile-cli/test/service-client.test.js` | login serialization, no-intent 생략과 invalid 값 거부 검증 |
| `src/profile-backend/cli-login.js` | frozen intent enum, normalizer와 challenge record 필드 추가 |
| `src/profile-backend/index.js` | intent enum과 normalizer public export |
| `src/profile-backend/http.js` | device/legacy start 입력 전달과 sanitized challenge/start serialization |
| `db/migrations/0003_cli_login_intent.sql` | D1 nullable intent column과 enum CHECK 추가 |
| `src/profile-backend/d1/migrate.js` | D1 migration 3 registry 등록 |
| `src/profile-backend/d1/store.js` | intent column mapping과 migration readiness 1·2·3 검사 |
| `src/profile-backend/postgres/migrations/0002_cli_login_intent.up.sql` | Postgres nullable intent column/CHECK forward migration |
| `src/profile-backend/postgres/migrations/0002_cli_login_intent.down.sql` | Postgres intent constraint/column rollback |
| `src/profile-backend/postgres/store.js` | Postgres intent column mapping |
| `src/profile-backend/__tests__/cli-login.test.js` | login/submit/null normalization과 invalid intent 검증 |
| `src/profile-backend/__tests__/http.test.js` | device/legacy start serialization과 compatibility 검증 |
| `src/profile-backend/__tests__/store.test.js` | memory store intent clone/round-trip 검증 |
| `src/profile-backend/__tests__/d1-migrate.test.js` | migration 1→2→3, 재실행 no-op과 readiness 검증 |
| `src/profile-backend/__tests__/d1-store.test.js` | D1 intent round-trip과 database CHECK 검증 |
| `src/profile-backend/__tests__/postgres-migrate.test.js` | packaged migration 2, up/down, CHECK 검증 갱신 |
| `src/profile-backend/__tests__/postgres-store.test.js` | migration readiness와 intent round-trip 검증 갱신 |
| `scripts/smoke-sites-fullstack-local.mjs` | local Sites migration expected version을 1·2·3으로 갱신 |
| `mydocs/orders/20260731.md` | Stage 1 완료보고 승인 대기로 상태 갱신 |
| `mydocs/working/task_m100_59_stage1.md` | Stage 1 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 기존 CLI
command syntax, device poll, credential 저장, Account Usage Contract와
token exchange 동작은 보존했다.

기존 challenge record에는 nullable field 하나만 추가했다. no-intent
request는 wire body에서 intent를 생략하고 server/D1/Postgres에서는
`null`로 round-trip한다. `.openai/hosting.json`, R2/publication, card와
production 배포 설정은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test \
  packages/codex-usage-profile-cli/test/cli.test.js \
  packages/codex-usage-profile-cli/test/device-login.test.js \
  packages/codex-usage-profile-cli/test/service-client.test.js

$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test \
  src/profile-backend/__tests__/cli-login.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-backend/__tests__/d1-migrate.test.js \
  src/profile-backend/__tests__/d1-store.test.js \
  src/profile-backend/__tests__/postgres-migrate.test.js \
  src/profile-backend/__tests__/postgres-store.test.js

$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test src/profile-backend/__tests__/store.test.js

git diff --check
```

결과:

- OK — CLI focused suite: 24 tests, 24 pass, 0 fail.
- OK — backend/D1/Postgres focused suite: 59 tests, 57 pass, 0 fail,
  2 skip.
- OK — D1 real-workerd에서 migrations `[1, 2, 3]` 최초 적용, 재실행
  `newlyApplied: []`, readiness `[1, 2, 3]` 확인.
- OK — D1 intent round-trip과 invalid value CHECK failure 확인.
- OK — Postgres migration file pairing과 version/name/up/down SQL 검증.
- SKIP — `TEST_DATABASE_URL`이 없어 Postgres migration up/down/up과 adapter
  integration 2건은 기존 test policy에 따라 명시적으로 skip.
- OK — memory store regression: 19 tests, 19 pass, 0 fail.
- OK — `git diff --check` 경고 없음.
- 초기 작업 shell에는 `node`가 없어서 bundled Node v24.14.0을 사용했다.
  worktree dependency는 lockfile을 만들지 않는 검증 전용 설치로 준비했으며
  repository 추적 파일에는 포함되지 않았다.

## 잔여 위험

- `TEST_DATABASE_URL`이 없어 Postgres migration과 adapter를 실제 database에
  적용한 integration 증적은 남지 않았다. paired SQL loader test,
  CHECK expectation과 store mapping test code는 통과/수집됐지만 실제 실행은
  환경이 준비된 검증 단계에서 다시 수행해야 한다.
- D1 migration은 source와 local real-workerd에서만 적용했다. 이 task의
  제외 범위에 따라 production database migration과 Sites deploy는
  수행하지 않았다.

## 다음 단계 영향

- Stage 2는 challenge의 normalized `intent`를 그대로 보존하면서
  same-owner approved/exchanged 재시도와 pending approval race를 복구한다.
- Stage 2의 device authorize 전용 serializer는 이번 Stage에서 추가한
  intent를 allowlist하되 owner id, token id와 digest는 제외해야 한다.
- 승인 복구 경로는 이번 Stage가 보존한 기존 poll/exchange 계약을 호출하지
  않아야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 — 동일 owner 승인 복구와
  보안 경계 구현으로 진행한다.
