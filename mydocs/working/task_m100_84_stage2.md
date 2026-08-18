# Task #84 Stage 2 보고서 — main release merge provenance

GitHub Issue: [#84](https://github.com/postmelee/codex-usage-profile/issues/84)
구현계획서: [`task_m100_84_impl.md`](../plans/task_m100_84_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 고정·검증한 exact candidate를 `devel → main` release PR로 승격하고, 작업지시자의 직접 merge 뒤 candidate ancestry와 merged-main tree equality를 검증한다. 이 Stage는 source release provenance만 확정하며 Sites saved version, access policy, tag, GitHub Release와 npm publish를 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| [PR #88](https://github.com/postmelee/codex-usage-profile/pull/88) | exact candidate `devel → main` release PR과 작업지시자 merge 기록 |
| [Issue #89](https://github.com/postmelee/codex-usage-profile/issues/89) | main release branch CI·보호 정책·release workflow 후속 추적 |
| [Issue #90](https://github.com/postmelee/codex-usage-profile/issues/90) | Gate C 이후 README·공개 metadata·문서 정합화 후속 추적 |
| `mydocs/working/task_m100_84_stage2.md` | release PR review·merge SHA·부모·tree equality와 비배포 경계 기록 |
| `mydocs/orders/20260812.md` | #84를 Stage 2 완료 및 Stage 3A 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

PR #88은 candidate source를 수정하지 않고 merge commit 방식으로 main에 승격했다. task worktree에는 단계 보고서와 오늘할일만 추가·수정하며 제품 source와 승인된 계획 본문은 변경하지 않는다.

## 검증 결과

실행 명령:

```bash
git fetch origin --prune --tags
git rev-parse origin/devel
git rev-parse origin/main
gh pr list --base main --head devel --state open
gh pr view 88 --json state,baseRefName,headRefName,headRefOid,mergeCommit,mergedAt,mergedBy,reviews,statusCheckRollup
gh pr checks 88
git rev-parse origin/main^1
git rev-parse origin/main^2
git merge-base --is-ancestor 242674cca76b167642108fb85f739fbdcf9fd4d4 origin/main
git diff --exit-code 242674cca76b167642108fb85f739fbdcf9fd4d4 origin/main -- .
git rev-parse 242674cca76b167642108fb85f739fbdcf9fd4d4^{tree}
git rev-parse origin/main^{tree}
git tag --points-at origin/main
gh run list --commit 0c804733e41988467ecd7fbd8e6a152cbfc2fad0
gh release list
git diff --check
git status --short
```

결과:

- **OK — release PR exactness**: PR #88은 base `main`, head `devel`, head SHA `242674cca76b167642108fb85f739fbdcf9fd4d4`로 생성됐고 중복 open PR은 없었다. 671 files, 128,208 additions, 419 commits ahead/0 behind의 Stage 1 topology와 일치했다.
- **OK — candidate checks**: exact candidate의 GitHub Actions run 31510366303에서 Node 20·22·24 verification은 pass, npm publication approval은 skipped다. 리뷰가 Node 721 pass/6 skip/0 fail, E2E 75/75, artifact 5,120,248 bytes, migration 5와 binding 3을 독립 재현했고 차단할 코드 결함을 발견하지 않았다.
- **OK — review 결정 추적**: merge 전 결정은 PR 코멘트로 명시했다. merge commit 사용을 강제하고, main CI·보호 정책·죽은 trigger·tag 정책은 #89, Gate C 뒤 README·metadata·공개 문서 정합화는 #90으로 비차단 유예했다.
- **OK — 작업지시자 직접 merge**: PR #88은 `MERGED`이며 merge SHA는 `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`이다. 작업지시자 계정이 2026-08-12 03:33:07 KST에 병합했다.
- **OK — merge commit provenance**: merge commit 첫 부모는 이전 main `e75609db133ae43e9a36d7cc9994c813bcaa621c`, 둘째 부모는 exact candidate `242674cca76b167642108fb85f739fbdcf9fd4d4`다. squash/rebase가 아닌 merge commit이며 `devel`은 candidate SHA로 보존됐다.
- **OK — ancestry와 tree equality**: candidate는 merged main의 ancestor다. candidate와 merged main의 source diff는 빈 출력이고 양쪽 tree는 `64e7fdb89c0ed1e3cceed44d56007c5c19064eff`로 정확히 같다.
- **OK — 의도하지 않은 release action 부재**: merge SHA에 새 Actions run이 없으며 이는 확인된 workflow trigger와 일치한다. merge SHA를 가리키는 tag는 0개이고 GitHub Release도 생성되지 않았다. npm publish와 Sites mutation은 이 Stage에서 실행하지 않았다.
- **OK — task worktree**: 단계 보고 전 task worktree는 clean이었고 `git diff --check`가 통과했다.

## 잔여 위험

- `main` PR/push CI와 branch protection 부재는 이번 exact candidate gate를 무효화하지 않지만 다음 release부터 반복되는 운영 위험이다. #89에서 workflow, ruleset, merge와 tag 정책을 처리한다.
- README의 배포 전 문구와 placeholder는 source merge 시점에는 Gate C 경계와 일치하지만 public 전환 뒤에는 낡는다. #90은 #84 Gate C 결과가 확정된 뒤 진행한다.
- merged main source의 local test/build는 candidate tree equality로 Stage 1 결과와 연결됐지만, production Sites artifact는 Stage 3에서 exact main detached clean worktree로 새로 만들어야 한다.
- Stage 3A는 read-only snapshot이고, saved version 생성·owner-only deploy는 별도 Stage 3B mutation 승인 없이는 수행하지 않는다.

## 다음 단계 영향

- Stage 3A의 source 기준은 merged main `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`, tree `64e7fdb89c0ed1e3cceed44d56007c5c19064eff`다.
- Stage 3A에서 Site linkage, current saved version/source/deployment, owner-only access, environment, health, D1 migration readiness, rollback version과 quota를 read-only로 다시 수집한다.
- Stage 3A 결과에 exact-main build digest/count와 만들 saved version 1개의 범위를 제시한 뒤, 작업지시자의 별도 owner-only mutation 승인을 받아야 Stage 3B를 시작할 수 있다.
- Gate C와 public access 전환은 Stage 3 protected smoke와 별도 명시 승인 전에는 수행하지 않는다.

## 승인 요청

- Stage 2 산출물과 merge provenance를 승인하면 Stage 3A exact-main owner-only 배포 전 read-only snapshot으로 진행한다.
