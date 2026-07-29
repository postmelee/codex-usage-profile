# 구현계획서 — Task #57: macOS 앱 번들 Codex 자동 탐색 및 CLI patch release

수행계획서: [`task_m100_57.md`](task_m100_57.md)
GitHub Issue: [#57](https://github.com/postmelee/codex-usage-profile/issues/57)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | analyzer dependency와 patch version 채택 | CLI `0.1.1`, analyzer `0.4.1`, exact lock/verifier contract | CLI test, verifier test, registry metadata |
| 2 | executable lookup과 packed package smoke | isolated tarball install, installed dependency 검사, macOS bundle fallback 증적 | local package smoke, PATH/app-bundle/fail-close 시나리오 |
| 3 | 공식 문서와 immutable release candidate | 사용자·통합·release 문서, 전체 preflight, Gate B exact 값 | public scan, full test, candidate digest |
| 4 | provenance patch publish와 production smoke | immutable tag, staged publish, npm `latest`, prefix 없는 submit 검증 | Actions matrix, provenance/integrity, production status |

## 수행계획 반영과 고정 결정

- 작업지시자가 수행계획서와 권고안을 승인했다.
- profile CLI에는 실행 파일 탐색기를 새로 구현하지 않는다. 공개된
  `codex-usage-analyzer@0.4.1`의 resolver를 exact dependency로 채택한다.
- package version은 `0.1.1`, tag는
  `codex-usage-profile-v0.1.1`로 고정한다.
- 기존 `0.1.0`, canonical/recovery tag와 npm artifact는 수정·이동·삭제하지
  않는다.
- Account Usage Contract v1, backend/Sites, credential와 submit body/header
  계약은 변경하지 않는다.
- publish는 기존 `.github/workflows/publish-npm.yml`, GitHub
  `npm-publish` environment, trusted publisher와
  `npm stage publish --access public`만 사용한다.
- 수행계획 승인은 tag push와 npm 공개 승인을 자동 승인하지 않는다.
  Stage 3에서 exact commit/candidate 값을 채운 뒤 Gate B 승인을 다시
  요청한다.
- 모든 Stage는 `task-stage-report` 절차로
  `mydocs/working/task_m100_57_stage{N}.md`를 작성해 해당 Stage 변경과 함께
  커밋하고 다음 Stage 승인을 받는다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 사용자 첫 실행 안내 | 저장소 root | `README.md` | OK | `@latest`와 exact automation version 갱신 |
| npm package 사용자 안내 | package root | `packages/codex-usage-profile-cli/README.md` | OK | tarball에 포함되는 requirement 갱신 |
| CLI 상세 계약 | 기존 공식 `docs/` | `docs/cli-submit.md` | OK | bundle fallback과 troubleshooting 갱신 |
| analyzer 책임 경계 | 기존 공식 `docs/` | `docs/codex-usage-analyzer.md` | OK | active exact dependency와 lookup 순서 갱신 |
| npm release runbook | 기존 공식 `docs/` | `docs/npm-release.md` | OK | `0.1.1` staged patch 결과와 immutable 상태 기록 |
| 단계별 결과 | `mydocs/working/` | `mydocs/working/task_m100_57_stage{N}.md` | OK | secret·usage value 없이 safe metadata만 기록 |
| 최종 결과 | `mydocs/report/` | `mydocs/report/task_m100_57_report.md` | OK | registry/provenance/production 결과와 #55 handoff |

새 공식 문서 루트, `mydocs/manual` 문서 또는 별도 기술 노트는 만들지
않는다. 실제 변경 범위가 표와 달라지면 구현 전에 계획 변경 승인을
받는다.

## 공통 실행 규칙

- 작업 경로는 `/private/tmp/codex-usage-profile-task57`, branch는
  `local/task57`로 고정한다.
- main worktree, `local/task43`과 사용자 소유 변경은 수정·삭제·merge·rebase
  하지 않는다.
- package/version 변경은 npm의 `--ignore-scripts`와 `--no-git-tag-version`
  경계를 사용하고 lifecycle script를 실행하지 않는다.
- registry dependency는 아래 exact metadata를 기준으로 시작하고 실제
  lockfile/npm registry 결과와 대조한다.
  - package: `codex-usage-analyzer@0.4.1`
  - resolved:
    `https://registry.npmjs.org/codex-usage-analyzer/-/codex-usage-analyzer-0.4.1.tgz`
  - integrity:
    `sha512-0UJFechEYosMyXzlNqlDxyrjM2B1muzrec9CqBgVZW6CYG9VZ8eXteeuNfXIeBVQMx2jxO2XMu9UpCQrsQSQmw==`
  - license: MIT
  - Node engine: `>=20`
- app-server stderr, raw RPC, Account Usage aggregate 값, local path,
  credential와 session data를 test/report/chat에 출력하지 않는다.
- macOS 실제 bundle smoke는 result key allowlist와 contract version만
  확인한다. usage 숫자, daily bucket, credential, identity를 기록하지
  않는다.
- task 전용 npm cache와 임시 consumer는 `mktemp -d`로 만들고 exact path만
  정리한다. 기존 사용자 npm cache/config를 삭제하지 않는다.
- release scanner가 credential/private path blocker를 하나라도 찾으면
  tag/publish를 중단한다.
- tag는 annotated tag로 한 번만 만들며 이동·재생성하지 않는다.
- npm stage 검토 전에는 public `0.1.1`이 생성됐다고 보고하지 않는다.

## Stage 1 — analyzer dependency와 patch version 채택

### 산출물

신규:

- `mydocs/working/task_m100_57_stage1.md`

수정:

- `packages/codex-usage-profile-cli/package.json`
- `packages/codex-usage-profile-cli/src/cli.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `package-lock.json`
- `scripts/verify-npm-release.mjs`
- `scripts/__tests__/verify-npm-release.test.js`

### 변경 내용

1. CLI package version과 `CLI_VERSION`을 `0.1.1`로 맞춘다.
2. analyzer dependency를 exact `0.4.1`로 갱신하고 lifecycle script 없이
   lockfile을 재생성한다.
3. root lockfile의 workspace version, analyzer version/resolved/integrity,
   license와 engine이 exact 값인지 확인한다.
4. release verifier의 expected CLI/analyzer metadata를 새 exact 값으로
   갱신한다. range, workspace/file/link dependency와 bundled dependency는
   계속 거부한다.
5. CLI public API와 Account Usage Contract v1 validator/error mapping이
   `0.4.1` 결과와 호환되는지 기존 test와 version assertion으로 검증한다.
6. analyzer가 늘린 experimental exports는 profile CLI가 import·re-export
   하지 않는지 확인한다.

### 검증

```bash
npm install --package-lock-only --ignore-scripts
npm test --workspace packages/codex-usage-profile-cli
node --test scripts/__tests__/verify-npm-release.test.js
npm run verify:npm-release
git diff --check
```

추가 확인:

- `npm view codex-usage-analyzer@0.4.1 version dist.integrity license engines`
- `npm ls codex-usage-analyzer --all`
- package manifest와 lockfile에 `file:`, `link:`, `workspace:` 부재

### 중단 조건

- published `0.4.1` metadata/integrity가 승인 기준과 다르다.
- Account Usage Contract v1 또는 `readAccountUsage()` 호환성이 깨진다.
- install lifecycle script, bundled dependency 또는 range dependency가
  추가된다.
- profile CLI의 public surface에 analyzer experimental API가 노출된다.

### 커밋

```text
Task #57 Stage 1: analyzer dependency와 patch version 채택
```

## Stage 2 — executable lookup과 packed package smoke

### 실행 전 조건

- Stage 1 보고서 승인
- exact analyzer dependency와 verifier contract 확정

### 산출물

신규:

- `mydocs/working/task_m100_57_stage2.md`

수정:

- `scripts/smoke-npm-package-local.mjs`
- `scripts/__tests__/smoke-npm-package-local.test.js`
- 필요 시 `packages/codex-usage-profile-cli/test/cli.test.js`

### 변경 내용

1. isolated local tarball install 후 설치된 profile CLI `0.1.1`과 analyzer
   `0.4.1`의 exact version, registry dependency와 lifecycle-script 부재를
   검사한다.
2. existing help/status/unsafe-origin/credential-free smoke를 유지하고
   version/dependency 확인을 별도 check로 추가한다.
3. upstream analyzer test 결과 또는 published source를 근거로 resolver가
   다음 순서를 사용하는지 대조한다.
   1. PATH의 executable `codex`
   2. `/Applications/ChatGPT.app/Contents/Resources/codex`
   3. `/Applications/Codex.app/Contents/Resources/codex`
   4. user Applications의 동일 두 후보
   5. 후보 부재 시 `CODEX_NOT_FOUND`
4. macOS task shell에서 PATH의 `codex`를 제외한 sanitized environment로
   installed analyzer를 호출한다. 표준 ChatGPT 앱 bundle을 사용해
   `account/usage/read`가 성공하는지 확인하되 결과는 allowlist key와
   contract version만 검증한다.
5. dependency-injected CLI test에서 analyzer not-found/error mapping과
   submit payload exact validation이 그대로 유지되는지 확인한다.

### 검증

```bash
node --test scripts/__tests__/smoke-npm-package-local.test.js
npm run smoke:npm-package:local
npm run verify:npm-release
npm test --workspace packages/codex-usage-profile-cli
git diff --check
```

macOS 수동 smoke:

- PATH 후보 제외 상태에서 standard ChatGPT app bundle 선택
- app-server `account/usage/read` 성공
- 반환 document top-level이 `contractVersion`, `capturedAt`, `summary`,
  `dailyUsageBuckets` allowlist와 일치
- raw aggregate, stderr, RPC, credential와 local path 출력 없음

### 중단 조건

- isolated tarball이 analyzer `0.4.1` 외 version을 설치한다.
- PATH 우선순위나 표준 앱 후보가 upstream 공개 source/test와 다르다.
- bundle fallback이 credential/session file을 직접 읽는 새 경로를 만든다.
- smoke output에 usage aggregate, credential 또는 private path가 노출된다.

### 커밋

```text
Task #57 Stage 2: executable lookup과 packed package smoke
```

## Stage 3 — 공식 문서와 immutable release candidate

### 실행 전 조건

- Stage 2 보고서 승인
- PATH/app-bundle/fail-close 검증 결과 확정

### 산출물

신규:

- `mydocs/working/task_m100_57_stage3.md`

수정:

- `README.md`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `docs/codex-usage-analyzer.md`
- `docs/npm-release.md`

### 변경 내용

1. root/package README의 public version, exact automation command와
   requirement를 `0.1.1` 및 PATH-or-standard-app-bundle 기준으로 갱신한다.
2. `docs/cli-submit.md`에 lookup 순서, supported standard locations,
   `CODEX_NOT_FOUND` fallback과 비표준 위치의 공식 CLI 설치 안내를
   기록한다.
3. `docs/codex-usage-analyzer.md`의 active exact dependency와 책임 경계를
   `0.4.1`로 갱신하되 Account Usage Contract v1과 identity-free 경계를
   유지한다.
4. `docs/npm-release.md`에 `0.1.0` immutable 이력은 보존하고 `0.1.1`
   patch candidate, staged publishing Gate와 최종 검증 항목을 추가한다.
5. 전체 public release scanner/test/candidate/smoke를 clean worktree에서
   실행한다.
6. Stage 3 보고서에 secret·usage value 없이 다음 Gate B exact 값을
   채운다.

### Gate B 승인 입력

| 항목 | Stage 3에서 채울 값 |
|---|---|
| candidate commit | full 40-character SHA |
| package | `codex-usage-profile@0.1.1` |
| dependency | `codex-usage-analyzer@0.4.1` |
| tag | `codex-usage-profile-v0.1.1` |
| tarball | filename, file count, size, SHA-1, SHA-512/integrity |
| scanner | blocker/review count와 허용 판단 |
| local verification | Node/npm version, CLI/root tests, local tarball smoke |
| workflow | `.github/workflows/publish-npm.yml`, trusted publisher, `npm-publish` environment |
| 외부 변경 | immutable Git tag push, npm staged package 생성 |
| 사용자 동작 | npm staged package/provenance 검토 후 2FA 승인 |
| 실패 처리 | tag 이동 금지, public version 생성 전 중단 또는 새 patch 계획 |

Gate B는 위 표가 exact 값으로 채워지고 current registry에 `0.1.1`이 없으며
tag가 존재하지 않는 것을 재확인한 뒤 요청한다.

### 검증

```bash
node --test scripts/__tests__/scan-public-release-surface.test.js
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
npm test --workspace packages/codex-usage-profile-cli
npm test
git diff --check
git status --short
```

read-only remote 확인:

- `npm view codex-usage-profile versions dist-tags --json`
- `git ls-remote --tags origin codex-usage-profile-v0.1.1`
- trusted publisher/environment/workflow exact 설정

### 중단 조건

- scanner blocker가 1개 이상이거나 review 항목이 승인 범위를 벗어난다.
- package candidate file allowlist, version, dependency 또는 integrity가
  expected contract와 다르다.
- registry에 `0.1.1`이 이미 있거나 remote tag가 존재한다.
- 전체 test/smoke가 실패하거나 worktree가 dirty다.
- trusted publisher가 repository/workflow/environment exact 설정과 다르다.

### 커밋

```text
Task #57 Stage 3: 공식 문서와 immutable release candidate
```

## Stage 4 — provenance patch publish와 production smoke

### 실행 전 조건

- Stage 3 보고서와 exact Gate B 값 승인
- candidate commit/tag/version과 current registry absence 재확인
- GitHub Actions/npm status 정상

### 산출물

신규:

- `mydocs/working/task_m100_57_stage4.md`

수정:

- `docs/npm-release.md`의 실제 run/provenance/registry 결과
- `mydocs/orders/20260729.md`의 진행 메모

### 실행 순서

1. 승인된 candidate commit에 annotated
   `codex-usage-profile-v0.1.1` tag를 생성하고 exact tag target을
   재확인한다.
2. tag 하나만 origin에 push한다. local task branch는 push하지 않는다.
3. publish workflow의 Node 20/22/24 verify jobs와 environment gate를
   확인한다.
4. trusted publisher가 만든 npm staged package의 name/version,
   repository, dependency, file list, integrity와 provenance source를
   Gate B 값과 대조한다.
5. 작업지시자가 npm 웹에서 staged package를 2FA 승인한다.
6. public registry의 exact `0.1.1`, `latest`, tarball integrity,
   signatures/attestation과 clean install을 익명 환경에서 검증한다.
7. 기존 production credential을 노출하지 않는 사용자 shell에서 별도
   PATH prefix 없이 `npx codex-usage-profile@latest submit --json`과
   `status`를 실행한다.
8. submit이 Account Usage Contract v1만 전송하고 status가 latest usage를
   인식하며 public/private visibility를 변경하지 않는지 확인한다.
9. 실제 release run/provenance/integrity를 `docs/npm-release.md`와 Stage 4
   보고서에 safe metadata로 기록한다.

### 검증

```bash
npm view codex-usage-profile@0.1.1 --json
npm view codex-usage-profile dist-tags --json
npx codex-usage-profile@latest submit --json
npx codex-usage-profile@latest status
npm run verify:npm-release
npm run smoke:npm-package:local
git diff --check
```

remote 확인:

- exact tag target과 GitHub Actions run conclusion
- npm provenance source repository/workflow/tag/commit
- anonymous tarball SHA-1/SHA-512, package file allowlist와 dependency
- `latest == 0.1.1`

### 중단과 복구

- tag push 전 불일치: tag를 만들지 않고 Stage 3으로 돌아간다.
- tag push 후 stage 생성 전 workflow 실패: tag를 이동하지 않고 원인을
  분석해 새 patch/recovery 계획 승인을 받는다.
- staged package 불일치: npm 2FA 승인하지 않고 stage를 폐기/만료시킨다.
- public version 생성 후 결함: `0.1.1`을 덮어쓰거나 unpublish에 의존하지
  않고 새 patch version을 준비한다. 필요 시 `0.1.1` deprecate를 별도
  승인받는다.
- production submit 실패: credential/usage를 기록하지 않고 safe error
  code, CLI/analyzer/Codex version과 resolver source만으로 진단한다.

### 커밋

```text
Task #57 Stage 4: provenance patch publish와 production smoke
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- remote release 결과는 raw credential, Account Usage aggregate와 local
  path 없이 safe metadata만 기록한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을
  받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는
  구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과
  `mydocs/working/task_m100_57_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #57 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- Stage 3 candidate commit에만 release tag를 붙인다. Stage 4 report와
  최종 보고서는 tag 이후 task branch commit으로 남긴다.

## 단계 의존성

- Stage 2는 Stage 1의 산출물 확정과 보고서 승인 후 진행한다.
- Stage 3은 Stage 2의 packed package/macOS smoke 승인 후 진행한다.
- Stage 4는 Stage 3 전체 preflight, exact Gate B와 external tag/stage
  승인을 받은 뒤 진행한다.
- 모든 Stage와 public registry 검증 후 `task-final-report`로 최종 보고와
  `publish/task57` PR을 생성한다.
- PR merge/cleanup 후 #55 task-start로 넘어간다.

## 위험과 대응

- **upstream 책임 중복**: profile에는 resolver를 만들지 않고 exact analyzer
  dependency와 downstream contract만 검증한다.
- **CI에서 macOS bundle 부재**: upstream resolver unit test와 exact
  integrity를 신뢰 경계로 삼고, 실제 bundle fallback은 task macOS에서
  별도 수동 smoke로 보완한다.
- **release verifier drift**: package/version/dependency expected 값을 한
  verifier contract에 고정하고 unit/local pack smoke를 함께 갱신한다.
- **tag와 report commit 차이**: Stage 3 commit을 immutable source tag로
  명시하고 Stage 4/최종 보고 commit은 release 증적 문서만 추가한다.
- **#55 동시 변경**: #57 완료·merge cleanup 전에는 #55 worktree를 만들지
  않아 orders/docs/style 충돌을 피한다.

## 승인 요청 사항

- 위 4개 Stage의 파일 경계, 검증 명령과 커밋 메시지
- Stage 1에서 exact analyzer `0.4.1`과 CLI `0.1.1`을 채택하는 변경
- Stage 2에서 CI는 installed dependency contract를 검증하고 macOS 실제
  bundle fallback은 local sanitized smoke로 보완하는 방식
- Stage 3에서 공식 문서와 candidate를 확정한 뒤 exact Gate B를 다시
  요청하는 release 경계
- Stage 4에서 승인된 tag만 push하고 npm staged package를 별도 2FA로
  승인하는 외부 변경 절차

승인되면 Stage 1의 package/version/lock/verifier 변경부터 시작한다.
