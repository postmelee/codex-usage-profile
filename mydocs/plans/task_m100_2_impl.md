# Task M100 #2 구현계획서

수행계획서: [`task_m100_2.md`](task_m100_2.md)
GitHub Issue: [#2](https://github.com/postmelee/codex-usage-profile/issues/2)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Snapshot schema 기반 추가 | `package.json`, `src/profile-snapshot/schema.js`, `src/profile-snapshot/types.d.ts`, fixture/test | `npm test`, `git diff --check` |
| 2 | Codex raw data 정규화와 보안 경계 | `src/profile-snapshot/normalize.js`, normalizer tests | `npm test`, secret grep, `git diff --check` |
| 3 | Profile/Card selector와 fixture 완성 | `src/profile-snapshot/selectors.js`, selector tests | `npm test`, fixture coverage 확인 |
| 4 | 내부 계약 문서와 최종 검증 | `mydocs/tech/task_m100_2_snapshot_contract.md`, 최종 검증/보고 | `npm test`, secret grep, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `mydocs/tech/task_m100_2_snapshot_contract.md` | `mydocs/tech/` | Stage 4 | OK | public API 문서가 아닌 내부 구현 계약 근거로 유지한다. |
| source schema/test files | repository source tree | Stage 1-3 `src/profile-snapshot/` | OK | 실행되는 계약과 검증은 제품 코드로 둔다. |

## 구현 방식 결정

현재 repository root에는 제품 코드 scaffold가 없고, 로컬에 `node`/`npm`은 있지만 root `tsc` 명령은 없다. 불필요한 dependency install을 task 초기에 강제하지 않기 위해 Stage 1은 dependency-free ESM package로 시작한다.

- runtime 구현: `.js` ESM module
- TypeScript 계약: `types.d.ts`
- 테스트: Node 내장 `node:test`
- validator: 외부 schema library 없이 hand-written runtime validator

이 선택은 #2의 "TypeScript type 및 runtime validator" 요구를 `.d.ts` 타입 계약과 runtime validator로 충족한다. 이후 #3 웹 UI task에서 framework/toolchain이 정해지면 이 계약을 TypeScript source로 승격할 수 있다.

## Stage 1 — Snapshot schema 기반 추가

### 산출물

신규:

- `package.json`
- `src/profile-snapshot/index.js`
- `src/profile-snapshot/schema.js`
- `src/profile-snapshot/types.d.ts`
- `src/profile-snapshot/fixtures/sample-snapshot.js`
- `src/profile-snapshot/__tests__/schema.test.js`
- `mydocs/working/task_m100_2_stage1.md`

수정:

- 해당 없음

### 변경 내용

- root package script를 추가한다.
  - `test`: `node --test`
- `schemaVersion`을 포함하는 profile snapshot 구조를 정의한다.
- profile, summary, daily usage, activity insights, top invocations, assets field의 최소 shape를 validator로 고정한다.
- sample snapshot fixture를 작성한다.
- valid fixture 통과, 필수 field 누락 실패, 잘못된 numeric/date field 실패 테스트를 추가한다.

### 검증

```bash
npm test
git diff --check
```

### 커밋

```text
Task #2 Stage 1: snapshot schema 기반 추가
```

## Stage 2 — Codex raw data 정규화와 보안 경계

### 산출물

신규:

- `src/profile-snapshot/normalize.js`
- `src/profile-snapshot/__tests__/normalize.test.js`
- `mydocs/working/task_m100_2_stage2.md`

수정:

- `src/profile-snapshot/index.js`
- `src/profile-snapshot/types.d.ts`

### 변경 내용

- 추출 코드의 profile 변환 결과를 기준으로 raw Codex-like input을 snapshot으로 변환한다.
- raw response 전체를 저장하지 않고 allowlist field만 추출한다.
- `lifetime_tokens`, `peak_daily_tokens`, `longest_running_turn_sec`, `daily_usage_buckets`, `top_invocations` 등 Codex raw field를 snapshot field로 매핑한다.
- token-like field가 raw input에 있어도 output snapshot에 남지 않는 테스트를 추가한다.
- raw credential, `auth.json`, access token, refresh token은 normalize output에 포함하지 않는 정책을 코드와 테스트에 반영한다.

### 검증

```bash
npm test
rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src mydocs
git diff --check
```

### 커밋

```text
Task #2 Stage 2: Codex profile 정규화와 보안 경계 추가
```

## Stage 3 — Profile/Card selector와 fixture 완성

### 산출물

신규:

- `src/profile-snapshot/selectors.js`
- `src/profile-snapshot/__tests__/selectors.test.js`
- `mydocs/working/task_m100_2_stage3.md`

수정:

- `src/profile-snapshot/index.js`
- `src/profile-snapshot/types.d.ts`
- `src/profile-snapshot/fixtures/sample-snapshot.js`

### 변경 내용

- 전체 Profile 화면용 selector를 정의한다.
  - 5개 stat: lifetime tokens, peak tokens, longest task, current streak, longest streak
  - activity insights
  - most used plugins/skills
- 공유 카드용 selector를 정의한다.
  - display name, username, avatar/pet asset ref
  - 26주 usage input
  - 4개 card stat: lifetime tokens, peak day, current streak, longest streak
- fixture가 Profile 화면과 README 카드 요구 field를 모두 제공하는지 테스트한다.
- daily/weekly/cumulative heatmap 계산은 #3 UI 구현에서 처리하되, 필요한 source data가 snapshot에 존재함을 검증한다.

### 검증

```bash
npm test
git diff --check
```

### 커밋

```text
Task #2 Stage 3: profile/card selector와 fixture 완성
```

## Stage 4 — 내부 계약 문서와 최종 검증

### 산출물

신규:

- `mydocs/tech/task_m100_2_snapshot_contract.md`
- `mydocs/working/task_m100_2_stage4.md`

수정:

- 필요 시 `src/profile-snapshot/*`

### 변경 내용

- snapshot schema와 field 의미를 내부 기술 노트로 정리한다.
- Codex 추출 코드 field와 snapshot field 매핑을 문서화한다.
- 보안 경계와 금지 field 정책을 문서화한다.
- #3, #4, #5, #6이 어떤 selector/schema field를 사용해야 하는지 후속 작업 handoff를 적는다.
- 모든 Stage 산출물을 최종 검증한다.

### 검증

```bash
npm test
rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src mydocs
git diff --check
git status --short
```

### 커밋

```text
Task #2 Stage 4: snapshot 계약 문서와 최종 검증 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- `rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src mydocs`는 금지 field가 코드/문서에 정책·테스트 맥락 외 저장 field로 남지 않는지 확인하는 용도다.
- `git status --short`는 기존 untracked `codex-extracted/`가 계속 남을 수 있으므로, 단계 산출물 기준 미정리 변경이 없는지 함께 해석한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_2_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #2 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 구현계획서 승인 전에는 Stage 1 구현 파일을 만들지 않는다.

## 단계 의존성

- Stage 2는 Stage 1의 snapshot schema와 fixture가 확정된 뒤 진행한다.
- Stage 3은 Stage 2 normalizer와 보안 테스트가 통과한 뒤 진행한다.
- Stage 4는 Stage 1-3의 코드 계약이 고정된 뒤 내부 기술 노트와 최종 검증을 수행한다.

## 위험과 대응

- **외부 dependency 없는 validator의 엄격성 한계**: validator 구현과 테스트 case를 명시적으로 늘려 schema library 부재를 보완한다.
- **추후 TypeScript app 전환 비용**: `.d.ts` 타입 계약과 ESM export 경계를 유지해 #3 이후 TypeScript source로 옮기기 쉽게 한다.
- **secret grep의 false positive**: 정책 설명이나 테스트 fixture에 금지어가 등장할 수 있다. 저장 field 또는 output payload에 남는지 맥락을 함께 확인한다.
- **`codex-extracted/` untracked 상태**: 이번 task 산출물로 추가하지 않고, 검증 시 기존 분석 입력으로 분리해서 해석한다.

## 승인 요청 사항

- Stage 1-4 분할과 각 단계 산출물/커밋 메시지를 승인해 달라.
- root에 dependency-free ESM package를 만들고 `.d.ts` 타입 계약 + hand-written runtime validator로 시작하는 방식을 승인해 달라.
- 내부 계약 문서는 수행계획서와 동일하게 `mydocs/tech/task_m100_2_snapshot_contract.md`에 두는 것을 승인해 달라.
- 승인되면 Stage 1 구현을 시작하고, Stage 1 완료 후 단계 보고서와 함께 다시 승인 요청한다.
