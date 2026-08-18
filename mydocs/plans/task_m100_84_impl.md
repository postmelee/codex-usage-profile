# Task #84 구현계획서 — exact main 릴리스와 Gate C production 공개 전환

수행계획서: [`task_m100_84.md`](task_m100_84.md)
GitHub Issue: [#84](https://github.com/postmelee/codex-usage-profile/issues/84)
마일스톤: M100

## 2026-08-18 Stage 5 재기준화

- Stage 1~4의 release·Gate C 결과는 당시 exact-main version 24, public access revision 57,
  environment revision 87 기준의 유효한 역사적 증적이다.
- 이후 병합된 #100·#101은 README canonical pair와 revision share URL 계약을 확정했고,
  #101 validation은 stage5를 version 33, access revision 59, environment revision 89로
  이동시켰다. Stage 5는 실행 시 live state를 다시 읽어 이 기록과 대조한다.
- `local/task84`는 merge commit `a748d8b`로 `origin/devel` `c62e535`을 포함한다. 진행 중인
  브랜치를 rebase하거나 Stage 1~4 commit을 재작성하지 않는다.
- Stage 5는 Sites version 저장·배포, access/environment 변경, D1/R2·계정·session 삭제를
  수행하지 않는 read-only 종료 단계다. drift를 발견해도 #84 기준으로 원복하지 않는다.
- fixed README Markdown과 `/api/share/{handle}/r/{revision}` 공유 target 계약은 #101을
  진실 원천으로 보존한다. Stage 4의 fixed `/api/share/{handle}` 플랫폼 실측은 당시 cache
  기준을 설명하는 역사적 evidence로만 유지한다.
- 새 `codex-usage-profile.meleeisdeveloping.chatgpt.site` canonical production, 현재 stage5의
  테스트 전환, project·D1·R2·OAuth·CLI origin과 테스트 데이터 폐기는 별도 migration Issue로
  넘긴다.

## 승인된 결정과 구현 해석

- 시작 candidate는 `origin/devel` `242674cca76b167642108fb85f739fbdcf9fd4d4`, 시작 `origin/main`은 `e75609db133ae43e9a36d7cc9994c813bcaa621c`다. Stage 1에서 다시 fetch하며 `devel`이 움직였으면 새 SHA로 재고정하고 검증을 반복한다.
- `local/task84`는 계획·증적·운영 문서와 최종 보고용이다. release source는 exact `devel`이고 release PR은 `devel → main`이다.
- Stage 1 artifact는 exact candidate detached clean worktree에서 만들고 task plan commit이 포함된 local worktree artifact를 배포하지 않는다.
- 현재 GitHub Actions workflow는 `devel` push와 `devel` 대상 PR 중심이다. `main` 대상 release PR 전용 check가 자동 실행된다고 주장하지 않는다.
- release gate는 exact candidate SHA의 `devel` push workflow 성공과 clean-worktree 전체 검증을 함께 사용한다. release PR 자체의 check run이 필수라면 Stage 2 전에 멈추고 CI 변경을 별도 승인받는다.
- release PR은 작업지시자가 직접 review·merge한다. self merge, auto merge, tag, GitHub Release와 npm publish는 하지 않는다.
- release merge SHA는 candidate와 다를 수 있지만 merge commit tree는 candidate tree와 exact-match여야 한다.
- production build는 merge된 exact `main` detached clean worktree에서 다시 수행하며 Stage 1 archive나 saved version 23 archive를 재사용하지 않는다.
- task 시작 당시 saved version 23은 Stage 4.6 source `c030339d848f961c54358d9d3523b340bed09670`이었다. PR #85 Stage 4.7이 포함된 exact-main owner-only version을 Stage 3에서 새로 만든다.
- Stage 3은 public access를 열지 않는다. exact-main owner-only 배포와 protected smoke 뒤 Gate C 입력을 제시하고 멈춘다.
- D1 migration은 이미 `[1,2,3,4,5]`여야 한다. Stage 3에서는 read-only readiness만 수행하며 불일치 시 migrate/repair하지 않는다.
- Stage 4는 명시적 `Gate C 승인` 뒤에만 public access를 연다. stop trigger 발생 시 public 상태에서 분석하지 않고 owner-only로 먼저 닫는다.
- Stage 4 실측 당시 canonical SNS 공유 링크는 `/api/share/{handle}`이었다. Stage 5의 현재 계약은
  README href·fixed 하위 호환에 이 경로를 유지하고, 공유 링크 복사와 다섯 SNS에는
  `/api/share/{handle}/r/{revision}`을 사용한다. `/?profile={handle}`은 공개 profile SPA,
  `/?view=profile`은 owner SPA, `/u/.../*.png`는 media다.
- X·Threads·카카오톡은 preview/debug까지만 확인하고 SNS 게시물이나 메시지를 발행·전송하지 않는다.
- #86·#87은 비차단 후속이다. Gate C blocker로 재현되지 않는 한 이번 task에 흡수하지 않는다.
- 제품 source 변경은 예상하지 않는다. 결함 발견 시 Stage를 중단하고 계획 변경 승인 전에는 코드를 수정하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | exact candidate 고정과 local release preflight | topology·CI·artifact 증적, Stage 1 보고서 | clean-worktree test/E2E/build/verifier, archive 검사 |
| 2 | `devel → main` release PR과 merge provenance | release PR, exact main SHA/tree, Stage 2 보고서 | base/head/SHA, candidate CI, review, tree equality |
| 3 | exact-main owner-only saved version과 protected smoke | 새 saved version, private deployment, Gate C 입력 | source/readiness/maintenance, OAuth·CLI·profile·media |
| 4 | Gate C public cutover와 SNS 실측 | public 또는 rollback revision, application/SNS 증적 | privacy·route·media·cache, 세 플랫폼, rollback |
| 5 | read-only drift audit·Gate C 이력 종료·migration handoff | 공식 문서 3개, Stage 5·최종 보고서와 task PR | live state read-only 대조, 전체 회귀, diff/check |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| Sites current state와 rollback | `docs/` | `docs/sites-operations.md` | OK | Stage 4 historical baseline과 Stage 5 read-only live snapshot을 구분 |
| exact-main production provenance | `docs/` | `docs/production-hosting.md` | OK | version 24 release 이력과 후속 validation drift를 구분 |
| canonical share/card 상태 | `docs/` | `docs/readme-card.md` | OK | #100 fixed README와 #101 revision 공유 계약을 보존 |
| README·marketing | 변경하지 않음 | 해당 없음 | OK | placeholder와 GitHub metadata는 후속 작업 |
| 단계 증적 | `mydocs/working/` | `mydocs/working/task_m100_84_stage{N}.md` | OK | bounded SHA/count/status 기록 |
| 최종 결과 | `mydocs/report/` | `mydocs/report/task_m100_84_report.md` | OK | release/cutover/rollback handoff |

Stage 5 문서와 보고서는 `publish/task84 → devel` 일반 task PR로 게시한다. 이는 production saved
version을 다시 배포하거나 stage5 data를 정리하는 두 번째 release가 아니다. 새 canonical
production migration은 별도 Issue에서 판단한다.

## 공통 증적·비식별화 규칙

- 기록 가능: public Git SHA, PR/check URL, saved version, access/environment revision, HTTP status, ETag 비교, artifact file/migration/binding count·size·digest.
- 기록 금지: OAuth credential, session/token, operator secret, cookie, D1/R2 payload, raw usage, private/disposable identity, provider exception, 임시 로컬 경로.
- HTTP 본문은 generic code와 boolean/count만 기록하며 raw query/handle을 error report에 복제하지 않는다.
- screenshot은 credential, cookie, private usage와 disposable identity 부재를 확인한 경우에만 증적으로 사용한다.

## 원격 mutation matrix

| Stage | GitHub | Sites/version | Access/environment | D1/R2·사용자 데이터 | 승인 경계 |
|---|---|---|---|---|---|
| 1 | read-only run/PR 조회 | 없음 | read-only 증적만 | 없음 | 구현계획 승인 후 |
| 2 | release PR 생성, merge는 작업지시자 | 없음 | 없음 | 없음 | Stage 1 승인 후 |
| 3 | merged main 조회 | exact-main version 생성·private deploy | custom owner-only 유지 | readiness read-only, protected smoke | Stage 2 승인과 별도 owner-only mutation 승인 |
| 4 | 없음 | Stage 3 version 유지 | Gate C public 또는 owner-only rollback | disposable flow와 cleanup | 명시적 Gate C 승인 |
| 5 | task-final-report PR | read-only 조회만 | 변경 없음 | 삭제·정리 mutation 없음 | 재기준화 계획 승인 후 |

## Stage 1 — exact candidate 고정과 local release preflight

### 산출물

- 신규: `mydocs/working/task_m100_84_stage1.md`
- 수정: `mydocs/orders/20260812.md`
- 임시: repository 밖 exact candidate detached worktree와 Sites archive. 검증 뒤 제거하고 경로는 기록하지 않는다.
- 원격 변경: 없음

### 실행 순서

1. `git fetch origin` 뒤 main/devel SHA, merge-base, ahead/behind를 다시 계산한다.
2. `devel`이 움직였으면 추가 commit과 PR #85 포함을 검토하고 새 SHA를 candidate로 재고정한다.
3. main-only commit이 생겼거나 merge-base가 main head가 아니면 topology 변경으로 중단한다.
4. exact candidate GitHub Actions run을 조회한다. terminal success가 없으면 release PR을 만들지 않는다.
5. candidate/main commit list, name-status, diff stat, workflow·package·migration·hosting manifest와 credential 표면을 검토한다.
6. exact candidate detached clean worktree에서 lockfile 그대로 dependency를 준비한다.
7. 전체 Node, E2E, production build와 두 artifact verifier를 실행한다.
8. `sites-building` 절차로 exact candidate를 package하되 원격에는 저장·배포하지 않는다.
9. archive entry, symlink/traversal, migration `0001..0005`, bindings, credential·secret·절대 경로 부재를 검사한다.
10. SHA, commit count, test 결과, artifact count·size·digest를 Stage 1 보고서에 bounded하게 기록한다.
11. 임시 archive/worktree를 제거하고 task worktree에는 보고서와 오늘할일만 남긴다.

### 검증

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
gh run list --commit {candidate_sha}
gh run view {candidate_run_id}
npm ci
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

추가 artifact 기준: 승인된 top-level만 존재, symlink/absolute/traversal 0건, migration exact 5개, 금지 문자열 0건, Worker/client/renderer 필수 asset 존재, 검증 뒤 임시 산출물 0건.

### 중단 조건

- main이 candidate topology의 ancestor가 아님
- PR #85/Stage 4.7 누락 또는 candidate CI 실패·증적 부재
- 전체 test/E2E/build/verifier 실패
- archive credential·secret·절대 경로·symlink·migration drift
- 누적 diff에 미검토 범위 발견

### 커밋

```text
Task #84 Stage 1: exact release candidate 검증
```

`task-stage-report`로 보고서와 오늘할일을 묶어 커밋하고 승인을 받는다.

## Stage 2 — `devel → main` release PR과 merge provenance

### 산출물

- GitHub release PR: base `main`, head `devel`, 제목 `Release: v1.0.0 Sites production candidate`
- 신규: `mydocs/working/task_m100_84_stage2.md`
- 수정: `mydocs/orders/20260812.md`

### PR 본문 필수 정보

- base/head, main/candidate SHA, merge-base, ahead/behind count
- PR #85/Stage 4.7 포함 근거와 exact candidate Actions run
- clean-worktree 전체 검증과 artifact 검사 결과
- saved version 23과 새 exact-main owner-only 재검증 예정
- Gate C, tag/Release/npm publish가 PR merge에 포함되지 않음
- merge tree mismatch 시 production 중단 및 작업지시자 직접 merge 요청

### 실행 순서

1. fetch 뒤 `origin/devel == candidate`인지 확인한다.
2. 같은 base/head 열린 PR이 있는지 조회하고 중복 PR을 만들지 않는다.
3. candidate CI와 Stage 1 결과가 유효할 때만 release PR을 만든다.
4. base/head/head SHA, diff/commit count, mergeability와 review를 확인한다.
5. main 대상 check가 없으면 성공으로 표현하지 않고 `release PR 전용 check 없음`으로 기록한다.
6. 작업지시자에게 review·merge를 요청하고 멈춘다.
7. merge 통지 뒤 PR `MERGED`와 `origin/main` SHA/parent/tree를 확인한다.
8. candidate가 main에 포함되고 candidate와 main tree diff가 빈 출력인지 확인한다.
9. tag, GitHub Release, npm publish와 Sites version은 만들지 않는다.
10. PR URL, main SHA와 tree equality를 Stage 2 보고서에 기록한다.

### 검증

```bash
git fetch origin
git rev-parse origin/devel
git rev-parse origin/main
gh pr list --base main --head devel --state open
gh pr view {release_pr} --json state,baseRefName,headRefName,headRefOid,mergeable,reviews,statusCheckRollup
gh pr checks {release_pr}
git merge-base --is-ancestor {candidate_sha} origin/main
git diff --exit-code {candidate_sha} origin/main -- .
git diff --check
```

### 중단 조건

- release PR head SHA가 candidate와 다름
- candidate CI/Stage 1 결과 실패·취소·무효화
- PR diff에 candidate 밖 변경 또는 review 없는 merge
- merged main에 candidate 미포함 또는 tree diff
- 예상하지 않은 tag/Release/npm publish/배포 시작

### 커밋

```text
Task #84 Stage 2: main release merge provenance 기록
```

Stage 2 승인 전 exact-main Sites build를 시작하지 않는다.

## Stage 3 — exact-main owner-only saved version과 protected smoke

### Stage 3A — read-only snapshot과 mutation 승인 입력

다음을 제시한다: exact main/PR/tree, Site origin/linkage, current version/source/deployment, owner-only access revision, disabled/normal/secret-absent environment, health, exact-main build digest/count, D1 readiness, owner visibility/media bounded 상태, rollback versions 23/17/7 역할, plan/quota, 만들 version 1개와 disposable cleanup 범위.

Stage 3A는 원격 state를 바꾸지 않는다. 명시 승인 뒤 Stage 3B로 간다.

### Stage 3B — build, save와 private deploy

1. exact main detached clean worktree에서 dependency/build/finalizer/verifier를 재실행한다.
2. `sites-building`으로 archive를 새로 만들고 source와 digest를 검사한다.
3. `sites-hosting`으로 existing linkage를 유지한 saved version 1개를 만들고 custom owner-only로 private deploy한다.
4. saved source SHA, exact main, archive digest와 terminal success를 exact-match한다.
5. readiness가 exact `[1,2,3,4,5]`인지 read-only 확인한다. 불일치 시 repair하지 않는다.
6. disabled/normal/secret-absent, operator `404`, health `200`을 확인한다.
7. OAuth/session, packed CLI login/submit/revoke, private preview, settings와 publish/unpublish를 protected 범위에서 검증한다.
8. owner/public SPA handoff, `/api/share/{handle}`, 네 README PNG와 social image를 protected 경계에서 확인한다.
9. recent errors 비식별화와 quota를 확인하고 disposable 상태를 Gate C 최소치로 정리한다.
10. exact version/source/access/environment, rollback과 public 범위를 Gate C 입력으로 제시하고 멈춘다.

### 산출물

- 새 exact-main saved version과 owner-only deployment
- 신규: `mydocs/working/task_m100_84_stage3.md`
- 수정: `mydocs/orders/20260812.md`

### 검증

```bash
npm ci
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run sites:profile-maintenance -- readiness --origin {production_origin}
git diff --check
git status --short
```

remote contract: source exact main, deployment succeeded, custom owner-only, migration exact 1..5, disabled/normal/secret-absent, operator 404, health 200, OAuth/CLI/profile/media smoke 통과, 비밀·identity·usage 비노출, 추가 과금 없음.

### 중단·원복 조건

- exact-main build/archive/source mismatch 또는 deployment failure
- migration/maintenance/operator/health 불일치
- OAuth/CLI/private-by-default/publish/media 회귀
- credential·identity·usage 노출 또는 추가 과금 요구

실패 시 owner-only를 유지하고 application 회귀면 version 23을 owner-only로 재배포한다. schema downgrade와 데이터 삭제는 하지 않는다.

### 커밋

```text
Task #84 Stage 3: exact main owner-only 후보 검증
```

Stage 3 보고서와 명시적 Gate C 승인 전 Stage 4로 진행하지 않는다.

## Stage 4 — Gate C public cutover와 SNS 실측

### Gate C 승인 입력

- exact main SHA, saved version/deployment/access/environment와 Stage 3 결과
- public으로 바꿀 access policy, 전환 시각과 application smoke 범위
- actual owner와 disposable private/missing 역할
- 세 플랫폼 canonical URL, preview-only 경계, stop/rollback과 cleanup
- plan/quota와 추가 결제 없음

작업지시자가 `Gate C 승인`하기 전에는 access를 public으로 바꾸지 않는다.

### 실행 순서

1. Gate C 직전 source/version/access/environment/readiness와 rollback을 재확인한다.
2. test profile은 private, token/session은 새 일회성 값으로 준비한다.
3. access를 public으로 바꾸고 deployment/health를 확인한다.
4. anonymous landing, auth API, private/missing JSON/HTML/media 비열거를 먼저 검증한다.
5. disposable OAuth/CLI와 private preview를 검증한다.
6. approved profile을 publish하고 theme/locale 설정을 저장한다.
7. query 없는 dark와 dark/light × en/ko README PNG의 GET/HEAD/304/404를 확인한다.
8. `/api/share/{handle}` GET/HEAD self canonical, OG/Twitter, locale와 SPA handoff를 확인한다.
9. social revision/stable route GET/HEAD/304, 2400×1260과 ETag/revision을 확인한다.
10. fallback이면 personalized status, packaged sample URL/asset과 application event를 분리한다.
11. X·Threads composer와 카카오 debugger에서 canonical preview를 확인하되 발행하지 않는다.
12. 같은 시점 application response와 platform preview를 대조한다.
13. unpublish 뒤 unavailable/404를 확인하고 final owner visibility만 복구한다.
14. recent error 비식별화를 확인한다.
15. 모두 통과하면 public 유지, stop trigger가 있으면 먼저 owner-only로 닫는다.
16. application 회귀면 승인된 rollback version을 owner-only로 배포하고 health/readiness/private 경계를 확인한다.

### application matrix

| 상태 | `/api/share/{handle}` | README card | social | JSON/profile |
|---|---|---|---|---|
| public/coherent | canonical metadata `200` | 네 변형 `200/HEAD/304` | personalized `200/HEAD/304` | `200` |
| public/legacy | document `200`, sample 선언 | stable contract | personalized `404`, sample `200` | `200` |
| private/missing/unpublish | 같은 unavailable document | 모든 조합 `404` | `404` | 비열거 `404` |

### stop trigger

- Gate C 입력 대비 remote state drift
- migration/maintenance/operator/health 불일치
- OAuth/CLI/private/non-enumeration 회귀
- canonical/social revision 또는 media cache 계약 실패
- credential·identity·usage 노출, 추가 과금 요구, rollback 불가

플랫폼 cache 지연만 있고 application이 정상인 경우 제품 결함으로 단정하지 않고 public 유지 판단을 작업지시자에게 제시한다.

### 산출물과 커밋

- 신규: `mydocs/working/task_m100_84_stage4.md`
- 수정: `mydocs/orders/20260812.md`

```text
Task #84 Stage 4: Gate C public 전환과 SNS 실측
```

## Stage 5 — read-only drift audit·Gate C 이력 종료와 migration handoff

### 실행 순서

1. GitHub Issue #84, Stage 1~4 보고서, merged #100·#101 결과와 현재 branch topology를 대조한다.
2. stage5 project의 saved version/source/deployment/access/environment와 health/readiness를
   read-only로 조회한다. secret 값, raw owner/usage/session 데이터는 읽거나 기록하지 않는다.
3. Stage 4 version 24/access 57/environment 87, #101 version 33/access 59/environment 89와
   live snapshot을 시간 순서로 구분한다. 불일치는 drift로 기록하고 remote state를 변경하지 않는다.
4. Task #84가 만든 disposable CLI credential/token/session이 Stage 4에서 revoke/logout됐다는
   증적을 재확인한다. actual owner와 #101 validation data, D1/R2 object를 삭제하지 않는다.
5. 최신 `origin/devel` 기준 전체 Node·E2E·production build와 Sites artifact verifier를 실행한다.
6. `docs/sites-operations.md`에는 version 24 Gate C를 역사적 baseline으로 기록하고, 현재 stage5는
   새 canonical migration 전까지 validation origin이라는 handoff를 필요한 범위에서만 보강한다.
7. `docs/production-hosting.md`에는 exact-main release provenance와 후속 source drift를 구분하고
   새 hostname·project·D1/R2·OAuth·CLI origin이 별도 migration 범위임을 기록한다.
8. `docs/readme-card.md`는 #100 fixed README canonical pair와 #101 revision share target 계약을
   보존한다. #84 초기 fixed share 문구로 되돌리지 않는다.
9. `mydocs/orders/20260818.md`와 Stage 5 보고서를 갱신하고 `task-stage-report` 절차로 검증·커밋한 뒤
   작업지시자 승인을 받는다.
10. 승인 뒤 `task-final-report`로 최종 보고서, 오늘할일 완료, 최종 commit,
    `publish/task84` push와 devel PR을 생성한다.

### 산출물

- 신규: `mydocs/working/task_m100_84_stage5.md`, `mydocs/report/task_m100_84_report.md`
- 수정: `docs/sites-operations.md`, `docs/production-hosting.md`, `docs/readme-card.md`,
  `mydocs/orders/20260818.md`
- 변경하지 않음: `README.md`, 제품 source, migration, test/build scripts

### 검증

```bash
git fetch origin --prune
git rev-parse HEAD origin/devel origin/main
gh issue view 84 --json state,title,url
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git status --short --branch
git diff --check
git diff --name-only origin/devel...HEAD
rg -n '/api/share/\{handle\}(/r/\{revision\})?|saved version|validation|canonical production' \
  docs/sites-operations.md docs/production-hosting.md docs/readme-card.md
```

검증: live state와 Stage 4·#101 이력의 시간축 분리, remote mutation 0건, disposable credential
정리 증적, #100·#101 URL 계약 보존, 전체 회귀·artifact 통과, README/제품 source diff 없음,
민감 정보 부재.

### 커밋

```text
Task #84 Stage 5: Gate C 이력과 migration handoff 정리
```

최종 보고:

```text
Task #84 Stage 5 + 최종 보고서: release 이력과 후속 migration handoff
```

## 공통 검증

- Stage 검증은 보고서 전에 실행하고 실패 상태로 완료 처리하지 않는다.
- 원격 mutation 전후 exact state와 terminal status를 비교한다.
- 제품 source나 문서 위치 변경이 필요하면 계획서를 먼저 갱신하고 승인받는다.
- 각 Stage 완료 시 `task-stage-report`, 최종 단계 뒤 `task-final-report` 절차를 적용한다.
- 최종 PR 전 `git status --short`는 빈 출력이어야 한다.

## 단계 의존성과 승인 checkpoint

1. 구현계획 승인 → Stage 1
2. Stage 1 보고 승인 → Stage 2 release PR
3. 작업지시자 release PR 직접 merge → Stage 2 merge 검증
4. Stage 2 보고 승인 → Stage 3A read-only snapshot
5. Stage 3A owner-only mutation 승인 → Stage 3B private deploy
6. Stage 3 보고와 명시적 Gate C 승인 → Stage 4
7. Stage 4 보고와 2026-08-18 재기준화 계획 승인 → Stage 5 read-only audit
8. 최종 보고 승인 → `publish/task84 → devel` PR

승인은 뒤 checkpoint로 전이되지 않는다. owner-only mutation 승인과 Gate C 승인은 서로 대체하지 않는다.

## 위험과 대응

- **Release PR 전용 CI 부재**: exact devel-push CI와 Stage 1 전체 검증을 필수화하고 PR-specific check가 필수면 CI 변경 승인을 요청한다.
- **419-commit 누적 diff**: base/head/merge-base, commit count와 tree equality를 기록하고 review 없이 merge하지 않는다.
- **Task artifact 오사용**: exact candidate/main detached worktree만 package한다.
- **Stage 4.7 원격 미검증**: exact-main owner-only 전체 smoke 전 Gate C를 요청하지 않는다.
- **Sites route 제약**: `/api/share/{handle}`만 crawler canonical로 실측한다.
- **외부 cache/provider**: 같은 시점 application response로 platform cache와 defect를 분리한다.
- **Remote drift**: 승인 뒤 state가 변하면 승인을 재사용하지 않는다.
- **비용·quota**: upgrade/payment 요구 시 public 전환을 중단한다.
- **Rollback 오작동**: owner-only를 먼저 복원한 뒤 version을 되돌리고 schema downgrade는 하지 않는다.
- **Cleanup 오대상**: disposable과 actual owner role을 고정한다.
- **문서와 main 시차**: Stage 5 문서는 devel task PR이며 두 번째 production release가 아니다.
- **Stage 4 이후 remote drift**: live stage5가 version 24 기준과 다른 것은 예상된 후속 변경이다.
  Stage 5는 chronological evidence를 남기고 #84에서 rollback하거나 재배포하지 않는다.
- **최신 URL 계약 덮어쓰기**: #100 fixed README와 #101 revision share 계약을 Stage 4의 fixed
  share 실측 문구로 되돌리지 않는다.
- **migration scope creep**: 새 production hostname, project·D1·R2·OAuth·CLI origin과 data
  폐기는 별도 Issue 승인 전 변경하지 않는다.

## 승인 요청 사항

- 5개 Stage의 산출물, 검증, mutation matrix와 commit 메시지를 승인해 주세요.
- release PR 전용 CI가 없을 수 있음을 수용하고 exact candidate devel-push CI와 clean-worktree 전체 검증을 release gate로 사용하는 방식을 승인해 주세요.
- Stage 2 merge는 작업지시자가 직접 수행하고 Stage 3 owner-only mutation과 Stage 4 Gate C를 각각 별도 승인하는 경계를 승인해 주세요.
- Stage 5를 원격 mutation 없는 read-only drift audit과 #84 역사적 종료 정리로 수행하는 경계를
  승인해 주세요.
- Stage 5 문서는 devel task PR에 반영하고 #100·#101 계약을 보존하며, 새 canonical production과
  stage5 테스트 전환은 별도 migration Issue로 남기는 경계를 승인해 주세요.

승인되면 Stage 5 live state read-only snapshot과 종료 문서 현행화부터 진행한다.
