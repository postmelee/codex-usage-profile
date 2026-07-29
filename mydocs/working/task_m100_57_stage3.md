# Task M100 #57 Stage 3 완료보고서

GitHub Issue: [#57](https://github.com/postmelee/codex-usage-profile/issues/57)
구현계획서: [`task_m100_57_impl.md`](../plans/task_m100_57_impl.md)
Stage: 3

## 단계 목적

CLI `0.1.1`과 exact `codex-usage-analyzer@0.4.1`의 사용자 요구사항,
macOS executable lookup 순서와 npm 운영 경계를 공식 문서에 반영했다.

전체 public release scanner, package verifier, isolated install smoke,
CLI/root 회귀와 read-only registry/tag/publisher 확인을 실행해 immutable
release candidate를 Gate B 승인 입력으로 고정했다. 이 단계에서는 Git
tag를 만들거나 push하지 않았고 npm stage/public version도 생성하지
않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` | `0.1.1` candidate 상태, PATH-or-standard-app-bundle 요구사항과 exact automation version 반영 |
| `packages/codex-usage-profile-cli/README.md` | packed README의 `0.1.1`, 네 macOS bundle 후보와 nonstandard PATH 안내 반영 |
| `docs/cli-submit.md` | executable lookup 순서, `CODEX_NOT_FOUND` fallback, tarball/automation 명령 갱신 |
| `docs/codex-usage-analyzer.md` | exact `0.4.1` dependency와 analyzer-owned resolver 책임 경계 확정 |
| `docs/npm-release.md` | immutable `0.1.0` 이력을 보존하고 `0.1.1` staged publishing Gate 추가 |
| `mydocs/orders/20260730.md` | Stage 3 완료와 Gate B 승인 대기 상태 기록 |
| `mydocs/working/task_m100_57_stage3.md` | candidate, preflight와 Gate B exact 값 기록 |

## 본문 변경 정도 / 본문 무손실 여부

기존 `0.1.0` publish/provenance/recovery 이력, production service URL,
Account Usage Contract v1, identity-free 전송 경계와 credential 정책은
삭제하거나 재작성하지 않았다.

문서 변경은 `0.1.1` candidate, analyzer `0.4.1`, macOS lookup과 future
staged publish 절차에 한정했다. Stage 4 성공 전에는 `0.1.1`이 public이거나
`latest`라고 주장하지 않고, 현재 public version이 `0.1.0`임을 유지했다.

## Gate B exact 승인 입력

| 항목 | exact 값 |
|---|---|
| candidate commit | 이 보고서를 포함하는 `Task #57 Stage 3` commit. 자기 참조 SHA는 문서에 내장하지 않고 commit 직후 Gate B 요청에 full 40-character SHA로 고정 |
| package | `codex-usage-profile@0.1.1` |
| dependency | exact `codex-usage-analyzer@0.4.1` |
| planned tag | `codex-usage-profile-v0.1.1` |
| tarball | `codex-usage-profile-0.1.1.tgz`, 13 files, packed 14,451 bytes, unpacked 50,500 bytes |
| SHA-1 | `4eeafe6d095f923f5bd0501c7639a649e9fa65cf` |
| SHA-512 | `sha512-jj6jOdl0sH8om39rD5WTN2g3YiZ2LyuDMnOl+haUQXr1PigezLuQKmZJwAJLGFHp44kBAoipcP6W65LZTabsoQ==` |
| scanner | blocker 0, 기존 Gate A 공개 승인 review 12, 신규 승인 범위 이탈 없음 |
| registry | public versions `[0.1.0]`, `latest=0.1.0`; `0.1.1` 없음 |
| remote tag | `codex-usage-profile-v0.1.1` 없음 |
| workflow | active `.github/workflows/publish-npm.yml`; Node 20/22/24 verify 후 Node 24 publish job |
| trusted publisher | `postmelee/codex-usage-profile`, `publish-npm.yml`, permission `npm stage publish`, environment `npm-publish` |
| package access | public, publishing access는 2FA 필수·token publish 금지 |
| GitHub environment | `npm-publish`, required reviewer `postmelee`, environment secret 0개 |
| 외부 변경 | approved commit에 annotated tag 생성 후 exact tag 1개 push, trusted publisher가 npm staged package 생성 |
| 사용자 동작 | npm staged package와 provenance를 exact 값과 대조한 뒤 2FA 승인 |
| 실패 처리 | tag 이동·재생성 금지. public version 전에는 stage 거부와 새 candidate 승인, public version 뒤에는 새 patch 준비 |

## 검증 결과

실행 명령:

```bash
node --test scripts/__tests__/scan-public-release-surface.test.js
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
npm test --workspace packages/codex-usage-profile-cli
npm test
npm view codex-usage-analyzer@0.4.1 version dist.integrity license engines dependencies scripts --json
npm view codex-usage-profile versions dist-tags --json
git ls-remote --tags origin codex-usage-profile-v0.1.1
git diff --check
```

로컬 환경:

- Node.js `v24.15.0`
- npm `11.12.1`

결과:

- OK — scanner test 3건이 통과했다.
- OK — public release scan은 blocker 0, 기존 승인 review 12였다.
- OK — verifier는 위 13-file tarball의 size, SHA-1, SHA-512와 exact
  metadata를 재현했다.
- OK — isolated local tarball smoke는 package/export, analyzer contract,
  bin help, credential-free default/loopback status와 unsafe-origin reject
  6개 경계를 통과했다.
- OK — CLI test 46건이 모두 통과했다.
- OK — root test 493건 중 487건이 통과하고 6건이 configured external
  Postgres/S3 값 부재로 명시적으로 skip됐다. 실패는 0건이다.
- OK — analyzer registry metadata는 `0.4.1`, MIT, Node `>=20`, expected
  integrity, runtime dependency와 install lifecycle script 0개였다.
- OK — registry는 `0.1.0`만 보유하고 `latest`도 `0.1.0`이었다.
- OK — planned `0.1.1` remote tag 조회 결과는 비어 있었다.
- OK — npm 화면에서 trusted publisher repository/workflow/permission/
  environment, public access와 2FA/token 정책이 exact 값과 일치했다.
- OK — GitHub `npm-publish` environment는 required reviewer 1명과 secret
  0개였고 remote workflow는 exact path에서 active였다.
- OK — `git diff --check`는 경고 없이 통과했다.

## 잔여 위험

- `0.1.1`은 아직 npm registry에 없으므로 실제 `@latest` install,
  provenance attestation과 PATH prefix 없는 production submit은 Stage 4
  공개 후에만 검증할 수 있다.
- tag push는 immutable external change이고 npm stage 생성 뒤 maintainer
  2FA 승인이 필요하다. 둘 다 별도 Gate B 승인 전에는 수행하지 않는다.
- standard app fallback은 analyzer `0.4.1`의 네 macOS 후보에 한정된다.
  비표준 설치는 공식 Codex CLI를 PATH에 노출해야 한다.

## 다음 단계 영향

- Gate B 요청에서 이 Stage 3 commit의 full 40-character SHA를 tarball
  digest와 함께 최종 고정한다.
- 승인 뒤에만 exact annotated tag를 만들고 push한다.
- Actions verify/environment gate와 npm staged package를 확인한 뒤
  maintainer가 npm 2FA로 승인한다.
- public `0.1.1` 생성 뒤 provenance/integrity, exact/`@latest` clean
  install과 prefix 없는 macOS submit/status smoke를 수행한다.
- Stage 4와 Task #57 release/PR/merge cleanup이 끝난 뒤에만 #55 skeleton
  구현으로 전환한다.

## 승인 요청

- Stage 3 공식 문서, preflight와 exact Gate B 값을 승인하면 Stage 4의
  immutable tag와 provenance patch publish로 진행한다.
