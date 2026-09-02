# Task #144 Stage 7 보고서 — 공식 문서 이력·재시도 계약 보완

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 7

## 단계 목적

PR [#149](https://github.com/postmelee/codex-usage-profile/pull/149) 리뷰의 지적을 Stage 3~6 실측
기록과 대조해 보완한다. 작업지시자가 2026-09-02 "1, 3, 4번 보완해줘"라고 승인한 범위로 진행했으며,
배포된 production version 6과 stage5 version 40의 원격 상태는 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/sites-operations.md` | 이력 표의 `Task #137 production` 행 의미를 #137 종료 시점 기준으로 정정하고 `Task #144 직전 production` rollback 기준 행 추가 |
| `docs/sites-operations.md` | stage5 테스트 operation 문장의 조사·`structured` 중복 제거와 문단 재래핑 |
| `docs/production-hosting.md` | startup 1항에서 polling 중단 조건과 Gate 통과 뒤 단일 재시도 조건 분리, `sites-operations.md` 승격 Gate 상호 참조 |

리뷰 기준 HEAD `3c9d99ba4fd389aba7e7fd6fc3752499d297a94c` 이후 공식 문서 보완은 2개 파일
`+11/-7`(`production-hosting.md` `+5/-2`, `sites-operations.md` `+6/-5`)이다. 제품 source,
migration, package, lockfile, hosting manifest와 `mydocs/` 단계 보고의 실측 수치는 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

- 기존 이력 행, 승격 절차와 Stage 1~6 보고 근거는 모두 보존했다. Stage 6에서 승인된 문서 위치
  판단을 유지하고 새 공식 문서를 만들지 않았다.
- 리뷰 1: 이력 표의 `environment` 열은 각 시점의 관찰값이지만, `Task #137 production` 행의 의미가
  "Task #144 직전 application rollback 기준"이었다. #137 종료 시점 값은 revision 8이고
  ([`task_m100_137_stage6.md`](task_m100_137_stage6.md)), #144가 remote mutation을 하기 전에 관찰한
  값은 revision 12다 ([Stage 3](task_m100_144_stage3.md), [Stage 4](task_m100_144_stage4.md)). 두 시점을
  한 행이 겸하면 실제 rollback 때 운영자가 어긋난 environment를 대조하므로 행을 분리했다. saved
  version 5와 public access revision 10은 두 시점 모두 같으므로 `유지`로 표기했다.
- 리뷰 3: `sites-operations.md` 승격 Gate는 convergence 확인 뒤 첫 migration이 generic `404`이면
  read-only 확인 후 정확히 한 번 재시도하도록 정의한다. `production-hosting.md`는 "generic `404`가
  계속되면 mutation을 재전송하지 않고 중단한다"만 기록해, 아키텍처 문서만 읽는 운영자가 Stage 5에서
  실제로 성공한 절차를 금지된 것으로 이해할 수 있었다. polling 단계의 중단 조건과 Gate 통과 뒤
  재시도 조건을 분리하고 판정 절차는 runbook을 참조하도록 연결했다. 두 문서의 계약 자체는 Stage 5
  실측과 동일하며 새 허용 범위를 만들지 않았다.
- 리뷰 4: `테스트 operation이 하나가`의 주격 조사 중복과 한 문장 내 `structured` 중복을 제거했다.
  Stage 6이 추가한 `lease expired` 정보와 #125 인계 문장은 그대로 유지하고, 141자였던 줄을 파일의
  기존 65~101자 범위로 재래핑했다.
- 리뷰 2(production environment 8 → 12 드리프트의 원인 기록)는 이번 승인 범위에서 제외했다. 원인
  확인이 Sites 원격 audit을 요구하므로 문서에는 관찰값만 남기고 해석을 추가하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run scan:public-release
git diff --check
```

결과:

- OK — public release surface scan은 `blockerCount=0`, `reviewCount=73`으로 Stage 6 기준과 같다.
  이번 문서 보완으로 새 blocker나 review 항목이 생기지 않았다.
- OK — `git diff --check`는 whitespace 오류 0건이다.
- OK — 이력 표는 행 추가 뒤에도 10행 모두 5열로 일치한다. 새로 추가한 `sites-operations.md` 상호
  참조는 대상 파일이 존재하며, 같은 파일 296행의 기존 상대 링크와 형식이 같다.
- OK — 두 공식 문서가 공유하는 수치는 편집 전후로 같다. exact source `6d3e600d...`, 30 files,
  10,926,080 bytes, content hash `sha256:6f905edb...`, public access revision 10, environment
  revision 14, migration `[1,2,3,4,5,6]`, npm `0.1.4`를 모두 재대조했다.
- OK — 새 이력 행의 environment revision 12는 Stage 3 보고서와 Stage 4 보고서의 preflight 실측값과
  일치한다. saved version 5와 source `27e8705...`도 두 보고서와 같다.
- 문서 전용 변경이므로 Node·Playwright·build 회귀는 재실행하지 않고 Stage 6 결과를 그대로 인계한다.
  원격 Sites, D1/R2, npm과 GitHub release 상태에는 mutation을 수행하지 않았다.

## 잔여 위험

- 리뷰 2의 production environment 8 → 12 드리프트는 원인이 확인되지 않은 채 남는다. #137 종료 이후
  #144 Stage 3 preflight 사이에 production 배포는 없었고 저장소 문서에도 해당 변경 기록이 없다.
  이력 표는 이제 두 시점을 모두 보여주므로 값 자체는 어긋나지 않지만, 원인 확인과 기록은 별도
  지시가 필요하다.
- 나머지 Stage 1~6의 잔여 위험(Issue #125 테스트 operation, Issue #135 Node 24 runner, 수동 rollback,
  외부 SNS/crawler 범위 제외)은 이번 단계에서 변하지 않았다.

## 다음 단계 영향

- 최종 보고서에 리뷰 보완 범위, 미해결 리뷰 2와 갱신된 문서 기준을 반영한다.
- `mydocs/orders/20260902.md`를 완료로 되돌린다.
- 작업지시자 승인 뒤에만 `publish/task144` fast-forward push와 PR #149 본문 갱신을 수행한다.
  merge, 이슈 close와 추가 배포는 승인 범위 밖이다.

## 승인 요청

- Stage 7 문서 보완과 검증 결과를 승인하면 최종 보고 갱신과 PR #149 갱신으로 진행한다.
