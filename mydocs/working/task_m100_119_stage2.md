# Task #119 Stage 2 보고서 — bounded R2 batch와 Sites 단계 전이

GitHub Issue: [#119](https://github.com/postmelee/codex-usage-profile/issues/119)

구현계획서: [`task_m100_119_impl.md`](../plans/task_m100_119_impl.md)

Stage: 2

## 단계 목적

계정 삭제가 단일 요청에서 모든 R2 revision을 처리하지 않도록 기본 8개 bounded batch를 도입하고, Stage 1의 persistent operation·lease·phase를 Sites 삭제 흐름에 연결했다. 각 요청은 lease를 가진 동안 batch 하나만 처리하며, 남은 revision이 있으면 안전한 progress를 반환하고 R2가 비어 있을 때만 structured D1 삭제로 전이한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/r2-binding/maintenance.js` | 기본 8개·최대 32개 revision batch 삭제, 실제 post-delete manifest와 삭제·잔여 수 반환 |
| `src/profile-media/__tests__/r2-binding-maintenance.test.js` | 10개 revision 8+2 재개, partial failure, stable/immutable ETag와 delete 잔존 fail-closed 검증 |
| `src/profile-runtime/sites/maintenance.js` | operation 생성·재사용, lease 직렬화, prepare/media/structured 전이와 safe progress 응답 구현 |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | 다중 batch 재개, 승인 불일치, live lease, media 실패 재개와 비밀 비노출 검증 |

## 본문 변경 정도 / 본문 무손실 여부

제품·운영 문서는 변경하지 않았다. 기존 maintenance summary 필드는 유지하고 delete-account 및 active plan에만 additive `progress`를 추가했다. progress는 operation ID, status/phase, 이번 요청 삭제 수, 잔여 revision 수, active lease의 bounded retry 값과 최초 승인 digest/count만 포함하며 owner/handle, lease nonce, R2 key·ETag는 포함하지 않는다. export/restore/retention/repair 동작은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-media/__tests__/r2-binding-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  src/profile-backend/__tests__/d1-maintenance.test.js
git diff --check
```

결과:

- OK — 39 tests, 39 pass, 0 fail.
- OK — revision 10개를 첫 요청 8개, 다음 요청 2개로 처리하고 각 batch 뒤 실제 manifest를 반환했다.
- OK — partial R2 실패 뒤 삭제된 key를 제외한 현재 manifest에서 재개했다.
- OK — stable republish, immutable ETag 변경, delete 후 객체 잔존을 mutation 완료로 오인하지 않았다.
- OK — live lease 요청은 mutation을 겹치지 않고 60초 bounded retry progress를 반환했다.
- OK — media phase 실패 시 lease를 해제하고 tombstone/quiesce를 반복하지 않은 채 같은 operation을 재개했다.
- OK — `git diff --check` 통과.

## 잔여 위험

- Stage 3 전까지 operator CLI는 `in_progress` 응답을 자동 반복하거나 network-unknown 결과를 plan으로 reconcile하지 않는다.
- 최종 D1 삭제 응답을 잃은 뒤 plan `not_found`를 완료로 판정하는 operator 경계는 Stage 3에서 구현한다.
- migration 6 packaging allowlist와 운영 문서 정합화, 전체 통합 검증은 Stage 4 범위로 남아 있다.
- 실제 Stage5 배포와 계정 삭제 재시도는 수행하지 않았다.

## 다음 단계 영향

- Stage 3 CLI는 progress의 operation ID와 최초 승인 digest/count를 유지한 채 batch 요청을 직렬로 보내야 한다.
- live lease에서는 `retryAfterSeconds`를 존중하고, 진행 수·phase가 단조롭지 않으면 추가 mutation을 중단해야 한다.
- apply 결과가 불확정이면 새 apply보다 active plan 조회를 먼저 수행해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3의 operator CLI 직렬 재개와 불확정 결과 회복 구현으로 진행한다.
