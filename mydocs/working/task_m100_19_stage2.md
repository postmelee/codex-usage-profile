# Task M100 #19 Stage 2 완료 보고서

GitHub Issue: [#19](https://github.com/postmelee/codex-usage-profile/issues/19)
구현계획서: [`task_m100_19_impl.md`](../plans/task_m100_19_impl.md)
Stage: 2

## 단계 목적

Stage 2의 목적은 Stage 1 요구사항 노트를 바탕으로 `UsageSnapshot v2` 공식 계약 문서를 작성하는 것이다.

이번 단계에서는 `docs/usage-snapshot-v2.md`를 신설하고, analyzer가 소유하는 usage fields와 웹 서비스가 소유하는 GitHub-facing fields를 명확히 분리했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/usage-snapshot-v2.md` | `UsageSnapshot v2` producer/consumer 경계, top-level shape, required/optional 기준, token breakdown, model usage, skill/plugin ranking, GitHub-facing fields 제외, credential 금지, v1 compatibility, minimal payload를 공식 계약으로 작성했다. |
| `mydocs/working/task_m100_19_stage2.md` | Stage 2 검증 결과와 Stage 3 영향 보고서를 추가했다. |

## 본문 변경 정도 / 본문 무손실 여부

공식 문서 루트 `docs/`를 새로 만들고 신규 계약 문서를 추가했다. 기존 코드와 v1 snapshot 문서는 수정하지 않았으므로 기존 runtime 동작에는 영향이 없다.

## 검증 결과

실행 명령:

```bash
rg -n "schemaVersion|tokenBreakdown|favoriteModel|topSkills|GitHub-facing|credential" docs/usage-snapshot-v2.md
git diff --check
```

결과:

- OK: 공식 계약 문서에서 `schemaVersion`, `tokenBreakdown`, `favoriteModel`, `topSkills`, `GitHub-facing`, `credential` 관련 섹션과 예시가 확인됐다.
- OK: 신규 공식 계약 문서에는 작업 규칙상 금지된 로컬 분석 자료 경로 언급이 없다.
- OK: `git diff --check`가 경고 없이 통과했다.

## 주요 결정

- `usage.totalTokens`를 대표 합계로 사용하고 별도 `textTokens`는 v2 첫 계약에 넣지 않았다.
- `tokenBreakdown` object는 required로 두되, 각 category 값은 `null`을 허용한다.
- `tokenBreakdown` 합계와 `usage.totalTokens`의 strict equality는 요구하지 않는다.
- `models`, `activity`, `skills`, `plugins`는 stable required object로 두고, 알 수 없는 metric은 `null` 또는 empty array로 표현한다.
- skill/plugin ranking은 `skills.topSkills[]`와 `plugins.topPlugins[]`로 분리했다.
- `extensions` namespace만 product-specific 추가 필드를 허용하고 top-level unknown fields는 금지한다.
- GitHub login/avatar/bio/profile URL 등 GitHub-facing fields는 v2 snapshot에서 제외하고 web account/profile layer에서 병합한다.

## 잔여 위험

- Stage 3 validator skeleton에서 optional object와 required object의 exact-key policy를 문서와 일치시켜야 한다.
- `extensions` namespace를 어느 수준까지 허용할지 runtime validator에서 과하게 열어두지 않도록 주의해야 한다.
- v1 submit path가 현재 `validateProfileSnapshot`만 사용하므로, Stage 3에서 v2 validator를 추가하더라도 기존 v1 path를 깨지 않아야 한다.

## 다음 단계 영향

- Stage 3는 `docs/usage-snapshot-v2.md`를 기준으로 `validateUsageSnapshotV2`와 v2 type/test skeleton을 추가한다.
- Stage 3 테스트는 GitHub-facing fields와 credential-like fields가 v2 snapshot에 들어오면 reject되는지 확인해야 한다.
- #20 analyzer 분리 작업은 `docs/usage-snapshot-v2.md`의 minimal valid payload와 field semantics를 SDK/CLI output 기준으로 삼는다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 `UsageSnapshot v2` runtime contract skeleton 추가로 진행한다.
