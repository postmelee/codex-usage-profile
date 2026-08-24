# Task #122 — Sites live D1 structured delete 정렬 충돌

GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)

## 증상

Task #108 Stage 5 Gate E에서 Stage5 테스트 owner의 R2 revision이 0이고 publication이
tombstone이며 D1 owner가 private인 상태까지 진행했지만, account deletion은 매 요청의
`structured` phase에서 `maintenance_conflict`를 반환했다. 같은 active operation을 128회
재개한 실행과 별도 8회 실행이 모두 `delete_account_iteration_limit`으로 끝났다.

D1 row는 삭제되지 않았고 active operation은 `structured` phase와 최초 승인 object count 77을
유지했다. Stage5 maintenance는 비활성화됐고 production은 변경되지 않았다.

## 재현 조건

```bash
node --test src/profile-backend/__tests__/d1-maintenance.test.js
```

- 환경: `local/task122`, migration `1..6`, Miniflare D1/workerd
- 입력:
  - owner 1
  - OAuth state 19
  - session 22
  - CLI login challenge 11
  - CLI token 8
  - latest snapshot 0
  - latest usage 1
  - submitted device 7
  - account usage rate limit 2
  - active deletion operation 1, phase `structured`
- 핵심 조건: submitted device ID 7개가 safe key segment이지만 대·소문자를 함께 사용해
  JavaScript locale order와 SQLite binary order가 다르다.
- control: 같은 row 수와 phase에서 소문자·숫자 ID만 사용하면 structured delete가 성공한다.

## 원인

원인은 `buildOwnerDeleteGuard`의 submitted-device fingerprint 정렬 계약 불일치다.

- JavaScript는 device를 `left.id.localeCompare(right.id)`로 정렬해 fingerprint를 만든다.
- D1 guard SQL은 `ORDER BY id` 뒤 `GROUP_CONCAT`으로 fingerprint를 만들며, `id`의 기본
  collation은 SQLite `BINARY`다.
- 대문자를 포함한 safe key segment에서는 locale-aware 순서와 binary 순서가 달라질 수 있다.
- 두 fingerprint가 다르면 guard claim의 `INSERT ... SELECT`가 0행이 된다.
- 다음 assertion statement가 `NOT NULL`을 만족하지 못해 D1 batch 전체를 rollback한다.
- adapter는 이 provider error를 기존 generic
  `owner changed before account deletion committed` conflict로 정규화하므로 CLI는 실제 state
  drift와 deterministic ordering mismatch를 구분하지 못하고 재시도했다.

Stage5 read-only D1 비교에서 다음을 확인했다.

- submitted device: 7개
- 대문자 포함: yes
- locale order와 binary order 차이: yes
- 두 방식의 fingerprint 차이: yes
- stale `atomic_operation_claims`: 0개
- stale `atomic_operation_assertions`: 0개

따라서 stale claim, row cardinality, active lease 자체는 현재 사건의 원인이 아니다.
synthetic mixed-case fixture에서도 동일 conflict와 full rollback이 재현됐다.

## 해결

Stage 1에서는 runtime을 수정하지 않고 현재 failure를 기대하는 통과형 회귀를 추가했다.

- live-equivalent counts와 combined approval count 77을 synthetic fixture에 고정했다.
- mixed-case device ID에서 locale/binary 순서 차이를 먼저 증명한다.
- structured delete가 conflict를 반환한 뒤 owner/dependent row count와 content digest가
  그대로인지 확인한다.
- operation ID·phase·승인 count가 유지되고 atomic claim/assertion residue가 0인지 확인한다.

Stage 2에서는 확정 원인만 다음 원칙으로 보정했다.

- safe key segment의 ASCII/code-unit binary comparator를 사용해 JavaScript fingerprint 순서를
  SQLite `BINARY ORDER BY id`와 일치시켰다.
- device의 `id`, `updatedAt`, `lastSubmittedAt` exact guard 필드를 유지했다.
- count-only 비교로 guard를 약화하거나 transaction을 분할하지 않았다.
- 같은 fixture를 conflict 기대에서 atomic success 기대 회귀로 전환했다.
- owner delete를 trigger로 강제 중단해 71개 structured 객체, operation 승인값과 atomic
  claim/assertion이 모두 원상 rollback되는지 검증했다.
- confirmed state drift에는 기존 top-level `maintenance_conflict`와 함께 allowlist된
  `structured_state_changed`, `retryable: false`만 제공하고 임의 reason, SQL, provider 원문과
  row payload는 응답에서 제거했다.

변경 파일:

- `src/profile-backend/__tests__/d1-maintenance.test.js`
- `src/profile-backend/__tests__/_d1-test-fixture.js`
- `src/profile-backend/__tests__/_d1-worker-harness.js`
- `src/profile-backend/d1/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `src/profile-runtime/sites/maintenance.js`

## 재발 방지

- key segment 정렬은 locale-dependent API를 사용하지 않고 저장소 collation과 동일한
  deterministic comparator를 사용한다.
- 한 건·소문자 fixture만 두지 않고 mixed-case permutation과 high-cardinality fixture를 유지한다.
- guard 실패 테스트는 오류 코드뿐 아니라 owner/dependent rows, operation과 claim residue의
  full rollback을 확인한다.
- live delete 전에는 atomic claim 잔존, active operation, media 0과 backup checksum을 read-only로
  다시 확인한다.
- 실제 Stage5 resume는 Task #122 exact-main Gate 전에는 실행하지 않는다.

## 검증

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
npm run smoke:sites-fullstack:local
git diff --check
```

결과:

- OK — D1 maintenance 9 tests와 Sites maintenance 23 tests, 합계 32 pass, 0 fail.
- OK — mixed-case live-equivalent fixture가 동일 operation·approval 경계에서 원자 완료됐다.
- OK — injected owner-delete failure가 structured row와 operation을 full rollback했다.
- OK — allowlist된 terminal conflict만 reason·retryability를 제공하며 provider detail은
  외부 응답에 노출되지 않는다.
- OK — 기존 full-stack smoke 67 routes, canonical update 2회 검증.
- OK — Stage5 확인은 read-only table overview/row projection만 사용했고 mutation은 0건이다.

## 참고

- [Task #122 수행계획서](../plans/task_m100_122.md)
- [Task #122 구현계획서](../plans/task_m100_122_impl.md)
- [Task #119 최종 보고서](../report/task_m100_119_report.md)
- [`buildOwnerDeleteGuard`](../../src/profile-backend/d1/maintenance.js)
