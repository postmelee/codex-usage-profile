# Task #44 Stage 2 보고서 — public npm provenance release 준비

GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
구현계획서: [`task_m100_44_impl.md`](../plans/task_m100_44_impl.md)
Stage: 2

## 단계 목적

private repository와 로컬 package 상태에서 공개 전환 전에 확인해야 할 Git
전체 이력과 GitHub 공개 표면을 값 비출력 방식으로 목록화하고,
`codex-usage-profile@0.1.0` 최초 publish를 exact tag, immutable Action SHA,
최소 job permission과 npm provenance에 묶는다. 최초 token bootstrap 뒤에는
같은 workflow를 trusted publisher의 staged publishing으로 바꾸는 운영
절차도 고정한다.

이 단계는 repository visibility, remote branch, Git tag, GitHub environment와
secret, npm package와 production Site/data를 변경하지 않았다. root
`LICENSE`도 Gate A의 repository-wide MIT 승인 전이므로 추가하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/scan-public-release-surface.mjs` | 654줄. 모든 local/remote/tag ref의 unique blob과 commit metadata를 credential, private path, session, archive, binary와 size category로 스캔하고 값 대신 ref·축약 blob·path·count만 출력한다. |
| `scripts/__tests__/scan-public-release-surface.test.js` | 148줄. current, deleted history, tag, remote-tracking ref, synthetic fixture redaction과 workflow fail-closed 경계를 검증한다. |
| `.github/workflows/publish-npm.yml` | 86줄. branch/PR Node 20·22·24 검증과 exact `0.1.0` tag의 최초 provenance publish만 허용한다. |
| `docs/npm-release.md` | 152줄. preflight, Gate A, 최초 token bootstrap, trusted publisher 전환, 2FA approval, token 폐기와 patch/deprecate 복구 절차를 기록한다. |
| `package.json` | `scan:public-release` 명령을 추가했다. |
| `packages/codex-usage-profile-cli/package.json` | `publishConfig.provenance = true`를 필수 release metadata로 추가했다. |
| `scripts/verify-npm-release.mjs` | provenance가 없거나 `true`가 아니면 candidate를 거부한다. |
| `scripts/__tests__/verify-npm-release.test.js` | provenance 누락 부정 경계를 추가했다. |
| `packages/codex-usage-profile-cli/README.md` | `0.1.0` exact automation과 `@latest` interactive 사용을 현재형으로 설명하고 내부 #44 상태 문구를 제거했다. |
| `README.md` | 동일한 공개 사용 안내와 scanner/verifier/smoke preflight 진입점을 연결했다. |
| `mydocs/plans/task_m100_44_impl.md` | Node 24에서 directory를 파일로 해석한 CLI test 명령을 기존 workspace `test` script 실행으로 교정했다. |

## 본문 변경 정도 / 본문 무손실 여부

CLI runtime source, command, Account Usage Contract, credential 저장 방식,
production Sites origin과 서비스 기능은 변경하지 않았다. 사용자 문서는
게시 전 내부 상태 문장만 release artifact 관점의 현재형으로 바꾸었고 기존
privacy, origin, exact-version automation과 support 링크는 보존했다.

public-release scanner는 credential 후보의 원문을 저장하거나 출력하지 않는다.
보안 테스트의 의도적인 credential shape와 실제 blocker를 분리하고, 결과에
ref, 12자리 blob id, repository path, category, severity와 count만 남긴다.
GitHub Issue/PR 본문과 댓글도 같은 token/private-path shape를 값 비출력으로
읽기 전용 검사했다.

## 검증 결과

실행 명령:

```bash
git fetch --all --tags --prune
node --test scripts/__tests__/scan-public-release-surface.test.js
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
npm test --workspace packages/codex-usage-profile-cli
npm test
git diff --check
```

추가 read-only 검증:

```text
npm view npm version
npm view npm@12.0.1 version engines dist.integrity
npm view codex-usage-profile version
npm whoami
GitHub repository/issue/PR/comment/branch inventory
GitHub Settings의 release, Actions, environment, branch protection,
Advanced Security 확인
Ruby Psych로 publish-npm.yml YAML parse
```

결과:

- OK — scanner fixture 테스트 3개가 통과했다. current, 삭제 이력, tag와
  remote-tracking ref에서 blocker를 검출했고 결과 JSON에 원문 credential이
  포함되지 않았다.
- OK — Stage 2 commit을 포함한 전체 Git ref scan은 6개 ref, 214개 commit,
  1,218개 unique blob을 확인해 blocker 0건이었다.
- REVIEW — 공개 전 사람이 승인할 항목은 총 12건이다.
  - 보안 detector 테스트의 private-key 표식: 5개 historical blob
  - 기존 계획·보고서의 로컬 절대경로 3건과 credential test의 fixture
    절대경로 2건
  - 기존 commit metadata의 고유 email 2개
- INFO — credential test fixture shape 80건과 허용된 이미지/font binary
  historical blob 8건은 blocker가 아니다.
- OK — GitHub의 Issue 30개, Issue 댓글 13개, PR 22개, PR 댓글 1개의
  body/comment에서 GitHub/npm/OpenAI/AWS credential, private key,
  absolute user path와 attachment를 찾지 못했다. attachment는 0개다.
- OK — package verifier와 격리 consumer smoke가 모두 통과했다.
  - package: `codex-usage-profile@0.1.0`
  - files: 13
  - packed: 14,221 bytes
  - unpacked: 49,887 bytes
  - SHA-1: `a1d30872a6677e9b781e64e14f7ad9040ee92e0d`
  - SHA-512 integrity:
    `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==`
  - analyzer: exact `codex-usage-analyzer@0.2.0`, Stage 1에서 검토한
    integrity 유지
- OK — CLI workspace 테스트 46개가 통과했다.
- OK — exact `npm test`는 486개 중 480개 통과, 6개 환경 의존 테스트
  skip, 실패 0개였다. sandbox 안에서 workerd D1 suite가 초기화되지 않아
  동일한 exact 명령을 정상 로컬 권한으로 다시 실행했다.
- OK — workflow YAML parse와 static contract test가 통과했다.
- OK — `git diff --check` 통과.

## Gate A exact 입력

### Repository 공개 표면

| 항목 | 확인값 |
|---|---|
| repository | `postmelee/codex-usage-profile` |
| visibility / default branch | `private` / `devel` |
| 원격 branch | `devel`, `main` |
| 로컬 scan branch | `devel`, `local/task43`, `local/task44` |
| tag / release | 0 / 0 |
| Issue | 30개 — open 6, closed 24 |
| PR | 22개 — 모두 closed·merged, open 0 |
| comment / attachment | Issue 13, PR 1 / attachment 0 |
| Actions workflow·run·artifact | 현재 0 / 0 / 0 |
| GitHub environment | 현재 0 |
| classic branch protection | 없음 |
| Dependency graph·Dependabot | 현재 비활성 |
| collaborator | GitHub sudo 재인증 전에는 목록 열람 불가. Gate A 전 수동 확인 필요 |
| history blocker | 0 |
| history review | private-key test 5, absolute path 5, commit email 2 |

public 전환 시 source와 모든 도달 가능한 Git history, Issue/PR/comment,
owner handle과 commit email이 anonymous read 대상이 되고, 모든 사용자가 Issue와
PR을 생성할 수 있다. private으로 다시 바꾸는 것은 이미 노출된 credential의
폐기를 대신하지 않는다.

### License 추천

현재 MIT `LICENSE`는 `packages/codex-usage-profile-cli`에만 있어 npm package
범위다. root license가 없으면 repository 전체가 자동으로 MIT가 되지 않는다.

**권고안 A: repository-wide MIT**를 추천한다. 공개 npm package의 source,
Issue/PR 기여와 재사용 조건을 한 가지로 맞출 수 있다. Gate A에서 승인되면
Stage 3 공개 전 package와 같은 `Copyright (c) 2026 postmelee` MIT 본문을
root `LICENSE`에 추가하고 README에서 범위를 명시한다.

package-only MIT를 선택하면 root `LICENSE`를 추가하지 않고 CLI package
directory만 MIT임을 README에 명시해야 한다.

### Package와 registry

| 항목 | 확인값 |
|---|---|
| package / version | `codex-usage-profile@0.1.0` |
| registry | `https://registry.npmjs.org/` |
| npm name | 인증 없는 `npm view`에서 `E404`; 현재 공개 package는 확인되지 않음 |
| publish metadata | public access, exact registry, provenance `true` |
| source/support | GitHub homepage, repository directory, Issues URL exact |
| production origin | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` |
| npm login | `npm whoami`가 `E401`; 현재 로컬 로그인 조건 불충족 |
| account 2FA / publish eligibility | 로그인 후 npm에서 수동 확인 필요 |

`E404`는 최종 ownership 예약이 아니므로 tag 직전 다시 확인한다.

### Workflow와 인증

| 항목 | 확인값 |
|---|---|
| workflow | `.github/workflows/publish-npm.yml` |
| verify | Node 20, 22, 24 / cache off / `npm ci --ignore-scripts` |
| checkout | `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`) |
| setup-node | `249970729cb0ef3589644e2896645e5dc5ba9c38` (`v6.5.0`) |
| publish runtime | Node 24 / npm exact `12.0.1` |
| first tag | `refs/tags/codex-usage-profile-v0.1.0`만 허용 |
| first command | direct `npm publish --access public --provenance` |
| first auth | `npm-publish` environment의 임시 `NPM_TOKEN` |
| permissions | global `contents: read`; publish job만 `id-token: write` |
| manual/fork/branch publish | 없음 |
| future command | 최초 publish 검증 뒤 별도 source 승인으로 `npm stage publish`만 허용 |
| future auth | exact repository/workflow/environment trusted publisher OIDC, 장기 token 없음 |

임시 token은 새 public package 최초 게시에 필요한 최소 권한과 가능한 가장 짧은
만료로 사용하고, publish step에만 주입한 뒤 registry/provenance 검증 직후
GitHub secret 삭제와 npm token 폐기를 함께 수행한다. 값은 agent나 source에
전달하지 않는다.

## 잔여 위험

- npm 계정은 현재 `E401`이라 Gate A 실행 전 로그인, 2FA와 새 package publish
  eligibility 확인이 필요하다.
- GitHub collaborator 목록은 sudo mode가 요구되어 정확한 인원·권한 확인이
  남아 있다.
- `npm-publish` environment와 `NPM_TOKEN`은 아직 존재하지 않는다. 이는
  Stage 3의 승인된 bootstrap 산출물이며 현재 누락이 정상이다.
- scanner review 12건은 credential blocker가 아니지만 public 전환 시 실제로
  보이므로 Gate A에서 category별 공개 허용 승인이 필요하다.
- source README가 현재형 install 문구를 포함한 commit과 실제 npm publish 사이에
  짧은 pre-release 문서 구간이 생길 수 있다. exact tag와 environment gate로
  범위를 제한하고 publish 실패 시 안내를 즉시 복구한다.
- Dependency graph, Dependabot와 branch protection은 현재 비활성이다. 최초
  package publish의 필수 조건은 아니지만 공개 운영 hardening 후보로 남는다.

## 다음 단계 영향

- Stage 3은 아래 네 항목이 exact 승인·확인된 뒤에만 시작한다.
  1. repository-wide MIT 또는 package-only MIT
  2. history review 12건의 공개 허용과 repository public 전환
  3. workflow·최초 tag·temporary-token bootstrap
  4. npm login/2FA/publish eligibility와 GitHub collaborator inventory
- 승인 전에는 visibility, environment, secret, remote branch, tag와 npm
  registry를 변경하지 않는다.
- 승인 뒤에도 Stage 3은 repository 공개 전환과 immutable candidate까지만
  수행하며, 실제 tag push와 registry publish는 구현계획서의 다음 gate를
  따른다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하고 위 Gate A 입력 중 미확인 계정·접근
  조건을 충족하면 Stage 3 `repository public 전환과 immutable candidate`로
  진행한다.
- 권고 승인은 **repository-wide MIT + review 12건 공개 허용 + 현재
  provenance workflow 승인**이다.
