# Task #144 구현계획서 — 통합 exact-main Sites 릴리스

수행계획서: [`task_m100_144.md`](task_m100_144.md)
GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
마일스톤: M100

## 승인된 결정과 구현 해석

- 승인된 배포 후보는 PR #140, #142, #143을 포함하는 `devel`
  `aaf997720f296265c8b306840f0eb8af67b08dfb`다. Stage 1 진입 시
  `origin/devel`이 달라졌으면 새 merge를 자동 포함하지 않고 작업지시자에게 재승인받는다.
- 위 후보는 Stage 1 인증과 PR #145를 거쳐 main `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`로
  승격됐지만 Stage5 시각 검증에서 라이트 GIF/Beam 대비 blocker가 발견됐다. Task #146/PR #147을
  선행 완료한 뒤 #144를 재개한다는 작업지시자 승인과 #146 인계에 따라 replacement candidate는
  `devel` `7fd130c7ceac92b0cfa6b58178422ba51d75943c`로 고정한다.
- replacement candidate는 기존 main 대비 PR #147만 포함해야 한다. Stage 2.1에서 전체 local
  certification을 반복하고 Stage 2.2의 새 release PR로 main에 재승격한 뒤에만 Stage 3을 재개한다.
- 제품 source는 이미 `devel`에 병합됐다. Task #144 branch는 계획·단계·최종 보고만 추적하며,
  별도 product checkpoint 없이 검증된 `devel → main` release PR로 승격한다.
- exact `main` merge commit을 Sites source repository에 push하고 같은 commit에서 만든 archive만
  stage5와 production saved version에 사용한다. task 문서 commit은 Sites provenance에 섞지 않는다.
- stage5는 기존 custom owner-only policy를 유지하며 owner-only가 정확히 검증될 때만 private deploy를
  사용한다. production은 현재 public access를 유지하고, exact URL·resolved public access를 다시
  제시해 작업지시자가 명시 승인한 뒤에만 public deploy를 사용한다.
- source 저장, deployment, environment, migration은 각각 상태와 rollback 입력을 확인한 뒤 실행하는
  별도 원격 mutation이다. Stage 승인 안에서도 구현계획에 표시된 하위 Gate마다 중간 결과를 보고하고
  명시 승인 없이 다음 mutation으로 넘어가지 않는다.
- stage5와 production은 migration `[1,2,3,4,5,6]`을 그대로 사용한다. 신규 SQL, schema 변경이나
  metadata-only 임의 보정은 만들지 않는다.
- maintenance secret은 repository 밖에서 일회성으로 생성하고 Sites secret으로만 전달한다. plaintext를
  shell command, Git, tool output, 단계 보고서나 사용자 응답에 기록하지 않으며 readiness 종료 즉시 제거한다.
- npm `codex-usage-profile@0.1.4`와 `codex-usage-profile-v0.1.4` tag는 이미 immutable release다.
  이번 task는 registry/tag mutation 없이 `@latest=0.1.4`와 새 production Site의 호환성만 확인한다.
- production/stage5 data 삭제·복제·초기화, account deletion E2E, access policy 변경, 실제 SNS 게시,
  provider cache purge와 Issue #125 recovery는 수행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 원격 mutation | 완료 검증 |
|---|---|---|---|---|
| 1 | exact candidate 고정과 Local certification | candidate inventory, 전체·focused 검증 | 없음 | Node/E2E/build/artifact/pixel·GIF 계약 |
| 2 | devel에서 main으로 exact release 승격 | release PR, merged main SHA/tree | GitHub PR·merge만 | CI·candidate/main tree equality |
| 2.1 | #146 replacement candidate 재인증 | replacement inventory, 전체·focused 재검증 | 없음 | PR #147 단일 범위·Node/E2E/build/artifact |
| 2.2 | replacement candidate의 main 재승격 | 두 번째 release PR, 새 exact main SHA/tree | GitHub PR·merge만 | CI·replacement/main tree equality |
| 3 | Stage5 owner-only candidate 검증 | saved version, private deployment, readiness, synthetic smoke | Stage5 source/save/env/deploy | owner-only·migration 1–6·기능 smoke |
| 4 | Production baseline과 saved version 준비 | baseline, rollback, production saved version | production source/save만 | live 미변경·archive/source equality |
| 5 | Production public deployment와 비파괴 smoke | public deployment, readiness, hosted smoke | production env/deploy | health·operator·Task #141/#39·data 보존 |
| 6 | Release provenance와 운영 handoff | official baseline, 단계 보고, final 준비 | 없음 | source/version/state 교차 대조·전체 회귀 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| production architecture·live 이력 | `docs/` | `docs/production-hosting.md` | OK | Stage 6에서 실제 source/version/access/environment/migration·rollback 행만 갱신 |
| Sites 운영 runbook | `docs/` | `docs/sites-operations.md` | OK | 실제 connector/tool contract가 기존 절차와 달랐을 때만 최소 보정, 같으면 미수정 |
| npm 릴리스 기록 | 변경 없음 | `docs/npm-release.md` read-only 대조 | OK | `0.1.4` 재게시 없음, compatibility 결과는 task 보고서에 기록 |
| 카드·social·GIF 사용자 계약 | 변경 없음 | `docs/readme-card.md` read-only 대조 | OK | Task #141/#39 merge에서 이미 반영된 계약을 중복 편집하지 않음 |
| 단계·최종 보고 | `mydocs/` | `mydocs/working/task_m100_144_stage{1..6}.md`, `mydocs/report/task_m100_144_report.md` | OK | 승인·원격 증적·검증 결과를 공식 제품 문서와 분리 |

신규 공식 문서는 만들지 않는다. Task #144에서 product source, package, migration, hosting manifest는
수정하지 않으며 remote 실측으로 바뀐 production baseline만 공식 문서에 최소 반영한다.

## 공통 release contract

### Candidate와 provenance

- initial candidate SHA: `aaf997720f296265c8b306840f0eb8af67b08dfb`
- initial candidate first-parent merge:
  - `f6d8fd38c1d2e3edb3ddb91f4ebd4f9e3e878972` — PR #140 / Task #137
  - `72db02ca8933668d9e800af737e03b6ced4e0493` — PR #142 / Task #141
  - `aaf997720f296265c8b306840f0eb8af67b08dfb` — PR #143 / Task #39
- initial release main: `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5` / PR #145
- replacement candidate SHA: `7fd130c7ceac92b0cfa6b58178422ba51d75943c`
- replacement first-parent merge:
  - `7fd130c7ceac92b0cfa6b58178422ba51d75943c` — PR #147 / Task #146
- Stage 1·2는 initial candidate와 PR #145의 완료 이력이다. Stage 2.1은 replacement candidate detached
  worktree에서 clean install/build와 전체 검증을 반복한다. Stage 2.2 release merge 뒤 replacement tree와
  `origin/main` tree의 exact equality를 확인하되 merge commit SHA 차이는 허용한다.
- Stage 3~5 archive는 Stage 2.2에서 확정한 새 exact main detached worktree에서 기존 `dist`를 제거하고 다시 build한다.
  Sites plugin의 `scripts/package-site.sh`로 `dist/`, hosting metadata, migration을 package하며 source
  commit, saved version `source.commit_sha`, archive digest와 deployment `version_id`를 교차 대조한다.
- provider source credential은 필요 시 target별로 한 번 발급하고 만료 전까지 재사용한다. per-command
  HTTP authorization header로만 push하며 remote URL·Git config·문서에 저장하지 않는다.

### Target identity와 접근 수준

| 역할 | project | origin | 기대 access | logical binding |
|---|---|---|---|---|
| Stage5 | `appgprj_6a62f58721788191a7cd82f37320f244` | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | custom owner-only, owner 1, external/workspace/group 0 | `DB`, `PROFILE_MEDIA` |
| Production | `appgprj_6a83ecc3c4c08191bda7f14d7c26c974` | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` | 기존 public 유지 | `DB`, `PROFILE_MEDIA` |

- project와 origin은 `.openai/hosting-targets.json`, production project는 `.openai/hosting.json`,
  live identity는 Sites read-only 응답과 모두 일치해야 한다.
- Stage5 access가 owner-only로 정확히 검증되지 않으면 private deploy를 시도하지 않고 중단한다.
- Production deploy 직전 resolved access가 public/shared/ambiguous 중 무엇인지 다시 읽고 URL과 함께
  사용자에게 제시한다. `Publish publicly`에 해당하는 명시 승인이 없으면 deploy하지 않는다.

### Environment와 migration

- baseline에는 environment revision과 key의 present/absent·secret 여부만 기록하고 value는 읽거나
  출력하지 않는다.
- maintenance Gate는 다음 두 key만 일시적으로 바꾼다.
  - `PROFILE_MAINTENANCE_MODE=enabled`
  - `PROFILE_MAINTENANCE_TOKEN={ephemeral secret}`, secret
- maintenance-on environment를 exact saved version에 적용한 deployment가 terminal `succeeded`가 된 뒤
  approved origin에만 `migrate`, `readiness`를 실행한다.
- readiness는 `ready=true`, `expectedVersions`와 `appliedVersions`가 순서까지
  `[1,2,3,4,5,6]`이어야 한다. missing/unexpected/drift, active deletion operation 또는 provider
  inspection failure가 있으면 임의 수정 없이 maintenance 상태에서 중단·보고한다.
- 정상 종료는 `PROFILE_MAINTENANCE_MODE=disabled`, token key remove, 같은 saved version 재deploy,
  `/healthz` `200`, operator route generic `404`까지다. 이 baseline 복원이 실패하면 사용자 smoke를 하지 않는다.

### 기능 수용 계약

- Task #141:
  - social output `2400×1260`, card placement와 scale은 dark/light 동일
  - light canvas `#F3F5F7`, border `#D0D7DE`
  - light outline은 dark card alpha geometry 밖으로 돌출하지 않음
  - dark padding transparent, border 없음, standalone card PNG/SVG 무회귀
- Task #39:
  - browser-only GIF animation/frame/binary/encoder unit contract 통과
  - Share Studio Worker 생성 완료, `image/gif` blob, GIF signature/frame contract와 download/save UI 동작
  - error/cancel/retry와 기존 PNG download·card/social path 무회귀
- Task #146:
  - dark/light 모두 `md` 둘레 회전·phase·폭·4.8초와 카드 `1497×918 / 499:306` 공유
  - light graphite/blue 대비와 전용 golden, dark live preset과 dark golden SHA 무변경
  - GIF `998×612 / 20fps / 96프레임`, 15MB 미만과 golden 실제 gzip body 상한 검증
- Hosted smoke는 실제 SNS 게시나 cache purge 없이 application metadata/image response와 작성 화면 직전까지만
  확인한다. production data 삭제 없이 기존 owner의 publish/unpublish는 원래 visibility로 복원한다.

### 증적과 비식별화

- 기록 가능: public Git SHA/PR/check URL, Site project/version/deployment/access/environment revision,
  origin, migration list, archive digest·file count, HTTP status/content-type/dimensions/ETag, npm public version.
- 기록 금지: source write credential, OAuth/maintenance/session/device token, cookie·Authorization,
  D1 row, R2 body, raw usage, provider exception 원문, 개인 local credential path.
- tool 응답에 민감 값이 있어도 stage report·commit·PR·사용자 응답으로 복제하지 않는다.

## 원격 mutation matrix와 승인 경계

| Stage | GitHub | Stage5 | Production | 승인 경계 |
|---|---|---|---|---|
| 1 | read-only PR/branch inventory | read-only baseline 가능 | read-only baseline 가능 | 구현계획·Stage 1 승인 |
| 2 | `devel → main` release PR·merge | 없음 | 없음 | Stage 1 보고 승인 뒤 PR 생성·merge |
| 2.1 | PR #147·branch read-only inventory | 없음 | 없음 | #146 merge와 replacement candidate 승인 뒤 전체 재인증 |
| 2.2 | 두 번째 `devel → main` release PR·merge | 없음 | 없음 | Stage 2.1 보고 승인 뒤 PR 생성·merge |
| 3 | exact main source push credential | source push, save, env, owner-only deploy, migration/readiness | 없음 | source/save, maintenance/deploy, synthetic smoke 하위 Gate |
| 4 | exact main source push credential | read-only audit | source push와 save만 | production baseline·archive 제시 후 save 승인 |
| 5 | 없음 | read-only continuity | env, existing-public deploy, migration/readiness | exact public access를 제시한 live deploy 명시 승인 |
| 6 | read-only provenance | read-only audit | read-only audit | Stage 5 보고 승인, final report는 별도 승인 |

## Stage 1 — exact candidate 고정과 Local certification

### 진입 조건

- 수행계획서와 본 구현계획서의 6 Stage, candidate SHA, remote Gate와 제외 범위가 승인됐다.
- `local/task144`에는 계획 문서 commit만 있고 working tree가 clean하다.
- `origin/devel`이 candidate `aaf9977...`와 정확히 같다.

### 산출물

신규:

- `mydocs/working/task_m100_144_stage1.md`

수정:

- `mydocs/orders/20260828.md`

제품 source와 공식 문서는 변경하지 않는다. test/build output과 temporary detached worktree는 저장소에
추가하지 않는다.

### 실행 순서

1. `git fetch origin` 뒤 issue, main/devel SHA, first-parent merge, ancestry, path diff와 migration diff를
   읽기 전용으로 고정한다. candidate drift가 있으면 즉시 중단한다.
2. `/private/tmp`의 새 detached worktree를 exact candidate에 만들고 tracked status가 clean인지 확인한다.
3. `npm ci --ignore-scripts --no-audit --no-fund`로 설치하고 lockfile 변화가 없는지 확인한다.
4. Task #141 focused renderer tests를 실행해 canvas size, surface colors, geometry와 dark/standalone 회귀를
   판정한다.
5. Task #39 focused GIF encoder/animation/UI tests와 full browser E2E를 실행한다.
6. 전체 Node test, production build, full-stack/production artifact verifier, npm compatibility verifier와
   public release scan을 실행한다.
7. production/stage5 target materializer를 repository 밖 임시 경로에서 실행하고 project/origin/binding,
   migration 1..6, secret·절대경로 부재를 확인한다. 원격 save/deploy는 하지 않는다.
8. candidate와 main 차이가 승인된 세 PR 범위이고 신규 migration, hosting target, package version drift가
   없는지 확인한다.
9. `task-stage-report`로 검증 결과·Stage 1 보고서·오늘할일을 한 commit에 묶고 Stage 2 승인을 요청한다.

### 검증

```bash
git rev-parse origin/main origin/devel
git log --first-parent --reverse --oneline origin/main..origin/devel
git diff --check origin/main...origin/devel
git diff --name-status origin/main...origin/devel -- db/migrations .openai/hosting.json .openai/hosting-targets.json
npm ci --ignore-scripts --no-audit --no-fund
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/shareStudio.test.js
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
git status --short
```

### 완료·중단 조건

- 완료: exact candidate, focused pixel/GIF, 전체 Node/E2E/build/artifact/npm/public scan이 통과하고 remote
  mutation은 0건이다.
- 중단: candidate drift, test/build failure, migration/target/package version 변경, secret/path blocker,
  light/dark geometry 불일치 또는 GIF/기존 PNG 회귀.

### 커밋

```text
Task #144 Stage 1: 통합 배포 후보와 Local 검증 고정
```

## Stage 2 — devel에서 main으로 exact release 승격

### 진입 조건

- Stage 1 source·검증·보고서가 승인됐다.
- `origin/devel`이 여전히 approved candidate와 같고 `origin/main`은 그 ancestor다.
- Release PR 생성·review·merge를 수행하는 Gate가 승인됐다.

### 산출물

- release PR: `devel → main`, 제목 `Release: 라이트 소셜 썸네일과 웹 GIF export`
- merged exact main SHA와 candidate/main tree equality
- `mydocs/working/task_m100_144_stage2.md`
- 오늘할일 상태 갱신

### 실행 순서

1. `git fetch origin` 뒤 base `main`, head `devel`, candidate SHA와 diff가 Stage 1 승인 범위인지 재확인한다.
2. release PR을 Open 상태로 만들고 Issue #144 추적, 포함 PR #140/#142/#143, local 검증, npm 재게시·
   Sites mutation 없음과 rollback 경계를 본문에 기록한다.
3. required checks를 terminal 상태까지 확인한다. failure/cancel/pending timeout은 merge하지 않는다.
4. PR base/head와 diff를 재확인하고 merge commit 방식으로 병합하며 `devel` branch는 삭제하지 않는다.
5. fetch 후 `origin/main` merge commit SHA를 고정하고 candidate tree와 exact equality를 확인한다.
6. main merge 전후 Sites version/deployment와 npm `latest=0.1.4`가 변하지 않았음을 읽기 전용으로 확인한다.
7. `task-stage-report`로 PR/check/main provenance와 Stage 2 보고서를 commit하고 Stage 3 승인을 요청한다.

### 검증

```bash
gh pr view {release_pr} --json state,baseRefName,headRefName,mergeCommit,statusCheckRollup,url
git fetch origin
git rev-parse origin/devel origin/main
git diff --exit-code aaf997720f296265c8b306840f0eb8af67b08dfb^{tree} origin/main^{tree}
git merge-base --is-ancestor aaf997720f296265c8b306840f0eb8af67b08dfb origin/main
npm view codex-usage-profile dist-tags version
git diff --check
```

### 완료·중단 조건

- 완료: release PR이 checks·review를 통과해 merge되고 exact main tree가 candidate와 같다. Sites/npm mutation은 없다.
- 중단: unrelated merge, CI failure, base/head mismatch, merge conflict, tree mismatch, Issue 조기 close 또는 npm drift.

### 커밋

```text
Task #144 Stage 2: exact main release 승격 완료
```

## Stage 2.1 — #146 replacement candidate 재인증

### 진입 조건

- Task #146 PR #147이 `devel`에 merge되고 Issue #146이 완료됐다.
- 작업지시자가 #146 선행 완료 뒤 #144를 권장 순서로 재개하는 방식을 승인했다.
- `origin/devel`은 replacement candidate `7fd130c7ceac92b0cfa6b58178422ba51d75943c`와 같고,
  `origin/main..origin/devel`은 PR #147 merge commit 하나뿐이다.

### 산출물

- `mydocs/working/task_m100_144_stage2_1.md`
- `mydocs/orders/20260901.md`
- replacement candidate provenance, 전체 local 재인증과 Task #146 focused 검증

제품 source, Sites, npm과 GitHub branch/PR 상태는 변경하지 않는다. Task #144 추적 branch는 최신
`devel`을 병합해 #146 인계 문서를 보존하지만 production artifact는 exact detached candidate만 사용한다.

### 실행 순서

1. `git fetch origin` 뒤 main/devel SHA·tree, first-parent merge, PR #147 상태와 Issue #146 인계를 고정한다.
2. main 대비 변경이 PR #147뿐이고 migration, hosting target, package version/lockfile drift가 없는지 확인한다.
3. exact replacement candidate detached worktree에서 clean install을 수행한다.
4. Task #146 focused Node와 Playwright를 실행해 light/dark 동일 모션·geometry·GIF 규격, light 대비와
   dark golden SHA를 검증한다.
5. 전체 Node, Playwright E2E, production build, Sites full-stack/production, npm compatibility와 public
   release scan을 재실행한다. E2E와 build는 같은 checkout에서 병렬 실행하지 않는다.
6. production/stage5 target archive를 repository 밖에서 dry-run하고 source, project/origin/binding,
   migration 1..6과 artifact budget을 확인한다. remote save/deploy는 하지 않는다.
7. `task-stage-report`로 계획 개정, Stage 2.1 보고와 오늘할일을 한 merge commit에 묶고 Stage 2.2 승인을 요청한다.

### 검증

```bash
git rev-parse origin/main origin/devel
git log --first-parent --reverse --oneline origin/main..origin/devel
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
git status --short
```

### 완료·중단 조건

- 완료: replacement candidate와 PR #147 단일 범위가 고정되고 focused·전체 local/artifact 검증이 통과하며
  Sites/npm/GitHub release 원격 mutation이 0건이다.
- 중단: candidate drift, unrelated merge, migration/target/package drift, 테스트·artifact 실패, dark golden 변경,
  light/dark 모션·geometry 불일치 또는 remote mutation 발생.

### 커밋

```text
Task #144 [Stage 2.1]: #146 반영 배포 후보 재인증
```

## Stage 2.2 — replacement candidate의 main 재승격

### 진입 조건

- Stage 2.1 replacement candidate provenance와 전체 검증 보고서가 승인됐다.
- `origin/devel`은 여전히 `7fd130c7ceac92b0cfa6b58178422ba51d75943c`이며 `origin/main`은 그 ancestor다.
- 두 번째 `devel → main` release PR 생성·review·merge Gate가 승인됐다.

### 산출물

- replacement release PR과 merged exact main SHA/tree
- `mydocs/working/task_m100_144_stage2_2.md`
- 오늘할일 상태 갱신

### 실행 순서

1. base `main`, head `devel`, replacement candidate와 diff가 PR #147 범위인지 재확인한다.
2. release PR에 Issue #144, PR #147/#146, Stage 2.1 검증, npm 재게시·Sites mutation 없음과 rollback 경계를 기록한다.
3. required checks를 terminal 상태까지 확인한 뒤 merge commit 방식으로 병합하고 `devel`은 삭제하지 않는다.
4. 새 `origin/main` tree와 replacement candidate tree의 exact equality와 ancestry를 확인한다.
5. Sites version/deployment와 npm `latest=0.1.4`가 변하지 않았음을 읽기 전용으로 확인한다.
6. `task-stage-report`로 release provenance를 commit하고 Stage 3 승인을 요청한다.

### 검증

```bash
gh pr view {replacement_release_pr} --json state,baseRefName,headRefName,mergeCommit,statusCheckRollup,url
git fetch origin
git rev-parse origin/devel origin/main
git diff --exit-code 7fd130c7ceac92b0cfa6b58178422ba51d75943c^{tree} origin/main^{tree}
git merge-base --is-ancestor 7fd130c7ceac92b0cfa6b58178422ba51d75943c origin/main
npm view codex-usage-profile dist-tags version
git diff --check
```

### 완료·중단 조건

- 완료: replacement release PR checks·review·merge와 exact tree equality가 통과하고 Sites/npm mutation이 없다.
- 중단: unrelated merge, CI failure, base/head mismatch, tree mismatch 또는 npm/Sites drift.

### 커밋

```text
Task #144 [Stage 2.2]: #146 포함 exact main 재승격
```

## Stage 3 — Stage5 owner-only candidate 검증

### 진입 조건

- Stage 2.2의 새 exact main SHA와 replacement tree equality가 승인됐다.
- Stage5 live target이 expected project/origin이며 access가 exact owner-only로 확인됐다.
- Stage5 source/save, maintenance/deploy/migration, synthetic smoke의 하위 Gate를 순서대로 승인받는다.

### 산출물

- exact main Stage5 source state와 verified target archive
- Stage5 saved version, maintenance-on/off private deployments
- migration/readiness `[1..6]`와 synthetic CLI/Profile/card/social/GIF smoke
- 이전 Stage5 rollback version과 final safe baseline
- `mydocs/working/task_m100_144_stage3.md`

제품 source, tracked hosting manifest, access policy와 durable data는 변경하지 않는다.

### 실행 순서

1. Site/project/access/current version/deployment/environment keys, D1 migration과 active operation을 읽기
   전용으로 확인한다. secret value나 row data는 읽지 않는다.
2. exact owner-only 조건이 아니거나 target/resource가 production과 겹치면 중단한다.
3. clean exact main worktree에서 stage5 target을 materialize하고 production build·verifier 뒤 Sites helper로
   repository 밖 archive를 만든다.
4. source/save Gate 승인 뒤 Stage5 source write credential로 exact main을 per-command push하고 동일 SHA와
   archive로 saved version 한 개를 만든다. source SHA·digest·migration을 검증한다.
5. maintenance/deploy Gate 승인 뒤 ephemeral secret과 maintenance enabled environment를 적용하고 같은 saved
   version을 private deploy한다. 같은 deployment ID를 terminal `succeeded`까지 poll한다.
6. protected `migrate`, `readiness`로 exact `[1..6]`을 확인한다. drift나 active operation이면 중단한다.
7. maintenance disabled·token remove environment로 같은 version을 private redeploy하고 health `200`, operator
   `404`를 확인한다.
8. synthetic smoke Gate 승인 뒤 explicit stage5 origin CLI, OAuth/session/logout, Profile, publish/unpublish,
   README card, dark/light social pixel·metadata와 Share Studio GIF/PNG를 검증한다.
9. synthetic visibility와 token/session을 안전 baseline으로 복원하되 account/D1/R2 data는 삭제하지 않는다.
10. `task-stage-report`로 Stage5 version/deployment/environment/migration·smoke와 rollback을 commit하고 Stage 4
    승인을 요청한다.

### 검증

```bash
npm run package:sites-target -- \
  --target stage5 \
  --archive {absolute_temporary_stage5_archive} \
  --source-sha {exact_main_sha} \
  --package-helper {absolute_sites_plugin_package_helper} \
  --expected-project-id appgprj_6a62f58721788191a7cd82f37320f244
npm run build:production
npm run verify:sites-fullstack
npm run sites:profile-maintenance -- migrate --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
curl -fsS https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/healthz
curl -sS -o /dev/null -w '%{http_code}' https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/__ops/profile-maintenance
git diff --check
```

Sites connector arguments는 실행 전 tool schema를 다시 읽고 사용한다. package helper 절대 경로는
현재 로드한 `sites-hosting` skill package의 root-level `scripts/package-site.sh`를 사용한다.

### 완료·중단 조건

- 완료: exact main Stage5 version이 owner-only로 성공 배포되고 migration 1..6, safe environment,
  health/operator와 synthetic Task #141/#39 smoke가 통과한다.
- 중단: owner-only 불확실, target mismatch, archive/source mismatch, save/deploy failure, migration drift,
  safe baseline 복원 실패, pixel/GIF/기존 flow 회귀.

### 커밋

```text
Task #144 Stage 3: Stage5 owner-only 통합 후보 검증
```

## Stage 4 — Production baseline과 saved version 준비

### 진입 조건

- Stage 3 보고서와 Stage5 exact-main 결과가 승인됐다.
- Production current access·version·environment·migration과 rollback 후보를 먼저 읽기 전용으로 확인한다.
- Production source push와 saved version 생성 Gate가 승인됐다. live deploy는 아직 승인 범위가 아니다.

### 산출물

- production preflight와 직전 rollback version/source/environment/access
- exact main production archive와 saved version
- live deployment가 직전 version을 유지한다는 확인
- `mydocs/working/task_m100_144_stage4.md`

### 실행 순서

1. production project/origin/public access/current version/deployment/environment key, migration 1..6,
   maintenance disabled, operator secret absent와 active operation을 읽기 전용으로 기록한다.
2. 직전 production saved version 5/source `27e8705...`를 rollback 후보로 삼을 수 있는지 migration
   compatibility와 active deletion operation으로 확인한다. 실제 live 값이 다르면 관찰값을 우선하고 보고한다.
3. exact main clean worktree에서 production target을 materialize·build·verify·package한다. Stage5 artifact와
   source/migration/product tree가 같고 target identity만 production인지 확인한다.
4. source/save Gate 승인 뒤 production source repository에 exact main을 per-command push한다.
5. exact main SHA와 archive로 saved version 한 개를 만들고 source SHA, digest, project/binding, migration을
   검증한다.
6. 현재 live deployment가 여전히 직전 version이고 access/environment가 변하지 않았음을 확인한다.
7. `task-stage-report`로 production baseline, candidate saved version과 rollback 입력을 commit하고 Stage 5
   public deployment 승인을 요청한다.

### 검증

```bash
npm run package:sites-target -- \
  --target production \
  --archive {absolute_temporary_production_archive} \
  --source-sha {exact_main_sha} \
  --package-helper {absolute_sites_plugin_package_helper} \
  --expected-project-id appgprj_6a83ecc3c4c08191bda7f14d7c26c974
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
git diff --check
```

### 완료·중단 조건

- 완료: production exact-main saved version이 생성됐지만 live deployment/access/environment는 직전 상태다.
- 중단: project/origin/access ambiguity, maintenance/operator baseline 불일치, active operation, archive/source/
  migration mismatch, credential/path blocker, saved version 실패 또는 live version의 예상 외 변경.

### 커밋

```text
Task #144 Stage 4: Production saved version과 rollback 준비
```

## Stage 5 — Production public deployment와 비파괴 smoke

### 진입 조건

- Stage 4 보고서, exact production saved version과 rollback 후보가 승인됐다.
- Sites read-only 응답에서 existing public access와 current user owner가 다시 확인됐다.
- exact production URL과 resolved public access를 사용자에게 제시하고 `Publish publicly`에 해당하는 명시
  승인을 받았다. 승인 전에는 maintenance/environment/deploy를 실행하지 않는다.

### 산출물

- maintenance-on/off production deployments와 exact version/source
- migration/readiness `[1..6]`, final public access·safe environment
- OAuth/CLI/Profile/card/social/GIF 비파괴 hosted smoke
- rollback readiness와 `mydocs/working/task_m100_144_stage5.md`

### 실행 순서

1. live public version/access/environment/migration/active operation을 마지막으로 재확인한다.
2. public deploy 승인 뒤 ephemeral maintenance secret으로 environment를 enabled/token-present로 만들고
   exact saved version을 existing-public deploy한다. terminal `succeeded`까지 같은 deployment ID를 poll한다.
3. protected migration과 readiness를 실행해 exact `[1..6]`을 확인한다.
4. maintenance disabled·token remove environment로 같은 saved version을 public redeploy하고 success를 확인한다.
5. public access가 기존과 같고 `/healthz` `200`, operator route `404`, root 정상인지 확인한다.
6. npm `@latest=0.1.4` default origin으로 help/version/status와 승인된 non-destructive login/submit 경계를
   확인한다. 기존 credential/session을 출력하거나 저장소에 복사하지 않는다.
7. production Profile/Share Studio에서 기존 data를 이용해 원래 visibility를 기록하고 private preview,
   publish/unpublish가 필요한 경우 동일 baseline으로 복원한다.
8. README card, social document/image의 GET/HEAD/304, content type, ETag/revision과 2400×1260 light/dark
   geometry·surface를 확인한다. 외부 SNS는 작성 화면까지만 확인하고 게시·초안 저장은 하지 않는다.
9. 브라우저 Share Studio에서 GIF 생성 완료, `image/gif` blob/signature와 download/save UI, 기존 PNG
   download를 확인한다. 반복 대용량 생성은 하지 않는다.
10. error event에 secret/URL/query가 없고 기존 durable data/public access가 보존됐는지 확인한다.
11. failure 시 safe environment 여부와 active operation을 확인한 뒤 자동 rollback하지 않고 exact 이전
    version·환경 입력을 제시해 작업지시자 승인을 요청한다.
12. `task-stage-report`로 production deployment/smoke/rollback 결과를 commit하고 Stage 6 승인을 요청한다.

### 검증

```bash
npm run sites:profile-maintenance -- migrate --origin https://codex-usage-profile.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile.meleeisdeveloping.chatgpt.site
curl -fsS https://codex-usage-profile.meleeisdeveloping.chatgpt.site/healthz
curl -sS -o /dev/null -w '%{http_code}' https://codex-usage-profile.meleeisdeveloping.chatgpt.site/__ops/profile-maintenance
npm view codex-usage-profile dist-tags version
npm run verify:npm-release
git diff --check
```

CLI, browser, media와 pixel 검증은 raw credential·사용량·개인 식별 payload를 기록하지 않고 status,
dimensions, content type, ETag와 pass/fail만 단계 보고에 남긴다.

### 완료·중단 조건

- 완료: exact-main production version이 public으로 성공 배포되고 migration 1..6, safe environment,
  health/operator, npm/CLI, Task #141/#39와 기존 user flow가 통과하며 data/access가 보존된다.
- 중단: public 승인 부재, access drift, deployment/readiness failure, safe baseline 복원 실패, health/operator
  이상, pixel/GIF/기존 flow 회귀 또는 data integrity 의심.

### 커밋

```text
Task #144 Stage 5: Production 통합 배포와 공개 smoke 완료
```

## Stage 6 — Release provenance와 운영 handoff

### 진입 조건

- Stage 5 report와 production final state가 승인됐다.
- stage5와 production remote state는 read-only audit만 수행한다.

### 산출물

수정 후보:

- `docs/production-hosting.md`
- `docs/sites-operations.md` — 실제 connector/tool contract drift가 확인된 경우만
- `mydocs/orders/20260828.md`

신규:

- `mydocs/working/task_m100_144_stage6.md`

`docs/npm-release.md`, `docs/readme-card.md`, product source, package, migration과 hosting manifests는 변경하지 않는다.

### 실행 순서

1. main release PR/SHA/tree, stage5 version/deployment/access/environment/migration, production version/
   deployment/access/environment/migration과 npm `0.1.4`를 읽기 전용으로 대조한다.
2. `docs/production-hosting.md`의 current production baseline과 release history를 실제 관찰값으로 최소
   갱신하고 이전 version 5/source와 새 rollback 관계를 기록한다.
3. 기존 `docs/sites-operations.md` 절차와 실제 connector/tool contract가 달랐던 경우만 해당 Gate 문장을
   최소 보정한다. 차이가 없으면 변경하지 않는다.
4. Stage 1 local certification을 exact main에서 전체 재실행한다. focused Task #141/#39와 public release
   scan을 포함한다.
5. 공식 문서가 raw secret, 개인 data, temporary path를 포함하지 않고 source/version/state가 remote와
   일치하는지 확인한다.
6. `task-stage-report`로 Stage 6 source·공식 문서·보고·오늘할일을 한 commit에 묶고 최종 보고서 작성
   승인을 요청한다.

### 검증

```bash
npm ci --ignore-scripts --no-audit --no-fund
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/shareStudio.test.js
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
rg -n "current production|saved version|deployed source|migration|environment" docs/production-hosting.md
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: main/stage5/production/npm provenance와 공식 baseline이 일치하고 전체 local/hosted 검증, rollback
  기록과 credential scan이 통과한다.
- 중단: remote state drift, 공식 문서와 실측 불일치, 전체 회귀 실패, 민감 정보·temporary path 노출 또는
  runbook contract 변경이 수행계획 범위를 넘음.

### 커밋

```text
Task #144 Stage 6: Release provenance와 운영 handoff 완료
```

## 검증

- 각 Stage는 검증 명령과 remote state를 확인한 뒤 `task-stage-report`로 source·보고서·오늘할일을 같은
  commit에 묶는다. 실패한 Stage는 보고서·commit을 완료 상태로 만들지 않는다.
- Stage 1과 6의 full regression은 exact candidate/main product source에서 실행한다.
- Sites save/deploy는 build 성공, source push SHA와 archive equality를 확인한 경우만 실행한다.
- deployment는 version 저장과 구분하며 public production은 resolved access를 명시한 사용자 승인 없이는
  실행하지 않는다.
- environment/migration 실패 시 maintenance 상태를 임의로 해제하거나 D1 metadata를 조작하지 않는다.
- pixel 검증은 이미지 인상만 보지 않고 canvas size, card bounds, alpha와 representative RGB를 판정한다.
- GIF 검증은 UI 노출만 보지 않고 MIME, binary signature/frame contract와 Worker error boundary를 판정한다.
- 계획 밖 source/schema/access/data 변경이 필요하면 구현계획서를 먼저 갱신하고 승인을 받는다.

## 커밋

- `Task #144 Stage 1: 통합 배포 후보와 Local 검증 고정`
- `Task #144 Stage 2: exact main release 승격 완료`
- `Task #144 [Stage 2.1]: #146 반영 배포 후보 재인증`
- `Task #144 [Stage 2.2]: #146 포함 exact main 재승격`
- `Task #144 Stage 3: Stage5 owner-only 통합 후보 검증`
- `Task #144 Stage 4: Production saved version과 rollback 준비`
- `Task #144 Stage 5: Production 통합 배포와 공개 smoke 완료`
- `Task #144 Stage 6: Release provenance와 운영 handoff 완료`
- 각 Stage commit은 대응 `mydocs/working/task_m100_144_stage{N}.md`와 오늘할일 갱신을 포함한다.
- 모든 Stage 승인 뒤 `task-final-report`가 최종 보고서, 오늘할일 완료, final commit, `publish/task144`
  push와 `devel` 대상 Open PR을 처리한다.

## 단계 의존성

- Stage 2는 Stage 1 Local certification과 candidate SHA 승인 뒤에만 시작한다.
- Stage 2.1은 #146/PR #147 병합과 replacement candidate 승인 뒤에만 시작한다.
- Stage 2.2는 Stage 2.1 전체 재인증 승인 뒤에만 시작한다.
- Stage 3은 Stage 2.2의 새 exact main merge와 tree equality 승인 뒤에만 시작한다.
- Stage 4는 Stage 3 Stage5 owner-only migration·smoke 승인 뒤에만 시작한다.
- Stage 5는 Stage 4 production saved version·rollback 승인과 별도 public deploy 승인 뒤에만 시작한다.
- Stage 6은 Stage 5 production safe baseline·hosted smoke 승인 뒤에만 시작한다.
- 각 Stage는 단계 보고서 승인 없이 다음 Stage로 넘어가지 않는다.

## 위험과 대응

- **Candidate drift**: 새 `devel` merge를 자동 포함하지 않고 새 SHA·PR 목록을 제시해 재승인받는다.
- **Exact source 불일치**: candidate/main tree, pushed source, archive, saved version 중 하나라도 다르면 deploy하지 않는다.
- **Cross-target 배포**: project/origin/binding/access preflight mismatch를 fail closed한다.
- **Public access 오배포**: production resolved access와 URL을 바로 직전 확인하고 명시 public 승인 뒤에만 deploy한다.
- **Maintenance 고착**: environment revision과 직전 key set을 기록하고 safe baseline 복원 실패 시 smoke/rollback을 멈춘다.
- **Durable data 손상**: 신규 migration·data disposal·임의 보정을 금지하고 active deletion operation이면 중단한다.
- **Rollback 비호환**: migration 1..6 additive compatibility와 active operation을 확인한 뒤 별도 승인으로만 이전 app을 deploy한다.
- **라이트/다크 geometry 회귀**: shared pixel tests와 hosted dimensions/representative pixel을 함께 확인한다.
- **GIF browser 자원 사용**: focused unit/E2E와 단일 hosted generation으로 검증하고 반복 대용량 생성을 피한다.
- **Provider/crawler 지연**: application response와 외부 UI/cache 결과를 분리하고 즉시 반영을 release PASS로 요구하지 않는다.
- **Credential 노출**: per-command authorization, secret metadata-only audit와 보고서 금지 목록으로 차단한다.

## 승인 요청 사항

- 6 Stage의 산출물, 검증 명령과 Stage별 commit 경계
- initial candidate/PR #145 이력 보존 → replacement candidate `7fd130c...` 재인증 → 두 번째
  `devel → main` release PR → 새 exact-main Stage5 → production save → 명시 public deploy → handoff 순서
- Stage5 source/save, maintenance/deploy/migration, synthetic smoke와 production save/public deploy를 분리한 하위 Gate
- npm `0.1.4`와 tag를 변경하지 않고 compatibility만 검증하는 방향
- production public access·durable data를 보존하고 temporary application maintenance만 사용하는 방향
- `docs/production-hosting.md`의 live baseline만 갱신하고 Sites runbook은 실제 contract drift가 있을 때만
  수정하는 문서 위치와 변경 경계

2026-09-01 작업지시자의 #144 재개 지시에 따라 Stage 2.1 replacement candidate Local certification을
시작한다. 완료 후 `task-stage-report`로 검증·보고·커밋한 뒤 Stage 2.2 진행 승인을 요청한다.
