# Task #101 Stage 2 보고서 — runtime·SPA 착지 연결과 로컬 통합 검증

GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
구현계획서: [`task_m100_101_impl.md`](../plans/task_m100_101_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 고정한 queryless revision share URL을 Node production, dev, Sites runtime과
공개 profile SPA에 연결한다. 사람이 `/api/share/{handle}/r/{revision}`을 열면 기존 공개
profile 화면에 착지하고, crawler 요청은 runtime별 routing 순서와 무관하게 같은 HTML metadata
계약을 받는지 로컬 통합 검증하는 구현계획 Stage 2이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/publicProfileRoutes.js` | 공통 share path parser로 fixed·revision 경로를 인식하고, revision은 버린 채 검증된 handle만 기존 공개 profile API lookup에 전달한다. |
| `src/profile-ui/__tests__/publicProfileRoutes.test.js` | fixed·revision 착지, encoded handle, malformed·invalid revision, private·missing·실패 상태 경계를 검증한다. |
| `src/profile-ui/__tests__/appRoutes.test.js` | revision share 경로가 예약 app route보다 우선하지 않으면서 공개 profile route로 분류되는지 검증한다. |
| `src/profile-runtime/dev-server.js` | Web Request를 요청당 한 번만 지연 생성하고 public document handler를 backend API 판별보다 먼저 실행해 revision 문서를 dev runtime에서도 제공한다. |
| `src/profile-runtime/__tests__/dev-server.test.js` | 실제 public document handler로 fixed·matching·stale·invalid revision과 `GET`·`HEAD`, API·SPA fallback 순서를 검증한다. |
| `src/profile-runtime/__tests__/production-server.test.js` | production node handler가 실제 public document handler로 revision metadata·`HEAD`·invalid fallback 계약을 지키는지 검증한다. |
| `src/profile-runtime/sites/observability.js` | 공통 parser로 유효한 fixed·revision share 경로만 bounded `public_profile` route class로 분류한다. |
| `src/profile-runtime/sites/__tests__/backend.test.js` | Sites backend의 revision document owner-only routing 경계를 보강했다. |
| `src/profile-runtime/sites/__tests__/worker.test.js` | Worker가 revision document를 backend API나 asset fallback으로 오분류하지 않는지 검증한다. |
| `src/profile-runtime/sites/__tests__/observability.test.js` | 유효한 revision은 `public_profile`, invalid revision은 기존 API class로 축약되어 raw handle이 기록되지 않는지 검증한다. |
| `scripts/smoke-sites-fullstack-local.mjs` | 실제 D1·R2·renderer·publication 로컬 smoke에 matching `GET`·`HEAD`, stale current 수렴, invalid·missing fallback matrix를 추가했다. |
| `src/profile-runtime/sites/__tests__/full-stack.test.js` | 확대된 Sites full-stack smoke의 67개 route 검증 결과를 고정했다. |
| `mydocs/orders/20260813.md` | #101 비고를 Stage 2 완료·Stage 3 승인 대기로 갱신했다. |
| `mydocs/working/task_m100_101_stage2.md` | Stage 2 구현·검증·잔여 위험과 Stage 3 배포 승인 경계를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

공식 사용자·아키텍처·운영 문서는 Stage 3 플랫폼 gate 이전이므로 수정하지 않았다. Share Studio와
SNS target도 계속 fixed `/api/share/{handle}`를 생성하므로 사용자에게 복사되는 공유 URL은 바뀌지
않았다. 이번 변경은 새 revision 문서의 runtime routing, SPA 착지, 관측성 분류와 자동 검증에만
한정했다.

기존 fixed share, `/u/{handle}`, API·static asset·SPA fallback, private·missing 비열거와 owner-only
경계는 유지했다. 유효하지 않은 revision은 public document로 소유하지 않고 runtime의 기존 fallback이
처리하며, 관측성에는 raw handle이나 revision 값이 남지 않는다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/publicProfileRoutes.test.js \
  src/profile-ui/__tests__/appRoutes.test.js \
  src/profile-runtime/__tests__/dev-server.test.js \
  src/profile-runtime/__tests__/production-server.test.js \
  src/profile-runtime/sites/__tests__/backend.test.js \
  src/profile-runtime/sites/__tests__/worker.test.js \
  src/profile-runtime/sites/__tests__/full-stack.test.js \
  src/profile-runtime/sites/__tests__/observability.test.js
git diff --check
```

추가 회귀 명령:

```bash
node --test \
  src/profile-shared/__tests__/public-share-url.test.js \
  src/profile-runtime/__tests__/open-graph.test.js \
  src/profile-runtime/__tests__/public-profile-document.test.js
```

결과:

- OK — Stage 2 Node test 41개 통과, 실패·skip·todo 0개, 총 3938.005583ms.
- OK — 실제 Sites 로컬 Worker가 browser session, CLI, D1, R2, renderer, publication과 함께
  fixed·matching·stale·invalid·missing을 포함한 67개 route를 검증했다.
- OK — dev·production의 실제 public document handler에서 matching revision `GET`·`HEAD`, stale
  current metadata 수렴, invalid API fallback을 검증했다.
- OK — Stage 1 회귀 Node test 46개 통과, 실패·skip·todo 0개, 총 131.772459ms.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- 아직 validation site에 배포하지 않았으므로 X·LinkedIn crawler가 revision 경로를 새 cache identity로
  인식하는지 확인하지 않았다.
- Stage 3에서는 배포 대상, exact commit, 현재 saved version, rollback 기준을 먼저 제시하고 별도
  승인을 받아야 한다. production과 #84 소유 상태는 실험 범위가 아니다.
- Share Studio는 Stage 3에서 X·LinkedIn gate가 모두 통과할 때까지 fixed URL을 유지한다.
- 외부 SNS 작성 창이나 게시물은 이번 Stage에서 열거나 생성하지 않았다.

## 다음 단계 영향

- Stage 3 진입 전 `sites-building`과 `sites-hosting` 절차에 따라 validation target·access·saved
  version·rollback 경계를 확인한다.
- Stage 2 exact commit artifact만 승인된 validation target에 배포하고 X·LinkedIn A/B와
  Threads·Facebook·Reddit 회귀를 실측한다.
- X 또는 LinkedIn gate가 실패하면 Stage 4 Share Studio 전환과 공식 문서 현행화를 시작하지 않고
  application 결과와 provider 결과를 분리해 새 계획 승인을 요청한다.

## 승인 요청

- Stage 2 산출물과 41개 통합 테스트·46개 회귀 테스트·`git diff --check` 결과를 승인하면 Stage 3의
  배포 대상·exact commit·rollback 정보를 먼저 제시하고 별도 배포 승인을 요청한다.
