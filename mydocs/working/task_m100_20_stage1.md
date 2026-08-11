# Task M100 #20 Stage 1 보고서

GitHub Issue: [#20](https://github.com/postmelee/codex-usage-profile/issues/20)
구현계획서: [`task_m100_20_impl.md`](../plans/task_m100_20_impl.md)
Stage: 1

## 단계 목적

Stage 1은 `codex-usage-analyzer` package를 만들기 전에 현재 `UsageSnapshot v2` contract 소비 지점과 분리 경계를 확정하는 단계다.

이번 단계에서는 analyzer package가 소유할 v2 contract module과 profile app에 남길 compatibility path를 문서로 고정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/tech/task_m100_20_analyzer_split_notes.md` | v2 소비 지점 inventory, analyzer/profile 책임 경계, Stage 2 package boundary, Stage 3 module 이동 기준, SDK/CLI 후보, wrapper compatibility, root workspace 결정 근거를 정리했다. |
| `mydocs/working/task_m100_20_stage1.md` | Stage 1 완료 보고서와 검증 결과를 작성했다. |

## 본문 변경 정도 / 본문 무손실 여부

- 신규 기술 노트 171 lines를 추가했다.
- 기존 소스와 공식 문서는 수정하지 않았다.
- 원문 이동이나 삭제가 없는 조사/의사결정 문서 추가 작업이다.

## 검증 결과

실행 명령:

```bash
rg -n "validateUsageSnapshotV2|assertUsageSnapshotV2|isUsageSnapshotV2|USAGE_SNAPSHOT_V2|sample-v2" src docs README.md package.json
git diff --check
```

결과:

- OK — `rg`는 v2 관련 symbol이 `src/profile-snapshot/v2-schema.js`, `src/profile-snapshot/v2-types.d.ts`, `src/profile-snapshot/fixtures/sample-v2-snapshot.js`, `src/profile-snapshot/index.js`, `src/profile-snapshot/__tests__/v2-schema.test.js`에만 있음을 확인했다.
- OK — production submit path는 현재 v1 `validateProfileSnapshot`만 사용하므로 Stage 3에서 v2 compatibility re-export로 분리할 수 있다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Stage 2에서 root workspace를 추가하면 `package-lock.json`이 변경된다. lockfile 변경은 workspace entry에 필요한 범위로 제한해야 한다.
- Stage 3에서 package self-reference import를 사용할지 상대 re-export를 사용할지 Node test와 Vite build 결과로 확정해야 한다.
- 현재 backend submit path는 v2를 수용하지 않는다. v2 submit 연결은 후속 #5 흐름에서 다룬다.

## 다음 단계 영향

- Stage 2는 `packages/codex-usage-analyzer/` workspace package skeleton을 추가한다.
- Stage 2의 SDK/CLI skeleton은 Stage 1에서 정한 API 후보인 `analyzeUsage`, `createSampleUsageSnapshotV2`, v2 validator exports를 기준으로 만든다.
- Stage 3은 Stage 1의 module 이동 표에 따라 v2 canonical implementation을 analyzer package로 옮기고 profile 기존 경로를 compatibility re-export로 유지한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 analyzer workspace package 스캐폴드로 진행한다.
