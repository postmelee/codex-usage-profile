# Task #144 Stage 2.1 완료보고서 — #146 replacement candidate 재인증

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 2.1

## 단계 목적

초기 exact main `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`의 Stage5 검증에서 발견된
라이트 카드 Border Beam 가독성 문제를 해결한 Task #146/PR #147만 replacement 범위에 포함했다.
새 `devel` `7fd130c7ceac92b0cfa6b58178422ba51d75943c`를 clean detached source에서
다시 인증해 두 번째 `devel → main` release PR을 만들 수 있는지 판정했다.

이 Stage는 candidate와 Task #146의 local/artifact 계약만 검증했다. GitHub release PR·main,
Sites source/version/deployment/environment/migration과 npm registry/tag는 변경하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_144.md` | 초기 후보·PR #145 이력을 보존하고 #146 replacement candidate와 Stage 2.1·2.2 게이트 추가 |
| `mydocs/plans/task_m100_144_impl.md` | replacement provenance, 전체 재인증, 두 번째 main 승격과 후속 Stage 진입 조건 구체화 |
| `mydocs/working/task_m100_144_stage2_1.md` | replacement candidate, focused·전체 검증과 target archive dry-run 기록 |
| `mydocs/orders/20260901.md` | #144를 Stage 2.1 완료·Stage 2.2 승인 대기로 기록 |

Task #144 추적 branch는 `origin/devel`을 병합해 PR #147의 제품 변경과 Task #146 인계 문서를
보존했다. Task #144가 새로 작성한 제품 source, migration, package와 hosting manifest 변경은 없다.
Sites artifact는 Task #144 문서 commit이 없는 exact detached candidate에서만 만들었다.

## 후보와 범위 고정

- `origin/main`: `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`
- replacement `origin/devel`: `7fd130c7ceac92b0cfa6b58178422ba51d75943c`
- replacement tree: `5b3c52e384c3e057902fac5221121243393e13fe`
- `origin/main..origin/devel` first-parent: PR #147 merge commit 한 개
- PR #147: Task #146, base `devel`, merge checks Node 20/22/24 SUCCESS
- Issue #146: CLOSED, #144에서 새 exact-main 후보로 배포한다는 maintainer 인계 기록 확인
- `db/migrations/`, `.openai/hosting.json`, `.openai/hosting-targets.json`, CLI package와 lockfile의
  `main...devel` 변경 없음
- dark golden SHA-256:
  `aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680`
- light golden SHA-256:
  `1a1368c9b9c36e234fea3da7305da62565594c824c2261e9feb1aab988b76d1c`

## 검증 결과

실행 명령:

```bash
git fetch origin
git rev-parse HEAD HEAD^{tree} origin/main origin/devel
git log --first-parent --reverse --format='%H %s' origin/main..origin/devel
git diff --check origin/main...origin/devel
git diff --name-status origin/main...origin/devel -- db/migrations .openai/hosting.json .openai/hosting-targets.json packages/codex-usage-profile-cli/package.json package-lock.json
npm ci --ignore-scripts --no-audit --no-fund
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/themeSurfaceContract.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #146|Share Studio|Share handoff|GIF|card appearance"
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
npm run package:sites-target -- --target production --archive {temporary_archive} --source-sha 7fd130c7ceac92b0cfa6b58178422ba51d75943c --package-helper {sites_package_helper} --expected-project-id appgprj_6a83ecc3c4c08191bda7f14d7c26c974
npm run package:sites-target -- --target stage5 --archive {temporary_archive} --source-sha 7fd130c7ceac92b0cfa6b58178422ba51d75943c --package-helper {sites_package_helper} --expected-project-id appgprj_6a62f58721788191a7cd82f37320f244
npm view codex-usage-profile dist-tags version --json
git status --short
```

결과:

- OK — clean install은 lockfile 변경 없이 128 packages를 설치했다.
- OK — Task #146 focused Node 44/44 통과. 두 테마의 같은 `md` 둘레 phase·4.8초, light 대비,
  dark golden 무변경, 실제 gzip body 제한, Worker fail-closed와 실제 dark/light GIF encode를 확인했다.
- OK — focused Playwright 27/27 통과. 최초 sandbox 실행은 `127.0.0.1:5715` listen `EPERM`으로
  제품 테스트 전에 중단됐고, 로컬 포트 권한의 동일 명령 재실행에서 전부 통과했다.
- OK — 전체 Node 929개 중 923 pass, 환경 조건부 6 skip, fail·cancel·todo 0이다.
- OK — 전체 Playwright 110/110 통과. Task #146 geometry·대비, 실제 GIF 생성·download·retry·cancel,
  Share handoff·reduced-motion과 기존 사용자 흐름을 포함한다.
- OK — production build는 Worker 63 modules와 client 1,839 modules를 변환했다. dark/light golden 두 개를
  모두 client artifact에 포함했다.
- OK — full-stack verifier는 client 15 files, Worker 2 files와 migration 6개를 확인했다.
  production verifier는 artifact 10,901,144 bytes, binding 3개와 approved project를 통과했다.
- OK — npm verifier는 기존 `codex-usage-profile@0.1.4`의 14-entry tarball, packed 17,614 bytes,
  unpacked 63,363 bytes와 integrity·shasum을 확인했다. registry `latest`와 version도 `0.1.4`다.
- OK — public release scan은 15 refs, 3,379 blobs에서 blocker 0이다. review 73건 중 두 large blob은
  승인된 dark/light bounded GIF golden이며 새 blocker가 아니다.
- OK — production archive는 source `7fd130c...`, production project/origin, 8,549,100 bytes,
  SHA-256 `d6a12d21837860e2245c943e5da02885d4bd124f1f2f333dabc5e2c29dd8acbb`다.
- OK — stage5 archive는 같은 source, 별도 stage5 project/origin, 8,549,092 bytes,
  SHA-256 `5b9a7cf7f5c7c4f4681bacac1d47965db843b1264914bee0f69dbcfa4c0ebd05`다.
  target identity만 분리되고 product source와 migration 1..6은 같다.
- OK — exact candidate working tree와 lockfile은 검증 뒤 clean이며 release/Sites/npm 원격 mutation은 0건이다.

## 잔여 위험

- light golden은 3,000,000-byte gzip body 상한까지 19,279 bytes만 남고 production artifact는
  12,000,000-byte 예산까지 1,098,856 bytes가 남는다. 이번 candidate는 두 제한을 통과했지만 향후
  golden 재생성이나 asset 추가 시 다시 확인해야 한다.
- GitHub Node 20/22/24 checks는 CLI package 범위다. 웹·GIF·Playwright·production artifact는 위 exact
  detached candidate의 local 결과로 별도 검증했다.
- Stage5와 production의 실제 golden HTTP body와 GIF 생성·저장은 아직 재검증하지 않았다. 새 main이
  확정된 뒤 Stage 3 owner-only와 Stage 5 public smoke에서 수행한다.
- 현재 main은 아직 initial release `0af8439...`다. Stage 2.2에서 replacement release PR을 merge하고
  candidate/main tree equality를 확인하기 전에는 Sites source push/save/deploy를 진행할 수 없다.

## 다음 단계 영향

- Stage 2.2는 base `main`, head `devel`의 두 번째 release PR을 만들며 diff를 PR #147 하나로 고정한다.
- checks·review를 통과한 merge commit의 tree가 replacement candidate tree와 exact match할 때만 새
  exact main SHA를 Stage 3 입력으로 사용한다.
- Stage 2.2에서도 Sites source/save/deploy와 npm mutation은 수행하지 않는다.

## 승인 요청

- replacement candidate `7fd130c...`, PR #147 단일 범위와 전체 local/artifact 재인증 결과를 승인하면
  Stage 2.2 두 번째 `devel → main` release PR 생성·검증·merge로 진행한다.
