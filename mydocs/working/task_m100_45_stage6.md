# Task #45 Stage 6 보고서 — release QA 판정과 final state 검증

GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
구현계획서: [`task_m100_45_impl.md`](../plans/task_m100_45_impl.md)
Stage: 6

## 단계 목적

Stage 1의 local, immutable npm release와 Sites production baseline을 전체
재검증한다. Task #45 전체 흐름과 exact cleanup 뒤 production이 public
safe baseline으로 종료됐는지 확인하고, 실제 운영 계약과 다른 공식 문서만
최소 보정한 뒤 M100 공개·홍보를 `PASS` 또는 `BLOCKED`로 판정한다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `docs/sites-operations.md` | access/environment revision, operator secret 부재, disposable QA cleanup과 현재 Sites public-beta 비용·limit 경계 반영 |
| `docs/production-hosting.md` | Task #45 final cleanup, production revision, release QA 완료 상태와 후속 운영 항목 반영 |
| `mydocs/working/task_m100_45_stage6.md` | local/registry/Sites 최종 검증, 비용 stop과 M100 승격 판정 기록 |
| `mydocs/orders/20260729.md` | Task #45 Stage 6 완료와 최종 보고서·PR 승인 대기로 갱신 |
| npm/GitHub/Sites read-only evidence | registry metadata·서명·provenance, Node consumer matrix, production state·HTTP·로그·비용 stop 확인 |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, package/lockfile, npm registry, Git tag, saved Site version,
production data와 runtime 설정은 변경하지 않았다. README, CLI, card와 사용자
흐름 문서는 실제 동작과 일치해 수정하지 않았다.

운영 진실 원천 두 문서에서만 이전 access/environment revision, 보존이 끝난
disposable backup 상태와 완료 전 후속 작업을 현재 final state로 최소
교체했다. 기존 export/restore, retention, rollback과 비용 stop 절차는
보존했다. OpenAI 공식 문서의 현재 public-beta 조건과 장기 가격 비보장 경계를
추가했으며 고정 quota나 무료 보장을 새로 만들지 않았다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
npm run verify:npm-release
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

추가 read-only 검증:

```text
npm registry exact version/dist-tag/integrity/signature/attestation
GitHub provenance run과 recovery SHA
isolated exact/@latest consumer on Node 20/22/24
npm audit + npm audit --omit=dev
Sites project/access/version/environment/error-only log
anonymous landing/health/auth/public JSON/card/operator route 3회
Sites 공식 pricing/limit 문서
```

결과:

- OK — unit test 488건 중 482건 통과, 환경 의존 6건 skip, 실패 0.
- OK — Playwright E2E 16건 통과.
- OK — 기본, Cloud Run fallback, Sites client와 full-stack production build
  모두 통과.
- OK — production artifact 5,400,662 bytes, client file 7개, expected binding
  3개, migration 2개다. Worker raw 3,901,236 bytes, gzip 2,145,397 bytes다.
- OK — hosting matrix에서 Cloud Run canonical app, sample-only Sites mirror와
  fallback 독립성을 확인했다.
- OK — local npm candidate는 13 entries와 consumer check 5개를 통과했다.
  local source digest는 immutable registry digest와 다르며 동일 version
  재게시 후보로 사용하지 않는다.
- OK — public registry는 `codex-usage-profile@0.1.0` 하나이고
  `latest=0.1.0`, file 13개, unpacked 49,887 bytes다.
- OK — registry SHA-1
  `a1d30872a6677e9b781e64e14f7ad9040ee92e0d`와 SHA-512
  `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==`
  가 Stage 1과 일치했다.
- OK — registry signature/attestation invalid 0, missing 0. provenance run
  [`30352705791`](https://github.com/postmelee/codex-usage-profile/actions/runs/30352705791)은
  recovery SHA `f10ad2cb1a38568371c5467dc3a25ce29df7ae8f`에서
  Node 20/22/24 verification과 publish job이 모두 success다.
- OK — 격리 consumer의 exact `0.1.0`과 `@latest`가 Node `20.20.2`,
  `22.23.1`, `24.18.0`에서 CLI `0.1.0`으로 실행됐다. analyzer `0.2.0`,
  engine `>=20`, production origin이 일치했고 credential-free status는
  network 전에 `No credential found. Run login first.`로 안전하게 실패했다.
  임시 consumer/config/cache는 exact 삭제했다.
- OK — 전체 `npm audit`은 Stage 1과 동일하게 low 1/high 7이고 direct
  항목은 `@cloudflare/vite-plugin`, `wrangler`다. production dependency
  audit은 vulnerability 0이다.
- OK — Site `active`, disabled reason 없음, public access revision 26,
  saved version 7/source
  `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`, environment revision 57,
  service normal, maintenance disabled, operator secret absent다.
- OK — `.openai/hosting.json`과 production artifact는 logical D1 `DB`,
  R2 `PROFILE_MEDIA`, migration 2개를 유지하고 `/healthz`는
  `status/worker/bindings=ok`다.
- OK — anonymous landing/health `200`, auth `401`, disposable public
  JSON/card/operator `404`가 3회 모두 일치했다.
- OK — Stage 5 exact cleanup의 final owner plan `not_found`, retention
  candidate 0, owner/session/token/D1/R2/backup/local credential 삭제 증적과
  Stage 6의 auth/public/operator 경계가 일치한다.
- OK — 최근 24시간 error-only Worker log 32개는 예상한 auth `401`과
  asset/public profile/public card/maintenance `404` allowlist다. 5xx,
  error-level event와 Worker failure는 0이고 provider cost field도 없다.
- OK — Site API는 `active`, `disabled_by=null`이고 추가 plan, 결제수단,
  upgrade 또는 자동 초과 과금 trigger를 반환하지 않았다. 공식 문서는 Sites가
  public beta 동안 eligible ChatGPT plan에 포함되며 plan별 limit 접근을
  알리고, 한도 도달 시 생성/storage/public 유지가 제한될 수 있다고 설명한다.
  현재 비용 stop trigger는 없지만 장기 가격이나 고정 quota는 보장하지 않는다.
- OK — public release scan 1,350 blobs, blocker 0, 기존 승인 review 12.
- OK — `git diff --check` 통과.

## M100 공개·홍보 판정

**PASS**

immutable npm release, Node 20/22/24 clean consumer, production 전체 흐름,
security/privacy/data consistency, rollback·exact cleanup, public safe baseline과
현재 비용 stop 조건이 모두 수용 기준을 통과했다. 현재 상태에서 M100 MVP
공개와 홍보를 막는 release blocker는 없다. Sites 가격·quota·정책 또는 장기
장애 trigger가 실제로 관찰되지 않았으므로 #43 fallback 전환 조건도
충족되지 않았다.

## 잔여 위험

- managed production에서 D1/R2 provider fault를 의도적으로 주입하지 않았다.
  local real-workerd/native-R2 failure·concurrency 회귀와 production
  observability/repair 절차로 보완한다.
- fresh QA는 동일 maintainer GitHub identity의 기존 product state를 exact
  삭제해 재생성한 조건이다. 완전히 독립적인 제3자 owner 행동 차이는 남는다.
- Sites는 public beta다. plan별 limit 수치와 장기 가격·정책은 현재 도구에서
  고정 조회할 수 없으므로 알림과 public 유지 제한을 계속 관찰한다.
- 전체 dev/build 도구 audit low 1/high 7은 남아 있다. production dependency
  audit 0이고 deployed runtime/CLI에 포함되지 않아 release blocker로
  판정하지 않았다. dependency hardening은 별도 승인 task가 필요하다.
- public npm `0.1.0`은 immutable이므로 향후 기능/security blocker가 발견되면
  같은 version 재게시가 아니라 patch release가 필요하다.

## 다음 단계 영향

- Stage 6이 마지막 구현 단계다. 승인 뒤 `task-final-report` 절차로 최종
  보고서, 오늘할일 마감, final commit과 `devel` 대상 PR을 준비한다.
- PR merge 전에는 Task #45를 close하거나 local/remote branch와 worktree를
  정리하지 않는다.
- 운영 중 Sites limit/가격/정책 또는 장기 장애 trigger가 실제로 발생할 때만
  #43 fallback 수행계획을 별도 승인 후보로 올린다.

## 승인 요청

- Stage 6 산출물, 검증 결과와 M100 `PASS` 판정을 승인하면 최종 보고서와
  PR 게시 단계로 진행한다.
