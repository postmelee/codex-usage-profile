# Task #108 최종 보고서 — canonical production Site migration과 stage5 테스트 전용 전환

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
마일스톤: M100

## 작업 요약

- 대상 이슈: #108
- 마일스톤: M100
- 단계 수: 6
- 작업 목적: canonical production Site를 별도로 공개하고 기존 Stage5를 owner-only 테스트 환경으로 분리한 뒤, production 기본 CLI·고정 README/revision share 계약과 재사용 가능한 승격 runbook을 검증한다.

새 `https://codex-usage-profile.meleeisdeveloping.chatgpt.site`는 exact `main` source의
public production으로 운영된다. 기존
`https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`는 별도 Site와 durable
state를 사용하는 owner-only 테스트 환경으로 고정했다. production과 Stage5는 source,
schema/migration, logical binding 이름과 검증 절차만 공유하고 Site project, D1/R2 data,
OAuth/secret, session·device token과 access policy를 공유하지 않는다.

CLI `codex-usage-profile@0.1.3`은 별도 `--server` 없이 canonical production을 사용한다.
README Markdown은 submit 전후 고정 share/card URL을 유지하고, 공유 링크 복사와
X·LinkedIn·Threads·Facebook·Reddit target만 새 revision 경로로 갱신된다.

## 변경 파일 목록과 영향 범위

Stage 1–3 source 변경은 checkpoint/release PR #109·#110과 후속 보정 PR에 먼저 통합됐다.
이번 최종 PR은 Stage 4–6의 원격 결과 기록, 최종 runbook·architecture 문서와 작업 산출물을
`devel`에 반영한다.

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `.openai/hosting.json`, `.openai/hosting-targets.json` | production canonical manifest와 production/Stage5 nonsecret target registry를 고정했다. | Sites target 선택과 cross-target 방지 |
| `scripts/materialize-sites-target.mjs`, `scripts/verify-sites-production-artifact.mjs` 및 test | clean exact source, project/origin, repository 밖 archive와 expected project를 fail-closed로 검증한다. | Sites 패키징·배포 preflight |
| `packages/codex-usage-profile-cli/`, `scripts/verify-npm-release.mjs`, `scripts/smoke-npm-package-local.mjs` 및 test | CLI `0.1.3`, canonical default origin, immutable npm artifact 검증을 반영했다. | 공개 npm 사용자 흐름 |
| `src/profile-ui/deviceApproval.js`, 관련 unit/E2E | production 기본 명령과 fixed README/revision share 계약을 고정했다. | Device Approval·Share Studio |
| `README.md`, `packages/codex-usage-profile-cli/README.md`, `docs/cli-submit.md` | canonical production과 공개 CLI 사용법을 사용자 관점으로 정리했다. | 공개 진입 문서·npm README |
| `docs/readme-card.md` | 고정 README href/src와 revision 공유 경계를 canonical hostname 기준으로 기록했다. | README card·SNS 공유 계약 |
| `docs/sites-operations.md` | Local → Stage5 → production 승격, temporary-public, stop/rollback과 #125 handoff runbook을 완성했다. | 운영·차기 release 절차 |
| `docs/production-hosting.md` | dual-Site data/identity 분리, exact-main provenance와 migration 1–6 현재 상태를 반영했다. | production architecture |
| `docs/npm-release.md` | `0.1.3` provenance, integrity와 production clean smoke 결과를 기록했다. | npm release 감사 증적 |
| `mydocs/plans/task_m100_108*.md` | 승인 Gate, Stage5/production handoff와 최종 안전 경계를 기록했다. | 내부 수행·구현 계획 |
| `mydocs/working/task_m100_108_stage*.md` | Stage 1–6 및 하위 Gate의 검증·원격 식별자를 보존했다. | 단계별 감사 증적 |
| `mydocs/report/task_m100_108_report.md`, `mydocs/orders/20260824.md` | 최종 수용 기준과 완료 상태를 기록했다. | Hyper-Waterfall 종료 산출물 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/sites-operations.md` | `docs/` | `docs/` | OK | 반복 가능한 Sites 운영 runbook이라는 계획된 역할과 일치한다. |
| `docs/production-hosting.md` | `docs/` | `docs/` | OK | canonical architecture와 환경 분리 원칙을 기존 공식 문서에서 유지했다. |
| `docs/readme-card.md` | `docs/` | `docs/` | OK | fixed README/revision share 사용자·API 계약을 기존 문서에 반영했다. |
| `docs/cli-submit.md` | `docs/` | `docs/` | OK | 공개 기본 origin과 개발용 explicit override의 상세 설명을 사용자/운영 문서에 유지했다. |
| `packages/codex-usage-profile-cli/README.md` | package 내부 | package 내부 | OK | npm tarball 사용자가 보는 설치·submit 계약과 일치한다. |
| `README.md` | repository root | repository root | OK | #108의 기능적 canonical hostname·CLI 계약만 반영하고 전면 마케팅 copy는 #90에 유지했다. |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | `mydocs/` | `mydocs/` | OK | 승인·단계·최종 증적은 제품 문서가 아닌 내부 작업 산출물로 분리했다. |

신규 공식 문서 루트나 `mydocs/manual`을 만들지 않았고, 수행계획서의 문서 위치 판단과 실제
산출물 위치가 일치한다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| canonical production Site | project 없음 | project `appgprj_6a83ecc3c4c08191bda7f14d7c26c974`, public version 3 |
| production source | 없음 | exact `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd` |
| production artifact | 0 saved version | 27 files, 5,437,440 bytes, `sha256:fb2628…0f47` |
| production D1 migration | 없음 | exact `[1,2,3,4,5,6]`, 13 application tables |
| production access/environment | owner-only undeployed revision 1 / environment revision 0 | public revision 10 / environment revision 4, maintenance disabled·service normal·operator secret absent |
| Stage5 역할 | public version 33 / access revision 59 / environment revision 89 | owner-only version 36 / access revision 62 / environment revision 119 |
| 공개 npm CLI | `latest=0.1.1`, Stage5가 기본 origin | `latest=0.1.3`, canonical production이 기본 origin |
| npm release artifact | `0.1.3` 없음 | 14 files, packed 17,237 bytes, registry integrity·provenance 일치 |
| 최종 unit 회귀 | Stage 2 기준 830 tests, 824 pass, 6 skip | 868 tests, 862 pass, 6 skip, 0 fail |
| 최종 E2E | 101 scenarios | 101/101 pass |
| public release scan | Stage 2 blocker 0 | `ok=true`, blocker 0 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 새 canonical hostname이 public production으로 정상 응답 | OK — production root와 `/healthz`는 200, anonymous auth는 401, 닫힌 operator route는 404다. |
| source, saved version, D1 migration, R2와 access/environment 기록 | OK — version 3, exact source/hash, migration 1–6, `PROFILE_MEDIA`, access revision 10과 environment revision 4를 기록했다. |
| production과 Stage5 project·data·secret·identity 분리 | OK — 서로 다른 Site project·target manifest·empty baseline과 교차 영향 부재를 검증했다. provider physical D1/R2 ID는 도구가 노출하지 않아 추정하지 않았다. |
| OAuth와 새 기본 origin CLI login/submit | OK — production OAuth 재로그인과 clean `@latest=0.1.3` login/status/submit을 별도 `--server` 없이 검증했다. |
| private preview, publish/unpublish, profile, card와 social share | OK — owner-only saved version 검증 뒤 public cutover를 수행했고 profile/media/revision share와 crawler metadata를 확인했다. 외부 SNS 게시물은 만들지 않았다. |
| submit 전후 README Markdown 완전 동일 | OK — unit·E2E와 production 실제 submit에서 byte 단위 동일함을 확인했다. |
| submit 전후 공유 링크와 다섯 SNS target revision 갱신 | OK — E2E 101/101과 production 실측에서 공유 링크 및 X·LinkedIn·Threads·Facebook·Reddit target이 같은 새 revision을 사용했다. |
| Stage5가 production credential·실사용자 data 없는 테스트 전용 상태 | OK — owner-only 별도 project/state를 유지하고 production credential/data를 복제하지 않았다. 기존 synthetic structured operation은 #125 handoff로 보존했다. |
| data disposal은 명시적 Gate 뒤에만 수행 | OK — #108에서는 Stage5 live recovery·삭제를 실행하지 않았고 별도 #125로 분리했다. |
| 재사용 가능한 Local → Stage5 → production runbook | OK — exact commit 승격, saved version/deploy/access 독립 Gate, temporary-public, stop/rollback 순서를 `docs/sites-operations.md`에 고정했다. |
| cutover 실패 rollback 재현 가능 | OK — 직전 approved saved version, access rollback, OAuth/CLI 순서와 migration 이후 stop condition을 실제 version/source 기준으로 기록했다. |
| 별도 결제·자동 과금 없이 완료 | OK — 승인 없는 plan 변경이나 자동 초과 과금을 수행하지 않고 두 Site를 운영 상태로 만들었다. |
| 전체 자동 검증 | OK — unit 868/868(862 pass·6 skip), E2E 101/101, production build, Sites full-stack/artifact, npm release와 public scan이 통과했다. |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_108_stage1.md): Git/npm/Stage5 baseline, capacity 한계와 Gate A1/A2·target packaging 계약을 read-only로 고정했다.
- [Stage 2](../working/task_m100_108_stage2.md): canonical project를 owner-only·undeployed로 생성하고 dual-target guard, CLI origin과 fixed README/revision 계약을 구현·검증했다.
- [Stage 3](../working/task_m100_108_stage3.md): checkpoint PR #109와 release PR #110의 exact tree·CI·Issue 연속성을 검증하고 원격 배포·publish 무변경을 확인했다.
- [Stage 4](../working/task_m100_108_stage4.md): production private→public cutover, CLI `0.1.3` provenance publish와 실제 login/submit/share를 검증했다.
- [Stage 5](../working/task_m100_108_stage5.md): production을 latest exact `main` version 3/migration 1–6으로 맞추고 Stage5 owner-only 불변과 공개 전 비파괴 smoke를 확인했다.
- [Stage 6](../working/task_m100_108_stage6.md): dual-Site runbook과 live 상태를 일치시키고 전체 unit/E2E/build/Sites/npm/public surface를 재검증했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- **승인된 위험 — production account deletion E2E 미실행**: disposable production owner와 별도 파괴적 승인이 없어 공개 `@postmelee`를 삭제하지 않았다. Task #122의 Stage5 live deletion/recovery 검증을 비차단 근거로 사용했으며 production 삭제 성공으로 기록하지 않는다.
- Stage5에는 기존 `structured` deletion operation 1건이 lease 없이 남아 있다. 일반 retention이나 #108에서 삭제하지 않고 #125가 recovery·data disposal을 담당한다.
- X·LinkedIn 등 외부 provider의 최초 이미지 처리 시간은 application이 보장하지 않는다. revision URL과 crawler metadata는 검증했지만 외부 게시물은 만들지 않았다.
- `npm ci` audit가 보고한 기존 dependency 위험은 자동 수정하지 않았다.
- GitHub About homepage는 아직 Stage5이고 default branch는 `devel`이다. #108에서 명시적으로 제외한 #90을 본격 마케팅 시작 전 완료해야 한다.
- 작업지시자 측 untracked `packages/.DS_Store`는 수정·삭제·커밋하지 않았다.

### 후속 작업 후보

- [#90](https://github.com/postmelee/codex-usage-profile/issues/90): GitHub About homepage를 canonical production으로 바꾸고 공개 README·default branch를 마케팅 기준으로 정리한다.
- [#125](https://github.com/postmelee/codex-usage-profile/issues/125): Stage5 기존 deletion operation recovery와 승인된 test data disposal을 독립적으로 수행한다.
- 기존 npm dependency audit finding은 별도 dependency maintenance 범위에서 검토한다.

## 작업지시자 승인 요청

- 작업지시자는 2026-08-24 Stage 6 완료 뒤 최종 보고서 작성과 PR 게시 절차 진행을 명시적으로 승인했다.
- 본 보고서와 오늘할일 완료 처리 commit을 `publish/task108`에 게시하고 `devel` 대상 최종 PR을 생성한다.
- PR merge와 Issue close는 작업지시자가 검토·merge한 뒤 `pr-merge-cleanup` 절차에서 수행한다.
