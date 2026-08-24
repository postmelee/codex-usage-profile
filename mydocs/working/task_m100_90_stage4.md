# Task #90 Stage 4 보고서 — 공개 문서 exact-main 승격 검증

GitHub Issue: [#90](https://github.com/postmelee/codex-usage-profile/issues/90)
구현계획서: [`task_m100_90_impl.md`](../plans/task_m100_90_impl.md)
Stage: 4

## 단계 목적

Stage 1~3에서 승인한 사용자 README, user guide, 문서 navigation과 current-tree 위생 변경을 먼저
`devel` checkpoint로 통합하고, 같은 exact tree를 별도 `devel → main` release PR로 승격한다. 두 PR의
CI·merge provenance와 `main` 공개 문서 path equality를 검증하고 실제 GitHub repository 화면에서
README의 정보구조와 `width="50%"` 카드를 확인한다.

## 산출물

| 산출물 | 변경 요약 |
|---|---|
| [PR #128](https://github.com/postmelee/codex-usage-profile/pull/128) | `publish/task90 → devel` non-closing checkpoint, merge commit `346ecc02ff7dfb8ac89ef2393265931c5d69e741` |
| [PR #129](https://github.com/postmelee/codex-usage-profile/pull/129) | `devel → main` documentation release, merge commit `4d1252f9988f39bdbe07f148c93ce4e9d620e35a` |
| `mydocs/orders/20260824.md` | Task #90을 Stage 4 완료·Stage 5 승인 대기로 갱신 |
| `mydocs/working/task_m100_90_stage4.md` | 두 PR provenance, exact-main tree와 실제 GitHub README render 검증 기록 |

## 본문 변경 정도 / 본문 무손실 여부

Stage 4에서는 Stage 1~3에서 승인된 source 본문을 다시 수정하지 않았다. checkpoint PR은 Task #90
Stage 3 source commit `32ce128872d964f661a6fadfba3366f568b13c42`을 head로 사용했고, `devel`
merge commit은 그 source를 parent로 포함한다. release PR은 checkpoint 뒤 exact `origin/devel`
`346ecc02ff7dfb8ac89ef2393265931c5d69e741`을 head로 사용했다.

`origin/main`의 merge result와 checkpoint `devel` tree를 README, CONTRIBUTING, 전체 `docs/`, package
README 범위에서 비교해 차이 0을 확인했다. package manifest/version, lockfile, `.openai`, `src/`와 CLI
package manifest도 차이 0이다.

두 PR은 Issue #90을 close하지 않았다. npm publish approval job은 의도대로 skip됐으며 package 재게시,
Sites 배포, database 작업, GitHub repository metadata 변경을 수행하지 않았다.

## 검증 결과

실행 명령:

```bash
gh pr view 128 --json state,baseRefName,headRefName,headRefOid,mergeCommit,statusCheckRollup
gh pr view 129 --json state,baseRefName,headRefName,headRefOid,mergeCommit,statusCheckRollup
git merge-base --is-ancestor 32ce128 origin/devel
git merge-base --is-ancestor 32ce128 origin/main
git merge-base --is-ancestor 346ecc0 origin/main
git diff --exit-code 346ecc0 origin/main -- README.md CONTRIBUTING.md docs packages/codex-usage-profile-cli/README.md
git diff --check
git status --short
```

checkpoint PR 게시 전에는 Stage 1~3 전체 diff, npm artifact, public scan, local Markdown link와 GitHub
GFM render를 다시 검증했다. release merge 뒤에는 GitHub의 explicit `main` repository URL을 실제
브라우저로 열어 DOM과 desktop viewport를 확인했다.

결과:

- OK — PR #128은 `publish/task90 → devel`, head `32ce128`, merge `346ecc0`으로 MERGED다.
- OK — PR #129는 `devel → main`, head `346ecc0`, merge `4d1252f`로 MERGED다.
- OK — 두 PR 모두 Node 20/22/24 package verifier가 SUCCESS이고 npm publish approval job은 SKIPPED다.
- OK — approved Stage 3 source는 `origin/devel`과 `origin/main`의 ancestor이며 checkpoint merge도
  `origin/main`의 ancestor다.
- OK — checkpoint와 `origin/main`의 README/CONTRIBUTING/docs/package README tree는 exact-match다.
- OK — product source, package version/lockfile와 Sites manifest는 exact-match다.
- OK — preflight `verify:npm-release`는 immutable `codex-usage-profile@0.1.3`, entry 14개로 통과했다.
- OK — preflight public scan은 blocker 0, local Markdown link checker는 missing 0이다.
- OK — 실제 GitHub `main` README article은 838px이고 live card는 `width="50%"`, 419×256.9375px로
  렌더됐다. 원본 1497×918 PNG를 GitHub Camo가 표시하며 outer href는 fixed production
  `/api/share/postmelee`를 유지한다.
- OK — Website/npm/MIT badge 3개가 보이고 H1 1개, H2 9개, code block 3개가 정상 렌더됐다.
- OK — desktop 첫 화면은 title → value proposition → card → badges/Website CTA → Quick start 순서이며
  clipping, 깨진 image와 비정상 여백이 없다.
- OK — local working tree는 clean이고 `git diff --check` 경고가 없다.

## 잔여 위험

- GitHub repository의 description, homepage와 default branch는 아직 Stage 1 rollback 값이다. About의
  homepage가 테스트 origin을 가리키고 default branch가 `devel`인 상태는 Stage 5의 승인된 변경 대상이다.
- `main`은 release merge commit topology 때문에 `devel`과 commit graph가 동일하지 않지만 승인된 공개
  문서 path와 product tree는 exact-match다.
- GitHub Camo는 production origin의 ETag와 독립적으로 cache되므로 향후 카드 이미지 갱신 지연은
  계속 발생할 수 있다.

## 다음 단계 영향

- Stage 5는 live repository metadata를 다시 조회해 Stage 1 rollback payload와 byte 단위로 일치하는지
  preflight한다.
- 별도 승인 뒤에만 description, homepage, default branch 세 필드를 exact desired payload로 변경한다.
- metadata 변경 직후 repository root, default `main` README, production website/card/share, npm dist-tag와
  Site 불변 상태를 검증한다.
- unexpected preflight, partial mutation 또는 README/link 문제가 있으면 세 필드를 rollback payload로
  복구하고 Stage 5를 완료 처리하지 않는다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 GitHub metadata cutover와 최종 공개 검증으로
  진행한다.
