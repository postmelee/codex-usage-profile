# Task #122 Stage 4 완료 보고 — checkpoint와 exact main release provenance

GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)
구현계획서: [`task_m100_122_impl.md`](../plans/task_m100_122_impl.md)
Stage: 4

## 단계 목적

Stage 1~3 source를 Issue를 닫지 않는 checkpoint PR로 `devel`에 통합하고 별도
`devel → main` release PR로 승격한다. merged exact `main` tree가 integrated `devel`
candidate와 동일한지 확인하고, 그 exact source에서 Stage5 role artifact를 repository 밖에
재생성해 다음 Stage의 read-only preflight 입력을 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| GitHub PR `#123` | `publish/task122 → devel` non-closing checkpoint를 merge하고 원격 publish branch를 정리했다. |
| GitHub PR `#124` | `devel → main` source-only release를 merge했다. tag, npm publish와 Sites mutation은 포함하지 않았다. |
| Stage5 role artifact | exact `main`에서 stage5 project/origin과 `DB`·`PROFILE_MEDIA`, migration `1..6`을 materialize한 외부 archive를 생성했다. |
| `mydocs/orders/20260824.md` | Task #122를 `Stage 4 완료·exact-main/Stage5 artifact 검증, Stage 5 승인 대기`로 갱신했다. |
| `mydocs/working/task_m100_122_stage4.md` | 두 PR, commit/tree provenance, artifact digest와 다음 원격 Gate를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

Stage 4는 Stage 3 이후 제품 source를 수정하지 않았다. checkpoint PR head는 Stage 3 commit
`ce48d373757b18e0445639f57640ac8efc67fcfd`, integrated `devel`은
`24cf9b4002eaa5670ccd6f0113e501f7400ee4e9`, merged exact `main`은
`dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`다. integrated `devel`과 exact `main`의 tree는
모두 `a9148ff2c38df90e6629c63a20b93c0292880ab3`으로 동일하다.

PR #123과 #124는 closing keyword 없이 `Refs #122`로 연결해 Issue #122를 Open으로
유지했다. 두 PR과 artifact
검증 중 tag, npm publish, Sites save/deploy, access/environment 변경과 D1/R2 mutation은
수행하지 않았다. production은 public version 2 baseline을 유지하고 Stage5는 owner-only
custom access와 version 35 baseline을 유지한다.

## 검증 결과

실행 명령:

```bash
git fetch origin
git merge-base --is-ancestor ce48d373757b18e0445639f57640ac8efc67fcfd origin/devel
gh pr view 123 --json state,baseRefName,headRefName,headRefOid,reviews,statusCheckRollup
gh pr checks 123
gh pr view 124 --json state,baseRefName,headRefName,headRefOid,reviews,statusCheckRollup
gh pr checks 124
git merge-base --is-ancestor 24cf9b4002eaa5670ccd6f0113e501f7400ee4e9 origin/main
git diff --exit-code 24cf9b4002eaa5670ccd6f0113e501f7400ee4e9 origin/main -- .
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

추가 Stage5 target materialization:

```bash
npm run package:sites-target -- \
  --target stage5 \
  --expected-project-id appgprj_6a62f58721788191a7cd82f37320f244 \
  --source-sha dfc80d0b867bdb6a9afc002439d478ffb0aa38dd \
  --archive {external_archive_path} \
  --package-helper {approved_sites_package_helper}
```

결과:

- OK — checkpoint PR #123은 `devel ← publish/task122`, head `ce48d37`로 merge됐고
  Node 20·22·24 checks가 모두 성공했다. merge 뒤 `publish/task122`를 삭제했다.
- OK — release PR #124는 `main ← devel`, head `24cf9b4`로 merge됐고 동일 checks가
  성공했다. package approval job은 release source PR에서 의도대로 skip됐다.
- OK — Stage 3 head는 `origin/devel`에, integrated `devel` SHA는 `origin/main`에 포함된다.
  integrated candidate와 exact `main`의 tracked tree diff는 비어 있고 tree SHA가 같다.
- OK — integrated `devel` 전체 Node suite 재실행은 868 tests 중 862 pass,
  환경 조건부 6 skip, 0 fail이다. 최초 1회 dev-server 병렬 간섭은 대상 파일 단독 6/6과
  전체 suite 재실행 통과로 비회귀임을 확인했다.
- OK — exact-main production artifact는 client 12 files, Worker 2 files, binding 3개,
  migration `1..6`을 검증했다.
- OK — Stage5 live project ID와 registry가 일치하고 role artifact는 origin
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`, bindings `DB`와
  `PROFILE_MEDIA`, ordered migration `0001`~`0006`을 포함한다.
- OK — Stage5 archive는 3,105,686 bytes, SHA-256
  `fdb8536d92563babd397d18ba8dcc565d024a000fef55d173d87245c8cd23c73`이며 archive 재추출
  후 project/binding/migration·credential·절대 path 검사를 다시 통과했다.
- OK — exact-main detached worktree와 Task #122 worktree의 diff check가 통과했다.

## 잔여 위험

- Stage5 deployed version 35는 아직 Task #122 fix를 포함하지 않는다. Stage 5 Gate 5A
  read-only preflight 승인 전에는 새 version save/deploy를 수행하지 않는다.
- 기존 active operation ID, 최초 digest/count, phase·lease, R2 revision 0, non-public stable,
  backup checksum과 production baseline은 Stage 5 mutation 직전에 다시 확인해야 한다.
- production exact-main parity와 migration 6 적용은 Task #122 범위가 아니며 Task #108의
  별도 production launch-readiness Gate로 보정해야 한다.

## 다음 단계 영향

- Stage 5 Gate 5A는 이 보고서의 exact `main` SHA/tree와 Stage5 archive digest를 기준으로
  Stage5 version/source·access/environment, migration readiness, active operation,
  D1/R2 bounded counts, backup과 production baseline을 read-only로 대조한다.
- Gate 5A 결과가 모두 일치할 때만 별도 승인을 받아 exact-main owner-only save/deploy를
  진행한다. save/deploy 성공만으로 deletion apply 승인을 간주하지 않는다.
- 동일 operation resume 뒤 D1/R2 참조 0, 비열거, maintenance disabled, service normal,
  owner-only 복구와 production 무변경을 확인해 Task #108에 handoff한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 Gate 5A read-only preflight로 진행한다.
