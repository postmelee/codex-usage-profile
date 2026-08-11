# Task #83 Stage 3 보고서 — owner-only Sites candidate와 전체 smoke

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 3

## 단계 목적

Stage 2 exact candidate를 owner-only Sites production에 배포하고 hosted D1 migration `1..5`, maintenance 복원, OAuth·CLI·private preview·settings·README/social media publish/unpublish 계약을 disposable 범위에서 검증한다. 원격 hosted schema가 물리적으로 migration `1..5` 상태지만 application metadata가 비어 있는 실제 조건을 fail-closed로 식별·보정하고, 실패와 성공 모두 owner-only·normal·maintenance disabled/secret-absent baseline으로 복원한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/sites-profile-maintenance.mjs` | identity-less `migrate` command와 bounded response 검증을 추가했다. |
| `scripts/__tests__/sites-profile-maintenance.test.js` | migrate option·payload·safe output·failure 계약을 검증한다. |
| `src/profile-backend/d1/migration-runner.js` | exact migration 단위의 bounded apply progress를 제공한다. |
| `src/profile-backend/__tests__/d1-migrate.test.js` | migration runner progress와 failure 경계를 검증한다. |
| `src/profile-runtime/sites/maintenance.js` | hosted base schema exact-match, metadata-only reconciliation, partial/drift fail-closed와 idempotent migrate를 구현했다. |
| `src/profile-runtime/sites/worker-entry.js`, `src/profile-runtime/sites/worker.js` | maintenance dependency와 operator route를 production Worker 경계에 연결했다. |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | missing metadata, hosted exact schema, partial/drift, idempotent apply와 bounded error를 검증한다. |
| `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js` | real-workerd hosted schema fixture를 application metadata와 분리했다. |
| `scripts/smoke-sites-fullstack-local.mjs` | physical migration `1..5`·metadata 0 hosted 조건과 migrate/readiness를 local full-stack smoke에 추가했다. |
| `docs/sites-operations.md` | maintenance migrate 실행·중단·metadata reconciliation 운영 경계를 갱신했다. |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Stage 3 보정 이력과 owner-only HTML `307 /` 경계, Stage 4 HTML metadata handoff를 기록했다. |
| `mydocs/working/task_m100_83_stage3.md` | Stage 3 구현·원격 검증·정리 결과를 기록한다. |
| `mydocs/orders/20260809.md` | #83을 Stage 3 완료·Stage 4 Gate B 승인 대기로 표시한다. |

## 본문 변경 정도 / 본문 무손실 여부

공개 UI, public API, OAuth·CLI payload, card/social URL과 정상 서비스의 사용자 계약은 변경하지 않았다. 새 원격 mutation은 maintenance mode, service maintenance, exact operator secret과 same-origin JSON이 모두 일치할 때만 도달하는 숨김 operator route에 한정했다. arbitrary SQL, owner/data selector, schema downgrade와 unexpected migration 적용은 허용하지 않는다.

hosted 보정은 명시적 migration 1·2 table/index DDL을 `sqlite_master`와 exact-normalized 비교하고 migration 3~5의 승인된 additive column fragment만 제외한다. exact physical schema일 때만 application `schema_migrations`를 metadata-only로 reconcile하며 partial schema와 drift는 mutation 전에 중단한다.

공식 운영 문서는 기존 구조를 보존하고 새 operator command, exact precondition, 즉시 owner-only 원복 절차만 최소 갱신했다. owner-only Sites platform이 profile HTML deep link를 애플리케이션에 전달하지 않고 `/`로 `307` 전환하는 것은 application source가 아닌 platform gate 동작이다. 작업지시자가 승인한 계획 보정에 따라 canonical/OG/Twitter와 private/missing HTML fallback의 원격 실측을 Stage 4 Gate B 필수 항목으로 이동했다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run sites:profile-maintenance -- migrate \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- readiness \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
git diff --check
```

결과:

- OK — 전체 test 705개 중 699개가 통과했고 환경 설정이 없는 Postgres/S3 연동 6개만 스킵됐으며 실패는 0개다.
- OK — Playwright E2E 64개가 모두 통과했다. 최초 sandbox 실행은 loopback bind `EPERM`으로 중단하고 동일 명령을 loopback 허용 상태에서 처음부터 재실행했다.
- OK — production build가 `manifestRemoved=true`, `preservedEntryCount=0`으로 완료됐다.
- OK — full-stack verifier는 client file 7개, Worker file 2개, migration 5개, Worker raw 3,991,288 bytes와 gzip 2,164,256 bytes를 확인했다.
- OK — production verifier는 artifact 4,886,934 bytes, exact binding 3개, migration 5개와 credential/local-path 비노출 계약을 확인했다.
- OK — source correction commit `c243ada98652be23055eaee01d85e1ddd3adfdf2`에서 만든 Sites archive와 saved version 14가 동일 source를 가리키고 private deployment가 성공했다.
- OK — 첫 migrate는 `appliedVersions=[1,2,3,4,5]`, `newlyAppliedVersions=[1,2,3,4,5]`; 반복 migrate는 `newlyAppliedVersions=[]`; readiness는 `appliedVersions == expectedVersions == [1,2,3,4,5]`, `ready=true`였다.
- OK — maintenance bridge와 CLI bridge는 사용 직후 owner-only로 닫았다. 최종 access는 custom owner-only, 허용 사용자 1명, group 0개, external visitor 0명이다.
- OK — 최종 environment는 service `normal`, maintenance `disabled`, operator secret absent이며 익명 `/healthz`는 Sites platform에서 `401`이다.
- OK — disposable GitHub 계정의 OAuth/session/logout, packed CLI login/approve/exchange/submit/status와 server token revoke·local credential logout이 통과했다. 프로필은 private이고 active token은 0개다.
- OK — private owner preview와 settings device rename이 통과했다. Gate B 재현용 최소 device·usage state만 남기고 공개 media와 session/token은 정리했다.
- OK — publish 상태에서 README PNG dark/light × en/ko와 social PNG가 각각 GET `200`, HEAD `200`, If-None-Match `304`, matching ETag와 `public, no-cache, must-revalidate`를 반환했다.
- OK — unpublish 뒤 README PNG 4변형과 social PNG, missing handle media가 모두 동일 JSON `404`를 반환했다.
- OK — owner-authenticated Chrome·in-app browser와 protected request 모두 `/u/{handle}` HTML을 `/`로 `307` 전환했다. 승인된 계획 보정에 따라 공개 canonical/OG/Twitter·private/missing HTML fallback exact 검증을 Stage 4로 넘겼다.
- OK — application structured observability event는 route class, method, bounded status/error/duration만 포함하고 credential, token, device code와 usage body를 포함하지 않았다. provider access wrapper에는 표준 request URL이 남으므로 보고서에는 handle/query를 기록하지 않았다.

## 잔여 위험

- canonical, `og:url`, `og:image?v=`, Twitter metadata와 private/missing HTML fallback은 owner-only Sites gate에서 측정할 수 없다. Stage 4 Gate B public access 직후 첫 필수 계약으로 확인하고 실패하면 즉시 owner-only로 원복한다.
- external cache의 `CF-Cache-Status`, `Age`, `x-request-id`와 submit 직후 HTML revision 신선도는 Stage 4에서만 관찰할 수 있다.
- provider access wrapper는 application의 bounded observability와 별개로 요청 URL을 인프라 metadata에 포함한다. Stage 4에서도 application log 비노출과 provider wrapper를 분리해 판단하고 credential·private usage가 포함되면 release blocker로 처리한다.
- disposable owner·usage·device 최소 상태는 Gate B 재현을 위해 남아 있다. Stage 4 종료 시 token/session뿐 아니라 disposable D1/R2 state도 exact cleanup한다.

## 다음 단계 영향

- Stage 4는 별도 Gate B 승인 전 public access를 변경하지 않는다.
- Gate B 입력에는 현재 owner-only policy, normal/maintenance disabled/secret-absent baseline, fresh one-time token/session, exact public URL과 성공·실패 공통 원복 순서를 포함한다.
- public 전환 직후 private/missing HTML fallback과 canonical/OG/Twitter exact origin을 먼저 확인한 뒤 반복 cache/revision 측정으로 진행한다.
- Stage 4 결과는 영구 public cutover가 아니라 owner-only baseline으로 복원한 뒤 후속 릴리스 #84에 넘긴다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 Gate B용 read-only snapshot과 공개·원복 입력을 제시한다.
- 별도 Gate B 승인 전에는 access를 public으로 변경하지 않는다.
