# Task #91 Stage 3 보고서 — 사용자 문서와 package 통합 검증

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 3

## 단계 목적

interactive GitHub star prompt의 실제 동작과 보안 경계를 공식 CLI guide와 npm package README에 기록한다. 신규 배포 source가 exact npm package allowlist를 통과하게 하고, package·repository 전체 test, 격리 tarball smoke와 public release scan으로 기존 machine-readable·credential·배포 계약이 유지되는지 검증하는 최종 구현 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/cli-submit.md` | Enter 기본 Yes, active local `gh` account, 결과 전 prompt, 적용·제외 환경, browser·제품 credential 미사용과 fail-soft 경계를 공식 가이드에 추가했다. |
| `packages/codex-usage-profile-cli/README.md` | npm package 사용자가 확인할 optional `gh` requirement와 prompt·automation·보안 계약을 간결하게 추가했다. |
| `scripts/verify-npm-release.mjs` | 신규 배포 파일 `src/github-star.js` 한 항목을 exact package allowlist에 추가했다. |
| `mydocs/plans/task_m100_91_impl.md` | 검증 중 발견되고 작업지시자가 승인한 npm release allowlist 보정을 Stage 3 산출물·완료 조건에 반영했다. |
| `mydocs/working/task_m100_91_stage3.md` | Stage 3 문서·배포 보정과 전체 검증 결과를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

기존 두 공식 문서는 관련 요구사항·Quickstart·automation·보안 문맥을 유지하고 star prompt 절과 필요한 보충 문장만 추가했다. 기존 명령, service origin, credential 저장, 전송 데이터와 오류 설명은 재작성하거나 제거하지 않았다. release verifier도 기존 allowlist 구조와 추가 파일 거부 정책을 유지하면서 신규 package source 한 항목만 허용했다.

## 검증 결과

실행 명령:

```bash
npm --workspace packages/codex-usage-profile-cli test
npm test
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

결과:

- OK — CLI package test 64개 통과, 실패·취소·건너뜀 0개.
- OK — repository root test 744개 중 738개 통과, 환경 의존 test 6개 skip, 실패 0개. D1/Miniflare loopback fixture를 위해 sandbox 밖에서 실행했다.
- OK — 최초 root test에서 신규 `src/github-star.js`가 exact npm allowlist에 없어 package entry count 검증이 실패했다. 작업지시자 승인 후 구현계획서와 allowlist를 보정했고 release verifier 단독 test 5개 및 root test 재실행이 통과했다.
- OK — 최초 worktree root test의 card ETag 항목은 worktree에 root dependency 폴더가 없어 실패했다. 기존 설치 폴더를 임시 연결해 재검증했고 ETag test를 포함한 전체 root test가 통과했으며 임시 링크는 제거했다.
- OK — local npm package smoke가 `entryCount: 14`, `checksVerified: 6`으로 통과했다. 신규 helper를 포함한 tarball의 격리 설치, export, analyzer contract, bin과 credential-free 경계를 확인했다.
- OK — public release scan이 2,422개 blob을 검사해 `blockerCount: 0`, skipped large blob 0으로 통과했다. 기존 review/info finding 외 신규 blocker는 없다.
- OK — `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- 실제 사용자 terminal의 active `gh` account와 GitHub network를 사용하는 end-to-end star mutation은 test에서 의도적으로 실행하지 않았다. 외부 변경 없이 재현 가능한 fake runner, CLI orchestration과 packed artifact 경계를 검증했다.
- 각 `gh` operation은 최대 5초이므로 local `gh` 또는 network가 느리면 결과 출력 전 선택적 확인이 그만큼 지연될 수 있다. unknown failure에서는 prompt를 생략하고 제품 결과로 계속한다.
- Enter가 외부 star mutation을 수행하므로 prompt와 공식 문서에서 `(Y/n)`, active account와 대상 repository를 명시한다.

## 다음 단계 영향

- 모든 구현 Stage가 완료됐다. 다음 승인을 받으면 `task-final-report` 절차로 최종 보고서, 오늘할일 완료 처리, 최종 커밋, `publish/task91` push와 `devel` 대상 PR을 준비한다.
- 최종 보고에는 Stage 1 core, Stage 2 command integration, Stage 3 docs·release allowlist와 최종 검증 결과를 통합한다.
- 실제 GitHub star mutation은 최종 검증에서도 실행하지 않으며 PR 검증은 deterministic test와 package artifact 결과를 사용한다.

## 승인 요청

- Stage 3의 사용자 문서, 승인된 npm release allowlist 보정과 전체 검증 결과를 승인하면 최종 보고서와 PR 게시 단계로 진행한다.
