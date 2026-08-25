# Task #137 Stage 2 보고서 — checkpoint와 exact main release

GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
구현계획서: [`task_m100_137_impl.md`](../plans/task_m100_137_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 인증한 npm `0.1.4` 후보를 checkpoint PR로 `devel`에 통합하고, 별도 release PR로
`main`에 승격해 Stage5·npm tag·production이 공유할 exact source를 고정한다. 이 단계는 Git source
통합만 수행하며 npm registry와 Sites saved version·environment·deployment는 변경하지 않는다.

## 산출물

| 항목 | 변경 요약 |
|---|---|
| [PR #138](https://github.com/postmelee/codex-usage-profile/pull/138) | `publish/task137-checkpoint → devel` source checkpoint를 merge했다. |
| [PR #139](https://github.com/postmelee/codex-usage-profile/pull/139) | `devel → main` release source를 merge했다. |
| `origin/devel` | checkpoint merge `58276b2ea9380e0daa9b5ffcf569e37881a846f0`로 고정됐다. |
| `origin/main` | exact release merge `27e8705fdc152534a4e4b726cac32f625a3c7763`로 고정됐다. |
| `mydocs/orders/20260825.md` | Stage 2 완료와 Stage 3 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

Stage 2에서 제품·공식 문서 본문을 새로 수정하지 않았다. PR #138은 Stage 1 승인 tree를 그대로
`devel`에 통합했고 PR #139는 merged `devel` tree를 그대로 `main`에 통합했다. merge commit SHA는
서로 다르지만 Stage 1 후보, `origin/devel`, `origin/main`의 tracked tree는 byte 단위로 같다.

## 검증 결과

실행 명령:

```bash
gh pr view 138 --json state,baseRefName,headRefName,mergeCommit,statusCheckRollup
gh pr view 139 --json state,baseRefName,headRefName,mergeCommit,statusCheckRollup
git rev-parse origin/devel origin/main
git diff --exit-code 2defdc1dbcf249dc4f41ea072a87ca4555c29ebd^{tree} origin/devel^{tree}
git diff --exit-code origin/devel^{tree} origin/main^{tree}
git tag --list codex-usage-profile-v0.1.4
npm view codex-usage-profile dist-tags versions --json
git diff --check
git status --short
```

결과:

- OK — PR #138은 `devel ← publish/task137-checkpoint`, merge commit `58276b2`로 merge됐고 Node
  20·22·24 package checks가 모두 성공했다. npm stage job은 tag가 아니므로 의도대로 skip됐다.
- OK — PR #139는 `main ← devel`, merge commit `27e8705`로 merge됐고 Node 20·22·24 checks가 모두
  성공했다. npm stage job은 release source PR에서 의도대로 skip됐다.
- OK — approved Stage 1 commit `2defdc1` tree와 merged `origin/devel` tree가 같고,
  `origin/devel` tree와 exact `origin/main` tree도 같다.
- OK — Issue #137은 open 상태를 유지하며 merge된 checkpoint 원격 브랜치는 삭제했다.
- OK — local·remote `codex-usage-profile-v0.1.4` tag가 없고 npm registry는 versions
  `0.1.0`~`0.1.3`, `latest=0.1.3`을 유지한다.
- OK — production Site는 기존 public access revision 10, saved version 4/source `61f72fc`를 유지한다.
  environment revision 6은 maintenance disabled·service normal·maintenance token absent다.
- OK — Stage5 Site는 custom owner-only access revision 62, owner 1명·group/external 0명, saved version
  37/source `61f72fc`를 유지한다. environment revision 119는 maintenance disabled·service normal·
  maintenance token absent다.
- OK — 두 Site의 `DB` binding과 13개 user table은 유지되며 `schema_migrations`와
  `account_deletion_operations`가 존재한다. row read·write나 R2 접근은 수행하지 않았다.
- OK — source credential 발급, Sites save/deploy/environment update와 production access 변경은 0건이다.
  `git diff --check`도 통과했다.

## 잔여 위험

- exact main source는 고정됐지만 아직 Stage5에 저장·배포되지 않았다. 현재 Stage5 version 37과
  production version 4는 이전 main `61f72fc`를 실행한다.
- npm `0.1.4` tag·stage·version은 아직 없으며 `latest`는 계속 `0.1.3`이다.
- Stage3 remote mutation 전 owner-only access, rollback version 37, environment baseline과 exact main
  archive를 다시 확인해야 한다.

## 다음 단계 영향

- Stage 3은 exact main `27e8705fdc152534a4e4b726cac32f625a3c7763`을 Stage5 source repository에
  push하고 같은 source에서 만든 archive를 saved version으로 저장해야 한다.
- Stage5는 현재 custom owner-only access를 유지하므로 access 변경 없이 private deployment만 사용한다.
  environment-on deployment, migration/readiness와 environment-off 재배포는 각각 승인된 Gate 안에서
  수행하고 production은 변경하지 않는다.

## 승인 요청

- Stage 2의 checkpoint/main merge, exact tree와 npm·Sites 불변 검증을 승인하면 Stage 3의 Stage5
  source push·saved version 생성 Gate로 진행한다.
