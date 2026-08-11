# Task M100 #19 Stage 3 완료 보고서

GitHub Issue: [#19](https://github.com/postmelee/codex-usage-profile/issues/19)
구현계획서: [`task_m100_19_impl.md`](../plans/task_m100_19_impl.md)
Stage: 3

## 단계 목적

Stage 3의 목적은 Stage 2 공식 계약 문서를 기준으로 `UsageSnapshot v2` runtime contract skeleton을 추가하는 것이다.

이번 단계에서는 기존 v1 validator/export를 유지한 채 v2 전용 validator, type declaration, sample fixture, test를 별도 파일로 추가했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-snapshot/v2-schema.js` | `USAGE_SNAPSHOT_V2_SCHEMA_VERSION`, `validateUsageSnapshotV2`, `assertUsageSnapshotV2`, `isUsageSnapshotV2`를 추가했다. v2 required object, token breakdown, model usage, activity, skills/plugins, codex assets, extensions, credential/GitHub-facing field rejection을 검증한다. |
| `src/profile-snapshot/v2-types.d.ts` | `UsageSnapshotV2`와 하위 interface/type declaration을 추가했다. |
| `src/profile-snapshot/fixtures/sample-v2-snapshot.js` | 공식 문서 형태를 따르는 sample v2 snapshot fixture를 추가했다. |
| `src/profile-snapshot/__tests__/v2-schema.test.js` | sample/minimal v2 snapshot, unknown fields, invalid daily usage, GitHub-facing fields, credential-like keys/values, extension namespace, assert error 테스트를 추가했다. |
| `src/profile-snapshot/index.js` | v2 validator API를 추가 export했다. |
| `src/profile-snapshot/types.d.ts` | v2 type declaration re-export를 추가했다. |
| `mydocs/working/task_m100_19_stage3.md` | Stage 3 검증 결과와 다음 단계 영향 보고서를 추가했다. |

## 본문 변경 정도 / 본문 무손실 여부

기존 v1 `schema.js`, `normalize.js`, `selectors.js`는 수정하지 않았다. v2는 별도 module로 추가했고, 기존 v1 export는 유지한 상태에서 v2 export만 추가했다. 따라서 기존 v1 snapshot validator와 profile preview path는 보존된다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-snapshot
npm test -- src/profile-snapshot/__tests__/schema.test.js src/profile-snapshot/__tests__/v2-schema.test.js
npm test -- src/profile-snapshot/__tests__/normalize.test.js src/profile-snapshot/__tests__/selectors.test.js
npm test
git diff --check
```

결과:

- OK: 계획서상 Stage 3 명령인 `npm test -- src/profile-snapshot`가 통과했다.
- OK: v1 schema와 v2 schema 테스트 직접 실행 결과 13개 테스트가 모두 통과했다.
- OK: v1 normalize/selector 테스트 직접 실행 결과 12개 테스트가 모두 통과했다.
- OK: 전체 `npm test` 결과 130개 테스트가 모두 통과했다.
- OK: `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- `validateUsageSnapshotV2`는 v2 skeleton으로 추가되었지만, backend submit path는 아직 v1 `validateProfileSnapshot`만 사용한다. 실제 v2 submit 수용은 후속 #5/#20 또는 별도 migration 단계에서 연결해야 한다.
- `extensions`는 namespaced key를 허용하지만 내부 값은 credential/GitHub-facing field scan 외에는 product-specific 구조를 강하게 검증하지 않는다. product-specific contract가 생기면 별도 namespace validator가 필요할 수 있다.
- GitHub-facing value 자체를 URL 패턴으로 모두 차단하지는 않는다. 현재는 field/key 기준과 credential-like value 기준을 우선 적용했다.

## 다음 단계 영향

- Stage 4에서는 README에 `docs/usage-snapshot-v2.md` 링크와 analyzer/profile 책임 경계를 짧게 연결한다.
- #20 analyzer 분리 작업은 `validateUsageSnapshotV2`와 `UsageSnapshotV2` type declaration을 SDK/CLI output 기준으로 사용할 수 있다.
- #5 profile submit CLI는 analyzer output을 v2 validator로 검사한 뒤 submit wrapper에 넣는 방향으로 이어받을 수 있다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 README 연결과 후속 handoff 정리로 진행한다.
