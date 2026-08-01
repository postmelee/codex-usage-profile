# Task M100 #63 Stage 2 완료 보고서

GitHub Issue: [#63](https://github.com/postmelee/codex-usage-profile/issues/63)
구현계획서: [`task_m100_63_impl.md`](../plans/task_m100_63_impl.md)
Stage: 2

## 단계 목적

Stage 1의 exact D1 readiness inspector를 기존 hidden Sites maintenance
경계에 read-only operation으로 연결하고, operator CLI와 공식 운영 문서가
owner-only candidate에서 readiness를 먼저 통과한 뒤에만 기능 smoke와
public 전환을 허용하도록 정렬했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/sites/maintenance.js` | authenticated `readiness` dispatch/service, bounded success summary와 `migration_not_ready` 503 추가 |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | disabled/token/origin 보호, read-only exact success, extra payload·mismatch·provider 실패 회귀 추가 |
| `scripts/sites-profile-maintenance.mjs` | `readiness --origin` 명령과 exact response allowlist 검증 추가 |
| `scripts/__tests__/sites-profile-maintenance.test.js` | 최소 payload/output, 추가 option 거부, unsafe response와 error code 회귀 추가 |
| `scripts/smoke-sites-fullstack-local.mjs` | maintenance 활성화 직후 사용자 흐름보다 먼저 readiness exact match 확인 |
| `src/profile-runtime/sites/__tests__/full-stack.test.js` | readiness route를 포함한 36개 route 기대값 정렬 |
| `docs/sites-operations.md` | owner-only deploy → protected readiness → 기능 smoke → public 전환 순서와 중단 조건 명시 |
| `mydocs/orders/20260801.md` | Stage 2 완료와 다음 승인 대기 상태 기록 |
| `mydocs/working/task_m100_63_stage2.md` | Stage 2 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

기존 plan/export/restore/retention/delete/repair maintenance operation과 CLI
payload, mutation confirmation, backup 경계는 변경하지 않았다. 새 readiness는
정확히 `{ operation: "readiness" }`만 허용하며 owner scope, `--apply`, backup,
digest/count와 retention option을 거부한다.

성공 응답은 `operation`, `ready`, `expectedVersions`, `appliedVersions` 네
필드만 가진다. CLI도 같은 exact allowlist를 다시 확인한 뒤 출력하므로
server 응답에 owner/usage/token/session/R2 metadata 같은 추가 필드가 섞이면
`invalid_response`로 중단한다. mismatch는 `migration_not_ready` 503,
provider 예외는 기존 generic `maintenance_unavailable` 503으로 감춘다.

public `/healthz`, 일반 API, migration SQL과 `.openai/hosting.json`은 변경하지
않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js
npm run smoke:sites-production:local
git diff --check
```

결과:

- OK — maintenance/CLI 집중 테스트 17건 통과, 실패·skip 0건
- OK — maintenance disabled, secret 부재/불일치, cross-origin과 insecure
  non-loopback 요청은 readiness에서도 동일한 generic 404
- OK — exact `[1, 2, 3]` 성공은 bounded summary만 반환하고 D1 batch 0건,
  D1/R2 maintenance와 owner store 호출 0건
- OK — missing/unexpected version은 `migration_not_ready` 503, provider 예외는
  원문 없이 `maintenance_unavailable` 503
- OK — CLI는 `{ operation: "readiness" }`만 전송하고 extra option/response,
  non-contiguous 또는 mismatch version을 fetch 전/출력 전 거부
- OK — production artifact + local Worker smoke 통과:
  `routesVerified=36`, migration 3개, expected binding 3개, public PNG 84,925
  bytes
- OK — `git diff --check` 경고 없음
- OK — `.openai/hosting.json`, `db/migrations`, production origin source diff
  빈 출력

local Worker/D1/R2 smoke는 로컬 실행 권한이 필요한 검증으로 동일 worktree의
샌드박스 밖에서 실행했다. 미실행 또는 skip으로 처리한 항목은 없다.

## 잔여 위험

- 실제 owner-only Sites candidate와 원격 D1에서 readiness를 실행하지 않았다.
  Task #63 승인 범위는 계약 구현과 local smoke까지이며 remote save/deploy,
  environment/access 변경은 제외된다.
- full-stack artifact verifier는 아직 migration count `3`을 독립 literal로
  가진다. Stage 3에서 application manifest filename set과 정렬해야 한다.
- production exact migration allowlist와 CLI/UI canonical origin drift 검증은
  Stage 3에 남아 있다.

## 다음 단계 영향

- Stage 3은 full-stack artifact의 packaged SQL을 manifest와 exact 비교한다.
- production artifact verifier의 filename allowlist는 manifest에서 파생하지
  않고 독립 security review gate로 유지한다.
- CLI/UI production origin 값은 변경하지 않고 root contract test로만
  동일성을 고정한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 artifact와 canonical origin
  drift 방지 구현으로 진행한다.
