# Task #122 Stage 1 완료 보고 — live-equivalent 재현과 원인 고정

GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)
구현계획서: [`task_m100_122_impl.md`](../plans/task_m100_122_impl.md)
Stage: 1

## 단계 목적

Stage5의 기존 structured account deletion operation이 반복해서
`maintenance_conflict`로 rollback되는 조건을 synthetic live-equivalent D1 fixture로
결정적으로 재현하고, 원자성 불변식을 유지한 채 최소 보정 경계를 확정한다. 이 Stage에서는
제품 runtime을 수정하지 않고 현재 failure를 기대하는 통과형 회귀와 incident 분석 문서만
추가한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/__tests__/d1-maintenance.test.js` | live-equivalent row count, active structured operation과 mixed-case submitted-device ID를 사용해 locale/binary 정렬 불일치, conflict와 full rollback을 고정하는 회귀를 추가했다. |
| `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md` | 증상, 재현, 확정 원인, Stage 2 보정 원칙, 재발 방지와 검증 근거를 기록했다. |
| `mydocs/orders/20260824.md` | Task #122를 `Stage 1 완료·원인 확정, Stage 2 승인 대기`로 갱신했다. |
| `mydocs/working/task_m100_122_stage1.md` | Stage 1 산출물, 검증, 잔여 위험과 다음 단계 승인 경계를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 runtime, 외부 API·CLI 계약, 공개 문서와 schema는 변경하지 않았다. 회귀 테스트와
특정 incident 문서만 추가·수정했다. Stage5 D1 확인은 table overview와 필요한 순서·개수의
read-only projection으로 제한했으며 mutation은 0건이다. production은 변경하지 않았고,
Task #108 worktree와 그 계획·단계 문서도 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/d1-maintenance.test.js
npm run smoke:sites-fullstack:local
git diff --check
git status --short
```

결과:

- OK — D1 maintenance 8 tests, 8 pass, 0 fail.
- OK — live-equivalent fixture가 owner 1, OAuth state 19, session 22, challenge 11,
  token 8, snapshot 0, usage 1, submitted device 7, rate limit 2와 active structured
  operation 1을 사용해 현재 conflict를 결정적으로 재현했다.
- OK — 동일 row 수의 lowercase/numeric control은 성공하지만 mixed-case fixture는
  JavaScript locale order와 SQLite binary order가 달라 guard fingerprint mismatch로
  rollback된다. H1을 원인으로 확정했고 stale claim, row cardinality와 active lease 자체는
  원인에서 제외했다.
- OK — failure 뒤 owner·dependent rows, operation ID·phase·최초 승인 object count 77과
  digest가 그대로이며 atomic claim/assertion residue는 0이다.
- OK — Stage5 read-only 확인에서도 submitted device 7개에 mixed-case가 있고 locale/binary
  순서 및 fingerprint가 서로 다르며 stale claim/assertion은 각각 0개였다. live identifier,
  row payload와 provider 원문은 산출물에 기록하지 않았다.
- OK — full-stack local smoke 67 routes와 canonical update 2회를 검증했다.
- OK — `git diff --check`가 통과했고 Stage 1 추적 파일 외 변경은 없다.

## 잔여 위험

- 원인을 고정했을 뿐 runtime fix는 아직 구현하지 않았다. Stage5의 기존 owner와 active
  structured operation은 그대로 남아 있고 account deletion은 계속 차단된 상태다.
- Stage5 maintenance는 비활성화된 상태를 유지하며 Task #122 exact-main Gate 전에는 기존
  operation을 재개하지 않는다.
- Stage 2에서 JavaScript 정렬을 SQLite `BINARY`와 동일한 deterministic ASCII/code-point
  comparator로 바꾸되 `id`, `updatedAt`, `lastSubmittedAt` exact guard와 단일 transaction
  atomicity를 약화하지 않아야 한다.
- generic conflict 호환성을 지키면서 terminal invariant failure와 retryable conflict를
  구분하는 safe 정보 경계는 Stage 2 검증 대상으로 남아 있다.

## 다음 단계 영향

- Stage 2는 H1만을 최소 보정 범위로 사용한다. mixed-case 회귀를 conflict 기대에서 한 번의
  atomic success 기대 회귀로 전환하고 기존 drift·injected failure의 full rollback을 유지한다.
- API body와 log에는 SQL, provider 원문, stack, owner scope와 row payload가 노출되지 않도록
  allowlist된 reason·retryability만 검증한다.
- source와 local/real-workerd 검증만 수행하며 Stage5·production mutation은 하지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 D1 원자 삭제 및 Sites 오류 경계 보정으로
  진행한다.
