# Task #84 최종 보고서 — exact-main release, Gate C와 migration handoff

GitHub Issue: [#84](https://github.com/postmelee/codex-usage-profile/issues/84)
마일스톤: M100

## 작업 요약

- 대상 이슈: #84
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: 검증된 `devel` candidate를 exact `main` release와 Sites public Gate C로
  승격하고, 후속 validation drift를 보존한 채 새 canonical production migration
  handoff를 확정한다.

Stage 1에서 exact candidate와 artifact를 검증하고, Stage 2에서 `devel → main`
release PR의 merge provenance와 tree equality를 고정했다. Stage 3은 merged main을
saved version 24로 owner-only 배포해 OAuth·CLI·D1·R2·card·share 계약을 보호된
상태에서 검증했다. 별도 Gate C 승인 뒤 Stage 4에서 public access revision 57로
전환하고 privacy, media/cache와 SNS preview를 실측했다. Stage 5는 이후 #100·#101이
확정한 fixed README/revision share 계약과 live version 33 상태를 read-only로 대조해
Task #84의 release 이력을 종료하고 별도 migration 범위를 문서화했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `mydocs/plans/task_m100_84.md` | release, owner-only, Gate C, Stage 5 재기준화 수행계획 | 작업 승인·범위 |
| `mydocs/plans/task_m100_84_impl.md` | 5개 Stage 실행·검증·중단·mutation matrix | 구현·운영 절차 |
| `mydocs/working/task_m100_84_stage1.md` | exact candidate·CI·artifact preflight 증적 | release gate |
| `mydocs/working/task_m100_84_stage2.md` | release PR #88 merge SHA·parent·tree provenance | `main` release 이력 |
| `mydocs/working/task_m100_84_stage3.md` | exact-main version 24 owner-only 배포와 protected smoke | Sites candidate |
| `mydocs/working/task_m100_84_stage4.md` | Gate C public cutover와 X·Threads·카카오 실측 | public 운영 이력 |
| `mydocs/working/task_m100_84_stage5.md` | version 33 live audit, 전체 회귀와 migration handoff | 종료 검증 |
| `docs/sites-operations.md` | version 24 Gate C와 version 33 validation 시간축·rollback 경계 | 운영자 |
| `docs/production-hosting.md` | exact-main release provenance와 후속 production migration 경계 | 아키텍처·운영 |
| `docs/readme-card.md` | fixed README와 revision share target 최종 계약 | 사용자·운영자 |
| `mydocs/orders/20260812.md`, `mydocs/orders/20260818.md` | 단계 진행과 완료 시각 | 일일 작업 보드 |
| `mydocs/report/task_m100_84_report.md` | 전체 결과와 후속 migration 입력 | 장기 작업 기록 |

제품 source, `README.md`, database migration, test/build script는 Task #84 최종 PR에서
변경하지 않는다. Sites 원격 mutation은 승인된 Stage 3 version 24 owner-only 배포와
Stage 4 public cutover에 한정했고, Stage 5와 최종 보고 절차에서는 배포하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| Sites current state·rollback | `docs/` | `docs/sites-operations.md` | OK | version 24 Gate C와 version 33 live validation을 분리 기록 |
| exact-main production provenance | `docs/` | `docs/production-hosting.md` | OK | main merge/source·saved version·migration handoff 기록 |
| README card·share 계약 | `docs/` | `docs/readme-card.md` | OK | fixed href/src와 revision share target 보존 |
| 단계 증적 | `mydocs/working/` | `task_m100_84_stage1.md`~`stage5.md` | OK | Stage별 승인·검증·잔여 위험 기록 |
| 최종 결과 | `mydocs/report/` | `task_m100_84_report.md` | OK | 중앙 final report template 준수 |
| `README.md`·marketing | 변경하지 않음 | 변경 없음 | OK | placeholder·marketing 정합화는 후속 범위 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| `main` release | `e75609db133ae43e9a36d7cc9994c813bcaa621c` | merge `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`, candidate와 tree exact-match |
| Task #84 Sites saved version | 23 / `c030339d848f961c54358d9d3523b340bed09670` | Gate C 24 / exact main `0c804733…`; 종료 시 후속 validation 33 / `53a7132…` |
| access | custom owner-only revision 56 | Gate C public revision 57; 종료 read-only snapshot public revision 59 |
| environment | revision 85 | Task #84 safe baseline 87; 종료 read-only snapshot revision 89 |
| D1 readiness | migration `1..5` 후보 | live exact `[1,2,3,4,5]`, missing/unexpected 0 |
| Node 전체 회귀 | Stage 1 727 tests, 721 pass, 6 skip | 최종 통합 825 tests, 819 pass, 6 skip, 0 fail |
| Playwright 전체 회귀 | Stage 1 75/75 | 최종 통합 101/101 |
| production artifact | Stage 1 5,120,248 bytes | 최종 5,152,090 bytes, migration 5, bindings 3, verifier 2종 통과 |
| 외부 게시·메시지 | 0 | 0 — preview/composer/debugger까지만 확인 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| exact candidate release provenance | OK — candidate CI success, PR #88 merge commit parent와 tree equality 확인 |
| exact-main owner-only 후보 | OK — version 24/source exact main, access 56, environment 87, health/readiness·OAuth·CLI·profile·media 통과 |
| 별도 Gate C public 전환 | OK — 승인 뒤 access 57 public, privacy·non-enumeration·card/social/cache matrix와 rollback 경계 통과 |
| 플랫폼 preview | OK — X·Threads 작성 화면과 카카오 debugger에서 게시 없이 metadata·image 확인 |
| fixed README/revision share 보존 | OK — README href/src 고정, 공유 링크·다섯 SNS만 revision path를 사용하는 #100·#101 계약 보존 |
| live drift audit | OK — version 33/access 59/environment 89, health `200`, operator `404`, D1 exact `[1,2,3,4,5]` read-only 확인 |
| 전체 회귀와 artifact | OK — Node 825, E2E 101, production build, full-stack/production verifier 모두 통과 |
| 비밀·데이터·범위 보호 | OK — secret/identity/usage payload 비기록, Stage 5와 최종 검증 remote mutation 0건, 제품 source diff 없음 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_84_stage1.md): exact candidate 419 commits,
  671-file diff, CI success, Node 727·E2E 75와 safe artifact 검증.
- [Stage 2](../working/task_m100_84_stage2.md): release PR #88 merge commit, candidate
  ancestry와 tree exact-match, tag·Release·npm publish·Sites mutation 부재 확인.
- [Stage 3](../working/task_m100_84_stage3.md): merged main version 24 owner-only 배포,
  D1 readiness, OAuth·CLI·profile·card/social와 safe baseline 복원.
- [Stage 4](../working/task_m100_84_stage4.md): public Gate C, privacy·media/cache matrix,
  X·Threads·카카오 preview와 disposable credential cleanup.
- [Stage 5](../working/task_m100_84_stage5.md): version 24 release와 version 33
  validation 시간축 분리, 전체 회귀와 migration handoff, remote mutation 0건.

## 잔여 위험과 후속 작업

### 잔여 위험

- X·LinkedIn·Threads 등 외부 provider의 crawler/image 처리 시간은 통제할 수 없다.
  revision URL은 cache identity를 분리하지만 즉시 표시 SLA나 과거 snapshot을
  제공하지 않는다.
- 현재 stage5 Site description에는 과거 owner-only nonproduction 문구가 남아 있고
  test 계정·데이터가 유지된다. 실제 access는 public revision 59이며 metadata 문구만
  보고 live 상태를 판단하면 안 된다.
- `TEST_DATABASE_URL`이 없는 환경에서 PostgreSQL fallback 통합 테스트 6개는
  계획대로 skip됐다. canonical Sites D1과 두 production artifact verifier는 통과했다.
- main release 전용 CI·branch protection·tag 정책 위험은 #89, README·repository
  metadata 정합화는 #90의 후속 범위다.

### 후속 작업 후보

- 새 `codex-usage-profile.meleeisdeveloping.chatgpt.site`를 canonical production으로
  승격하고 현재 stage5를 테스트 전용으로 전환하는 migration Issue를 등록한다.
- migration 계획은 hostname만 바꾸지 않고 project/D1/R2 보존·폐기, OAuth callback,
  CLI 기본 origin, test account/session/data cleanup, version 32 rollback과 fixed
  README/revision share 계약을 함께 다룬다.
- #89의 main CI/branch protection과 #90의 README·metadata 현행화를 별도 진행한다.

## 작업지시자 승인 요청

- Stage 1~5와 최종 통합 검증 승인 지시를 반영해 `publish/task84 → devel` PR을
  게시한다. PR review 뒤 merge를 승인해 주세요.
