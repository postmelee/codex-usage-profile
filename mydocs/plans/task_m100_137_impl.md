# Task #137 구현계획서 — npm 0.1.4 및 exact-main production 릴리스

수행계획서: [`task_m100_137.md`](task_m100_137.md)
GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
마일스톤: M100

## 승인된 결정과 구현 해석

- Task #134 product source는 다시 설계하지 않는다. 새 npm version은 immutable patch `0.1.4`이며
  `0.1.3` artifact·tag·dist metadata를 수정하지 않는다.
- source 변경은 package manifest·lockfile, CLI/version verifier test, package README의 exact automation
  example과 release 후보 문서에 한정한다. backend API, credential schema, D1 migration, Sites manifest와
  target registry는 변경하지 않는다.
- Sites `save_site_version`은 `commit_sha`가 configured source repository에 실제 push된 HEAD이고 archive도
  같은 source에서 build돼야 한다. 따라서 local candidate 뒤 checkpoint와 release PR로 exact `main`
  commit을 먼저 고정하고, Stage5·npm tag·production은 모두 그 main commit을 provenance로 사용한다.
- `main` merge 자체는 사용자 traffic이나 registry를 변경하지 않는다. exact-main Stage5가 PASS하기
  전에는 npm tag와 production saved version을 만들지 않는다.
- stage5는 `custom` owner-only policy, production은 기존 `public` policy를 유지한다. Stage5 배포는
  verified owner-only일 때 `deploy_private_site_version`, production은 resolved public access를 작업지시자에게
  다시 제시해 승인받은 뒤 `deploy_site_version`을 사용한다.
- stage5와 production 모두 migration source `[1..6]`을 그대로 사용한다. 새 SQL이나 metadata-only
  우회는 만들지 않고 protected readiness의 expected/applied exact match만 통과시킨다.
- 배포 중 runtime write는 temporary `PROFILE_MAINTENANCE_MODE=enabled`와 새 일회성 maintenance secret으로
  닫는다. secret은 repository 밖에서 생성·보관하고 Sites environment에 secret으로 설정한 뒤 readiness
  완료 즉시 제거한다. secret 값은 tool output·문서·Git·shell history에 남기지 않는다.
- npm workflow는 exact `codex-usage-profile-v0.1.4` annotated tag에서 Node 20/22/24를 검증하고 trusted
  publisher stage만 만든다. npm 웹 2FA 승인은 작업지시자가 직접 수행한다.
- production data 삭제, account deletion smoke, access 변경, SNS 게시와 Stage5 disposal은 실행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 원격 mutation | 완료 검증 |
|---|---|---|---|---|
| 1 | 0.1.4 release source와 local certification | version·verifier·README·npm 후보 문서 | 없음 | package/public/Node/E2E/Sites artifact |
| 2 | checkpoint와 exact main release | checkpoint PR, devel→main release PR, exact main SHA | GitHub PR·merge만 | tree equality·CI·branch provenance |
| 3 | exact-main Stage5 owner-only 검증 | Stage5 saved version·deployment·readiness·smoke | Stage5 source/save/env/deploy | owner-only·migration 1–6·synthetic smoke |
| 4 | npm 0.1.4 staged publish | annotated tag, npm stage·registry release | Git tag·npm stage/2FA | Node matrix·integrity·provenance·clean npx |
| 5 | production exact-main patch release | saved version·public deployment·readiness·smoke | production source/save/env/deploy | health·migration·OAuth/CLI/UI/media |
| 6 | release provenance와 handoff | 공식 운영 이력, Stage·최종 보고, final PR | final GitHub PR만 | source/version/state 교차 대조·전체 회귀 |

## 문서 위치 확인

| 파일 | 수행계획서 선택 위치 | Stage 산출물 | 결과 | 변경 원칙 |
|---|---|---|---|---|
| npm runbook·release 이력 | `docs/` | `docs/npm-release.md` | OK | Stage 1 후보 계약, Stage 4·6 실측 provenance만 추가 |
| Sites 운영 runbook | `docs/` | `docs/sites-operations.md` | OK | 도구·Gate contract drift가 있을 때만 최소 수정 |
| production architecture·이력 | `docs/` | `docs/production-hosting.md` | OK | topology는 보존하고 Stage 5 exact source/version 이력만 갱신 |
| npm 사용자 안내 | package root | `packages/codex-usage-profile-cli/README.md` | OK | exact automation example만 `0.1.4`로 정합화 |
| 단계·최종 보고 | `mydocs/` | `mydocs/working/task_m100_137_stage{1..6}.md`, `mydocs/report/task_m100_137_report.md` | OK | 승인·원격 증적·검증 결과를 제품 문서와 분리 |

신규 공식 문서 파일은 만들지 않는다. root README의 일반 명령은 `@latest`를 사용하므로 version 보정을
위한 변경 대상이 아니다.

## 공통 release contract

### Product tree와 provenance

- Stage 1 approved candidate tree는 package version 관련 파일과 작업 문서 외 Task #134 merged tree와
  같아야 한다.
- Stage 2 checkpoint merge 뒤 `origin/devel` tree와 approved candidate tree, release merge 뒤
  `origin/main` tree와 `origin/devel` tree를 비교한다. merge commit SHA는 달라도 product tree는 같다.
- Stage3·5 Sites source repository에는 exact `origin/main` commit을 short-lived per-command Git
  authorization으로 push한다. credential을 remote URL이나 Git config에 저장하지 않는다.
- role별 archive는 `scripts/materialize-sites-target.mjs`와 Sites plugin의 `scripts/package-site.sh`를
  통해 repository 밖 임시 경로에 만들고 production artifact verifier로 target project·origin·binding,
  Worker entry, migration 1–6, secret·절대경로 부재를 확인한다.
- saved version `source.commit_sha`, archive digest, deployment `version_id`와 exact main SHA를 모두
  대조한다.

### Target identity

| 역할 | project | origin | access 기대 | logical binding |
|---|---|---|---|---|
| Stage5 | `.openai/hosting-targets.json`의 `stage5.project_id` | stage5 canonical origin | custom owner-only, owner 1, user/group/external 0 | `DB`, `PROFILE_MEDIA` |
| production | `.openai/hosting.json`과 target registry의 production project | canonical production origin | 기존 public 유지 | `DB`, `PROFILE_MEDIA` |

project ID는 파일과 Sites read-only 응답에서 verbatim 복사하고 새로 만들거나 추정하지 않는다. target
registry와 live project가 다르면 credential 발급·archive save 전 중단한다.

### Environment와 migration

- read-only baseline에서 environment revision과 key 목록만 기록한다. secret plaintext는 읽거나 보고하지
  않고 `is_secret`, present/absent만 판정한다.
- remote maintenance Gate에서는 새 random secret을 repository 밖 ephemeral 저장소에 두고 아래 두 환경
  key만 변경한다.
  - `PROFILE_MAINTENANCE_MODE=enabled`
  - `PROFILE_MAINTENANCE_TOKEN={new secret}`, `is_secret=true`
- 해당 environment revision을 적용하려면 exact saved version을 deploy하고 terminal `succeeded`까지 같은
  deployment ID를 poll한다.
- maintenance CLI는 approved origin과 ephemeral token으로 `migrate`, 이어서 `readiness`를 실행한다.
  `expectedVersions`와 `appliedVersions`가 순서까지 `[1,2,3,4,5,6]`이고 `ready=true`여야 한다.
- 종료 시 `PROFILE_MAINTENANCE_MODE=disabled`, token key remove 후 같은 saved version을 다시 deploy한다.
  operator route 404와 health 200 전에는 사용자 smoke를 시작하지 않는다.
- environment/deploy/migration 중 하나라도 실패하면 maintenance를 임의로 닫지 않고 원인과 직전
  environment/saved version rollback 입력을 보고해 별도 승인을 받는다.

### 증적과 비식별화

- 기록 가능: public Git SHA/tag/PR/check URL, package version·integrity·provenance, Site project/version/
  deployment/access/environment revision, origin, migration list, artifact digest·count, HTTP status·ETag.
- 기록 금지: source repository token, OAuth/maintenance/session/device credential, cookie·Authorization,
  D1 row, R2 body, raw usage, backup payload, 개인 local credential path와 provider exception 원문.
- tool 응답에 secret value가 포함돼도 문서·코멘트·최종 응답에 복제하지 않는다.

## 원격 mutation matrix

| Stage | GitHub/npm | Stage5 | production | 승인 경계 |
|---|---|---|---|---|
| 1 | read-only inventory | read-only baseline만 | read-only baseline만 | 구현계획·Stage 1 승인 |
| 2 | checkpoint PR·merge, release PR·merge | 없음 | 없음 | PR별 작업지시자 merge 승인 |
| 3 | exact main source push only | env, saved version, owner-only deploy 2회, migration/readiness | 없음 | Stage5 save, maintenance/migration, smoke 별도 승인 |
| 4 | annotated tag push, Actions npm stage, 사용자 npm 2FA | 없음 | 없음 | tag push와 npm 웹 2FA 별도 승인 |
| 5 | production source push only | 없음 | env, saved version, public deploy 2회, migration/readiness | resolved public access를 제시한 deploy 승인과 smoke 승인 |
| 6 | 최종 task PR | read-only audit | read-only audit | Stage 5·최종 보고 승인 |

## Stage 1 — 0.1.4 release source와 local certification

### 진입 조건

- 수행계획서와 본 구현계획서의 exact-main 순서 보정, 6 Stage, remote Gate와 제외 범위가 승인됐다.
- `local/task137` worktree는 계획 문서 commit만 포함하고 clean하다.

### 산출물

수정:

- `packages/codex-usage-profile-cli/package.json`
- `package-lock.json`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `scripts/verify-npm-release.mjs`
- `scripts/__tests__/verify-npm-release.test.js`
- `scripts/__tests__/smoke-npm-package-local.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `docs/npm-release.md`
- `mydocs/orders/20260825.md`

신규:

- `mydocs/working/task_m100_137_stage1.md`

실제 `0.1.3` exact fixture가 추가 파일에 있으면 Stage 1 조사 결과와 함께 version-only 변경 대상으로
포함한다. CLI auth/help/UI source, root README, Sites manifest와 migration은 수정하지 않는다.

### 실행 순서

1. `rg`로 package/version fixture와 public `0.1.3` 이력 표현을 분류한다. historical release 이력은
   보존하고 current candidate·exact executable fixture만 `0.1.4`로 바꾼다.
2. package manifest와 lockfile workspace entry를 `0.1.4`로 맞춘다. dependency
   `codex-usage-analyzer@0.4.1`, bin/files/license/repository와 기본 production origin은 유지한다.
3. CLI version test, npm verifier expected package, npm pack normalization fixture와 local smoke expected
   tarball/package ID를 `0.1.4`로 바꾼다.
4. package README의 exact non-interactive example만 `@0.1.4`로 바꾸고 `@latest` 일반 명령은 유지한다.
5. `docs/npm-release.md` current state에 `0.1.4`가 아직 candidate이며 tag·registry·production이 미변경인
   Gate를 기록한다. 게시 결과 값은 추정해 채우지 않는다.
6. dependencies는 `npm ci --ignore-scripts --no-audit --no-fund`로 설치하고 install lifecycle script
   부재를 확인한다.
7. focused version/verifier/smoke test와 public scan을 실행한다.
8. 전체 Node 계약은 로컬 Node 24의 기존 D1 정지를 피하기 위해 비-D1 파일을 Node 24에서, real-workerd
   D1 6개 파일을 Node 22에서 실행해 모든 test를 판정한다. CI package matrix는 Node 20/22/24를 별도로
   실행한다.
9. 전체 Playwright, production build, Sites full-stack build/verifier와 target materializer dry-run을
   실행한다.
10. backend, credential schema, migration, hosting manifests와 Task #134 product source에 version 외 diff가
    없는지 path guard로 확인한다.
11. `task-stage-report`로 source·검증·보고서·오늘할일을 한 commit에 묶고 Stage 2 승인을 요청한다.

### 검증

```bash
node --test \
  packages/codex-usage-profile-cli/test/cli.test.js \
  scripts/__tests__/verify-npm-release.test.js \
  scripts/__tests__/smoke-npm-package-local.test.js
node --test scripts/__tests__/scan-public-release-surface.test.js
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
npm test --workspace packages/codex-usage-profile-cli
node --test --test-concurrency=1 {Node 24 비-D1 test 파일}
npx --yes node@22 --test --test-concurrency=1 {real-workerd D1 6개 test 파일}
npm run test:e2e
npm run build:production
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: `0.1.4` candidate, package tarball, public scan, 전체 Node/E2E와 Sites artifact가 통과하고 원격
  mutation은 0건이다.
- 중단: version 외 product/API/schema/manifest 변경 필요, npm name/version 선점, dependency drift,
  public blocker, 전체 계약 fail/cancel 또는 target verifier mismatch.

### 커밋

```text
Task #137 Stage 1: npm 0.1.4 release candidate 고정
```

## Stage 2 — checkpoint와 exact main release

### 진입 조건

- Stage 1 보고서와 exact candidate tree가 승인됐다.
- checkpoint PR과 이후 release PR을 생성하는 Task #137 한정 integration 예외가 승인됐다.

### 산출물

- non-closing checkpoint PR: `publish/task137-checkpoint` → `devel`
- release PR: `devel` → `main`, Issue #137을 닫지 않음
- exact merged `main` release SHA와 tree digest
- `mydocs/working/task_m100_137_stage2.md`
- 오늘할일 상태 갱신

### 실행 순서

1. Stage 1 commit을 `publish/task137-checkpoint`로 push하고 `devel` 대상 Open PR을 만든다. 본문은
   Issue를 close하지 않고 source integration checkpoint임을 명시한다.
2. PR checks와 review를 확인하고 작업지시자가 merge한다. merge 뒤 `origin/devel`을 fetch하고
   `local/task137`을 merge commit까지 fast-forward한다.
3. approved candidate commit tree와 merged devel tree가 같고 version/package artifact가 unchanged인지
   확인한다.
4. `devel` head에서 `main` 대상 release PR을 만든다. diff가 Task #137 release source만 포함하고
   base/head, exact tree와 CI가 맞는지 확인한다.
5. 작업지시자가 release PR을 merge한다. fetch 뒤 origin/main release SHA와 tree를 고정한다.
6. origin/main tree가 approved devel tree와 같고 `0.1.4` tag가 아직 없으며 npm registry `0.1.4`도
   아직 없는지 확인한다.
7. Sites/npm remote mutation 0건을 read-only로 재확인한다.
8. Stage 2 보고서·오늘할일을 local task branch에 commit하고 Stage 3 Gate 승인을 요청한다.

### 검증

```bash
gh pr view {checkpoint_pr} --json state,baseRefName,headRefName,mergeCommit,statusCheckRollup
gh pr view {release_pr} --json state,baseRefName,headRefName,mergeCommit,statusCheckRollup
git rev-parse origin/devel origin/main
git diff --exit-code {approved_candidate}^{tree} origin/devel^{tree}
git diff --exit-code origin/devel^{tree} origin/main^{tree}
git tag --list codex-usage-profile-v0.1.4
npm view codex-usage-profile@0.1.4 version
git diff --check
```

registry 조회는 404/not found를 기대하며 다른 network failure와 구분한다.

### 완료·중단 조건

- 완료: 두 PR이 승인·merge되고 exact main tree가 approved candidate와 같으며 npm/Sites mutation이 없다.
- 중단: merge conflict, unrelated diff, CI failure, tree mismatch, version/tag 선점 또는 Issue 조기 close.

### 커밋

```text
Task #137 Stage 2: checkpoint와 exact main release 고정
```

## Stage 3 — exact-main Stage5 owner-only 검증

### 진입 조건

- Stage 2 exact main SHA와 tree equality가 승인됐다.
- Stage5의 resolved access가 custom owner-only이고 기존 rollback saved version·environment baseline이
  read-only로 확인됐다.
- Stage5 source push/save, temporary maintenance, owner-only deploy와 synthetic smoke를 각각 승인받았다.

### 산출물

- exact main source가 push된 Stage5 source repository state
- Stage5 target archive와 saved version
- maintenance-on deployment, migration/readiness `[1..6]`, maintenance-off deployment
- synthetic OAuth·CLI·Profile·device approval·card/share smoke 결과
- `mydocs/working/task_m100_137_stage3.md`

제품 source와 tracked target manifest는 변경하지 않는다.

### 실행 순서

1. Sites `get_site`, `list_site_versions`, `get_environment_variables`, `read_database_overview`로 Stage5
   project/access/current version/environment key/table baseline을 read-only 확인한다.
2. policy가 `custom`, owner allowlist 1, 추가 user/group/external 0인지 확인한다. 아니면 access를 바꾸지
   않고 중단한다.
3. detached clean exact main worktree에서 Stage5 target을 materialize·package하고 archive project/origin/
   binding/source SHA와 migration 6개를 검증한다.
4. `create_source_repository_write_credential`을 한 번 호출하고 returned remote/branch에 exact main을
   per-command auth header로 push한다. token은 출력·persist하지 않는다.
5. exact main SHA와 archive로 `save_site_version`을 호출하고 returned source SHA/archive digest를 대조한다.
6. 별도 Gate 승인 뒤 ephemeral maintenance secret을 생성해 Stage5 environment를 enabled/token present로
   갱신한다.
7. saved version을 `deploy_private_site_version`으로 배포하고 terminal status까지 poll한다.
8. approved Stage5 origin에서 `migrate`, `readiness`를 실행하고 expected/applied `[1..6]`을 확인한다.
9. environment를 disabled/token removed로 바꾸고 같은 saved version을 다시 private deploy한다.
10. operator route 404, health 200과 error log의 secret/query/identity 비노출을 확인한다.
11. 격리된 synthetic credential directory와 explicit `--server {stage5}`로 login/status/submit을
    수행하고 EN/KO empty Profile, device approval 완료 guide 제거, private preview, publish/unpublish,
    README fixed URL·revision share metadata를 확인한다.
12. test session/token은 revoke/logout하고 profile visibility를 private baseline으로 복원한다. D1/R2
    deletion이나 기존 operation 변경은 하지 않는다.
13. Stage 3 보고서·오늘할일을 commit하고 npm tag Gate 승인을 요청한다.

### 검증

- Sites version source SHA = exact main SHA
- deployment 2회 모두 `succeeded`, access revision 불변
- environment 최종 maintenance disabled·token absent
- readiness expected/applied `[1,2,3,4,5,6]`
- `/healthz` 200, operator route 404
- explicit-origin CLI와 UI/card/share smoke PASS
- recent error log의 safe field/redaction contract PASS
- production project/version/environment mutation 0건

### 완료·중단·원복 조건

- 완료: exact-main Stage5 candidate가 owner-only, migration-ready, maintenance-off 상태에서 전체 synthetic
  smoke를 통과한다.
- 중단: access mismatch, source/archive mismatch, deployment failure, migration drift, secret removal 실패,
  health/operator failure 또는 smoke regression.
- 원복: mutation 단계에 따라 maintenance를 유지하고 직전 approved saved version/environment baseline을
  제시해 별도 승인 뒤 복원한다. 임의 SQL/data cleanup은 하지 않는다.

### 커밋

```text
Task #137 Stage 3: exact main Stage5 release 검증 완료
```

## Stage 4 — npm 0.1.4 staged publish

### 진입 조건

- Stage 3 Stage5 PASS와 exact main SHA가 승인됐다.
- registry `0.1.4`와 tag가 없고 trusted publisher workflow·environment가 기존 계약과 일치한다.
- annotated tag push와 npm 웹 2FA를 각각 승인받았다.

### 산출물

- annotated tag `codex-usage-profile-v0.1.4`
- GitHub Actions Node 20/22/24 verify와 npm staged package
- 사용자 2FA 승인 뒤 public `codex-usage-profile@0.1.4`, `latest=0.1.4`
- registry integrity·provenance·tarball와 clean npx smoke
- `docs/npm-release.md` 0.1.4 실측 이력
- `mydocs/working/task_m100_137_stage4.md`

### 실행 순서

1. exact main manifest/version, tag 부재, registry 부재와 GitHub Actions trusted publisher workflow를
   다시 확인한다.
2. `origin/main`에 exact annotated tag를 만들고 tag object·peeled commit을 확인한 뒤 push한다.
3. tag workflow의 Node 20/22/24 verify와 `Stage npm package for approval`을 같은 run ID로 추적한다.
4. workflow가 npm stage를 만든 뒤 작업지시자에게 npm 웹에서 package `0.1.4`, source repository,
   provenance와 staged status를 확인하고 2FA 승인하도록 요청한다.
5. 사용자의 완료 응답 뒤 `npm view`로 version, dist-tags, dependency, repository, dist integrity·shasum과
   attestation/provenance를 read-only 검증한다.
6. registry tarball file list·size·integrity를 local approved candidate와 대조한다.
7. 격리된 HOME/XDG/npm cache에서 exact `@0.1.4`와 `@latest` version/help/status를 실행하고 default origin
   guard를 확인한다. 실제 login/submit은 Stage 5 production deployment 뒤 수행한다.
8. `docs/npm-release.md`에 실제 run, tag, source, integrity, tarball과 stage/2FA 결과를 기록한다.
9. Stage 4 보고서·오늘할일을 commit하고 production Gate 승인을 요청한다.

### 완료·중단 조건

- 완료: registry `0.1.4`, latest, provenance/integrity/tarball과 clean install이 exact main candidate와 같다.
- 중단: tag/source/version mismatch, any Node verify failure, stage 실패, npm 웹 provenance 불일치, 2FA
  미승인, registry integrity 또는 package surface mismatch.
- registry 게시 전 실패는 tag를 이동하지 않는다. 게시 뒤 결함은 같은 version을 덮어쓰지 않고 설치
  권고 중단과 별도 patch/deprecate Gate로 넘긴다.

### 커밋

```text
Task #137 Stage 4: npm 0.1.4 provenance 게시 검증 완료
```

## Stage 5 — production exact-main patch release

### 진입 조건

- Stage 4 npm release와 Stage3 exact-main Stage5 PASS가 승인됐다.
- production Site read-only baseline에서 current access가 public, rollback saved version, environment baseline,
  current source와 migration 상태가 확인됐다.
- production source push/save, resolved public access deployment, temporary maintenance/migration, smoke를
  각각 명시 승인받았다.

### 산출물

- exact main production source push·target archive·saved version
- maintenance-on public deployment, protected migration/readiness, maintenance-off public deployment
- OAuth·CLI stale credential recovery·EN/KO Profile/device approval·card/share smoke
- production source/version/deployment/access/environment/migration·rollback 증적
- `docs/production-hosting.md` actual release 이력 최소 보정
- `mydocs/working/task_m100_137_stage5.md`

### 실행 순서

1. `get_site`, `list_site_versions`, `get_environment_variables`, `read_database_overview`와 current deployment
   status로 public access, current source/version, environment key set, DB tables와 rollback 후보를 기록한다.
2. exact main clean worktree에서 production target archive를 build·package·verify한다.
3. short-lived source credential로 production source repository branch에 exact main을 push한다.
4. exact main SHA와 archive로 saved version을 만들고 source/archive digest를 검증한다. 아직 deploy하지 않는다.
5. public access를 사용자에게 명시하고 `deploy_site_version` 사용 승인을 다시 받는다.
6. ephemeral maintenance secret으로 production environment를 enabled/token present로 갱신한다.
7. saved version을 public deployment로 배포하고 terminal status를 poll한다. access policy는 변경하지 않는다.
8. protected `migrate`·`readiness`로 expected/applied `[1..6]` exact match를 확인한다.
9. environment를 disabled/token removed로 바꾸고 같은 saved version을 다시 public deploy한다.
10. health 200, operator 404와 recent error log safe fields를 확인한다.
11. 격리된 clean `@latest=0.1.4` credential로 production login/status/submit을 수행한다. 이어서 해당 token을
    revoke한 stale file credential에서 같은 `submit`이 새 device approval 1회 뒤 성공하는 실제 경로를
    검증한다. browser 승인은 작업지시자가 직접 확인한다.
12. Profile empty EN/KO copy와 device approval 승인 전 guide·승인 후 제거, private preview,
    publish/unpublish, fixed README Markdown 불변, share와 다섯 SNS target revision 갱신, crawler metadata와
    social image GET/HEAD/304를 확인한다. 외부 SNS 작성·게시 화면은 열지 않는다.
13. smoke token/session은 revoke/logout하고 사용자 profile visibility·card setting은 smoke 전 승인된
    baseline으로 복원한다. owner/D1/R2 data 삭제는 하지 않는다.
14. production source/version/deployment/access/environment/migration과 rollback 후보를 공식 문서와 Stage 5
    보고서에 기록하고 Stage 6 승인을 요청한다.

### 완료·중단·원복 조건

- 완료: exact main deployment succeeded, public access revision 불변, migration 1–6, maintenance disabled,
  token absent, operator 404, health 200, clean/stale CLI와 UI/media smoke가 PASS다.
- 중단: public access 변경 요구, source/archive mismatch, deployment/migration/environment failure, health/
  operator failure, OAuth·CLI·UI/media regression 또는 data mutation 의심.
- 원복: failure 단계에서 maintenance를 유지하고 직전 environment와 known-compatible saved version을
  제시해 작업지시자 승인 뒤 deploy한다. schema/data rollback·access 변경은 자동 수행하지 않는다.

### 커밋

```text
Task #137 Stage 5: production exact main patch release 완료
```

## Stage 6 — release provenance와 운영 handoff

### 진입 조건

- Stage 5 production release, 최종 maintenance/access/data baseline과 smoke가 승인됐다.

### 산출물

- `docs/npm-release.md`와 `docs/production-hosting.md`의 최종 실측 provenance
- contract drift가 확인된 경우에만 최소 보정된 `docs/sites-operations.md`
- `mydocs/working/task_m100_137_stage6.md`
- `mydocs/report/task_m100_137_report.md`
- 오늘할일 완료와 final `devel` PR

### 실행 순서

1. exact main SHA, npm tag/version/latest/integrity/provenance, Stage5·production saved version/source/archive,
   deployment/access/environment와 migration 1–6을 read-only 재대조한다.
2. official docs의 current release 값만 실제 결과로 갱신한다. secret, local path, raw data와 추정한 provider
   identity를 기록하지 않는다.
3. final docs가 product tree를 바꾸지 않았음을 path diff로 확인한다.
4. CLI/package/public scan, 전체 Node/E2E, Sites production build/verifier를 재실행한다. remote smoke는
   Stage5·production의 read-only health/operator/card/share 표본으로 재확인한다.
5. npm stage·production save/deploy의 partial artifact, ephemeral credential/archive와 local smoke credential을
   정리한다. remote saved version과 immutable tag는 보존한다.
6. `task-stage-report`, 이어서 승인 후 `task-final-report`로 최종 보고·오늘할일 완료·final PR을 게시한다.

### 검증

- npm `0.1.4` source/tag/integrity/provenance = exact main release
- Stage5·production saved version source = exact main release
- production public access 유지, maintenance disabled·token absent, migration `[1..6]`
- package/public scan, 전체 Node/E2E, Sites build/verifier PASS
- docs와 보고서에 credential/raw data/local path 없음
- product source/manifest/migration diff 0
- `git diff --check`, working tree clean

### 완료·중단 조건

- 완료: registry·Sites·main과 공식 문서의 release provenance가 일치하고 전체 regression이 통과한다.
- 중단: remote drift, npm latest 변경, unexpected Site environment/access/migration, secret/path scan finding 또는
  product tree diff.

### 커밋

```text
Task #137 Stage 6: npm과 production release handoff 완료
```

## 단계 의존성과 승인 순서

- Stage 2는 Stage 1 exact candidate와 local certification 승인 뒤 진행한다.
- Stage 3는 checkpoint·release PR merge와 exact main tree 승인 뒤 진행한다.
- Stage 4는 Stage3 exact-main Stage5 owner-only PASS 뒤 진행한다.
- Stage 5는 npm `0.1.4` registry 검증과 별도의 resolved public deployment 승인 뒤 진행한다.
- Stage 6는 production maintenance 종료·public access 불변·smoke 승인 뒤 진행한다.
- 각 Stage source·보고서·오늘할일은 `task-stage-report`로 commit하고 다음 Stage 전에 다시 승인받는다.
- checkpoint/release PR, tag push, npm 2FA, Stage5/production environment·deploy·migration·smoke는 각 Gate의
  명시 승인 없이는 다음 mutation으로 묶지 않는다.

## 위험과 대응

- **Main source 고정 전 Stage5 저장 불가**: 수행계획 순서를 exact-main 먼저로 보정했다. main merge는
  배포가 아니며 Stage5 PASS 전 npm/production mutation은 금지한다.
- **Sites source credential 노출**: credential은 한 번 발급해 per-command header에만 쓰고 Git config,
  remote URL, logs·reports에 남기지 않는다.
- **환경 revision 적용 누락**: environment update 뒤 같은 saved version을 반드시 deploy하고 returned
  `env_set_revision`을 대조한다.
- **public deployment 오조작**: production get_site의 resolved public access를 사용자에게 제시하고
  `deploy_site_version` 승인 뒤에만 호출한다. access update tool은 사용하지 않는다.
- **maintenance token 잔존**: readiness 직후 remove하고 same version redeploy·operator 404를 확인한다.
  제거 실패는 release 중단 조건이다.
- **npm/Sites source 시차**: exact main/API compatibility를 Stage1·3에서 검증하고 각 공개 mutation의
  rollback 후보를 먼저 확인한다.
- **실사용 data 영향**: destructive smoke를 제외하고 submit/publish setting만 승인된 owner에서 수행한 뒤
  visibility·credential을 복원한다. account/D1/R2 삭제는 금지한다.

## 승인 요청 사항

- Sites `commit_sha` 계약 때문에 수행계획의 Stage 2·3을 `exact main 고정 → Stage5 검증` 순으로 보정한 점
- Stage 1의 `0.1.4` version-only source 범위와 historical `0.1.3` release 이력 보존
- checkpoint와 main release PR은 배포 없이 source만 고정하고 Issue #137을 닫지 않는 integration 예외
- Stage5 owner-only와 production public 배포에서 environment-on deploy → migration/readiness → environment-off
  redeploy를 각각 별도 승인 Gate로 수행하는 방향
- npm tag push와 npm 웹 2FA, production resolved public deployment를 별도 사용자 승인으로 남기는 방향
- production data/access를 보존하고 account deletion·SNS 게시·신규 migration을 제외하는 방향

승인되면 Stage 1의 npm `0.1.4` release candidate와 local certification부터 진행한다.
