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

## Stage 2 — standalone source tree 구성

### 생성 경로

```text
/private/tmp/codex-usage-analyzer-standalone
```

### 포함 파일

Stage 2 기준 standalone tree는 15개 파일로 구성했다.

```text
.github/workflows/ci.yml
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

### README 조정

workspace staging 문구를 standalone repository 문맥으로 바꿨다.

- analyzer는 product-specific CLI와 web service가 재사용하는 package로 설명한다.
- GitHub login, submit token, public profile URL, rendered card는 wrapper product 책임으로 분리했다.
- local smoke command와 `npm test`를 root 기준으로 명시했다.
- npm publish, release automation, real local source parser는 follow-up work로 남겼다.

### CI 구성

`.github/workflows/ci.yml`을 추가했다.

- trigger: `pull_request`, `push` to `main`
- runtime: Node 20
- commands:
  - `npm test`
  - `node bin/codex-usage-analyzer.js analyze --json`

### package-lock 판단

`package-lock.json`은 추가하지 않았다.

이유:

- 현재 package에는 runtime/dev dependency가 없다.
- `npm test`와 CLI smoke가 install 없이 실행된다.
- npm publish/release automation은 이번 task 범위 밖이다.

### standalone local git 상태

```text
branch: main
commit: 9a67be4 Initial codex-usage-analyzer package
status: clean
```

### 검증 결과

`npm test`

- tests: 6
- pass: 6
- fail: 0

`node bin/codex-usage-analyzer.js analyze --json`

- exit code: 0
- stdout: `schemaVersion: 2`, `producer.name: codex-usage-analyzer`를 포함한 sample-backed `UsageSnapshot v2` JSON

`git diff --cached --check`

- OK: whitespace 경고 없음

### Stage 3 인계

- `/private/tmp/codex-usage-analyzer-standalone`은 commit `9a67be4`를 가진 clean local repository 상태다.
- Stage 3에서 `postmelee/codex-usage-analyzer` remote repository를 생성하고 이 commit을 push한다.

## Stage 3 — GitHub repository 생성과 초기 push

### 생성 결과

```text
repository: postmelee/codex-usage-analyzer
url: https://github.com/postmelee/codex-usage-analyzer
visibility: PUBLIC
default branch: main
initial commit: 9a67be481766f198db5e1029192ac96bef6c2604
```

### 실행 명령

```bash
gh repo create postmelee/codex-usage-analyzer --public --source /private/tmp/codex-usage-analyzer-standalone --remote origin --push
```

결과:

- repository 생성 성공
- `HEAD -> main` push 성공
- local branch `main`이 `origin/main`을 tracking하도록 설정됨

### 검증 결과

`gh repo view postmelee/codex-usage-analyzer --json nameWithOwner,visibility,url,defaultBranchRef`

```json
{
  "defaultBranchRef": { "name": "main" },
  "nameWithOwner": "postmelee/codex-usage-analyzer",
  "url": "https://github.com/postmelee/codex-usage-analyzer",
  "visibility": "PUBLIC"
}
```

`git ls-remote https://github.com/postmelee/codex-usage-analyzer.git`

```text
9a67be481766f198db5e1029192ac96bef6c2604 HEAD
9a67be481766f198db5e1029192ac96bef6c2604 refs/heads/main
```

Standalone local repository status:

```text
origin: https://github.com/postmelee/codex-usage-analyzer.git
branch: main...origin/main
status: clean
```

### Stage 4 인계

- profile repo 문서에 standalone repository URL을 반영한다.
- workspace copy는 이번 task에서 유지하고, standalone repository가 canonical distribution target임을 문서화한다.
- 후속 task에서 npm publish 또는 pinned GitHub dependency 방식으로 profile dependency 전환을 결정한다.

## Stage 4 — profile repo 연동 문서 정리

### 문서 반영

수정 파일:

```text
README.md
docs/codex-usage-analyzer.md
packages/codex-usage-analyzer/README.md
```

반영 내용:

- standalone repository URL: `https://github.com/postmelee/codex-usage-analyzer`
- standalone repository가 analyzer package의 canonical distribution target임을 명시
- `packages/codex-usage-analyzer/`는 temporary workspace compatibility copy로 유지한다고 명시
- npm publish 전까지 profile submit CLI 작업이 local workspace copy로 안정적으로 진행될 수 있음을 기록
- 후속 dependency transition 후보를 정리

### dependency transition 후보

| Option | When to use | Tradeoff |
|---|---|---|
| npm semver dependency | analyzer parser와 submit flow가 end-to-end smoke를 통과한 뒤 | 사용자 경험이 가장 좋지만 publish/release policy가 필요하다. |
| pinned GitHub dependency | npm publish 전 standalone repo를 직접 소비해야 할 때 | npm release 없이 가능하지만 install이 GitHub network에 묶인다. |
| temporary workspace copy | M100 submit CLI 구현 중 local test 안정성이 더 중요할 때 | local test는 안정적이지만 standalone repo와 source drift가 생길 수 있다. |

### 최종 판단

이번 task에서는 workspace copy를 제거하지 않는다. npm publish가 제외되어 있고, profile submit CLI가 아직 구현 중이므로 local workspace copy를 유지하는 편이 M100 검증 안정성에 유리하다.

### remote CI 확인

`postmelee/codex-usage-analyzer`의 push-triggered CI도 확인했다.

```text
workflow: CI
run: https://github.com/postmelee/codex-usage-analyzer/actions/runs/27426641635
head: 9a67be481766f198db5e1029192ac96bef6c2604
status: completed
conclusion: success
```
