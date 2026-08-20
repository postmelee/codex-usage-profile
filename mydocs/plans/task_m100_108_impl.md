# Task #108 구현계획서 — canonical production Site migration과 stage5 테스트 전용 전환

수행계획서: [`task_m100_108.md`](task_m100_108.md)
GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
마일스톤: M100

## 승인된 결정과 구현 해석

- canonical production origin은
  `https://codex-usage-profile.meleeisdeveloping.chatgpt.site`, 기존 validation origin은
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`다.
- Local, stage5, production은 source·migration·logical binding 이름과 test contract만
  공유한다. Site project, D1, R2, OAuth application/secret, session, CLI token,
  rate-limit state와 access policy는 공유하지 않는다.
- `.openai/hosting.json`은 최종적으로 production project를 가리키는 canonical manifest다.
  `create_site` 직전에는 API 전제에 맞춰 `project_id`가 없고 `d1`·`r2`가 `null`인
  unprovisioned manifest로 바꾼다. 생성 응답을 받으면 같은 Stage 안에서 반환된 production
  `project_id`와 logical binding `DB`·`PROFILE_MEDIA`를 즉시 저장한다.
- `.openai/hosting-targets.json`은 production·stage5의 nonsecret project/origin/binding registry다.
  stage5 packaging은 `scripts/materialize-sites-target.mjs`가 repository 밖 임시 packaging root에
  role-specific manifest를 만들고 공식 Sites package helper를 호출한다. tracked canonical
  manifest를 stage5 값으로 바꾸지 않는다.
- 새 project는 Sites 계약에 따라 `create_site`를 한 번만 호출한다. 이 호출은 Site project,
  Sites auth client와 source repository를 만들지만 D1/R2를 인자로 받지 않는다. 따라서 Gate A1은
  owner-only project identity까지만 확정하고, project-owned D1/R2 attach·분리 검증은 exact-main
  private save/deploy가 일어나는 Stage 4로 미룬다. 반환되는 source credential은 사용·저장·출력하지
  않는다.
- production은 exact approved `main` source만 save/deploy한다. stage5도 전환 시점의 exact
  approved `main`을 사용하되 target manifest 차이를 별도 digest와 identity preflight로 증명한다.
- README Markdown은 fixed `/api/share/{handle}` href와 query 없는
  `/u/{handle}/card.png` src를 유지한다. submit·settings 저장 뒤 README Markdown은 byte 단위로
  같고, 공유 링크와 X·LinkedIn·Threads·Facebook·Reddit target만 새 revision으로 바뀐다.
- CLI patch 후보는 `codex-usage-profile@0.1.2`다. production public smoke 전에는 tag와 npm
  publish를 하지 않고, 새 `@latest` end-to-end 확인 전에는 stage5 public 경로를 닫지 않는다.
- Task 완료 직후 canonical Site 운영과 프로젝트 홍보를 시작하므로 root/package README는
  `main` release 전에 launch-ready 사용자 표현으로 고정한다. `candidate`·`unpublished` 같은
  내부 전환 문구는 제거하되, badge·GitHub metadata·전면 copy 개편은 #90에 남긴다.
- 기존 stage5 test state는 보존 요구가 없지만 자동 삭제하지 않는다. Gate E에서 exact owner
  plan/export/digest/count와 production 비공유를 확인한 대상만 guarded maintenance로 삭제한다.
- source integration은 일반 최종 PR과 구분한 non-closing checkpoint PR로 수행한다.
  checkpoint merge 뒤 task branch를 `origin/devel` merge commit까지 fast-forward하고,
  `devel → main` release PR은 작업지시자가 review·merge한다.
- checkpoint와 release PR은 Issue #108을 close하지 않는다. 최종 Stage 승인 뒤
  `task-final-report`가 만드는 최종 `devel` PR만 일반 종료 절차를 따른다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | dual-Site baseline과 target contract 고정 | read-only topology·Sites·npm inventory | source/live/quota/linkage/release stop condition 대조 |
| 2 | Gate A1 project 생성과 canonical source 구현 | owner-only production project, target registry·canonical manifest, CLI `0.1.2` 후보 | project identity, 전체 test/E2E/build/verifier |
| 3 | checkpoint integration과 exact-main release | non-closing task PR, release PR, exact tree provenance | PR base/head/check/review와 tree equality |
| 4 | production deploy·public cutover·CLI release | exact-main production, npm `0.1.2` | migration·OAuth·CLI·media·SNS·provenance·rollback |
| 5 | stage5 테스트 전용 전환과 data disposal | owner-only stage5, synthetic state, 승인된 cleanup | resource 비공유·explicit origin·digest/count |
| 6 | runbook 완성·통합 검증과 handoff | 공식 문서, Stage 6·최종 보고서와 final PR | 전체 회귀·public surface·remote state audit |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| Sites 승격·rollback runbook | `docs/` | `docs/sites-operations.md` | OK | Stage 2 초안, Stage 6 실측 확정 |
| production architecture | `docs/` | `docs/production-hosting.md` | OK | project·storage·OAuth·provenance 경계 |
| README card 계약 | `docs/` | `docs/readme-card.md` | OK | fixed README/revision share 유지 |
| CLI 사용자 문서 | `docs/` | `docs/cli-submit.md` | OK | production default와 stage5 override |
| npm package 문서 | package 내부 | `packages/codex-usage-profile-cli/README.md` | OK | 배포 tarball의 `0.1.2` 사용법 |
| npm release 결과 | 기존 `docs/` | `docs/npm-release.md` | OK | 수행계획 예상 목록에는 없지만 기존 release 진실 원천이므로 Stage 4 실측 결과만 최소 보정 |
| 공개 진입 문서 | repository root | `README.md` | OK | 기능적 hostname·version만 수정, 전면 copy·metadata는 #90 |
| 단계·최종 보고서 | `mydocs/` | `working/task_m100_108_stage{1..6}.md`, `report/task_m100_108_report.md` | OK | Hyper-Waterfall 증적 |

신규 제품 문서는 만들지 않는다. `docs/npm-release.md` 추가 수정 범위를 본 구현계획 승인에
포함한다.

## 공통 환경·배포 계약

### Target identity

- canonical source manifest는 production `project_id`, `d1: DB`, `r2: PROFILE_MEDIA`만 가진다.
- tracked `.openai/hosting-targets.json`은 production·stage5 role별 project, origin, D1/R2 logical
  binding만 기록하고 credential은 기록하지 않는다.
- stage5 target materialization은 repository 밖 임시 staging tree/archive에서만 수행한다.
  materializer는 live preflight project id를 별도 필수 입력으로 받고 exact clean source에서
  기존 `dist`를 제거한 뒤 production artifact를 새로 build한다. 공식 `package-site.sh`가 만든
  archive를 임시 경로에 다시 풀어 generated manifest와 production verifier를 반복 검증한다.
- packaging preflight는 requested role, resolved project, expected origin, D1/R2 binding,
  live project id, exact clean source SHA, target manifest digest와 archive digest가 모두 맞아야
  통과한다. archive 생성·검증 실패 시 이번 실행이 만든 partial archive는 제거한다.
- project/origin/source/binding 중 하나라도 어긋나면 credential 발급, source push,
  `save_site_version`, deploy를 시작하지 않는다.
- Stage 1에서 안전한 materialization을 지원하지 않는 것으로 확인되면 Stage 2를 시작하지 않고
  구현계획 보정 승인을 다시 받는다.

### Source와 artifact provenance

- source 변경은 `local/task108`에서 검증한 뒤 checkpoint PR로 `devel`에 integration한다.
- production artifact는 merged exact `main`의 detached clean worktree에서 새로 build·package한다.
- 공식 Sites package helper와 기존 artifact verifier를 모두 사용하고
  `dist/server/index.js`, static assets, final hosting manifest, migration `0001..0005`를 확인한다.
- saved version `commit_sha`, requested source, archive source와 deployed source는 같아야 한다.

### Access·인증·durable data

- 새 production Site는 Gate A1 직후 owner-only 상태를 유지한다. shared/public만 가능하면 중단하고
  resolved access를 제시해 다시 승인받는다.
- production과 stage5는 서로 다른 GitHub OAuth application/client secret을 사용한다.
  OAuth app 생성·callback 보정은 exact 대상과 권한을 제시한 별도 승인 뒤 수행한다.
- session/maintenance secret도 환경별 새 값이며 값은 output·문서·commit에 기록하지 않는다.
- production D1/R2는 Stage 4 exact-main private save/deploy에서 production project에 처음
  attach·provision하고 empty baseline과 stage5 비공유를 검증한다. stage5 data를 import하거나
  production fixture로 쓰지 않는다.
- stage5 삭제는 `plan → export → delete-account --apply`와 exact digest/count guard를 사용한다.
  retention·orphan cleanup은 각각 dry-run과 별도 apply 승인을 거친다.
- backup은 repository 밖 mode `0600` 파일로만 만들고 경로·payload를 보고서에 기록하지 않는다.

## 공통 증적·비식별화 규칙

- 기록 가능: public Git SHA, PR/check URL, project/version/deployment/access/environment revision,
  origin, migration list, bounded count, status, ETag, package integrity/provenance, artifact digest.
- 기록 금지: OAuth/source/maintenance/session/token credential, cookie, authorization header,
  D1 row·R2 body, raw usage, backup payload와 local credential path.
- error/log는 generic code·count·redaction 여부만 남기고 request body와 provider exception을
  복제하지 않는다.

## 원격 mutation matrix

| Stage | GitHub | Sites/version | Access/environment | D1/R2·identity | 승인 경계 |
|---|---|---|---|---|---|
| 1 | read-only | list/get only | metadata only | overview/count only | 구현계획 승인 후 |
| 2 | 없음 | Gate A1 `create_site` 1회, save/deploy 없음 | owner-only 확인, secret 없음 | D1/R2 미생성·미검증 | Stage 1 승인 + Gate A1 |
| 3 | checkpoint·release PR, merge는 작업지시자 | 없음 | 없음 | 없음 | Stage 2 승인, PR별 merge 지시 |
| 4 | Gate C npm tag/Actions | exact-main save/private deploy, Gate B public | production 전용 environment | Gate A2 D1/R2 attach·분리, migration·disposable smoke | Stage 3 + Gate A2/private/Gate B/Gate C 승인 |
| 5 | 없음 | exact-main stage5 save/private deploy | Gate D owner-only | Gate E exact cleanup | Stage 4 + Gate D/Gate E 승인 |
| 6 | final task PR | read-only audit | 변경 없음 | 삭제·copy 없음 | Stage 5·최종 보고 승인 |

## Stage 1 — dual-Site baseline과 target contract 고정

### 산출물

- 신규: `mydocs/working/task_m100_108_stage1.md`
- 수정: 실제 작업일의 `mydocs/orders/yyyyMMdd.md`
- target 가정이 달라질 때만 본 구현계획을 보정하고 재승인

제품 source, 공식 문서와 remote state는 수정하지 않는다.

### 실행 순서

1. fetch 뒤 task/devel/main SHA, merge-base, ahead/behind, 열린 PR과 병렬 변경을 확인한다.
2. Issue #108과 #84/#100/#101/#89/#90 경계를 대조한다.
3. Sites connector로 stage5 project/version/source/access/environment key 목록과 D1 overview를
   read-only 조회한다. connector가 row를 읽지 않는 bounded count를 제공할 때만 count를 기록하고,
   secret 값과 DB row는 읽지 않는다.
4. `list_sites`로 Site 수와 slug 충돌을 확인한다. quota·permission·slug availability가 create에서만
   확정되면 Gate A1 terminal 판정으로 기록한다.
5. hosting manifest, Sites skill과 connector argument를 대조해 canonical production manifest와
   stage5 temporary materialization 절차를 명령 단위로 고정한다.
6. npm `latest`, `0.1.2` 존재 여부, Git tag/Release와 publish workflow를 read-only 확인한다.
7. production OAuth app/callback과 필요한 environment key를 확인하되 만들거나 변경하지 않는다.
8. Gate A1 입력으로 slug, plan/quota, owner-only project 1개, unprovisioned→canonical manifest
   전환, access와 실패 중단 조건을 제시한다. D1/R2 생성·분리는 Gate A2로 명시한다.
9. `task-stage-report`로 보고서·오늘할일을 검증·커밋하고 승인을 요청한다.

### 검증

```bash
git fetch origin
git rev-parse HEAD origin/devel origin/main
git merge-base origin/main origin/devel
git rev-list --count origin/main..origin/devel
git rev-list --count origin/devel..origin/main
gh issue view 108
gh pr list --state open
npm view codex-usage-profile dist-tags versions --json
git tag --list 'codex-usage-profile-v*'
git diff --check
git status --short
```

Sites 검증은 `list_sites`, `get_site`, `list_site_versions`, `get_site_version`,
`get_deployment_status`, `get_environment_variables`, `read_database_overview`만 사용한다.

### 완료·중단 조건

- 완료: stage5 baseline/rollback, 관찰 가능한 Site 수·slug 상태, safe target materialization,
  npm `0.1.2` 가용성과 Gate A1/A2 exact 입력이 고정되고 remote mutation이 0건이다.
- 중단: topology/병렬 충돌, baseline 식별 실패, quota·결제·권한·slug 문제, target preflight 부재,
  `0.1.2` 또는 대응 tag 선점, release workflow drift.

### Gate A1 exact 입력

- local prerequisite: `.openai/hosting-targets.json`의 production `project_id: null`과 stage5
  identity를 검토하고 canonical `.openai/hosting.json`을 `project_id` 없이 `d1: null`,
  `r2: null`인 unprovisioned form으로 만든다.
- one-shot mutation: `title=Codex Usage Profile`, `slug=codex-usage-profile`,
  `description=Canonical production Site for Codex Usage Profile.`로 `create_site`를 1회 호출한다.
- immediate persistence: 성공 응답의 production `project_id`를 registry와 canonical manifest에
  저장하고 logical binding `DB`·`PROFILE_MEDIA`를 기록한다. credential은 사용·저장·출력하지 않는다.
- read-only postcheck: `get_site`의 project/origin이 canonical 값이고 access가 owner-only인지
  확인한다.
- excluded mutation: source push, save/deploy, access 변경, environment/OAuth/GitHub/npm,
  D1/R2 생성·조회, stage5와 사용자 data 변경은 하지 않는다.
- terminal stop: quota·payment·permission·slug conflict, unexpected access/origin, 응답 식별 실패면
  재호출·대체 slug·추가 project·access 보정을 하지 않고 현재 결과만 보고한다.

### 커밋

```text
Task #108 Stage 1: dual Site baseline과 Gate A 계약 고정
```

## Stage 2 — Gate A1 project 생성과 canonical source 구현

### 진입 조건

- Stage 1 보고서, 본 구현계획 보정과 Gate A1 입력이 승인됐다.
- 새 owner-only production project 1개 생성과 create 직전 unprovisioned manifest 변경이
  명시적으로 승인됐다.
- capacity·slug·OAuth·npm stop condition이 없다.

### 산출물

원격:

- canonical slug의 새 private production Site project 1개
- Sites auth client와 source repository identity
- D1/R2, source push·saved version·deployment·environment secret은 없음

신규:

- `.openai/hosting-targets.json`
- `scripts/materialize-sites-target.mjs`
- `scripts/__tests__/materialize-sites-target.test.js`
- `mydocs/working/task_m100_108_stage2.md`

수정:

- `.openai/hosting.json`
- `packages/codex-usage-profile-cli/package.json`
- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/src/config.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `packages/codex-usage-profile-cli/test/config.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `package-lock.json`
- `src/profile-ui/deviceApproval.js`
- `src/profile-ui/__tests__/deviceApproval.test.js`
- `src/profile-ui/__tests__/production-origin-contract.test.js`
- `scripts/smoke-npm-package-local.mjs`와 test
- `scripts/verify-npm-release.mjs`와 test
- `scripts/verify-sites-production-artifact.mjs`와 test
- `README.md`
- `docs/cli-submit.md`
- `docs/readme-card.md`
- `docs/sites-operations.md`
- `docs/production-hosting.md`
- 실제 작업일의 `mydocs/orders/yyyyMMdd.md`

`docs/npm-release.md`는 아직 published 결과가 없으므로 Stage 4까지 수정하지 않는다.

### 실행 순서

1. Gate A1 직전 `list_sites`와 stage5/current topology를 재확인한다.
2. `.openai/hosting-targets.json`에 stage5 identity와 승인된 production slug/origin을 기록하되
   production `project_id`는 `null`로 둔다. canonical `.openai/hosting.json`은 `project_id` 없이
   `d1: null`, `r2: null`인 unprovisioned form으로 바꾼다.
3. exact canonical title·slug·description으로 `create_site`를 한 번만 호출한다. quota, permission,
   slug conflict는 terminal failure로 취급하고 다른 slug나 project를 만들지 않는다.
4. 성공 응답의 production `project_id`를 `.openai/hosting-targets.json`과 canonical
   `.openai/hosting.json`에 즉시 저장하고 logical binding은 `DB`·`PROFILE_MEDIA`로 고정한다.
   source credential은 사용·저장·출력하지 않는다.
5. `get_site`로 project/origin과 owner-only access를 확인한다. owner-only가 아니면 access를
   변경하지 않고 중단한다. source push/save/deploy와 environment mutation은 하지 않는다.
6. `scripts/materialize-sites-target.mjs`가 role registry를 읽어 repository 밖 임시 packaging root에
   validated `dist`와 role-specific manifest를 만들고 공식 Sites package helper를 호출하게 한다.
   production/stage5 project·origin·binding을 바꿔 넣은 negative test는 preflight에서 실패해야 한다.
7. CLI package version/exported version/default origin을 `0.1.2`/production으로 바꾸고
   config·help·package smoke·release verifier를 함께 갱신한다.
8. Device Approval production origin을 같은 값으로 바꾼다. stage5에서는 `--server {stage5}`가
   붙고 production에서는 기본 명령이 유지돼야 한다.
9. root/package/CLI/card/hosting/runbook 문서의 기능적 hostname, fixed README/revision share와
   target preflight를 최소 범위에서 보정한다.
10. submit/settings 전후 README invariant와 공유 링크·다섯 SNS revision test를 재실행한다.
11. focused test, 전체 Node/E2E/build/Sites/npm verifier/public scan을 통과한다.
12. production project에 version·deployment·environment·D1/R2 mutation이 없음을 확인한다.
13. `task-stage-report`로 Stage 2 source·문서·test·보고서를 커밋하고 승인을 요청한다.

### 검증

```bash
node --test \
  packages/codex-usage-profile-cli/test/config.test.js \
  packages/codex-usage-profile-cli/test/cli.test.js \
  src/profile-ui/__tests__/deviceApproval.test.js \
  src/profile-ui/__tests__/production-origin-contract.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  scripts/__tests__/materialize-sites-target.test.js \
  scripts/__tests__/smoke-npm-package-local.test.js \
  scripts/__tests__/verify-npm-release.test.js
npx playwright test tests/profile-ui.spec.js
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
git diff --check
git status --short
```

### 완료·중단·원복 조건

- 완료: production/stage5 project identity가 다르고 새 project는 owner-only·undeployed이며
  D1/R2·environment가 아직 없다. canonical manifest와 CLI/UI default는 production, stage5는
  explicit override다. target materializer와 negative test, `0.1.2` local pack과 전체 회귀가
  통과하며 submit 전후 README는 동일하고 공유 링크·다섯 SNS target만 새 timestamp revision으로
  바뀐다.
- 중단: create quota/permission/access/slug failure, shared resource 정황, target preflight 우회,
  CLI/version/lock/verifier 불일치, README/SNS 회귀 또는 전체 build 실패.
- 생성 뒤 source 구현이 실패하면 project는 private·undeployed로 유지한다. project 삭제나
  stage5 변경은 별도 승인 없이 수행하지 않는다.

### 커밋

```text
Task #108 Stage 2: canonical production source와 target guard 구현
```

## Stage 3 — checkpoint integration과 exact-main release

> 2026-08-18 PR #109 리뷰 뒤 작업지시자는 별도 이슈로 분리하지 않고 Task #108에서
> production 배포, public cutover, CLI/README 전환과 stage5 역할 전환까지 완료한다고
> 다시 확인했다. 이에 따라 아래 checkpoint/release PR은 전체 task를 완료했다고 선언하는
> PR이 아니라 exact-main 배포를 가능하게 하는 **Task #108 한정 선행 integration 예외**다.
> 작업지시자 명시 지시를 우선하는
> `agent_code_hyperfall_rule_conflict.md`의 우선순위에 근거하며, Issue를 close하거나
> `task-final-report`를 호출하지 않는다. 전체 Stage와 remote Gate가 끝난 뒤에만 최종
> 보고서와 task-closing PR을 작성한다. 이 예외를 일반 workflow 규칙으로 확장하지 않는다.

### 진입 조건

- Stage 2 보고서와 exact source candidate가 승인됐다.
- `local/task108`이 clean이고 production project는 private·undeployed다.

### 산출물

- `publish/task108` non-closing checkpoint PR과 merged `devel`
- `devel → main` release PR과 exact merged `main` tree
- 신규: `mydocs/working/task_m100_108_stage3.md`
- 수정: 실제 작업일의 `mydocs/orders/yyyyMMdd.md`

### 실행 순서

1. 최신 `origin/devel`과 Stage 2 branch의 merge-base/diff/CI를 확인한다. 충돌이면 임의
   rebase/merge하지 않고 중단한다.
2. PR #109 리뷰 1~15를 반영한다. checkpoint의 root/package README와 public 명령은 현재
   실제 public stage5와 npm `latest=0.1.1`을 계속 가리키며, canonical/`0.1.2`는
   unpublished·undeployed candidate로만 기술한다. production owner-only smoke 동안 Device
   Approval은 `@latest --server {production}`을 제시하고 Gate C가 끝날 때까지 `--server`를
   생략하지 않는다.
3. materializer는 live read-only preflight에서 얻은 별도 expected project id를 필수 입력으로
   받고, 현재 exact clean source에서 build를 새로 만든다. 공식 helper가 만든 archive를 안전한
   임시 경로에 다시 풀어 manifest·binding·migration·credential/path 검사를 반복한다. 실패 시
   이번 실행이 만든 archive를 정리한다.
4. verifier의 expected project id를 모든 호출 경로에서 필수로 하고 realpath 기반 repository
   외부 경계, 실제 git/helper·CLI argument와 negative test를 보강한다. origin 중복은 runtime
   consumer에서는 줄이되 registry와 independent allowlist의 교차 검증은 보존한다.
5. README·guard·구현계획 보정을 `Task #108 [Stage 3.2]` 커밋으로 고정하고 Stage 2 전체
   검증 중 README·CLI·share 계약에 직접 연결된 focused test와 build/verifier를 재실행한다.
6. `local/task108:publish/task108`을 push하고 base `devel`의 checkpoint PR을 생성한다.
   Issue를 close하지 않으며 Stage 4~6과 remote Gate가 남았음을 본문에 적는다.
7. PR check, review, head SHA와 diff를 확인하고 작업지시자에게 merge를 요청한다.
8. merge 통지 뒤 PR `MERGED`, `origin/devel` source 포함과 remote branch 삭제를 확인한다.
9. 새 local commit이 없는 branch를 `origin/devel` merge commit까지 `git merge --ff-only`한다.
   불가능하면 중단하고 복구 승인을 받는다.
10. integrated `devel` Actions와 clean-worktree 전체 검증을 확인한다.
11. 중복 release PR이 없을 때 `devel → main` PR을 만든다. tag/npm/Sites deploy가 PR merge에
   포함되지 않음을 명시한다.
12. 작업지시자 review·merge 뒤 `origin/main`이 candidate를 포함하고 tree diff가 빈 출력인지
   확인한다.
13. tag, Release, npm publish, Sites source push/save/deploy/access/environment mutation은 하지 않는다.
14. PR·SHA·tree·check 결과를 보고서에 기록하고 Stage 3 커밋 뒤 승인을 요청한다.

### 검증

```bash
git fetch origin
git merge-base --is-ancestor {stage2_sha} origin/devel
gh pr view {checkpoint_pr} --json state,baseRefName,headRefName,headRefOid,reviews,statusCheckRollup
gh pr checks {checkpoint_pr}
gh run list --commit {integrated_devel_sha}
gh pr view {release_pr} --json state,baseRefName,headRefName,headRefOid,reviews,statusCheckRollup
gh pr checks {release_pr}
git merge-base --is-ancestor {integrated_devel_sha} origin/main
git diff --exit-code {integrated_devel_sha} origin/main -- .
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: checkpoint PR과 release PR이 작업지시자 승인 예외에 따라 merge됐고 Issue는 open이며
  exact main tree가 integrated candidate와 같다. public README와 npm `latest`는 stage5/`0.1.1`
  continuity를 유지하고 Sites와 npm remote state는 변하지 않았다.
- 중단: PR base/head/diff/check/review 불일치, main tree mismatch, branch fast-forward 불가,
  Issue 조기 close 또는 예상하지 않은 tag/publish/deploy.

### 커밋

```text
Task #108 Stage 3: checkpoint와 exact main release provenance 기록
```

## Stage 4 — exact-main production deploy·public cutover·CLI release

### Stage 4A — Gate A2 private deploy 입력과 승인

다음을 read-only로 제시한다.

- exact `main` SHA/tree와 production project/origin/private access
- production project에 아직 D1/R2가 없다는 상태, first attach·provision 범위와 migration plan
  `[1,2,3,4,5]`
- production 전용 GitHub OAuth app/callback과 필요한 environment key 이름
- 새 session/maintenance secret 생성 범위와 값 비노출 방식
- exact-main build/archive digest, saved version 1개와 rollback/stop 조건

작업지시자가 Gate A2로 D1/R2 attach·provision, OAuth/environment/source push/save/private
deploy mutation을 승인하기 전에는 credential 발급, environment update와 save/deploy를 수행하지
않는다.

### Stage 4B — exact-main private deployment

1. exact `main` detached clean worktree에서 dependency, 전체 test/E2E/build/verifier를 재실행한다.
2. production target preflight 뒤 source credential을 발급하고 exact main을 요청별 authorization
   header로 push한다.
3. 공식 package helper로 archive를 만들고 project/binding/migration/source/digest를 검증한다.
4. production 전용 OAuth/environment secret을 설정한다. required key 존재만 확인하고 값을 다시
   읽거나 기록하지 않는다.
5. `save_site_version`을 한 번 호출하고 exact main `commit_sha`를 확인한다.
6. `deploy_private_site_version`으로 배포하고 terminal success까지 직접 poll한다.
7. D1 overview와 application surface로 migration exact `[1,2,3,4,5]`, health `200`,
   operator/maintenance 경계와 empty baseline을 확인한다. R2는 logical `PROFILE_MEDIA` binding과
   disposable upload·비열거로 확인한다. connector가 physical provider ID를 노출하지 않으므로
   서로 다른 Site project/target manifest, stage5 state 부재와 교차 영향 0건을 분리 증적으로
   기록하고 physical ID 동일·상이 여부를 추정하지 않는다. 불일치 시 임의 repair하지 않는다.
8. owner-only browser OAuth/session/logout, packed CLI `--server {production}`, submit, revoke,
   private preview, publish/unpublish와 card settings를 disposable state로 검증한다.
9. fixed README/revision share application matrix, D1/R2 publication과 log redaction을 확인한다.
10. saved version/source/deployment/access/environment, public matrix와 rollback을 Gate B 입력으로
    제시한다.

### Stage 4C — Gate B public cutover

1. Gate B 명시 승인 뒤 production access를 public으로 바꾸고 health/readiness를 재확인한다.
2. anonymous landing, auth API와 private/missing JSON/HTML/media 비열거를 먼저 검증한다.
3. disposable CLI login/submit과 profile publish, dark/light·en/ko card, social image의
   GET/HEAD/304/404/503, ETag/revision 정합을 확인한다.
4. hosted UI에서 submit 전후 README Markdown byte equality와 공유 링크·다섯 SNS target의
   새 revision을 검증한다.
5. X·LinkedIn·Threads·Facebook·Reddit 작성 창 또는 공식 debugger에서 preview-only 실측한다.
   게시가 필요하면 별도 승인을 받는다.
6. application 응답과 provider cache 지연을 분리 기록한다. provider 지연만으로 rollback하지 않는다.
7. stop trigger가 있으면 먼저 owner-only로 닫고 application 회귀면 approved private version으로
   rollback한다.
8. production public smoke, `0.1.2` tarball/integrity/provenance, tag와 npm `latest` 변경을
   Gate C 입력으로 제시한다.

### Stage 4D — Gate C npm patch release

1. npm/tag/Release를 다시 확인해 `0.1.2`와 tag가 미발행인지 확인한다.
2. Gate C 승인 뒤 annotated `codex-usage-profile-v0.1.2` tag를 exact approved commit에 만들고
   push해 provenance workflow를 시작한다.
3. Actions가 2FA approval을 요구하면 작업지시자 승인만 기다리고 다른 publish 경로를 쓰지 않는다.
4. workflow success, npm integrity/provenance와 `latest=0.1.2`를 확인한다.
5. clean environment에서 `npx codex-usage-profile@latest` version/help/default origin과 production
   login/status/submit을 검증한다.
6. defect면 `0.1.2`를 덮어쓰지 않는다. stage5 public을 유지하고 새 patch/deprecate 계획 승인을
   요청한다.
7. 실제 결과를 `docs/npm-release.md`에 최소 반영하고 `task-stage-report`로 Stage 4 결과를
   커밋한 뒤 승인을 요청한다.

### 산출물

- exact-main production saved version과 private→public deployment
- production project에 attach된 logical D1/R2, 전용 environment/OAuth/secret과 migration
  `[1,2,3,4,5]`
- public `codex-usage-profile@0.1.2`, annotated tag와 provenance workflow
- 신규: `mydocs/working/task_m100_108_stage4.md`
- 수정: `docs/npm-release.md`, 실제 작업일의 `mydocs/orders/yyyyMMdd.md`

### 검증

```bash
npm ci
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile.meleeisdeveloping.chatgpt.site
npm view codex-usage-profile@0.1.2 --json
npm view codex-usage-profile dist-tags --json
gh run list --workflow publish-npm.yml
git diff --check
git status --short
```

Sites connector로 saved source, deployment success, access/environment revision과 worker log redaction을
확인한다. SNS 검증은 URL·revision·시각·결과만 기록한다.

### 완료·중단·원복 조건

- 완료: canonical production이 public이며 exact main, 별도 Site project와 application에서
  관찰 가능한 독립 D1/R2 state, 별도 OAuth/secret을 쓴다. OAuth/CLI/privacy/media/fixed
  README/revision share가 통과하고 `@latest=0.1.2` clean production login/status/submit이
  성공한다. stage5는 기존 public validation 상태다.
- 중단: source/archive/deploy mismatch, environment/migration/health/auth/privacy/media 실패,
  credential 노출·추가 과금, rollback 불가, npm provenance/integrity/default origin 불일치.
- application 문제면 access를 owner-only로 먼저 닫는다. npm package는 같은 version을 덮어쓰지
  않는다.

### 커밋

```text
Task #108 Stage 4: production cutover와 CLI 0.1.2 release 검증
```

## Stage 5 — stage5 테스트 전용 전환과 승인된 data disposal

### Stage 5A — Gate D 입력과 전환

Gate D 전에 production/CLI 관찰 결과, stage5 source/version/access/environment/D1/R2,
exact-main target artifact, owner-only policy, test OAuth 유지 범위, explicit `--server` flow와
temporary-public crawler 절차를 제시한다.

1. Gate D 승인 뒤 Stage 1 방식으로 exact main stage5 archive를 새로 만들고 target identity
   negative test와 artifact verifier를 통과한다.
2. stage5 source credential로 exact main을 push하고 saved version 1개를 만든다.
3. private deploy가 가능하면 직접 private deploy한다. public deploy 뒤 즉시 access update가
   필요하면 exact mutation을 다시 승인받는다.
4. readiness, test OAuth와 `--server {stage5}` login/status/submit/profile/media를 확인한다.
5. access를 owner-only로 바꾸고 anonymous 접근 거부, owner flow와 production public 무변경을
   확인한다.
6. temporary-public crawler 절차는 명령과 stop/restore 조건만 dry-run하고 access는 열지 않는다.

### Stage 5B — Gate E data disposal

1. stage5 DB overview와 authenticated surface에서 test owner/session/token/media inventory를
   bounded count로 만든다. raw payload는 기록하지 않는다.
2. `sites:profile-maintenance plan`으로 exact digest/count를 얻고 production identity와 무관함을
   확인한다.
3. repository 밖 mode `0600` export와 restore 가능성을 확인해 Gate E 입력을 제시한다.
4. exact owner/digest/count 승인 뒤에만 `delete-account --apply`를 실행한다.
5. transient retention과 orphan media cleanup은 각각 dry-run한다. 추가 삭제는 candidate
   count/reason을 제시해 별도 apply 승인을 받는다.
6. 삭제 뒤 owner/session/token/public media 비열거, stage5 readiness와 production count·ETag
   무변경을 확인한다.
7. stage5 synthetic owner가 필요하면 production data 복제 없이 새 test flow로 최소 생성한다.
8. local stage5 credential은 exact file과 revoke 상태를 확인한 별도 승인 뒤 정리한다. broad
   directory 삭제는 하지 않는다.
9. `task-stage-report`로 Stage 5 보고서와 오늘할일을 커밋하고 승인을 요청한다.

### 산출물

- exact-main stage5 saved version과 owner-only deployment
- production과 분리된 test OAuth/environment/D1/R2 state
- 승인된 test state cleanup 결과 또는 보류 근거
- 신규: `mydocs/working/task_m100_108_stage5.md`
- 수정: 실제 작업일의 `mydocs/orders/yyyyMMdd.md`

### 검증

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- plan --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site --owner-id {owner_id} --handle {handle}
npm run sites:profile-maintenance -- export --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site --owner-id {owner_id} --handle {handle} --output {external_backup}
npm run cleanup:card-media
git diff --check
git status --short
```

`delete-account --apply`, retention/media apply와 credential 삭제는 Gate E exact 승인 명령에만
추가한다. 기본 검증에는 destructive apply가 없다.

### 완료·중단 조건

- 완료: stage5는 owner-only exact main과 전용 D1/R2/OAuth/secret을 쓰고 explicit origin으로만
  검증된다. 승인된 test state만 digest/count guard로 삭제됐으며 production은 변하지 않았다.
- 중단: target/source identity mismatch, owner-only 뒤 test flow 실패, production 영향,
  plan/export/digest/count 또는 backup 불확실, resource 공유·예상 밖 candidate.

### 커밋

```text
Task #108 Stage 5: stage5 테스트 전환과 data disposal 검증
```

## Stage 6 — runbook 완성·통합 검증과 final handoff

### 산출물

신규:

- `mydocs/working/task_m100_108_stage6.md`
- Stage 6 승인 뒤 `mydocs/report/task_m100_108_report.md`

수정:

- `docs/sites-operations.md`
- `docs/production-hosting.md`
- `docs/readme-card.md`
- `docs/cli-submit.md`
- `packages/codex-usage-profile-cli/README.md`
- `README.md`
- `docs/npm-release.md`
- 실제 작업일의 `mydocs/orders/yyyyMMdd.md`

Stage 2 문구가 실제 remote 결과와 같은 파일은 결과 차이가 있는 절만 수정한다.

### 실행 순서

1. Stage 1~5 보고서, Issue 수용 기준, production/stage5 state와 source topology를 read-only 대조한다.
2. `docs/sites-operations.md`를 Local → stage5 → production build/save/private/public 승격,
   target preflight, temporary-public crawler, OAuth/CLI/access/application rollback과 data disposal
   runbook으로 실측에 맞춘다.
3. production hosting 문서에는 두 project/D1/R2/OAuth/secret 비공유와 exact-main provenance를
   확정한다.
4. README/card/CLI/package/npm 문서의 canonical hostname, fixed README/revision share와
   `0.1.2` 상태를 public surface와 대조한다. #90 범위는 흡수하지 않는다.
5. 두 Site project/version/source/access/environment/readiness를 read-only audit한다.
6. 전체 Node/E2E/build/Sites/npm verifier/public scan을 clean worktree에서 재실행한다.
7. production hosted flow와 stage5 owner-only explicit origin flow를 검증한다. SNS는 preview-only다.
8. 핵심 계약을 다시 확인한다.
   - submit 전후 README Markdown 완전 동일
   - submit 전후 공유 링크와 다섯 SNS target revision이 새 timestamp로 변경
9. `task-stage-report`로 Stage 6 보고서와 오늘할일을 커밋하고 승인을 요청한다.
10. 승인 뒤 `task-final-report`로 최종 보고서, 오늘할일 완료, final commit,
    `publish/task108` push와 `devel` 대상 final PR을 생성한다.
11. Issue close는 final PR merge 확인 뒤 `pr-merge-cleanup`에서 수행한다.

### 검증

```bash
npm ci
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
npm view codex-usage-profile@0.1.2 --json
npm view codex-usage-profile dist-tags --json
git diff --check
git status --short
```

### 완료 조건

- production은 public, stage5는 owner-only이며 source/resource/identity 경계가 문서와 live state에서
  일치한다.
- `@latest=0.1.2`, fixed README/revision share와 다섯 SNS target 전체 회귀가 통과한다.
- Local→stage5→production 승격·rollback·temporary-public·data disposal runbook을 다음 release에서
  재사용할 수 있다.
- worktree가 clean이고 final PR 예상 diff에 범위 밖 변경이 없다.

### 커밋

```text
Task #108 Stage 6: dual Site runbook과 통합 검증 완료
```

## 검증 계획과 단계 의존성

- 각 Stage 검증은 보고서 작성 전에 실행하고 실패한 Stage는 완료 처리하지 않는다.
- remote 결과는 local test와 분리해 source/version/access/environment/resource identity로 기록한다.
- provider cache와 application metadata/image response를 분리한다.
- 계획과 다른 tool/access/quota/OAuth/npm 제약이면 현재 Stage를 중단하고 계획을 먼저 보정한다.
- public access, destructive apply, npm publish와 외부 게시·전송은 인접 Stage 승인과 별도로 exact
  Gate 승인을 받는다.
- Stage 2는 Stage 1 보고서·보정 계획과 Gate A1, Stage 3은 Stage 2, Stage 4는 exact-main release와
  Gate A2,
  Stage 5는 production·`@latest` 관찰, Stage 6은 Stage 5 승인 뒤에만 진행한다.
- Gate E는 Gate D 성공만으로 자동 승인되지 않는다.

## 위험과 대응

- **새 project 부산물**: Gate A1은 한 번만 호출하고 실패 시 다른 slug/project를 만들지 않는다.
- **storage identity 가시성**: connector가 physical D1/R2 ID를 노출하지 않으므로 동일·상이 여부를
  추정하지 않는다. Gate A2에서 서로 다른 Site project/manifest, empty baseline, cross-origin
  absence와 mutation 비영향을 증명하고 불일치면 public 전환을 중단한다.
- **single manifest 오배포**: canonical production manifest, repository 밖 stage5 materialization과
  role/project/origin/source digest preflight를 함께 강제한다.
- **checkpoint workflow 예외**: Issue를 close하거나 final-report를 호출하지 않는다. merge 뒤
  `--ff-only`만 허용하고 final PR 때 같은 publish branch 이름을 새로 쓴다. 2026-08-18
  작업지시자가 Task #108 안에서 배포까지 진행한다는 전제를 재확인했으며, 이 명시 지시는
  Task #108 한정 예외의 승인 근거다.
- **OAuth callback 충돌**: app을 환경별로 분리하고 기존 stage5 secret을 production에 복사하지 않는다.
- **npm immutability**: production public 뒤 publish하고 새 `@latest` 확인 전 stage5 continuity를
  유지한다. 같은 version은 덮어쓰지 않는다.
- **data disposal**: plan/export/digest/count, production 비공유와 exact apply 승인 중 하나라도
  없으면 삭제하지 않는다.
- **Sites quota**: 추가 결제나 capacity 부족은 stop condition이다. shared storage로 우회하지 않는다.
- **SNS cache**: application response를 먼저 검증하고 provider 지연을 별도 기록한다.
- **문서 중복**: 기능적 hostname·version·runbook만 변경하고 전면 README/GitHub metadata는 #90이다.

## 승인 요청 사항

- 위 6개 Stage 분할, 산출물, 검증과 커밋 메시지
- Gate A1 owner-only project 생성은 Stage 2에서 하되 source save/deploy와 D1/R2 attach는
  exact-main Stage 4 Gate A2까지 금지
- Stage 2 결과를 non-closing checkpoint PR로 `devel`에 integration한 뒤 별도 release PR을 merge
- Stage 4 environment/private deploy, Gate B public과 Gate C npm publish를 각각 별도 승인
- Stage 5 owner-only와 data disposal을 Gate D/E로 분리하고 raw DB/R2 삭제 금지
- 기존 `docs/npm-release.md`의 `0.1.2` 실측 결과 최소 보정 추가 범위
- `.openai/hosting-targets.json`, `scripts/materialize-sites-target.mjs`와 negative test를 Stage 2
  source 범위에 추가하고 stage5 archive는 repository 밖에서만 생성
