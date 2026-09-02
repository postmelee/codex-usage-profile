# Task #144 최종 보고서 — 통합 릴리스와 production Sites 배포

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
마일스톤: M100

## 작업 요약

- 대상 이슈: #144
- 마일스톤: M100
- 단계 수: 6개 Stage와 replacement 보정 게이트 2개(Stage 2.1, 2.2)
- 작업 목적: #137·#141·#39와 후속 #146을 exact main으로 재승격하고, owner-only Stage5 검증 뒤
  canonical production에 안전하게 배포해 라이트 social 경계와 브라우저 GIF 기능을 공개한다.

초기 후보는 PR #140·#142·#143을 포함해 release PR #145로 main에 승격했다. Stage5 시각 검증에서
라이트 카드 Border Beam 가독성 문제를 발견해 배포를 중단하고, Task #146/PR #147 보정만 추가한
replacement candidate를 전체 재인증했다. release PR #148로 새 exact main을 확정한 뒤 Stage5 version 40,
production version 6 순으로 같은 source를 배포했다. npm `0.1.4`는 기존 immutable release를 유지하고
재게시하지 않았다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `mydocs/plans/task_m100_144.md` | exact source, 승인 Gate, target 분리와 rollback을 정의한 수행계획 | Task #144 작업 범위와 승인 기준 |
| `mydocs/plans/task_m100_144_impl.md` | Stage 1~6 및 replacement 2.1·2.2 실행·검증 절차 | 릴리스 실행과 검증 재현성 |
| `mydocs/working/task_m100_144_stage*.md` | 각 Stage의 source, 원격 상태, 검증, 안전 복원 결과 | 단계별 감사·인계 기록 |
| `docs/production-hosting.md` | production version 6/source/environment와 hosted smoke·rollback 기준 반영 | 공식 production architecture·live baseline |
| `docs/sites-operations.md` | current production/stage5 이력과 edge convergence Gate 보강 | 후속 Sites 배포 runbook |
| `mydocs/orders/20260828.md`, `mydocs/orders/20260901.md`, `mydocs/orders/20260902.md` | 날짜별 Stage 진행과 완료 상태 | 하이퍼-워터폴 오늘할일 보드 |
| `mydocs/report/task_m100_144_report.md` | 전체 결과, 수용 기준과 후속 위험 정리 | 최종 검토와 PR 인계 |

Task #144 branch에서 제품 source, migration, package version, lockfile, hosting manifest는 수정하지 않았다.
제품 변경은 선행 PR #140·#142·#143·#147에서 완료됐고, 이 task는 검증된 source의 release·배포와 운영
문서 정합화만 수행했다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| production architecture·live 이력 | `docs/production-hosting.md` | `docs/production-hosting.md` | OK | 수행계획의 Stage 6 범위대로 current source/version/access/environment/migration과 rollback만 최소 갱신했다. |
| Sites 운영 runbook | `docs/sites-operations.md` | `docs/sites-operations.md` | OK | terminal deployment와 edge 수렴 사이의 실제 contract drift를 bounded convergence Gate로 최소 보정했다. |
| npm 릴리스 기록 | 변경 없음 | 변경 없음 | OK | `0.1.4`를 재게시하지 않아 compatibility 증적만 단계·최종 보고서에 기록했다. |
| 카드·social·GIF 사용자 계약 | 변경 없음 | 변경 없음 | OK | 선행 기능 PR이 이미 반영한 계약을 배포 task에서 중복 편집하지 않았다. |
| 계획·단계·최종 보고 | `mydocs/` | `mydocs/plans`, `mydocs/working`, `mydocs/report` | OK | 승인 Gate와 원격 증적을 공식 제품 문서와 분리했다. |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| canonical main/source | `27e8705...` production 기준 | `6d3e600d2d33bb7a50147075d013ddd9b945d0b1` exact main |
| production saved version | version 5 / source `27e8705...` | version 6 / source `6d3e600...` |
| production environment | Stage 4 preflight revision 12 | revision 14, maintenance disabled·service normal·operator secret absent |
| Stage5 saved version | version 39 / source `0af8439...` | version 40 / source `6d3e600...`, owner-only 유지 |
| D1 migration | `[1,2,3,4,5,6]` | `[1,2,3,4,5,6]`, 신규 적용 0·drift 0 |
| light/dark social | production에 신규 light surface 계약 미반영 | 두 테마 `2400×1260`, 같은 card geometry; light `#F3F5F7`/`#D0D7DE` |
| light/dark GIF motion | production에 browser GIF와 light 대비 보정 미반영 | 두 테마 `998×612`, 20 fps, 96 frames, 4.8초의 같은 motion·geometry |
| 최종 exact-main Node 회귀 | 배포 전 미판정 | 929 tests: 923 pass, 6 skip, assertion failure 0 |
| 최종 Playwright E2E | 배포 전 미판정 | 110/110 pass |
| public release scan | 배포 전 미판정 | blocker 0, 기존 review 73 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| exact source와 main 승격 | OK — replacement candidate와 PR #148 merged main의 tree가 정확히 같고 Node 20/22/24 check가 모두 성공했다. |
| target 분리와 artifact provenance | OK — production/stage5는 project·origin·durable state를 분리하고 같은 exact source, Worker/client, migration 1–6을 사용한다. |
| Stage5 owner-only 검증 | OK — version 40, owner-only access, migration/readiness, CLI/Profile/card/social/GIF와 safe environment 복원을 통과했다. |
| production public 배포 | OK — 명시 승인 아래 version 6을 배포하고 environment revision 14, health `200`, operator `404`, migration 1–6으로 복원했다. |
| 데이터·접근 보존 | OK — public access를 유지했고 production account deletion operation은 0건, profile은 원래 `public + dark/en`, API token은 `1/3`으로 복원했다. |
| 라이트/다크 geometry와 animation | OK — card `1497×918`, social `2400×1260`, GIF `998×612`에서 motion·geometry는 같고 light 대비 색만 분리됐다. |
| 기존 사용자 경로 무회귀 | OK — CLI `0.1.4`, OAuth/Profile, README card, fixed/revision share, GET/HEAD/304, PNG save와 publish/private/public 복구를 통과했다. |
| 전체 자동 회귀 | OK — focused renderer 34/34, GIF·Share Studio 54/54, Node 923 pass·6 skip, Playwright 110/110, production build와 Sites/npm verifier 통과다. |
| 릴리스·운영 보안 | OK — npm 재게시 0건, public scan blocker 0, 최근 production/stage5 실패 outcome·error-level·5xx 0이며 secret 값·개인 data·임시 경로를 문서에 기록하지 않았다. |
| rollback·운영 인계 | OK — production version 5, Stage5 version 39를 application rollback 후보로 기록하고 edge convergence Gate를 공식 runbook에 반영했다. |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_144_stage1.md): 초기 candidate 고정, 전체 local certification과 target archive dry-run을 통과했다.
- [Stage 2](../working/task_m100_144_stage2.md): PR #145로 초기 후보를 main에 승격하고 candidate/main tree equality를 확인했다.
- [Stage 2.1](../working/task_m100_144_stage2_1.md): Task #146 replacement candidate의 focused·전체 회귀와 artifact를 재인증했다.
- [Stage 2.2](../working/task_m100_144_stage2_2.md): PR #148로 replacement를 main에 재승격하고 exact tree와 CI를 확인했다.
- [Stage 3](../working/task_m100_144_stage3.md): exact main을 Stage5 version 40으로 owner-only 배포하고 synthetic 전체 흐름을 검증했다.
- [Stage 4](../working/task_m100_144_stage4.md): production version 6을 저장하고 version 5 rollback과 live 미변경을 확인했다.
- [Stage 5](../working/task_m100_144_stage5.md): public production 배포, safe environment 복원과 비파괴 hosted smoke를 완료했다.
- [Stage 6](../working/task_m100_144_stage6.md): GitHub/Sites/npm provenance, 전체 exact-main 회귀와 공식 운영 인계를 완료했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- Issue #125의 Stage5 structured·lease expired 테스트 operation 1건은 여전히 남아 있다. production
  blocker는 아니며 Task #144에서 변경하지 않았다.
- Node 24 단일 runner는 Issue #135의 real-workerd `d1-concurrency` 진입에서 정지한다. non-real-workerd는
  Node 24, real-workerd 54개는 지원 Node 22로 분리해 전체 assertion을 통과했다.
- application rollback은 자동 수행하지 않았다. 실제 장애 시 active operation, environment, migration
  compatibility와 exact saved version을 다시 읽고 별도 승인을 받아야 한다.
- 외부 SNS 게시와 crawler cache purge는 범위 밖이다. application metadata·media와 provider 작성 화면
  직전까지만 검증했으며 외부 preview 반영 시간은 보장하지 않는다.

### 후속 작업 후보

- [Issue #125](https://github.com/postmelee/codex-usage-profile/issues/125)에서 Stage5 테스트 operation 복구·정리를 별도 승인으로 완료한다.
- [Issue #135](https://github.com/postmelee/codex-usage-profile/issues/135)에서 Node 24 real-workerd runner 정지 원인을 해결한다.

## 작업지시자 승인 요청

- 작업지시자의 2026-09-02 동일 스레드 `진행해줘` 지시에 따라 최종 보고서 커밋과 PR 게시까지 진행한다.
- PR의 리뷰 결과 확인과 merge는 별도 작업지시자 승인 뒤 진행한다.
