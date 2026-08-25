# Task #130 Stage 2 단계 보고서 — Home fallback identity와 사용자 상태 회귀

GitHub Issue: [#130](https://github.com/postmelee/codex-usage-profile/issues/130)
구현계획서: [`task_m100_130_impl.md`](../plans/task_m100_130_impl.md)
Stage: 2

## 단계 목적

미제출 계정의 Home이 정상 operator 카드와 operator 장애 fallback에서 현재 GitHub 계정 identity를
카드 위에 합성하지 않도록 보정한다. submitted owner preview 장애에서만 personalized sample identity를
유지하고, 초기 profile 로딩 Skeleton·anonymous operator·logout reset·action 상태의 회귀를 함께
고정하는 Stage다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/HomePage.jsx` | personalized sample identity 조건에 submitted usage gate 추가 |
| `tests/profile-ui.spec.js` | 미제출 operator 정상·404·503와 owner preview 무요청, overlay 부재, action 상태 E2E 보강 |
| `mydocs/orders/20260825.md` | Task #130 Stage 2 완료·Stage 3 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. `HomeSampleIdentity` component와 CSS,
submitted owner preview 404/503·decode failure fallback, anonymous operator, logout reset, source transition,
backend/API, card renderer와 public asset은 변경하지 않았다. Sites manifest·배포 설정과 공식 문서도
수정하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/homeCardTarget.test.js src/profile-ui/__tests__/homeCardTransition.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #130|Home keeps card actions disabled until usage is submitted|uses the personalized sample|decodes the anonymous operator card|logout"
git diff --check
```

결과:

- OK — resolver·transition 단위 테스트 16개 통과. no-usage operator 선택, owner/sample outcome,
  fallback generation, logout reset과 preload/decode 계약을 확인했다.
- OK — Playwright 집중 회귀 8개 통과. 미제출 정상 경로가 초기 Skeleton 이후 locale-aware operator
  source를 표시하고 owner preview 요청·identity overlay 없이 submit-first action을 유지한다.
- OK — 미제출 operator 404/503가 decoded static sample로 fallback하면서 identity overlay를 표시하지
  않고, submitted owner 404/503 personalized sample과 anonymous/logout 회귀가 유지된다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Stage 2 검증은 Vite 개발 서버 기반 headless Playwright 집중 시나리오다. production Sites artifact에
  동일 source/overlay 조건이 포함되는지는 Stage 3 build·artifact 검증 전까지 확정되지 않았다.
- 전체 단위·Playwright suite는 Stage 3 범위이므로 아직 실행하지 않았다.

## 다음 단계 영향

- Stage 3은 production build에서 `hasUsage === true` gate와 no-usage operator target이 누락되지 않았는지
  artifact를 확인한다.
- Stage 3은 전체 unit·Playwright 회귀와 `npm run check:sites`를 실행하되 deploy·hosting 변경은 하지
  않는다.
- 전체 검증이 통과하면 최종 보고·PR 단계 승인을 요청한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 Sites artifact 및 전체 회귀 검증으로 진행한다.
