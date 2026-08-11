# 구현계획서 — Task #42: R2 public card media 및 stable URL 구현

수행계획서: [`task_m100_42.md`](task_m100_42.md)
GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | media contract v2와 S3-compatible adapter | `media-store-contract.js`, `s3/client.js`, `s3/store.js` | 공통 contract, conditional write/copy, env-gated S3 test |
| 2 | owner publish/unpublish orchestration | `publication-service.js`, `service.js`, `http.js` | owner scope, locale publication, 직렬화, privacy-first unpublish |
| 3 | 공개 stable route와 locale/private 경계 | `http.js`, media/card/backend test | R2-only lookup, GET/HEAD/304/404, `en`/`ko`, private non-persistence |
| 4 | future submit refresh와 runtime wiring | runtime media mode/readiness, submit refresh, CLI 오류 안내 | changed/idempotent refresh, fail-closed, secret/bundle 검사 |
| 5 | failure/concurrency·retention·문서 통합 | failure matrix, cleanup 도구, 공식 문서 | 부분 실패·경쟁, retention guard, 전체 test/build |
| 6 | PR 리뷰 public media 가용성 보완 | public 404/503 분리, stable read bounded retry | invalid/missing 404, provider/timeout·반복 412 503 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| media contract·key·locale·retention·env 정책 | `docs/production-hosting.md` 기존 절 확장 | `docs/production-hosting.md` (Stage 5) | OK | 신규 공식 문서 없음 |
| stable URL·locale·submit 갱신 계약 | `README.md`, `docs/readme-card.md` 기존 절 | `README.md`, `docs/readme-card.md` (Stage 5) | OK | 기존 사용자 문서 진실 원천 유지 |
| S3-compatible adapter | `src/profile-media/s3/` | `src/profile-media/s3/` (Stage 1) | OK | provider-neutral 코드, R2는 env/운영 문서에 한정 |
| task 산출물 | `mydocs/` | `mydocs/plans`, `mydocs/working`, `mydocs/report` | OK | Hyper-Waterfall 규칙 유지 |

## 공통 구현 계약

- media store contract v2의 method 이름은 기존 5개를 유지하고 option/record shape를 locale·handle publication에 맞게 확장한다.
  - `putRevision({ ownerId, locale, revision, body, etag, createdAt })`
  - `getRevision({ ownerId, locale, revision })`
  - `publishRevision({ ownerId, handle, publicationId, representations, publishedAt })`
  - `getPublishedCard({ handle, locale, ifNoneMatch, includeBody })`
  - `unpublishCard({ handle })`
- key는 다음으로 고정한다.
  - immutable: `cards/v2/owners/{ownerId}/revisions/{locale}/{revision}.png`
  - stable: `cards/v2/public/{handle}/card.png`
- `representations`는 `en`, `ko` 각각의 immutable key, 43자 revision, quoted application ETag를 가진다. stable body는 `en`이고 stable custom metadata가 두 representation과 publication id를 함께 가리킨다.
- application ETag는 최종 PNG bytes의 SHA-256 base64url digest를 quote한 값이다. R2 storage ETag는 S3 mutation 조건에만 쓰고 HTTP card validator로 노출하지 않는다.
- media/S3 오류는 contract-level `conflict`, `not_found`, `unavailable`로 정규화한다. HTTP는 publication 실패를 credential·bucket·key가 없는 일반 `media_unavailable` 503으로 변환한다.
- S3 client는 `maxAttempts`, operation timeout을 명시한다. owner transaction의 30초 idle timeout 안에 avatar와 media I/O가 끝나도록 각 외부 요청을 bounded하게 유지한다.
- env-gated S3 test는 test별 고유 prefix를 사용하고 자신이 생성한 object만 정리한다. 설정이 불완전하면 skip 사유를 명시하며 임의 기본 credential로 접속하지 않는다.

## Stage 1 — media contract v2와 S3-compatible adapter

### 산출물

신규:

- `src/profile-media/index.js` — server-side media export 진입점
- `src/profile-media/s3/client.js` — AWS SDK client 생성, R2/MinIO env 해석, timeout/retry 설정
- `src/profile-media/s3/store.js` — S3-compatible 5-method adapter와 `verifyReadiness`, `close`
- `src/profile-media/__tests__/s3-store.test.js` — env-gated S3/MinIO contract integration

수정:

- `src/profile-media/media-store-contract.js` — contract version 2, locale/handle key와 publication record, memory fixture
- `src/profile-media/__tests__/media-store-contract.test.js` — 공통 fixture를 memory contract v2에 적용
- `package.json`, `package-lock.json` — `@aws-sdk/client-s3` production dependency

### 변경 내용

- `SUPPORTED_PROFILE_MEDIA_LOCALES`를 `en`, `ko`로 고정하고 기존 locale fallback과 같은 방식으로 입력을 정규화한다.
- key segment는 기존 safe segment 검사를 유지한다. handle은 backend가 소유한 canonical slug만 허용하고 object key에 raw URL segment를 직접 넣지 않는다.
- `putRevision`은 `PutObject`의 `If-None-Match: *`로 create-only write를 시도한다. 이미 존재하면 metadata/필요 시 body를 읽어 same bytes는 idempotent, 다른 bytes/ETag/content metadata는 conflict로 판정한다.
- immutable object metadata에 owner id, locale, revision, application ETag와 created timestamp를 저장한다. `Content-Type`은 `image/png`, `Cache-Control`은 public contract 값으로 고정한다.
- `publishRevision`은 모든 referenced immutable object 존재와 metadata 일치를 확인한 뒤 `en` source를 stable key로 `CopyObject`한다. `MetadataDirective=REPLACE`로 publication id, published timestamp와 두 locale pointer를 한 번에 기록한다.
- `getPublishedCard`는 stable metadata를 publication pointer로 사용한다. `en`은 stable body, `ko`는 stable metadata가 가리키는 immutable body를 반환하며 application ETag 비교 결과를 `notModified`로 표현한다.
- `unpublishCard`는 stable key만 삭제하고 immutable revision을 유지한다. 없는 stable 삭제는 idempotent success로 정규화한다.
- `verifyReadiness`는 bucket 접근 권한과 요구 operation에 필요한 최소 read/list 경계를 비파괴적으로 확인한다. credential/bucket/key를 오류나 log에 포함하지 않는다.

### 검증

```bash
node --test src/profile-media/__tests__/media-store-contract.test.js
node --test src/profile-media/__tests__/s3-store.test.js
node --test
git diff --check
```

`s3-store.test.js`는 `TEST_S3_ENDPOINT`, `TEST_S3_BUCKET`, `TEST_S3_ACCESS_KEY_ID`, `TEST_S3_SECRET_ACCESS_KEY`가 모두 있을 때 실행한다. MinIO에서는 `TEST_S3_FORCE_PATH_STYLE=true`를 사용한다. 설정이 없으면 skip을 정상 결과로 기록하되 memory contract와 전체 회귀는 반드시 통과해야 한다.

### 커밋

```text
Task #42 Stage 1: media contract v2와 S3-compatible adapter
```

## Stage 2 — owner publish/unpublish orchestration

### 산출물

신규:

- `src/profile-media/publication-service.js` — publish, refresh, unpublish application service
- `src/profile-media/__tests__/publication-service.test.js` — memory media/structured store 기반 orchestration test

수정:

- `src/profile-media/index.js` — publication service export
- `src/profile-card/service.js` — renderer source digest와 최종 PNG digest/ETag 분리
- `src/profile-card/index.js`, `src/profile-card/__tests__/service.test.js` — 새 digest helper와 반환 contract 검증
- `src/profile-backend/errors.js` — generic `media_unavailable` 503 mapping
- `src/profile-backend/http.js`, `src/profile-backend/__tests__/http.test.js` — publication service 주입과 기존 `PATCH /api/profile` 연계

### 변경 내용

- card service의 renderer-input hash는 `sourceDigest`/cache key로 유지한다. 실제 render 뒤 PNG bytes SHA-256을 계산해 `revision`과 application `etag`를 반환한다. avatar URL의 같은 위치에서 bytes가 바뀌어도 최종 representation digest가 달라진다.
- publication service는 owner id만 입력받고 transaction 안에서 owner를 먼저 읽어 row lock을 획득한 뒤 최신 usage를 다시 읽는다. request body의 owner id/handle/visibility는 신뢰하지 않는다.
- publish는 `en`, `ko`를 모두 render하고 immutable write를 완료한 뒤 stable copy를 final commit point로 실행한다. copy 성공 후 같은 transaction에서 owner/latest usage/latest snapshot visibility를 public으로 맞춘다.
- 최초 private→public에서 stable copy 뒤 structured commit이 실패하면 stable 제거 보상을 시도한다. 보상 성공/실패를 credential이나 payload 없이 구분 가능한 internal result로 남기고 HTTP에는 generic partial-failure 오류만 반환한다.
- unpublish는 stable 삭제가 성공한 뒤에만 structured visibility를 private으로 갱신한다. delete 실패 시 transaction을 rollback해 public visibility를 유지한다.
- 이미 public/private인 동일 요청은 멱등 처리하되 public 요청은 stable publication이 없거나 불완전하면 repair publish를 수행한다.
- 기존 `PATCH /api/profile` payload와 response shape는 유지한다. 현재 UI/client 변경 없이 public/private 버튼이 새 orchestration을 사용하게 한다.

### 검증

```bash
node --test src/profile-media/__tests__/publication-service.test.js
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-backend/__tests__/http.test.js
node --test
git diff --check
```

### 커밋

```text
Task #42 Stage 2: owner publish/unpublish orchestration
```

## Stage 3 — 공개 stable route와 locale/private 경계

### 산출물

수정:

- `src/profile-backend/http.js` — public card route를 media store lookup으로 교체
- `src/profile-backend/__tests__/http.test.js` — GET/HEAD/304/404·locale·non-access spy
- `src/profile-runtime/__tests__/dev-server.test.js`, `host-adapter.test.js` — stable media route 회귀 fixture
- 필요 시 `src/profile-media/media-store-contract.js`와 contract test — HEAD/includeBody 최적화 정합

### 변경 내용

- `GET|HEAD /u/{handle}/card.png`는 canonical handle과 locale만 정규화한 뒤 `mediaStore.getPublishedCard`를 호출한다. `cardService`, structured store, owner/usage record를 조회하지 않는다.
- query 없는 URL과 unsupported locale fallback은 `en`, `locale=ko`는 `ko` representation을 선택한다. URL 계약은 변경하지 않는다.
- stable이 없거나 metadata가 불완전하거나 referenced `ko` immutable이 없으면 동일한 public 404를 반환한다. Stage 6 보완 후 provider·timeout·bucket 장애는 storage 내부 정보를 숨긴 generic 503으로 구분한다.
- application ETag가 `If-None-Match`에 일치하면 304, HEAD는 GET과 같은 status/header를 반환하되 body는 비운다. content type/cache control은 media contract 상수만 사용한다.
- `GET /api/profile/card.png`는 기존 session-authenticated on-demand render와 `private, no-store`를 유지한다. media store spy로 revision/stable write가 없음을 고정한다.
- public route test는 structured store getter와 renderer가 호출되면 실패하는 spy를 주입해 Neon/on-demand 경계 제거를 증명한다.

### 검증

```bash
node --test src/profile-backend/__tests__/http.test.js
node --test src/profile-runtime/__tests__/dev-server.test.js src/profile-runtime/__tests__/host-adapter.test.js
node --test src/profile-media/__tests__/media-store-contract.test.js
node --test
git diff --check
```

### 커밋

```text
Task #42 Stage 3: 공개 stable route와 locale 경계
```

## Stage 4 — future submit refresh와 runtime wiring

### 산출물

수정:

- `src/profile-backend/http.js`, `src/profile-backend/__tests__/http.test.js` — committed Account Usage 뒤 public refresh와 exact retry
- `src/profile-backend/errors.js` — publication unavailable 응답의 stable code/status/header
- `packages/codex-usage-profile-cli/src/submit.js`, 관련 test — 503 media refresh 실패의 safe retry 안내
- `src/profile-runtime/deployment-config.js`, 관련 test — `PROFILE_MEDIA_MODE` enum과 production validation
- `src/profile-runtime/runtime-backend.js`, `dev-server.js`, 관련 test — memory media store/service 기본 주입
- `src/profile-runtime/production-server.js`, 관련 test — external S3 store 생성, readiness, close
- `.env.example` — local media mode와 complete R2/test env 이름 예시

### 변경 내용

- Account Usage 저장 transaction이 성공한 뒤 result owner가 public이면 `refreshPublishedCard(owner.id)`를 호출한다. refresh는 새 transaction에서 owner row를 잠그고 현재 public 여부와 최신 usage를 다시 확인해 stale render를 막는다.
- 새 submit뿐 아니라 `idempotent: true` exact retry도 refresh를 실행한다. media 실패 전 structured usage commit은 유지하고 HTTP는 `media_unavailable` 503과 safe retry 의미를 반환한다. 다음 exact retry가 publication을 복구하면 원래 idempotent 200 응답으로 수렴한다.
- CLI는 이 503을 “usage 저장 결과는 재시도로 안전하며 public card refresh를 다시 시도할 수 있음”으로 매핑한다. credential 삭제나 새 timestamp 생성은 요구하지 않는다.
- deployment config는 `PROFILE_MEDIA_MODE=memory|external`을 정규화한다. production은 external만 허용하고 development/spike 기본은 memory다.
- external media store는 adapter 생성 시에만 `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, optional `R2_REGION`을 읽는다. runtime config 반환값과 startup error에는 secret을 넣지 않는다.
- production server는 structured store와 media store readiness가 모두 성공한 뒤 listen한다. 자신이 생성한 store/client만 shutdown에서 닫고 injected fixture는 소유자가 관리한다.
- R2 client module이 frontend bundle에 포함되지 않고 `R2_SECRET_ACCESS_KEY` 문자열/fixture 값이 dist와 log에 없는지 검사한다.

### 검증

```bash
node --test src/profile-backend/__tests__/http.test.js
node --test packages/codex-usage-profile-cli/test/submit.test.js
node --test src/profile-runtime/__tests__/deployment-config.test.js src/profile-runtime/__tests__/dev-server.test.js src/profile-runtime/__tests__/production-server.test.js
npm run build
! rg -n "R2_SECRET_ACCESS_KEY|TEST_S3_SECRET_ACCESS_KEY" dist src/profile-ui
node --test
git diff --check
```

### 커밋

```text
Task #42 Stage 4: future submit refresh와 external media runtime
```

## Stage 5 — failure/concurrency·retention·문서 통합

### 산출물

신규:

- `src/profile-media/__tests__/s3-failure.test.js` — command-level write/copy/delete/timeout failure fixture
- `src/profile-media/__tests__/publication-concurrency.test.js` — same/different owner mutation ordering
- `scripts/cleanup-orphan-card-media.mjs` — paginated retention scan, dry-run/default, explicit `--apply`
- `scripts/__tests__/cleanup-orphan-card-media.test.js` — candidate/guard/race recheck test

수정:

- `package.json` — `cleanup:card-media` script
- `docs/production-hosting.md` — contract v2, publication ordering, env/readiness, retention/recovery, remote validation 한계
- `docs/readme-card.md` — 최초 publish, locale, future submit refresh와 failure/retry 계약
- `README.md` — R2 durable media 상태와 runtime env/현재 제약 현행화
- 관련 Stage 1~4 test — failure matrix에서 발견한 경계 보강

### 변경 내용

- failure matrix는 immutable PUT, validation HEAD/GET, stable COPY, stable GET/HEAD, DELETE, timeout과 structured commit failure를 각각 주입한다.
  - immutable/copy 실패: 이전 stable body와 locale metadata 유지
  - unpublish delete 실패: visibility public 유지
  - delete 성공 뒤 structured commit 실패: PNG 404 유지, retry로 private 수렴
  - initial publish stable 성공 뒤 structured commit 실패: stable 제거 보상과 보상 실패의 명시적 오류
- concurrency test는 같은 owner의 publish↔publish, publish↔unpublish, submit refresh↔unpublish를 제어된 barrier로 겹쳐 owner row lock 순서대로 최종 stable/visibility가 일치하는지 확인한다. production과 같은 Postgres fixture(`TEST_DATABASE_URL`)에서는 서로 다른 owner가 하나의 global media lock으로 직렬화되지 않는지도 확인한다. memory store의 기존 global transaction queue는 local fixture 특성으로 별도 기록한다.
- cleanup은 `cards/v2/public/` stable metadata를 먼저 pagination해 모든 referenced revision을 보호한다. `cards/v2/owners/` revision을 owner·locale별로 분류해 referenced, 최근 5개, 90일 이내를 보존하고 나머지만 candidate로 출력한다.
- `--apply`는 candidate 삭제 직전 해당 handle stable metadata를 다시 읽는다. 새 publication이 candidate를 다시 참조하면 skip한다. bucket 전체 삭제, unresolved glob, stable prefix 삭제는 지원하지 않는다.
- 도구 출력은 key, reason, age, dry-run/apply summary만 포함하고 credential·body·owner structured payload를 출력하지 않는다. 삭제 대상은 R2에서 복구할 수 없음을 운영 문서에 명시한다.
- 실제 R2/Cloud Run resource, remote secret 연결, cleanup schedule과 운영 retention 값 조정은 #43으로 넘긴다. 이 task의 remote R2 test가 skip되면 최종 보고에 한계를 명시한다.

### 검증

```bash
node --test src/profile-media/__tests__/s3-failure.test.js src/profile-media/__tests__/publication-concurrency.test.js
node --test scripts/__tests__/cleanup-orphan-card-media.test.js
npm run cleanup:card-media -- --help
npm test
npm run build
git diff --check
```

env-gated S3 endpoint가 제공되면 Stage 1 integration suite를 다시 실행하고, 제공되지 않으면 memory/fake-command failure suite와 skip 사실을 단계·최종 보고서에 기록한다.

### 커밋

```text
Task #42 Stage 5: failure·retention 검증과 public media 문서
```

## Stage 6 — PR 리뷰 public media 가용성 보완

### 산출물

수정:

- `src/profile-media/media-store-contract.js` — malformed object를 나타내는 `invalid` store error 분류
- `src/profile-media/s3/store.js` — `NoSuchBucket` unavailable 분리, default locale stable conditional GET의 1회 bounded retry
- `src/profile-media/__tests__/s3-store.test.js`, `s3-failure.test.js` — invalid metadata, 성공 retry와 반복 412 failure fixture
- `src/profile-backend/http.js`, `src/profile-backend/__tests__/http.test.js` — invalid/missing 404와 transient/unknown 503 분기
- `src/profile-media/publication-service.js`, 관련 test — `invalid` publication을 incomplete repair 대상으로 유지
- `docs/production-hosting.md`, `docs/readme-card.md` — public read recovery·status 계약 현행화
- `mydocs/report/task_m100_42_report.md` — Stage 6과 최종 수용 기준 결과 반영

### 변경 내용

- media store error는 `not_found`, `conflict`, `invalid`, `unavailable`로 구분한다. metadata/header/body가 publication contract를 만족하지 않는 object는 `invalid`, provider·timeout·credential·bucket 장애는 `unavailable`이다.
- public route는 stable 없음, referenced revision 없음/불일치, malformed card인 `not_found`/`conflict`/`invalid`를 owner-agnostic 404로 반환한다.
- `unavailable`과 예상 밖 adapter exception은 credential, endpoint, bucket, cause를 포함하지 않는 `media_unavailable` 503과 `Retry-After: 5`로 반환한다.
- default locale GET은 stable HEAD의 storage ETag를 `IfMatch`로 유지한다. HEAD→GET 사이 412 conflict가 발생하면 최신 publication HEAD부터 한 번만 다시 읽고, 두 번째 412는 `unavailable`로 정규화해 503으로 반환한다.
- `NoSuchBucket`은 object 부재가 아닌 backend availability 오류로 분류한다. `NoSuchKey`와 stable null만 publication 부재로 처리한다.
- review 발견 2의 cleanup 전수 재확인, 발견 3의 incomplete metadata fail-safe 중단, 발견 4의 metadata 호환 shape는 변경하지 않는다.

### 검증

```bash
node --test src/profile-media/__tests__/s3-store.test.js src/profile-media/__tests__/s3-failure.test.js
node --test src/profile-media/__tests__/publication-service.test.js
node --test src/profile-backend/__tests__/http.test.js
npm test
npm run build
git diff --check
```

### 커밋

```text
Task #42 Stage 6: public media 가용성 리뷰 반영
```

## 검증

- 각 Stage 검증 명령은 해당 단계 보고서 작성 전에 실행한다. 실패한 검증은 단계 완료로 처리하지 않는다.
- `node --test`와 `npm test`는 S3 test env 부재 시 명시적으로 skip하면서도 나머지 suite가 green이어야 한다.
- Stage 2 이후 기존 public/private UI response shape, Stage 3 이후 public URL/locale/cache contract, Stage 4 이후 CLI submit 성공·오류 contract를 매 단계 전체 회귀로 확인한다.
- credential 검사는 값뿐 아니라 env key가 frontend import graph와 client bundle에 포함되지 않는지도 확인한다.
- 계획과 다른 key, endpoint, 문서 위치, retention 값 또는 distributed failure 상태가 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 각 Stage 소스·문서와 `mydocs/working/task_m100_42_stage{N}.md`를 한 커밋으로 묶는다.
- 커밋 메시지는 `Task #42 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 구현계획서 자체는 승인 후 Stage 1 시작 전에 별도 `Task #42: 구현 계획서 작성` 커밋으로 고정한다.

## 단계 의존성

- Stage 2는 Stage 1의 contract v2 record/key와 S3 error mapping 확정 후 진행한다.
- Stage 3은 Stage 2의 stable metadata/publication service contract 확정 후 진행한다.
- Stage 4는 Stage 2 publish/refresh API와 Stage 3 public route 경계 확정 후 진행한다.
- Stage 5는 Stage 1~4의 adapter, orchestration, serving, runtime 계약 확정 후 failure matrix와 문서를 최종 고정한다.
- Stage 6은 PR #48 리뷰 승인에 따라 Stage 3의 public error status와 Stage 1 S3 conditional read를 함께 보완한다.
- 각 Stage 완료보고서 승인 없이 다음 Stage로 진행하지 않는다.

## 위험과 대응

- **transaction 중 외부 I/O로 connection 점유**: AWS client `maxAttempts`와 per-operation abort timeout, avatar timeout을 합쳐 30초 transaction idle 제한 안에 둔다. 실제 latency가 한계를 넘으면 Stage 2에서 구현계획 변경 승인을 요청한다.
- **CopyObject metadata 크기·호환성**: ASCII key/value와 짧은 digest만 저장하고 MinIO/R2-compatible integration에서 `MetadataDirective=REPLACE` round trip을 검증한다.
- **application ETag 조건부 읽기 비용**: storage ETag와 다르므로 HEAD가 추가될 수 있다. 먼저 정확성을 고정하고 Stage 3 검증에서 GET/HEAD command 수를 관찰하되 별도 cache/provider 기능은 범위에 추가하지 않는다.
- **structured commit 뒤 media 503 의미**: usage는 이미 durable하다. exact retry가 data conflict 없이 media를 복구하는 test와 CLI 안내를 함께 고정한다.
- **보상 동작도 실패하는 distributed failure**: 성공으로 숨기지 않고 generic partial-failure로 반환하며 stable/visibility 관측 상태와 안전한 retry를 failure test로 고정한다.
- **cleanup 오삭제**: default dry-run, 90일+최근 5개 guard, exact prefix, stable reference 재확인, 명시적 `--apply`를 모두 통과해야 삭제한다.
- **실제 R2 remote 미검증**: 동일 suite가 실제 endpoint를 받을 수 있게 하되 resource 생성은 하지 않는다. remote 결과는 #43과 최종 보고에서 별도 구분한다.
- **transient 404의 proxy cache 영향**: publication 부재·불완전 상태와 provider 장애를 분리하고, 412 read race는 한 번 재시도한 뒤 generic 503으로 반환한다.

## 승인 요청 사항

- 5 Stage 분할, contract v2 method/key/metadata, 각 Stage 산출물과 검증 명령을 승인한다.
- 기존 `PATCH /api/profile` 호환 facade, 공개 owner submit 후 동기 refresh와 `media_unavailable` 503/exact retry 계약을 승인한다.
- owner row transaction 안의 bounded R2 I/O로 mutation을 다중 인스턴스 직렬화하는 방식을 승인한다.
- 승인 시 구현계획서를 커밋한 뒤 Stage 1만 착수하고, Stage 1 완료보고서 승인 전에는 Stage 2로 진행하지 않는다.
- 2026-07-23 PR 리뷰 발견 1·5의 Stage 6 보완을 승인했으며 발견 2·3·4는 본 Stage에서 변경하지 않는다.
