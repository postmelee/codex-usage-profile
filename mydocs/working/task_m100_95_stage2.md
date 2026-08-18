# Task #95 Stage 2 보고서 — Home 카드 최종 target 단일 reveal 보정

GitHub Issue: [#95](https://github.com/postmelee/codex-usage-profile/issues/95)
구현계획서: [`task_m100_95_impl.md`](../plans/task_m100_95_impl.md)
Stage: 2

## 단계 목적

auth·profile 결과가 최종 card target을 선택하기 전까지 presentation authority를 열지 않고,
transition이 현재 selected target 또는 그 target에서 파생된 fallback을 decode 완료했을 때만 Home
카드를 한 번 reveal한다. operator 선로드와 기존 fallback 성능은 유지하면서 profile-ready render와
effect 사이의 중간 operator paint를 제거한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/homeCardTarget.js` | auth/profile 입력을 immutable `unresolved` 또는 `selected` target으로 해석하는 순수 resolver 추가 |
| `src/profile-ui/__tests__/homeCardTarget.test.js` | loading/authenticated bootstrap, anonymous/unavailable, owner, no-usage/error target 표 검증 |
| `src/profile-ui/homeCardTransition.js` | current generation의 원래 `target` provenance 보존과 target 만족 판정 helper 추가 |
| `src/profile-ui/__tests__/homeCardTransition.test.js` | target 불변성, owner fallback provenance, ready/mismatch 판정과 reset 계약 검증 |
| `src/profile-ui/HomePage.jsx` | render 시점 target authority·transition readiness 동기 gate와 이미지 DOM commit 차단 적용 |
| `tests/profile-ui.spec.js` | Stage 1 expected failure 제거, 동일 상태 이력을 통과 회귀로 전환 |
| `mydocs/working/task_m100_95_stage2.md` | 구현·검증과 Stage 3 입력 기록 |
| `mydocs/orders/20260812.md` | #95 Stage 2 완료와 Stage 3 진행 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

공개 API, URL, backend, profile 데이터와 full navigation 의미는 변경하지 않았다. Home은 기존처럼
operator resource를 즉시 선로드하고 같은 owner refresh에서 last-ready resource를 유지한다. 다만
auth/profile이 unresolved이거나 transition target이 current selection과 다르면 operator 선로드
이미지가 DOM에 있어도 `card-status=loading`과 불투명 Skeleton을 유지해 presentation-ready로
commit하지 않는다.

transition state에는 same-origin `kind`·`src`만 가진 frozen `target`을 추가했다. owner identity,
session, avatar와 handle을 storage 또는 serialized state에 추가하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/homeCardTransition.test.js src/profile-ui/__tests__/homeCardTarget.test.js
npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task95.playwright.config.mjs --grep "Task #95|Home card transition keeps the operator card pending|uses the personalized sample|fails closed when owner image decode rejects|ignores a stale owner image|decodes the anonymous operator" --workers=1
npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task95.playwright.config.mjs --browser=webkit --grep "Task #95" --workers=1
git diff --check
```

결과:

- OK — target·transition Node 단위 테스트 15/15 통과, todo 0.
- OK — Chromium 집중 7/7 통과. authenticated 상태 이력은 중간 operator ready 없이
  `loading → ready(owner)`만 기록했고 owner image DOM commit은 한 번이다.
- OK — WebKit Task #95 1/1 통과. Stage 1 expected failure가 정상 통과 assertion으로 전환됐다.
- OK — anonymous operator decode, owner target, 404/503 sample fallback, synthetic decode 실패,
  logout stale completion 경로가 모두 유지됐다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- OAuth callback 자체와 Profile brand full navigation, cold/warm reload는 같은 mount 경계를 공유하지만
  Stage 3에서 실제 navigation 시나리오로 상태 이력 계약을 한 번 더 고정해야 한다.
- current target provenance가 same-origin source 단위이므로 같은 owner preview revision 갱신과
  다른 scope 무효화가 resource cache·lease 계약을 유지하는지 Stage 3 검증이 필요하다.

## 다음 단계 영향

- Stage 3는 Task #95 관찰 helper를 재사용해 Profile→Home full navigation, cold/warm reload와 logout
  상태 이력이 한 번만 ready가 되는지 검증한다.
- 같은 owner revision은 last-ready 의미를 보존하고 anonymous 전환은 owner visible·Blob을 재사용하지
  않는지 resource lifecycle 회귀와 함께 확인한다.

## 승인 요청

- 작업지시자가 #95·#96 모두 PR 생성까지 진행하도록 승인했으므로 Stage 2 결과를 기준으로
  Stage 3 회귀 보강을 계속한다.
