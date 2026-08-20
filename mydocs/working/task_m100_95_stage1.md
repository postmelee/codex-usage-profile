# Task #95 Stage 1 보고서 — Home 카드 상태 이력 재현과 계약 고정

GitHub Issue: [#95](https://github.com/postmelee/codex-usage-profile/issues/95)
구현계획서: [`task_m100_95_impl.md`](../plans/task_m100_95_impl.md)
Stage: 1

## 단계 목적

제품 소스를 바꾸기 전에 authenticated Home 초기화에서 operator resource가 먼저 준비되고 owner
profile이 뒤늦게 확정될 때의 전체 표시 상태 이력을 기록한다. 최종 DOM만 확인하던 기존 검증을
보완해 중간 operator reveal과 `ready → loading` 후퇴를 Stage 2가 반드시 제거해야 하는 회귀
계약으로 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/__tests__/homeCardTransition.test.js` | fallback 뒤에도 원래 selected target provenance를 보존해야 한다는 미구현 계약을 todo 기준선으로 추가 |
| `tests/profile-ui.spec.js` | auth·profile·operator/owner image 응답을 독립 gate로 제어하고 MutationObserver로 status·kind·busy 이력을 수집하는 Task #95 expected-failure 추가 |
| `mydocs/working/task_m100_95_stage1.md` | 재현 결과, 검증 환경과 Stage 2 입력 계약 기록 |
| `mydocs/orders/20260812.md` | #95 Stage 1 완료와 Stage 2 진행 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

제품 소스와 공개 문서는 변경하지 않았다. 테스트는 기존 최종 상태 assertion을 보존하고, 매우
짧은 React commit도 누락하지 않도록 page init script에서 관찰자를 설치했다. source에는
`status`, `kind`, `busy`만 기록하며 owner ID·avatar·session 값은 storage에 남기지 않는다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/homeCardTransition.test.js
npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task95.playwright.config.mjs --grep "Task #95|Home card transition keeps the operator card pending|Home card transition keeps a stable skeleton|Home card transition ignores a stale owner image" --workers=1
npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task95.playwright.config.mjs --browser=webkit --grep "Task #95" --workers=1
git diff --check
```

결과:

- OK — Node transition 기준선 10 pass, 1 todo. todo는 selected target provenance가 아직 상태에
  없음을 명시하며 Stage 2 구현 뒤 통과 assertion으로 전환한다.
- OK — Chromium 집중 4개: 기존 owner decode·mobile Skeleton·logout stale completion 3개 통과,
  Task #95 단조 reveal은 `test.fail()`로 기대한 실패가 발생해 전체 명령은 4 passed로 종료했다.
- OK — WebKit Task #95 expected failure도 재현되어 1 passed로 종료했다.
- OK — 두 엔진 모두 profile 응답 뒤 최종 owner decode 전에 current operator가 presentation-ready로
  평가될 수 있어 단조 `loading → ready(owner)` 계약을 위반했다. 이는 profile-ready render와
  owner transition effect 사이의 동기 gate 부재라는 착수 가설과 일치한다.
- OK — `git diff --check` 경고 없음.
- 환경 메모 — 기본 5173 포트는 별도 프로젝트 개발 서버가 점유 중이어서 이를 종료하지 않고
  5195 격리 포트의 임시 Playwright 설정을 사용했다. 제품 실패나 저장소 변경은 아니다.

## 잔여 위험

- current transition은 owner 실패 뒤 `pending`을 sample로 교체하며 원래 selected owner target을
  잃는다. fallback을 현재 selection의 결과로 인정할 근거가 Stage 2에서 필요하다.
- final target resolver가 effect 안에서만 적용되면 profile-ready commit과 effect 사이의 짧은
  operator paint를 막을 수 없다. render 시점의 동기 readiness 판정이 필요하다.
- Stage 1 expected-failure annotation과 todo는 Stage 2 구현 뒤 제거·통과 assertion으로 전환해야
  하며 남겨두면 unexpected pass가 CI 실패가 된다.

## 다음 단계 영향

- Stage 2는 auth loading 및 authenticated profile idle/loading을 `unresolved`로 반환하는 순수
  target resolver를 구현한다.
- transition은 실제 `pending`과 별도로 현재 generation의 immutable selected `target`을 유지한다.
- Home presentation-ready는 authority selected, transition target 일치, target 또는 파생 fallback
  decode 완료를 render에서 동시에 만족할 때만 true가 되어야 한다.

## 승인 요청

- 작업지시자가 #95·#96 모두 PR 생성까지 진행하도록 승인했으므로 Stage 1 결과를 기준으로
  Stage 2 구현을 계속한다.
