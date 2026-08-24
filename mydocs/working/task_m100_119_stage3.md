# Task #119 Stage 3 보고서 — CLI 직렬 재개와 불확정 결과 회복

GitHub Issue: [#119](https://github.com/postmelee/codex-usage-profile/issues/119)

구현계획서: [`task_m100_119_impl.md`](../plans/task_m100_119_impl.md)

Stage: 3

## 단계 목적

Stage 2에서 도입한 bounded 계정 삭제 요청을 operator CLI가 하나씩 직렬 실행하도록 연결했다. CLI는 active operation을 먼저 조회해 같은 operation ID와 최초 승인 digest/count를 유지하고, live lease 또는 network-unknown 이후에는 새 mutation 전에 read-only plan으로 상태를 재확인한다. 최종 apply 응답을 잃은 뒤 owner가 `not_found`이면 이미 승인된 삭제의 완료로 안전하게 reconcile한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/sites-profile-maintenance.mjs` | `--operation-id`, exact safe progress 정규화, bounded serial delete loop, Retry-After 대기, network-unknown plan reconciliation과 최종 완료 판정 추가 |
| `scripts/__tests__/sites-profile-maintenance.test.js` | 직렬 batch, active operation 채택, 승인 불일치, network-unknown, live lease, one-time initial retry, 반복 상한과 비밀 비노출 검증 |
| `src/profile-runtime/sites/maintenance.js` | safe progress의 bounded `retryAfterSeconds`를 HTTP `Retry-After` 헤더로 제공 |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | live lease 응답의 200 progress, `Retry-After: 60`, scope·lease·R2 내부 정보 비노출 검증 |

## 본문 변경 정도 / 본문 무손실 여부

제품·운영 문서는 변경하지 않았다. `delete-account`만 initial read-only plan과 bounded serial loop를 사용하며, 다른 maintenance 명령은 기존 단일 요청 계약을 유지한다. CLI 출력은 exact allowlist로 정규화한 safe progress JSON line과 마지막 completed summary로 제한했다. 기존 worker error body는 그대로 유지하고 live lease progress에만 표준 `Retry-After` 헤더를 additive하게 제공한다.

## 검증 결과

실행 명령:

```bash
node --test \
  scripts/__tests__/sites-profile-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  src/profile-media/__tests__/r2-binding-maintenance.test.js
git diff --check
```

결과:

- OK — 52 tests, 52 pass, 0 fail.
- OK — 모든 delete-account apply가 동일 operation ID와 최초 승인값으로 직렬 실행되며 동시 요청이 발생하지 않았다.
- OK — active operation 채택, explicit operation ID 불일치, phase·잔여 수 역행, 반복 상한을 fail closed로 검증했다.
- OK — network-unknown 뒤 plan을 먼저 조회하고, original plan이 그대로일 때 initial apply를 한 번만 재시도했다.
- OK — 최종 apply 응답 유실 뒤 plan `not_found`를 completed progress와 최종 summary로 reconcile했다.
- OK — live lease의 60초 Retry-After를 대기한 뒤 read-only plan을 거쳐 다음 apply를 수행했다.
- OK — progress의 extra lease/provider 필드를 거부하고 token, owner/handle, lease nonce, R2 key·ETag를 출력하지 않았다.
- OK — `git diff --check` 통과.

## 잔여 위험

- migration 6이 production artifact와 smoke fixture의 exact allowlist에 포함되는지는 Stage 4에서 검증해야 한다.
- operator runbook의 timeout 재개·conflict 처리와 production hosting 문서 정합화는 Stage 4 범위로 남아 있다.
- 전체 maintenance·Sites packaging·public release scan과 실제 Stage5 배포 검증은 아직 수행하지 않았다.

## 다음 단계 영향

- Stage 4는 migration 1..6 packaging, Sites fullstack artifact와 local smoke가 새 삭제 operation table을 포함하는지 검증해야 한다.
- `docs/sites-operations.md`에는 최초 plan 승인, optional operation ID, safe progress, Retry-After, network-unknown 재조회와 `not_found` 완료 판정을 operator 절차로 기록해야 한다.
- `docs/production-hosting.md`에는 migration 6 적용·readiness와 이전 revision rollback 호환 경계를 기록해야 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4의 packaging·운영 문서·통합 검증으로 진행한다.
