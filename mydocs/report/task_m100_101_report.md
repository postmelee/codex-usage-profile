# Task #101 최종 보고서 — X·LinkedIn 소셜 미리보기 revision 경로 캐시 갱신

GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
마일스톤: M100

## 작업 요약

- 대상 이슈: #101
- 마일스톤: M100
- 단계 수: 6
- 작업 목적: 외부 SNS crawler가 최신 카드를 새 문서 identity로 수집하도록 revision 경로형 공유
  URL을 도입하되, README Markdown의 고정 URL 계약은 유지한다.

Stage 1~3에서 `/api/share/{handle}/r/{revision}`의 공통 URL·metadata·runtime 계약을 구현하고
공개 validation site에서 X·LinkedIn·Threads·Facebook·Reddit을 실측했다. Stage 4에서는 통과한
revision URL을 공유 링크 복사와 다섯 SNS target에만 연결하고, README Markdown은 기존
`href=/api/share/{handle}`, `img src=/u/{handle}/card.png`를 유지하도록 보정했다. Stage 5와
최종 인수 검증에서 전체 단위·E2E·production artifact 회귀를 통과했다. Stage 6에서는 PR #106
리뷰 지적 1~4에 따라 handle 검증과 revision 계산을 공통화하고, raw timestamp 대신 파생
`shareRevision`만 public API에 추가했으며, epoch-millisecond 노출 계약과 실제 작업일별 기록을
보정한 뒤 전체 검증을 다시 통과했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-shared/public-share-url.js` 및 테스트 | timestamp 기반 revision 계산, fixed·revision URL 생성, throwing·non-throwing handle 검증과 엄격한 경로 parsing을 공통화했다. | 브라우저 UI와 Node·Sites runtime의 공유 URL·입력 경계 정합성 |
| `src/profile-runtime/open-graph.js`, `public-profile-document.js` 및 runtime 테스트 | matching revision은 self canonical, stale revision은 현재 metadata로 수렴하고 invalid revision은 문서 route에서 제외했다. | Node production·dev·Sites의 `GET`·`HEAD`, OG·Twitter metadata, 비열거 fallback |
| `src/profile-backend/http.js` 및 backend·security 테스트 | owner·usage 최신 시각에서 파생한 safe integer `shareRevision`만 public allowlist에 추가하고 raw `owner.updatedAt`은 계속 제외했다. | 공개 API의 revision 전달과 storage metadata 비노출 |
| `src/profile-ui/publicProfileRoutes.js` 및 테스트 | revision share URL을 공개 profile SPA로 착지시키고 API 조회에는 handle만 전달하며 public `shareRevision`을 엄격히 검사한다. | 사람이 공유 URL을 열었을 때의 공개 profile 탐색과 응답 경계 |
| `src/profile-ui/shareStudio.js`, `ShareStudio.jsx`, `HomePage.jsx`, `CardProfilePage.jsx` 및 테스트 | fixed README Markdown과 revision 공유 링크·다섯 SNS target을 분리하고 public `shareRevision`을 우선 사용하되 구형 timestamp fallback을 유지했다. | 공유 링크 복사, X·LinkedIn·Threads·Facebook·Reddit 작성 버튼, submit·카드 설정 저장 후 갱신 |
| `tests/profile-ui.spec.js` | README 고정과 공유/SNS revision 갱신을 브라우저 E2E로 고정했다. | 사용자 공유 흐름 회귀 방지 |
| `scripts/smoke-sites-fullstack-local.mjs` 및 Sites 테스트 | revision 문서의 production artifact smoke와 route 분류를 확장했다. | Sites full-stack 배포 후보 검증 |
| `docs/readme-card.md` | README Markdown은 고정 URL, 공유 링크와 SNS는 revision URL이라는 계약과 epoch-millisecond cache identity 노출을 명시했다. | 사용자·기여자 |
| `docs/production-hosting.md` | revision 계산, 파생 public `shareRevision`, raw timestamp 비노출, canonical·stale·fallback과 runtime 구조를 현행화했다. | 개발자·운영자 |
| `docs/sites-operations.md` | crawler·플랫폼 smoke, provider 지연과 rollback 경계를 기록했다. | 운영자 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/orders/` | 수행·구현계획, Stage 1~6 근거와 2026-08-13·17·18 실제 작업일별 상태를 기록했다. | Hyper-Waterfall 작업 추적 |

전체 변경은 Stage 6 최종 검증 기준 45개 파일, 2,968 insertions, 180 deletions다.
`README.md`와 DB schema는 변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/readme-card.md` | `docs/` | `docs/readme-card.md` | OK | 기존 사용자 공유 문서의 관련 절만 수정했다. |
| `docs/production-hosting.md` | `docs/` | `docs/production-hosting.md` | OK | 기존 production 아키텍처 문서에 revision 계약을 기록했다. |
| `docs/sites-operations.md` | `docs/` | `docs/sites-operations.md` | OK | 기존 Sites 운영 문서에 crawler·platform 검증 절차를 기록했다. |
| Stage 보고서 | `mydocs/working/` | `mydocs/working/task_m100_101_stage{1..6}.md` | OK | 각 단계 결과를 단계 커밋에 포함했다. |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_101_report.md` | OK | 중앙 최종 보고서 템플릿을 사용했다. |
| `README.md` | 변경 없음 | 변경 없음 | OK | 새 canonical production origin은 후속 migration 범위로 유지했다. |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 외부 공유 문서 identity | 고정 `/api/share/{handle}` 1종 | fixed 하위 호환 + 최신 `/api/share/{handle}/r/{revision}` |
| revision 공유 URL 적용 SNS | 0/5 | 5/5 — X·LinkedIn·Threads·Facebook·Reddit |
| submit·카드 저장 후 공유 target | 동일 URL | 새 epoch millisecond revision URL |
| submit 전후 README Markdown | 고정 URL | byte-identical 고정 URL 유지 |
| matching metadata revision 일치 항목 | 이미지 query만 revision 사용 | URL·canonical·`og:url`·OG/Twitter image가 같은 revision 사용 |
| 전체 Node 검증 | 해당 변경 없음 | 825개 중 819 pass, 6 조건부 skip, 0 fail |
| 전체 Playwright 검증 | 해당 변경 없음 | 101/101 pass |
| production artifact | 해당 변경 없음 | client 8 files, migration 5 files, worker 2 files, verifier `ok: true` |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| owner `updatedAt`과 usage `uploadedAt`의 최신값으로 공통 revision을 계산한다. | OK — 공통 모듈 단위 테스트와 UI 통합 테스트 통과 |
| runtime·문서·UI의 public handle 검증이 공통 throwing·non-throwing validator를 사용한다. | OK — 중복 validator 제거와 parser 경계 테스트 통과 |
| public API가 파생 `shareRevision`을 제공하되 raw `owner.updatedAt`은 노출하지 않는다. | OK — backend allowlist·security 테스트와 직렬화 문자열 비노출 검증 통과 |
| revision URL의 epoch-millisecond 노출과 cache identity tradeoff가 공식 문서에 기록된다. | OK — `docs/readme-card.md`, `docs/production-hosting.md` 현행화 |
| matching revision의 canonical·`og:url`·이미지 token이 일치한다. | OK — Open Graph·public document·runtime 테스트 및 Stage 3 응답 실측 통과 |
| stale revision은 과거 snapshot을 가장하지 않고 현재 metadata로 수렴한다. | OK — `200` current metadata 계약 테스트 통과 |
| invalid revision은 public document route로 인정하지 않는다. | OK — parser·runtime 경계 테스트 통과 |
| fixed `/api/share/{handle}`와 `/u/{handle}` 하위 호환 및 private·missing 비열거를 유지한다. | OK — runtime·fallback 회귀 테스트 통과 |
| revision URL을 사람이 열면 같은 공개 profile SPA로 착지한다. | OK — route 단위·E2E 테스트 통과 |
| X와 LinkedIn이 최신 revision 카드를 표시한다. | OK — Stage 3에서 X 약 11초, LinkedIn 즉시 최신 카드 확인 |
| Threads·Facebook·Reddit revision 공유 흐름에 회귀가 없다. | OK — Stage 3 작성 창 실측 통과 |
| submit 전후 README Markdown은 완전히 동일하다. | OK — 단위 테스트와 E2E `Share Studio advances submit share targets while README Markdown stays fixed` 통과 |
| submit 전후 공유 링크와 5개 SNS target revision이 새 timestamp로 변경된다. | OK — 단위 테스트와 동일 E2E에서 6개 target 동시 갱신 확인 |
| 전체 회귀와 production artifact를 통과한다. | OK — Node 819 pass, Playwright 101 pass, production build와 artifact verifier 통과 |
| Stage 5에서 Sites 원격 상태를 추가 변경하지 않는다. | OK — saved version 33, access revision 59, environment revision 89 유지 확인 |

### 단계별 검증 결과

- Stage 1: [`task_m100_101_stage1.md`](../working/task_m100_101_stage1.md) — revision URL·metadata와 fixed·fallback 계약 고정
- Stage 2: [`task_m100_101_stage2.md`](../working/task_m100_101_stage2.md) — Node·dev·Sites runtime 및 공개 profile SPA 착지 통합
- Stage 3: [`task_m100_101_stage3.md`](../working/task_m100_101_stage3.md) — 공개 validation 배포와 5개 SNS provider 실측 gate 통과
- Stage 4: [`task_m100_101_stage4.md`](../working/task_m100_101_stage4.md) — README 고정/공유·SNS revision 분리와 핵심 단위·E2E 보정
- Stage 5: [`task_m100_101_stage5.md`](../working/task_m100_101_stage5.md) — 전체 회귀·production artifact 및 원격 무변경 확인
- Stage 6: [`task_m100_101_stage6.md`](../working/task_m100_101_stage6.md) — PR 리뷰 1~4 계약·날짜별 보드 보정과 전체 재검증

최종 인수 검증 명령은 다음과 같다.

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
git diff --check
git status --short
```

## 잔여 위험과 후속 작업

### 잔여 위험

- revision 경로는 외부 provider의 cache identity를 분리하지만 crawler·image processing 완료 시간을
  통제하지 않는다. Stage 3에서 X 약 11초, Threads 약 10초 지연이 관찰됐으므로 즉시 표시 SLA는
  보장하지 않는다.
- revision은 현재 카드 metadata를 가리키는 cache key이며 과거 카드 snapshot이 아니다. stale
  revision도 현재 metadata로 수렴하고, 최근 3개 카드나 DB history를 보존하지 않는다.
- public `shareRevision`은 raw ISO timestamp나 owner 객체를 노출하지 않지만 최신 공개 변경 시각을
  millisecond 정밀도의 epoch 숫자로 드러낸다. 이는 새 crawler cache identity를 만들기 위한
  의도된 공개 계약이다.
- PostgreSQL 연결이 필요한 6개 테스트는 로컬 `TEST_DATABASE_URL` 부재로 계획대로 제외됐다.
  이번 변경의 D1·Sites production 경로와 공통 URL 계약 테스트는 모두 통과했다.

### 후속 작업 후보

- `codex-usage-profile.meleeisdeveloping.chatgpt.site`를 canonical production으로 만들고 현재
  `stage5`를 테스트 전용으로 전환하는 별도 migration Issue를 등록한다.
- 후속 Issue에서 새 Sites project·D1·R2·GitHub OAuth·origin·CLI·문서 이전, rollback과 현재
  stage5 테스트 데이터 폐기 범위를 별도 승인받는다.

## 작업지시자 승인 요청

- 작업지시자가 PR #106 리뷰 지적 1~4의 Stage 6 보정과 기존 PR 갱신 진행을 승인했다. 이 보고서와
  검증 결과를 기준으로 `publish/task101`을 push하고 기존 `devel` 대상 Open PR을 현행화한다.
- PR merge와 Issue close는 별도 승인 또는 실제 merge 확인 전에는 수행하지 않는다.
