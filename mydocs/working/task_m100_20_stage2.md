# Task M100 #20 Stage 2 보고서

GitHub Issue: [#20](https://github.com/postmelee/codex-usage-profile/issues/20)
구현계획서: [`task_m100_20_impl.md`](../plans/task_m100_20_impl.md)
Stage: 2

## 단계 목적

Stage 2는 `codex-usage-analyzer`를 현재 저장소 안의 export-ready workspace package로 스캐폴드하는 단계다.

이번 단계에서는 root npm workspace를 추가하고, analyzer package의 SDK entrypoint, CLI entrypoint, sample-backed `analyzeUsage()` skeleton, CLI/SDK tests를 만들었다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `package.json` | root workspace `packages/*`를 추가했다. |
| `package-lock.json` | `codex-usage-analyzer` workspace link entry를 추가했다. |
| `packages/codex-usage-analyzer/package.json` | analyzer package metadata, `bin`, `exports`, package-local test script를 추가했다. |
| `packages/codex-usage-analyzer/README.md` | analyzer CLI/SDK 사용법과 web 계층과의 책임 경계를 문서화했다. |
| `packages/codex-usage-analyzer/bin/codex-usage-analyzer.js` | executable CLI wrapper를 추가했다. |
| `packages/codex-usage-analyzer/src/index.js` | public SDK entrypoint를 추가했다. |
| `packages/codex-usage-analyzer/src/analyze.js` | sample-backed `analyzeUsage()`와 `createSampleUsageSnapshotV2()`를 추가했다. |
| `packages/codex-usage-analyzer/src/cli.js` | `analyze --json` CLI argument handling과 stdout/stderr 분리를 추가했다. |
| `packages/codex-usage-analyzer/src/__tests__/analyze.test.js` | SDK output이 기존 v2 validator를 통과하는지 검증했다. |
| `packages/codex-usage-analyzer/src/__tests__/cli.test.js` | CLI JSON output과 invalid argument behavior를 검증했다. |
| `mydocs/plans/task_m100_20_impl.md` | package directory가 `package.json`을 가진 workspace가 되면서 Node test runner가 디렉터리를 package entry로 해석하는 문제를 반영해 Stage 2/3 검증 명령을 workspace test 명령으로 바로잡았다. |
| `mydocs/working/task_m100_20_stage2.md` | Stage 2 완료 보고서와 검증 결과를 작성했다. |

## 본문 변경 정도 / 본문 무손실 여부

- 신규 analyzer package 파일 8개, 총 319 lines를 추가했다.
- root package metadata와 lockfile은 workspace 연결에 필요한 최소 범위로 수정했다.
- 기존 profile source는 수정하지 않았다.
- 구현계획서 검증 명령은 실제 npm workspace 동작에 맞춰 좁게 수정했다.

## 검증 결과

실행 명령:

```bash
node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json
npm --workspace codex-usage-analyzer test
npm test
git diff --check
```

결과:

- OK — CLI `analyze --json`은 stdout에 `UsageSnapshot v2` JSON만 출력했다.
- OK — `npm --workspace codex-usage-analyzer test` 4개 테스트 통과.
- OK — root `npm test` 134개 테스트 통과. analyzer package tests도 root test discovery에 포함됨을 확인했다.
- OK — `git diff --check` 경고 없음.

참고:

- 최초 구현계획서의 `npm test -- packages/codex-usage-analyzer`는 package directory가 `package.json`을 가진 뒤 현재 Node test runner에서 recursive test target이 아니라 package entry로 해석되어 실패했다. Stage 2 중 구현계획서를 `npm --workspace codex-usage-analyzer test`로 수정했고, 수정된 검증 명령은 통과했다.

## 잔여 위험

- Stage 2 analyzer package는 sample-backed skeleton이다. 실제 로컬 source parser는 아직 없다.
- Stage 2 package는 아직 v2 validator를 직접 export하지 않는다. canonical v2 validator/type/fixture 이동은 Stage 3에서 진행한다.
- package metadata에는 publish automation, repository URL, license 결정이 아직 없다. 실제 원격 저장소 생성과 publish 준비 시 별도로 확정해야 한다.

## 다음 단계 영향

- Stage 3에서는 `src/profile-snapshot/v2-*`와 `sample-v2-snapshot`의 canonical implementation을 analyzer package로 옮긴다.
- Stage 3에서는 profile 기존 v2 import path를 compatibility re-export로 유지해야 한다.
- Stage 3 이후 analyzer SDK는 `validateUsageSnapshotV2`, `assertUsageSnapshotV2`, `isUsageSnapshotV2`, `USAGE_SNAPSHOT_V2_SCHEMA_VERSION`도 public export로 제공해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 `UsageSnapshot v2` module analyzer 이동으로 진행한다.
