# Task #108 Stage 1 보고서 — dual-Site baseline과 Gate A 계약 고정

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 1

## 단계 목적

canonical production Site를 만들기 전에 Git/GitHub/npm과 기존 stage5의 live state를 읽기
전용으로 고정하고, production·stage5 target을 혼동하지 않는 manifest/package 경계와 원격
mutation Gate를 확정한다. 실제 Sites API가 D1/R2를 project 생성 인자로 받지 않는다는 제약을
반영해 Gate A를 project 생성 Gate A1과 first private deploy의 storage Gate A2로 분리한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_108_impl.md` | unprovisioned→canonical manifest 전환, nonsecret target registry·repository 밖 materializer, Gate A1/A2, storage identity 증명 한계를 반영했다. |
| `mydocs/working/task_m100_108_stage1.md` | Git/Sites/npm baseline, 원격 무변경 증적, Gate A1 exact 입력과 다음 단계 중단 조건을 기록했다. |
| `mydocs/orders/20260818.md` | #108을 Stage 1 완료 및 Stage 2·Gate A1 승인 대기로 갱신했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 공식 사용자·운영 문서는 수정하지 않았다. 기존 구현계획의 canonical origin,
fixed README/revision share, exact-main 승격, 환경별 OAuth·data 비공유와 Stage 1~6 구조는 보존했다.
Sites 도구의 실제 계약과 다른 부분만 다음처럼 보정했다.

- `create_site` 전제에 맞춰 canonical manifest를 잠시 unprovisioned form으로 만들고 성공 응답의
  production project를 즉시 저장한다.
- `.openai/hosting-targets.json`과 `scripts/materialize-sites-target.mjs`를 Stage 2의 확정 source
  범위로 추가한다.
- Site 생성 시 D1/R2 identity까지 확정한다는 전제를 제거하고 Gate A2 private save/deploy로
  이동한다.
- connector가 physical D1/R2 ID를 노출하지 않는 사실을 명시하고 서로 다른 Site project,
  target manifest, empty baseline과 교차 영향 부재로 application-level 분리를 검증한다.

Stage 1에서는 Site 생성, source save/push, deploy, access/environment/OAuth 변경, DB row 조회,
data 삭제, tag·npm publish와 GitHub write를 수행하지 않았다.

## 검증 결과

실행 명령:

```bash
git fetch origin
git rev-parse HEAD origin/devel origin/main
git merge-base origin/main origin/devel
git rev-list --count origin/main..origin/devel
git rev-list --count origin/devel..origin/main
gh issue view 108
gh pr list --state open
npm view codex-usage-profile dist-tags versions --json
git ls-remote --tags origin
gh release list --repo postmelee/codex-usage-profile --limit 20
git tag --list 'codex-usage-profile-v*'
curl -fsS -D - -o /dev/null https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/healthz
curl -fsS -D - -o /dev/null https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/
git diff --check
git status --short
```

Sites read-only 조회:

- `list_sites`
- `get_site`
- `list_site_versions`
- `get_site_version`
- `get_deployment_status`
- `get_environment_variables`
- `read_database_overview`

결과:

- **OK — Git topology**: Stage 1 조사 시작 task HEAD는
  `0ecd3ad48562c49e2d0e80f6f484548cc69ecf3f`, `origin/devel`은
  `71442fa554cb5f9f8bce4fe5a1407c25d3a4de85`, `origin/main`은
  `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`다. merge-base는
  `242674cca76b167642108fb85f739fbdcf9fd4d4`이며 main-only 1, devel-only 101이다.
  main-only PR #88 merge commit의 tree는 release candidate tree와 같아 source 충돌이 아니다.
- **OK — Issue/PR 경계**: #108은 M100의 OPEN enhancement다. #84·#100·#101은 CLOSED,
  #89·#90은 OPEN이며 이번 기능적 migration 범위에서 제외한다. 열린 PR은 0개이고 devel은
  PR #106·#107의 merge 결과를 포함한다.
- **OK — stage5 live baseline**: project
  `appgprj_6a62f58721788191a7cd82f37320f244`는 active/public이고 live origin은
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`다. access revision은 59,
  environment revision은 89, external visitor count는 0이다. `/healthz`와 `/`는 모두 HTTP 200을
  반환했다. Stage 1 read-only 원칙 때문에 maintenance POST probe는 실행하지 않았다.
- **OK — version/rollback baseline**: live version 33은 source
  `53a7132630dcb6f43459880d79730e10e2b59d6e`, 22 files, 5,171,200 bytes이고 deployment
  `appgdep_6a83b0c37c108191bcab0a1cf0514515`는 succeeded다. version 32는 rollback candidate,
  version 24는 당시 exact main `0c804733e41988467ecd7fbd8e6a152cbfc2fad0` source다.
- **OK — environment key 경계**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, 네 개의 account
  usage rate-limit key, `PROFILE_MAINTENANCE_MODE`, `PROFILE_SERVICE_MODE`,
  `PROFILE_STOP_RETRY_AFTER_SECONDS`까지 9개 key가 있다. secret 값은 redacted 상태로 두었고
  값 유무를 추정하거나 기록하지 않았다.
- **OK — logical storage baseline**: stage5 manifest와 live overview의 binding은 `DB`와
  `PROFILE_MEDIA`다. D1 overview에는 migration·owner·session·CLI token·snapshot/usage·device·rate
  limit·atomic operation 관련 12개 table이 있다. connector가 row를 읽지 않는 count 기능을
  제공하지 않아 count와 row를 조회하지 않았다. R2 physical ID도 connector에서 노출되지 않았다.
- **OK — capacity/slug 관찰**: 현재 계정에 active Site 4개가 있고 `codex-usage-profile` slug는
  없다. 다만 plan limit, 결제와 최종 slug reservation은 read API가 제공하지 않으므로 Gate A1의
  단일 `create_site` 호출이 terminal 판정이다. 대체 slug나 추가 project는 만들지 않는다.
- **OK — target packaging 계약**: `create_site`는 title·slug·description만 받고 root
  `.openai/hosting.json`에 `project_id`가 없어야 한다. D1/R2 인자는 없다. 공식
  `package-site.sh`는 주어진 project의 `dist`와 root hosting manifest를 archive의
  `dist/.openai/hosting.json`으로 조립하므로, repository 밖 packaging root와 role registry를
  사용하면 canonical manifest를 stage5 값으로 바꾸지 않고 target별 archive를 만들 수 있다.
- **OK — npm release baseline**: npm `latest`는 `0.1.1`, published version은 `0.1.0`·`0.1.1`뿐이라
  `0.1.2`는 사용 가능하다. remote tag는 `v0.1.0`, recovery tag, `v0.1.1`이고 `v0.1.2`는 없다.
  GitHub Release 목록은 비어 있다. publish workflow는 exact version tag를 검증한 뒤
  `npm stage publish`와 별도 approval environment를 사용한다.
- **OK — OAuth 경계**: `create_site`가 만드는 Sites auth client는 application GitHub OAuth의
  `GITHUB_CLIENT_ID`와 다른 identity다. production GitHub OAuth app/callback/secret은 Stage 4
  Gate A2에서 별도 승인·설정해야 하며 stage5 값을 복사하지 않는다.
- **OK — remote mutation 0건**: Stage 1의 Sites, GitHub, npm, HTTP 작업은 모두 read-only였다.
  project/version/deployment/access/environment/data/tag/package state를 변경하지 않았다.
- **OK — plan amendment**: Gate A1 exact 입력과 Gate A2 storage 책임, materializer 파일명,
  negative target test와 physical identity 비추정 규칙이 구현계획에 반영됐다.

## 잔여 위험

- Sites plan limit, 결제·permission과 slug reservation은 `create_site` 전에는 확정할 수 없다.
  Gate A1 호출 실패는 terminal이며 재시도·대체 slug·추가 project를 만들지 않는다.
- 새 Site의 실제 access mode는 생성 뒤 `get_site`로만 확정된다. owner-only가 아니면 access를
  보정하지 않고 중단한다.
- D1/R2는 Site 생성 시 생기지 않는다. exact-main archive를 처음 save/private deploy하는
  Gate A2까지 production storage와 migration을 검증할 수 없다.
- connector는 D1/R2 physical provider ID를 노출하지 않는다. application-level isolation 증적이
  불충분하면 public 전환을 중단하며 동일·상이 여부를 추정하지 않는다.
- production GitHub OAuth app, environment secret과 source credential은 아직 만들거나 사용하지
  않았다.
- stage5 description은 owner-only validation을 설명하지만 현재 access는 public이다. 실제 test-only
  전환이 끝나는 Stage 5에서 live state에 맞춰 보정한다.

## 다음 단계 영향

- Stage 2는 본 보고서와 보정된 구현계획, 아래 Gate A1 전체를 함께 승인받은 뒤에만 시작한다.
- Gate A1 local prerequisite는 production project가 `null`인 nonsecret target registry와
  unprovisioned canonical manifest다.
- Gate A1 one-shot mutation은 `title=Codex Usage Profile`, `slug=codex-usage-profile`,
  `description=Canonical production Site for Codex Usage Profile.`의 `create_site` 1회뿐이다.
- 성공 시 반환 project를 registry/canonical manifest에 즉시 기록하고 `get_site`로 canonical
  origin과 owner-only access를 확인한다. source credential은 사용·저장·출력하지 않는다.
- Stage 2에서는 source push/save/deploy, access/environment/OAuth, D1/R2, stage5, GitHub/npm을
  변경하지 않는다. project가 생성돼도 owner-only·undeployed 상태로 둔다.
- D1/R2 attach·migration·isolation은 exact-main Stage 4 Gate A2의 별도 승인 대상이다.

## 승인 요청

- Stage 1 보고서와 구현계획 보정을 승인하고, 위 exact 입력의 Gate A1을 승인하면 Stage 2의
  canonical source 구현과 production Site 1회 생성을 진행한다.
