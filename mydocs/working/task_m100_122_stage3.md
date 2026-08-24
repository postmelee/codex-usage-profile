# Task #122 Stage 3 완료 보고 — CLI 재조정과 통합 검증 정합화

GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)
구현계획서: [`task_m100_122_impl.md`](../plans/task_m100_122_impl.md)
Stage: 3

## 단계 목적

Stage 2에서 추가한 safe terminal classification을 maintenance CLI의 bounded
reconciliation 계약과 일치시킨다. confirmed structured state drift에서는 read-only plan을
한 번만 확인하고 추가 mutation 없이 중단하되, reason이 없는 legacy conflict와
network-unknown/not-found completion 경계는 보존한다. 같은 계약을 실제 local D1/R2
full-stack smoke와 공식 운영 문서에 고정하고 전체 회귀·artifact·공개 표면을 검증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/sites-profile-maintenance.mjs` | allowlist된 terminal conflict만 안전하게 해석하고 read-only plan 한 번 뒤 중단하며, legacy 응답의 기존 bounded reconciliation을 보존했다. |
| `scripts/__tests__/sites-profile-maintenance.test.js` | terminal·legacy·신뢰할 수 없는 분류에서 mutation 횟수와 출력 정보 경계를 회귀로 고정했다. |
| `scripts/smoke-sites-fullstack-local.mjs` | mixed-case live-equivalent 71개 structured 객체, injected full rollback과 동일 operation 재개·완료를 실제 workerd D1에서 검증했다. |
| `docs/sites-operations.md` | terminal/legacy conflict별 plan 확인·재시도·즉시 중단 결정과 application rollback 금지 경계를 기록했다. |
| `docs/production-hosting.md` | structured delete의 exact fingerprint·단일 D1 batch 원자성과 CLI reconciliation 경계를 추가했다. |
| `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md` | CLI·전체 회귀 결과와 미실행 Stage5 재개 checklist를 반영했다. |
| `mydocs/orders/20260824.md` | Task #122를 `Stage 3 완료·CLI/통합 검증, Stage 4 승인 대기`로 갱신했다. |
| `mydocs/working/task_m100_122_stage3.md` | Stage 3 산출물, 검증, 잔여 위험과 다음 단계 승인 경계를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

기존 top-level `maintenance_conflict`, operation ID·최초 digest/count, monotonic
phase/count, network-unknown과 apply 후 `not_found` 완료 계약을 유지했다. 신규 terminal
동작은 allowlist된 `structured_state_changed`와 `retryable: false`가 함께 있는 응답에만
적용된다. 임의 reason·provider 원문·row payload는 CLI 출력으로 전달하지 않으며 reason 없는
구버전 응답은 성공이나 terminal로 추정하지 않는다.

공개 profile/submit UX, npm package 동작, D1 schema·migration, R2 publication 계약은
변경하지 않았다. Stage3의 D1/R2 mutation은 repository 밖 임시 local smoke에만 있었고
Stage5·production mutation은 0건이다. Task #108 worktree와 문서는 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js \
  scripts/__tests__/smoke-sites-production-local.test.js
npm test
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
npm run scan:public-release
git diff --check origin/devel...HEAD
git status --short
```

결과:

- OK — 집중 회귀는 D1 maintenance 9, Sites maintenance 23, maintenance CLI 22,
  production-local smoke unit 2, 합계 56 pass, 0 fail이다.
- OK — maintenance CLI는 terminal structured conflict에서 operation apply 1회 뒤
  read-only plan 1회만 수행하고 중단한다. reason 없는 legacy conflict는 기존 bounded
  재조정을 유지하며, 신뢰할 수 없는 reason·retryability는 terminal 권한으로 사용하지 않는다.
- OK — 전체 Node suite는 868 tests 중 862 pass, 환경 조건부 6 skip, 0 fail이다.
- OK — full-stack artifact는 client 12 files, worker 2 files, migration `1..6`과 hosted
  linkage를 검증했고 production artifact는 project
  `appgprj_6a83ecc3c4c08191bda7f14d7c26c974`, binding 3개와 동일 migration을 검증했다.
- OK — real-workerd smoke가 mixed-case 71개 structured 객체의 injected full rollback,
  동일 operation·approval 재개 완료, 67 routes와 canonical update 2회를 검증했다.
- OK — public release scan은 3,037 blobs에서 blocker 0이다. review-only 항목은 기존
  refs의 문서 경로·test fixture·공개 commit metadata 범주이며 이번 변경에 신규 blocker가 없다.
- OK — `git diff --check origin/devel...HEAD`와 현재 working diff check가 통과했다.

## 잔여 위험

- Stage5의 기존 active operation과 owner는 그대로이며, Stage 4 exact-main provenance와
  별도 Stage 5 preflight 승인 전에는 재개할 수 없다.
- integrated `devel`과 exact `main`에서의 전체 검증 및 Stage5 role artifact preflight는
  Stage 4 범위다.
- production project는 계속 read-only다.

## 다음 단계 영향

- Stage 4는 이 Stage 3 commit을 non-closing checkpoint PR로 `devel`에 통합하고, 작업지시자의
  별도 merge 지시 뒤 `devel → main` release PR을 진행해야 한다.
- exact `main` tree에서 Stage5 role artifact를 새로 만들고 project·origin·binding·migration
  `1..6`·credential/path scan을 mutation 없이 통과시켜야 한다.
- Stage 4에서는 tag, npm publish, Sites save/deploy와 Issue #122 close를 수행하지 않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 source integration checkpoint와
  exact-main release provenance 기록으로 진행한다.
