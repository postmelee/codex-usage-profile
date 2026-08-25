# Task #137 최종 보고서 — npm 0.1.4 및 exact-main production 릴리스

GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
마일스톤: M100

## 작업 요약

- 대상 이슈: #137
- 마일스톤: M100
- 단계 수: 6
- 작업 목적: Task #134의 CLI 재인증·도움말·온보딩 개선을 immutable npm `0.1.4`로 게시하고,
  동일한 exact main을 owner-only Stage5와 public production에 안전하게 배포한다.

Stage 1에서 package version과 exact fixture만 `0.1.4`로 올려 전체 local certification을 통과했다.
checkpoint와 release PR로 exact main `27e8705fdc152534a4e4b726cac32f625a3c7763`을 먼저 고정한 뒤,
Stage5 owner-only 검증, annotated tag와 trusted npm publish, production maintenance/migration Gate 순으로
진행했다. 최종 npm artifact, Stage5 version 38과 production version 5는 모두 같은 source를 가리킨다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `packages/codex-usage-profile-cli/package.json`, `package-lock.json` | package와 workspace lock version을 `0.1.4`로 고정 | npm immutable patch |
| `packages/codex-usage-profile-cli/src/cli.js`, `test/cli.test.js` | executable version 상수·fixture 정합화 | CLI version 출력 |
| `scripts/verify-npm-release.mjs`, `scripts/__tests__/verify-npm-release.test.js`, `scripts/__tests__/smoke-npm-package-local.test.js` | exact candidate·tarball·격리 실행 기대값 정합화 | release 검증 자동화 |
| `packages/codex-usage-profile-cli/README.md`, `docs/cli-submit.md` | exact automation pin을 `@0.1.4`로 갱신 | npm·상세 CLI 문서 |
| `docs/npm-release.md` | tag, Actions run, integrity, provenance와 production 완료 이력 | npm 운영 runbook |
| `docs/production-hosting.md` | production version 5와 Stage5 version 38의 current source·artifact·environment·migration 이력 | Sites 운영 architecture |
| `mydocs/plans/task_m100_137*.md` | exact-main 선고정과 6 Stage release Gate | 작업 승인·운영 계획 |
| `mydocs/working/task_m100_137_stage{1..6}.md` | 단계별 local/remote 검증과 복원 결과 | 단계 승인 근거 |
| `mydocs/orders/20260825.md` | Task #137 완료 기록 | 오늘할일 보드 |

backend/API, credential schema, D1 SQL, hosting manifest, target registry와 Task #134 제품 UX source는
변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| npm runbook·release 이력 | `docs/` | `docs/npm-release.md` | OK | 기존 공식 npm 운영 문서의 current release만 실측값으로 갱신 |
| production architecture·이력 | `docs/` | `docs/production-hosting.md` | OK | 기존 canonical hosting 문서에 exact version·source·상태를 기록 |
| npm 사용자 안내 | package root | `packages/codex-usage-profile-cli/README.md` | OK | 게시 tarball의 기존 사용자 문서 위치 유지 |
| CLI 상세 안내 | `docs/` | `docs/cli-submit.md` | OK | exact automation 예제만 기존 상세 문서에서 정합화 |
| 단계·최종 보고 | `mydocs/` | `mydocs/working/task_m100_137_stage{1..6}.md`, `mydocs/report/task_m100_137_report.md` | OK | 제품 문서와 승인·증적 기록을 분리 |

`docs/sites-operations.md`는 계약 drift가 없어 수정하지 않았고 신규 공식 문서 파일도 만들지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| npm latest | `0.1.3` | `0.1.4` |
| npm package | 14 files, packed 17,237 bytes | 14 files, packed 17,614 bytes |
| Stage5 saved version | 37 / previous main | 38 / exact main `27e8705` |
| Stage5 access | custom owner-only revision 62 | 동일 |
| production saved version | 4 / source `61f72fc` | 5 / exact main `27e8705` |
| production access | public revision 10 | 동일 |
| production environment | revision 6, maintenance disabled | revision 8, maintenance disabled·token absent |
| migration | `[1,2,3,4,5,6]` | 동일 exact readiness |
| 전체 Node 계약 | release 전 baseline | 876건 판정: 870 pass·6 skip·fail/cancel 0 |
| 전체 브라우저 E2E | release 전 baseline | 103/103 pass |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| `0.1.4` source tree가 승인된 Task #134 결과와 version 외 동일하다 | OK — backend/API/schema/manifest diff 0, version·exact fixture만 변경 |
| checkpoint·release PR 뒤 exact main tree가 승인 후보와 같다 | OK — PR #138·#139 merge와 tree equality 확인 |
| Stage5는 owner-only 상태에서 exact main과 migration 1–6을 검증한다 | OK — version 38, access revision 62, env 121, private smoke와 원상복구 통과 |
| npm tag·artifact·provenance가 exact main과 일치한다 | OK — annotated tag, Actions run 32864371385, registry SHA-1/SHA-512와 SLSA source 일치 |
| `latest` 사용자는 production 기본 origin의 `0.1.4`를 받는다 | OK — exact/latest clean npx version/help/status와 registry dist-tag 검증 |
| production은 public access를 유지하며 exact main을 실행한다 | OK — saved version 5, public revision 10, source/archive provenance 일치 |
| migration 중 write를 maintenance로 닫고 안전하게 복원한다 | OK — env 7 on 배포·readiness 뒤 env 8 off 재배포, token absent |
| stale credential도 같은 submit process에서 재승인·제출을 완료한다 | OK — public `@latest`에서 revoked credential 감지, 재승인 뒤 Contract v1 accepted |
| 기기 승인 완료 화면이 standalone login과 submit continuation을 구분한다 | OK — submit 명령 또는 터미널 복귀를 주 행동으로 표시, Home/Profile은 보조 링크 |
| 전체 package·Node·E2E·Sites artifact가 회귀하지 않는다 | OK — CLI 78, Node 876, E2E 103, npm smoke, Sites verifier 모두 통과 |
| 최종 운영 상태와 문서가 일치한다 | OK — npm/Stage5/production/migration read-only 교차 대조와 문서 current 값 정합화 |
| 검증 자격 증명과 임시 artifact가 남지 않는다 | OK — 검증 token revoke, local logout, temporary worktree/archive 정리; immutable tag/saved version만 보존 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_137_stage1.md): `0.1.4` version-only source와 package·Node·E2E·Sites
  local certification을 완료했다.
- [Stage 2](../working/task_m100_137_stage2.md): checkpoint PR #138과 release PR #139를 merge해
  candidate·devel·main tree equality와 exact source를 고정했다.
- [Stage 3](../working/task_m100_137_stage3.md): Stage5 version 38을 owner-only로 배포하고 migration,
  CLI·private/public·README/share 계약을 검증한 뒤 private baseline을 복원했다.
- [Stage 4](../working/task_m100_137_stage4.md): tag·trusted publisher·2FA로 npm `0.1.4`를 게시하고
  integrity·SLSA provenance·clean npx를 검증했다.
- [Stage 5](../working/task_m100_137_stage5.md): production version 5를 maintenance Gate로 배포하고
  stale credential 재인증, submit continuation과 승인 완료 링크 위계를 최소 live smoke했다.
- [Stage 6](../working/task_m100_137_stage6.md): registry·Sites·main provenance와 최종 상태를 read-only로
  재대조하고 전체 회귀와 공식 운영 문서를 닫았다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 로그인된 완전 신규 production owner의 미제출 Home은 데이터 삭제 없이 local EN/KO E2E로 판정했다.
  production stale credential와 same-process submit은 실제 통과해 공개 차단 위험으로 보지 않는다.
- Node 24 real-workerd D1 정지 #135는 남아 있다. Node 24 비-D1 840건과 지원 Node 22 D1 36건으로
  release 전체 계약을 판정했다.
- production rollback 후보 version 4는 보존하지만 migration 6의 active structured operation이 있으면
  임의 rollback하지 않는다.

### 후속 작업 후보

- #135에서 Node 24 real-workerd D1 test runner 정지를 별도로 조사한다.
- 운영 관찰 중 실제 사용자 오류나 provider beta 정책·한도 drift가 나타날 때만 별도 issue로 대응한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 `publish/task137`의 `devel` 대상 최종 PR을
  검토·merge한다. npm `0.1.4`와 production version 5는 이미 공개 운영 상태다.
