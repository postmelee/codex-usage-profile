# Task M100 #19 구현계획서

수행계획서: [`task_m100_19.md`](task_m100_19.md)
GitHub Issue: [#19](https://github.com/postmelee/codex-usage-profile/issues/19)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | v1 계약과 후속 요구사항 정리 | `mydocs/tech/task_m100_19_snapshot_v2_notes.md` | 필드 매핑 자체 검토, `git diff --check` |
| 2 | UsageSnapshot v2 공식 계약 문서 작성 | `docs/usage-snapshot-v2.md` | 문서 required/optional/금지 필드 검토, `git diff --check` |
| 3 | Runtime contract skeleton과 검증 추가 | v2 schema/type/test skeleton | `npm test -- src/profile-snapshot`, `git diff --check` |
| 4 | README 연결과 후속 handoff 정리 | README, 최종 handoff notes | `npm test`, `npm run build`, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/usage-snapshot-v2.md` | `docs/` | `docs/usage-snapshot-v2.md` | OK | Stage 2에서 공식 데이터 계약 문서로 신설한다. |
| `mydocs/tech/task_m100_19_snapshot_v2_notes.md` | `mydocs/tech/` | `mydocs/tech/task_m100_19_snapshot_v2_notes.md` | OK | Stage 1에서 조사/의사결정 노트로 작성한다. |
| `src/profile-snapshot/*` | 기존 `src/profile-snapshot/` | `src/profile-snapshot/v2-schema.js`, `src/profile-snapshot/v2-types.d.ts`, export/test | OK | Stage 3에서 필요한 최소 skeleton만 추가한다. |
| `README.md` | `README.md` | `README.md` | OK | Stage 4에서 자세한 계약 대신 링크와 책임 경계 요약만 둔다. |
| `mydocs/working/task_m100_19_stage{N}.md` | `mydocs/working/` | `mydocs/working/task_m100_19_stage{N}.md` | OK | 각 Stage 완료 보고서 |
| `mydocs/report/task_m100_19_report.md` | `mydocs/report/` | `mydocs/report/task_m100_19_report.md` | OK | 최종 보고서 |

## 구현 방식 결정

- `UsageSnapshot v2`는 `schemaVersion: 2`를 사용하는 독립 계약으로 정의한다.
- v1 runtime path는 유지한다. v2 skeleton을 추가하더라도 기존 fixture preview, selector, backend submit contract가 즉시 깨지지 않게 한다.
- analyzer snapshot은 로컬 사용량 분석 결과만 담는다. GitHub login, GitHub avatar, GitHub bio, GitHub profile URL, service session, CLI token은 snapshot에 포함하지 않는다.
- web profile layer는 GitHub owner/profile record와 analyzer snapshot을 병합해 profile page, README card, 향후 카드형 UI의 view model을 만든다.
- v2 required field는 analyzer가 안정적으로 제공해야 하는 최소 공통값으로 제한한다. source별로 수집 가능성이 다른 값은 optional 또는 nullable로 둔다.
- token breakdown은 전체 합계 필드를 우선 정의하고, daily/model breakdown은 선택 확장 필드로 둔다.
- model usage, top skills/plugins는 향후 source availability 차이를 표현할 수 있도록 source metadata 또는 availability note를 문서화한다.
- credential-like 값 금지는 공식 문서와 runtime skeleton 양쪽에 반영한다.

## Stage 1 — v1 계약과 후속 요구사항 정리

### 산출물

신규:

- `mydocs/tech/task_m100_19_snapshot_v2_notes.md`
- `mydocs/working/task_m100_19_stage1.md`

수정:

- 필요 시 `mydocs/plans/task_m100_19_impl.md`

### 변경 내용

- 기존 snapshot v1 top-level field와 selector 소비 지점을 표로 정리한다.
- 현재 profile UI, README card, #5 profile submit CLI, #20 analyzer 분리 작업이 요구하는 v2 field를 분류한다.
- v2 field를 다음 그룹으로 나눈다.
  - analyzer-owned usage fields
  - web-owned GitHub-facing fields
  - derived view-model fields
  - excluded credential/session fields
- total tokens, token breakdown, model usage, top skills/plugins, activity stats의 required/optional 후보를 정리한다.
- v1 compatibility와 v2 migration에서 필요한 alias/변환 후보를 정리한다.

### 검증

```bash
rg -n "schemaVersion|totalTextTokens|topInvocations|input|output|cache|favorite|model" src/profile-snapshot mydocs/tech README.md
git diff --check
```

### 커밋

```text
Task #19 Stage 1: UsageSnapshot v2 요구사항 정리
```

## Stage 2 — UsageSnapshot v2 공식 계약 문서 작성

### 산출물

신규:

- `docs/usage-snapshot-v2.md`
- `mydocs/working/task_m100_19_stage2.md`

수정:

- 필요 시 `mydocs/tech/task_m100_19_snapshot_v2_notes.md`

### 변경 내용

- `docs/` 디렉터리를 신설하고 `UsageSnapshot v2` 공식 계약 문서를 작성한다.
- 문서에 다음 내용을 포함한다.
  - contract purpose와 producer/consumer 경계
  - top-level schema
  - required/optional/nullability 기준
  - token summary와 breakdown field
  - model usage와 favorite model field
  - skills/plugins activity field
  - daily usage/streak/longest task field
  - analyzer에서 제외되는 GitHub-facing fields
  - credential/session 금지 필드
  - v1 compatibility와 migration note
  - 최소 예시 payload
- 향후 `tokenmon` 같은 product-specific wrapper가 이 계약을 소비할 때 지켜야 할 경계를 명시한다.

### 검증

```bash
rg -n "schemaVersion|tokenBreakdown|favoriteModel|topSkills|GitHub-facing|credential" docs/usage-snapshot-v2.md
git diff --check
```

### 커밋

```text
Task #19 Stage 2: UsageSnapshot v2 공식 계약 문서 작성
```

## Stage 3 — Runtime contract skeleton과 검증 추가

### 산출물

신규:

- `src/profile-snapshot/v2-schema.js`
- `src/profile-snapshot/v2-types.d.ts`
- `src/profile-snapshot/__tests__/v2-schema.test.js`
- 필요 시 `src/profile-snapshot/fixtures/sample-v2-snapshot.js`
- `mydocs/working/task_m100_19_stage3.md`

수정:

- `src/profile-snapshot/index.js`
- 필요 시 `src/profile-snapshot/types.d.ts`

### 변경 내용

- v1 validator와 공존하는 v2 validator skeleton을 추가한다.
- v2 top-level exact-key validation 또는 명확한 extension policy를 구현한다.
- 필수 공통 필드와 optional field의 validation을 최소 구현한다.
- GitHub-facing fields가 analyzer snapshot에 들어오면 reject되는 테스트를 추가한다.
- credential-like field/value가 포함될 때 reject되는 테스트를 추가한다.
- v1 test가 계속 통과하도록 기존 exports와 v1 path를 유지한다.

### 검증

```bash
npm test -- src/profile-snapshot
git diff --check
```

### 커밋

```text
Task #19 Stage 3: UsageSnapshot v2 runtime contract 추가
```

## Stage 4 — README 연결과 후속 handoff 정리

### 산출물

신규:

- `mydocs/working/task_m100_19_stage4.md`

수정:

- `README.md`
- 필요 시 `docs/usage-snapshot-v2.md`
- 필요 시 `mydocs/tech/task_m100_19_snapshot_v2_notes.md`

### 변경 내용

- README에 `UsageSnapshot v2` 계약 문서 링크와 analyzer/profile 책임 경계를 짧게 추가한다.
- #20 analyzer 분리가 바로 이어받을 공개 API 후보를 정리한다.
- #5 profile submit CLI가 analyzer output을 제출하는 wrapper가 되어야 한다는 handoff를 정리한다.
- #6 README card renderer가 GitHub-facing fields와 analyzer fields를 병합해 사용한다는 handoff를 정리한다.
- #17/#15는 인증/token/device 관리 책임만 가진다는 경계를 재확인한다.
- 전체 검증 결과와 남은 한계를 단계 보고서에 기록한다.

### 검증

```bash
npm test
npm run build
rg -n "(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src docs README.md mydocs
git status --short
git diff --check
```

### 커밋

```text
Task #19 Stage 4: README 연결과 handoff 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- v2 skeleton이 추가되어도 v1 snapshot validator와 profile UI fixture path가 계속 통과해야 한다.
- credential scan은 실제 credential 값이 source/docs에 남지 않았는지 확인하기 위한 보안 점검으로 실행한다.
- 공식 계약 문서와 runtime skeleton이 어긋나면 Stage 안에서 문서 또는 skeleton을 맞춘 뒤 보고한다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_19_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #19 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 최종 보고 단계는 `task-final-report` 절차를 사용한다.

## 단계 의존성

- Stage 2는 Stage 1의 field ownership와 required/optional 후보가 정리된 뒤 진행한다.
- Stage 3은 Stage 2 공식 계약 문서가 작성된 뒤 runtime skeleton을 맞춘다.
- Stage 4는 Stage 3 validation path가 통과한 뒤 README와 후속 이슈 handoff를 정리한다.

## 위험과 대응

- **계약 과확장**: analyzer가 당장 안정적으로 제공할 수 없는 필드는 optional/nullable 또는 future extension으로 둔다.
- **v1 회귀**: v1 validator/export를 변경하지 않고 v2 module을 별도로 추가해 기존 UI와 테스트가 통과하는지 확인한다.
- **identity 혼입**: GitHub-facing fields reject test와 문서 금지 목록을 둬 analyzer snapshot 경계를 지킨다.
- **문서-코드 불일치**: Stage 3에서 공식 문서의 required field와 runtime validator를 함께 검증한다.
- **후속 레포 경계 불명확**: Stage 4 handoff에서 #20 analyzer SDK/CLI가 무엇을 import/export해야 하는지 명확히 남긴다.

## 승인 요청 사항

- 위 Stage 분할, 산출 파일, 검증 명령, 커밋 메시지를 승인해 달라.
- Stage 1을 `mydocs/tech/task_m100_19_snapshot_v2_notes.md` 조사 노트 작성부터 시작하는 것을 승인해 달라.
- `docs/usage-snapshot-v2.md`를 Stage 2 공식 계약 문서로 신설하는 것을 승인해 달라.
- Stage 3에서 v1과 공존하는 v2 validator/type/test skeleton을 최소 범위로 추가하는 것을 승인해 달라.
