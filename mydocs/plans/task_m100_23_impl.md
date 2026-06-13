# Task M100 #23 구현계획서

수행계획서: [`task_m100_23.md`](task_m100_23.md)
GitHub Issue: [#23](https://github.com/postmelee/codex-usage-profile/issues/23)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | standalone 분리 전략과 repository 상태 확정 | `mydocs/tech/task_m100_23_standalone_split_notes.md` 초안 | package inventory, repo 중복 조회, analyzer workspace test |
| 2 | standalone source tree 구성과 로컬 검증 | `/private/tmp/codex-usage-analyzer-standalone` source tree, CI/metadata 초안 | standalone `npm test`, CLI smoke |
| 3 | GitHub repository 생성과 초기 push | `postmelee/codex-usage-analyzer` remote repository, initial commit | `gh repo view`, remote fetch/ls-remote |
| 4 | profile repo 연동 문서와 후속 전환 정리 | `docs/codex-usage-analyzer.md`, README/기술 노트 보강 | profile docs grep, full diff check |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| analyzer standalone `README.md` | standalone repo root | `/private/tmp/codex-usage-analyzer-standalone/README.md`, remote repo root | OK | Stage 2에서 root 문서로 정리하고 Stage 3에서 push한다. |
| analyzer standalone `.github/workflows/ci.yml` | standalone repo | `/private/tmp/codex-usage-analyzer-standalone/.github/workflows/ci.yml` | OK | Stage 2에서 추가하고 Stage 3에서 push한다. |
| `docs/codex-usage-analyzer.md` | `docs/` | `docs/codex-usage-analyzer.md` | OK | Stage 4에서 standalone repo URL과 profile dependency 전환 방향을 반영한다. |
| `mydocs/tech/task_m100_23_standalone_split_notes.md` | `mydocs/tech/` | `mydocs/tech/task_m100_23_standalone_split_notes.md` | OK | Stage 1부터 repository 생성 판단, 명령, 검증 결과를 누적 기록한다. |
| `mydocs/working/task_m100_23_stage{N}.md` | `mydocs/working/` | `mydocs/working/task_m100_23_stage{N}.md` | OK | 각 Stage 완료 보고서 |
| `mydocs/report/task_m100_23_report.md` | `mydocs/report/` | `mydocs/report/task_m100_23_report.md` | OK | 최종 보고서 |

## 구현 방식 결정

- standalone repo는 clean initial import로 만든다. `packages/codex-usage-analyzer/`의 package root를 새 repo root로 올리고, monorepo 작업 문서와 profile app history는 옮기지 않는다.
- local assembly 경로는 `/private/tmp/codex-usage-analyzer-standalone`을 사용한다. 이 경로는 profile repo tracked files와 분리되어 있고, GitHub repo 생성 전 독립 테스트를 실행하기 쉽다.
- 새 repository 이름은 `postmelee/codex-usage-analyzer`, visibility는 public으로 한다.
- standalone repo의 초기 branch는 GitHub 계정 기본 branch 설정을 따른다. 생성 후 `gh repo view`로 default branch를 확인한다.
- standalone package는 npm publish 전이므로 `package-lock.json`은 새 repo에 추가하지 않는다. 현재 dependency가 없고, CI는 `npm test`와 CLI smoke를 직접 실행한다.
- `codex-usage-profile`의 `packages/codex-usage-analyzer/` workspace copy는 이번 task에서 제거하지 않는다. 후속 submit CLI 작업이 npm publish 전 외부 dependency에 묶이지 않도록 compatibility copy로 유지한다.
- profile repo 문서에는 standalone repo가 canonical distribution target이고, workspace copy는 전환기 compatibility copy라는 점을 명시한다.

## Stage 1 — standalone 분리 전략과 repository 상태 확정

### 산출물

신규:

- `mydocs/tech/task_m100_23_standalone_split_notes.md`
- `mydocs/working/task_m100_23_stage1.md`

수정:

- 필요 시 `mydocs/plans/task_m100_23_impl.md`

### 변경 내용

- analyzer workspace package 파일 목록, package metadata, CLI/test entrypoint를 점검한다.
- clean initial import를 최종 방식으로 확정하고, subtree split을 선택하지 않는 이유를 기록한다.
- `postmelee/codex-usage-analyzer` repository가 이미 존재하는지 확인한다.
- Stage 2에서 standalone tree에 포함할 파일과 제외할 파일을 inventory로 고정한다.
- 현재 workspace analyzer test와 CLI smoke를 실행해 분리 전 기준을 남긴다.

### 검증

```bash
find packages/codex-usage-analyzer -type f | sort
npm --workspace codex-usage-analyzer test
node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json
gh repo view postmelee/codex-usage-analyzer --json nameWithOwner,visibility,url,defaultBranchRef
git diff --check
```

`gh repo view`는 repository가 없는 경우 실패하는 것이 정상일 수 있다. 실패 시 "없음 확인"으로 기록하고, 권한/네트워크 실패와 구분한다.

### 커밋

```text
Task #23 Stage 1: standalone 분리 전략 정리
```

## Stage 2 — standalone source tree 구성과 로컬 검증

### 산출물

외부 작업 tree:

- `/private/tmp/codex-usage-analyzer-standalone/README.md`
- `/private/tmp/codex-usage-analyzer-standalone/package.json`
- `/private/tmp/codex-usage-analyzer-standalone/bin/codex-usage-analyzer.js`
- `/private/tmp/codex-usage-analyzer-standalone/src/**`
- `/private/tmp/codex-usage-analyzer-standalone/.github/workflows/ci.yml`

현재 repo:

- `mydocs/working/task_m100_23_stage2.md`
- `mydocs/tech/task_m100_23_standalone_split_notes.md` 보강

### 변경 내용

- `packages/codex-usage-analyzer/` 파일을 standalone repo root 구조로 복사한다.
- package metadata가 standalone publish-ready 형태인지 확인한다.
- README에서 workspace staging 표현을 standalone repository 표현으로 바꾼다.
- GitHub Actions CI를 추가한다. CI는 Node 20 기준 `npm test`와 CLI smoke를 실행한다.
- 새 source tree에서 `git init`, initial commit 준비까지 수행하되 remote push는 Stage 3에서 한다.

### 검증

```bash
cd /private/tmp/codex-usage-analyzer-standalone
npm test
node bin/codex-usage-analyzer.js analyze --json
git status --short
git diff --check
```

### 커밋

현재 repo stage report/notes 커밋:

```text
Task #23 Stage 2: standalone source tree 검증
```

standalone repo local initial commit:

```text
Initial codex-usage-analyzer package
```

## Stage 3 — GitHub repository 생성과 초기 push

### 산출물

외부 remote:

- `https://github.com/postmelee/codex-usage-analyzer`
- standalone repository initial commit

현재 repo:

- `mydocs/working/task_m100_23_stage3.md`
- `mydocs/tech/task_m100_23_standalone_split_notes.md` 보강

### 변경 내용

- `gh repo create postmelee/codex-usage-analyzer --public --source /private/tmp/codex-usage-analyzer-standalone --push` 계열 명령으로 remote repo를 생성한다.
- 생성 후 default branch, visibility, URL, pushed commit SHA를 확인한다.
- `git ls-remote` 또는 fresh fetch로 remote가 실제 commit을 노출하는지 확인한다.
- repository가 이미 존재하면 덮어쓰지 않고 Stage 3을 중단하고 작업지시자에게 보고한다.

### 검증

```bash
gh repo view postmelee/codex-usage-analyzer --json nameWithOwner,visibility,url,defaultBranchRef
git ls-remote https://github.com/postmelee/codex-usage-analyzer.git
```

### 커밋

```text
Task #23 Stage 3: analyzer GitHub repository 생성
```

## Stage 4 — profile repo 연동 문서와 후속 전환 정리

### 산출물

신규:

- `mydocs/working/task_m100_23_stage4.md`

수정:

- `docs/codex-usage-analyzer.md`
- `packages/codex-usage-analyzer/README.md`
- 필요 시 `README.md`
- `mydocs/tech/task_m100_23_standalone_split_notes.md`

### 변경 내용

- profile repo 문서에 standalone repository URL과 현재 workspace copy의 전환기 역할을 명시한다.
- 후속 task에서 선택할 dependency 전환 방식 후보를 정리한다.
  - npm publish 후 semver dependency
  - npm publish 전 pinned GitHub dependency
  - workspace copy 제거 시점
- `tokenmon` 같은 wrapper가 standalone analyzer를 dependency로 사용할 수 있다는 경계를 README 또는 docs에 보강한다.
- 최종 검증 범위와 남은 한계를 Stage 4 보고서에 기록한다.

### 검증

```bash
rg -n "codex-usage-analyzer|standalone|UsageSnapshot v2" README.md docs packages mydocs
npm --workspace codex-usage-analyzer test
npm test
npm run build
git status --short --branch --untracked-files=no
git diff --check
```

### 커밋

```text
Task #23 Stage 4: standalone 연동 문서 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 외부 GitHub repository 생성 명령은 Stage 3에서만 실행한다.
- 외부 repository가 이미 존재하면 덮어쓰거나 삭제하지 않는다.
- standalone repo initial commit SHA와 remote URL은 `mydocs/tech/task_m100_23_standalone_split_notes.md`와 Stage 3 보고서에 기록한다.
- profile repo 최종 PR에는 외부 repo 생성 사실, profile repo 변경 범위, 후속 dependency 전환 리스크가 모두 남아야 한다.
- profile repo tracked worktree는 PR 준비 전 clean이어야 한다.

## 커밋

- 현재 repo 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_23_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #23 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- standalone repo에는 Stage 2/3에서 별도 `Initial codex-usage-analyzer package` commit을 만들고, Stage 3에서 push한다.
- 최종 보고 단계는 `task-final-report` 절차를 사용한다.

## 단계 의존성

- Stage 2는 Stage 1에서 repository 미존재 또는 안전한 생성 가능 상태가 확인된 뒤 진행한다.
- Stage 3은 Stage 2 standalone tree의 test와 CLI smoke가 통과한 뒤 진행한다.
- Stage 4는 Stage 3 remote repository 생성과 push가 검증된 뒤 진행한다.

## 위험과 대응

- **repository 이름 충돌**: `gh repo view`가 기존 repository를 반환하면 Stage 3 생성은 중단한다. 기존 repository 재사용 여부는 작업지시자 확인 후 별도 결정한다.
- **외부 repo 생성 권한 부족**: `gh repo create`가 권한 문제로 실패하면 현재 repo 변경은 유지하고, Stage 3 보고서 대신 차단 보고를 작성한다.
- **임시 tree 손실**: `/private/tmp` tree는 재생성 가능한 산출물로 취급한다. Stage 2 notes에 포함 파일 목록과 생성 절차를 기록해 손실 시 복구 가능하게 한다.
- **중복 source drift**: workspace copy와 standalone repo가 일시적으로 중복된다. 이번 task 후속 전환 항목에 canonical source와 제거 시점을 남긴다.
- **CI 과잉 구성**: npm publish와 release automation은 제외한다. CI는 Node 20 test와 CLI smoke만 둔다.

## 승인 요청 사항

- 위 Stage 분할, 산출 파일, 검증 명령, 커밋 메시지를 승인해 달라.
- Stage 1을 `mydocs/tech/task_m100_23_standalone_split_notes.md` 작성과 repository 중복 조회부터 시작하는 것을 승인해 달라.
- Stage 2에서 `/private/tmp/codex-usage-analyzer-standalone`에 standalone source tree를 구성하고 로컬 initial commit을 만드는 것을 승인해 달라.
- Stage 3에서 `postmelee/codex-usage-analyzer` public repository를 생성하고 initial commit을 push하는 것을 승인해 달라.
