# Task #108 Stage 3.2 보고서 — PR #109 공개 전 리뷰 보정

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 3.2

## 단계 목적

PR #109의 리뷰 지적 1~15를 production 배포 전에 보정한다. 아직 공개되지 않은 canonical
Site와 npm `0.1.2` 후보를 사용자 기본 경로처럼 안내하지 않고, 현재 실제 public stage5와
npm `latest=0.1.1`의 연속성을 유지한다. 동시에 dual-Site target materializer가 live project
identity, exact clean source, 새 production build와 공식 helper가 생성한 최종 archive 자체를
독립적으로 검증하도록 fail-closed 경계를 강화한다.

작업지시자는 Task #108의 범위가 canonical 배포·public cutover·CLI release와 stage5 테스트
전환까지 포함하며 별도 이슈로 분리하지 않는다고 명시했다. 따라서 PR #109는 전체 task 완료
PR이 아닌 exact-main 배포를 위한 Task #108 한정 checkpoint 예외로 유지하고, remote Gate가
끝나기 전에는 Issue close나 최종 보고를 수행하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` | 공개 Website·Quick start·README card·자동화 예시를 현재 live stage5와 게시된 `0.1.1` 기준으로 복원했다. |
| `packages/codex-usage-profile-cli/README.md`, `docs/cli-submit.md`, `docs/readme-card.md` | canonical/`0.1.2`를 unpublished candidate로 분리하고, public `@latest`와 fixed README URL은 stage5 continuity를 유지했다. |
| `docs/npm-release.md` | canonical public smoke·provenance 전에는 `0.1.2` tag/stage/publish를 금지하는 candidate Gate를 추가했다. |
| `docs/sites-operations.md`, `docs/production-hosting.md` | live project id 입력, exact-source rebuild, archive 재추출 검증, partial archive 정리와 origin-neutral retention 절차를 고정했다. |
| `mydocs/plans/task_m100_108.md`, `mydocs/plans/task_m100_108_impl.md` | 같은 Task 안의 checkpoint 예외, 공개 전 stage5 연속성, Stage 3.2 보정·검증·중단 조건을 기록했다. |
| `mydocs/orders/20260818.md`, `mydocs/orders/20260820.md` | Stage 3.2 보정 완료와 승인된 Draft PR 갱신·CI 재검증 상태를 날짜별 보드에 기록했다. |
| `scripts/materialize-sites-target.mjs` | expected project id를 필수화하고 realpath 외부 경계, stale `dist` 제거·재빌드, source 재확인, final archive 재추출·재검증과 실패 정리를 구현했다. |
| `scripts/verify-sites-production-artifact.mjs`, `package.json` | 모든 호출 경로에서 independent expected project id를 요구하고 CLI argument omission·duplicate를 거부했다. |
| `scripts/smoke-sites-production-local.mjs`, `scripts/smoke-npm-package-local.mjs` | production project identity 검증을 전달하고 npm smoke의 runtime origin 중복을 canonical CLI config import로 줄였다. |
| `scripts/__tests__/materialize-sites-target.test.js` | 실제 git probe·실행 helper·archive 재검증, stale ignored build, project/source/path/symlink/partial archive negative test를 추가했다. |
| `scripts/__tests__/verify-sites-production-artifact.test.js`, `scripts/__tests__/smoke-sites-production-local.test.js` | expected project id 필수·불일치·CLI omission/duplicate와 smoke 전달 계약을 검증했다. |
| `src/profile-ui/deviceApproval.js` | npm latest가 `0.1.2`로 이동하기 전 canonical 화면에는 `@latest --server {canonical}`을 제시하고 stage5 public 화면만 기본 명령을 유지했다. |
| `src/profile-ui/__tests__/deviceApproval.test.js`, `src/profile-ui/__tests__/production-origin-contract.test.js` | unpublished source default와 실제 published CLI guidance 사이의 cutover skew를 명시적으로 검증했다. |

## 본문 변경 정도 / 본문 무손실 여부

- public README와 CLI 문서의 사용자 경로만 현재 실제 배포 상태로 되돌렸다. 제품 기능 설명,
  fixed README Markdown 계약과 revision-aware 공유 계약은 유지했다.
- README Markdown은 submit·카드 설정 저장 전후에도 고정 `/api/share/{handle}` href와 query 없는
  `/u/{handle}/card.png` src를 계속 사용한다. revision URL은 공유 링크 복사와 5개 SNS target에만
  사용한다.
- CLI `0.1.2` candidate 자체의 canonical default, target registry와 canonical manifest는
  변경하지 않았다. 공개 전 Device Approval 명령만 현재 npm latest 동작과 일치시켰다.
- Stage 2 보고서는 당시 구현 결과의 이력 문서이므로 덮어쓰지 않고 이 보고서가 superseding
  공개 전 계약과 보정 결과를 기록한다.

## 검증 결과

실행 명령:

```bash
git diff --check
node --check scripts/materialize-sites-target.mjs
node --check scripts/verify-sites-production-artifact.mjs
node --test scripts/__tests__/materialize-sites-target.test.js scripts/__tests__/verify-sites-production-artifact.test.js scripts/__tests__/smoke-sites-production-local.test.js scripts/__tests__/smoke-npm-package-local.test.js src/profile-ui/__tests__/deviceApproval.test.js src/profile-ui/__tests__/production-origin-contract.test.js
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
```

결과:

- **OK — syntax/diff**: 두 Node script syntax와 whitespace 검사가 통과했다.
- **OK — focused regression**: 31 pass, 0 fail. real git/helper, production·stage5 final archive
  재검증, stale build 제거, live project/source/realpath/partial archive negative 계약과 Device
  Approval cutover skew를 검증했다.
- **OK — production build**: Sites full-stack server/client build와 Vite manifest finalization이
  통과했다.
- **OK — artifact verifier**: hosted artifact 5 migrations, exact production project id,
  `artifactBytes=5,152,084`, `workerCompressedBytes=2,168,367`로 통과했다.
- **OK — npm candidate**: `codex-usage-profile@0.1.2`, 14 entries, packed 18,488 bytes,
  integrity와 shasum 검증이 통과했다. 원격 npm publish는 수행하지 않았다.
- **OK — public release scan**: 2,889 blobs, blocker 0. 기존 review/info 분류만 남았다.
- **OK — 2026-08-20 승인 뒤 재검증**: focused 31 tests, production build, 두 Sites
  verifier, npm candidate verifier와 public release scan을 같은 결과로 다시 통과했다.
- **OK — full Node regression**: local listener가 허용된 실행 환경에서 Miniflare D1 동시성까지
  포함해 831 pass, 6 skip, 0 fail로 통과했다.
- **OK — Playwright E2E**: 101 pass, 0 fail. Device Approval과 submit 전후 README 고정·공유
  링크 및 5개 SNS revision 갱신 browser 계약을 포함한다.
- **OK — Draft PR CI**: pushed head에서 CLI package와 exact candidate 검증이 Node 20·22·24
  모두 통과했고 publish job은 의도대로 skip됐다.

## 잔여 위험

- canonical Site는 아직 owner-only·undeployed이고 npm `0.1.2`는 미게시 후보다. public 문서와
  Device Approval 기본 명령은 Gate C 완료 전까지 stage5/`0.1.1` 연속성을 유지해야 한다.
- materializer의 `--expected-project-id`는 packaging 직전 live read-only preflight 결과를
  작업자가 전달해야 한다. 문서의 placeholder나 registry 값만 재사용하면 안 된다.

## 다음 단계 영향

- Stage 3.2 보정과 전체 회귀가 반영된 Draft PR #109를 작업지시자가 다시 검토하고 checkpoint
  merge 여부를 승인한다.
- PR #109와 후속 `devel → main` release PR이 merge돼 exact main source가 고정되기 전에는
  Sites source push/save/deploy, access/environment 변경, tag 또는 npm publish를 하지 않는다.
- 이후 Stage 4에서 canonical private/public smoke를 통과한 뒤에만 README/CLI 안내와 npm
  latest를 canonical/`0.1.2`로 전환한다.

## 승인 요청

- Stage 3.2 산출물, 전체 회귀와 Draft PR CI 결과를 승인하면 PR #109를 Ready로 전환하고
  checkpoint merge 단계로 진행한다.
