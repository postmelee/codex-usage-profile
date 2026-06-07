# Task M100 #2 Stage 1 완료 보고서

GitHub Issue: [#2](https://github.com/postmelee/codex-usage-profile/issues/2)
구현계획서: [`task_m100_2_impl.md`](../plans/task_m100_2_impl.md)
Stage: 1

## 단계 목적

Stage 1의 목적은 root 제품 코드 scaffold가 없는 상태에서 dependency-free ESM 기반의 최소 package/test 구조를 만들고, Codex profile snapshot의 첫 runtime schema, TypeScript declaration 계약, sample fixture, schema validation 테스트를 고정하는 것이다.

이번 단계에서는 backend, CLI, UI, README card 구현 없이 snapshot shape 자체와 validator 동작만 다뤘다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `package.json` | root ESM package와 `npm test` 스크립트 추가 |
| `src/profile-snapshot/index.js` | schema validator public export 추가 |
| `src/profile-snapshot/schema.js` | `schemaVersion`, profile, summary, daily usage, insights, invocations, assets runtime validator 구현 |
| `src/profile-snapshot/types.d.ts` | profile snapshot TypeScript declaration 계약 추가 |
| `src/profile-snapshot/fixtures/sample-snapshot.js` | Codex Profile/Card 요구를 반영한 sample snapshot fixture 추가 |
| `src/profile-snapshot/__tests__/schema.test.js` | sample validation, missing schema version, invalid usage bucket, unknown field, assert error 테스트 추가 |
| `mydocs/orders/20260608.md` | Stage 1 완료 보고 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

코드 신규 추가 단계이므로 기존 API 동작 보존 이슈는 없다. 기존 `codex-extracted/` 분석 입력은 수정하거나 stage하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

결과:

- OK: `npm test` 통과
  - Node 내장 `node --test`
  - tests 5
  - pass 5
  - fail 0
- OK: `git diff --check` 통과

## 잔여 위험

- Stage 1 validator는 hand-written 방식이므로 schema library 수준의 자동 오류 메시지나 JSON Schema export는 제공하지 않는다.
- token-like field 보안 경계는 unknown top-level field reject 수준까지 들어갔고, raw Codex input allowlist normalizer와 token field 테스트는 Stage 2에서 확장해야 한다.
- `types.d.ts`는 TypeScript declaration 계약이지만 root `tsc` typecheck는 아직 없다. dependency-free 계획에 따라 Stage 1에서는 Node runtime test를 우선 검증 기준으로 삼았다.

## 다음 단계 영향

- Stage 2는 `schema.js` validator의 exact-key 정책을 기준으로 raw Codex-like input에서 allowlist field만 뽑아 snapshot으로 변환해야 한다.
- Stage 2 normalizer는 raw input에 `access_token`, `refresh_token`, `auth.json` 관련 field가 있어도 output snapshot에 남지 않는 테스트를 추가해야 한다.
- Stage 3 selector는 Stage 1 fixture와 schema field를 기준으로 Profile 화면/Card 요구 데이터를 꺼내야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
