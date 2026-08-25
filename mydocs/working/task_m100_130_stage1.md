# Task #130 Stage 1 단계 보고서 — 미제출 operator target 계약

GitHub Issue: [#130](https://github.com/postmelee/codex-usage-profile/issues/130)
구현계획서: [`task_m100_130_impl.md`](../plans/task_m100_130_impl.md)
Stage: 1

## 단계 목적

authenticated profile이 ready이고 아직 사용량을 제출하지 않은 상태를 기존 sample target에서
locale-aware operator target으로 분리한다. auth/profile bootstrap unresolved, anonymous operator,
submitted owner와 profile/owner preview 오류 sample fallback의 기존 우선순위를 유지하면서 순수
resolver 단위 계약을 먼저 고정하는 Stage다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/homeCardTarget.js` | authenticated ready no-usage를 operator source로 선택하는 명시 분기 추가 |
| `src/profile-ui/__tests__/homeCardTarget.test.js` | no-usage operator 계약을 failure sample outcome과 분리하고 frozen target/source 검증 추가 |
| `mydocs/orders/20260825.md` | Task #130 Stage 1 완료·Stage 2 승인 대기 상태 등록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. target resolver의 입력·출력 shape,
source normalization·immutability, auth/profile unresolved, submitted owner와 error sample 계약은
변경하지 않았다. Home component, overlay, transition/resource lifecycle, backend/API, renderer,
public asset, 공식 문서와 Sites manifest도 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/homeCardTarget.test.js
node --test src/profile-ui/__tests__/homeCardTransition.test.js
git diff --check
```

결과:

- OK — `homeCardTarget.test.js` 5개 통과. authenticated ready no-usage가 operator를 선택하고
  unresolved, anonymous/unavailable, owner, profile/preview error outcome이 각각 유지됨을 확인했다.
- OK — `homeCardTransition.test.js` 11개 통과. fallback, generation, logout reset, source validation,
  preload/decode와 abort 계약에 회귀가 없다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Stage 1은 target만 operator로 바꿨다. operator image가 실패해 visible source가 static sample로
  fallback하면 현재 `showPersonalizedSample` 조건이 no-usage 계정 identity를 다시 overlay할 수 있다.
  Stage 2에서 `hasUsage` gate와 404/503 E2E로 보정하기 전에는 완성된 사용자 동작이 아니다.
- Home E2E와 Sites artifact 검증은 Stage 2·3 범위이므로 아직 실행하지 않았다.

## 다음 단계 영향

- Stage 2는 `HomePage`의 personalized sample 조건을 submitted owner failure에만 한정한다.
- 정상 no-usage operator와 operator 404/503 fallback에서 source kind/URL, overlay 부재, owner preview
  무요청과 disabled submit action을 Playwright로 고정한다.
- submitted owner preview failure의 기존 personalized sample은 positive regression으로 유지한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 Home fallback identity와 사용자 상태 회귀 보정으로
  진행한다.
