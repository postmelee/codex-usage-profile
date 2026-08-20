# Task #108 Stage 3 보고서 — exact-main release provenance 확정

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 3

## 단계 목적

Stage 2와 Stage 3.2에서 검증한 canonical production 후보를 non-closing checkpoint PR로
`devel`에 통합하고, 별도 `devel → main` release PR을 통해 exact production source를
`main`에 고정한다. 두 PR의 head·merge commit·CI와 최종 tree를 대조하고, Issue #108을
열어 둔 채 Sites 배포·환경·접근 정책, npm tag/publish를 변경하지 않았음을 확인한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_108_stage3.md` | PR #109/#110 merge, exact-main tree, CI와 원격 무변경 증적을 기록했다. |
| `mydocs/orders/20260820.md` | #108을 Stage 3 완료·Stage 4 Gate A2 승인 대기로 갱신했다. |

원격 source 통합 결과:

- checkpoint PR [#109](https://github.com/postmelee/codex-usage-profile/pull/109):
  `publish/task108 → devel`, merge commit
  `f3110a12bfa58404546761b8410840828b85c410`
- release PR [#110](https://github.com/postmelee/codex-usage-profile/pull/110):
  `devel → main`, merge commit
  `9835fb94c7cd9116114a8b936d5e9eebfb0f85d0`
- integrated candidate SHA:
  `f3110a12bfa58404546761b8410840828b85c410`
- exact source tree:
  `52e1e79dcddebc5ebc0ac840babb479a96eb8a49`

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 공개 문서는 Stage 3에서 추가로 수정하지 않았다. PR #110의 merge commit과
integrated candidate의 tree가 byte-for-byte 동일하므로 release merge 과정에서 source drift가
없다. public README·Device Approval은 아직 live stage5와 npm `latest=0.1.1`을 안내하며,
canonical/`0.1.2` cutover 문구는 production public smoke와 Gate C 전까지 공개하지 않는다.

Stage 3는 Issue close, Sites source push/save/deploy, D1/R2 attach, environment/OAuth 변경,
access 변경, tag·GitHub Release·npm publish를 수행하지 않았다. `pr-merge-cleanup`도 Task #108의
최종 PR이 아니므로 적용하지 않았다.

## 검증 결과

실행 명령:

```bash
git fetch origin --tags
git merge-base --is-ancestor c10033b origin/devel
gh pr view 109 --repo postmelee/codex-usage-profile --json \
  number,state,mergedAt,mergeCommit,baseRefName,headRefName,headRefOid,url,statusCheckRollup
gh pr checks 109 --repo postmelee/codex-usage-profile
gh run list --repo postmelee/codex-usage-profile \
  --commit f3110a12bfa58404546761b8410840828b85c410
gh pr view 110 --repo postmelee/codex-usage-profile --json \
  number,state,mergedAt,mergeCommit,baseRefName,headRefName,headRefOid,url,statusCheckRollup
gh pr checks 110 --repo postmelee/codex-usage-profile
git merge-base --is-ancestor \
  f3110a12bfa58404546761b8410840828b85c410 origin/main
git diff --exit-code \
  f3110a12bfa58404546761b8410840828b85c410 origin/main -- .
git rev-parse \
  f3110a12bfa58404546761b8410840828b85c410^{tree} \
  origin/main^{tree} origin/devel^{tree}
git tag --list 'codex-usage-profile-v0.1.2'
npm view codex-usage-profile dist-tags version --json
git diff --check
git status --short --branch
```

Sites read-only postcheck:

- `get_site`
- `list_site_versions`
- `get_environment_variables`

결과:

- **OK — checkpoint merge**: PR #109는 2026-08-20 16:17 KST에 merge됐다. head
  `cbbe5daa37fd4bd95c57554ae184587a63bc0fd3`의 Node 20·22·24 package 검증은 모두
  통과했고 publish staging job은 의도대로 skip됐다.
- **OK — release merge**: PR #110은 2026-08-20 16:35 KST에 merge됐다. head는 integrated
  `devel` SHA와 일치하며 Node 20·22·24 검증은 모두 통과했고 publish staging job은 skip됐다.
- **OK — exact-main provenance**: Stage 2 commit `c10033b`와 integrated candidate가 각각
  `origin/devel`, `origin/main`의 ancestor다. candidate, `origin/devel`, `origin/main`의 tree는
  모두 `52e1e79dcddebc5ebc0ac840babb479a96eb8a49`이며 candidate와 main의 path diff는 없다.
- **OK — Issue continuity**: Issue #108은 `OPEN/REOPENED` 상태다. checkpoint/release merge로
  task를 조기 종료하지 않았다.
- **OK — canonical Site 무변경**: canonical production project는 active, owner 1명만 허용한
  custom access revision 1이다. saved version 0개, latest version 0, live/preview URL 없음,
  environment revision 0·key 0개 상태다.
- **OK — npm/tag continuity**: `codex-usage-profile-v0.1.2` tag는 없고 npm dist-tag와 최신
  version은 모두 `0.1.1`이다. release merge가 publish를 유발하지 않았다.
- **OK — working tree**: 보고서 작성 전 `git diff --check`는 통과했고 branch에는 Stage 3
  기록 외 제품 변경이 없었다.

## 잔여 위험

- canonical production은 아직 D1/R2 attach, migration, production 전용 OAuth·secret,
  environment, saved version과 deployment가 전혀 없다.
- Stage 4의 private deployment는 exact `origin/main` detached clean source에서 다시 build하고,
  live production project ID와 artifact project ID를 독립적으로 대조해야 한다.
- Sites가 반환하는 접근용 bearer 값과 새 runtime secret은 보고서·로그·Git에 기록하지 않는다.
- production public cutover와 npm `0.1.2` publish는 private smoke 성공 뒤에도 Gate B와 Gate C로
  각각 별도 승인받아야 한다.

## 다음 단계 영향

- Stage 4A는 exact main SHA/tree, owner-only undeployed project, D1/R2 first attach 범위,
  migration `[1,2,3,4,5]`, production 전용 OAuth callback·environment key와 exact archive
  digest를 read-only로 제시한다.
- Gate A2 승인 전에는 source credential 발급, repository push, environment update,
  version save/private deploy 또는 storage provisioning을 수행하지 않는다.
- Gate A2 뒤 private smoke를 통과해도 public access는 Gate B, npm tag/publish는 Gate C 승인
  전까지 변경하지 않는다. stage5 public과 npm `latest=0.1.1` 연속성도 유지한다.

## 승인 요청

- Stage 3의 checkpoint/release merge와 exact-main provenance 결과를 승인하면 Stage 4A의
  Gate A2 입력을 준비한다. Gate A2 원격 mutation은 입력 검토 뒤 별도로 승인 요청한다.
