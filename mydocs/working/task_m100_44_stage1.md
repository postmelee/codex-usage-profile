# Task #44 Stage 1 보고서 — npm release contract와 local artifact preflight

GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
구현계획서: [`task_m100_44_impl.md`](../plans/task_m100_44_impl.md)
Stage: 1

## 단계 목적

`codex-usage-profile@0.1.0`을 원격 registry에 게시하기 전에 package metadata,
의존성 integrity, tarball 파일·모드·digest와 민감정보 부재를 fail-closed로
고정한다. 실제 package tarball을 source checkout과 기존 credential이 없는
임시 consumer project에 설치해 export, bin, help, credential-free status와
service origin 경계도 검증한다.

이 단계는 repository visibility, remote branch, Git tag, GitHub/npm credential,
npm registry와 production Site/data를 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `package.json` | `verify:npm-release`, `smoke:npm-package:local` 실행 명령을 추가했다. |
| `packages/codex-usage-profile-cli/package.json` | analyzer를 exact `0.2.0`으로 pin하고 repository URL과 public npm registry를 명시했다. |
| `package-lock.json` | CLI workspace dependency range를 exact `0.2.0`으로 동기화했다. |
| `scripts/verify-npm-release.mjs` | 707줄. manifest·lock·MIT license·source mode와 실제 13-file tarball allowlist, tar header/type/path/mode, SHA-1/SHA-512, unpacked size, dependency integrity와 민감정보를 검증한다. |
| `scripts/smoke-npm-package-local.mjs` | 315줄. 임시 HOME/XDG/npm cache에서 tarball을 설치하고 export, executable bin, help, credential-free status, loopback와 unsafe origin을 검증한 뒤 임시 상태를 제거한다. |
| `scripts/__tests__/verify-npm-release.test.js` | 119줄. 정상 candidate, dependency/integrity drift, 추가 파일·실행 모드와 secret redaction 부정 경계를 검증한다. |
| `scripts/__tests__/smoke-npm-package-local.test.js` | 111줄. subprocess 환경 격리, 실행 순서와 unsafe origin fail-closed 동작을 검증한다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. CLI runtime source, 사용자
command, Account Usage Contract와 production origin은 변경하지 않았다.
package metadata에서는 provenance와 공개 source가 참조할 repository URL을 exact
HTTPS URL로 정규화했고, dependency resolution은 기존에 lock된 analyzer
`0.2.0`을 range가 아닌 exact version으로 제한했다.

검증기는 raw secret, token, private path를 출력하지 않고 category, package-relative
path와 count만 오류에 포함한다. smoke subprocess는 부모의 npm/product/OpenAI
credential 환경을 상속하지 않고, npm user/global config와 cache도 task 전용 임시
경로로 격리한다.

## 검증 결과

실행 명령:

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

추가 안정성 확인:

```bash
node --test src/profile-card/__tests__/renderer.test.js
node --test --test-concurrency=1
```

결과:

- OK — Stage 1 신규 테스트 6개가 통과했다. manifest/lock drift, 파일 추가,
  bin mode 저하, credential-like content와 unsafe origin을 모두 거부했다.
- OK — CLI config, CLI command와 backend integration 대상 19개가 통과했다.
  runtime 동작과 production origin binding 회귀가 없었다.
- OK — release verifier가 package file 13개를 확인했다.
  - package: `codex-usage-profile@0.1.0`
  - packed: 14,229 bytes
  - unpacked: 49,895 bytes
  - SHA-1: `90d288147a7a1a80d719d51b4c08ef5519a1f6fb`
  - SHA-512 integrity:
    `sha512-uqFV6BUXjEautR8DL6Hy+bBP5BlRuQugPhl8CvZvbpkqMpcXR4ZJXVbhx1KTrUQ79gmQbDSfJIz6I4LQED4fpA==`
- OK — isolated local smoke가 공개 registry의
  `codex-usage-analyzer@0.2.0`을 새 cache에 내려받고 exact tarball을 설치했다.
  export/bin/help, credential-free default·loopback status와 unsafe remote HTTP
  origin 거부 5개 계약을 검증했다.
- OK — 최종 exact `npm test`는 483개 중 477개 통과, 6개 환경 의존 테스트
  skip, 실패 0개였다. D1/Miniflare local worker를 실행할 수 있는 정상 로컬
  런타임에서 수행했다.
- OK — native renderer 파일은 단독 2개 통과했고, 전체 직렬 회귀도
  483개 중 477개 통과, 6개 skip, 실패 0개였다.
- OK — `git diff --check` 통과.

## 잔여 위험

- 이 digest는 Stage 1 package의 재현 가능한 기준값이다. Stage 2에서 package
  README와 provenance metadata가 승인대로 바뀌면 tarball digest도 바뀌므로,
  Gate B의 immutable candidate로 재사용하지 않는다.
- 전체 병렬 회귀에서 기존 native renderer test process가 assertion 없이 한 번
  종료됐다. 같은 파일 단독 실행, 전체 직렬 실행과 마지막 exact `npm test`는
  모두 통과해 Stage 1 변경 회귀는 재현되지 않았다. 다음 Stage에서도 exact
  전체 회귀와 직렬 진단을 유지한다.
- Postgres 4개와 external S3 1개 등 6개 테스트는 필요한 외부 test setting이
  없어 기존 규칙대로 skip됐다. Stage 1 package contract는 실제 registry
  dependency install과 local D1/R2 회귀까지 통과했다.
- package README에는 아직 #44 게시 전 안내가 남아 있다. Stage 2에서 public
  repository와 first-publish workflow에 맞는 publish artifact 문구로 갱신한다.

## 다음 단계 영향

- Stage 2는 고정된 release verifier와 local consumer smoke를 CI preflight의
  기본 입력으로 사용한다.
- public 전환 전에 Git history와 GitHub public surface를 value 비출력 방식으로
  스캔하고, immutable SHA로 pin한 publish workflow와 `docs/npm-release.md`,
  package README, Gate A exact inventory를 준비한다.
- repository visibility, remote branch, npm token과 registry publish는 Stage 2
  산출물이 아니다. Stage 2 보고 승인 뒤에도 별도 Gate A exact 승인 전에는
  remote mutation을 수행하지 않는다.
- repository 전체 MIT 적용 여부는 package MIT와 분리된 Gate A 결정으로
  유지한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2
  `public repository와 provenance release 준비`로 진행한다.
