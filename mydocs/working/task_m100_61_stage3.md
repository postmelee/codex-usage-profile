# Task M100 #61 Stage 3 완료 보고서

GitHub Issue: [#61](https://github.com/postmelee/codex-usage-profile/issues/61)
구현계획서: [`task_m100_61_impl.md`](../plans/task_m100_61_impl.md)
Stage: 3

## 단계 목적

Device Approve를 기존 독립 app frame에서 Stage 1~2의 공통 fullscreen
`ProfileShell`로 통합했다. 전역 header의 Home brand와 계정 상태를 제공하고,
승인 form은 main canvas 중앙의 집중 작업 card로 유지했다. device challenge,
GitHub OAuth return, 승인 상태와 완료 안내 계약은 변경하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/App.jsx` | Device Approve에 기존 `handleAuthStateChange`를 전달해 공통 계정 menu logout 상태를 App과 동기화 |
| `src/profile-ui/DeviceApprovalPage.jsx` | fullscreen `ProfileShell` 합성, Share 숨김, 실제 단일 `h1` 유지와 중복 product label 제거 |
| `src/styles.css` | 검정 page canvas와 surface 작업 card, desktop/mobile/short viewport의 안전한 중앙 배치 및 document scroll 정렬 |
| `tests/profile-ui.spec.js` | 공통 shell·header·단일 heading·Share 부재·responsive·logout 상태와 기존 승인 흐름 회귀 검증 |
| `mydocs/orders/20260802.md` | Stage 3 완료·Stage 4 승인 대기 상태 기록 |
| `mydocs/working/task_m100_61_stage3.md` | Stage 3 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 승인 form의
`User code`, `Approve device`, 상태별 guidance, copy command, Home/Profile link와
no-auto-redirect 문구·동작을 유지했다. `authorizeDeviceLogin` request/response,
double-submit guard, retryable/terminal error 분류, approved/exchanged success와
clipboard fallback도 변경하지 않았다.

`ProfileShell`과 기존 `AccountMenu`를 재사용했으며 새로운 auth request나
redirect를 추가하지 않았다. 공통 menu logout만 App auth state와 연결했다.
`.openai/hosting.json`, app-owned GitHub OAuth, backend/API, D1/R2와 card
renderer는 변경하지 않았다.

구현계획서에서 수정 대상으로 열어 둔 pure helper unit test 파일은 device
approval 상태·guidance 계약 자체가 바뀌지 않아 수정하지 않고 기존 5건을
그대로 실행했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/deviceApproval.test.js
npm run test:e2e -- --grep "device approval"
npm run build
git diff --check
git diff -- .openai/hosting.json
```

결과:

- OK — Device approval pure unit 5건 통과, 실패·skip 0건
- OK — Device approval focused Playwright 5건 통과, 실패·skip 0건
- OK — desktop/mobile에서 `.app-frame--fullscreen`, 공통 Home brand와 실제
  `Authorize device` 단일 `h1`, Share action 부재 확인
- OK — Device page의 authenticated account menu에서 Profile·Settings 이동
  경로 유지, logout request 1회 뒤 shell과 form이 함께 anonymous 상태로 전환
- OK — double submit은 authorize request 1회, approving/approved disabled 상태,
  submit/login/legacy intent guidance와 no-auto-redirect 유지
- OK — retryable error 재시도와 terminal error code 수정 해제, clipboard
  실패 fallback·재시도와 reduced-motion 유지
- OK — 390×844에서 header가 card를 가리지 않고 horizontal overflow 없음
- OK — Vite production client build 성공, 1,809 modules transformed
- OK — `git diff --check` 경고 없음
- OK — `.openai/hosting.json` diff 빈 출력; Sites linkage 무변경
- OK — 실행 중인 `http://127.0.0.1:5177`에 HMR 반영, Vite error 없음

## 잔여 위험

- Stage 1~3 개별 focused 회귀는 통과했지만 전체 unit/E2E, Sites production
  artifact와 local smoke를 한 번에 확인하는 통합 QA는 Stage 4 범위다.
- 공통 header 도입 뒤 실제 GitHub OAuth callback 왕복은 기존 redirect 계약을
  보존하고 mocked browser flow를 통과했으나, 이번 단계에서 원격 OAuth나
  production session을 변경·실행하지 않았다.
- production Sites save/deploy/access와 원격 데이터 작업은 수행하지 않았다.

## 다음 단계 영향

- Stage 4는 Home, owner/public Profile, Settings와 Device Approve가 같은
  fullscreen shell·document scroll·account state contract를 지키는지 전체
  회귀에서 확인한다.
- Sites production artifact에서도 `/device`와 `?view=device` route, GitHub
  OAuth redirect 및 backend binding이 source와 동일한지 비배포 상태로 검증한다.
- 로컬 smoke는 authenticated/anonymous Device 화면과 mobile/short viewport를
  포함하되 원격 device challenge나 production data를 생성하지 않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 통합 browser·Sites artifact
  QA로 진행한다.
