# Task M100 #2 Stage 4 완료 보고서

GitHub Issue: [#2](https://github.com/postmelee/codex-usage-profile/issues/2)
구현계획서: [`task_m100_2_impl.md`](../plans/task_m100_2_impl.md)
Stage: 4

## 단계 목적

Stage 4의 목적은 Stage 1-3에서 구현한 snapshot schema, raw-to-snapshot normalizer, Profile/Card selector의 계약을 내부 기술 노트로 정리하고 최종 검증을 수행하는 것이다. 후속 #3, #4, #5, #6 작업자가 raw Codex 응답이 아니라 검증된 snapshot과 selector를 기준으로 구현하도록 handoff를 남겼다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/tech/task_m100_2_snapshot_contract.md` | snapshot 구조, raw Codex-like 응답 매핑, 보안 경계, selector 책임, 후속 issue handoff 정리 |
| `mydocs/orders/20260608.md` | Stage 4 완료 보고 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

문서 신규 작성 단계다. 수행계획서의 문서 위치 판단에 맞춰 public API 문서가 아닌 내부 기술 노트를 `mydocs/tech/`에 추가했다. 기존 코드 동작은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test
rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src mydocs
git diff --check
git status --short
```

결과:

- OK: `npm test` 통과
  - Node 내장 `node --test`
  - tests 17
  - pass 17
  - fail 0
- OK: `git diff --check` 통과
- OK: secret grep 확인
  - match는 테스트, 수행/구현계획서, 단계 보고서, 기술 노트의 정책 설명에서 발생했다.
  - production code에서 raw secret field를 저장하거나 output field로 노출하는 경로는 없다.
- OK: `git status --short` 확인
  - Stage 4 신규 문서와 기존 untracked `codex-extracted/`만 확인했다.

## 잔여 위험

- 실제 CLI raw 수집 경로는 #5에서 결정되므로, Codex raw shape가 달라지면 normalizer mapping 보정이 필요할 수 있다.
- Public API 문서 루트와 API 스펙 공개 여부는 #4 또는 별도 문서 task에서 판단해야 한다.
- chart/card level 계산은 #3/#6 구현 범위로 남아 있다.

## 다음 단계 영향

- 모든 구현 Stage가 완료되었으므로 Stage 4 승인 후 최종 결과보고서 작성 절차로 넘어가야 한다.
- 최종 보고서에는 #3-#6 후속 작업이 사용할 schema/selector handoff를 요약해야 한다.
- PR 전에는 기존 untracked `codex-extracted/` 처리 정책을 다시 확인해야 한다. 현재까지는 분석 입력으로 남겨두고 task 산출물에는 포함하지 않았다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 최종 결과보고서 작성으로 진행한다.
