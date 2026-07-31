# Task M100 #59 Stage 4 완료보고서

GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
구현계획서: [`task_m100_59_impl.md`](../plans/task_m100_59_impl.md)
Stage: 4

## 단계 목적

Stage 1~3에서 구현한 optional device intent, same-owner 완료 상태 복구와
terminal 승인 UI를 공식 CLI 문서에 연결한다. 전체 root test, standard
build, production Sites build와 artifact verifier, 전체 Playwright를
실행해 CLI/backend/API/UI와 기존 Home, loading card, profile, settings,
Share Studio의 회귀가 없는지 확인한다.

실제 production deploy나 API 호출 없이 D1 migration 3이 production
artifact와 local Worker 통합 경로까지 포함되는 배포 후보를 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/cli-submit.md` | `submit`, `login`, no-intent 승인 후 행동과 local `--server`, 수동 navigation/clipboard/command 경계 설명 |
| `packages/codex-usage-profile-cli/README.md` | npm 사용자를 위한 승인 직후 행동 요약과 상세 문서 연결 |
| `src/profile-backend/__tests__/store-transactions.test.js` | Stage 2의 same-owner exchanged replay와 token 비증가 계약으로 오래된 통합 기대값 정렬 |
| `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js` | local Worker full-stack migration registry에 version 3 연결 |
| `scripts/verify-sites-fullstack-artifact.mjs` | Sites artifact의 packaged D1 migration 수를 3으로 갱신 |
| `scripts/verify-sites-production-artifact.mjs` | production artifact exact migration allowlist에 `0003_cli_login_intent.sql` 추가 |
| `scripts/__tests__/verify-sites-fullstack-artifact.test.js` | migration 3 fixture와 count 검증 |
| `scripts/__tests__/verify-sites-production-artifact.test.js` | production migration 3 fixture와 count 검증 |
| `mydocs/orders/20260731.md` | Task #59를 Stage 4 완료보고 승인 대기로 갱신 |
| `mydocs/working/task_m100_59_stage4.md` | 문서·전체 회귀·Sites artifact 결과와 잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

기존 공식 문서의 요구사항, Quickstart, executable 탐색, privacy,
credential, 오류와 보안 설명을 재작성하지 않았다. Browser 승인 흐름
아래에 세 intent별 완료 행동과 자동 redirect/clipboard/command 실행을
하지 않는 경계만 추가했다. package README도 같은 내용을 짧게 요약하고
기존 상세 문서 링크를 유지했다.

제품 runtime과 UI source는 Stage 4에서 변경하지 않았다. 전체 회귀가
찾은 두 오래된 통합 경계만 수정했다.

- Stage 2에서 승인한 same-owner `approved`/`exchanged` replay를 기존
  transaction test가 오류로 기대하던 부분을 terminal success와 token
  count 1 검증으로 정렬했다.
- Stage 1의 D1 migration 3은 application migration registry에는
  연결됐지만 local full-stack Worker harness와 artifact verifier가
  migration 2개를 고정하고 있었다. 세 경로 모두 migration 3으로
  정렬했다.

`.openai/hosting.json`, account usage, renderer/card media,
R2/publication source는 변경하지 않았다. build가 만든 `dist/` 배포
후보는 ignored generated artifact이며 source commit에는 포함하지 않는다.

## 검증 결과

실행 명령:

```bash
npm run build
npm run build:production
npm run verify:sites-production
npm test
npm run test:e2e
git diff --check
git diff origin/devel -- .openai/hosting.json
```

결과:

- OK — standard Vite build: 42 modules transformed.
- OK — production Sites build: Worker 47 modules, client 42 modules.
- OK — production artifact verifier:
  - artifact 5,491,954 bytes
  - client files 7
  - Worker files 2
  - D1 migrations 3
  - expected bindings 3
  - Worker raw 3,902,961 bytes, compressed 2,145,694 bytes
- OK — 전체 root test: 517건 중 511 pass, 6 skip, 0 fail.
- OK — real workerd D1에서 migration `[1, 2, 3]`, idempotent rerun,
  same-owner approval replay, token 단일 발급과 local Worker full-stack
  browser/CLI/D1/R2/publication 흐름 통과.
- OK — 전체 Playwright: 36 tests, 36 pass, 0 fail. Home, #55 loading
  skeleton, device intent/error/accessibility, profile, settings와 Share
  Studio 회귀 통과.
- OK — `git diff --check` 경고 없음.
- OK — `git diff origin/devel -- .openai/hosting.json` 빈 출력.
- OK — Stage 3 기준 account usage, renderer/card media와 R2/publication
  source diff 없음.
- production deploy, remote migration과 production API 호출은 수행하지
  않았다.

전체 root test의 첫 실행은 build 전 기존 artifact가 migration
`[1, 2]`만 포함해 local full-stack 검증이 실패했다. production artifact를
재생성하고 verifier/harness를 migration 3 계약으로 정렬한 뒤 전체
517건을 다시 실행해 실패 0을 확인했다. 검증 환경에 임시로 만들었던
ignored npm wrapper는 제거하고 ChatGPT app에 포함된 실제 npm으로 npm
release verifier까지 통과했다.

## 잔여 위험

- `TEST_DATABASE_URL`이 없어 PostgreSQL 연동 5건(file-store seed,
  migration up/down/up, adapter, concurrency/failure injection,
  different-owner media concurrency)이 계획대로 skip됐다. memory,
  file-store와 real workerd D1의 같은 invariant 및 migration 3 경로는
  모두 통과했지만 실제 PostgreSQL 실행을 대체하지는 않는다.
- `TEST_S3_ENDPOINT`, bucket과 test credential이 없어 MinIO/S3 endpoint
  integration 1건이 skip됐다. command-client와 native R2 contract
  회귀는 통과했다.
- production Sites artifact는 local build/verifier와 full-stack smoke까지만
  검증했다. 실제 배포와 remote D1 migration은 이 Stage 범위가 아니다.

## 다음 단계 영향

- 구현 Stage가 모두 완료됐다. 다음 절차는 `task-final-report`를 사용한
  최종 보고서 작성, 오늘할일 완료 처리, `publish/task59` push와
  `devel` 대상 PR 게시다.
- 최종 보고서는 PostgreSQL 5건과 S3 endpoint 1건의 환경 의존 skip을
  그대로 공개하고, 이를 통과로 표현하지 않아야 한다.
- 이후 production 배포가 승인되면 saved version 전에 migration 3 포함
  artifact와 `.openai/hosting.json`의 기존 D1/R2 linkage를 다시
  검증해야 한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Task #59 최종 보고서와 PR 게시
  절차로 진행한다.
