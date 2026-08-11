# Task #83 Stage 2 보고서 — exact local candidate와 archive preflight

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 2

## 단계 목적

Stage 1 완료 commit `9d433225b44a76578b053bdda1349e195d6aec12`의 clean checkout에서 전체 test, E2E, production build와 독립 artifact verifier를 다시 실행한다. 이어서 설치된 Sites package helper가 만드는 실제 archive의 파일 경계, migration `1..5`, 경로 안전성과 민감정보 부재를 검증해 Gate A에 넘길 local application candidate를 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_83_stage2.md` | exact source, 전체 local 검증 결과와 임시 Sites archive의 bounded count·size·digest 증적을 기록했다. |
| `mydocs/orders/20260808.md` | #83 진행 상태를 Stage 2 완료·Stage 3 Gate A 승인 대기로 갱신했다. |

Stage 2에서는 제품 source와 공식 공개 문서를 수정하지 않았고 원격 Site, access, environment, D1/R2, saved version/deployment와 OAuth app도 변경하지 않았다. Sites helper가 생성한 archive와 안전 추출 directory는 검증 직후 삭제했으며 원격 배포에 재사용하지 않는다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이 없는 검증 단계이므로 제품 동작과 공식 문서 본문은 무손실이다. Stage 1 commit의 source를 그대로 build하고 package했으며, Stage 2 보고서 commit 뒤의 exact HEAD를 Stage 3 application candidate로 사용한다. Stage 3은 그 commit에서 새 artifact와 archive를 다시 생성해 saved version source와 일치시킨다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
/Users/melee/.codex/plugins/cache/openai-bundled/sites/0.1.34/scripts/package-site.sh \
  "$PWD" "${temporary_archive}"
git diff --check
git status --short
```

archive preflight에서는 entry 목록을 추출 전에 먼저 검사한 뒤 별도 임시 directory에 풀어 다음 계약을 확인했다.

- top-level entry는 `dist/` 하나이며 absolute entry와 `..` traversal이 없다.
- symlink와 hard link가 없고 추출 결과에도 symlink가 없다.
- `dist/server/index.js`, `dist/server/wrangler.json`, `dist/client/index.html`과 static client asset이 있다.
- `dist/.openai/hosting.json`과 migration `0001_profile_backend.sql`부터 `0005_card_locale.sql`까지 exact 5개가 있다.
- `.vite/manifest.json`, 절대 로컬 경로, credential, secret과 local test fixture literal 검색 결과가 0건이다.
- 추출한 archive를 production verifier로 다시 검증했다.

결과:

- OK — 전체 test 696개 중 690개가 통과했고 환경 설정이 없는 Postgres/S3 연동 6개만 스킵됐으며 실패는 0개다. 최초 sandbox 실행은 Miniflare loopback bind 제한에서 중단하고 동일 명령을 loopback 허용 상태로 처음부터 재실행했다.
- OK — Playwright E2E 64개가 모두 통과했다.
- OK — production build는 Worker·client build 뒤 `manifestRemoved=true`, `preservedEntryCount=0`으로 완료됐다.
- OK — full-stack verifier는 client file 7개, Worker file 2개, migration 5개와 hosted linkage를 확인했다.
- OK — production verifier는 artifact 4,869,362 bytes, Worker raw 3,973,716 bytes, gzip 2,159,965 bytes와 exact binding/migration/security 계약을 확인했다.
- OK — package archive는 file 21개, migration 5개, compressed 2,658,093 bytes이며 SHA-256은 `7484a3edd90a0f459bfb5c482009ef9f882a9636810b4cc8d40d7895957a618a`다.
- OK — archive entry·안전 추출·금지 문자열 검사가 모두 통과했고 임시 archive와 추출 directory를 삭제했다.
- OK — 검증 전 `git status --short`는 빈 출력이었고 `git diff --check`는 경고 없이 통과했다.

## 잔여 위험

- Stage 2 archive는 검증 후 폐기된 local 증적이며 배포 대상 자체가 아니다. Stage 3은 승인된 exact candidate commit에서 다시 build/package하고 새 archive digest와 saved version source를 대조해야 한다.
- 원격 Sites의 현재 access, saved version/deployment, environment revision, migration readiness, plan/quota와 OAuth 설정은 이번 단계에서 확인하거나 변경하지 않았다. Gate A mutation 전에 read-only snapshot으로 제시해야 한다.
- migration `3..5` 적용, owner-only hosted OAuth/CLI/card/OG smoke와 disposable state 정리는 아직 실행하지 않았다.

## 다음 단계 영향

- 이 보고서와 오늘할일 갱신을 묶은 Stage 2 commit이 Stage 3 application candidate다.
- Stage 3 진입에는 이 보고서 승인과 별도의 Gate A 승인이 모두 필요하다.
- Gate A 승인 전에는 Site/access/environment/D1/R2/source repository/version/deployment/OAuth app을 변경하지 않는다. 먼저 구현계획서의 Gate A 입력 항목을 read-only로 수집해 exact mutation·중단·원복 범위를 제시한다.
- `sites-hosting` 배포 절차는 Gate A 승인을 받은 Stage 3에서만 적용한다. Stage 2는 승인된 local-only 범위를 유지했다.

## 승인 요청

- Stage 2 exact local candidate와 archive preflight 결과를 승인하면 Stage 3 Gate A용 read-only snapshot과 변경·원복 계획을 준비한다.
- 해당 snapshot 검토 후 원격 owner-only mutation은 별도 승인을 받아 진행한다.
