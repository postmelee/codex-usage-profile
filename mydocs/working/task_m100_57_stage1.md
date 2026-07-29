# Task M100 #57 Stage 1 완료보고서

GitHub Issue: [#57](https://github.com/postmelee/codex-usage-profile/issues/57)
구현계획서: [`task_m100_57_impl.md`](../plans/task_m100_57_impl.md)
Stage: 1

## 단계 목적

profile CLI가 PATH만 지원하는 `codex-usage-analyzer@0.2.0` 대신 표준
macOS ChatGPT/Codex 앱 번들 fallback을 구현한 공개
`codex-usage-analyzer@0.4.1`을 exact dependency로 채택할 기반을 확정했다.

CLI/package version을 `0.1.1`로 맞추고, lockfile과 release verifier가
analyzer registry URL, integrity, license와 Node engine을 exact 값으로
검사하도록 갱신했다. Account Usage Contract v1, profile CLI public API와
보안 경계는 변경하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/package.json` | package `0.1.1`, analyzer exact `0.4.1` 채택 |
| `packages/codex-usage-profile-cli/src/cli.js` | exported `CLI_VERSION`을 `0.1.1`로 정렬 |
| `packages/codex-usage-profile-cli/test/cli.test.js` | public CLI version exact assertion 추가 |
| `package-lock.json` | workspace version과 analyzer registry URL·SHA-512 integrity exact 갱신 |
| `scripts/verify-npm-release.mjs` | expected CLI/analyzer package metadata를 새 exact 값으로 갱신 |
| `scripts/__tests__/verify-npm-release.test.js` | `0.1.1` candidate와 analyzer range drift fail-close 검증 |
| `mydocs/orders/20260729.md` | Stage 1 완료와 Stage 2 승인 대기 상태 반영 |
| `mydocs/working/task_m100_57_stage1.md` | Stage 1 변경·검증·잔여 위험 기록 |

source/lock/verifier 변경은 6개 파일에서 19줄 추가, 18줄 삭제로 제한됐다.
계획·보고 문서를 제외하면 신규 production source 파일이나 dependency는
추가하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 CLI command,
argument, service origin, credential, submit body/header, Account Usage
Contract v1 validator와 safe error mapping을 보존했다.

profile CLI가 analyzer에서 import하는 symbol은 계속
`readAccountUsage`, `ACCOUNT_USAGE_CONTRACT_VERSION`,
`CodexUsageError`뿐이다. analyzer `0.4.1`의 experimental surface를
import하거나 profile public API로 re-export하지 않았다.

## 검증 결과

실행 명령:

```bash
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm test --workspace packages/codex-usage-profile-cli
node --test scripts/__tests__/verify-npm-release.test.js
npm run verify:npm-release
npm ls codex-usage-analyzer --all
npm view codex-usage-analyzer@0.4.1 version dist.integrity license engines --json
npm audit --omit=dev --json
git diff --check
```

결과:

- OK — package-lock 갱신은 CLI workspace `0.1.1`과 analyzer `0.4.1`
  version/resolved/integrity 항목으로 제한됐다.
- OK — CLI package test 46건이 전부 통과했다.
- OK — release verifier test 5건이 전부 통과했다.
- OK — local release candidate는
  `codex-usage-profile@0.1.1`, 13 files, packed 14,263 bytes,
  unpacked 50,020 bytes로 검증됐다.
- OK — Stage 1 candidate SHA-1은
  `07c45eaab893129a8a392e95350c2860717f2d0f`, integrity는
  `sha512-Rj5xegz3fj5uD512OJo8IcJWbYG0rRiqSuhxEYmO6ZU4UrjzH5dY/u5cgV4pHgnZJ7pDNqkKgPmVqolloakJCg==`
  였다. Stage 3 문서 변경 전 중간 candidate이므로 Gate B 값으로 사용하지
  않는다.
- OK — installed dependency tree는 profile CLI `0.1.1` 아래 exact
  `codex-usage-analyzer@0.4.1` 한 개다.
- OK — installed analyzer는 MIT, Node `>=20`, runtime dependency와
  install lifecycle script 0개이며 `src/codex-executable.js`를 포함한다.
- OK — npm registry metadata와 lock/verifier의 analyzer SHA-512 integrity가
  일치했다.
- OK — `npm audit --omit=dev`는 production dependency 취약점 0건을
  반환했다. install 요약의 8건은 공개 CLI production dependency 범위에
  포함되지 않는다.
- OK — `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- analyzer `0.4.1`이 실제 task macOS 환경에서 PATH보다 앱 번들을
  fallback으로 선택해 usage를 읽는 동작은 Stage 2에서 검증한다.
- local packed consumer가 analyzer exact version과 lifecycle 부재를
  독립적으로 검사하는 smoke 강화도 Stage 2 범위다.
- Stage 1 candidate digest는 Stage 2/3 변경으로 달라진다. immutable tag와
  npm stage에 사용할 최종 digest는 Stage 3 Gate B에서 다시 산출한다.
- root development graph의 audit 항목은 이번 dependency 변경에서 새로
  유입되지 않았고 production audit는 0건이지만, 전체 preflight와 public
  surface scan은 Stage 3에서 다시 실행한다.

## 다음 단계 영향

- Stage 2는 local packed consumer가 profile CLI `0.1.1`과 analyzer
  `0.4.1`을 실제로 설치했는지 검사하도록 smoke를 강화한다.
- PATH 우선, 표준 ChatGPT/Codex 앱 bundle fallback과 후보 부재
  fail-close 순서를 upstream source/test와 대조한다.
- 실제 macOS bundle smoke에서는 usage 숫자, daily bucket, credential,
  stderr/RPC와 local path를 출력하지 않고 contract allowlist만 확인한다.

## 승인 요청

- Stage 1의 exact package/lock/verifier 변경과 검증 결과를 승인하면
  Stage 2 executable lookup과 packed package smoke로 진행한다.
