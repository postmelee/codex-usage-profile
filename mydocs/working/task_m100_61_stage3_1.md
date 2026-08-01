# Task M100 #61 Stage 3.1 완료 보고서

GitHub Issue: [#61](https://github.com/postmelee/codex-usage-profile/issues/61)
구현계획서: [`task_m100_61_impl.md`](../plans/task_m100_61_impl.md)
Stage: 3.1

## 단계 목적

Stage 3 로컬 시각 검토에서 확인한 Device 승인 맥락, terminal error 복구 안내와
card 하단의 과도한 빈 공간을 보정했다. 승인 전 안내와 보안 문구, setup guide를
제공하고 invalid/expired code는 사용자가 terminal에서 새 code를 발급받아 즉시
교체할 수 있는 상태로 전환했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/deviceApproval.js` | invalid/expired terminal status를 행동 중심 안내로 정규화하는 pure helper 추가 |
| `src/profile-ui/DeviceApprovalPage.jsx` | 승인·보안 안내, terminal error 뒤 input focus/select, 상태별 action label과 setup guide 추가 |
| `src/profile-ui/__tests__/deviceApproval.test.js` | 400·404·409·410 terminal 안내와 retryable 원문 보존 unit 검증 추가 |
| `src/styles.css` | header/security/help copy와 focus style 추가, feedback reserved height 축소 |
| `tests/profile-ui.spec.js` | 안내·setup link·card 높이, terminal error 문구·input focus/select와 수정 복구 검증 |
| `mydocs/plans/task_m100_61_impl.md` | Stage 3.1 로컬 UX 피드백과 보정 경계 기록 |
| `mydocs/orders/20260802.md` | Stage 3.1 완료·Stage 4 승인 대기 상태 기록 |
| `mydocs/working/task_m100_61_stage3_1.md` | Stage 3.1 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. `user_code`, GitHub
login return path, authorize request/response, double-submit guard,
approved/exchanged success, intent별 guidance, clipboard와 no-auto-redirect
계약은 변경하지 않았다.

retryable network/rate-limit/server error는 기존 원문과 `Retry approval` 동작을
유지했다. terminal 400·404·409·410만 사용자가 실행할 수 있는 invalid/expired
안내로 치환하고 code 수정 전 approve disabled 계약을 유지했다. code input
format과 backend payload는 변경하지 않았다.

`.openai/hosting.json`, app-owned GitHub OAuth, D1/R2와 card renderer는
변경하지 않았다.

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

- OK — Device approval pure unit 6건 통과, 실패·skip 0건
- OK — Device approval focused Playwright 5건 통과, 실패·skip 0건
- OK — 승인 맥락·보안 문구와 `/#quickstart` setup guide 표시
- OK — terminal 400·404·409·410은 invalid/expired 행동 안내로 정규화되고
  retryable 503 원문은 보존됨
- OK — terminal error 뒤 code input focus 및 0~9 전체 selection, action label
  `Enter a new code`, 수정 뒤 error 해제와 `Approve device` 활성화 확인
- OK — feedback reserved height `48px`, 기존 success content 자연 확장 유지
- OK — double-submit, submit/login/legacy intent, clipboard fallback,
  reduced-motion, account logout과 no-auto-redirect 회귀 유지
- OK — Vite production client build 성공, 1,809 modules transformed
- OK — `git diff --check` 경고 없음
- OK — `.openai/hosting.json` diff 빈 출력; Sites linkage 무변경
- OK — 실행 중인 `http://127.0.0.1:5177`에 full reload로 변경 반영

## 잔여 위험

- 붙여넣은 `ABCD1234`를 `ABCD-1234`로 자동 정규화하는 기능은 선택 개선으로
  남겼다. 현재 CLI가 제공하는 hyphen 포함 code 계약과 backend payload는 유지한다.
- 전체 unit/E2E와 Sites production artifact를 함께 검증하는 통합 QA는 Stage 4
  범위다.
- production Sites save/deploy/access와 원격 device challenge·data 작업은
  수행하지 않았다.

## 다음 단계 영향

- Stage 4 local smoke에서 실제 만료된 code의 행동 안내와 card 높이를 함께
  확인하고, valid challenge의 approved success가 확장된 card 안에서 잘리지
  않는지 재검증한다.
- 전체 회귀에는 retryable/terminal error와 focus selection assertion을 유지한다.
- 사용자 code 자동 format은 MVP 공개 병목으로 판단하지 않으며 별도 승인 없이
  Stage 4 범위를 넓히지 않는다.

## 승인 요청

- Stage 3.1 산출물과 검증 결과를 승인하면 Stage 4 통합 browser·Sites artifact
  QA로 진행한다.
