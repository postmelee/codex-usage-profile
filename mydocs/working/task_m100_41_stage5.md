# 단계 보고서 — Task #41 Stage 5

GitHub Issue: [#41](https://github.com/postmelee/codex-usage-profile/issues/41)
구현계획서: [`task_m100_41_impl.md`](../plans/task_m100_41_impl.md)
Stage: 5 — concurrency·failure injection·secret·retention 문서

## 단계 목적

계획서에서 상한으로 고정한 **5개 atomic operation × {중복 소비, 부분 commit}** 매트릭스를 실 Postgres 병렬 요청·실패 주입으로 검증하고, secret 미저장·owner scope 격리를 test로 고정하며, retention/backup/PII 기본 정책을 공식 문서에 기록한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/__tests__/postgres-concurrency.test.js` | env-gated 13 subtest. 매트릭스 10건: OAuth callback(병렬 정확히 1회 소비+session 1건 / consume 실패 시 owner·session 미생성), CLI approve(병렬 1회 승인 / rollback), CLI exchange(병렬 token 정확히 1개 / exchanged mark 실패 시 **발급된 token까지 rollback**), usage submit(동일 capturedAt·다른 내용 병렬 → 1 accepted + 1 conflict, 패자의 device touch 미commit / usage 실패 시 device rollback), visibility(병렬 토글 후 owner·usage·snapshot 단일 revision 정합 / snapshot 실패 시 전체 rollback). 추가 3건: 실 flow 후 raw CLI token·device code·OAuth access token 전체 상태 스캔 부재+digest 존재 증명, schema token/secret/code 컬럼 allowlist 정확 일치, owner scope 격리(token/device/usage 교차 조회 불가) |
| `docs/production-hosting.md` | Structured Store Contract 절을 구현 상태로 갱신(adapter·FOR UPDATE·seeding 도구·lastUsedAt 경계 명문화), "Postgres/Neon adapter 값" 표 확정(`NEON_DATABASE_URL`/`DATABASE_URL`/`TEST_DATABASE_URL`, pool·SET LOCAL·migration 배포 단계 실행), startup 3항을 구현된 `verifyReadiness()` 기준으로 갱신, **신규 "Data Retention, Backup, PII 최소화" 절**(PII 한정 목록, raw secret 부재의 test 근거, latest-only 최소화, ISO text 기반 정리 쿼리 원칙, 계정 삭제 후속, backward-compat migration·Neon PITR은 #43 확정), 검증 상태에 로컬 검증 7항 추가·"설계만 확정됨" 정리(콜드스타트×card 리스크와 #42 해소 경로 명시), 후속 작업 1·2 완료 반영 |

## 본문 변경 정도 / 본문 무손실 여부

문서: `production-hosting.md`는 기존 구조·절 순서를 유지하고 구현으로 사실이 바뀐 문장만 교체했다. 계약 표(5연산 직렬화 키)는 원문 유지. 코드: 신규 test 파일만 추가, 제품 코드 무변경.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/postgres-concurrency.test.js   # TEST_DATABASE_URL
grep -rniE "access_token|refresh_token|raw.?token" src/profile-backend/postgres/
grep -rn "console\." src/profile-backend/postgres/                       # log inspection
npm test   # env 유무 각각
git diff --check
```

결과:

- OK — concurrency matrix **14/14 pass** (실 Postgres 17, 병렬 `Promise.allSettled` + `FOR UPDATE` 잠금 하 재판정)
- OK — source secret grep: adapter/pool/migrate에 raw token 관련 식별자 없음
- OK — log inspection: adapter·pool은 콘솔 출력 0건, migrate CLI는 version/개수만 출력(연결 문자열·레코드 내용 미출력)
- OK — env 없이 `npm test`: `325 tests / 321 pass / 4 skipped / 0 fail`
- OK — env 포함 `npm test`: `352 / 352 pass`
- OK — `git diff --check` 무경고

## 잔여 위험

- **README 2곳의 경미한 stale 문구**: "requires an injected external store adapter"(현재는 env 기반 adapter 자체 생성)와 Cloud Run POC 절의 "durable Neon/R2 boundary is intentionally deferred" 중 Neon 부분. 수행계획서의 문서 범위(`docs/production-hosting.md`)에 포함되지 않아 이번 단계에서 수정하지 않았다. 최종 보고 단계에서 1~2문장 수정을 승인받아 반영하거나 후속으로 남긴다.
- **원격 Neon 실측 미실시**: 로컬 Docker Postgres 검증이며 실제 Neon project 연결·콜드스타트 실측은 #43 배포 task 범위다(문서에 명시).

## 다음 단계 영향

- 모든 Stage(1~5)가 완료되어 최종 보고서·PR 게시 단계만 남았다. 검증용 컨테이너 `cup-task41-pg`는 최종 정리 시 중지한다(`--rm`이라 중지 시 소멸).

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 task-final-report 절차(최종 보고서, 오늘할일 완료 처리, publish/task41 push, PR 생성)로 진행한다. README stale 문구 2곳의 동시 수정 여부도 함께 지시 바란다.
