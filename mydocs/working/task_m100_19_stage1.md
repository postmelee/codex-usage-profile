# Task M100 #19 Stage 1 완료 보고서

GitHub Issue: [#19](https://github.com/postmelee/codex-usage-profile/issues/19)
구현계획서: [`task_m100_19_impl.md`](../plans/task_m100_19_impl.md)
Stage: 1

## 단계 목적

Stage 1의 목적은 `UsageSnapshot v2` 공식 계약 문서 작성 전에 기존 snapshot v1 계약, 현재 UI/API 소비 지점, 후속 analyzer/profile 분리 요구사항을 정리하는 것이다.

이번 단계에서는 코드 동작을 바꾸지 않고, v2에서 어떤 필드를 analyzer가 소유하고 어떤 필드를 웹 서비스가 GitHub login/profile layer에서 병합해야 하는지 기술 노트로 고정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/tech/task_m100_19_snapshot_v2_notes.md` | v1 필드 소비 지점, v2 field ownership, GitHub-facing fields 제외 원칙, token/model/skill 후보 구조, v1 migration 후보, 후속 이슈 handoff를 정리했다. |
| `mydocs/working/task_m100_19_stage1.md` | Stage 1 검증 결과와 다음 단계 영향 보고서를 추가했다. |

## 본문 변경 정도 / 본문 무손실 여부

신규 문서 2개를 추가했다. 기존 소스, 공식 문서, 수행계획서, 구현계획서 본문은 수정하지 않았다. 따라서 기존 코드 동작과 v1 snapshot path에는 변경이 없다.

## 검증 결과

실행 명령:

```bash
rg -n "schemaVersion|totalTextTokens|topInvocations|input|output|cache|favorite|model" src/profile-snapshot mydocs/tech README.md
git diff --check
```

결과:

- OK: `rg`로 v1 schema/normalizer/selector/test 소비 지점과 Stage 1 노트의 v2 후보 필드가 확인됐다.
- OK: Stage 1 신규 문서에는 작업 규칙상 금지된 로컬 분석 자료 경로 언급이 없다.
- OK: `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- Stage 2에서 `totalTokens`와 `textTokens`를 모두 둘지, `totalTokens` 하나로 시작할지 확정해야 한다.
- `tokenBreakdown` 합계가 `totalTokens`와 항상 일치해야 하는지, source별 차이를 허용할지 결정해야 한다.
- `activity`, `models`, `skills/plugins` 그룹을 required object로 둘지 optional group으로 둘지 결정해야 한다.
- skills/plugins ranking을 분리 배열로 둘지 `invocations.top[]` 단일 배열로 둘지 결정해야 한다.
- Codex profile 표시 힌트와 GitHub-facing profile fields의 우선순위를 공식 계약 문서에서 명확히 표현해야 한다.

## 다음 단계 영향

- Stage 2는 `docs/usage-snapshot-v2.md`를 신설하고, Stage 1 노트의 후보 구조를 공식 계약으로 정리한다.
- Stage 2에서 확정한 required/optional/nullability 기준이 Stage 3 v2 validator/type/test skeleton의 기준이 된다.
- #20 analyzer 분리 작업은 Stage 2/3 결과를 기준으로 SDK/CLI 공개 API를 설계해야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 `UsageSnapshot v2` 공식 계약 문서 작성으로 진행한다.
