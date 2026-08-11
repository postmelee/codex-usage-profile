# Task M100 #12 Stage 2 보고서

GitHub Issue: [#12](https://github.com/postmelee/codex-usage-profile/issues/12)
구현계획서: [`task_m100_12_impl.md`](../plans/task_m100_12_impl.md)
Stage: 2

## 단계 목적

Stage 2의 목적은 Stage 1에서 추가한 OAuth state/session 저장 contract를 포함해 owner, CLI challenge, CLI token digest, latest snapshot을 process restart 이후에도 유지할 수 있는 최소 durable store adapter를 구현하는 것이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/durable-store.js` | JSON file 기반 durable store adapter, state read/write, atomic write helper 추가 |
| `src/profile-backend/store.js` | memory store `exportState()`와 initial state hydrate 기능 추가 |
| `src/profile-backend/index.js` | durable store와 store schema version export 추가 |
| `src/profile-backend/__tests__/durable-store.test.js` | restart persistence, token 원문 미저장, mutation persistence, conflict, clone, invalid file 테스트 추가 |
| `src/profile-backend/__tests__/store.test.js` | memory store export/hydrate와 invalid initial state 테스트 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경이며 기존 memory store API는 보존했다. `createMemoryProfileBackendStore()`는 기존처럼 인자 없이 사용할 수 있고, optional initial state hydrate와 `exportState()`만 추가됐다. durable adapter는 기존 store method를 wrapper로 감싸 mutating method 성공 후 파일에 저장하므로 domain service contract는 유지된다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-backend/__tests__/durable-store.test.js src/profile-backend/__tests__/store.test.js
npm test
git diff --check
```

결과:

- OK: Stage 2 지정 테스트 18개 통과.
- OK: 전체 `npm test` 95개 통과.
- OK: `git diff --check` 통과.
- OK: durable store 파일에 raw CLI token과 GitHub OAuth access token이 남지 않는 테스트 통과.

## 잔여 위험

- durable adapter는 JSON file 기반 최소 구현이다. production DB/provider 선택, file locking, multi-process 동시 쓰기 대응은 후속 운영/배포 범위다.
- adapter는 store에 저장된 record를 그대로 직렬화한다. raw credential 저장 방지는 Stage 1/기존 token service/snapshot security contract에 의존한다.
- runtime에서 어떤 path를 durable store file로 사용할지는 Stage 4 설정 문서에서 정리해야 한다.

## 다음 단계 영향

- Stage 3 HTTP runtime은 `createFileProfileBackendStore`를 주입받아도 기존 memory store와 같은 method로 동작할 수 있다.
- Stage 3에서 session 기반 CLI challenge approve route를 연결할 때 session, OAuth state, challenge가 같은 durable adapter에 저장될 수 있다.
- Stage 4 README에는 durable store file path 설정과 production DB 미확정 상태를 명확히 안내해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 authenticated account와 CLI challenge 승인 연결로 진행한다.
