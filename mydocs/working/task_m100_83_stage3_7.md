# Task #83 Stage 3.7 보고서 — Sites 호환 공유 문서 경로 보정

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 3.7

## 단계 목적

Stage 4 Gate B 1차 실측에서 extension 없는 `/u/{handle}` 공개 HTML이 application Worker에 도달하지 않고 Sites front door에서 `/`로 전환되는 blocker를 해소한다. 실제 Sites가 Worker로 전달하는 `/?profile={handle}`을 canonical 공유 문서로 사용하고, README·social media 경로는 기존 계약을 유지한다. Share Studio, OAuth 복귀, owner-only stop과 GET/HEAD initial HTML이 같은 query 계약을 따르도록 보정하되 Gate C 전 production CTA와 public access는 활성화하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/public-profile-document.js` | root의 exact `profile` query를 문서 요청으로 인식하고 path 하위 호환, invalid/duplicate query 거부, resolver의 최소 image revision projection을 처리한다. |
| `src/profile-runtime/open-graph.js` | canonical HTML은 `/?profile={handle}`, social image는 `/u/{handle}/social.png?v=`로 독립 생성한다. |
| `src/profile-runtime/sites/backend.js`, `src/profile-runtime/sites/worker.js` | owner-only query 문서를 public route로 닫고 HEAD에서도 index HTML을 읽어 metadata header를 생성한다. |
| `src/profile-ui/shareStudio.js` | 복사 및 외부 공유 대상 URL을 query canonical로 변경한다. |
| `src/profile-runtime/__tests__/public-profile-document.test.js`, `src/profile-runtime/__tests__/open-graph.test.js` | query 판별, canonical/media 분리, public/fallback, GET/HEAD와 최소 store resolver summary를 검증한다. |
| `src/profile-runtime/sites/__tests__/backend.test.js`, `src/profile-runtime/sites/__tests__/full-stack.test.js` | owner-only stop과 real full-stack route 수를 새 query 계약에 맞춘다. |
| `src/profile-ui/__tests__/shareStudio.test.js`, `src/profile-ui/__tests__/accountUi.test.js`, `tests/profile-ui.spec.js` | Share Studio URL과 OAuth current-location query 보존, browser 공유 동작을 검증한다. |
| `scripts/smoke-sites-fullstack-local.mjs` | real Worker·D1·R2·ASSETS 공개 상태에서 query GET/HEAD, canonical, `og:url`, revisioned social image를 검증한다. |
| `README.md`, `docs/sites-operations.md`, `docs/production-hosting.md`, `docs/readme-card.md` | 사용자 공유 URL, 운영 smoke와 media URL 분리를 query canonical 기준으로 정합화한다. |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Gate B 1차 실패·즉시 복원, Stage 3.7 설계·검증·커밋·다음 Gate 조건을 기록한다. |
| `mydocs/working/task_m100_83_stage3_7.md` | Stage 3.7 구현·검증·잔여 원격 Gate를 기록한다. |
| `mydocs/orders/20260809.md` | #83을 Stage 3.7 로컬 완료·owner-only 재배포 승인 대기로 표시한다. |

## 본문 변경 정도 / 본문 무손실 여부

README card `/u/{handle}/card.png`, social image `/u/{handle}/social.png`, API, R2 key, ETag와 publish/unpublish 계약은 보존했다. Node/dev runtime의 기존 `/u/{handle}` HTML 처리도 하위 호환으로 남겼다. 변경 범위는 Sites용 canonical 공유 문서 URL과 그 URL을 만드는 UI·metadata·운영 문서에 한정한다.

private 또는 missing handle은 동일한 기본 metadata를 반환하고, owner-only mode에서는 query 공유 문서도 다른 public profile surface와 같은 `404`로 닫힌다. 공개 resolver 실패는 신원 정보를 드러내지 않는 기본 문서로 폴백한다.

공식 문서는 기존 구조를 유지하면서 실제 Gate B에서 관찰한 front-door 한계와 query canonical만 최소 수정했다. 현재 production 기능과 다음 배포 후보를 구분했고, 다음 배포·public smoke 전 README placeholder와 마케팅 CTA는 활성화하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-runtime/__tests__/public-profile-document.test.js \
  src/profile-runtime/__tests__/public-profile-resolver.test.js \
  src/profile-runtime/__tests__/open-graph.test.js \
  src/profile-runtime/sites/__tests__/backend.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/accountUi.test.js
npm test -- --test-concurrency=1
npm run test:e2e
npm run smoke:sites-fullstack:local
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- OK — focused Node test 54개가 모두 통과했다.
- OK — 전체 Node test 708개 중 702개가 통과했고 환경 설정이 없는 Postgres/S3 연동 6개만 스킵됐으며 실패는 0개다.
- OK — Playwright E2E 64개가 모두 통과했다. 최초 sandbox 실행의 loopback bind `EPERM`은 환경 제약으로 분류하고 동일 명령을 loopback 허용 상태에서 처음부터 재실행했다.
- OK — real Worker·D1·R2·ASSETS full-stack smoke 44개 경로가 통과했다. 공개 query GET은 handle별 canonical·`og:url`·revisioned social image를 포함했고 HEAD는 body 없이 동일 HTML content type을 반환했다.
- OK — production build가 `manifestRemoved=true`, `preservedEntryCount=0`으로 완료됐다.
- OK — full-stack verifier는 client file 7개, Worker file 2개, migration 5개, Worker raw 3,992,308 bytes와 gzip 2,164,408 bytes를 확인했다.
- OK — production verifier는 artifact 4,887,960 bytes, exact binding 3개, migration 5개와 credential/local-path 비노출 계약을 확인했다.
- OK — `git diff --check`가 경고 없이 통과했다.
- OK — Gate B 1차 실패 직후 원격은 custom owner-only, service `normal`, maintenance disabled, operator secret absent로 복원된 상태를 유지한다. 이 Stage에서 새 배포, public access, OAuth·CLI·profile mutation은 수행하지 않았다.

## 잔여 위험

- 새 source는 아직 owner-only saved version으로 배포하지 않았다. 작업지시자 승인 뒤 exact Stage 3.7 commit으로 배포하고 protected `/?profile={handle}` HTML, source provenance, migration `1..5` readiness와 safe baseline을 재확인해야 한다.
- 실제 public front door의 query GET/HEAD, private/missing 폴백, external cache header와 submit 직후 `og:image?v=` 신선도는 별도 Gate B에서만 실측할 수 있다.
- provider access wrapper는 application의 bounded event와 별개로 요청 URL을 infrastructure metadata에 남긴다. Gate B 증적은 credential·identity·usage body를 기록하지 않고 bounded header/status만 사용한다.

## 다음 단계 영향

- 이 보고서와 source를 한 커밋으로 고정한 뒤, 별도 승인된 owner-only 재배포에서 saved version source와 commit을 exact-match한다.
- owner-only protected query HTML과 readiness가 통과해도 public access는 변경하지 않는다. 결과를 제시하고 별도 Gate B 재승인을 받아야 Stage 4를 다시 시작할 수 있다.
- Stage 4는 query canonical을 먼저 검증하고 실패 시 즉시 owner-only로 복원한다. 성공해도 cache/revision 실측과 disposable cleanup 뒤 owner-only baseline으로 종료한다.

## 승인 요청

- Stage 3.7 산출물과 로컬 검증 결과를 승인하면 exact commit의 새 owner-only saved version 배포와 protected query/readiness 검증을 진행한다.
- owner-only 검증 뒤에도 별도 Gate B 승인 전에는 access를 public으로 변경하지 않는다.
