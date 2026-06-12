# Task M100 #20 Stage 3 보고서

GitHub Issue: [#20](https://github.com/postmelee/codex-usage-profile/issues/20)
구현계획서: [`task_m100_20_impl.md`](../plans/task_m100_20_impl.md)
Stage: 3

## 단계 목적

Stage 3은 `UsageSnapshot v2` validator/type/fixture의 canonical home을 `codex-usage-analyzer` package로 옮기고, 기존 `src/profile-snapshot` v2 경로를 compatibility adapter로 유지하는 단계다.

이번 단계에서는 analyzer package가 v2 contract를 직접 export하게 만들고, profile 기존 import path가 계속 동작하는지 검증했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-analyzer/src/snapshot/v2-schema.js` | v2 runtime validator의 canonical implementation을 추가했다. |
| `packages/codex-usage-analyzer/src/snapshot/v2-types.d.ts` | v2 type declaration의 canonical implementation을 추가했다. |
| `packages/codex-usage-analyzer/src/snapshot/index.js` | analyzer package 내부 snapshot barrel export를 추가했다. |
| `packages/codex-usage-analyzer/src/fixtures/sample-v2-snapshot.js` | v2 sample fixture의 canonical implementation을 추가했다. |
| `packages/codex-usage-analyzer/src/index.js` | v2 validator와 sample fixture를 package public export에 추가했다. |
| `packages/codex-usage-analyzer/src/index.d.ts` | analyzer package public type entry를 추가했다. |
| `packages/codex-usage-analyzer/package.json` | `types`와 typed `exports`를 추가했다. |
| `packages/codex-usage-analyzer/src/analyze.js` | embedded sample object를 제거하고 canonical fixture/validator를 사용하게 변경했다. |
| `packages/codex-usage-analyzer/src/__tests__/analyze.test.js` | analyzer canonical export로 SDK output을 검증하게 변경했다. |
| `packages/codex-usage-analyzer/src/__tests__/cli.test.js` | analyzer canonical export로 CLI output을 검증하게 변경했다. |
| `packages/codex-usage-analyzer/src/__tests__/snapshot-v2.test.js` | analyzer canonical v2 contract export와 GitHub-facing field rejection을 검증하는 테스트를 추가했다. |
| `src/profile-snapshot/v2-schema.js` | 기존 profile v2 schema path를 analyzer package re-export adapter로 전환했다. |
| `src/profile-snapshot/v2-types.d.ts` | 기존 profile v2 type path를 v2 전용 re-export adapter로 전환했다. |
| `src/profile-snapshot/fixtures/sample-v2-snapshot.js` | 기존 profile fixture path를 analyzer fixture re-export adapter로 전환했다. |
| `mydocs/working/task_m100_20_stage3.md` | Stage 3 완료 보고서와 검증 결과를 작성했다. |

## 본문 변경 정도 / 본문 무손실 여부

- v2 validator/type/fixture 본문은 analyzer package의 canonical 경로로 보존했다.
- profile 기존 v2 files는 public path 보존을 위해 re-export adapter로 축소했다.
- v1 `profile-snapshot` validator, normalizer, selector, backend submit path는 수정하지 않았다.
- `analyzeUsage()`는 Stage 2의 embedded sample을 제거하고 canonical sample fixture를 검증한 뒤 반환하도록 변경했다.

## 검증 결과

실행 명령:

```bash
npm --workspace codex-usage-analyzer test
npm test -- src/profile-snapshot
node --test src/profile-snapshot/__tests__/v2-schema.test.js
node --test src/profile-snapshot/__tests__/*.test.js
npm test
npm run build
git diff --check
```

결과:

- OK — `npm --workspace codex-usage-analyzer test` 6개 테스트 통과.
- OK — `npm test -- src/profile-snapshot` 통과.
- OK — `node --test src/profile-snapshot/__tests__/v2-schema.test.js` 8개 테스트 통과.
- OK — `node --test src/profile-snapshot/__tests__/*.test.js` 25개 테스트 통과.
- OK — root `npm test` 136개 테스트 통과.
- OK — `npm run build` 통과.
- OK — `git diff --check` 경고 없음.

참고:

- 로컬 `node_modules`는 Stage 2 workspace 추가 전 상태였기 때문에 `npm install --ignore-scripts`를 한 번 실행해 workspace symlink를 반영한 뒤 profile compatibility 검증을 재실행했다. tracked file 변경은 발생하지 않았다.

## 잔여 위험

- profile compatibility adapter는 workspace package bare import에 의존한다. fresh install 환경에서는 workspace link가 생성되어야 한다.
- analyzer package는 아직 실제 local source parser를 제공하지 않는다. `analyzeUsage()`는 canonical fixture 기반 skeleton이다.
- backend submit path는 여전히 v1 snapshot만 검증한다. v2 submit 수용은 후속 submit CLI/API 작업에서 연결해야 한다.

## 다음 단계 영향

- Stage 4에서는 README와 공식 analyzer 문서에서 canonical v2 export와 wrapper usage를 명시해야 한다.
- Stage 4에서는 실제 원격 저장소 생성과 npm publish가 이번 task 범위 밖이며 #20 merge 이후 별도 bootstrap 이슈로 진행하는 것이 적절하다는 handoff를 남긴다.
- #5 submit CLI는 analyzer SDK의 `analyzeUsage()`와 `assertUsageSnapshotV2()`를 호출한 뒤 profile service submit API로 전송하는 wrapper로 설계하면 된다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 wrapper compatibility와 문서 연결로 진행한다.
