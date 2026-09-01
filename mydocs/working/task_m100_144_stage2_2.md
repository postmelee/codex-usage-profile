# Task #144 Stage 2.2 완료보고서 — #146 포함 exact main 재승격

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 2.2

## 단계 목적

Stage 2.1에서 전체 재인증을 통과한 replacement candidate
`7fd130c7ceac92b0cfa6b58178422ba51d75943c`를 두 번째 `devel → main` release PR로
승격하고, 새 merge commit의 tree가 candidate tree와 정확히 같은지 검증했다.

이 Stage는 GitHub source 승격만 수행했다. Sites source/version/deployment/environment/migration과
npm package/tag/registry는 변경하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| GitHub PR [#148](https://github.com/postmelee/codex-usage-profile/pull/148) | `devel → main` replacement release PR, checks와 merge provenance |
| `mydocs/plans/task_m100_144_impl.md` | Stage 3~5가 사용할 새 exact main SHA 기록 |
| `mydocs/working/task_m100_144_stage2_2.md` | PR/check/main tree equality와 Sites/npm 미변경 증적 |
| `mydocs/orders/20260901.md` | #144를 Stage 2.2 완료·Stage 3 승인 대기로 갱신 |

제품 source는 PR #148 merge commit으로만 `main`에 승격됐다. Task #144 branch에는 계획의 실제
main SHA, 단계 보고서와 오늘할일만 추가했으며 package, migration과 hosting manifest를 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

- release PR base: initial main `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`
- release PR head: replacement `devel` `7fd130c7ceac92b0cfa6b58178422ba51d75943c`
- first-parent 추가 범위: PR #147 / Task #146 한 건
- changed files: 21, additions 1,485, deletions 41
- migration, hosting target, CLI package와 lockfile diff: 없음
- 새 exact main: `6d3e600d2d33bb7a50147075d013ddd9b945d0b1`
- main parents: 이전 main `0af8439...`, replacement candidate `7fd130c...`
- candidate/main tree: `5b3c52e384c3e057902fac5221121243393e13fe`, exact match

Task #144 문서 commit은 `devel → main` release source에 포함되지 않았다.

## 검증 결과

실행 명령:

```bash
git fetch origin
git rev-parse origin/main origin/devel origin/main^{tree} origin/devel^{tree}
git log --first-parent --reverse --format='%H %s' origin/main..origin/devel
git diff --check origin/main...origin/devel
git diff --name-status origin/main...origin/devel -- db/migrations .openai/hosting.json .openai/hosting-targets.json packages/codex-usage-profile-cli/package.json package-lock.json
gh pr list --state open --base main --head devel
gh pr create --base main --head devel --title "Release: 라이트 카드 Border Beam 대비 보정"
gh pr view 148 --json state,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup
gh pr merge 148 --merge --delete-branch=false
git fetch origin
git diff --exit-code 7fd130c7ceac92b0cfa6b58178422ba51d75943c^{tree} origin/main^{tree}
git merge-base --is-ancestor 7fd130c7ceac92b0cfa6b58178422ba51d75943c origin/main
npm view codex-usage-profile dist-tags version --json
```

결과:

- OK — Stage 진입 시 main/devel과 replacement candidate drift가 없고 열린 중복 release PR도 없었다.
- OK — PR #148 base/head는 `main ← devel`, head OID는 exact `7fd130c...`였다.
- OK — GitHub Actions `Verify package on Node 20`, `Node 22`, `Node 24`가 모두 SUCCESS였다.
  tag가 아닌 release PR이므로 `Stage npm package for approval`은 의도대로 SKIPPED였다.
- OK — PR #148은 2026-09-01 merge commit 방식으로 병합됐고 `devel` branch를 유지했다.
- OK — merged main `6d3e600...`의 두 parent, ancestry와 tree가 의도한 replacement release 구조와
  일치했다. candidate/main tree diff는 빈 출력이다.
- OK — Issue #144는 OPEN 상태로 유지됐다.
- OK — public npm은 `latest=0.1.4`, version `0.1.4`로 유지돼 신규 publish/tag mutation이 없다.
- OK — production Sites는 public access revision 10, latest saved version 5/source `27e8705...`를 유지한다.
- OK — stage5 Sites는 custom owner-only access revision 62, owner 1·group/external 0,
  latest saved version 39/source initial main `0af8439...`다. 새 main `6d3e600...` version은 아직 없다.
- OK — Stage 2.2에서 Sites save/deploy/environment/migration connector mutation은 0건이다.

## 잔여 위험

- main 승격은 끝났지만 stage5 latest version 39는 initial main `0af8439...`다. Task #146은 아직 원격
  Stage5와 production traffic에 반영되지 않았다.
- Stage 3은 새 exact main `6d3e600...`에서 archive를 다시 만들고 source push, saved version,
  maintenance/private deployment, migration/readiness, synthetic smoke를 하위 Gate별로 수행해야 한다.
- Stage5 owner-only access revision 62와 current version 39는 read-only 관찰값이다. Stage 3 mutation
  직전에 access/environment/migration/active operation을 다시 확인해야 한다.
- production은 계속 version 5/source `27e8705...`다. Stage 3에서 production을 변경하지 않는다.

## 다음 단계 영향

- Stage 3 exact source는 main `6d3e600d2d33bb7a50147075d013ddd9b945d0b1` 하나다.
- Stage5 project/origin/access/environment/version/migration과 active operation을 먼저 read-only로 확인한다.
- exact owner-only 조건이 맞을 때만 새 main archive의 Stage5 source/save Gate로 진행한다.
- Stage5의 기존 version 39/source `0af8439...`를 application rollback 입력으로 기록한다.
- production과 npm은 Stage 3에서 변경하지 않는다.

## 승인 요청

- PR #148, CI, exact main tree와 Sites/npm 미변경 결과를 승인하면 Stage 3 Stage5 owner-only
  preflight와 새 exact-main candidate 검증으로 진행한다.
