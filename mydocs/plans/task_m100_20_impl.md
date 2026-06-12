# Task M100 #20 구현계획서

수행계획서: [`task_m100_20.md`](task_m100_20.md)
GitHub Issue: [#20](https://github.com/postmelee/codex-usage-profile/issues/20)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 분리 경계와 migration inventory 확정 | `mydocs/tech/task_m100_20_analyzer_split_notes.md` | import/export inventory 확인, `git diff --check` |
| 2 | analyzer workspace package 스캐폴드 | `packages/codex-usage-analyzer/*` 기본 SDK/CLI | CLI smoke, analyzer package tests |
| 3 | v2 contract module canonical home 이동 | analyzer-owned v2 schema/type/fixture, profile compatibility re-export | profile snapshot tests, analyzer tests |
| 4 | wrapper compatibility와 문서 연결 | `docs/codex-usage-analyzer.md`, README/package README 정리 | full test/build, contract smoke |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/codex-usage-analyzer.md` | `docs/` | `docs/codex-usage-analyzer.md` | OK | Stage 4에서 공식 analyzer SDK/CLI 소비 문서로 작성한다. |
| `packages/codex-usage-analyzer/README.md` | package root | `packages/codex-usage-analyzer/README.md` | OK | Stage 2에서 package-local 사용법을 작성하고 Stage 4에서 보강한다. |
| `mydocs/tech/task_m100_20_analyzer_split_notes.md` | `mydocs/tech/` | `mydocs/tech/task_m100_20_analyzer_split_notes.md` | OK | Stage 1에서 migration inventory와 의사결정을 기록한다. |
| `packages/codex-usage-analyzer/*` | 신규 workspace package | `packages/codex-usage-analyzer/` | OK | Stage 2/3에서 SDK/CLI와 v2 contract module을 둔다. |
| `mydocs/working/task_m100_20_stage{N}.md` | `mydocs/working/` | `mydocs/working/task_m100_20_stage{N}.md` | OK | 각 Stage 완료 보고서 |
| `mydocs/report/task_m100_20_report.md` | `mydocs/report/` | `mydocs/report/task_m100_20_report.md` | OK | 최종 보고서 |

## 구현 방식 결정

- root app은 `private: true`를 유지하고, `workspaces: ["packages/*"]`를 추가한다.
- `packages/codex-usage-analyzer`는 독립 publish가 가능한 ESM package로 구성한다.
- analyzer package의 public SDK는 다음 API를 우선 제공한다.
  - `USAGE_SNAPSHOT_V2_SCHEMA_VERSION`
  - `validateUsageSnapshotV2(snapshot)`
  - `assertUsageSnapshotV2(snapshot)`
  - `isUsageSnapshotV2(snapshot)`
  - `createSampleUsageSnapshotV2(overrides?)`
  - `analyzeUsage(options?)`
- 초기 `analyzeUsage`는 실제 source parser 대신 sample/fixture-backed implementation으로 둔다. 실제 로컬 source parser는 후속 작업에서 교체할 수 있게 함수 경계를 고정한다.
- CLI는 `codex-usage-analyzer analyze --json`을 지원한다. 기본 출력은 validated `UsageSnapshot v2` JSON이다.
- profile 기존 `src/profile-snapshot/v2-*` 경로는 compatibility layer로 유지한다. 후속 profile code가 기존 import를 사용해도 깨지지 않게 analyzer package로 re-export한다.
- analyzer snapshot은 GitHub-facing fields와 credential/session material을 계속 거부한다.

## Stage 1 — 분리 경계와 migration inventory 확정

### 산출물

신규:

- `mydocs/tech/task_m100_20_analyzer_split_notes.md`
- `mydocs/working/task_m100_20_stage1.md`

수정:

- 필요 시 `mydocs/plans/task_m100_20_impl.md`

### 변경 내용

- 현재 v2 contract 소비 지점을 조사한다.
- profile app에 남을 책임과 analyzer package로 이동할 책임을 표로 정리한다.
- `UsageSnapshot v2` module 이동 후에도 유지해야 할 compatibility import 경로를 정리한다.
- wrapper package가 사용할 최소 API와 CLI contract를 고정한다.
- 원격 레포 분리 전 workspace package로 검증하는 이유와 후속 원격 분리 절차를 기록한다.

### 검증

```bash
rg -n "validateUsageSnapshotV2|assertUsageSnapshotV2|isUsageSnapshotV2|USAGE_SNAPSHOT_V2|sample-v2" src docs README.md package.json
git diff --check
```

### 커밋

```text
Task #20 Stage 1: analyzer 분리 경계 정리
```

## Stage 2 — analyzer workspace package 스캐폴드

### 산출물

신규:

- `packages/codex-usage-analyzer/package.json`
- `packages/codex-usage-analyzer/README.md`
- `packages/codex-usage-analyzer/bin/codex-usage-analyzer.js`
- `packages/codex-usage-analyzer/src/index.js`
- `packages/codex-usage-analyzer/src/cli.js`
- `packages/codex-usage-analyzer/src/analyze.js`
- `packages/codex-usage-analyzer/src/__tests__/cli.test.js`
- `packages/codex-usage-analyzer/src/__tests__/analyze.test.js`
- `mydocs/working/task_m100_20_stage2.md`

수정:

- `package.json`
- `package-lock.json`

### 변경 내용

- root package에 npm workspace 설정을 추가한다.
- analyzer package metadata를 독립 package로 작성한다.
- SDK entrypoint와 CLI entrypoint를 만든다.
- CLI는 `analyze --json`을 지원하고 stdout에 snapshot JSON만 출력한다.
- 잘못된 argument는 non-zero exit와 짧은 usage message를 반환한다.
- `analyzeUsage()`는 일단 sample snapshot을 validated output으로 반환한다.

### 검증

```bash
node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json
npm test -- packages/codex-usage-analyzer
git diff --check
```

### 커밋

```text
Task #20 Stage 2: analyzer workspace package 스캐폴드
```

## Stage 3 — v2 contract module canonical home 이동

### 산출물

신규:

- `packages/codex-usage-analyzer/src/snapshot/v2-schema.js`
- `packages/codex-usage-analyzer/src/snapshot/v2-types.d.ts`
- `packages/codex-usage-analyzer/src/fixtures/sample-v2-snapshot.js`
- `packages/codex-usage-analyzer/src/__tests__/snapshot-v2.test.js`
- 필요 시 `packages/codex-usage-analyzer/src/snapshot/index.js`
- `mydocs/working/task_m100_20_stage3.md`

수정:

- `src/profile-snapshot/v2-schema.js`
- `src/profile-snapshot/v2-types.d.ts`
- `src/profile-snapshot/fixtures/sample-v2-snapshot.js`
- `src/profile-snapshot/__tests__/v2-schema.test.js`
- `src/profile-snapshot/index.js`
- `src/profile-snapshot/types.d.ts`
- 필요 시 `packages/codex-usage-analyzer/src/index.js`

### 변경 내용

- `UsageSnapshot v2` validator/type/fixture의 canonical implementation을 analyzer package로 옮긴다.
- profile 기존 v2 files는 analyzer package를 re-export하거나 fixture를 pass-through한다.
- 기존 profile v2 tests는 compatibility path를 검증하도록 유지한다.
- analyzer package tests는 canonical path를 직접 검증한다.
- v1 `profile-snapshot` validator/normalize/selector path는 건드리지 않는다.

### 검증

```bash
npm test -- packages/codex-usage-analyzer src/profile-snapshot
node --test src/profile-snapshot/__tests__/v2-schema.test.js
git diff --check
```

### 커밋

```text
Task #20 Stage 3: UsageSnapshot v2 module analyzer 이동
```

## Stage 4 — wrapper compatibility와 문서 연결

### 산출물

신규:

- `docs/codex-usage-analyzer.md`
- `mydocs/working/task_m100_20_stage4.md`

수정:

- `README.md`
- `packages/codex-usage-analyzer/README.md`
- 필요 시 `docs/usage-snapshot-v2.md`
- 필요 시 `mydocs/tech/task_m100_20_analyzer_split_notes.md`

### 변경 내용

- 공식 문서에 analyzer SDK/CLI 책임, package boundary, wrapper integration 예시를 작성한다.
- `tokenmon` 같은 별도 제품은 analyzer SDK를 import하고 자체 login/submit/card rendering을 소유한다는 경계를 명시한다.
- profile app은 analyzer output을 submit API payload로 받는 consumer임을 README에 연결한다.
- 실제 원격 레포 생성, npm publish, parser 구현은 후속 작업으로 남긴다.
- 전체 검증 결과와 남은 한계를 Stage 4 보고서에 기록한다.

### 검증

```bash
node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json
npm test
npm run build
git status --short
git diff --check
```

### 커밋

```text
Task #20 Stage 4: analyzer wrapper 문서와 검증 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- workspace package 추가 후 root `npm test`가 analyzer package tests를 함께 발견하는지 확인한다.
- profile compatibility re-export가 기존 v2 import path를 깨지 않는지 확인한다.
- analyzer CLI stdout은 JSON consumer가 파싱할 수 있게 snapshot JSON만 출력한다.
- 공식 문서와 package README의 command/API 이름이 실제 export와 일치해야 한다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_20_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #20 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 최종 보고 단계는 `task-final-report` 절차를 사용한다.

## 단계 의존성

- Stage 2는 Stage 1에서 package boundary와 compatibility path가 정리된 뒤 진행한다.
- Stage 3은 Stage 2에서 workspace package와 CLI skeleton이 검증된 뒤 진행한다.
- Stage 4는 Stage 3에서 v2 canonical module 이동과 compatibility tests가 통과한 뒤 진행한다.

## 위험과 대응

- **workspace 설정으로 인한 root dependency churn**: `package-lock.json` 변경은 workspace 추가에 필요한 최소 변경만 허용한다.
- **self-reference import 실패**: workspace package를 root dependency로 연결하거나 상대 re-export를 사용하되, Node test와 Vite build가 모두 통과하는 방식을 선택한다.
- **CLI output 오염**: JSON mode에서는 stdout에 JSON만 쓰고, usage/error message는 stderr로 분리한다.
- **실제 parser 미구현 오해**: 문서와 README에서 이번 task의 analyzer는 contract-first skeleton이며 실제 source parser는 후속 작업임을 명시한다.
- **profile v1 회귀**: v1 files는 이동하지 않고 v2 compatibility만 조정한다.

## 승인 요청 사항

- 위 Stage 분할, 산출 파일, 검증 명령, 커밋 메시지를 승인해 달라.
- Stage 1을 `mydocs/tech/task_m100_20_analyzer_split_notes.md` migration inventory 작성부터 시작하는 것을 승인해 달라.
- Stage 2에서 root npm workspace와 `packages/codex-usage-analyzer/` 패키지 스캐폴드를 추가하는 것을 승인해 달라.
- Stage 3에서 `UsageSnapshot v2` canonical implementation을 analyzer package로 옮기고 profile 기존 경로를 compatibility re-export로 유지하는 것을 승인해 달라.
