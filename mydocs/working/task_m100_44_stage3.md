# Task #44 Stage 3 보고서 — public repository와 immutable npm candidate

GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
구현계획서: [`task_m100_44_impl.md`](../plans/task_m100_44_impl.md)
Stage: 3

## 단계 목적

Gate A에서 승인된 repository-wide MIT, 공개 검토 항목 12건,
provenance workflow와 repository public 전환을 실행한다. 공개 전환 뒤에는
anonymous source/support 접근과 원격 `publish/task44` preflight를 검증하고,
최초 npm publish에 사용할 exact `codex-usage-profile@0.1.0` candidate와
보호된 `npm-publish` environment를 Gate B 입력으로 고정한다.

이 단계는 npm tag, npm registry version, GitHub Release와 production usage를
만들지 않았다.

## 산출물

| 파일·외부 상태 | 변경 요약 |
|---|---|
| `LICENSE` | package와 같은 `Copyright (c) 2026 postmelee` MIT 본문 21줄을 root에 추가해 repository 전체 license를 고정했다. |
| `README.md` | root와 `packages/codex-usage-profile-cli`가 같은 MIT 범위라는 License 섹션을 추가했다. |
| `.github/workflows/publish-npm.yml` | Stage 3 원격 preflight만 실행하도록 `publish/task44` push trigger를 추가했다. publish job의 exact tag 조건은 유지했다. |
| `scripts/scan-public-release-surface.mjs` | workflow static contract가 `devel`, `publish/task44` branch trigger를 exact하게 요구하도록 맞췄다. |
| GitHub repository | `postmelee/codex-usage-profile`을 `public`으로 전환하고 기본 branch `devel`을 유지했다. |
| GitHub branch | local `local/task44`를 원격 `publish/task44`에 push했다. 원격 `local/task44`는 만들지 않았다. |
| GitHub Actions | public branch push run `30349473071`에서 Node 20·22·24 verify matrix를 통과했다. tag가 아니므로 publish job은 `skipped`였다. |
| GitHub environment | `npm-publish`를 만들고 required reviewer `postmelee`를 지정했다. self-review는 허용하고 관리자 우회는 비활성화했다. |
| GitHub environment secret | 작업지시자가 값 비공개 상태로 `NPM_TOKEN`을 직접 저장했다. agent는 이름과 존재만 확인했다. |
| `mydocs/orders/20260728.md` | #44를 `Stage 3 완료·Gate B 승인 대기`로 갱신했다. |

## 본문 변경 정도 / 본문 무손실 여부

repository root에 package와 동일한 MIT를 적용하고 README에 license 범위만
추가했다. CLI runtime, Account Usage Contract, credential 저장, Sites production
origin, D1/R2 데이터와 제품 기능은 변경하지 않았다.

workflow의 branch trigger는 `publish/task44` preflight를 실행하기 위한
검증 전용 변경이다. publish job은 여전히
`refs/tags/codex-usage-profile-v0.1.0` exact 조건에서만 실행되며 branch와
PR에서는 `NPM_TOKEN`과 `id-token: write`를 받지 않는다.

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
npm run verify:npm-release
npm run smoke:npm-package:local
node --test scripts/__tests__/scan-public-release-surface.test.js
npm run scan:public-release
git diff --check
```

원격·계정 read-only 검증:

```text
GitHub repository metadata와 anonymous HTTP read
GitHub Actions run 30349473071 및 job matrix
npm whoami
npm view codex-usage-profile@0.1.0 version
GitHub npm-publish environment와 NPM_TOKEN 이름·존재
```

결과:

- OK — exact `npm test`는 486개 중 480개 통과, 6개 환경 의존 테스트
  skip, 실패 0개였다. sandbox 안의 local server/resource 제한으로 중단한
  시도는 같은 exact 명령을 정상 로컬 권한으로 재실행해 4.09초에 통과했다.
- OK — Playwright E2E 16개가 모두 통과했다.
- OK — production build와 Sites artifact 검증이 통과했다.
  - artifact: 4,654,102 bytes
  - client files: 7
  - Worker files: 2
  - Worker raw/compressed: 3,901,236 / 2,145,397 bytes
  - expected bindings: 3
  - migrations: 2
- OK — exact package verifier와 격리 consumer install smoke가 통과했다.
  - package: `codex-usage-profile@0.1.0`
  - tarball: `codex-usage-profile-0.1.0.tgz`
  - files: 13
  - packed: 14,221 bytes
  - unpacked: 49,887 bytes
  - SHA-1: `a1d30872a6677e9b781e64e14f7ad9040ee92e0d`
  - SHA-512:
    `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==`
- OK — public-release scanner fixture 테스트 3개가 통과했다. 최종 scan은
  7개 ref, 215개 commit, 1,221개 unique blob에서 blocker 0건이었다.
- REVIEW — Gate A에서 공개 허용한 12건은 그대로다.
  - 보안 테스트의 private-key 표식 5
  - 기존 계획·보고서와 credential fixture의 절대경로 5
  - 기존 commit metadata email 2
- OK — `postmelee/codex-usage-profile`은 `public`, 기본 branch는 `devel`이다.
  저장소 root, `devel`의 CLI source, Issue 목록과 #44는 인증 없는 요청에서
  모두 HTTP 200이었다.
- OK — 원격 `publish/task44`의 source commit
  `5734829a26dbf2d02613960bd74668c4680debda`를 검증한
  [Actions run 30349473071](https://github.com/postmelee/codex-usage-profile/actions/runs/30349473071)은
  attempt 1, conclusion `success`다. Node 20·22·24 verify job은 모두
  `success`, publish job은 `skipped`다.
- OK — `npm whoami`는 `postmelee`를 반환했다. account 2FA와 임시 token
  생성은 작업지시자가 npm 화면에서 확인했다.
- OK — `npm view codex-usage-profile@0.1.0`은 `E404`다. 이 확인 시점에는
  registry version이 없다.
- OK — `npm-publish` environment에 required reviewer `postmelee`와
  `NPM_TOKEN` secret이 존재한다. raw secret, OTP와 recovery code는
  조회·출력·전달하지 않았다.
- OK — `git diff --check`를 통과했고 report 작성 전 worktree는 clean이었다.

## Gate B exact 입력

### Package와 candidate

| 항목 | 고정값 |
|---|---|
| package / version | `codex-usage-profile@0.1.0` |
| access / dist-tag | public / `latest` |
| registry | `https://registry.npmjs.org/` |
| candidate source commit | `5734829a26dbf2d02613960bd74668c4680debda` — Stage 3 source·preflight commit |
| tarball | `codex-usage-profile-0.1.0.tgz` |
| file / packed / unpacked | 13 / 14,221 / 49,887 bytes |
| SHA-1 | `a1d30872a6677e9b781e64e14f7ad9040ee92e0d` |
| SHA-512 | `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==` |
| dependency | exact `codex-usage-analyzer@0.2.0` |
| dependency integrity | `sha512-11GLQahAfOXPfq6xpHmb7FnOvVFC/neZ8KpzI7QRSlS8w/4+12Wa7lnZlgwnv45tzFCcdCHlVLb2wn25i57FQA==` |
| Node engine | `>=20` |

Stage 3 보고서와 오늘할일만 추가하는 Stage 3 commit 뒤 원격
`publish/task44`를 fast-forward하고 같은 package candidate를 한 번 더
preflight한다. Gate B에서 tag 대상이 되는 final commit SHA와 두 번째 run
URL은 그 검증이 끝난 뒤 승인 요청에 기록한다.

### Workflow와 인증

| 항목 | 고정값 |
|---|---|
| workflow | `.github/workflows/publish-npm.yml` |
| verify | Node 20, 22, 24 / `npm ci --ignore-scripts` / package test / verifier / local tarball smoke |
| checkout | `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`) |
| setup-node | `249970729cb0ef3589644e2896645e5dc5ba9c38` (`v6.5.0`) |
| publish runtime | GitHub-hosted Ubuntu, Node 24, npm exact `12.0.1` |
| first tag | `codex-usage-profile-v0.1.0` |
| environment | `npm-publish`, required reviewer `postmelee`, admin bypass 없음 |
| first auth | 1일 만료 임시 granular `NPM_TOKEN`, read/write, bypass 2FA |
| publish command | `npm publish --workspace packages/codex-usage-profile-cli --access public --provenance` |
| job permission | verify는 `contents: read`; publish만 `contents: read`, `id-token: write` |

first publish는 `0.1.0` tarball을 public registry에 불변 version으로 만들고
`latest` dist-tag를 연결한다. provenance는 public GitHub source, workflow와
artifact의 출처를 public transparency log에 남긴다.

### 실패 분기

- auth/network failure이고 registry version이 없으면 tag를 이동·삭제하지
  않는다. secret을 교정한 뒤 같은 workflow의 failed job rerun만 별도
  승인받는다.
- registry version이 생성됐으면 workflow 실패 표시만 보고 publish를
  재실행하지 않고 registry verification으로 이동한다.
- source/artifact defect이면 tag를 이동·삭제하거나 `0.1.0`을 덮어쓰지 않는다.
  publish를 중단하고 별도 version 판단을 승인받는다.

## 잔여 위험

- 임시 `NPM_TOKEN`은 만료 전까지 `postmelee`가 접근할 수 있는 package에
  read/write와 bypass 2FA 권한이 있다. GitHub environment gate와 exact tag로
  사용 범위를 줄였지만 raw token 탈취 위험을 제거하지는 않는다. 최초 publish
  검증 직후 GitHub secret 삭제와 npm token 폐기가 필수다.
- npm의 2027년 direct-publish bypass token 제한 전에 최초 bootstrap만
  수행한다. 최초 publish 뒤에는 별도 승인된 source 변경으로 exact
  repository/workflow/environment trusted publisher OIDC와 staged publishing으로
  전환해야 한다.
- repository와 승인된 review 12건은 이미 public이다. visibility를 다시
  private으로 바꿔도 이미 읽힌 source/history의 회수가 되지는 않는다.
- Dependency graph, Dependabot, tag protection과 classic branch protection은
  최초 publish 필수 조건은 아니지만 공개 운영 hardening 후보로 남는다.

## 다음 단계 영향

- Stage 3 report commit을 원격 `publish/task44`에 fast-forward한 뒤
  Node 20·22·24 final branch preflight를 다시 통과시킨다.
- Gate B 승인 전에는 `codex-usage-profile-v0.1.0` tag, npm registry version,
  GitHub Release와 production usage를 만들지 않는다.
- Gate B 승인 뒤 Stage 4는 final commit에 annotated tag를 한 번 만들고
  Actions environment approval까지 받아 최초 publish를 실행한다.
- publish 확인 직후 registry metadata, integrity, dependency, provenance와
  `latest`를 대조하고 임시 GitHub secret과 npm token을 폐기한다.

## 승인 요청

- Stage 3 산출물과 검증 결과, final report commit의 두 번째 public preflight,
  위 Gate B exact 입력을 승인하면 Stage 4의
  `codex-usage-profile@0.1.0` 최초 publish로 진행한다.
