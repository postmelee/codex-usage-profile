# Task #122 Stage 5 완료 보고 — exact-main Stage5 안전 종료와 후속 handoff

GitHub Issue: [#122](https://github.com/postmelee/codex-usage-profile/issues/122)
구현계획서: [`task_m100_122_impl.md`](../plans/task_m100_122_impl.md)
Stage: 5

## 단계 목적

Stage 4에서 고정한 exact `main` source와 artifact를 owner-only Stage5에 배포하고,
live D1/R2·backup·operation authority와 production baseline을 원격 mutation 전후에 대조한다.
기존 operation의 live resume는 credential이 transcript·명령행·process argument에 남지 않는
실행 경로가 있을 때만 허용한다. 안전 조건이 충족되지 않으면 operator request 전에 중단해
Stage5를 maintenance disabled·token absent로 복구하고, live recovery는 비차단 후속 이슈로
이관하면서 Task #108의 production 공개 준비가 독립적으로 이어질 수 있게 한다.

## 산출물

| 파일·원격 산출 | 변경 요약 |
|---|---|
| Stage5 saved version 36 | exact `main` source와 Stage 4 artifact를 owner-only로 배포했다. |
| GitHub Issue `#125` | 안전한 maintenance credential handoff와 기존 operation live recovery를 비차단 후속 작업으로 등록했다. |
| GitHub Issue `#122` comment | Stage 5 완료 조건 보정, Stage5 안전 종료와 #125 이관을 기록했다. |
| GitHub Issue `#108` comment | #125를 기다리지 않고 production exact-main 배포·migration·smoke를 이어갈 handoff를 기록했다. |
| `mydocs/plans/task_m100_122.md` | live OAuth full-pagination baseline 22와 Stage 5 안전 종료·#108/#125 비차단 경계를 반영했다. |
| `mydocs/plans/task_m100_122_impl.md` | Gate 5A~5C를 exact-main 배포, credential fail-closed, token 제거·회전과 후속 이관 계약으로 보정했다. |
| `mydocs/troubleshootings/task_m100_122_sites_live_d1_structured_delete.md` | pagination 보정, exact-main live 증적, credential 경계와 #125 재발 방지 기록을 추가했다. |
| `mydocs/orders/20260824.md` | Task #122를 Stage 5 완료·최종 보고 승인 대기로 갱신하고 #125를 비차단 보류로 추가했다. |
| `mydocs/working/task_m100_122_stage5.md` | preflight, deployment, 안전 종료, 검증과 다음 handoff를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

Stage 5에서는 제품 source를 수정하지 않았다. 배포 source는 exact `main`
`dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`, tree
`a9148ff2c38df90e6629c63a20b93c0292880ab3`으로 Stage 4 provenance와 같다. 외부 candidate
archive SHA-256은
`fdb8536d92563babd397d18ba8dcc565d024a000fef55d173d87245c8cd23c73`이고 saved version 36의
Sites archive content hash는
`sha256:fbd36d0f1e90f2715be311a63f30b580b6c08675535bfdc0a0078b84179cacc8`이다.

Gate 5A full-pagination에서 OAuth state live baseline을 19가 아닌 22로 보정했다. 다음 page의
3행을 포함한 22행 모두 active operation 생성 전부터 존재하므로 live drift가 아니며 최초
승인 object count 77과 operation authority는 바꾸지 않았다. owner 1, OAuth state 22,
session 22, login challenge 11, CLI token 8, latest snapshot 0, latest usage 1, submitted device
7, rate limit 2, deletion operation 1이다.

Gate 5B는 Stage5 owner-only access revision 62를 유지한 채 version 36을 배포했다. D1
migration `1..6`, R2 revision 0, private/non-public 상태, 기존 operation `structured`, lease
없음과 repository 밖 mode `0600` backup checksum을 다시 확인했다.

Gate 5C에서 operator readiness/plan 전 credential 전달 경로를 점검한 결과 현재 실행 채널이
short-lived secret을 tool output 또는 process argument에 남길 수 있어 maintenance request를
전송하지 않고 fail closed했다. 적용 가능성이 있던 token은 제거·회전했고 Stage5를 environment
revision 119의 maintenance disabled, service normal, operator token absent로 재배포했다.
따라서 `readiness`, `plan`, `delete-account --apply`는 live에서 실행하지 않았고 D1/R2 delete
mutation은 0건이다. 기존 operation과 backup은 그대로 보존했다.

## 검증 결과

실행 명령:

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
```

원격 read-only/승인 mutation 검증:

- exact `main` SHA/tree, Stage5 candidate/saved archive digest 비교
- Stage5 project/version/source/access/environment와 D1/R2 binding 비교
- D1 migration `1..6`, full-pagination structured table count와 active operation 비교
- backup mode/checksum, R2 revision 0과 non-public 상태 비교
- Stage5 environment revision 119의 maintenance disabled·service normal·operator token absent 확인
- production version 2, source, access, environment revision 2와 maintenance baseline 비교

결과:

- OK — `build:production`이 server/client production artifact를 생성했다.
- OK — `verify:sites-fullstack`은 client 12 files, Worker 2 files, migration 6 files,
  raw 4,033,921 bytes, compressed 2,172,565 bytes를 검증했다.
- OK — `verify:sites-production`은 artifact 5,409,933 bytes, binding 3개와 migration 6 files,
  client 12 files, Worker 2 files를 검증했다.
- OK — Stage5 version 36 source와 archive provenance가 exact `main` candidate와 일치한다.
- OK — Stage5는 active·owner-only이고 access revision 62, environment revision 119,
  service normal, maintenance disabled, operator token absent다.
- OK — 노출 가능성이 있던 owner-only 우회 token은 회전돼 이전 값이 폐기됐다.
- OK — active operation은 1건, `structured`, lease 없음, 최초 승인 object count 77로
  유지됐고 D1/R2 delete request는 실행되지 않았다.
- OK — production은 version 2, 기존 source, environment revision 2, maintenance disabled,
  service normal, operator token absent로 무변경이다.
- OK — GitHub Issue #125가 `OPEN`, milestone `M100`, label `enhancement`로 등록됐고 #122와
  #108에 승인된 비차단 handoff를 기록했다.
- OK — `git diff --check`가 통과했다.

## 잔여 위험

- exact-main live operator `readiness`, exact plan과 기존 operation resume는 아직 수행하지
  않았다. credential을 transcript·로그·명령행·process argument에 노출하지 않는 실행 경로와
  별도 파괴적 승인까지 #125에서 처리한다.
- Stage5 기존 operation과 backup은 의도적으로 보존됐다. Stage5는 owner-only이고 maintenance가
  닫혀 있으므로 production 공개·마케팅의 차단 조건이 아니다.
- production은 아직 version 2, migration 1~5 baseline이다. exact-main production 배포,
  migration 6, login→submit→publish→share→account deletion smoke는 #108에서 공개 전 완료해야
  한다.

## 다음 단계 영향

- Task #122의 다음 절차는 `task-final-report`다. 최종 보고서는 source fix·Stage 1~5 검증,
  exact-main Stage5 안전 종료, #108 production release 비차단 handoff와 #125 follow-up을
  하나로 요약한다.
- #108은 #125를 기다리지 않고 production exact-main 배포, migration 6, 사용자 흐름 smoke와
  공개·마케팅 release gate를 이어간다.
- #125는 별도 `task-start` 승인 전에는 브랜치·계획·구현을 시작하지 않는다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 `task-final-report`로 Task #122 최종 보고와 final
  `devel` PR 준비를 진행한다.
