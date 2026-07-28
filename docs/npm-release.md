# npm 공개 릴리스 운영 절차

이 문서는 `packages/codex-usage-profile-cli`의 공개 npm 릴리스를
재현 가능하게 실행하고 중단하는 절차다. 최초 `0.1.0` 게시와 그 이후
릴리스는 인증 방식이 다르다.

| 구분 | 최초 `0.1.0` | 이후 릴리스 |
|---|---|---|
| 실행 파일 | `.github/workflows/publish-npm.yml` | 같은 파일 |
| 인증 | 만료가 짧은 임시 `NPM_TOKEN` | npm trusted publisher의 GitHub OIDC |
| 명령 | `npm publish --provenance --access public` | `npm stage publish` |
| 승인 | 정확한 태그와 GitHub environment gate | stage 생성 뒤 npm에서 2FA 승인 |
| 토큰 보관 | 최초 게시 직후 폐기 | 장기 npm 토큰 없음 |

두 경로 모두 공개 GitHub repository, 공개 npm package, 정확한
`repository.url`, `id-token: write` 권한을 provenance 전제로 사용한다.
secret 값은 소스, 이 문서, 이슈, PR, Actions 로그에 기록하지 않는다.

## 고정된 릴리스 계약

- package: `codex-usage-profile@0.1.0`
- registry: `https://registry.npmjs.org/`
- 최초 태그: `codex-usage-profile-v0.1.0`
- GitHub environment: `npm-publish`
- 최초 게시 secret 이름: `NPM_TOKEN`
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
script가 없는지 별도로 확인한다. publish job의 write 권한은
`id-token: write` 하나뿐이며 `NPM_TOKEN`은 publish step에만 주입한다.

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
