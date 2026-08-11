# Task M100 #57 Stage 2 완료보고서

GitHub Issue: [#57](https://github.com/postmelee/codex-usage-profile/issues/57)
구현계획서: [`task_m100_57_impl.md`](../plans/task_m100_57_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 채택한 `codex-usage-analyzer@0.4.1`이 packed profile CLI의
isolated consumer에 exact 설치되는지 검증하고, 설치된 analyzer의
runtime/lifecycle/public API/resolver contract drift를 fail-close하도록
local npm smoke를 강화했다.

실제 macOS 환경에서는 shell PATH에서 `codex`를 제외한 상태로 표준
ChatGPT/Codex 앱 번들 fallback이 선택되고, app-server 결과가
identity-free Account Usage Contract v1 allowlist로 정규화되는지
검증했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/smoke-npm-package-local.mjs` | installed analyzer exact version·license·engine·dependency·lifecycle·public API·resolver 파일 검사 추가 |
| `scripts/__tests__/smoke-npm-package-local.test.js` | `0.1.1` fixture 정렬, analyzer probe와 drift fail-close 회귀 테스트 추가 |
| `mydocs/orders/20260729.md` | Stage 2 완료와 Stage 3 승인 대기 상태 반영 |
| `mydocs/working/task_m100_57_stage2.md` | packed package와 macOS bundle fallback 검증 결과 기록 |

smoke source/test 변경은 2개 파일에서 57줄 추가, 7줄 삭제로 제한됐다.
published CLI tarball file allowlist와 production source에는 새 파일을
추가하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 local smoke의
격리 install, package export, help, credential-free status, loopback와
unsafe-origin fail-close, product state 미생성 검사를 그대로 유지했다.

새 analyzer probe도 기존 sanitized environment를 사용한다. parent
environment의 product/npm/OpenAI token은 child에 전달하지 않으며, 임시
consumer의 analyzer manifest와 resolver file 존재만 검사한다.

Account Usage Contract, service request, credential 저장과 production
visibility 동작은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test scripts/__tests__/smoke-npm-package-local.test.js
npm run smoke:npm-package:local
npm run verify:npm-release
npm test --workspace packages/codex-usage-profile-cli
node --test src/__tests__/codex-executable.test.js
git diff --check
```

macOS sanitized smoke:

- PATH를 `/usr/bin:/bin`으로 제한해 PATH의 `codex` 후보를 제외
- installed analyzer resolver가 표준 macOS app bundle을 선택하는지 확인
- `readAccountUsage()` 결과는 키 이름과 contract version만 검사
- usage 숫자, daily bucket 내용, identity, credential, stderr/RPC와 local
  path는 출력하지 않음

결과:

- OK — local smoke unit test 3건이 전부 통과했다.
  - isolated CLI/analyzer contract 성공
  - unsafe service origin fail-close
  - installed analyzer contract drift fail-close
- OK — actual isolated tarball smoke는 6개 경계를 통과했다.
  - profile package/export
  - installed analyzer contract
  - bin help
  - credential-free default status
  - credential-free loopback status
  - unsafe origin reject
- OK — installed analyzer probe는 exact `0.4.1`, MIT, Node `>=20`,
  runtime dependency 0개, install lifecycle script 0개,
  `readAccountUsage` public API와 `codex-executable.js` 존재를 확인했다.
- OK — local release candidate는 `codex-usage-profile@0.1.1`, 13 files,
  SHA-1 `07c45eaab893129a8a392e95350c2860717f2d0f`, integrity
  `sha512-Rj5xegz3fj5uD512OJo8IcJWbYG0rRiqSuhxEYmO6ZU4UrjzH5dY/u5cgV4pHgnZJ7pDNqkKgPmVqolloakJCg==`
  로 계속 검증됐다. Stage 3 문서 변경 전 값이므로 Gate B에는 사용하지
  않는다.
- OK — profile CLI test 46건이 전부 통과했다.
- OK — upstream resolver test 9건이 전부 통과했다.
  - non-macOS PATH 유지
  - PATH 우선
  - system/user Applications의 네 candidate 고정 순서
  - PATH 부재 fallback
  - 후보 부재 `null`
  - inspection failure detail 비노출
- OK — installed registry package의 resolver source와 upstream
  `0.4.1` working source가 byte-for-byte 일치했다.
- OK — 실제 macOS sanitized smoke에서 resolver source는
  `standard-macos-app-bundle`, contract version은 `1`이었다.
- OK — 반환 top-level은 `capturedAt`, `contractVersion`,
  `dailyUsageBuckets`, `summary`만 포함했다.
- OK — summary는 `currentStreakDays`, `lifetimeTokens`,
  `longestRunningTurnSec`, `longestStreakDays`, `peakDailyTokens`만
  포함했고 daily bucket은 `startDate`, `tokens` allowlist 배열이었다.
- OK — `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- 현재 실제 smoke는 installed analyzer의 read 경로를 검증했으며
  published `codex-usage-profile@latest submit` 전체 명령은 아직
  `0.1.0`을 가리키므로 Stage 4 공개 후 검증해야 한다.
- macOS bundle 내부 경로는 analyzer가 지원하는 네 표준 candidate에
  한정된다. 비표준 위치 사용자는 공식 Codex CLI를 PATH에 설치해야 하며
  이 안내는 Stage 3 문서에 반영한다.
- Stage 2 smoke 강화는 package tarball 밖 release tooling 변경이므로
  candidate digest는 Stage 1과 동일하다. Stage 3 package README 변경 후
  최종 candidate digest를 새로 계산해야 한다.
- upstream source/test 신뢰 경계는 exact registry integrity와 installed
  source 일치로 고정했지만, future analyzer version 자동 추적은 하지
  않는다.

## 다음 단계 영향

- Stage 3에서 root/package README, CLI/analyzer/npm release 문서를
  `0.1.1`, analyzer `0.4.1`, PATH-or-standard-app-bundle 기준으로
  갱신한다.
- 전체 scanner, release candidate, CLI/root tests를 다시 실행한 뒤
  final candidate commit/tag/tarball digest와 current registry absence를
  Gate B 입력으로 확정한다.
- Stage 3까지는 tag를 만들거나 npm stage를 생성하지 않는다.

## 승인 요청

- Stage 2 smoke 강화, exact analyzer source 검증과 macOS bundle fallback
  결과를 승인하면 Stage 3 공식 문서 및 immutable release candidate
  확정으로 진행한다.
