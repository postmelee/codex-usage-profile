# Task #137 Stage 1 보고서 — npm 0.1.4 release source와 local certification

GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
구현계획서: [`task_m100_137_impl.md`](../plans/task_m100_137_impl.md)
Stage: 1

## 단계 목적

Task #134에서 merge된 CLI 재인증 복구와 온보딩 개선을 기존 `0.1.3` artifact를 덮어쓰지 않는
immutable patch `0.1.4` 후보로 고정한다. package version, exact automation 예제와 release verifier만
정합화하고 제품 API·backend·credential schema·migration·Sites target은 바꾸지 않은 채 package,
전체 Node/E2E와 Sites artifact를 로컬에서 인증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/package.json` | npm package version을 `0.1.4`로 올렸다. |
| `package-lock.json` | CLI workspace lock entry를 `0.1.4`로 맞췄다. |
| `packages/codex-usage-profile-cli/src/cli.js` | 실제 `--version` 상수를 `0.1.4`로 맞췄다. |
| `packages/codex-usage-profile-cli/test/cli.test.js` | CLI version fixture를 `0.1.4`로 맞췄다. |
| `scripts/verify-npm-release.mjs` | expected npm candidate를 `codex-usage-profile@0.1.4`로 고정했다. |
| `scripts/__tests__/verify-npm-release.test.js` | npm pack 정규화·candidate fixture를 `0.1.4`로 맞췄다. |
| `scripts/__tests__/smoke-npm-package-local.test.js` | 격리 설치 tarball/package fixture를 `0.1.4`로 맞췄다. |
| `packages/codex-usage-profile-cli/README.md` | 신뢰된 자동화의 exact pin 예제를 `@0.1.4`로 맞췄다. |
| `docs/cli-submit.md` | 상세 CLI 자동화의 exact pin 예제를 `@0.1.4`로 맞췄다. |
| `docs/npm-release.md` | `0.1.4`가 미게시 local candidate이고 모든 Gate 전에는 공개하지 않는 상태를 기록했다. |
| `mydocs/orders/20260825.md` | Stage 1 완료와 Stage 2 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

CLI의 재인증·help·submit 동작과 사용자-facing 일반 `@latest` 명령은 변경하지 않았다. package version과
그 exact fixture만 바꿨으며 dependency `codex-usage-analyzer@0.4.1`, production 기본 origin, bin/files,
license와 provenance 설정은 유지했다. `docs/production-hosting.md`, `docs/sites-operations.md`와
`docs/npm-release.md`의 `0.1.3` 실제 게시 이력·tag·integrity는 보존했다. backend, D1 migration,
`.openai/hosting.json`, target registry와 application source에는 변경이 없다.

## 검증 결과

실행 명령:

```bash
npm ci --ignore-scripts --no-audit --no-fund
node --test \
  packages/codex-usage-profile-cli/test/cli.test.js \
  scripts/__tests__/verify-npm-release.test.js \
  scripts/__tests__/smoke-npm-package-local.test.js
node --test scripts/__tests__/scan-public-release-surface.test.js
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
npm test --workspace packages/codex-usage-profile-cli
node --test --test-concurrency=1 {Node 24 비-D1 109개 test 파일}
npx --yes node@22 --test --test-concurrency=1 {D1 6개 test 파일}
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

결과:

- OK — focused CLI·npm verifier·local smoke unit 33/33, CLI workspace 78/78이 통과했다.
- OK — public release scanner test 3/3과 실제 scan이 blocker 0으로 통과했다. 기존 Git history의
  review finding 71건은 immutable 문서 경로·합성 fixture로 분류됐고 신규 blocker는 없다.
- OK — npm verifier가 14개 파일의 `codex-usage-profile@0.1.4` tarball을 만들었다. packed 17,614 bytes,
  unpacked 63,363 bytes, SHA-1 `5bf1d4918ab362d7a33a2fcb04c48df356535ed3`, SHA-512
  `sha512-uYnMSdVTUm+srtIAWlCiLVk9TpRInGb3LTfn6R82uZXoSUMuHA6uEpd+jRtT/T1zmA7U+iyEKCaFjMcc7zRxsg==`다.
- OK — 격리 npm install·global/command help·credential-free status·origin guard 6개 경계를 통과했다.
  제한된 최초 실행의 registry 접근 실패는 허용된 격리 검증 환경에서 동일 smoke로 재검증했다.
- OK — Node 24 비-D1 109개 파일은 831 pass, 환경 조건부 6 skip, fail/cancel 0이다. 최초 sandbox
  실행의 loopback listen 4건 `EPERM`은 로컬 포트가 허용된 동일 Node 24 실행에서 전부 통과했다.
- OK — Node 22 D1 6개 파일은 36/36 pass다. migration manifest와 real-workerd migration/store,
  concurrency, maintenance, rate limiter를 모두 판정했다.
- OK — Playwright E2E 103/103이 통과했다. stale credential 자동 재승인, 기기 승인 완료 링크 위계,
  제출 전후 fixed README 불변과 revision share·5개 SNS target 갱신 계약을 포함한다.
- OK — production build는 server 63 modules, client 1,834 modules를 변환했다. full-stack verifier는
  client 12개, Worker 2개, migration 6개를 확인했고 production verifier는 project/binding과
  5,410,130-byte artifact를 승인했다.
- OK — npm registry의 현재 versions는 `0.1.0`~`0.1.3`, `latest=0.1.3`이며 `0.1.4`는 E404다.
  `codex-usage-profile-v0.1.4` tag도 없다.
- OK — 변경 경로는 version·exact fixture·두 CLI 문서와 작업 문서에 한정되고 backend/API/schema/
  migration/hosting manifest diff는 0이다. `git diff --check`도 통과했다.

## 잔여 위험

- 이 Stage의 tarball digest는 local candidate 값이다. Stage 2의 exact main 고정 뒤 Stage 3·4에서
  Sites archive와 npm registry provenance를 exact main SHA 기준으로 다시 대조해야 한다.
- Node 24 real-workerd 장시간 정지 문제 #135는 이번 version-only 범위에서 수정하지 않았다. D1 6개
  파일은 지원 범위 Node 22에서 전부 통과했다.
- npm `0.1.4`, Git tag, Stage5와 production에는 아직 원격 mutation이 없다.

## 다음 단계 영향

- Stage 2는 이 후보를 checkpoint PR로 `devel`에 통합한 뒤 별도 `devel → main` release PR로 exact
  source를 고정해야 한다. 두 PR은 Issue #137을 닫지 않고 각각 작업지시자 merge 승인을 받는다.
- exact main 고정 전에는 Stage5 source/save/deploy, npm tag/stage와 production 배포를 실행하지 않는다.

## 승인 요청

- Stage 1의 `0.1.4` version-only 후보와 전체 로컬 검증 결과를 승인하면 Stage 2 checkpoint PR 준비로
  진행한다.
