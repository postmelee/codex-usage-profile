# Task #101 Stage 6 보고서 — PR #106 리뷰 계약·날짜별 작업 기록 보정

GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
구현계획서: [`task_m100_101_impl.md`](../plans/task_m100_101_impl.md)
Stage: 6

## 단계 목적

PR #106 대화에 남은 리뷰 지적 1~4를 한 번에 반영한다. 중복된 public handle 검증을 공통
모듈로 수렴시키고, revision 경로에 epoch millisecond가 노출되는 계약을 문서화하며, raw
`owner.updatedAt`을 공개하지 않고 같은 계산기의 파생값 `shareRevision`만 public profile API에
제공한다. 동시에 실제 작업일별 오늘할일 문서를 복구하고 Stage 6 전체 회귀를 다시 통과시키는
구현계획 Stage 6다.

## 산출물

| 파일·대상 | 변경 요약 |
|---|---|
| `src/profile-shared/public-share-url.js` 및 테스트 | throwing validator를 감싼 `parsePublicShareHandle`을 추가해 runtime·UI가 동일한 handle 경계를 사용하도록 했다. |
| `src/profile-runtime/public-profile-document.js`, `public-profile-resolver.js` | 문서 route의 중복 validator를 제거하고 revision 날짜 계산도 공통 `resolvePublicShareRevision`으로 수렴시켰다. |
| `src/profile-backend/http.js` 및 backend·security 테스트 | public allowlist에 파생 숫자 `shareRevision`을 추가하되 raw `owner.updatedAt`과 저장 메타데이터는 계속 제외했다. |
| `src/profile-ui/publicProfileRoutes.js`, `shareStudio.js`와 React 연결부·테스트 | public `shareRevision`을 엄격히 검사하고 Share Studio가 이를 우선 사용하되 구형 응답은 기존 timestamp fallback을 유지하도록 했다. |
| `docs/readme-card.md`, `docs/production-hosting.md` | revision URL이 최신 public 변경 시각을 millisecond 정밀도의 epoch 숫자로 노출한다는 cache identity·보안 경계를 명시했다. |
| `mydocs/orders/20260813.md`, `20260817.md`, `20260818.md` | 8월 13일 기록을 당시 Stage 1 상태로 복구하고 이후 진행을 실제 작업일별 문서로 분리했다. |
| `mydocs/plans/task_m100_101.md`, `task_m100_101_impl.md` | 리뷰 보정 범위·검증·승인 경계를 Stage 6으로 추가했다. |
| `mydocs/working/task_m100_101_stage6.md`, `mydocs/report/task_m100_101_report.md` | 리뷰 지적 1~4의 구현·검증 결과와 최종 인수 근거를 현행화했다. |

## 본문 변경 정도 / 본문 무손실 여부

README Markdown 계약은 변경하지 않았다. 생성 결과는 계속 fixed
`href=/api/share/{handle}`와 query 없는 `img src=/u/{handle}/card.png`를 사용한다. public
`shareRevision`은 공유 링크 복사와 X·LinkedIn·Threads·Facebook·Reddit target의 최신 revision
경로를 계산하기 위한 파생 cache key일 뿐, README Markdown이나 카드 이미지 canonical URL에
삽입되지 않는다.

public profile 응답에는 raw `owner.updatedAt`을 추가하지 않았다. 공개되는 값은 owner 갱신 시각과
usage upload 시각 중 최신값을 공통 계산기로 정규화한 safe integer `shareRevision` 하나이며,
credential·owner id·snapshot history·저장 메타데이터는 노출하지 않는다. DB schema, 배포 상태,
외부 SNS 게시물은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-shared/__tests__/public-share-url.test.js \
  src/profile-runtime/__tests__/public-profile-document.test.js \
  src/profile-runtime/__tests__/public-profile-resolver.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-backend/__tests__/security.test.js \
  src/profile-api/__tests__/client.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/publicProfileRoutes.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio advances"
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
git diff --check
git status --short
```

결과:

- OK — 관련 Node 단위·통합 테스트 129개 통과, 실패 0개. 공통 handle parser, public
  `shareRevision` allowlist·비노출 경계, Share Studio 우선순위와 fallback을 포함했다.
- OK — 집중 E2E 1개 통과. 첫 실행에서 React가 전달한 `shareRevision: undefined`를 명시값으로
  오인하는 경계를 발견했고, undefined는 구형 timestamp fallback으로 처리하도록 보정한 뒤
  재실행했다.
- OK — 전체 Node test 825개: 819 pass, 6 environment-conditional skip, 0 fail. PostgreSQL
  연결이 필요한 6개만 `TEST_DATABASE_URL` 부재로 계획대로 제외됐다.
- OK — 전체 Playwright 101/101 통과, 약 1.6분. submit 전후 README Markdown byte-identical
  유지와 공유 링크·다섯 SNS target revision 동시 갱신 시나리오를 포함했다.
- OK — production Sites full-stack build 통과. Vite server 62 modules와 client 1,834 modules를
  build하고 artifact를 정상 finalize했다.
- OK — artifact verifier가 client 8 files, migrations 5 files, worker 2 files,
  worker raw 4,012,467 bytes, compressed 2,168,373 bytes를 검사하고 `ok: true`를 반환했다.
- OK — `git diff --check` 경고 없음. 검증용 `node_modules` symlink를 제거했고 의도하지 않은
  artifact·dependency 파일을 남기지 않았다.

## 잔여 위험

- `shareRevision`은 최신 공개 변경 시각을 millisecond 정밀도의 epoch 숫자로 드러낸다. exact ISO
  timestamp나 raw owner 객체를 반환하지는 않지만 시각 정보 자체는 cache identity 계약상 공개된다.
- revision 경로는 provider cache identity를 분리할 뿐 X·LinkedIn 등 외부 crawler의 수집 완료
  시간을 통제하지 않는다. 즉시 표시 SLA는 보장하지 않는다.
- 과거 revision은 snapshot이 아니며 현재 metadata로 수렴한다. DB history나 최근 카드 버전을
  보존하는 로직은 이번 범위에 없다.
- PostgreSQL 통합 테스트 6개는 로컬 `TEST_DATABASE_URL` 부재로 계획대로 skip됐다.

## 다음 단계 영향

- Stage 6 이후 새 제품 Stage는 없다. 같은 `publish/task101`을 갱신해 PR #106에서 리뷰 지적
  1~4와 CI 결과를 다시 확인한다.
- GitHub 리뷰 대화 답변·해결, PR merge와 Issue close는 작업지시자의 별도 지시 또는 실제 merge
  확인 전에는 수행하지 않는다.
- canonical production origin migration과 stage5 테스트 전용 전환은 별도 Issue 범위로 유지한다.

## 승인 요청

- 작업지시자가 PR #106 리뷰 지적 1~4의 Stage 6 보정과 기존 PR 갱신을 승인했다. 이 보고서와
  검증 결과를 기준으로 Stage 6 커밋을 `publish/task101`에 push하고 PR 본문을 현행화한다.
