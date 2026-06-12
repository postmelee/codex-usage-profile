# Task M100 #23 standalone repository split notes

GitHub Issue: [#23](https://github.com/postmelee/codex-usage-profile/issues/23)

## Stage 1 — 분리 전략 확정

### 결론

- 분리 방식은 clean initial import로 확정한다.
- 새 repository 이름은 `postmelee/codex-usage-analyzer`로 유지한다.
- 새 repository visibility는 public으로 둔다.
- `codex-usage-profile`의 workspace package는 이번 task에서 제거하지 않는다.
- npm publish와 profile repo dependency 교체는 후속 task로 분리한다.

### clean initial import 선택 이유

`packages/codex-usage-analyzer/`는 #20에서 독립 package 형태로 정리되었지만, 해당 변경의 히스토리는 profile web app, Hyper-Waterfall 작업 문서, M100 전체 작업 흐름과 함께 묶여 있다.

standalone analyzer repository의 첫 사용자는 package code, CLI, SDK contract, README, CI를 기대한다. 따라서 profile repo 내부 작업 히스토리까지 가져오는 subtree split보다 package root를 새 repository root로 올리는 clean initial import가 읽기 쉽고 유지보수하기 쉽다.

subtree split은 이번 task에서 사용하지 않는다. 향후 히스토리 보존이 강하게 필요해지면 별도 migration task에서 검토한다.

### repository 존재 확인

실행 명령:

```bash
gh repo view postmelee/codex-usage-analyzer --json nameWithOwner,visibility,url,defaultBranchRef
```

결과:

- `GraphQL: Could not resolve to a Repository with the name 'postmelee/codex-usage-analyzer'.`
- 해석: repository 이름 충돌 없음. Stage 3에서 새 repository 생성 가능.

### 현재 analyzer package inventory

Stage 1 기준 포함 후보 파일:

```text
README.md
bin/codex-usage-analyzer.js
package.json
src/__tests__/analyze.test.js
src/__tests__/cli.test.js
src/__tests__/snapshot-v2.test.js
src/analyze.js
src/cli.js
src/fixtures/sample-v2-snapshot.js
src/index.d.ts
src/index.js
src/snapshot/index.js
src/snapshot/v2-schema.js
src/snapshot/v2-types.d.ts
```

Stage 2에서 추가할 standalone repository 파일:

```text
.github/workflows/ci.yml
```

Stage 2에서 제외할 파일:

```text
package-lock.json
```

제외 이유:

- 현재 analyzer package는 runtime/dev dependency가 없다.
- npm publish와 release automation은 이번 task 범위에서 제외되어 있다.
- dependency가 생기면 standalone repository에서 lockfile 정책을 별도 결정한다.

### package metadata 기준

현재 `packages/codex-usage-analyzer/package.json` 기준:

- package name: `codex-usage-analyzer`
- version: `0.1.0`
- module type: ESM
- Node engine: `>=20`
- bin: `codex-usage-analyzer`
- public exports: `.` import/types
- test command: `node --test`

Stage 2에서는 이 metadata를 standalone repository root에 그대로 사용하되, README의 workspace staging 표현은 standalone repository 기준으로 고친다.

### 검증 기준선

`npm --workspace codex-usage-analyzer test`

- tests: 6
- pass: 6
- fail: 0

`node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json`

- exit code: 0
- stdout: `schemaVersion: 2`, `producer.name: codex-usage-analyzer`, sample-backed `UsageSnapshot v2` JSON

## Stage 2 인계

- `/private/tmp/codex-usage-analyzer-standalone`에 standalone source tree를 구성한다.
- `packages/codex-usage-analyzer/`의 14개 package 파일을 root로 복사한다.
- `.github/workflows/ci.yml`을 추가한다.
- README를 standalone repository 문맥으로 갱신한다.
- 새 tree에서 `npm test`와 CLI smoke를 통과시킨 뒤 local initial commit을 만든다.
