# Task #134 최종 보고서 — CLI 재인증 복구와 도움말·온보딩 UX 정합성 개선

GitHub Issue: [#134](https://github.com/postmelee/codex-usage-profile/issues/134)
마일스톤: M100

## 작업 요약

- 대상 이슈: #134
- 마일스톤: M100
- 단계 수: 4개 Stage와 승인 후 Stage 3.1 보정
- 작업 목적: 만료·폐기된 파일 credential도 `submit` 한 번으로 재승인과 제출을 마치게 하고 CLI help,
  웹 온보딩과 공개 문서를 같은 사용자 계약으로 정합화한다.

파일 credential의 첫 제출이 HTTP 401/410으로 거절되면 기존 credential을 선제 삭제하지 않고 device
approval을 한 번 진행한 뒤, 분석한 동일 document를 새 credential로 정확히 한 번 다시 제출한다.
환경 변수 credential과 인증 외 오류는 자동 복구에서 제외하고, JSON 실행은 진행 안내를 stderr에만
기록해 stdout의 단일 JSON 계약을 유지했다.

전역 및 `login`, `status`, `submit`, `logout`별 `-h/--help`와 잘못된 입력의 실행 가능한 help 안내를
추가했다. 루트·npm README의 Commands를 동일한 사용자 중심 표로 바꾸고 상세 option과 credential 복구
경계는 `docs/cli-submit.md`에 유지했다. Profile 영어·한국어 빈 상태는 one-command submit 흐름을
설명하며, 기기 승인 완료 뒤에는 불필요한 setup guide를 숨겨 `Home`·`Profile` 후속 링크와 위계를
분리했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `packages/codex-usage-profile-cli/src/cli.js` | file credential 401/410 재인증 1회, 동일 document 재제출, JSON 채널 분리, 전역·명령별 help와 invalid-input hint | CLI submit 복구·탐색성 |
| `packages/codex-usage-profile-cli/test/cli.test.js` | credential source·오류별 복구 상한, 보존·비밀정보 비노출, help·version·무부작용 matrix | CLI 단위·통합 회귀 |
| `src/profile-ui/messages.js` | 영어·한국어 첫 카드 생성 및 one-command submit 안내 | Profile 빈 상태 사용자 경험 |
| `src/profile-ui/DeviceApprovalPage.jsx` | 승인 성공 뒤 setup guide 조건부 제거 | 기기 승인 완료 링크 위계 |
| `tests/profile-ui.spec.js` | EN/KO empty state, 승인 전·후 guide, 기존 layout·동작 회귀 검증 | Profile·device approval E2E |
| `README.md` | 재인증 설명과 6행 사용자 Commands 표 | GitHub 방문 사용자 안내 |
| `packages/codex-usage-profile-cli/README.md` | 루트 README와 같은 Commands 표·순서 | npm package 사용자 안내 |
| `docs/cli-submit.md` | command help, 고급 option, file/environment credential 복구와 JSON 채널 상세 | CLI 상세 사용자 문서 |
| `mydocs/plans/task_m100_134*.md` | 승인된 범위, 상태 계약, 단계별 구현·검증 계획 | 작업 추적·후속 유지보수 |
| `mydocs/working/task_m100_134_stage{1..4}.md` | 단계별 구현·검증·잔여 위험 기록 | 단계 승인 근거 |
| `mydocs/orders/20260825.md` | Task #134 완료 상태 기록 | 오늘할일 보드 |

서버 API, device login API, credential schema, npm package version, hosting manifest와 production 데이터는
변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| GitHub 사용자 안내 | `README.md` | `README.md` | OK | 프로젝트 첫 진입점의 Quick start·Commands 계약을 기존 공식 위치에서 국소 보정 |
| npm 사용자 안내 | `packages/codex-usage-profile-cli/README.md` | `packages/codex-usage-profile-cli/README.md` | OK | npm 게시 산출물의 CLI 전용 안내 위치 유지 |
| CLI 상세 안내 | `docs/cli-submit.md` | `docs/cli-submit.md` | OK | 고급 option·credential source·복구 경계를 공식 `docs/`에 유지 |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_134.md`, `task_m100_134_impl.md` | OK | 제품 문서가 아닌 승인·구현 의사결정 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_134_stage{1..4}.md` | OK | 각 Stage source와 함께 commit |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_134_report.md` | OK | 모든 Stage 승인·통합 검증 뒤 장기 보관 위치에 작성 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 만료·폐기된 file credential의 사용자 명령 횟수 | `submit` 실패 뒤 `login`과 `submit` 수동 재실행 필요 | 최초 `submit` 안에서 login 최대 1회·submit 최대 2회로 완료 |
| 동일 submit 중 analyzer 실행 | 재인증 경로 없음 | 최초·재시도에 같은 document 사용, analyzer 1회 |
| 명령별 help 표면 | 전역 help만 반환 | 전역 + 4개 command별 `-h/--help` |
| 공개 Commands 안내 | 두 README의 코드 블록 중심 안내 | 두 README에 동일한 6행 명령·동작 표 |
| 승인 성공 뒤 setup guide 노출 | 1개 | 0개, `Home`·`Profile` 링크는 유지 |
| CLI 집중 auth test | 기존 정상·오류 계약 | Stage 1 기준 30/30 pass |
| CLI help/parser test | 전역 중심 | Stage 2·3 기준 25/25 pass |
| 전체 Node 계약 | 변경 전 기준선 | 876건 판정: 870 pass, 환경 조건부 6 skip, fail/cancel 0 |
| 전체 브라우저 E2E | 변경 전 기준선 | 103/103 pass |
| local npm package smoke | 변경 전 기준선 | 6/6 경계 통과, 14 entries, packed 17,614 bytes |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| credential이 없는 `submit`은 기존처럼 approval 뒤 제출을 계속한다 | OK — JSON·human 기존 경로와 package smoke 통과 |
| 만료·폐기된 file credential은 추가 사용자 명령 없이 재승인 후 한 번 재제출한다 | OK — 401/410 각각 login 1회, submit 총 2회 상한 검증 |
| 재인증 실패 시 기존 credential을 보존하고 무한 재시도하지 않는다 | OK — submit 1회에서 종료, 기존 token·record/device metadata 유지 |
| environment credential과 인증 외 오류는 file credential을 변경하지 않는다 | OK — environment 401은 login·mutation 0회와 unset 안내, 409는 기존 오류 유지 |
| JSON stdout은 최종 JSON 하나이고 민감정보가 노출되지 않는다 | OK — approval 안내는 stderr, stdout 단일 parse와 token·owner·raw 오류 비노출 검증 |
| 전역·명령별 help가 실제 option과 일치하고 잘못된 입력을 안내한다 | OK — 4개 command × 2개 alias와 invalid-input matrix 통과 |
| help/version은 credential·network·analyzer side effect를 만들지 않는다 | OK — 관련 호출 0회 검증 |
| 루트·npm README Commands 표와 상세 문서가 구현 계약과 일치한다 | OK — 두 표의 명칭·순서 일치, 공개 README의 `--server` 비노출 확인 |
| 웹 빈 상태의 EN/KO 문구가 one-command submit 계약과 일치한다 | OK — runtime locale 전환과 동일 command E2E 통과 |
| 승인 완료 링크 위계가 분리된다 | OK — guide는 승인 전 1개·후 0개, `Home`·`Profile` 유지 |
| package·전체 UI·Sites artifact가 회귀하지 않는다 | OK — Node 876건, Playwright 103건, npm smoke, Sites build/verifier 통과 |
| 제외 범위가 변경되지 않는다 | OK — backend, credential schema, package version, hosting manifest task diff 0 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_134_stage1.md): file 401/410 재인증, bounded retry, credential 보존과
  JSON 채널을 CLI test 30건으로 검증했다.
- [Stage 2](../working/task_m100_134_stage2.md): 전역·4개 command help, version, invalid input와
  side-effect 0회를 CLI test 25건으로 검증했다.
- [Stage 3](../working/task_m100_134_stage3.md): EN/KO Profile copy, README·CLI 문서 정합성과 승인 전·후
  setup guide 위계를 관련 E2E 11건 및 문서 대조로 검증했다. 승인 후 Stage 3.1에서 guide를 승인 완료
  상태에서 제거하는 보정을 반영했다.
- [Stage 4](../working/task_m100_134_stage4.md): 전체 Node 876건, Playwright 103건, local npm package,
  Sites build·verifier와 제외 path를 통합 검증했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 로컬 Node 24에서는 기존 real-workerd D1 6개 test 파일의 장시간 정지가 재현된다. 변경 영역의 실패는
  아니며, Node 24 비-D1 840건과 지원 대상 Node 22 D1 36건으로 전체 876건을 누락 없이 판정했다.
- npm publish와 production deploy는 승인된 이번 task 제외 범위이므로 실행하지 않았다. 게시·배포가
  필요한 경우 package version과 배포 source를 별도 release gate에서 다시 확인해야 한다.

### 후속 작업 후보

- Node 24 real-workerd D1 test runner 정지 원인을 별도 호환성 이슈로 추적할 수 있다.
- 이번 PR merge 뒤 실제 npm 게시·production 반영이 필요한 릴리스 작업에서 one-command submit과
  사용자 안내를 운영 환경으로 최종 smoke한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 `publish/task134` 브랜치와 `devel` 대상 PR을
  검토·merge한다.
