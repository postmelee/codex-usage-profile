# Task #90 구현계획서 — 공개 README·문서 정보구조와 GitHub metadata 현행화

수행계획서: [`task_m100_90.md`](task_m100_90.md)
GitHub Issue: [#90](https://github.com/postmelee/codex-usage-profile/issues/90)
마일스톤: M100

## 승인된 결정과 구현 해석

- root README는 GitHub repository의 launch page다. 첫 화면은 `title → value proposition →
  실제 카드 → primary CTA/Quick start` 순서로 구성하고 현재 50% 카드보다 크게 표시한다.
- 실제 예시는 `postmelee`의 fixed `/api/share/postmelee` href와 query 없는
  `/u/postmelee/card.png` src를 유지한다. revision URL은 README embed로 사용하지 않는다.
- public product surface인 root README, package README, `docs/cli-submit.md`,
  `docs/readme-card.md`, 신규 `docs/README.md`는 영어를 canonical language로 사용한다.
- `.hyper-waterfall/version.json`의 `locale=ko`, `mydocs/`와 현재 maintainer 운영 문서의 한국어는
  바꾸지 않는다. 운영/architecture/legacy 문서는 삭제하지 않고 사용자 README에서만 분리한다.
- root README의 `Development` 명령은 제거한다. 개발 setup과 검증 진실 원천은
  `CONTRIBUTING.md`, 전체 문서 navigation은 `docs/README.md`가 담당한다.
- `publish-npm.yml`은 `devel` pull request/push와 release tag를 검증하며 `main` push를 검증하지
  않는다. 따라서 root README의 `branch=devel` CI badge를 `main`으로 바꾸지 않고 제거한다.
  Website, npm version, license badge는 유지하고 contributor 검증 경로는 `CONTRIBUTING.md`가 설명한다.
- root README는 endpoint/implementation/version 이력 대신 사용자가 얻는 결과, 3단계 시작,
  publish/share, privacy와 도움말을 설명한다. 실제로 검증되지 않은 SNS refresh SLA, 자동 게시,
  OpenAI endorsement는 약속하지 않는다.
- 제품 코드, CLI 동작, npm package version/artifact, Sites deployment/access/data는 변경하지 않는다.
  package README source가 바뀌어도 `0.1.3`을 다시 게시하지 않으며 repository의 다음 release source로만
  반영한다.
- source integration은 Issue #90을 close하지 않는 checkpoint PR로 `devel`에 먼저 반영한다.
  그 exact tree를 별도 `devel → main` release PR로 승격한 뒤에만 GitHub metadata를 변경한다.
- GitHub metadata remote mutation은 Stage 5의 별도 승인 Gate다. desired homepage는
  `https://codex-usage-profile.meleeisdeveloping.chatgpt.site`, desired default branch는 `main`이다.
  description exact copy는 Stage 1 audit에서 GitHub 글자 수와 README value proposition을 대조해
  확정한다.
- checkpoint/release PR merge는 작업지시자가 수행한다. Stage 5 final report PR만 `Closes #90`을
  사용한다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 공개 표면 audit와 정보구조·언어 계약 확정 | content inventory, README outline, metadata/rollback payload | live URL·workflow·docs audience/language·private path read-only audit |
| 2 | 사용자 중심 README와 user guide 보정 | `README.md`, package README, 영어 CLI/card guides | link·copy·canonical URL·render·live card/share |
| 3 | contributor/maintainer navigation과 공개 tree 위생 | `docs/README.md`, `CONTRIBUTING.md`, 절대경로 일반화 | docs link graph·scripts·audience separation·public scan |
| 4 | source integration과 exact-main 승격 | non-closing checkpoint PR, `devel → main` release PR, provenance 보고 | PR checks·tree equality·main README render |
| 5 | GitHub metadata cutover와 최종 공개 검증 | description/homepage/default branch, final audit | metadata·badge·README/docs/live endpoints·rollback readiness |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 공개 제품 진입 문서 | repository root | `README.md` | OK | Stage 2 launch page 재구성 |
| npm package 사용자 문서 | package 내부 | `packages/codex-usage-profile-cli/README.md` | OK | Stage 2 사용자 링크 정리, npm 재게시 없음 |
| CLI 사용자 가이드 | `docs/` 기존 경로 | `docs/cli-submit.md` | OK | Stage 2 영어 canonical rewrite |
| README card 사용자 가이드 | `docs/` 기존 경로 | `docs/readme-card.md` | OK | Stage 2 영어 canonical rewrite |
| 공식 문서 index | `docs/` 신규 | `docs/README.md` | OK | Stage 3 대상 독자·언어 navigation |
| 기여자 개발 진입 문서 | repository root | `CONTRIBUTING.md` | OK | Stage 3 Development 진실 원천 |
| maintainer/contract 문서 | `docs/` 기존 경로 | `docs/{npm-release,production-hosting,sites-operations,codex-usage-analyzer,usage-snapshot-v2}.md` | OK | 내용·경로 유지, index 분류만 추가 |
| historical 절대경로 작업 증적 | `mydocs/working/` 기존 경로 | Stage 3 exact audit 대상 | OK | 의미·시각 보존, 개인 literal만 일반화 |
| 단계·최종 보고서 | `mydocs/` | `working/task_m100_90_stage{1..5}.md`, `report/task_m100_90_report.md` | OK | Hyper-Waterfall 증적 |

## 공통 공개 문서 계약

### Audience와 language

| 문서군 | 대상 | canonical language | README 노출 |
|---|---|---|---|
| root/package README | 신규 사용자·CLI 사용자 | English | primary |
| CLI/card user guides | 실제 사용자 | English | help link |
| analyzer integration | 통합자·기여자 | English | root에서 제외, docs index |
| production/Sites/npm operations | maintainer | Korean | root에서 제외, CONTRIBUTING/docs index |
| legacy snapshot contract | 호환성 기여자 | English | root에서 제외, docs index |
| `mydocs/` | 내부 작업자·에이전트 | Korean | root에서 제외 |

### README content hierarchy

1. Title, one-sentence value proposition
2. Large live example card linked to fixed public share page
3. Website/npm/CI/license badges and primary Website CTA
4. Three-step Quick start: GitHub sign-in → `npx ... submit` → preview/publish/share
5. User outcomes: private by default, stable card, revision-aware SNS, no credential upload
6. README embed example and cache expectation
7. Privacy/safety summary and user help links
8. Contribution, support disclosure, license/trademark

`How it works`의 backend 순서, share endpoint availability matrix, development/release 명령과 전체
docs 목록은 root README에서 제거하거나 사용자 의사결정에 필요한 한 문장으로 축약한다.

### Copy guard

- `official`, `endorsed`, `instant refresh`, `automatic post`, `all usage`처럼 실제 계약보다 넓은
  표현을 사용하지 않는다.
- Codex for Open Source 지원은 maintainer 지원이며 제품 endorsement가 아니라는 고지를 유지한다.
- public profile은 사용자가 **Publish card**를 선택한 뒤에만 보인다는 private-by-default 문구를
  첫 화면과 Quick start에서 일치시킨다.
- CLI는 OpenAI/Codex password, `auth.json`, API/access/refresh token 또는 keychain entry를
  업로드하지 않는다는 검증된 경계만 설명한다.
- README fixed URL과 revision SNS URL 역할을 혼동하지 않는다.

## 공통 검증 도구와 판정

- Markdown relative link는 repository root 기준과 각 docs 파일 기준으로 실제 대상 존재를 검사한다.
- production URL은 GET/HEAD status, content type, fixed href/src를 확인하고 외부 SNS 게시물은 만들지
  않는다.
- GitHub rendered README는 source raw만 보지 않고 checkpoint PR 또는 `main` repository 화면에서
  desktop 폭 기준 screenshot으로 카드 크기, badge, heading과 code block을 수동 확인한다.
- `npm run scan:public-release`의 historical Git object review finding은 현재 tree 수정으로 없어지지
  않을 수 있다. blocker 0과 current-tree 개인 home literal 0을 별도 판정한다.
- package version, lockfile, Sites manifest와 product source에 diff가 생기면 즉시 중단한다.

## Stage 1 — 공개 표면 audit와 정보구조·언어 계약 확정

### 진입 조건

- 수행계획서의 범위, 언어 정책, 문서 위치와 5개 Stage가 승인됐다.
- `local/task90`이 최신 `origin/devel`에서 시작했고 병렬 변경과 충돌하지 않는다.

### 산출물

신규:

- `mydocs/working/task_m100_90_stage1.md`

수정:

- `mydocs/orders/20260824.md`
- audit 결과가 본 계획의 가정과 다를 때만 `mydocs/plans/task_m100_90_impl.md`를 먼저 보정

제품·공식 문서와 GitHub metadata는 Stage 1에서 수정하지 않는다.

### 실행 순서

1. README와 package README의 heading, badge, image, link, CTA, code block과 문서 링크를 inventory한다.
2. `docs/*.md`를 user/contributor/maintainer/legacy, English/Korean, root 노출 여부로 분류한다.
3. `CONTRIBUTING.md`, package scripts와 workflow trigger를 대조해 Development 이동과 CI badge의
   정확한 branch 의미를 확정한다.
4. production root, fixed share/card와 favicon을 GET/HEAD로 조회하고 example card aspect/byte/content
   type을 기록한다.
5. GitHub repo description/homepage/default branch와 `origin/main`/`origin/devel` tree를 read-only로
   고정한다.
6. current tree의 placeholder, 배포 전 문구, 개인 절대경로와 public scan을 실행해 Stage 3 exact
   수정 파일을 확정한다.
7. README section outline, card width 후보, docs index 표와 desired/rollback metadata payload를 보고서에
   제시한다.
8. `task-stage-report`로 보고서·오늘할일을 commit하고 Stage 2 승인을 요청한다.

### 검증

```bash
gh api repos/postmelee/codex-usage-profile
git rev-parse HEAD origin/devel origin/main
git rev-list --count origin/main..origin/devel
git rev-list --count origin/devel..origin/main
rg -n '^#|^##|https?://|<img|\]\(' README.md packages/codex-usage-profile-cli/README.md
rg -n '[가-힣]' README.md packages/codex-usage-profile-cli/README.md docs
rg -n 'PROFILE_CARD_EMBED_PLACEHOLDER|not yet live|Next deployment' README.md packages/codex-usage-profile-cli/README.md docs
rg -n "$(printf '/Users/%s' melee)" README.md docs mydocs
rg -n '^on:|branches:|pull_request:|push:' .github/workflows/publish-npm.yml
npm run scan:public-release
git diff --check
git status --short
```

HTTP와 GitHub rendered view는 read-only로 검증하고 screenshot/response metadata만 보고서에 기록한다.

### 완료·중단 조건

- 완료: exact file inventory, section outline, audience/language matrix, CI badge 판정,
  desired/rollback metadata payload와 Stage 2/3 변경 파일이 고정된다.
- 중단: product behavior/document contract가 Task #108 결과와 다르거나 main release topology가 달라져
  계획 보정이 필요하다.

### 커밋

```text
Task #90 Stage 1: 공개 표면과 문서 정보구조 계약 확정
```

## Stage 2 — 사용자 중심 README와 user guide 보정

### 진입 조건

- Stage 1 보고서의 README outline, card width, user guide content inventory와 exact 수정 파일이 승인됐다.

### 산출물

수정:

- `README.md`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `docs/readme-card.md`
- `mydocs/orders/20260824.md`

신규:

- `mydocs/working/task_m100_90_stage2.md`

### 변경 내용

- README를 공통 hierarchy대로 재구성하고 live card를 title/value proposition 다음에 배치한다.
- Quick start는 `npx codex-usage-profile@latest submit` 한 명령과 browser approval, private preview,
  Publish/Share 흐름을 3단계로 설명한다.
- 기능은 private-by-default, stable README card, revision-aware social share와 credential 비수집을
  사용자 benefit으로 표현한다.
- CLI user guide는 requirements, submit/device approval, status/logout, transmitted data, CI/noninteractive,
  common errors와 recovery를 영어로 정리한다. Stage5/internal operator 설명은 제거한다.
- card user guide는 publish/embed, theme/locale, fixed URL, GitHub Camo cache, revision SNS share,
  private/404와 troubleshooting을 영어로 정리한다. Task/version history는 제거한다.
- package README는 user guide 2개와 root project link를 우선하고 analyzer/internal link를 일반 사용자
  목록에서 제거한다.
- 원래 사용자 문서의 유효한 privacy/error/cache 계약이 누락되지 않았는지 before/after inventory로
  확인한다.

### 검증

```bash
rg -n 'stage5|Task #[0-9]+|saved version|--server|candidate|unpublished|Next deployment|not yet live' README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md docs/readme-card.md
rg -n '[가-힣]' README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md docs/readme-card.md
rg -n 'npx codex-usage-profile@latest submit' README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md
rg -n '/api/share/\{handle\}|/u/\{handle\}/card\.png|/r/\{revision\}' README.md docs/readme-card.md
npm run verify:npm-release
npm run scan:public-release
git diff --check
git status --short
```

Stage 1에서 확정한 link checker와 GitHub Markdown render screenshot을 함께 검증한다.

### 완료·중단 조건

- 완료: first viewport, Quick start와 user guides가 영어·canonical production·fixed/revision 계약에서
  일치하고 npm artifact verifier가 계속 통과한다.
- 중단: user guide rewrite가 제품 동작 변경이나 npm 재게시를 요구하거나 기존 안전 경계를 복구할
  공식 진실 원천이 없다.

### 커밋

```text
Task #90 Stage 2: 사용자 중심 README와 공개 가이드 보정
```

## Stage 3 — contributor/maintainer navigation과 공개 tree 위생

### 진입 조건

- Stage 2 사용자 문서와 render 결과가 승인됐다.

### 산출물

신규:

- `docs/README.md`
- `mydocs/working/task_m100_90_stage3.md`

수정:

- `CONTRIBUTING.md`
- Stage 1에서 확정한 개인 절대경로 포함 historical `mydocs/working/*.md`
- `mydocs/orders/20260824.md`

### 변경 내용

- docs index는 User guides, Contributor/contracts, Maintainer operations, Legacy compatibility 표로
  나누고 각 문서의 audience, language와 역할을 영어로 표시한다.
- CONTRIBUTING은 Node requirement, local dev, standard/release validation, PR target과 docs index를
  기여자 흐름으로 연결한다. root README에서 제거한 Development 내용의 진실 원천이 된다.
- root README의 help/documentation은 두 사용자 가이드와 CONTRIBUTING만 직접 노출하는지 확인한다.
- historical 보고서의 개인 macOS home literal은 의미를 유지하는 `$HOME`, `<workspace>`,
  `<runtime>` 명령으로만 바꾼다. 결과·시간·판정·path 역할은 삭제하지 않는다.
- current tree와 Git history review finding을 구분해 scan 결과를 기록한다.

### 검증

```bash
node -e 'const fs=require("node:fs"); for (const file of ["README.md","CONTRIBUTING.md","docs/README.md","docs/cli-submit.md","docs/readme-card.md"]) { if (!fs.existsSync(file)) process.exitCode=1; }'
rg -n 'npm (install|ci)|npm run (dev|dev:runtime|test|build)' CONTRIBUTING.md package.json
rg -n 'production-hosting|sites-operations|npm-release|usage-snapshot-v2|codex-usage-analyzer' README.md
rg -n "$(printf '/Users/%s' melee)" README.md docs mydocs
npm run scan:public-release
npm run verify:npm-release
git diff --check
git status --short
```

Stage 1에서 확정한 relative link checker로 README/CONTRIBUTING/docs index의 모든 local target을
검사한다.

### 완료·중단 조건

- 완료: 사용자 navigation과 contributor/maintainer navigation이 분리되고 current tree 개인 절대경로가
  0이며 public scan blocker 0이다.
- 중단: historical evidence 의미를 바꾸지 않고 path를 일반화할 수 없거나 broken link가 남는다.

### 커밋

```text
Task #90 Stage 3: 문서 navigation과 공개 tree 위생 정리
```

## Stage 4 — source integration과 exact-main 공개 문서 승격

### 진입 조건

- Stage 3 보고서와 전체 source diff가 승인됐다.
- working tree가 clean이고 product source/package version/Sites manifest diff가 없다.
- checkpoint PR과 release PR의 base/head/title/body가 작업지시자에게 제시되고 각각 merge 지시를 받았다.

### 산출물

- non-closing checkpoint PR: `publish/task90 → devel`
- release PR: `devel → main`
- 신규: `mydocs/working/task_m100_90_stage4.md`
- 수정: `mydocs/orders/20260824.md`, 필요 시 integration 결과에 맞춘 구현계획

### 실행 순서

1. Stage 1–3 branch 전체 검증과 status를 재확인한다.
2. `local/task90:publish/task90`을 push하고 `devel` 대상 checkpoint PR을 만든다. `Closes #90`을
   넣지 않는다.
3. CI와 review를 확인하고 작업지시자 merge 뒤 `origin/devel`을 task branch에 non-destructive merge한다.
4. `origin/devel`과 `origin/main`의 path/tree 차이를 확인하고 release PR을 만든다.
5. 작업지시자 merge 뒤 approved #90 source와 `origin/main`의 README/CONTRIBUTING/docs/package README
   path diff와 tree provenance를 확인한다.
6. GitHub `main` rendered README의 card 크기, badge, heading, code block과 링크를 수동 확인한다.
7. product/npx/Sites remote mutation 0건을 확인하고 Stage 4 보고서를 commit한다.

### 검증

```bash
gh pr view {checkpoint_pr} --json state,baseRefName,headRefName,headRefOid,mergeCommit,statusCheckRollup
gh pr view {release_pr} --json state,baseRefName,headRefName,headRefOid,mergeCommit,statusCheckRollup
git merge-base --is-ancestor {approved_source_sha} origin/devel
git merge-base --is-ancestor {approved_source_sha} origin/main
git diff --exit-code {approved_source_sha} origin/main -- README.md CONTRIBUTING.md docs packages/codex-usage-profile-cli/README.md
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: checkpoint/release PR이 merge되고 exact #90 user-facing tree가 `main`에서 render되며 Issue #90은
  open이다.
- 중단: CI/review failure, tree drift, broken GitHub render, main-only conflict 또는 Issue 조기 close.

### 커밋

```text
Task #90 Stage 4: 공개 문서 exact-main 승격 검증
```

## Stage 5 — GitHub metadata cutover와 최종 공개 검증

### 진입 조건

- Stage 4 보고서와 `main` render 결과가 승인됐다.
- 아래 desired/rollback payload의 exact description과 현재 metadata가 read-only preflight로 일치한다.
- homepage/default branch 변경에 대한 별도 작업지시자 승인이 있다.

### 원격 mutation Gate

변경 대상은 `postmelee/codex-usage-profile` repository metadata 한 곳뿐이다.

| 필드 | 현재 rollback 값 | desired 값 |
|---|---|---|
| `description` | `Turn your Codex account usage into a shareable profile and stable GitHub README card.` | Stage 1에서 승인한 README value proposition 한 문장 |
| `homepage` | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` |
| `default_branch` | `devel` | `main` |

preflight의 현재 값이 표와 다르면 PATCH를 실행하지 않고 보고한다. mutation은 exact 3개 필드를 한 번에
PATCH하고 즉시 GET으로 확인한다. 일부 값만 반영되거나 README/render/check가 깨지면 같은 호출에서
rollback 3개 필드를 복구한다.

### 산출물

- GitHub repository metadata revision
- 신규: `mydocs/working/task_m100_90_stage5.md`
- 수정: `mydocs/orders/20260824.md`

### 실행 순서

1. repository metadata, exact main SHA, workflow badge와 production URL을 read-only preflight한다.
2. 별도 승인 뒤 description/homepage/default branch를 exact desired payload로 PATCH한다.
3. metadata GET, repository root/README render, CI badge, live card/share와 docs link를 확인한다.
4. public scan, npm release verifier와 git diff를 재검증한다.
5. production Site version/access/environment, npm dist-tag와 package version이 변하지 않았음을 read-only로
   확인한다.
6. `task-stage-report`로 Stage 5를 닫고 승인 뒤 `task-final-report`로 최종 보고와 final task PR을 만든다.

### 검증

```bash
gh api repos/postmelee/codex-usage-profile --jq '{description,homepage,default_branch}'
git rev-parse origin/main origin/devel HEAD
npm view codex-usage-profile dist-tags version --json
npm run verify:npm-release
npm run scan:public-release
rg -n 'codex-usage-profile-stage5|PROFILE_CARD_EMBED_PLACEHOLDER|not yet live|Next deployment' README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md docs/readme-card.md
rg -n 'branch=devel' README.md packages/codex-usage-profile-cli/README.md
rg -n "$(printf '/Users/%s' melee)" README.md docs mydocs
git diff --check
git status --short
```

GitHub repository root, badge와 production root/share/card GET/HEAD는 live read-only로 확인한다.

### 완료·중단 조건

- 완료: GitHub description/homepage/default branch, README badge/card/link와 exact `main`이 일치하고
  production/npm remote state는 불변이다.
- 중단/rollback: unexpected preflight, partial PATCH, default branch 뒤 README/CI/link 문제 또는 main
  tree drift가 있으면 metadata를 rollback payload로 복구하고 Stage를 완료 처리하지 않는다.

### 커밋

```text
Task #90 Stage 5: GitHub metadata 전환과 공개 검증 완료
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 문서 rewrite는 before inventory의 사용자 안전·privacy·cache/error 계약을 누락하지 않아야 한다.
- 실패한 link/render/scan/remote 검증은 단계 완료로 처리하지 않는다.
- 계획 변경, 문서 이동 또는 제품 source 변경이 필요하면 구현계획서를 먼저 갱신하고 승인받는다.
- remote mutation, PR merge, default branch 변경은 각 Gate의 명시 승인 없이는 실행하지 않는다.

## 커밋

- 각 Stage source와 `mydocs/working/task_m100_90_stage{N}.md`, 오늘할일 갱신을 한 단계 commit으로 묶는다.
- source integration 뒤 생성되는 Stage 4/5 보고서와 최종 보고서는 final task PR로 `devel`에 반영한다.
- checkpoint와 release PR은 Issue #90을 close하지 않는다.
- 최종 commit과 PR은 `task-final-report` 절차를 따른다.

## 단계 의존성

- Stage 2는 Stage 1 audit/outline 승인 뒤 진행한다.
- Stage 3은 Stage 2 README/user guide와 render 승인 뒤 진행한다.
- Stage 4는 Stage 3 전체 source diff/검증 승인 뒤 진행하고 checkpoint/release merge마다 지시를 받는다.
- Stage 5는 exact `main` render와 metadata payload 승인 뒤 진행한다.
- 최종 보고/PR은 Stage 5 원격 상태와 rollback readiness 승인 뒤 진행한다.

## 위험과 대응

- **내용 손실**: Stage 1 before inventory를 Stage 2/3 보고서 수용 기준으로 사용한다.
- **문서 언어 혼선**: user surface English와 maintainer/internal Korean을 docs index에서 명시하고 서로
  같은 목록으로 보이지 않게 한다.
- **npm README source/artifact 차이**: repository package README 보정은 다음 release source이며
  `0.1.3` registry를 다시 게시하지 않는다고 보고서에 명시한다.
- **GitHub image proxy**: origin GET/HEAD와 GitHub rendered Camo 결과를 분리해 검증하고 즉시 refresh를
  보장하지 않는다.
- **main/devel topology**: source checkpoint와 release PR을 분리하고 SHA/tree equality 전에는 metadata를
  바꾸지 않는다.
- **default branch 전환 영향**: external contributor PR base는 문서에서 계속 `devel`로 명시하고 task PR
  명령은 `--base devel`을 사용한다. default는 사용자 landing/release 기준일 뿐 integration branch를
  대체하지 않는다.
- **historical Git review findings**: current tree literal 제거와 immutable history finding을 분리해
  blocker만 release Gate로 사용한다.

## 승인 요청 사항

- 위 Stage 분할, README hierarchy, user guide rewrite, docs index와 historical path 최소 보정을 승인해 주세요.
- Stage 1은 공식 문서나 GitHub metadata를 수정하지 않는 read-only audit로 시작함을 승인해 주세요.
- Stage 4 checkpoint/release PR merge와 Stage 5 metadata PATCH는 해당 시점에 exact 입력을 다시 제시하고
  별도 승인을 받는 Gate로 유지합니다.

승인되면 Stage 1 read-only audit와 단계 보고서 작성부터 진행한다.
