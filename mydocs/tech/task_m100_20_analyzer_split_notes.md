# Task M100 #20 analyzer 분리 노트

GitHub Issue: [#20](https://github.com/postmelee/codex-usage-profile/issues/20)
마일스톤: M100

## 목적

`codex-usage-analyzer`를 `codex-usage-profile`에서 분리하기 전에 현재 `UsageSnapshot v2` contract가 어디에 있고, 어떤 API를 analyzer package로 옮겨야 하며, profile app에 어떤 compatibility 경로를 남겨야 하는지 정리한다.

이번 노트는 Stage 2 workspace package 스캐폴드와 Stage 3 v2 module 이동의 기준 문서다.

## 현재 상태 요약

| 영역 | 현재 위치 | 현재 역할 | 분리 판단 |
|---|---|---|---|
| v1 profile snapshot validator | `src/profile-snapshot/schema.js` | 기존 profile submit payload 검증 | profile app에 유지 |
| v1 profile snapshot normalizer | `src/profile-snapshot/normalize.js` | 현재 UI fixture와 profile view model 입력 생성 | profile app에 유지 |
| v1 profile selectors | `src/profile-snapshot/selectors.js` | profile page/share card view model 생성 | profile app에 유지 |
| v2 usage snapshot validator | `src/profile-snapshot/v2-schema.js` | analyzer-owned `UsageSnapshot v2` contract 검증 | analyzer package로 이동 |
| v2 usage snapshot types | `src/profile-snapshot/v2-types.d.ts` | `UsageSnapshot v2` type declaration | analyzer package로 이동 |
| v2 sample fixture | `src/profile-snapshot/fixtures/sample-v2-snapshot.js` | v2 validator와 후속 analyzer skeleton fixture | analyzer package로 이동 |
| v2 tests | `src/profile-snapshot/__tests__/v2-schema.test.js` | 현재 경로의 v2 validation regression | compatibility test로 유지 |
| backend submit service | `src/profile-backend/snapshots.js` | 현재는 v1 `validateProfileSnapshot`만 수용 | 이번 task에서 변경하지 않음 |
| official v2 contract | `docs/usage-snapshot-v2.md` | analyzer/profile 책임 경계 공식 문서 | 유지, Stage 4에서 analyzer 문서와 연결 |

## v2 소비 지점 inventory

현재 v2 관련 symbol은 production submit path가 아니라 contract/test path 중심으로 사용된다.

| Symbol 또는 파일 | 현재 소비 지점 | Stage 3 후 처리 |
|---|---|---|
| `USAGE_SNAPSHOT_V2_SCHEMA_VERSION` | `src/profile-snapshot/index.js`, `src/profile-snapshot/v2-types.d.ts`, v2 fixture | analyzer package에서 canonical export, profile path는 re-export |
| `validateUsageSnapshotV2` | `src/profile-snapshot/index.js`, v2 tests | analyzer package에서 canonical export, profile path는 re-export |
| `assertUsageSnapshotV2` | `src/profile-snapshot/index.js`, v2 tests | analyzer package에서 canonical export, profile path는 re-export |
| `isUsageSnapshotV2` | `src/profile-snapshot/index.js`, v2 tests | analyzer package에서 canonical export, profile path는 re-export |
| `sampleUsageSnapshotV2` | v2 tests | analyzer package fixture로 이동, profile fixture path는 pass-through export |
| `UsageSnapshotV2` types | `src/profile-snapshot/types.d.ts`의 `export *` | analyzer package type entry에서 canonical export, profile type entry는 re-export |

## 책임 경계

### analyzer package가 소유할 책임

- 로컬 usage source 분석 entrypoint
- `UsageSnapshot v2` JSON 생성
- `UsageSnapshot v2` runtime validation
- `UsageSnapshot v2` type declaration
- `UsageSnapshot v2` sample fixture
- CLI `analyze --json` output
- wrapper package가 import할 stable SDK API

### profile app이 계속 소유할 책임

- GitHub OAuth/session
- CLI submit token/device
- owner, handle, visibility, public/private routing
- web storage와 latest snapshot lookup
- profile UI, share UI, README image endpoint
- GitHub avatar, display name, bio 등 GitHub-facing fields 병합
- v1 profile snapshot path와 existing UI selectors

### 이번 task에서 연결하지 않는 책임

- backend submit service가 v2 snapshot을 직접 수용하도록 바꾸는 작업
- 실제 로컬 usage source parser 완성
- npm publish/release automation
- 새 원격 저장소 생성

## Stage 2 package boundary

Stage 2에서는 실제 module 이동 전에 package shell을 먼저 만든다.

| 파일 | 역할 |
|---|---|
| `packages/codex-usage-analyzer/package.json` | 독립 publish 가능한 package metadata와 `bin` 정의 |
| `packages/codex-usage-analyzer/bin/codex-usage-analyzer.js` | executable wrapper |
| `packages/codex-usage-analyzer/src/index.js` | public SDK entrypoint |
| `packages/codex-usage-analyzer/src/cli.js` | CLI argument parsing과 stdout/stderr 분리 |
| `packages/codex-usage-analyzer/src/analyze.js` | `analyzeUsage(options?)` SDK entrypoint |
| `packages/codex-usage-analyzer/src/__tests__/*` | CLI/SDK skeleton tests |

Stage 2의 `analyzeUsage()`는 sample-backed output으로 시작한다. 실제 parser는 function boundary만 고정하고 후속 작업에서 확장한다.

## Stage 3 module 이동 기준

Stage 3에서 v2 canonical module은 analyzer package로 옮긴다.

| 현재 경로 | canonical 경로 | compatibility 처리 |
|---|---|---|
| `src/profile-snapshot/v2-schema.js` | `packages/codex-usage-analyzer/src/snapshot/v2-schema.js` | 기존 파일은 analyzer module re-export |
| `src/profile-snapshot/v2-types.d.ts` | `packages/codex-usage-analyzer/src/snapshot/v2-types.d.ts` | 기존 파일은 analyzer type re-export |
| `src/profile-snapshot/fixtures/sample-v2-snapshot.js` | `packages/codex-usage-analyzer/src/fixtures/sample-v2-snapshot.js` | 기존 파일은 analyzer fixture re-export |
| `src/profile-snapshot/__tests__/v2-schema.test.js` | 유지 | compatibility path 검증 |

v1 files는 이동하지 않는다. `src/profile-snapshot/index.js`는 v1 public API와 v2 compatibility exports를 같이 제공하는 adapter로 유지한다.

## Public SDK 후보

Stage 2/3 완료 후 analyzer package는 다음 public API를 제공한다.

```js
import {
  USAGE_SNAPSHOT_V2_SCHEMA_VERSION,
  analyzeUsage,
  assertUsageSnapshotV2,
  createSampleUsageSnapshotV2,
  isUsageSnapshotV2,
  validateUsageSnapshotV2
} from "codex-usage-analyzer";
```

| API | 반환/역할 | 안정성 |
|---|---|---|
| `analyzeUsage(options?)` | `UsageSnapshot v2` object | Stage 2에서 skeleton, parser는 후속 확장 |
| `createSampleUsageSnapshotV2(overrides?)` | test/wrapper용 sample snapshot | Stage 2/3에서 제공 |
| `validateUsageSnapshotV2(value)` | `{ ok, errors }` | Stage 3 canonical |
| `assertUsageSnapshotV2(value)` | valid snapshot 또는 throw | Stage 3 canonical |
| `isUsageSnapshotV2(value)` | boolean type guard | Stage 3 canonical |
| `USAGE_SNAPSHOT_V2_SCHEMA_VERSION` | literal `2` | Stage 3 canonical |

## CLI contract 후보

```bash
npx codex-usage-analyzer@latest analyze --json
```

| 동작 | 기준 |
|---|---|
| stdout | JSON mode에서는 validated `UsageSnapshot v2` JSON만 출력 |
| stderr | usage, validation error, argument error 출력 |
| exit code `0` | snapshot 생성과 validation 성공 |
| exit code `1` | invalid option, analysis failure, validation failure |
| credentials | CLI output에 포함 금지 |

Stage 2에서는 `--json`을 필수로 둔다. 사람이 읽는 text output은 MVP 필수 흐름에 없으므로 후속으로 미룬다.

## Wrapper compatibility

`tokenmon` 같은 별도 제품은 analyzer를 직접 fork하지 않고 다음 흐름으로 감싼다.

1. wrapper CLI가 자체 login/session 또는 submit token을 준비한다.
2. wrapper CLI가 `codex-usage-analyzer` SDK의 `analyzeUsage()`를 호출한다.
3. wrapper CLI가 `assertUsageSnapshotV2()`로 출력물을 검증한다.
4. wrapper CLI가 자기 서비스의 submit API로 snapshot을 전송한다.
5. wrapper service가 GitHub-facing fields와 product-specific card fields를 web 계층에서 병합한다.

이 흐름에서는 analyzer snapshot에 GitHub login, GitHub avatar, GitHub bio, service token, device id가 들어가지 않는다.

## Root workspace 결정

이번 task는 새 원격 저장소를 바로 만들지 않고 root npm workspace로 검증한다.

| 선택지 | 장점 | 단점 | 결정 |
|---|---|---|---|
| 즉시 새 원격 저장소 생성 | 실제 배포 구조와 가까움 | GitHub 권한, npm publish, CI, PR 검증 범위가 커짐 | 이번 task 제외 |
| 현재 저장소 내부 workspace package | PR에서 코드/테스트를 함께 검증 가능, 후속 이동 쉬움 | package boundary가 물리적으로 완전 분리되지는 않음 | 이번 task 채택 |

후속 원격 분리는 package root를 기준으로 `codex-usage-analyzer` 저장소를 만들고, profile 쪽은 npm dependency 또는 git dependency로 전환하는 순서가 적절하다.

## Stage 2 handoff

- root `package.json`에 `workspaces: ["packages/*"]`를 추가한다.
- `npm install --package-lock-only` 또는 동등한 lockfile 갱신으로 workspace entry를 최소 변경한다.
- analyzer package는 dependency 없이 시작한다. v2 migration 전에는 profile v2 fixture를 상대 import하지 않고 Stage 2 자체 sample-backed skeleton을 둘 수 있다.
- CLI test는 stdout JSON parse, invalid args stderr/exit code, SDK output validation을 확인한다.

## Stage 3 handoff

- v2 canonical module 이동 후 profile 기존 tests가 여전히 같은 import path로 통과해야 한다.
- analyzer package tests는 canonical path를 직접 import해야 한다.
- root `npm test`가 `packages/codex-usage-analyzer/src/__tests__/*.test.js`를 발견하거나 package-local test script가 root test에서 실행되게 해야 한다.
- `package-lock.json` 변경은 workspace 연결에 필요한 범위로 제한한다.
