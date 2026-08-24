# Task #122 Stage 2 완료 보고 — D1 원자 삭제와 Sites 오류 경계 보정

GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)
구현계획서: [`task_m100_122_impl.md`](../plans/task_m100_122_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 확정한 submitted-device fingerprint 정렬 불일치를 최소 범위로 보정한다.
SQLite `BINARY ORDER BY id`와 JavaScript의 canonical 순서를 일치시키되 exact guard와 단일
transaction 원자성을 유지하고, confirmed structured state drift만 안전한 terminal
classification으로 외부에 전달한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/d1/maintenance.js` | locale-dependent device ID 정렬을 safe key segment용 binary comparator로 교체하고, delete 전·후 확인된 state drift에만 terminal reason을 부여했다. |
| `src/profile-backend/__tests__/_d1-test-fixture.js` | test Worker가 안전한 reason·retryability를 보존하고 injected SQL을 실행할 수 있게 했다. |
| `src/profile-backend/__tests__/_d1-worker-harness.js` | local Miniflare 전용 injected failure route와 정규화된 오류 필드를 추가했다. |
| `src/profile-backend/__tests__/d1-maintenance.test.js` | mixed-case live-equivalent fixture를 atomic success 기대 회귀로 전환하고 owner-delete 강제 실패의 full rollback을 추가했다. |
| `src/profile-runtime/sites/maintenance.js` | top-level `maintenance_conflict`를 유지하면서 allowlist된 `structured_state_changed`, `retryable: false`만 선택적으로 응답한다. |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | allowlist된 terminal classification과 임의 reason·provider detail 차단을 검증했다. |
| `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md` | Stage 2 구현·원자성·정보 경계 검증 결과를 반영했다. |
| `mydocs/orders/20260824.md` | Task #122를 `Stage 2 완료·원자 삭제 보정, Stage 3 승인 대기`로 갱신했다. |
| `mydocs/working/task_m100_122_stage2.md` | Stage 2 산출물, 검증, 잔여 위험과 다음 단계 승인 경계를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

공개 profile/submit UX, schema, R2-first 순서, operation ID·최초 승인값과 기존
`maintenance_conflict` code/status는 유지했다. D1 guard의 device `id`, `updatedAt`,
`lastSubmittedAt` exact field와 하나의 `batch()` transaction도 유지했다. 신규 reason은
confirmed state drift에만 선택적으로 추가되며, 임의 내부 reason과 provider 원문은 기존
generic conflict 응답으로 축소된다. test-only SQL route는 Miniflare harness에만 존재한다.

Stage5·production mutation은 0건이며 Task #108 worktree는 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
npm run smoke:sites-fullstack:local
git diff --check
git status --short
```

결과:

- OK — D1 maintenance 9 tests와 Sites maintenance 23 tests, 합계 32 pass, 0 fail.
- OK — live-equivalent mixed-case fixture가 object count 71, combined approval count 77과
  active `structured` operation을 유지한 입력에서 한 번의 D1 transaction으로 owner,
  dependent rows, operation과 claim residue를 모두 제거했다.
- OK — owner delete trigger로 마지막 mutation을 강제 중단했을 때 71개 structured 객체,
  operation ID·phase·승인 count 77과 digest가 전부 원상태이고 claim/assertion residue가 0이다.
- OK — stale plan은 `maintenance_conflict`와 allowlist된
  `structured_state_changed`, `retryable: false`로 분류된다.
- OK — 임의 reason, SQL, provider 원문, owner scope, usage/token과 row detail은 Sites 응답에
  노출되지 않는다.
- OK — real-workerd full-stack smoke가 67 routes와 canonical update 2회를 검증했다.
- OK — `git diff --check`가 통과했고 Stage 2 범위 밖 제품·문서 변경은 없다.

## 잔여 위험

- CLI는 아직 optional `retryable: false` classification을 해석하지 않으므로, 구버전처럼
  generic conflict를 반복할 수 있다. Stage 3에서 terminal 즉시 중단과 legacy fallback을
  구현해야 한다.
- 전체 Node suite, Sites artifact build/verify, production scanner와 운영 문서 교차 검증은
  Stage 3 범위다.
- Stage5의 기존 active operation과 owner는 그대로 유지된다. exact-main release와 Stage 5
  preflight 승인 전에는 재개하지 않는다.
- production은 계속 read-only다.

## 다음 단계 영향

- Stage 3 CLI는 `retryable: false`가 있는 allowlisted conflict에서 read-only plan 확인 후
  즉시 중단하고, reason이 없는 legacy conflict는 기존 보수적 동작을 유지해야 한다.
- terminal failure, no-progress, network unknown, response loss, live lease와 completed
  `not_found`의 mutation 횟수를 회귀로 고정한다.
- full-stack smoke·전체 suite·artifact 검증과 `docs/sites-operations.md`,
  `docs/production-hosting.md`를 동일 taxonomy에 맞춘다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 CLI reconciliation·통합 회귀·운영 문서
  보정으로 진행한다.
