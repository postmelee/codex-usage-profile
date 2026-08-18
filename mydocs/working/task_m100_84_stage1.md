# Task #84 Stage 1 보고서 — exact release candidate 검증

GitHub Issue: [#84](https://github.com/postmelee/codex-usage-profile/issues/84)
구현계획서: [`task_m100_84_impl.md`](../plans/task_m100_84_impl.md)
Stage: 1

## 단계 목적

`devel → main` release PR을 만들기 전에 release source를 exact SHA로 고정하고, Git topology와 candidate CI, clean detached worktree의 전체 검증, Sites 배포 아카이브 안전성을 확인한다. 이 Stage는 local preflight만 수행하며 GitHub PR, Sites saved version, access policy와 사용자 데이터를 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_84_stage1.md` | exact candidate topology·CI·test·artifact·archive 검증 증적과 Stage 2 경계를 기록 |
| `mydocs/orders/20260812.md` | #84를 Stage 1 완료 및 Stage 2 승인 대기 상태로 갱신 |

임시 detached worktree와 배포 아카이브는 검증을 마친 뒤 제거했다. 제품 source, dependency lockfile와 원격 상태는 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

제품 코드와 공식 공개 문서는 변경하지 않았다. task 문서는 기존 승인 계획을 보존하고 이번 Stage의 bounded 검증 결과만 추가했다.

## 검증 결과

실행 명령:

```bash
git fetch origin
git rev-parse origin/devel
git rev-parse origin/main
git merge-base origin/main origin/devel
git rev-list --count origin/main..origin/devel
git rev-list --count origin/devel..origin/main
git log --oneline origin/main..origin/devel
git diff --name-status origin/main...origin/devel
git diff --stat origin/main...origin/devel
gh run list --commit 242674cca76b167642108fb85f739fbdcf9fd4d4
gh run view 31510366303
npm ci
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm audit --omit=dev
git diff --check
git status --short
```

결과:

- **OK — exact candidate 고정**: `origin/devel`은 `242674cca76b167642108fb85f739fbdcf9fd4d4`, 시작 `origin/main`은 `e75609db133ae43e9a36d7cc9994c813bcaa621c`다. merge-base는 main SHA와 같고 main은 candidate의 ancestor다. candidate는 419 commits ahead, 0 behind이며 PR #85 Stage 4.7 commit `8c7e4bd`를 포함한다.
- **OK — 누적 diff 검토**: main 대비 candidate diff는 671 files와 128,208 insertions다. 승인 계획에서 벗어난 main-only commit이나 topology drift는 확인되지 않았다.
- **OK — exact candidate CI**: GitHub Actions [run 31510366303](https://github.com/postmelee/codex-usage-profile/actions/runs/31510366303)은 candidate SHA의 `push` run이며 completed/success다. Node 20·22·24 package verification job이 모두 성공했고 npm publication approval job은 skipped여서 publish는 발생하지 않았다.
- **OK — dependency와 production audit**: lockfile 기반 `npm ci`가 성공했다. 전체 audit의 9건(1 low, 8 high)은 build/dev toolchain 경로이며 `npm audit --omit=dev`는 production vulnerability 0건이다. lockfile 자동 수정은 수행하지 않았다.
- **OK — Node 전체 검증**: 727 tests 중 721 pass, 환경 조건부 6 skip, 0 fail이다. managed sandbox에서 Workerd child process가 기동 대기한 현상은 동일 focused test의 비-sandbox 7/7 pass로 실행환경 제약임을 분리했고, authoritative non-sandbox 전체 suite가 약 17.8초에 통과했다.
- **OK — E2E**: 75/75 pass, 약 1.1분이다.
- **OK — production build**: server 60 modules, client 1,828 modules로 빌드했고 finalizer가 manifest를 제거했다. 빌드 뒤 detached worktree는 clean 상태였다.
- **OK — Sites artifact verifier**: fullstack verifier는 client 8 files, migration 5 files, worker 2 files, worker raw 3,998,544 bytes, compressed 2,165,754 bytes로 통과했다. production verifier는 artifact 5,120,248 bytes와 expected binding 3개로 통과했다.
- **OK — archive 구성**: `sites-building` package helper로 만든 archive는 2,857,353 bytes, SHA-256 `57d0c0c5e9751f1cdf6fb2e51d179780ca51c626820e1417ffea7a1dbf08479c`다. 29 entries 중 regular files는 22개이며 모두 `dist/` 아래다.
- **OK — archive 안전성**: absolute/traversal/outside-`dist` entry, symlink·hardlink, 알려진 credential signature, fixture secret와 local absolute path가 모두 0건이다. `dist/server/index.js`, `dist/server/wrangler.json`, `dist/.openai/hosting.json`, `dist/client/index.html`과 renderer asset이 존재한다.
- **OK — migration과 binding**: migration은 `0001_profile_backend.sql`부터 `0005_card_locale.sql`까지 exact 5개다. archive는 hosting manifest의 `DB`·`PROFILE_MEDIA`와 worker의 `ASSETS` binding을 포함한다.
- **OK — cleanup과 task worktree**: 임시 worktree와 archive를 제거했다. task worktree에는 승인된 계획 commit만 있었고 단계 보고 전 `git diff --check`와 `git status --short`가 clean이었다.

## 잔여 위험

- 현재 workflow는 `devel` push와 `devel` 대상 PR 중심이므로 Stage 2의 `main` 대상 release PR에 PR-specific check가 생기지 않을 수 있다. 승인된 release gate는 exact candidate의 성공 run과 이 Stage의 clean-worktree 전체 검증이다. PR-specific check가 필수라면 release PR 생성 전에 CI 변경을 별도 승인받아야 한다.
- main 대비 release diff가 419 commits로 크다. Stage 2에서 PR base/head/head SHA, mergeability와 review를 다시 확인하고 작업지시자가 직접 merge해야 한다.
- 전체 audit의 dev-only 취약점 9건은 release blocker가 아니지만 후속 dependency maintenance에서 추적할 수 있다. production dependency audit는 0건이다.
- 이 Stage는 local package까지만 검증했다. exact-main Sites saved version, owner-only smoke와 Gate C는 각각 Stage 3·4의 별도 승인 경계다.

## 다음 단계 영향

- Stage 2 시작 전 fetch하여 `origin/devel`이 candidate SHA와 같은지 다시 확인한다. 달라졌으면 이 Stage의 candidate 고정과 전체 검증을 재사용하지 않는다.
- release PR은 base `main`, head `devel`, exact head `242674cca76b167642108fb85f739fbdcf9fd4d4` 조건에서만 생성한다.
- release PR merge는 작업지시자가 직접 수행한다. tag, GitHub Release, npm publish와 Sites 배포는 Stage 2 범위가 아니다.
- merge 통지 뒤 merged main이 candidate를 포함하고 tree diff가 비어 있는지 확인한 후에만 Stage 3A read-only snapshot을 준비한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 `devel → main` release PR 생성 단계로 진행한다.
