# Task #100 Stage 7 완료 보고서 — PR 리뷰 오류 경계와 publication 정합성 보정

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
구현계획서: [`task_m100_100_impl.md`](../plans/task_m100_100_impl.md)
Stage: 7

## 단계 목적

PR #105 owner review에서 제기된 correctness 항목을 일곱 동작 묶음으로 보정한다.
media adapter 오류가 공개 API로 새지 않게 하고, canonical representation과 publication
authority의 책임을 분리하며, publication CAS 이후 경합에서도 canonical card와 social
image가 같은 publication id로 수렴하도록 한다. Share Studio의 부분 실패와 repair 입력도
fail-close 또는 기능 유지 경계가 명확하도록 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/publication-service.js`, `src/profile-card/service-core.js` | prepare 오류를 generic 503으로 정규화하고, authority commit 뒤 social 수렴과 superseded 재시도 신호를 보강 |
| `src/profile-media/s3/store.js` | unpublish가 canonical representation 대신 dark stable publication authority만 읽도록 변경 |
| `src/profile-backend/http.js`, `src/profile-runtime/public-profile-resolver.js` | social coherence를 `inspectStableCard()`의 owner/publication identity로 판정 |
| `src/profile-ui/ShareStudio.jsx` | README snippet 생성 실패와 dialog 전체 사용 가능 여부를 분리 |
| `src/profile-media/r2-binding/maintenance.js`, `src/profile-runtime/sites/maintenance.js` | v4 repair canonical pair 필수화와 저장된 owner 설정 전달 |
| backend·media·runtime·UI 대상 테스트 | plain adapter failure, light object 누락 unpublish, post-commit supersession, authority-only social, partial UI, repair pair 회귀 추가 |
| `docs/readme-card.md`, `docs/production-hosting.md`, `docs/sites-operations.md` | retryable 503, social 수렴, authority-only unpublish와 repair pair 운영 계약 기록 |
| `mydocs/plans/task_m100_100_impl.md`, `mydocs/orders/20260815.md` | 승인된 Stage 7 범위와 완료 상태 기록 |
| `mydocs/working/task_m100_100_stage7.md`, `mydocs/report/task_m100_100_report.md` | 단계 증거와 Task 전체 결과 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

외부 URL과 성공 응답 shape는 유지했다. 실패 경계는 plain storage 오류와 post-commit
supersession을 `503 media_unavailable`, `Retry-After: 5`로 통일했다. queryless canonical
light representation이 누락되거나 drift인 경우 dark로 대체하지 않는 404 fail-close와,
DB commit 뒤 media 실패를 복구하기 위한 exact same settings ensure는 기존 설계 의도대로
유지했다.

review 제안 가운데 rollback cleanup, `readmeMarkdown` 명칭 정리, URL validator 통합은
이번 correctness 묶음과 독립적인 후속 정리로 남겼다. `readmeMarkdown` 값은 GitHub가
지원하는 HTML이므로 현재 공개 field를 깨뜨리는 rename은 수행하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/http.test.js
node --test src/profile-media/__tests__/publication-service.test.js src/profile-media/__tests__/social-card-publication.test.js src/profile-media/__tests__/s3-store.test.js src/profile-media/__tests__/s3-failure.test.js
node --test src/profile-runtime/__tests__/public-profile-resolver.test.js src/profile-runtime/sites/__tests__/maintenance.test.js src/profile-media/__tests__/r2-binding-maintenance.test.js
node --test src/profile-ui/__tests__/cardStyleSettings.test.js src/profile-ui/__tests__/shareStudio.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|card appearance" --workers=1
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
git diff --check
git status --short
```

결과:

- OK — backend HTTP 45/45, publication·social·S3 42 pass·환경 조건 1 skip,
  runtime·maintenance 29/29, UI unit 16/16 통과.
- OK — Share Studio·card appearance 대상 Playwright 18/18 통과. README snippet이
  없어도 dialog와 preview·저장·나머지 복사 동작을 유지하는 source contract를 고정했다.
- OK — 전체 Node test 806건 중 800건 통과, 실패 0, Postgres/S3 환경 조건 6 skip.
- OK — 전체 Playwright E2E 100/100 통과.
- OK — production build가 server/client artifact를 생성했다. full-stack verifier는
  client 8개, Worker 2개, migration 5개를 승인했고 production verifier는 artifact
  5,146,250 bytes, required binding 3개와 Worker 크기 제한을 승인했다.
- OK — local full-stack smoke가 route 62개, canonical update 2회, 85,391-byte public
  PNG와 cold/publish/warm render를 검증했다.
- OK — `git diff --check` 통과. 검증용 dependency 연결은 원래 worktree 상태로
  복구했고 Stage 7 산출물 외 임시 파일은 없다.
- 참고 — sandbox에서 로컬 포트와 workerd 실행이 제한된 최초 시도만 환경 오류가
  발생했다. 같은 exact 명령을 승인된 로컬 실행 권한으로 다시 수행해 모두 통과했으며
  제품 회귀 실패로 분류하지 않았다.

## 잔여 위험

- canonical authority와 social object는 서로 다른 object write이므로 단일 원자 transaction은
  아니다. writer는 authority가 된 publication의 social을 같은 id로 수렴시키고, reader는
  중간 mismatch를 404로 fail-close한다. 더 최신 authority가 생기면 이전 writer는 덮지 않는다.
- Postgres/S3 실제 endpoint 통합 6건은 환경 변수가 없어 skip됐다. memory·R2·S3 unit과
  local D1·native R2 full-stack 경로는 통과했다.
- review 10·13·14번은 rollback cleanup·명칭·validator 구조 정리로, 이번 correctness
  범위와 분리해 후속 작업 후보로 남는다.

## 다음 단계 영향

- Stage 7 구현과 전체 회귀가 완료됐다. 동일 커밋을 `publish/task100`에 push하고 PR #105
  check를 확인한 뒤, 반영·유지·후속 분류와 검증 결과를 owner review 코멘트로 게시한다.
- Stage 7은 production 재배포나 원격 storage mutation을 수행하지 않았다.

## 승인 요청

- 작업지시자가 Stage 7 구현·검증·push·리뷰 코멘트 게시 범위를 승인했다.
