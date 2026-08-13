# Task #101 Stage 1 보고서 — revision URL·metadata 계약 고정

GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
구현계획서: [`task_m100_101_impl.md`](../plans/task_m100_101_impl.md)
Stage: 1

## 단계 목적

외부 SNS crawler가 카드 갱신마다 새 cache identity를 받을 수 있도록 쿼리 없는
`/api/share/{handle}/r/{revision}` 계약을 공통 모듈과 공개 profile document handler에
고정한다. matching·stale·invalid revision, 기존 fixed route와 private·missing fallback의
metadata 경계를 테스트로 확정하는 구현계획 Stage 1이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-shared/public-share-url.js` | 123줄. timestamp 최댓값 revision 계산, 안전한 10진 token parser, handle·origin 검증, fixed·revision path/URL builder와 엄격한 path parser를 추가했다. |
| `src/profile-shared/__tests__/public-share-url.test.js` | 129줄. timestamp·safe integer·encoding·trailing slash·malformed path·queryless URL 계약을 검증한다. |
| `src/profile-runtime/open-graph.js` | 공통 revision·URL 함수를 사용하고 versioned 요청의 canonical·`og:url`·social image token을 현재 revision으로 정렬했다. 기존 fixed route와 fallback 생성은 유지했다. |
| `src/profile-runtime/public-profile-document.js` | share path parser의 request context에 requested revision을 보존하고 Open Graph builder로 전달한다. invalid revision은 문서 route로 소유하지 않는다. |
| `src/profile-runtime/__tests__/open-graph.test.js` | matching self canonical, stale current metadata 수렴, revision fallback 비열거 검증을 추가했다. |
| `src/profile-runtime/__tests__/public-profile-document.test.js` | encoded·trailing slash·query·invalid 경계, `GET`·`HEAD`, matching·stale metadata와 private·missing 동일 fallback 검증을 추가했다. |
| `mydocs/orders/20260813.md` | #101 비고를 Stage 1 완료·Stage 2 승인 대기로 갱신했다. |
| `mydocs/working/task_m100_101_stage1.md` | Stage 1 구현·검증·잔여 위험과 다음 단계 승인 경계를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

공식 사용자·아키텍처·운영 문서는 Stage 3 플랫폼 gate 이전이므로 수정하지 않았다. 코드에서는
기존 `/api/share/{handle}`, `/u/{handle}`, Sites query route의 self canonical과
`PUBLIC_PROFILE_DOCUMENT_CACHE_CONTROL`을 유지했다. 기존 Open Graph title·description·locale,
private·missing packaged sample fallback과 `HEAD` 무본문 계약도 보존했다.

새 versioned route에만 다음 동작을 추가했다.

- matching revision: 요청 URL을 self canonical·`og:url`로 사용한다.
- stale revision: redirect 없이 `200`을 유지하고 canonical·`og:url`·image token을 현재 revision으로
  수렴시킨다.
- invalid·비정규 revision: public document route로 인정하지 않는다.
- revision path는 외부 cache identity일 뿐 과거 snapshot을 의미하지 않는다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-shared/__tests__/public-share-url.test.js \
  src/profile-runtime/__tests__/open-graph.test.js \
  src/profile-runtime/__tests__/public-profile-document.test.js
git diff --check
```

결과:

- OK — Node test 46개 통과, 실패·skip·todo 0개, 총 62.03025ms.
- OK — fixed route, matching·stale revision, invalid parser, private·missing fallback와
  `GET`·`HEAD` 계약을 모두 검증했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Node production, dev, Sites backend·worker가 새 predicate를 실제 routing 순서에서 동일하게
  처리하는지는 Stage 2 runtime 통합 테스트로 확인해야 한다.
- 사람이 versioned URL을 열 때 SPA public profile parser는 아직 새 경로를 인식하지 않는다.
- X·LinkedIn이 새 경로와 self canonical을 별도 cache identity로 처리하는지는 Stage 3 승인 배포 전에는
  확인할 수 없다.
- Share Studio는 실험 변수를 분리하기 위해 기존 fixed `/api/share/{handle}`를 계속 사용한다.

## 다음 단계 영향

- Stage 2는 `parsePublicSharePath`와 document handler 계약을 각 runtime route matrix에 연결·검증한다.
- `src/profile-ui/publicProfileRoutes.js`는 versioned share path에서 handle만 추출하고 revision을 profile
  API lookup에 전달하지 않아야 한다.
- owner-only, private·missing, crawler User-Agent, static/API route 회귀 검증 전에는 배포하지 않는다.
- Stage 2에서도 Share Studio 외부 공유 URL은 fixed route로 유지한다.

## 승인 요청

- Stage 1 산출물과 46개 테스트·`git diff --check` 결과를 승인하면 Stage 2의 runtime·SPA 착지 연결과
  로컬 통합 검증으로 진행한다.
