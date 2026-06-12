# Task M100 #19 최종 보고서

GitHub Issue: [#19](https://github.com/postmelee/codex-usage-profile/issues/19)
마일스톤: M100

## 작업 요약

- 대상 이슈: #19
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: `UsageSnapshot v2` 계약을 정의하고 analyzer/profile 책임 경계를 고정한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `docs/usage-snapshot-v2.md` | `UsageSnapshot v2` 공식 계약 문서를 신설했다. producer/consumer 경계, required/optional 기준, token breakdown, model usage, skill/plugin ranking, GitHub-facing fields 제외, credential 금지, v1 compatibility를 정의했다. | 후속 analyzer SDK/CLI, profile submit, README card renderer의 데이터 계약 |
| `src/profile-snapshot/v2-schema.js` | `USAGE_SNAPSHOT_V2_SCHEMA_VERSION`, `validateUsageSnapshotV2`, `assertUsageSnapshotV2`, `isUsageSnapshotV2`를 추가했다. | v2 runtime validation |
| `src/profile-snapshot/v2-types.d.ts` | `UsageSnapshotV2`와 하위 type declaration을 추가했다. | 후속 SDK/CLI 및 web code의 타입 계약 |
| `src/profile-snapshot/fixtures/sample-v2-snapshot.js` | v2 sample fixture를 추가했다. | 테스트와 후속 구현 참고 fixture |
| `src/profile-snapshot/__tests__/v2-schema.test.js` | v2 validator 테스트를 추가했다. | v2 contract regression 방지 |
| `src/profile-snapshot/index.js` | v2 validator API를 추가 export했다. | 후속 작업의 public import 경로 |
| `src/profile-snapshot/types.d.ts` | v2 type declaration re-export를 추가했다. | package type entry |
| `README.md` | `Usage Snapshot Contract` 섹션과 보안 경계 bullet을 추가했다. | 개발자 온보딩, 책임 경계 안내 |
| `mydocs/tech/task_m100_19_snapshot_v2_notes.md` | v1/v2 필드 요구사항과 field ownership 후보를 정리했다. | 내부 의사결정 기록 |
| `mydocs/working/task_m100_19_stage1.md` | Stage 1 완료 보고서를 추가했다. | 단계 기록 |
| `mydocs/working/task_m100_19_stage2.md` | Stage 2 완료 보고서를 추가했다. | 단계 기록 |
| `mydocs/working/task_m100_19_stage3.md` | Stage 3 완료 보고서를 추가했다. | 단계 기록 |
| `mydocs/working/task_m100_19_stage4.md` | Stage 4 완료 보고서를 추가했다. | 단계 기록 |
| `mydocs/orders/20260612.md` | #19 상태를 완료로 갱신했다. | 작업 보드 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/usage-snapshot-v2.md` | `docs/` | `docs/usage-snapshot-v2.md` | OK | 수행계획서와 구현계획서에서 공식 API/데이터 계약 문서로 승인받은 위치와 일치한다. |
| `mydocs/tech/task_m100_19_snapshot_v2_notes.md` | `mydocs/tech/` | `mydocs/tech/task_m100_19_snapshot_v2_notes.md` | OK | 내부 조사/의사결정 노트 위치와 일치한다. |
| `src/profile-snapshot/*` | `src/profile-snapshot/` | `src/profile-snapshot/v2-*`, fixture, test | OK | runtime contract skeleton 위치와 일치한다. |
| `README.md` | `README.md` | `README.md` | OK | 공식 개발 문서 링크/요약 위치와 일치한다. |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| UsageSnapshot 공식 계약 문서 | 없음 | `docs/usage-snapshot-v2.md` 추가 |
| v2 runtime validator | 없음 | `validateUsageSnapshotV2`, `assertUsageSnapshotV2`, `isUsageSnapshotV2` 추가 |
| v2 validator 테스트 | 없음 | 8개 v2 테스트 추가 |
| 전체 Node test | 122개 내외 | 130개 통과 |
| production build | 기존 build 통과 | build 통과 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| `UsageSnapshot v2` 필드 목록과 필수/선택 여부가 정의되어 있다. | OK — `docs/usage-snapshot-v2.md`에 top-level shape, required/optional/nullability, minimal payload를 정의했다. |
| analyzer와 web profile의 책임 경계가 문서화되어 있다. | OK — 공식 계약 문서와 README에 producer/consumer boundary를 기록했다. |
| GitHub username, avatar, display name, bio 등 GitHub-facing fields가 web layer 책임임이 명시되어 있다. | OK — 공식 계약 문서, README, v2 validator test에 반영했다. |
| 기존 M100 이슈들의 진행 순서와 의존 관계를 업데이트할 수 있는 기준이 정리되어 있다. | OK — Stage 1/4 보고서와 공식 계약 문서의 product wrapper guidance에 #20/#5/#6 handoff 기준을 남겼다. |
| v1 path가 깨지지 않는다. | OK — 기존 v1 schema/normalize/selector 테스트와 전체 테스트가 통과했다. |

### 단계별 검증 결과

- Stage 1: [task_m100_19_stage1.md](../working/task_m100_19_stage1.md) — v1/v2 요구사항 노트 작성, `git diff --check` 통과.
- Stage 2: [task_m100_19_stage2.md](../working/task_m100_19_stage2.md) — 공식 계약 문서 작성, `rg` 확인과 `git diff --check` 통과.
- Stage 3: [task_m100_19_stage3.md](../working/task_m100_19_stage3.md) — v2 validator/type/test skeleton 추가, v1/v2 관련 테스트와 전체 `npm test` 통과.
- Stage 4: [task_m100_19_stage4.md](../working/task_m100_19_stage4.md) — README 연결과 handoff 정리, `npm test`, `npm run build`, `git diff --check` 통과.

## 최종 검증

| 검증 | 결과 |
|---|---|
| `npm test` | OK — 130개 테스트 통과 |
| `npm run build` | OK — Vite production build 성공 |
| credential-like scan | OK — broad scan은 테스트 fixture/작업 문서 false positive를 출력했고, production-facing narrowed scan은 결과 없음 |
| `git diff --check` | OK — 경고 없음 |

## 잔여 위험과 후속 작업

### 잔여 위험

- backend submit path는 아직 v1 `validateProfileSnapshot`만 사용한다. v2 submit 수용은 #5/#20 흐름에서 연결해야 한다.
- `extensions`는 namespaced key와 credential/GitHub-facing scan만 검증한다. product-specific namespace가 구체화되면 별도 validator가 필요할 수 있다.
- broad credential scan은 테스트 fixture와 작업 문서를 false positive로 잡는다. 후속 task에서는 검증 명령을 production-facing 대상 중심으로 다듬는 편이 좋다.

### 후속 작업 후보

- #20: `codex-usage-analyzer` 레포 분리 및 SDK/CLI 스캐폴드에서 `UsageSnapshot v2`를 analyzer output 기준으로 사용한다.
- #5: profile submit CLI는 analyzer output을 v2 validator로 검증한 뒤 `payload.snapshot`으로 전송한다.
- #6: README card renderer는 web-owned GitHub profile record와 analyzer snapshot을 병합해 card view model을 만든다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 PR 게시 절차로 진행한다.
