# npm 공개 릴리스 운영 절차

이 문서는 `packages/codex-usage-profile-cli`의 공개 npm 릴리스를
재현 가능하게 실행하고 중단하는 절차다. 최초 `0.1.0` 게시와 그 이후
릴리스는 인증 방식이 다르다.

| 구분 | 최초 `0.1.0` | 이후 릴리스 |
|---|---|---|
| 실행 파일 | `.github/workflows/publish-npm.yml` | 같은 파일 |
| 인증 | 만료가 짧은 임시 `NPM_TOKEN`(폐기 완료) | npm trusted publisher의 GitHub OIDC |
| 명령 | `npm publish --provenance --access public` | `npm stage publish` |
| 승인 | 정확한 태그와 GitHub environment gate | stage 생성 뒤 npm에서 2FA 승인 |
| 토큰 보관 | 최초 게시 직후 폐기 | 장기 npm 토큰 없음 |

두 경로 모두 공개 GitHub repository, 공개 npm package, 정확한
`repository.url`, `id-token: write` 권한을 provenance 전제로 사용한다.
secret 값은 소스, 이 문서, 이슈, PR, Actions 로그에 기록하지 않는다.

## 현재 운영 상태

- `codex-usage-profile@0.1.3`은 public이며 `latest`가 이 버전을 가리킨다.
- `0.1.3`은 canonical production origin을 기본값으로 사용한다. production의
  일반 사용자 명령과 Device Approval 안내는 `--server` 없는 짧은 명령을 사용하고,
  stage5·local 같은 대체 환경만 explicit `--server {origin}`을 사용한다.
- `0.1.3`은 사용자-facing package README를 공식 공개 기준으로 고정하고 공개 README에서
  internal transition·test origin 설명을 제거한 documentation patch다. exact main source,
  production Site와 registry package 검증, trusted publisher stage와 maintainer 2FA 승인을
  모두 거쳐 공개됐다.
- `0.1.2`와 `0.1.3` artifact·tag는 immutable이다. 공개 뒤 문서나 UI 보정은 기존 package를
  덮어쓰지 않는다.
- 기존 `0.1.0` artifact와 canonical/recovery tag는 immutable 상태로
  보존한다.
- exact `0.1.0` install의 production device login, status, Account Usage
  Contract v1 submit, private preview, publish/unpublish, revoke/logout
  smoke가 통과했고 disposable owner D1/R2 데이터는 승인된 digest/count로
  cleanup됐다.
- 최초 canonical tag
  `codex-usage-profile-v0.1.0`은 승인 commit을 그대로 보존한다.
- npm 12 pack metadata 호환 복구는 immutable
  `codex-usage-profile-v0.1.0-recovery.1` tag와 별도 승인을 거쳐 한 번
  실행됐다.
- package의 GitHub Actions trusted publisher는
  `postmelee/codex-usage-profile`, `publish-npm.yml`, `npm-publish`로
  고정되며 `npm stage publish`만 허용한다.
- package publishing access는 2FA를 요구하고 traditional token publish를
  허용하지 않는다.
- 최초 게시용 npm granular token은 폐기됐고 GitHub `npm-publish`
  environment의 `NPM_TOKEN` secret도 삭제됐다.
- 현재 workflow는 manifest version과 정확히 일치하는
  `codex-usage-profile-v${version}` tag에서만 tokenless stage를 만든다.
  npm 웹에서 staged package와 provenance를 검토하고 2FA로 승인해야 실제
  version이 생성된다.
- Task #57의 immutable `0.1.1` patch는 macOS 표준 ChatGPT/Codex app
  bundle 자동 탐색을 담는다. approved Stage 3 commit과 annotated tag,
  trusted publisher stage, maintainer 2FA를 거쳐 공개됐고 prefix 없는
  production submit/status smoke가 통과했다.

## `0.1.3` documentation patch release 결과

| 항목 | 검증 값 |
|---|---|
| package | `codex-usage-profile@0.1.3` |
| dependency | exact `codex-usage-analyzer@0.4.1` |
| source commit | `fae45095ddfe24a3fb03c4ec91a6e2a20900e005` |
| annotated tag | `codex-usage-profile-v0.1.3` |
| workflow | `.github/workflows/publish-npm.yml` |
| trusted publisher | `postmelee/codex-usage-profile`, workflow `publish-npm.yml`, environment `npm-publish` |
| Actions run | [`32601426789`](https://github.com/postmelee/codex-usage-profile/actions/runs/32601426789), Node 20/22/24 verify와 staged publish 성공 |
| tarball | 14 files, packed 17,237 bytes, unpacked 60,466 bytes |
| SHA-1 | `479154381ba784d755ece8fb7672b4fbbf9d4d4d` |
| SHA-512 | `sha512-+2RyWZMiGwSs2XM22f5aca0MU2+c41G7/xoaoREn0WgulqdOZXUFCcjGrk3Uyk0SrXS8faszQZE80noaYqFurA==` |
| dist-tag | `latest=0.1.3` |
| production smoke | clean `npx codex-usage-profile@latest` 기본 origin login/status/submit accepted, README 불변·공유 revision 갱신, revoke/logout 성공 |

npm attestation은 SLSA provenance를 제공하며 package subject, registry integrity와 exact
source commit이 일치한다. production Device Approval은
`npx codex-usage-profile@latest submit`을 안내하고, clean `@latest` 실행은 별도
`--server` 없이 canonical production에 연결됐다. submit 전후 README Markdown은 byte 단위로
같고, 공유 링크와 X·LinkedIn·Threads·Facebook·Reddit target만 새 revision으로 바뀌었다.
검증용 submit token은 웹 Settings에서 revoke했고 격리된 local credential도 logout으로
제거했다.

`0.1.3`은 immutable이다. 결함이나 추가 문서 변경은 같은 version이나 tag를 덮어쓰지 않고
별도 patch version과 provenance를 준비한다.

## `0.1.2` production release 결과

| 항목 | 검증 값 |
|---|---|
| package | `codex-usage-profile@0.1.2` |
| dependency | exact `codex-usage-analyzer@0.4.1` |
| source commit | `9835fb94c7cd9116114a8b936d5e9eebfb0f85d0` |
| annotated tag | `codex-usage-profile-v0.1.2` |
| workflow | `.github/workflows/publish-npm.yml` |
| trusted publisher | `postmelee/codex-usage-profile`, workflow `publish-npm.yml`, environment `npm-publish` |
| Actions run | [`32377344510`](https://github.com/postmelee/codex-usage-profile/actions/runs/32377344510), Node 20/22/24 verify와 staged publish 성공 |
| SHA-1 | `c90fde18f10f46402f64358c6330a2e1b9f83277` |
| SHA-512 | `sha512-7N0ZAIGVYbhzUyYrzFAre/Q045A+npIH+CS0Md1P/4UgV7cQ28qN1sEw5imLO+ipdezoHY67FwrZaORF3msiSg==` |
| dist-tag | `latest=0.1.2` |
| production smoke | clean `npx codex-usage-profile@latest` version/help/default origin, login/status/submit accepted, revoke/logout 성공 |

npm attestation은 SLSA provenance를 제공하며 package subject와 integrity는 registry
tarball과 일치한다. prefix 없는 `npx codex-usage-profile@latest submit`은 canonical
production에서 device login과 Account Usage Contract v1 submit을 완료했다. 검증용
submit token은 웹 Settings에서 revoke했고 격리된 local credential도 logout으로 제거했다.

`0.1.2`는 immutable이다. 배포 뒤 발견된 repository README, package README 또는
Device Approval 표현을 수정하더라도 같은 version을 다시 게시하지 않는다. npm package
내용까지 사용자에게 전달해야 하는 변경은 별도 승인된 patch version으로 게시한다.

## `0.1.1` patch release 결과

| 항목 | 검증 값 |
|---|---|
| package | `codex-usage-profile@0.1.1` |
| dependency | exact `codex-usage-analyzer@0.4.1` |
| source commit | `4093f3813ee88ac1abad31c21a6bf8bb58f09383` |
| annotated tag | `codex-usage-profile-v0.1.1` |
| workflow | `.github/workflows/publish-npm.yml` |
| trusted publisher | `postmelee/codex-usage-profile`, workflow `publish-npm.yml`, environment `npm-publish` |
| Actions run | [`30518613039`](https://github.com/postmelee/codex-usage-profile/actions/runs/30518613039), Node 20/22/24 verify와 staged publish 성공 |
| tarball | 13 files, packed 14,451 bytes, unpacked 50,500 bytes |
| SHA-1 | `4eeafe6d095f923f5bd0501c7639a649e9fa65cf` |
| SHA-512 | `sha512-jj6jOdl0sH8om39rD5WTN2g3YiZ2LyuDMnOl+haUQXr1PigezLuQKmZJwAJLGFHp44kBAoipcP6W65LZTabsoQ==` |
| dist-tag | `latest=0.1.1` |
| production smoke | 별도 PATH prefix 없는 `@latest` submit accepted, Account Usage Contract v1, status 반영, visibility `private` 유지 |

npm attestation의 package subject와 SHA-512는 위 tarball과 일치하며 SLSA
provenance는 exact repository, workflow, tag, source commit과 Actions run을
가리킨다. exact `0.1.1`과 `@latest` clean execution은 모두 CLI version
`0.1.1`을 반환했다. production smoke는 prompt, response, Codex/OpenAI
credential, session file 또는 raw usage aggregate를 출력·보고하지 않았다.

`0.1.1`은 immutable이다. 결함이 발견되면 같은 version이나 tag를
덮어쓰지 않고 별도 patch version과 provenance를 준비하며, 필요하면
`0.1.1` deprecate를 별도 승인받는다.

## Task #44 Stage 6 최종 release 판정

Task #44의 npm `0.1.0` release 판정은 **PASS**다.

- 인증 없는 격리 환경에서 package access는 `public`, 공개 version은
  `0.1.0` 하나이고 `latest`도 `0.1.0`을 가리켰다.
- exact `0.1.0`과 `@latest`의 clean install은 같은 version, executable과
  production 기본 origin을 제공했다. 두 install tree 모두 exact
  `codex-usage-analyzer@0.2.0`을 사용했다.
- registry artifact는 13 files, SHA-1
  `a1d30872a6677e9b781e64e14f7ad9040ee92e0d`, SHA-512
  `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==`
  로 최초 publish 검증 결과와 일치했다.
- npm registry signature와 attestation은 package와 analyzer 모두
  검증됐다. CLI provenance는 recovery tag
  `codex-usage-profile-v0.1.0-recovery.1`, commit
  `f10ad2cb1a38568371c5467dc3a25ce29df7ae8f`,
  `.github/workflows/publish-npm.yml`과 publish run
  [`30352705791`](https://github.com/postmelee/codex-usage-profile/actions/runs/30352705791)
  을 가리킨다.
- package homepage, source, issue/support와 package README의 공식 문서
  링크는 public GitHub repository의 `devel`에 연결된다. npm package는
  tarball의 MIT `LICENSE`와 `license: MIT` metadata를 함께 제공한다.
- repository-wide MIT를 선언하는 root `LICENSE`와 최종 release 문서는
  `publish/task44`에 있다. GitHub API의 default-branch `licenseInfo`는
  Task #44 PR merge 전까지 `null`이므로 repository 전체 license 표시는
  이 PR merge를 완료 조건으로 유지한다.
- first-publish token은 폐기됐고 GitHub `npm-publish` environment에
  `NPM_TOKEN` secret이 없다. future release는 trusted publisher의
  tokenless stage와 maintainer 2FA 승인만 사용한다.
- public release scanner는 blocker 0을 유지했다. Gate A에서 공개를
  승인한 review 12건 외에 새 credential, private usage, session 또는
  local path blocker가 발견되지 않았다.
- production Site는 saved version 7, maintenance disabled, service normal
  상태다. landing과 `/healthz`는 `200`, Stage 5에서 삭제한 smoke owner의
  public JSON과 card는 `404`다.

`0.1.0`은 immutable이다. 문서 또는 기능 수정은 같은 version을 덮어쓰지
않고 patch version으로 게시한다. 보안 또는 기능 결함이 발견되면 affected
version을 deprecate하고 수정 patch를 별도 provenance와 승인으로
게시한다. unpublish는 기본 복구 수단으로 사용하지 않는다.

fresh-user production whole-flow의 독립 release decision은
[GitHub Issue #45](https://github.com/postmelee/codex-usage-profile/issues/45)에
넘겼다. Task #44의 maintainer-owned smoke는 선행 증거이지만 #45의 fresh
GitHub OAuth, published CLI, D1/R2, backup/restore와 비용 경계 검증을
대신하지 않는다. Cloud Run fallback [#43](https://github.com/postmelee/codex-usage-profile/issues/43)은
trigger가 없는 동안 open 대기 상태를 유지한다.

## 고정된 릴리스 계약

- package: `codex-usage-profile@0.1.0`
- registry: `https://registry.npmjs.org/`
- 최초 태그: `codex-usage-profile-v0.1.0`
- GitHub environment: `npm-publish`
- 최초 게시 secret 이름: `NPM_TOKEN`(삭제 완료)
- publish runner: Node.js 24
- publish npm CLI: `12.0.1`
- 검증 runner: Node.js 20, 22, 24
- checkout:
  `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`
  (`v7.0.1`)
- setup-node:
  `actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38`
  (`v6.5.0`)

Actions cache는 사용하지 않는다. 설치는 `npm ci --ignore-scripts`로
수행하고 root와 CLI package에 `preinstall`, `install`, `postinstall`
script가 없는지 별도로 확인한다. 현재 publish job의 write 권한은
`id-token: write` 하나뿐이며 token을 주입하지 않는다. `NPM_TOKEN`은 최초
bootstrap의 승인된 publish step에서만 사용됐고 게시 확인 직후 제거됐다.

## Gate A 전 preflight

remote ref를 갱신한 clean worktree에서 다음을 순서대로 실행한다.

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

`scan:public-release`는 local branch, remote-tracking branch, tag가 도달할 수
있는 unique blob과 commit metadata를 읽는다. 결과에는 credential 값이나
파일 내용이 아니라 ref, 축약 blob id, repository path, category와 count만
포함된다. blocker가 하나라도 있으면 repository를 private으로 유지한다.
review 항목은 Gate A 표에서 공개 허용 여부를 각각 판단한다.

Git 밖의 공개 표면도 읽기 전용으로 확인한다.

- repository 이름, visibility, default branch, description, homepage, topics
- branch, tag, release, Actions workflow와 artifact, environment
- issue와 PR의 body, comment, attachment
- security 설정, collaborator와 공개될 owner handle
- commit author/committer email과 문서에 남은 로컬 절대 경로

package directory의 `LICENSE`는 해당 npm package의 MIT 조건이다. root에
별도 `LICENSE`가 없으면 repository 전체가 자동으로 MIT가 되지 않는다.
Gate A에서 package-only MIT 또는 repository-wide MIT를 명시적으로
선택해야 한다.

## 최초 `0.1.0` bootstrap

1. Gate A가 repository 공개 범위, license 범위, scanner 결과, package
   candidate와 계정 조건을 승인했는지 확인한다.
2. repository를 공개로 전환한 뒤 anonymous read와 issue/support URL을
   확인한다.
3. npm 계정에서 로그인과 2FA를 확인한다. 새 public package를 게시할 수
   있는 최소 권한, 가능한 가장 짧은 만료의 임시 token을 만든다.
4. GitHub `npm-publish` environment에 `NPM_TOKEN`이라는 environment
   secret으로 직접 저장한다. 값은 복사해 채팅이나 shell history에 남기지
   않는다.
5. environment에는 필요한 reviewer gate를 설정한다. branch와 PR에는
   token이 전달되지 않는다.
6. clean `devel` commit에서 package version이 `0.1.0`인지, 같은 commit의
   preflight가 모두 통과했는지 확인한다.
7. 정확히 `codex-usage-profile-v0.1.0` annotated tag만 생성하고 push한다.
   workflow는 tag와 manifest version이 다르면 publish 전에 실패한다.
8. `verify` matrix가 모두 통과하고 environment 승인을 받은 뒤에만
   direct publish가 실행된다.
9. npm package 페이지, `npm view codex-usage-profile@0.1.0`, tarball
   integrity, dependency, provenance attestation과 `latest` dist-tag를
   서로 대조한다.
10. 확인 직후 GitHub environment의 `NPM_TOKEN` secret을 삭제하고 npm에서
    해당 token을 폐기한다. Actions log에 값이 노출되지 않았는지도
    확인한다.

태그는 다른 commit으로 이동하거나 다시 만들지 않는다. 실패가 package
upload 전에 발생했다면 원인을 수정한 새 승인 절차를 거친다. registry가
`0.1.0`을 이미 받았다면 같은 version을 다시 게시하지 않는다.
실제 `0.1.0` bootstrap에서 npm 12의 `npm pack --json` object-map 형식을
verifier가 처리하지 못해 canonical tag run은 upload 전에 중단됐다.
canonical tag는 이동하지 않았고, exact recovery tag와 재승인을 사용한
run만 registry version을 생성했다.

## trusted publisher와 staged publishing 전환

최초 package가 npm에 존재하고 검증된 뒤 별도 승인 변경으로 전환한다.

1. npm package의 trusted publisher를 GitHub Actions로 설정한다.
2. owner/repository는 `postmelee/codex-usage-profile`, workflow filename은
   `publish-npm.yml`, environment는 `npm-publish`로 exact 지정한다.
3. 허용 명령은 staged publishing만 선택하고 direct publish는 허용하지
   않는다.
4. 같은 workflow의 publish step을 CLI package directory에서
   `npm stage publish --access public`만 실행하도록 바꾼다.
5. `NPM_TOKEN` 참조와 secret을 제거하고, npm CLI는 staged publishing을
   지원하는 exact 버전으로 계속 고정한다.
6. future exact version tag가 stage를 만든 뒤 npm 웹에서 package,
   version, provenance를 검토하고 2FA로 승인한다.
7. 승인 후 `npm view` 결과와 설치 smoke를 확인한다.

현재 npm 문서 기준으로 staged publishing과 `npm trust` CLI는 npm
`11.15.0` 이상 및 Node.js `22.14.0` 이상이 필요하다. trusted publisher
자체는 npm `11.5.1` 이상 및 Node.js `22.14.0` 이상이 필요하다.

## 중단과 복구

- scan blocker: 공개 전환과 tag 생성을 중단하고 credential을 폐기한 뒤
  Git 이력과 GitHub 첨부·artifact까지 remediation한다.
- public 전환 뒤 credential 발견: private 전환은 노출 취소가 아니다.
  먼저 credential을 즉시 revoke/rotate하고 공개 surface를 제거한 뒤
  영향 범위를 조사한다.
- workflow 실패, registry 미게시: token을 폐기하고 tag를 이동하지 않은
  채 수정 release를 새 version과 새 승인으로 준비한다.
- registry 게시 뒤 결함: 같은 version을 덮어쓰지 않는다. 안전한 patch를
  준비하고 필요하면 결함 version을 `npm deprecate`로 안내한다.
- 의심스러운 provenance 또는 tarball 불일치: 설치 권고를 중단하고
  package와 workflow run의 integrity·commit·attestation을 대조한다.

unpublish 가능 여부에 복구를 의존하지 않는다. 보안 사고에서는 package
조치와 별개로 모든 관련 credential을 폐기하고 GitHub/npm audit 기록을
보존한다.

## 공식 참조

- [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)
- [npm trust CLI](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
- [npm provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
- [GitHub Actions에서 Node.js package 게시](https://docs.github.com/en/enterprise-cloud@latest/actions/tutorials/publish-packages/publish-nodejs-packages)
- [actions/checkout v7.0.1 commit](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1)
- [actions/setup-node v6.5.0 commit](https://github.com/actions/setup-node/commit/249970729cb0ef3589644e2896645e5dc5ba9c38)
