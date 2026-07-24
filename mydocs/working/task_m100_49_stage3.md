# Task #49 Stage 3 보고서 — native R2 media adapter POC

GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
구현계획서: [`task_m100_49_impl.md`](../plans/task_m100_49_impl.md)
Stage: 3

## 단계 목적

Sites Worker의 `PROFILE_MEDIA` native R2 binding만으로 immutable `en`/`ko` 카드 revision과 stable public publication을 저장·조회하고, application ETag와 R2 storage ETag를 분리한다. publication service는 R2 I/O를 D1 transaction 안에 넣지 않고 Stage 2의 `atomic.updateVisibility` compare-and-set을 사용해야 한다.

승인된 변경안에 따라 R2 `delete`의 conditional precondition 부재를 우회 구현하지 않았다. publish/unpublish와 D1 CAS 보상은 stable object의 직전 storage ETag가 일치할 때만 `put(..., { onlyIf })`로 publication 또는 tombstone을 교체한다. public route는 tombstone/private/missing을 같은 404로 닫고 immutable revision은 보존한다.

이번 Stage는 local fake/native binding POC와 Worker artifact 검증까지만 수행했다. Site, D1, R2, OAuth app, runtime secret과 deployment는 생성·변경하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/r2-binding/store.js`, `index.js` | Worker `R2Bucket`의 `head/get/put`만 사용하는 immutable revision, stable publication, conditional tombstone adapter |
| `src/profile-media/media-store-contract.js`, `index.js` | contract v3 `inspectStableCard`, stable state kind, provider-neutral storage precondition과 unpublished 의미 |
| `src/profile-media/publication-service.js` | R2 I/O와 `atomic.updateVisibility` CAS 분리, publish/unpublish conditional 보상과 superseded/repair-required 결과 |
| `src/profile-media/s3/store.js` | contract v3 stable inspection/storage ETag surface와 기존 S3 fallback 동작 보존 |
| `src/profile-media/__tests__/_r2-binding-fake.js`, `_r2-fixtures.js` | R2 body stream, `etag`/`httpEtag`, custom/HTTP metadata와 `onlyIf` 실패 의미를 재현하는 fake/fixture |
| `src/profile-media/__tests__/r2-binding-store.test.js` | immutable create-only/idempotency, locale/304/HEAD, tombstone, republish, metadata/body digest 검증 |
| `src/profile-media/__tests__/r2-binding-failure.test.js` | revision/stable/tombstone write 실패와 conditional stable read 경쟁 검증 |
| `src/profile-media/__tests__/r2-publication-concurrency.test.js` | D1 CAS 실패 보상이 더 최신 publication/tombstone을 덮거나 제거하지 않는 경쟁 검증 |
| 기존 media contract/publication test | contract v3와 transaction 외부 R2 I/O, named visibility CAS, 최종 state 정합성 회귀 |
| `src/profile-runtime/sites/backend.js`, `worker.js`와 test | `PROFILE_MEDIA` binding을 native adapter로 Sites backend dependency seam에 주입 |
| `src/profile-backend/__tests__/http.test.js` | contract v3 media wrapper 갱신; public 404/503와 private on-demand preview 회귀 유지 |
| `scripts/cleanup-orphan-card-media.mjs`와 test | stable tombstone을 삭제 후보나 incomplete publication으로 보지 않고 명시적으로 보존 |
| `mydocs/plans/task_m100_49_impl.md` | 승인된 stable tombstone CAS, Worker route 전용 서빙과 cleanup 정책 반영 |

native R2 adapter 본문은 664줄이고 R2 fake/fixture와 전용 test는 751줄이다. `.openai/hosting.json`은 계속 `d1: null`, `r2: null`이며 `project_id`가 없다.

## 본문 변경 정도 / 본문 무손실 여부

외부 HTTP route와 response 의미는 유지했다. `/u/{handle}/card.png`의 GET/HEAD/304/application ETag 계약은 같고 tombstone/private/missing은 같은 404다. 인증된 private preview `/api/profile/card.png`는 계속 on-demand와 `no-store`이며 R2에 저장하지 않는다.

media store contract는 v2에서 v3으로 올라갔다. 새 `inspectStableCard`는 `missing`/`publication`/`unpublished`와 provider storage ETag를 publication coordinator에만 노출한다. application ETag는 계속 최종 PNG SHA-256 base64url digest의 quoted 값이며 HTTP cache validator로만 사용한다.

Memory adapter도 tombstone을 모델링해 공통 의미를 검증한다. S3 fallback은 stable object를 물리 삭제할 수 있지만 공통 `unpublishCard` 계약은 물리 삭제 여부가 아니라 public read에서 unpublished가 되는 것으로 정의했다. native R2 hosted import graph는 S3 client와 AWS SDK를 import하지 않는다.

cleanup 도구는 stable tombstone을 유지하되 tombstone이 immutable revision을 보호한다고 보지 않는다. 따라서 tombstone이 있어도 dry-run/apply revision scan을 계속할 수 있고 stable key 자체는 삭제하지 않는다.

## 검증 결과

구현계획서 Stage 3 명령:

```bash
node --test src/profile-media/__tests__/r2-binding-store.test.js
node --test src/profile-media/__tests__/r2-binding-failure.test.js
node --test src/profile-media/__tests__/r2-publication-concurrency.test.js
node --test src/profile-media/__tests__/media-store-contract.test.js
node --test src/profile-media/__tests__/publication-service.test.js
node --test src/profile-media/__tests__/publication-concurrency.test.js
node --test src/profile-media/__tests__/s3-store.test.js
node --test src/profile-backend/__tests__/http.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
node --test
git diff --check
```

추가 tombstone retention 검증:

```bash
node --test scripts/__tests__/cleanup-orphan-card-media.test.js
node --test src/profile-runtime/sites/__tests__/backend.test.js
```

결과:

- OK — native R2 adapter 전용 test 14/14 통과
  - immutable create-only write와 same body/metadata idempotency
  - `en` stable body, `ko` immutable pointer, GET/HEAD/304 application ETag
  - malformed metadata와 application digest 불일치 fail closed
  - stable read의 1회 조건부 retry와 반복 경쟁 503
- OK — publication 경쟁 test
  - publish D1 CAS 패자의 보상이 더 최신 publication을 tombstone으로 바꾸지 않음
  - unpublish D1 CAS 패자의 보상이 더 최신 publication 위에 이전 PNG를 복구하지 않음
  - 경쟁이 없을 때만 자신이 쓴 tombstone ETag를 조건으로 이전 publication 복구
  - native path에서 `delete` 호출 0회
- OK — media contract v3 6/6, publication service 11/11, memory concurrency 3/3 통과
- OK — S3 adapter 5 pass, 1 env-gated skip; 기존 S3-compatible fallback 보존
- OK — backend HTTP 40/40 통과; public 404/503, private preview, GET/HEAD/304 회귀 없음
- OK — cleanup 5/5 통과; stable tombstone 유지와 immutable orphan 선별 계속 동작
- OK — Sites dependency seam 4/4 통과
- OK — full-stack build: Worker ESM 69.75 kB, client entry 304.88 kB
- OK — artifact verifier: client 7 files, Worker 1 JS file, `@aws-sdk/client-s3`/S3 credential/client secret pattern 없음
- OK — 전체 test: 429개 중 423 pass, 6 skip, 0 fail
  - skip은 기존 `TEST_DATABASE_URL`/`TEST_S3_*` 미설정 integration test다.
- OK — `git diff --check`: 경고 없음

공식 Cloudflare R2 Workers API는 `get`/`put`의 `onlyIf`, precondition 실패 시 body 없는 object/`null`, strong consistency를 명시한다. `delete(key)`에는 condition 인자가 없다. 구현은 [Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)의 이 surface만 사용한다.

## 잔여 위험

- 실제 remote Sites R2 binding은 Stage 5 Gate A 전까지 만들지 않았으므로 remote latency, quota, custom metadata와 conditional write 동작은 아직 실측하지 않았다.
- local R2 fake는 문서화된 Worker API 의미를 재현하지만 실제 workerd R2 binding integration을 대신하지 않는다. Stage 4 local full-stack과 Stage 5 remote Gate에서 다시 검증한다.
- stable tombstone은 의도적으로 물리 삭제하지 않으므로 handle별 작은 object가 남는다. 현재 cleanup은 이를 보존하며, 실제 사용량이 생긴 뒤 별도 lifecycle/관리 operation이 필요할 수 있다.
- D1과 R2 사이에는 분산 transaction이 없다. conditional 보상이 실패하거나 malformed stable metadata 때문에 소유권을 증명할 수 없는 경우 generic 503과 `repair_required`로 fail closed한다.
- S3 fallback은 native R2 tombstone과 달리 stable object를 물리 삭제한다. 외부 HTTP 의미는 같지만 provider별 내부 보상 방식은 동일하지 않다.

## 다음 단계 영향

- Stage 4는 Worker PNG renderer를 주입하고 D1 store, shared limiter, native R2 media store, GitHub OAuth를 `createProfileBackendHttpHandler` factory에 합성한다.
- local full-stack smoke에서 publish/unpublish, GET/HEAD/304/404와 private preview가 같은 Worker runtime에서 통과해야 한다.
- 대표 `en`/`ko`, avatar success/failure PNG는 작업지시자에게 보여주고 시각 승인을 받은 뒤에만 Stage 5로 진행한다.
- `.openai/hosting.json`의 `d1`/`r2`는 Stage 5 Gate A 전까지 계속 `null`을 유지한다.

## 승인 요청

- Stage 3 native R2 media adapter, tombstone CAS 변경안과 검증 결과를 승인하면 Stage 4 Worker PNG renderer와 local full-stack 통합으로 진행한다.
