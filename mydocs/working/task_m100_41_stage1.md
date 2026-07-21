# 단계 보고서 — Task #41 Stage 1

GitHub Issue: [#41](https://github.com/postmelee/codex-usage-profile/issues/41)
구현계획서: [`task_m100_41_impl.md`](../plans/task_m100_41_impl.md)
Stage: 1 — async 계약 정렬과 atomic operation 승격

## 단계 목적

Postgres adapter(Stage 3)가 드롭인될 수 있도록 store contract를 async 계약으로 정렬하고, 5개 atomic operation을 **transaction scope**로 구현한다. 구현 중 코드 검토에서 "준비된 레코드를 named method에 넘김" 설계가 잠금 없는 read 시점 판정 때문에 다중 인스턴스 경쟁 안전성을 만족하지 못함을 확인했고, 작업지시자 승인(2026-07-21)으로 `store.transaction(fn)` scope 방식으로 변경했다. memory/file store는 스냅샷/복원으로 all-or-nothing을 보장하고, 서비스 read-modify-write 전체가 트랜잭션 스코프 안에서 실행된다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/store-contract.js` | `PROFILE_BACKEND_STORE_METHODS`에 `transaction` 추가, async 계약·직렬화 키 주석 |
| `src/profile-backend/store.js` | memory store에 `transaction(runner)` 추가 (exportState 스냅샷 → 실패 시 clear+hydrate 복원, sync·async 양쪽 지원) |
| `src/profile-backend/durable-store.js` | file store proxy에서 `transaction` 특수 처리 (성공 시 1회 persist, 실패 시 memory 복원으로 disk 일관) |
| `src/profile-backend/oauth-runtime.js` | `startGitHubLogin`/`completeGitHubCallback` async, callback 완료를 `store.transaction`으로 감싸고 tx 안에서 lock re-check(`checkOAuthStateConsumable`)·owner·session·state 소비 |
| `src/profile-backend/cli-login.js` | `startCliLogin`/`approveCliLogin`/`exchangeCliLogin`/`pollCliLogin` async, approve·exchange를 transaction으로 감싸고 pure re-check(`checkChallengeApprovable`/`checkChallengeExchangeable`) 추가 |
| `src/profile-backend/account-usage-submit.js` | `submitAccountUsage`/`getAccountUsageStatus` async, previous read·비교·device touch·usage save를 한 transaction으로 |
| `src/profile-backend/accounts.js` | `updateVisibility`/`upsertGitHubOwner`/`resolveOwnerHandle`/`findAvailableHandle` async, `store` override(activeStore) 지원 |
| `src/profile-backend/session.js` | `createSession`/`verifySession*`/`revokeSession`/`logoutFromCookie` async, `createSession`에 `store` override |
| `src/profile-backend/tokens.js` | `issueCliToken`/`listCliTokens`/`verifyCliToken`/`revokeCliToken` async, `issueCliToken`에 `store` override |
| `src/profile-backend/devices.js` | `upsertSubmittedDevice`/`listSubmittedDevices`/`renameSubmittedDevice` async, `upsertSubmittedDevice`에 `store` override |
| `src/profile-backend/snapshots.js` | `submitSnapshot`(legacy) transaction 래핑, getter async |
| `src/profile-backend/http.js` | 서비스 호출부 `await` 정합 (직접 store 호출 없음) |
| `src/profile-card/service.js` | 카드 서비스 read async, `updateVisibility`를 `store.transaction`으로 감싸 owner+latest usage 원자 갱신 |
| `src/profile-backend/__tests__/store-transactions.test.js` | 신규(375줄): transaction primitive all-or-nothing, 5 atomic operation 성공·중복 소비 거부·부분 commit 부재 |
| 기존 test 12종 + CLI integration test | async 서비스 호출 `await` 정합, `assertBackendError` 헬퍼를 `assert.rejects` 기반으로 전환 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업. 서비스 외부 시그니처(입력·반환 형태)와 HTTP 응답 형태는 보존했다. 유일한 동작 강화는 write path의 다중 레코드 연산이 이제 all-or-nothing으로 커밋된다는 점이며, 기존 성공·실패 경로 결과는 회귀 테스트로 동일함을 확인했다. store method 자체는 동기 유지(store-level test 무변경).

문서: 구현 중 승인된 transaction scope 결정에 맞춰 `task_m100_41.md`·`task_m100_41_impl.md`의 해당 설계 절만 갱신(원문 최소 수정).

## 검증 결과

실행 명령:

```bash
node --test
git diff --check
```

결과:

- OK — `ℹ tests 314 / ℹ pass 314 / ℹ fail 0` (기존 305 + 신규 store-transactions 9)
- OK — `git diff --check` 경고 없음

## 잔여 위험

- **updateVisibility의 latestSnapshot 미포함**: 현재 transaction은 owner+latestUsage만 동기화한다. contract 문구는 latestSnapshot도 포함하나, 이 저장소에서 snapshot 경로는 legacy(README상 production `/u/:handle` 미사용)다. Stage 3 Postgres updateVisibility 구현·Stage 5 concurrency test에서 latestSnapshot 동기화 포함 여부를 확정한다.
- **memory transaction의 원자성은 스냅샷/복원 기반**: 실제 잠금 직렬화(FOR UPDATE)와 경쟁 안전성은 Stage 3 Postgres adapter에서 실현된다. Stage 1은 계약·스코프·판정 위치를 고정하는 단계다.

## 다음 단계 영향

- Stage 2(schema/migration)와 Stage 3(Postgres adapter)는 이 async 계약과 `transaction(runner)` 표면을 그대로 구현하면 된다. 서비스는 이미 tx-bound sub-service(`store` override)와 lock re-check(`check*` 순수 함수)를 갖췄으므로, Postgres adapter는 `transaction`을 BEGIN/COMMIT + 직렬화 키 `FOR UPDATE`로 구현하면 서비스 재작성 없이 경쟁 안전해진다.

## 승인 요청

- Stage 1 산출물과 검증 결과(314/314 pass, diff --check clean)를 승인하면 Stage 2(Postgres schema와 versioned migration)로 진행한다.
