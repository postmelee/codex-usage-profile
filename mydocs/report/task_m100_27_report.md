# Task M100 #27 최종 보고서

GitHub Issue: [#27](https://github.com/postmelee/codex-usage-profile/issues/27)
마일스톤: M100

## 작업 요약

- 대상 이슈: #27
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: API token의 무제한 생성 위험을 줄이고 Settings UI와 session 보안 경계를 MVP 운영 전 기준으로 고정한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-backend/tokens.js` | owner별 active CLI token 최대 3개 제한 추가 | token 발급 service, settings/device-code token 생성 |
| `src/profile-backend/index.js` | active token 제한 기본값 export 추가 | backend public module surface |
| `src/profile-shared/tokenLimits.js` | frontend/backend 공용 token limit 상수 추가 | shared runtime constant |
| `src/profile-ui/SettingsPage.jsx` | token count 표시, limit reached disabled state, conflict error copy 추가 | Settings API Tokens UI |
| `src/styles.css` | token count badge와 limit 안내 style 추가 | Settings UI style |
| `src/profile-api/__tests__/client.test.js` | settings token conflict error 전달 검증 추가 | frontend API client 검증 |
| `src/profile-backend/__tests__/tokens.test.js` | active token 제한, owner 격리, revoke 후 재생성 검증 추가 | token service regression |
| `src/profile-backend/__tests__/http.test.js` | settings/device-code token limit, session-only mutation, bearer 우회 차단 검증 추가 | HTTP API regression |
| `src/profile-backend/__tests__/session.test.js` | session cookie 보안 속성 검증 추가 | session cookie regression |
| `mydocs/plans/task_m100_27.md` | 수행계획서 작성 | 작업 계획 |
| `mydocs/plans/task_m100_27_impl.md` | 구현계획서 작성 | 단계 계획 |
| `mydocs/working/task_m100_27_stage1.md` ~ `stage4.md` | 단계별 완료 보고 | 작업 기록 |
| `mydocs/report/task_m100_27_report.md` | 최종 보고서 | 작업 기록 |
| `mydocs/orders/20260617.md`, `mydocs/orders/20260703.md` | 오늘할일 상태 기록 | 작업 보드 |

## 문서 위치 검증

이번 task는 공식 사용자/API 문서를 새로 만들지 않기로 계획했다. 실제 산출물도 내부 작업 문서와 작업 보드에 한정했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_27.md` | `mydocs/plans/` | `mydocs/plans/task_m100_27.md` | OK | 수행계획서 위치와 일치 |
| `mydocs/plans/task_m100_27_impl.md` | `mydocs/plans/` | `mydocs/plans/task_m100_27_impl.md` | OK | 구현계획서 위치와 일치 |
| `mydocs/working/task_m100_27_stage{1..4}.md` | `mydocs/working/` | `mydocs/working/` | OK | 단계 보고서 위치와 일치 |
| `mydocs/report/task_m100_27_report.md` | `mydocs/report/` | `mydocs/report/task_m100_27_report.md` | OK | 최종 보고서 위치와 일치 |
| 공식 사용자/API 문서 | 해당 없음 | 해당 없음 | OK | 제품 문서 변경 범위 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| active CLI token 제한 | 없음 | owner별 active token 최대 3개 |
| revoked token 처리 | list에서 제외 | 제한 수에서도 제외 |
| Settings token limit UI | 없음 | count badge, disabled state, conflict copy |
| session cookie 보안 속성 테스트 | 기본 일부 검증 | `Path=/`, `HttpOnly`, `SameSite=Lax`, expiry, optional `Secure` 검증 |
| settings mutation session-only 검증 | 일부 route 검증 | token create/delete, device patch의 cookie-only 경계 검증 |
| 전체 테스트 | 기존 통과 상태 | 177개 테스트 통과 |
| 변경 규모 | 기준 branch `devel` | 16 files, 964 insertions, 6 deletions plus Stage 4/final docs |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| active API token은 owner별 최대 3개로 제한된다. | OK — service/http test와 runtime smoke에서 4번째 생성 409 `conflict` 확인 |
| revoked token은 active 제한 수에서 제외된다. | OK — revoke 후 replacement token 생성 201 확인 |
| settings UI는 제한 상태를 생성 전 표시하고 create action을 비활성화한다. | OK — `SettingsPage.jsx`에서 token count와 limit disabled state 구현, build 통과 |
| backend 409 conflict는 사용자용 제한 메시지로 처리된다. | OK — API client conflict 전달 test와 UI error mapping 구현 |
| token create 반복 클릭은 submitting/limit state에서 우회되지 않는다. | OK — `createDisabled` guard가 submit handler와 button disabled에 공통 적용 |
| session cookie는 보안 속성을 명시한다. | OK — session test에서 `HttpOnly`, `SameSite=Lax`, `Path=/`, expiry, optional `Secure` 검증 |
| settings mutation은 session cookie 없이 실패한다. | OK — token create/delete, device patch가 cookie 없을 때 401 |
| bearer token만으로 settings mutation을 수행할 수 없다. | OK — bearer-only mutation 요청이 401 |
| `npm test`, `npm run build`, `git diff --check`가 통과한다. | OK — 최종 검증 통과 |

### 단계별 검증 결과

- Stage 1: `npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js` — 35개 테스트 통과
- Stage 2: `npm test -- src/profile-api/__tests__/client.test.js`, `npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js`, `npm run build`, `git diff --check` — 통과
- Stage 3: `npm test -- src/profile-backend/__tests__/session.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js`, `git diff --check` — 34개 테스트 통과
- Stage 4: `npm test` 177개 통과, `npm run build` 통과, `git diff --check` 통과, runtime HTTP smoke 통과

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 GitHub OAuth로 로그인한 브라우저 세션에서의 시각 smoke는 작업지시자 확인이 필요하다.
- full CSRF token은 이번 task에서 도입하지 않았다. 현재 MVP는 `SameSite=Lax`, same-origin client request, session-only mutation, bearer 우회 차단으로 충분하다고 판단했다.

### 후속 작업 후보

- 별도 frontend origin, cross-site embed, third-party relay를 지원할 경우 CSRF token 또는 Origin/Referer 검증 이슈 생성
- PR merge 전 Settings 화면에서 active token 3개 제한 UI를 작업지시자가 직접 시각 확인

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 PR 게시 절차로 진행한다.
