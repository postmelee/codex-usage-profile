# Task #42 Stage 5 완료 보고서

GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
구현계획서: [`task_m100_42_impl.md`](../plans/task_m100_42_impl.md)
Stage: 5

## 단계 목적

Stage 1~4에서 확정한 R2 media contract, publish orchestration, 공개 stable route, runtime wiring을 failure/concurrency matrix로 검증하고, orphan revision retention 도구와 공식 운영·사용자 문서를 통합한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/__tests__/s3-failure.test.js` | immutable PUT, validation HEAD, stable COPY/HEAD/GET/DELETE, timeout 실패가 기존 publication을 훼손하지 않는지 검증 |
| `src/profile-media/__tests__/publication-concurrency.test.js` | 같은 owner의 publish/unpublish/refresh 순서와 다른 owner 사이의 global lock 부재를 검증 |
| `src/profile-media/publication-service.js` | stable 삭제 성공 뒤 structured commit 실패 시 PNG 404를 유지하고 재시도로 private에 수렴하도록 unpublish 보상 경계 보강 |
| `src/profile-media/__tests__/publication-service.test.js` | 위 delete-success/commit-failure/retry 수렴 회귀 test 추가 |
| `scripts/cleanup-orphan-card-media.mjs` | stable reference, 최근 5개, 90일 guard를 적용한 paginated dry-run cleanup과 명시적 `--apply` 구현 |
| `scripts/__tests__/cleanup-orphan-card-media.test.js` | pagination, 보존 조건, 삭제 직전 race 재확인, exact key 삭제, CLI 인자 검증 |
| `package.json` | `cleanup:card-media` script 추가 |
| `docs/production-hosting.md` | contract v2 key, publication ordering, env/readiness, failure recovery, retention, remote 검증 한계 현행화 |
| `docs/readme-card.md` | 최초 publish, locale, public submit refresh, `media_unavailable` exact retry 계약 현행화 |
| `README.md` | external R2 media runtime, 환경 변수, stable/private serving 경계와 현재 제약 현행화 |
| `mydocs/orders/20260723.md` | Task #42를 Stage 5 완료·승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

- 코드의 기존 public/private API response와 URL 계약은 유지했다.
- failure matrix에서 발견한 unpublish 부분 실패 경계만 보강했으며, stable 삭제 뒤 structured commit이 실패한 상태를 공개 PNG 404로 유지하는 계획서 계약에 맞췄다.
- 공식 문서는 구현계획서에서 승인한 기존 위치인 `README.md`, `docs/production-hosting.md`, `docs/readme-card.md`만 필요한 절을 현행화했다. 신규 제품 문서나 별도 문서 루트는 만들지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-media/__tests__/s3-failure.test.js src/profile-media/__tests__/publication-concurrency.test.js
node --test scripts/__tests__/cleanup-orphan-card-media.test.js
npm run cleanup:card-media -- --help
npm test
npm run build
git diff --check
```

결과:

- OK — failure/concurrency suite: 11개 중 10개 통과, 1개 `TEST_DATABASE_URL` 미설정으로 명시적 skip, 실패 0
- OK — cleanup suite: 4개 통과, 실패 0
- OK — cleanup help: dry-run 기본값, `--apply`, 90일·최근 5개 보존 정책 출력 확인
- OK — 전체 회귀: 373개 중 367개 통과, 환경 의존 test 6개 skip, 실패 0
- OK — production build: Vite client build 성공
- OK — `git diff --check`: 오류 없음
- OK — 추가 client bundle 검사에서 S3 SDK import, R2 endpoint/secret env 이름이 검출되지 않음

## 잔여 위험

- 실제 S3-compatible endpoint가 제공되지 않아 `TEST_S3_ENDPOINT` integration test 1개를 실행하지 못했다.
- `TEST_DATABASE_URL`이 없어 기존 PostgreSQL integration test 4개와 다른 owner concurrency test 1개가 skip됐다. memory/fake-command suite와 전체 회귀는 통과했다.
- 실제 Cloud Run·Neon·R2 resource 생성과 secret 연결, cleanup schedule 및 운영 retention 값 조정은 승인된 제외 범위대로 #43에서 수행한다.

## 다음 단계 영향

- Stage 5는 마지막 구현 Stage다. 다음 절차는 Task #42 최종 보고서 작성, 오늘할일 완료 처리, 최종 커밋, `publish/task42` push와 `devel` 대상 PR 게시다.
- 위 최종 보고/PR 절차는 이번 Stage 승인 뒤 `task-final-report` 절차로 별도 진행한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 Task #42 최종 보고 및 PR 게시 절차로 진행한다.
