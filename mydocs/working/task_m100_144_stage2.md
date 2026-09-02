# Task #144 Stage 2 완료보고서 — exact main release 승격

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 Local certification을 통과한 `devel`
`aaf997720f296265c8b306840f0eb8af67b08dfb`를 별도 release PR로 `main`에 승격하고,
merge commit의 tree가 승인 후보와 정확히 같은지 검증했다.

이 Stage는 GitHub source 승격만 수행했다. Sites source/version/deployment/environment/migration과
npm package/tag/registry는 변경하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| GitHub PR [#145](https://github.com/postmelee/codex-usage-profile/pull/145) | `devel → main` release PR, checks와 merge commit provenance |
| `mydocs/working/task_m100_144_stage2.md` | release PR, exact main tree와 원격 미변경 증적 기록 |
| `mydocs/orders/20260828.md` | #144를 Stage 2 완료·Stage 3 승인 대기 상태로 갱신 |

제품 source는 PR #145 merge commit으로만 `main`에 승격됐다. Task #144 branch에는 Stage 보고서와
오늘할일만 추가했으며 product code, package, migration, hosting manifest와 공식 문서는 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

release PR은 `origin/main` `27e8705fdc152534a4e4b726cac32f625a3c7763`을 base,
`origin/devel` `aaf997720f296265c8b306840f0eb8af67b08dfb`을 head로 사용했다.
changed files 64, additions 9,198, deletions 149로 Stage 1에서 고정한 PR #140/#142/#143 누적 diff와
일치했다.

merge 후 `origin/main`은 `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`이며 두 parent는 이전 main
`27e8705...`와 approved candidate `aaf9977...`다. candidate tree와 merged main tree는 둘 다
`9cfb107d1599fa1114a358f4ba6c4fbbb60ade3e`로 exact match다.

## 검증 결과

실행 명령:

```bash
git fetch origin
git rev-parse origin/main origin/devel
git log --first-parent --reverse --format='%H %s' origin/main..origin/devel
git diff --check origin/main...origin/devel
gh pr list --state open --base main --head devel
gh pr create --base main --head devel --title "Release: 라이트 소셜 썸네일과 웹 GIF export"
gh pr view 145 --json state,baseRefName,headRefName,headRefOid,mergeCommit,statusCheckRollup
gh pr merge 145 --merge --delete-branch=false
git fetch origin
git diff --exit-code aaf997720f296265c8b306840f0eb8af67b08dfb^{tree} origin/main^{tree}
git rev-parse origin/main origin/main^{tree} aaf997720f296265c8b306840f0eb8af67b08dfb^{tree}
git show --no-patch --format='%H%n%P%n%s' origin/main
npm view codex-usage-profile dist-tags version --json
```

결과:

- OK — Stage 2 진입 시 `origin/devel`은 approved candidate `aaf9977...`와 같고 추가 merge가 없었다.
- OK — 기존 open `devel → main` PR이 없어 중복 없이 PR #145를 생성했다.
- OK — PR #145의 base/head는 `main ← devel`, head OID는 `aaf9977...`, mergeable/merge state는
  `MERGEABLE`/`CLEAN`이었다.
- OK — GitHub Actions `Verify package on Node 20`, `Node 22`, `Node 24`가 모두 SUCCESS였다.
  tag가 아닌 release PR이므로 `Stage npm package for approval`은 의도대로 SKIPPED였다.
- OK — PR #145는 merge commit 방식으로 2026-08-28에 병합됐고 `devel` branch를 삭제하지 않았다.
- OK — merged main `0af8439...`의 tree와 approved candidate tree가 exact match했으며 ancestry와 두 parent가
  의도한 release 구조와 일치했다.
- OK — Issue #144는 OPEN 상태로 유지됐다.
- OK — public npm은 `latest=0.1.4`, version `0.1.4`로 유지됐으며 신규 tag/stage/publish가 없다.
- OK — production Sites는 active/public access revision 10, saved version 5/source
  `27e8705fdc152534a4e4b726cac32f625a3c7763` 상태로 유지됐다. 새 saved version이나 deployment가 없다.

## 잔여 위험

- `main` 승격은 완료됐지만 production Sites는 아직 version 5/source `27e8705...`이므로 Task #141/#39는
  사용자 traffic에 반영되지 않았다.
- exact main SHA는 merge commit `0af8439...`이다. Stage 3~5의 source push, archive, saved version과
  deployment는 candidate SHA가 아니라 이 exact main SHA를 사용해야 한다.
- Stage5 access, environment, migration과 active deletion operation은 Stage 3 시작 시 live state를 다시
  읽어야 한다. 과거 owner-only handoff를 현재 상태로 가정하지 않는다.
- Node 24 real-workerd #135는 Stage 1 잔여 위험으로 유지된다. release PR package matrix는 Node 20/22/24
  모두 통과했다.

## 다음 단계 영향

- Stage 3은 exact main `0af8439...`의 clean detached worktree에서 stage5 target archive를 새로 만든다.
- Stage5 project/origin/access/environment/version/migration을 read-only preflight하고 custom owner-only
  조건이 정확히 맞는 경우에만 private deployment 경로를 사용한다.
- Stage5 source push/save, temporary maintenance·private deploy·migration/readiness와 synthetic smoke를
  분리된 하위 Gate로 진행한다.
- production과 npm은 Stage 3에서 변경하지 않는다.

## 승인 요청

- Stage 2 PR #145, CI, exact main tree와 Sites/npm 미변경 결과를 승인하면 Stage 3 Stage5 owner-only
  preflight와 exact-main candidate 검증으로 진행한다.
