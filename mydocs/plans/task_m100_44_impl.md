# 구현계획서 — Task #44: npm 패키지 배포 및 Sites production origin 확정

수행계획서: [`task_m100_44.md`](task_m100_44.md)
GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | npm release contract와 local artifact preflight | package verifier, tarball install smoke, pinned analyzer dependency | manifest·integrity·bin·secret/path·origin contract |
| 2 | public repository와 provenance release 준비 | history/public-surface scanner, release workflow, npm runbook, Gate A 입력 | repository 공개 위험, workflow 권한, license와 first-publish bootstrap |
| 3 | Gate A: repository public 전환과 immutable candidate | public repository, `publish/task44` preflight, exact candidate와 Gate B 입력 | anonymous source/support 접근, CI matrix, registry/name/account 재확인 |
| 4 | Gate B: `0.1.0` 최초 publish와 registry 고정 | package tag, provenance publication, future trusted-publisher 전환 | registry metadata·integrity·latest·attestation과 credential 폐기 |
| 5 | Gate C: published CLI production smoke와 사용자 문서 | isolated `npx` smoke, remote cleanup, 실제 install/운영 문서 | OAuth/device/submit/publish/revoke, origin binding과 privacy |
| 6 | release 판정과 #45 handoff | full regression, release evidence, 공식 문서 최종화 | fresh registry install, signature, 전체 회귀와 release blocker 판정 |

## 수행계획 반영과 추가 결정

- 수행계획서와 권고안 A가 승인됐다. 기본 경로는 repository public 전환,
  GitHub Actions의 최초 direct publish와 provenance, 성공 뒤 trusted publisher
  전환이다.
- 수행계획 승인은 repository visibility, npm registry, tag, release, secret,
  package access와 production data를 아직 변경하지 않는다. 각 remote mutation은
  아래 Gate의 exact 입력으로 다시 승인받는다.
- package directory의 [`LICENSE`](../../packages/codex-usage-profile-cli/LICENSE)는
  `codex-usage-profile` npm artifact에 MIT를 적용한다. repository root에는
  현재 license가 없으므로 repository 전체를 MIT로 재라이선스하는 결정은
  package publish와 별개다.
  - Gate A 기본안은 source를 public으로 열되 package directory의 MIT 범위만
    확정된 상태를 정확히 표시하는 것이다.
  - 작업지시자가 repository 전체 MIT를 원하면 root `LICENSE` 추가와 README
    license 표현을 Gate A에서 별도 승인한다.
  - 명시 승인 없이 package MIT 문구를 repository 전체 license로 확대하지 않는다.
- brand-new package는 npm staged publishing을 사용할 수 없고 package settings의
  trusted publisher도 아직 만들 수 없다. 최초 `0.1.0`만 최소 범위의 temporary
  npm credential과 GitHub-hosted runner를 사용한다.
- 최초 publish 성공 뒤에는 trusted publisher를 `npm stage publish` only로
  제한하고 traditional token publish를 disallow하는 경로를 기본안으로 한다.
  이후 release는 CI stage → maintainer 2FA approval을 거쳐야 한다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | `README.md` | OK | Stage 5~6에서 실제 registry install과 release 상태만 반영 |
| package 사용자 문서 | package root | `packages/codex-usage-profile-cli/README.md` | OK | Stage 2에서 publish artifact용 문구를 먼저 확정 |
| CLI 사용자 문서 | `docs/` | `docs/cli-submit.md` | OK | Stage 5에서 published install과 troubleshooting 반영 |
| card 사용자 문서 | `docs/` | `docs/readme-card.md` | OK | Stage 5에서 exact published CLI command 정렬 |
| npm release runbook | `docs/` | `docs/npm-release.md` | OK | Stage 2 초안, Stage 4~6에서 실제 channel·복구 절차 확정 |
| release workflow | `.github/workflows/` | `.github/workflows/publish-npm.yml` | OK | GitHub Actions의 검증·tag publish·future staged publish |
| 단계별 증적 | `mydocs/working/` | `mydocs/working/task_m100_44_stage{N}.md` | OK | secret/OTP/token 없이 count·digest·상태만 기록 |
| 최종 보고 | `mydocs/report/` | `mydocs/report/task_m100_44_report.md` | OK | exact version, provenance와 #45 handoff 보존 |

repository root `LICENSE`는 Gate A의 repository 전체 license 결정이 승인된
경우에만 저장소 루트에 추가한다. 법적 범위와 GitHub license detection을 위한
위치이며 `mydocs/`나 package subdirectory가 대안이 될 수 없다.

## 공통 구현 규칙

- 작업 경로는 `/private/tmp/codex-usage-profile-task44`, branch는
  `local/task44`로 고정한다. 메인 worktree의 `local/task43`과
  `codex-extracted/`를 수정하지 않는다.
- package 후보는 `packages/codex-usage-profile-cli` 한 workspace이며 root
  package는 `private: true`를 유지한다.
- first version 후보는 registry가 비어 있는 동안
  `codex-usage-profile@0.1.0`, npm dist-tag는 `latest`, Git tag는
  `codex-usage-profile-v0.1.0`이다. exact 값은 Gate B에서 다시 승인한다.
- package dependency `codex-usage-analyzer`는 공개 CLI의 실행 재현성을 위해
  검증된 exact `0.2.0`으로 pin한다. registry integrity와 package-lock이
  일치하지 않으면 publish를 중단한다.
- package `repository.url`은 provenance가 요구하는
  `https://github.com/postmelee/codex-usage-profile`와 대소문자까지 일치시킨다.
  `repository.directory`는 `packages/codex-usage-profile-cli`를 유지한다.
- release build는 GitHub-hosted Ubuntu runner, Node 24와 검증된 npm 11
  exact version을 사용한다. GitHub Action은 mutable major label 대신
  Stage 2 시점의 공식 release commit SHA로 pin하고 주석에 version을 남긴다.
- release workflow의 검증 job은 token과 `id-token: write`가 없다. publish
  job에만 `contents: read`, `id-token: write`와 npm registry context를 준다.
- temporary npm token은 GitHub Actions secret `NPM_TOKEN`으로만 전달한다.
  raw value를 argv, URL, Git config, source, log, report와 채팅에 넣지 않는다.
- workflow는 package tag와 `package.json` version이 exact하게 일치하지 않으면
  registry 요청 전에 실패한다.
- `publish/task44` remote branch는 Stage 3의 public-repository CI preflight에
  필요하므로 final PR 전 조기 생성할 수 있다. `local/task44` 이름을 원격에
  push하지 않는다.
- first publish tag는 Gate B 승인 뒤 candidate commit에 한 번 생성한다. publish
  실패 시 tag를 강제 이동하거나 같은 version source를 바꾸지 않는다.
- GitHub Release는 이번 task의 필수 산출물이 아니다. 별도 승인 없이는 package
  tag와 npm version만 만든다.
- npm/GitHub account username, secret 존재, 2FA와 permission은 필요한
  yes/no 상태만 보고한다. raw token, OTP, recovery code와 account session은
  출력하지 않는다.
- 실제 usage submit은 Gate C의 별도 data 전송 승인 뒤에만 수행한다. 전송
  범위는 Account Usage Contract v1 집계 field이며 prompt, response,
  Codex/OpenAI/GitHub credential과 local session file을 포함하지 않는다.
- remote smoke는 isolated HOME/XDG/npm cache와 새 product credential을
  사용한다. 기존 local CLI credential을 복사하지 않는다.
- registry version과 Git tag는 삭제/overwrite하지 않는다. publish 뒤 blocker는
  별도 `0.1.1`과 필요한 `npm deprecate` 문구를 승인받아 복구한다.
- ChatGPT Site source/deployment/environment/access, D1/R2 schema와 production
  architecture는 변경하지 않는다.
- 각 Stage는 `task-stage-report` 절차로 source/remote 증적과
  `mydocs/working/task_m100_44_stage{N}.md`를 함께 커밋하고 다음 Stage 승인을
  받는다.

## Stage 1 — npm release contract와 local artifact preflight

### 산출물

신규:

- `scripts/verify-npm-release.mjs`
- `scripts/smoke-npm-package-local.mjs`
- `scripts/__tests__/verify-npm-release.test.js`
- `scripts/__tests__/smoke-npm-package-local.test.js`
- `mydocs/working/task_m100_44_stage1.md`

수정:

- `package.json`
- `packages/codex-usage-profile-cli/package.json`
- `package-lock.json`
- 필요 시 package/CLI test

### 변경 내용

- root script에 `verify:npm-release`와 `smoke:npm-package:local`을 추가한다.
- package dependency를 `codex-usage-analyzer: "0.2.0"` exact로 pin하고 lock의
  registry URL, integrity, engine과 license를 검증한다.
- package metadata verifier는 다음 값을 fail-closed로 검사한다.
  - name `codex-usage-profile`, version `0.1.0`, license `MIT`
  - `private !== true`, public access와 registry
  - bin/exports/files allowlist와 package directory
  - production homepage/repository/bugs exact origin
  - Node `>=20`, analyzer exact dependency
  - package LICENSE 존재와 manifest license 일치
- pack verifier는 실제 tarball을 임시 directory에 만들고 다음을 검사한다.
  - 허용된 13개 전후 파일만 포함하고 `.env`, test, fixture, source map,
    workspace path와 symlink가 없음
  - executable bin mode, regular-file type, package name/version
  - SHA-1 shasum, SHA-512 integrity, packed/unpacked byte와 file count summary
  - credential-like assignment, private absolute path, backup/session file과
    repository-only marker가 없음
- secret scan은 fixture placeholder나 보안 설명 문구 자체를 secret으로
  오인하지 않도록 value shape와 path context를 함께 검사한다. report에는
  matched secret text를 출력하지 않고 category/path/count만 반환한다.
- local package smoke는 만들어진 exact tarball을 empty project에 설치하고
  package checkout이나 root workspace 없이 다음을 검증한다.
  - bin과 package export load
  - `--help`
  - credential 없는 `status`의 안전한 login-required 결과
  - explicit loopback `--server`와 invalid origin 부정 경계
  - temp HOME/XDG/npm cache 밖 파일 mutation 없음
- 이 Stage는 GitHub visibility/workflow, npm account/registry와 production
  Site를 변경하지 않는다.

### 검증

```bash
node --test scripts/__tests__/verify-npm-release.test.js
node --test scripts/__tests__/smoke-npm-package-local.test.js
node --test packages/codex-usage-profile-cli/test/config.test.js
node --test packages/codex-usage-profile-cli/test/cli.test.js
node --test packages/codex-usage-profile-cli/test/integration.test.js
npm run verify:npm-release
npm run smoke:npm-package:local
npm test
git diff --check
```

`npm pack`과 install은 사용자 global npm cache 권한/내용에 의존하지 않는
task 전용 임시 cache를 사용하고 종료 시 정확한 임시 directory만 삭제한다.

### 중단 조건

- package file allowlist, bin mode, license나 analyzer integrity를 고정하지
  못한다.
- tarball 또는 verifier output에 credential/private path가 나타난다.
- clean install이 workspace checkout 또는 기존 product credential을 요구한다.
- dependency pin이 기존 CLI contract/test를 회귀시킨다.

### 커밋

```text
Task #44 Stage 1: npm release contract와 local artifact preflight
```

## Stage 2 — public repository와 provenance release 준비

### 산출물

신규:

- `scripts/scan-public-release-surface.mjs`
- `scripts/__tests__/scan-public-release-surface.test.js`
- `.github/workflows/publish-npm.yml`
- `docs/npm-release.md`
- Gate A에서 repository 전체 MIT 승인 시 root `LICENSE`
- `mydocs/working/task_m100_44_stage2.md`

수정:

- `package.json`
- `packages/codex-usage-profile-cli/package.json`
- `packages/codex-usage-profile-cli/README.md`
- 필요 시 `README.md`의 아직 미게시 상태 설명

### 변경 내용

- public-release scanner는 모든 local/remote Git ref의 unique blob을 읽어 다음
  category를 검사한다.
  - GitHub/npm/Codex/OpenAI/cloud credential shape와 private key
  - `.env`, local auth/session/backup payload와 absolute user path
  - Sites source credential, OAuth client secret, maintenance token의 value
  - binary/archive/db dump와 public repository에 불필요한 대용량 artifact
- scanner는 blob content를 log/report에 복제하지 않고 ref/blob/path/category
  count만 반환한다. test fixture repository에서 current blob, deleted history,
  tag와 remote-tracking ref를 모두 검출하는지 확인한다.
- Git repository 밖 public surface를 read-only로 목록화한다.
  - Issue/PR body, comment, attachment
  - branch/tag/release, Actions workflow/artifact와 environment
  - repository description/homepage/topics, security 설정과 collaborator
  - 공개 전 함께 보이게 될 task 보고서의 owner handle/email/local path
- package MIT가 repository 전체에 자동 적용되지 않음을 Gate A 표에 명시한다.
  root MIT가 승인되면 기존 package LICENSE와 같은 저작권/본문을 root에 추가하고
  README에서 범위를 명시한다. 미승인 시 package directory만 MIT임을 명시한다.
- package manifest는 권고안 A에 맞춰 다음을 고정한다.
  - public GitHub homepage/repository/bugs
  - `publishConfig.access = "public"`
  - exact npm registry
  - `publishConfig.provenance = true`
- package README는 tarball 사용자가 읽는 현재형 문서로 정리한다.
  `0.1.0` exact install, `@latest` interactive use, privacy, production origin과
  support link를 포함하고 “#44 이후” 같은 내부 상태 문구를 제거한다.
- release workflow는 하나의 검증 경로와 두 publish phase를 갖는다.
  - branch/PR: Node 20/22/24 package test, verifier와 local pack smoke
  - first tag `codex-usage-profile-v0.1.0`: Node 24, npm exact version,
    `NPM_TOKEN`과 `--provenance --access public` direct publish
  - first publish 뒤 source 변경: 같은 workflow filename에서 future tag는
    trusted publisher의 `npm stage publish`만 수행
- release workflow는 cache를 끄고 install script 필요성을 명시적으로
  검증한다. publish job은 fork PR, branch push와 manual arbitrary ref에서
  실행되지 않는다.
- `docs/npm-release.md` 초안은 preflight, tag/version guard, first-publish
  bootstrap, trusted publisher 전환, 2FA approval, registry verification,
  token cleanup, patch/deprecate 복구를 값 없는 절차로 기록한다.
- Stage 2 종료 시 Gate A exact 표를 작성한다.

### Gate A 승인 입력

- repository:
  - exact `owner/name`, current visibility/default branch
  - 공개될 local/remote branches, tags, issues, PRs와 attachment count
  - full-history/public-surface scan category별 0/nonzero 결과
  - package-only MIT 또는 repository-wide MIT 선택
- package:
  - name/version, npm name availability
  - tarball file count/size/integrity와 analyzer exact integrity
  - homepage/repository/bugs, production origin
- workflow:
  - filename, pinned Action SHA, Node/npm version
  - first tag pattern, job permissions, environment/secret key 이름
  - first direct publish와 future stage-only trusted publishing 차이
- account:
  - npm login/2FA/publish eligibility yes/no
  - temporary token 최소 scope/expiry와 GitHub secret name
  - 값은 읽거나 보고하지 않음
- public transition:
  - repository public 전환의 fork/anonymous read/issue 공개 효과
  - package publish와 PR merge 사이 default documentation이 잠시 pre-release
    상태일 수 있는 bounded window
  - 중단/원복: scan failure면 private 유지, public 전환 뒤 secret 발견 시
    owner-only로 되돌리는 것으로 secret 폐기를 대신하지 않고 즉시 revoke

### 검증

```bash
node --test scripts/__tests__/scan-public-release-surface.test.js
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
npm test --workspace packages/codex-usage-profile-cli
npm test
git diff --check
```

추가 read-only 검증:

- npm package name `404`/ownership과 account 2FA/publish eligibility
- GitHub repository/branch/tag/issue/PR/release/Actions inventory
- workflow event/job permission과 tag/version fail-closed test
- GitHub Actions와 npm 공식 요구사항의 Node/npm/provenance 재확인

### 중단 조건

- history, Issue/PR attachment 또는 release artifact에서 revoke/삭제 전 공개할
  수 없는 credential/private payload가 발견된다.
- repository/license 공개 범위가 승인되지 않는다.
- package name/account ownership 또는 2FA가 first publish 조건을 충족하지 않는다.
- workflow가 branch/PR에서 publish되거나 token 없는 job에 write 권한을 준다.

### 커밋

```text
Task #44 Stage 2: public npm provenance release 준비
```

## Stage 3 — Gate A: repository public 전환과 immutable candidate

### 실행 전 조건

- Stage 2 보고서와 Gate A exact 표 승인
- public-release scan blocker 0건 또는 승인된 remediation 완료
- repository/package license 범위 승인
- npm account 2FA와 first-publish eligibility 확인
- temporary npm token은 아직 source/chat에 전달하지 않고 npm account에서
  작업지시자가 직접 생성할 준비만 완료

### 실행 순서

1. repository visibility/default branch와 Gate A inventory를 read-only로 다시
   확인한다.
2. approved license source와 release workflow가 포함된 clean commit을 확인한다.
3. 작업지시자의 exact Gate A 승인 범위로 repository를 public으로 한 번
   전환한다.
4. anonymous GitHub repository, package source path, issues와 support link가
   로그인 없이 열리는지 확인한다.
5. `local/task44`를 원격 `publish/task44`에 push한다. local branch 이름은
   원격에 만들지 않는다.
6. branch preflight GitHub Actions가 Node 20/22/24 package test,
   verifier/pack smoke를 통과하는지 확인한다.
7. task 전용 환경에서 final pack을 다시 만들고 exact candidate summary를
   고정한다.
8. 작업지시자가 npm에서 temporary first-publish token을 만들고 GitHub
   `NPM_TOKEN` secret에 직접 저장한다. token value는 Codex에 전달하지 않는다.
9. exact tag/version/artifact/account/workflow와 publish 실패 정책을 Gate B로
   제시한다.

### 산출물

- public `postmelee/codex-usage-profile`
- remote `publish/task44`
- passing public branch preflight
- redacted npm publish readiness
- exact `0.1.0` candidate manifest/integrity
- `mydocs/working/task_m100_44_stage3.md`

Stage 3은 npm tag, registry version, GitHub Release와 production usage를 만들지
않는다.

### Gate B 승인 입력

- package name/version/access/dist-tag
- candidate commit SHA, tarball filename/file count/packed/unpacked byte
- candidate SHA-1와 SHA-512 integrity
- dependency name/version/integrity와 Node engine
- workflow run URL/result, pinned Actions와 Node/npm version
- first tag `codex-usage-profile-v0.1.0`
- npm account/2FA/publish eligibility와 `NPM_TOKEN` secret 존재 yes/no
- registry name/version이 여전히 비어 있는지
- first publish command 의미와 provenance public transparency log
- 실패 분기:
  - auth/network failure + registry version 없음: tag 유지, secret 수정 뒤 same
    workflow rerun만 허용
  - registry version 생성: 재실행하지 않고 verification으로 이동
  - source/artifact defect: tag 이동/삭제 없이 publish 중단, 별도 version 판단

### 검증

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
npm run verify:npm-release
npm run smoke:npm-package:local
git diff --check
```

원격 검증:

- anonymous repository/package source/issues read
- branch CI Node 20/22/24와 release verifier pass
- package name/version `404`, account/2FA와 GitHub secret presence
- public repository와 package repository metadata exact match

### 중단·원복 조건

- public 전환 뒤 credential/private payload가 발견되면 publish를 중단하고
  credential을 즉시 revoke한다. visibility 원복만으로 노출 대응을 완료했다고
  보지 않는다.
- anonymous package source/support가 열리지 않거나 GitHub Actions preflight가
  실패한다.
- repository default branch/history가 Gate A inventory와 다르다.
- temporary token이 chat/log/source에 노출된다.

### 커밋

```text
Task #44 Stage 3: public repository와 immutable npm candidate
```

Stage 3 remote branch push와 report commit 순서 때문에 report commit 뒤
`publish/task44`를 같은 branch의 최신 commit으로 한 번 더 fast-forward push할
수 있다.

## Stage 4 — Gate B: `0.1.0` 최초 publish와 registry 고정

### 실행 전 조건

- Stage 3 보고서와 Gate B exact publish 승인
- candidate commit/tag/version과 registry empty 상태 재확인
- GitHub `NPM_TOKEN` secret 존재, raw token 비조회
- tag publish workflow와 failure branch 최종 확인

### 실행 순서

1. approved candidate commit에 annotated
   `codex-usage-profile-v0.1.0` tag를 한 번 만든다.
2. tag SHA/version/package integrity를 local에서 다시 확인한다.
3. tag를 origin에 push해 GitHub Actions first-publish job을 시작한다.
4. 동일 workflow run을 terminal 상태까지 조회한다. 새 tag나 duplicate publish를
   만들지 않는다.
5. registry가 version을 생성했는지 exact version부터 조회한다.
6. registry tarball을 task 전용 cache로 내려받아 candidate shasum/integrity,
   file manifest와 bin을 대조한다.
7. npm page의 public access, `latest`, repository, license와 provenance
   attestation을 확인한다.
8. clean project에서 exact version을 설치하고 help/export/status
   login-required contract를 검증한다.
9. package 생성 뒤 작업지시자가 npm package settings에서 다음을 직접
   설정한다.
   - trusted publisher: GitHub Actions,
     `postmelee/codex-usage-profile`, `publish-npm.yml`
   - allowed action: `npm stage publish` only
   - publishing access: 2FA required and traditional tokens disallowed
10. source workflow를 future `npm stage publish`로 전환한다.
11. 작업지시자가 temporary npm token을 revoke하고 GitHub `NPM_TOKEN`
    secret을 삭제한다. 존재/삭제 상태만 확인한다.

### 산출물

- public `codex-usage-profile@0.1.0`
- `latest -> 0.1.0`
- Git tag `codex-usage-profile-v0.1.0`
- provenance/publish attestation
- stage-only trusted publisher와 tokenless future workflow
- `docs/npm-release.md`의 actual first/future release 상태
- `mydocs/working/task_m100_44_stage4.md`

### 검증

```bash
npm view codex-usage-profile@0.1.0 --json
npm view codex-usage-profile dist-tags --json
npm pack codex-usage-profile@0.1.0 --json
npx --yes codex-usage-profile@0.1.0 --help
npm audit signatures
npm run verify:npm-release
git diff --check
```

실제 command는 task 전용 HOME/XDG/npm cache에서 실행하고 registry response의
public metadata/digest만 report에 남긴다.

### 실패 처리

- workflow 실패 + registry version 없음:
  - tag를 이동/삭제하거나 version을 바꾸지 않는다.
  - auth/network/config 원인을 secret value 없이 확인한다.
  - source가 같고 auth/environment만 고친 경우 같은 run rerun 승인을 요청한다.
- registry version이 존재:
  - workflow UI 실패만 보고 duplicate publish하지 않는다.
  - registry artifact를 검증하고 실제 결함이면 patch/deprecation Gate로 전환한다.
- candidate/registry integrity 불일치:
  - install과 홍보를 중단한다.
  - `0.1.0` unpublish나 overwrite를 수행하지 않고 exact 영향과 `0.1.1`
    remediation을 별도 승인받는다.

### Gate B 실패 복구 A — npm 12 pack JSON 호환

2026-07-28 최초 tag run `30351424886`은 Node 20·22·24 verify를 통과한 뒤
publish job의 `npm run verify:npm-release`에서 중단됐다. npm `12.0.1`의
`npm pack --json`이 npm 11의 단일 원소 배열 대신 package ID를 key로 한
단일 원소 object map을 반환했지만 verifier가 배열만 허용한 것이 원인이다.
실제 `npm publish` step은
`skipped`였고 registry의 `codex-usage-profile@0.1.0`은 `E404`다.

작업지시자가 승인한 복구안 A는 다음 경계를 따른다.

1. 기존 annotated `codex-usage-profile-v0.1.0` tag와 대상 commit은 이동,
   삭제, 재생성하지 않는다.
2. verifier는 npm 11의 단일 원소 배열과 npm 12의 단일 원소 object map을
   같은 한 candidate로 정규화한다. 빈 배열·object, 복수 원소, direct
   candidate object, null과 primitive는 계속 fail-closed한다.
3. package source, manifest version, file allowlist와 expected digest는
   바꾸지 않는다. 수정 뒤 exact candidate가 Stage 3 SHA-1/SHA-512와 같은지
   다시 확인한다.
4. workflow는 일회성 exact
   `codex-usage-profile-v0.1.0-recovery.1` tag만 추가 허용한다.
   `workflow_dispatch`, broad tag pattern과 branch publish는 허용하지 않는다.
5. 수정 commit을 원격 `publish/task44`에 fast-forward하고 Node 20·22·24
   branch preflight를 통과시킨다.
6. recovery commit SHA, tag, 동일 candidate digest, workflow와 registry
   empty 상태를 Gate B-R로 제시한다. 별도 Gate B-R 승인 전에는 recovery
   tag를 생성하거나 push하지 않는다.
7. 승인 뒤 recovery tag를 한 번 생성·push하고 같은 `npm-publish`
   environment reviewer gate를 거친다. 성공 뒤 one-time recovery path는
   trusted publisher stage-only workflow 전환에서 제거한다.

recovery provenance는 package file이 동일한 recovery commit과 exact recovery
tag를 가리킨다. 기존 canonical tag는 최초 승인 source commit을 계속
가리키며 두 tag 모두 이동하거나 삭제하지 않는다.

### 중단 조건

- version/tag/account/artifact가 Gate B 값과 다르다.
- provenance가 다른 repository/workflow/ref를 가리킨다.
- registry tarball에 candidate 외 파일, secret/private path가 있다.
- temporary token 폐기 또는 trusted publisher 설정을 확인할 수 없다.

### 커밋

```text
Task #44 Stage 4: npm 0.1.0 provenance publish와 registry 검증
```

## Stage 5 — Gate C: published CLI production smoke와 사용자 문서

### Gate C 승인 입력

- exact install: `npx --yes codex-usage-profile@0.1.0`
- production origin과 OAuth device verification URL
- 전송 field: Account Usage Contract v1의 identity-free 집계
- 명시 제외: prompt, response, tool data, Codex/OpenAI/GitHub credential,
  local Codex session file
- isolated HOME/XDG/npm cache와 product credential directory
- 생성되는 browser session, CLI token, private owner/profile, D1/R2 publication
- publish/unpublish/revoke/logout과 exact owner cleanup 계획
- 종료 선택:
  - 기본안: publication/session/token/credential과 owner test data exact cleanup
  - 대안: 작업지시자가 홍보용 owner profile 보존을 명시 승인한 경우 private/public
    상태와 보존 data를 별도로 기록

### 실행 순서

1. Gate C data 전송·cleanup 승인을 받는다.
2. 기존 product credential과 npm cache가 없는 isolated directory를 만든다.
3. registry exact version의 help와 default production origin을 확인한다.
4. published CLI login으로 새 device flow를 만들고 production GitHub session에서
   승인한다.
5. one-time exchange, status와 Contract v1 submit을 실행한다.
6. submit 직후 private profile/public 404/private preview를 확인한다.
7. publish 뒤 public JSON/HTML, stable `en`/`ko` card GET/HEAD/304를 확인하고
   unpublish 뒤 404를 재확인한다.
8. `--server`, environment override와 stored issuing-origin token이 다른
   origin에 전송되지 않는 local negative fixture를 재확인한다.
9. web Settings revoke, CLI status 거부와 logout으로 credential을 제거한다.
10. 승인된 종료 선택에 따라 exact plan/digest/count로 test owner data를
    cleanup하거나 홍보 profile의 보존 상태를 기록한다.
11. registry success와 smoke가 모두 확인된 뒤 사용자 문서를 현재형으로
    갱신한다.

### 산출물

수정:

- `README.md`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `docs/readme-card.md`
- `docs/npm-release.md`
- 필요 시 #45의 exact package/version handoff metadata

신규:

- `mydocs/working/task_m100_44_stage5.md`

package `0.1.0` tarball README는 이미 Stage 2 candidate에 포함되므로 source
README의 Stage 5 변경이 package runtime을 바꾸지 않는다. tarball 문구 오류가
기능/보안 blocker면 같은 version을 고치지 않고 patch version 판단으로 전환한다.

### 검증

```bash
npx --yes codex-usage-profile@0.1.0 --help
npx --yes codex-usage-profile@0.1.0 login
npx --yes codex-usage-profile@0.1.0 status
npx --yes codex-usage-profile@0.1.0 submit
npx --yes codex-usage-profile@0.1.0 logout
npm run test:e2e
npm run verify:npm-release
git diff --check
```

원격 확인:

- production OAuth/device/submit/status/revoke
- private 404, publish GET/HEAD/304, unpublish 404
- clean credential removal과 승인된 owner/test data 종료 상태
- recent error log의 credential/private usage 비노출

### 중단·원복 조건

- published CLI가 checkout/local tarball을 참조하거나 production default가
  다르다.
- 승인 범위 밖 data/credential/session file을 읽거나 전송한다.
- login/submit/publication/revoke 중 기능·보안 blocker가 발생한다.
- cleanup plan digest/count가 예상과 다르다.

### 커밋

```text
Task #44 Stage 5: published CLI production smoke와 사용자 문서
```

## Stage 6 — release 판정과 #45 handoff

### 산출물

수정:

- `docs/npm-release.md`
- 필요 시 `README.md`, package README와 CLI/card 문서의 검증 결과 보정
- `mydocs/orders/20260728.md`

신규:

- `mydocs/working/task_m100_44_stage6.md`

GitHub:

- #45에 exact `codex-usage-profile@0.1.0`, production origin, provenance와
  Stage 5 cleanup/보존 상태를 handoff
- #43은 fallback trigger 대기로 유지

### 변경 내용

- package name/version/access/latest, tarball integrity, provenance source와
  trusted publisher/token cleanup을 최종 read-only로 재확인한다.
- public repository의 default branch, package source/support link, license
  범위와 공개 문서를 actual registry 상태와 대조한다.
- clean npm cache에서 exact version과 `@latest`를 각각 설치해 같은 version/bin을
  제공하는지 확인한다.
- 전체 Node/E2E/build/Sites artifact 검증으로 npm release 변경이 production
  runtime과 fallback을 회귀시키지 않았는지 확인한다.
- registry install tree에서 analyzer exact version/integrity와 signature를
  확인한다.
- fresh-user whole-flow의 독립 release decision은 #45에 남긴다. #44는
  maintainer-owned publish smoke를 통과했음을 구분해 기록한다.
- 잔여 위험, patch/deprecation policy, public repository와 package license
  범위를 Stage 6 보고와 최종 보고 입력으로 고정한다.

### 검증

```bash
npm test
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
npm run verify:npm-release
npm run smoke:npm-package:local
npm view codex-usage-profile@0.1.0 --json
npm view codex-usage-profile dist-tags --json
npm audit signatures
git diff --check
```

추가 검증:

- empty HOME/XDG/npm cache에서 exact version과 `@latest`의 version/bin 일치
- public GitHub package source, issues/support와 official docs link
- npm/GitHub credential, OTP, local path, private usage와 session의
  source/tarball/log/report 비노출
- package tag와 provenance subject/source/workflow 일치
- #45 선행조건과 제외 범위 일치

### 중단 조건

- registry/package/provenance가 approved candidate와 다르다.
- source/tarball/log/document에서 credential/private data가 발견된다.
- `@latest`가 `0.1.0`이 아니거나 fresh install이 production origin을 사용하지
  않는다.
- #45에 넘기기 전 unresolved 기능·보안 blocker가 있다.

### 커밋

```text
Task #44 Stage 6: npm release 판정과 production QA handoff
```

## 검증

- 각 Stage의 명령과 중단 조건을 해당 Stage 안에서 통과한다.
- Stage 3 public repository 전환, Stage 4 first publish와 Stage 5 production
  usage/data는 각각 별도 exact 승인을 받는다.
- first publish 전 registry version은 없고, publish 뒤 exact `0.1.0` 한
  version과 `latest`만 승인된 artifact를 가리킨다.
- published package provenance는 public
  `postmelee/codex-usage-profile`, approved workflow/ref와 artifact를 가리킨다.
- future release는 trusted publisher stage-only + maintainer 2FA approval이며
  temporary first-publish token과 GitHub secret이 남지 않는다.
- clean install OAuth/CLI/submit/logout과 origin binding이 통과한다.
- package/source/log/report에 secret, OTP, prompt, response, local session과
  private path가 없다.
- ChatGPT Sites production/fallback build와 runtime contract가 회귀하지 않는다.
- 모든 단계 보고서와 최종 보고서가 승인된 위치에 존재한다.
- PR 준비 전 `git status --short`가 빈 출력이고 `git diff --check`가 통과한다.

## 커밋

```text
Task #44: 구현 계획서 작성과 오늘할일 갱신
Task #44 Stage 1: npm release contract와 local artifact preflight
Task #44 Stage 2: public npm provenance release 준비
Task #44 Stage 3: public repository와 immutable npm candidate
Task #44 Stage 4: npm 0.1.0 provenance publish와 registry 검증
Task #44 Stage 5: published CLI production smoke와 사용자 문서
Task #44 Stage 6: npm release 판정과 production QA handoff
Task #44: 최종 보고서 작성과 오늘할일 완료 처리
```

## 단계 의존성

```text
수행계획 승인
  -> 구현계획 승인
  -> Stage 1 local package contract
  -> Stage 1 보고 승인
  -> Stage 2 public-release source/scan + Gate A
  -> Gate A exact 승인
  -> Stage 3 repository public + branch CI + Gate B
  -> Gate B exact publish 승인
  -> Stage 4 immutable npm 0.1.0 publish
  -> Stage 4 보고 승인
  -> Gate C data 전송/cleanup 승인
  -> Stage 5 published production smoke/docs
  -> Stage 5 보고 승인
  -> Stage 6 final regression/#45 handoff
  -> 최종 보고서와 PR
```

Stage 2 보고 승인은 Gate A repository public 승인을 대신하지 않는다. Stage 3
보고 승인은 Gate B npm publish 승인을 대신하지 않는다. Stage 4 보고 승인은
Gate C production usage 전송과 cleanup 승인을 대신하지 않는다.

## 위험과 대응

| 위험 | 대응 |
|---|---|
| first version overwrite 불가 | exact candidate/Gate B, tag 이동 금지, patch/deprecate 별도 승인 |
| private history의 credential/PII 공개 | 모든 ref/blob + GitHub public surface scan, match value 비출력, blocker면 private 유지 |
| repository 전체 license 오인 | package MIT와 root license를 분리하고 Gate A에서 명시 선택 |
| temporary npm token 노출 | GitHub secret only, 최소 scope/expiry, Actions masking, 성공 직후 secret/token 폐기 |
| branch/PR에서 accidental publish | tag/version/repository exact guard, publish job scoped permissions |
| provenance가 잘못된 source를 가리킴 | public repo, exact repository metadata, OIDC subject/workflow/ref 검증 |
| publish와 final PR merge 사이 문서 지연 | package README 선반영, root docs는 실제 publish 직후 Stage 5에서 즉시 갱신, 홍보는 PR/#45 이후 |
| registry partial success/전파 지연 | exact version 우선 조회, duplicate publish 금지, bounded polling |
| published runtime defect | unpublish/overwrite 금지, `0.1.1`와 deprecation exact approval |
| 실제 usage/privacy 범위 초과 | Gate C field allowlist, isolated config, revoke/logout/unpublish/exact cleanup |
| main worktree Task #43 충돌 | 별도 worktree/branch 유지, Task #43 파일·remote resource 미변경 |

## 승인 요청 사항

- 6개 Stage, 파일, 검증, commit과 Gate A/B/C 경계를 승인해 달라.
- Stage 1에서 package verifier, local tarball smoke와 analyzer exact `0.2.0`
  pin을 구현하는 것을 승인해 달라.
- repository 전체 MIT 적용은 이번 구현계획 승인으로 간주하지 않는다.
  Gate A에서 root `LICENSE` 추가 여부를 별도로 선택한다.
- Stage 1 승인에는 repository public 전환, remote branch push, npm/GitHub
  credential 생성, npm publish, tag와 production usage 전송이 포함되지 않는다.

승인되면 Stage 1 source와 test만 구현하고 `task-stage-report` 절차로 결과를
보고한다.
