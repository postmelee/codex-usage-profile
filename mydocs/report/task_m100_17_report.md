# Task M100 #17 최종 보고서

GitHub Issue: [#17](https://github.com/postmelee/codex-usage-profile/issues/17)
마일스톤: M100

## 작업 요약

- 대상 이슈: #17
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: 로컬 CLI가 웹 계정과 device-code 방식으로 연결될 수 있도록 backend API, 최소 승인 UI, 보안 회귀 테스트를 구현한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-backend/cli-login.js` | raw device code를 발급하되 digest만 저장하고, user code approval 및 device poll exchange 흐름 추가 | CLI login domain model |
| `src/profile-backend/store.js` | device code digest와 user code lookup index 추가 | backend in-memory/durable store contract |
| `src/profile-backend/http.js` | `POST /api/auth/device`, `/authorize`, `/poll` route와 serializer 추가 | HTTP API |
| `src/profile-api/client.js` | device authorize client method 추가 | frontend API client |
| `src/profile-ui/DeviceApprovalPage.jsx` | `/device` 최소 승인 화면 추가 | device approval UI |
| `src/App.jsx` | `/device` 최상위 route 분기 추가 | frontend routing |
| `src/styles.css` | device approval page 스타일 추가 | frontend presentation |
| `src/profile-backend/__tests__/cli-login.test.js` | device login domain behavior 검증 추가 | backend domain regression |
| `src/profile-backend/__tests__/store.test.js` | device/user code index 검증 추가 | store regression |
| `src/profile-backend/__tests__/http.test.js` | device start/authorize/poll route 검증 추가 | HTTP regression |
| `src/profile-backend/__tests__/security.test.js` | raw secret 노출 범위와 device edge case 보안 테스트 추가 | security regression |
| `src/profile-api/__tests__/client.test.js` | frontend authorize client 검증 추가 | frontend API regression |
| `mydocs/plans/task_m100_17.md` | 수행계획서 추가 | 작업 계획 기록 |
| `mydocs/plans/task_m100_17_impl.md` | 4단계 구현계획서 추가 | 단계 실행 기준 |
| `mydocs/working/task_m100_17_stage1.md` | Stage 1 보고서 추가 | 단계 기록 |
| `mydocs/working/task_m100_17_stage2.md` | Stage 2 보고서 추가 | 단계 기록 |
| `mydocs/working/task_m100_17_stage3.md` | Stage 3 보고서 추가 | 단계 기록 |
| `mydocs/working/task_m100_17_stage4.md` | Stage 4 보고서 추가 | 단계 기록 |
| `mydocs/orders/20260614.md` | #17 완료 상태 기록 | 오늘할일 보드 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_17.md` | `mydocs/plans/` | `mydocs/plans/task_m100_17.md` | OK | 수행계획서 위치와 일치 |
| `mydocs/plans/task_m100_17_impl.md` | `mydocs/plans/` | `mydocs/plans/task_m100_17_impl.md` | OK | 구현계획서 위치와 일치 |
| `mydocs/working/task_m100_17_stage{1..4}.md` | `mydocs/working/` | `mydocs/working/task_m100_17_stage{1..4}.md` | OK | 단계 보고서 위치와 일치 |
| `mydocs/report/task_m100_17_report.md` | `mydocs/report/` | `mydocs/report/task_m100_17_report.md` | OK | 최종 보고서 위치와 일치 |
| 공식 제품/API 문서 | 해당 없음 | 해당 없음 | OK | 이번 task는 API 구현과 내부 작업 기록만 포함하고, 사용자-facing CLI 문서는 #5 범위로 남김 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| device-code auth API route | 없음 | 3개 route 추가 |
| device approval UI route | 없음 | `/device` route 추가 |
| 전체 테스트 수 | 144개 | 146개 |
| 최종 branch diff | 해당 없음 | 21 files changed, 1755 insertions, 20 deletions |
| 단계 커밋 수 | 0 | 6개 stage/계획 커밋 + 최종 보고 커밋 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| CLI가 device login을 시작할 수 있는 HTTP API가 있다. | OK — `POST /api/auth/device`가 `deviceCode`, `userCode`, `verificationUriComplete`, `intervalSeconds`를 반환한다. |
| 브라우저 session 사용자가 user code를 승인할 수 있다. | OK — `POST /api/auth/device/authorize`가 session owner 기준으로 challenge를 승인한다. |
| CLI가 poll로 token을 1회만 수령할 수 있다. | OK — approved poll은 raw CLI token을 반환하고, 이후 poll은 `exchanged` 상태만 반환한다. |
| raw token/digest가 불필요하게 노출되지 않는다. | OK — serializer와 security test에서 `deviceCodeDigest`, `tokenDigest`, reused token 노출 방지를 검증했다. |
| 최소 승인 UI가 있다. | OK — `/device?user_code=...` 화면에서 user code prefill, login redirect, approve action을 제공한다. |
| 기존 login/snapshot/profile 경로가 회귀하지 않는다. | OK — 전체 테스트 146개와 production build가 통과했다. |

### 단계별 검증 결과

- Stage 1: [task_m100_17_stage1.md](../working/task_m100_17_stage1.md) — CLI login domain model, device code digest 저장, user code approval/polling 검증 통과.
- Stage 2: [task_m100_17_stage2.md](../working/task_m100_17_stage2.md) — device auth HTTP API route와 OAuth/session bridge 검증 통과.
- Stage 3: [task_m100_17_stage3.md](../working/task_m100_17_stage3.md) — 최소 승인 UI, frontend client, browser render check 검증 통과.
- Stage 4: [task_m100_17_stage4.md](../working/task_m100_17_stage4.md) — 보안 회귀 테스트, 전체 테스트, production build 검증 통과.

## 최종 검증

| 검증 | 결과 |
|---|---|
| `npm test` | OK — 146개 테스트 통과 |
| `npm run build` | OK — Vite production build 성공 |
| `git diff --check` | OK — 경고 없음 |

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 GitHub OAuth provider와 브라우저 session을 포함한 end-to-end 로그인은 GitHub OAuth app 설정이 있는 환경에서 수동 검증이 필요하다.
- CLI submit 명령은 아직 device API를 소비하지 않는다. #5에서 CLI submit과 token 저장/재사용 UX를 연결해야 한다.

### 후속 작업 후보

- #5: 로컬 CLI submit 구현과 device login 연동.
- #14: 로그인 프로필 메뉴, 로그아웃, settings shell 구현.
- #15: share modal/image link 생성 흐름 구현.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 PR 게시 절차로 진행한다.
