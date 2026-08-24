# Task #119 구현계획서 — Sites 계정 삭제 timeout 이후 멱등 재개

- 수행계획서: [`task_m100_119.md`](task_m100_119.md)
- GitHub Issue: [#119](https://github.com/postmelee/codex-usage-profile/issues/119)
- 마일스톤: M100 — v1.0 MVP
- 상태: 구현 승인 대기

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 지속 삭제 operation과 lease 기반 | D1 migration 6, operation 저장·획득·phase 전이, idempotent quiesce | D1 migration·maintenance test |
| 2 | bounded R2 batch와 Sites 단계 전이 | revision batch 삭제, safe progress, lease 직렬화 | R2·Sites maintenance test |
| 3 | CLI 직렬 재개와 불확정 결과 회복 | delete loop, plan reconcile, bounded progress output | operator CLI·worker integration test |
| 4 | packaging·운영 문서·통합 검증 | migration allowlist, Sites artifact/smoke, 운영 절차 | 전체 maintenance·Sites packaging·public scan |

## 승인된 불변식

### 데이터 안전

- exact `ownerId`·`handle`, 최초 `expectedContentDigest`·`expectedObjectCount` 승인 없이 operation을 만들지 않는다.
- stable publication이 살아 있거나 tombstone storage ETag가 바뀌면 revision을 삭제하지 않는다.
- immutable revision은 plan에서 읽은 storage ETag와 삭제 직전 HEAD가 다르면 삭제하지 않는다.
- R2 revision이 하나라도 남아 있으면 D1 owner와 durable profile을 삭제하지 않는다.
- tombstone stable object는 기존 계약대로 유지하며 retention/orphan 정책을 이 task에서 바꾸지 않는다.
- 계정 삭제 operation은 account owner와 함께 제거되고 별도 장기 PII 기록으로 남지 않는다.

### 재개와 동시성

- 최초 승인 digest/count는 operation에 고정한다. 부분 삭제로 현재 plan digest/count가 바뀌어도 같은 operation의 원래 승인을 임의 교체하지 않는다.
- 한 owner에는 하나의 active deletion operation만 존재한다.
- 한 시점에는 lease를 소유한 요청 하나만 mutation을 수행한다.
- 정상 반환과 알려진 오류에서는 lease를 해제하고, worker 중단처럼 해제할 수 없는 경우에는 TTL 만료 뒤 같은 operation이 회수한다.
- checkpoint 전에 worker가 중단돼도 다음 호출은 실제 R2 manifest를 다시 읽어 이미 사라진 key를 자연스럽게 제외한다.
- 다른 operation ID, 다른 최초 digest/count 또는 다른 handle의 재개 요청은 `maintenance_conflict`로 fail closed한다.

### 응답과 비밀 경계

- 기존 maintenance `summary`의 contractVersion, schemaVersion, digest, count, operation 필드는 유지한다.
- 계정 삭제와 plan에만 별도 `progress` 객체를 추가한다.
- progress에는 operation ID, status, phase, 이번 batch 삭제 수, 남은 revision 수와 bounded retry 정보만 둔다.
- owner ID, handle, lease nonce, credential, R2 key/ETag, D1 row 내용과 provider 오류 원문은 progress·로그·CLI 출력에 넣지 않는다.
- 기존 plan/export/restore/retention, backup schema와 readiness 응답은 변경하지 않는다.

## 상세 계약

### D1 migration 6

`db/migrations/0006_account_deletion_operations.sql`에 다음 의미의 additive table을 만든다.

| Column | 계약 |
|---|---|
| `owner_id` | primary key, `owners(id) ON DELETE CASCADE` |
| `handle` | operation 시작 시 exact handle |
| `operation_id` | opaque unique identifier |
| `approved_content_digest` | 최초 combined plan digest |
| `approved_object_count` | 최초 combined plan object count, non-negative |
| `phase` | `prepare\|media\|structured` |
| `lease_nonce` | server-only lease holder, nullable |
| `lease_expires_at` | lease와 함께 null/non-null이 되는 UTC timestamp |
| `created_at`, `updated_at` | bounded ISO timestamp |

- operation 완료 시 D1 owner delete의 cascade로 row도 제거한다.
- 이전 saved version은 이 additive table을 사용하지 않으므로 기존 login/submit/read 경로가 동작한다.
- Sites hosted migration reconciliation은 migration 6 table이 physical schema에 이미 존재하지만 metadata만 없을 때 exact DDL 일치 여부를 확인한 뒤 metadata-only로 수렴한다. partial/drift schema는 mutation 전에 conflict로 닫는다.
- readiness exact version은 `[1,2,3,4,5,6]`으로 올린다.

### D1 maintenance API

- `getOwnerDeletionOperation(scope)`: active operation의 safe 내부 record 또는 null을 반환한다.
- `beginOwnerDeletionOperation(scope, approval)`: owner/handle과 최초 digest/count를 확인해 operation을 한 번만 생성한다.
- `acquireOwnerDeletionLease(scope, operationId)`: 120초 TTL의 nonce를 원자적으로 획득한다. 살아 있는 다른 lease는 retryable conflict다.
- `advanceOwnerDeletionPhase(scope, operationId, leaseNonce, phase)`: lease 소유자만 `prepare → media → structured` 순서로 전이한다.
- `releaseOwnerDeletionLease(scope, operationId, leaseNonce)`: 같은 nonce만 해제한다.
- `quiesceOwner(scope)`: owner·latest usage·snapshot이 이미 private이면 `updated_at`을 다시 바꾸지 않는 실제 멱등 동작으로 보정한다.
- operation row는 일반 owner deletion plan의 object count에 포함하지 않아 기존 최초 승인 count 의미를 보존한다.

### R2 batch 계약

- 기존 전량 순차 삭제 대신 `deleteOwnerRevisionBatch`를 사용한다.
- 기본 batch는 revision 8개이며 테스트에서만 1~32 범위로 주입할 수 있다.
- batch 시작 시 current media plan digest/count를 exact 확인한다.
- 각 key 삭제 직전에 stable tombstone과 storage ETag를 다시 확인한다.
- 삭제 후 HEAD가 남아 있으면 unavailable, ETag/stable 변경은 conflict로 닫는다.
- 반환값은 이번 batch 실제 삭제 수, post-delete plan과 남은 revision 수다.
- 재호출 시 실제 manifest를 새 plan으로 사용하므로 이전 호출에서 이미 삭제된 key를 다시 요구하지 않는다.

### Sites 삭제 phase

1. active operation이 없으면 current combined plan과 최초 승인값을 확인하고 operation을 생성한다.
2. active operation이 있으면 operation ID 또는 같은 최초 승인값으로 동일 작업임을 확인한다.
3. lease를 획득한다. 다른 요청이 보유 중이면 mutation 없이 retryable conflict를 반환한다.
4. `prepare`에서 publication을 tombstone하고 D1을 private로 quiesce한 뒤 `media`로 전이한다.
5. `media`에서 R2 batch 하나만 처리한다.
   - revision이 남으면 lease를 해제하고 `in_progress/media`를 반환한다.
   - revision이 0이면 `structured`로 전이한다.
6. `structured`에서 current D1 plan을 exact 확인한 뒤 owner를 삭제한다.
7. owner cascade로 operation row가 제거되면 `completed` 응답을 반환한다.
8. 최종 응답을 잃은 뒤 plan이 `not_found`이면 이미 승인된 operation의 완료로 reconciliation할 수 있다.

### Safe progress

계정 삭제 관련 응답의 `progress`는 다음 의미를 갖는다.

- `contractVersion: 1`
- `status: "in_progress" | "completed"`
- `phase: "prepare" | "media" | "structured" | "completed"`
- `operationId`: opaque ID
- `deletedRevisionCount`: 이번 요청에서 삭제한 revision 수
- `remainingRevisionCount`: 응답 시점 실제 R2 manifest의 revision 수
- `retryAfterSeconds`: active lease가 있을 때만 bounded 정수
- `expectedContentDigest`, `expectedObjectCount`: manual resume가 필요한 active plan에서 최초 승인값

exact key allowlist로 정규화하며 이 밖 필드는 응답과 CLI에서 거부한다.

### CLI 재개

- `delete-account`에 optional `--operation-id`를 추가한다.
- initial apply가 `in_progress`이면 같은 operation ID와 최초 digest/count로 다음 batch를 직렬 호출한다.
- 각 응답의 남은 revision 수가 감소하거나 phase가 전진해야 한다. 단조 진행이 없는 상태를 무한 반복하지 않는다.
- `maintenance_in_progress` 또는 apply 결과가 `network_unavailable`이면 새 apply를 즉시 겹쳐 보내지 않고 read-only plan으로 active operation을 확인한다.
- plan의 operation ID와 최초 승인값이 일치하면 Retry-After를 존중해 재개한다.
- apply를 보낸 뒤 owner plan이 `not_found`이면 최종 D1 delete가 완료된 것으로 안전하게 reconcile한다.
- active operation이 없고 original plan이 그대로면 초기 apply를 한 번 재시도할 수 있다.
- 출력은 safe progress JSON line과 마지막 completed summary로 한정하고 secret, scope identity와 provider message를 포함하지 않는다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/sites-operations.md` | `docs/` | Stage 4 `docs/sites-operations.md` | OK | operator 실행·timeout 재개·conflict·원복 절차 |
| `docs/production-hosting.md` | `docs/` | Stage 4 `docs/production-hosting.md` | OK | migration 6, deletion lifecycle과 rollback 호환성 |
| 계획·단계·최종 보고 | `mydocs/` | 규정된 plans/working/report 경로 | OK | 특정 이슈 승인·검증 기록 |

## Stage 1 — 지속 삭제 operation과 lease 기반

### 산출물

신규:

- `db/migrations/0006_account_deletion_operations.sql`
- `mydocs/working/task_m100_119_stage1.md`

수정:

- `src/profile-backend/d1/migration-manifest.js`
- `src/profile-backend/d1/maintenance.js`
- `src/profile-backend/__tests__/d1-maintenance.test.js`
- `src/profile-backend/__tests__/d1-migration-contract.test.js`
- `src/profile-runtime/sites/maintenance.js`의 hosted migration 6 reconciliation 기반
- `src/profile-runtime/sites/__tests__/maintenance.test.js`의 migration fixture
- `mydocs/orders/20260824.md`

### 변경 내용

- migration 6 exact table·constraint·cascade를 추가하고 manifest를 1..6으로 확장한다.
- hosted physical table/metadata-only reconciliation이 exact migration 6 DDL만 허용하도록 한다.
- D1 maintenance에 operation create/read, lease acquire/release, phase advance를 추가한다.
- lease는 operation ID·owner scope·nonce·TTL을 모두 확인하며 stale lease만 회수한다.
- `quiesceOwner`의 이미-private 재호출이 owner timestamp와 digest를 바꾸지 않게 한다.
- migration gap/drift, duplicate operation, mismatched approval, live lease, expired lease takeover를 테스트한다.
- 제품 문서와 R2/Sites deletion orchestration은 이 Stage에서 바꾸지 않는다.

### 검증

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
git diff --check
```

### 커밋

```text
Task #119 Stage 1: 계정 삭제 operation과 lease 기반 구축
```

## Stage 2 — bounded R2 batch와 Sites 단계 전이

### 산출물

신규:

- `mydocs/working/task_m100_119_stage2.md`

수정:

- `src/profile-media/r2-binding/maintenance.js`
- `src/profile-media/__tests__/r2-binding-maintenance.test.js`
- `src/profile-runtime/sites/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `mydocs/orders/20260824.md`

### 변경 내용

- R2 owner revision 삭제를 default 8개 bounded batch로 분리하고 post-delete manifest를 반환한다.
- 중간 오류 뒤 실제 manifest로 재계획해 다음 호출이 남은 key부터 이어지는 테스트를 추가한다.
- stable republish, stable ETag 변경, immutable revision 변경, delete 후 잔존을 기존처럼 fail closed한다.
- Sites service가 operation 생성/lease/phase와 tombstone·quiesce·R2 batch·D1 delete를 조합한다.
- 한 호출이 한 batch만 처리하고 `in_progress` 또는 `completed` safe progress를 반환한다.
- lease 경합, worker 중단 모사, partial media 상태, 마지막 batch 후 structured delete 순서를 검증한다.
- active operation의 최초 승인값이 현재 부분 plan 변화와 분리되어 유지되는지 검증한다.

### 검증

```bash
node --test \
  src/profile-media/__tests__/r2-binding-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  src/profile-backend/__tests__/d1-maintenance.test.js
git diff --check
```

### 커밋

```text
Task #119 Stage 2: R2 batch 삭제와 Sites 단계 재개 구현
```

## Stage 3 — CLI 직렬 재개와 불확정 결과 회복

### 산출물

신규:

- `mydocs/working/task_m100_119_stage3.md`

수정:

- `scripts/sites-profile-maintenance.mjs`
- `scripts/__tests__/sites-profile-maintenance.test.js`
- `src/profile-runtime/sites/maintenance.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `mydocs/orders/20260824.md`

### 변경 내용

- safe progress 정규화와 `--operation-id` 입력 검증을 추가한다.
- delete-account만 bounded serial loop를 사용하고 다른 maintenance 명령의 단일 요청 계약은 유지한다.
- batch 진행, live lease polling, network 불확정 뒤 plan reconciliation, final not-found 완료 판정을 구현한다.
- operation ID·최초 승인값 불일치, 진행 정체, 최대 반복 초과는 mutation을 더 보내지 않고 bounded 오류로 닫는다.
- CLI request/response/output에서 token, scope identity, R2 key/ETag와 provider 오류가 노출되지 않는지 검증한다.
- worker handler가 retryable busy 응답과 Retry-After를 안전하게 제공하고 기존 generic error 경계를 유지한다.

### 검증

```bash
node --test \
  scripts/__tests__/sites-profile-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  src/profile-media/__tests__/r2-binding-maintenance.test.js
git diff --check
```

### 커밋

```text
Task #119 Stage 3: operator CLI의 직렬 삭제 재개 보강
```

## Stage 4 — packaging·운영 문서·통합 검증

### 산출물

신규:

- `mydocs/working/task_m100_119_stage4.md`

수정:

- `scripts/smoke-sites-fullstack-local.mjs`
- `scripts/verify-sites-production-artifact.mjs`
- `scripts/__tests__/verify-sites-fullstack-artifact.test.js`
- `scripts/__tests__/verify-sites-production-artifact.test.js`
- migration 1..6을 exact 기대하는 나머지 테스트 fixture
- `docs/sites-operations.md`
- `docs/production-hosting.md`
- `mydocs/orders/20260824.md`

### 변경 내용

- Sites full-stack/production artifact가 migration 6을 누락·중복·순서 변경 없이 포함하도록 allowlist와 fixture를 갱신한다.
- local full-stack smoke의 migrate/readiness 기대값을 1..6으로 올린다.
- 운영 문서에 bounded batch, active operation 확인, network 불확정 reconciliation, lease timeout, conflict 시 중단·원복 절차를 추가한다.
- 역사적 실제 readiness 1..5 기록은 당시 관찰값으로 유지하고, 신규 candidate/target 계약만 1..6으로 구분한다.
- `origin/devel...HEAD` diff를 감사해 Task #119 source·tests·운영 문서·작업 산출물만 포함됐는지 확인한다.
- 실제 Stage5 data 삭제·remote deployment·maintenance environment mutation은 수행하지 않는다.

### 검증

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-media/__tests__/r2-binding-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js \
  scripts/__tests__/verify-sites-fullstack-artifact.test.js \
  scripts/__tests__/verify-sites-production-artifact.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
npm run scan:public-release
npm test
git diff --check origin/devel...HEAD
git status --short
```

### 커밋

```text
Task #119 Stage 4: migration·운영 문서와 통합 검증 정합화
```

## 검증

- 각 Stage 명령은 `task-stage-report` 실행 전에 수행하고 실패 상태에서는 보고서·커밋을 만들지 않는다.
- timeout 테스트는 실제 sleep 대신 injected boundary/fake fetch로 결정적으로 재현한다.
- concurrency 테스트는 두 요청이 같은 owner operation을 동시에 획득하려는 순서를 fixture hook으로 제어한다.
- R2 partial test는 삭제된 key와 남은 key를 명시적으로 확인하고 ETag guard를 느슨하게 만들지 않는다.
- CLI network uncertainty test는 첫 apply의 결과를 잃은 뒤 plan만 조회하며 두 번째 apply가 lease 해제 전 전송되지 않음을 검증한다.
- migration 6 test는 clean apply, metadata-only reconcile, partial physical schema, DDL drift, unknown version을 모두 구분한다.
- packaging 검증은 migration 6 filename뿐 아니라 manifest 순서와 archive 포함 여부를 확인한다.
- 계획과 다른 schema·progress field·공식 문서 위치가 필요하면 구현계획서를 먼저 보정하고 승인을 받는다.

## 커밋

- 단계 source, 해당 단계 보고서와 오늘할일 갱신을 하나의 커밋으로 묶는다.
- 커밋 메시지는 `Task #119 Stage {N}: {핵심 내용}` 형식을 따른다.
- 최종 보고서는 Stage 4 승인 뒤 `task-final-report` 절차에서 별도 커밋한다.
- `local/task119`은 로컬에만 유지하고 PR 게시 시 `publish/task119`로 push한다.

## 단계 의존성

- Stage 2는 Stage 1의 migration·operation·lease API가 승인된 뒤 시작한다.
- Stage 3은 Stage 2의 safe progress와 bounded batch 결과를 소비한다.
- Stage 4는 Stage 1~3의 source/test 계약이 모두 승인된 뒤 artifact·문서를 갱신한다.
- 각 Stage 사이에 `task-stage-report`로 검증·보고·커밋하고 다음 Stage 승인을 요청한다.
- Task #119 merge·release·stage5 배포 뒤에만 Task #108 Gate E의 실제 잔여 삭제를 재개한다.

## 위험과 대응

- **lease 만료 중 장기 R2 호출**: batch를 8개로 제한하고 TTL을 120초로 둔다. live lease가 있으면 다른 요청은 mutation 전에 중단한다.
- **최초 digest와 부분 plan 차이**: operation이 최초 승인을 보존하고 각 R2 batch는 별도의 current media digest를 다시 확인한다.
- **최종 응답 유실**: apply 이후 plan `not_found`만 완료 reconciliation로 인정한다. apply 전 일반 not-found와 구분한다.
- **operation row의 PII 잔존**: owner foreign key cascade로 최종 삭제와 함께 제거하고 별도 완료 ledger를 만들지 않는다.
- **이전 saved version rollback**: migration 6은 additive table이며 기존 application 경로가 참조하지 않는다. 새 삭제 operation 실행 중 application rollback은 금지하고 maintenance를 닫은 뒤 상태를 점검한다.
- **hosted migration metadata drift**: migration 6 table exact DDL 검증을 통과한 경우에만 metadata-only reconcile하며 partial/drift는 자동 보정하지 않는다.
- **CLI 무한 반복**: operation ID, phase, remaining count의 단조 진행과 bounded iteration/poll 제한을 함께 검사한다.
- **Stage5와 source 작업 혼합**: 이 task에서는 remote mutation을 수행하지 않고 live retry는 Task #108으로 넘긴다.

## 승인 요청 사항

- migration 6의 owner-scoped operation/lease schema와 owner cascade
- phase `prepare → media → structured → completed`, R2 default batch 8, lease TTL 120초
- 기존 summary를 유지하고 계정 삭제에만 safe progress를 추가하는 응답 호환성
- CLI의 serial batch loop, plan reconciliation과 optional `--operation-id`
- 위 4개 Stage 산출물·검증·커밋 경계
- Stage5 실제 삭제·배포를 Task #119에서 제외하는 원격 변경 경계

승인되면 Stage 1만 구현하고 검증 통과 후 `task-stage-report` 절차로 보고·커밋한 뒤 Stage 2 승인을 요청한다.
