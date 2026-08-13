# Task #101 구현계획서 — X·LinkedIn 소셜 미리보기 revision 경로 캐시 갱신 실험

수행계획서: [`task_m100_101.md`](task_m100_101.md)
GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | revision URL·metadata 계약 고정 | `src/profile-shared/public-share-url.js`, runtime metadata·document parser | 공통 URL, matching·stale·invalid·fallback 단위 테스트 |
| 2 | runtime·SPA 착지 연결과 로컬 통합 검증 | Sites·Node·dev route regression, `src/profile-ui/publicProfileRoutes.js` | 세 runtime `GET`·`HEAD`, owner-only, SPA route 테스트 |
| 3 | 승인된 Sites 실험 배포와 플랫폼 gate | exact task101 artifact, `mydocs/working/task_m100_101_stage3.md` | X·LinkedIn A/B 및 Threads·Facebook·Reddit 회귀 실측 |
| 4 | Share Studio 단일 revision URL 전환과 공식 문서 현행화 | Share Studio data flow·target, 사용자·아키텍처·운영 문서 | builder·UI·E2E와 문서 route 계약 검증 |
| 5 | 전체 회귀 검증과 비배포 PR handoff | `mydocs/working/task_m100_101_stage5.md` | 전체 Node·Playwright·production build·Sites artifact 검증 |

## 문서 위치 확인

수행계획서에서 승인된 기존 공식 문서와 Hyper-Waterfall 산출물 위치를 그대로 사용한다.
`README.md`는 #84의 production 상태 소유권과 충돌하므로 이번 task에서 수정하지 않는다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 사용자 공유 문서 | `docs/` | `docs/readme-card.md` | OK | Stage 3 gate 통과 뒤 Stage 4에서 관련 절만 수정한다. |
| 공유 문서 아키텍처 | `docs/` | `docs/production-hosting.md` | OK | revision·canonical·fallback 계약을 기록한다. |
| 플랫폼 운영 절차 | `docs/` | `docs/sites-operations.md` | OK | crawler·platform smoke와 rollback 경계를 기록한다. |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_101_stage{1..5}.md` | OK | 각 Stage 소스·검증과 같은 단계 커밋에 포함한다. |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_101_report.md` | OK | Stage 5 승인 뒤 별도 최종 보고 절차에서 작성한다. |
| 오늘할일 | `mydocs/orders/` | `mydocs/orders/20260813.md` | OK | 단계 상태만 기존 행에서 갱신한다. |
| README | 변경 없음 | 변경 없음 | OK | #84가 production 진입·공개 상태를 소유한다. |

## 공통 구현 계약

- 최신 share revision은 owner `updatedAt`과 usage `uploadedAt`의 유효한 시각 중 최댓값을
  epoch milliseconds의 안전한 10진 정수 문자열로 변환한다.
- revision URL은 query와 hash가 없는 `/api/share/{encodedHandle}/r/{revision}`이다.
- revision은 외부 crawler cache identity이며 과거 카드 snapshot이나 DB history key가 아니다.
- matching revision 요청은 요청한 revision URL을 `canonical`과 `og:url`로 사용하고,
  `og:image`, `og:image:secure_url`, `twitter:image`는 같은 revision token을 사용한다.
- stale revision 요청은 redirect하지 않고 현재 문서를 `200`으로 응답하되, metadata의
  `canonical`·`og:url`·이미지 token을 현재 revision URL로 수렴시킨다. 과거 snapshot을
  제공한다고 가장하지 않으며 crawler가 최신 identity를 발견할 수 있게 한다.
- 형식이 잘못됐거나 안전한 정수가 아닌 revision path는 public profile document route로
  인정하지 않는다. 해당 runtime의 기존 API/static fallback이 처리하도록 한다.
- 기존 `/api/share/{handle}`와 `/u/{handle}` 문서는 현재 self canonical 하위 호환을 유지한다.
- private·missing·legacy·media failure는 현재 site-root canonical과 packaged sample image를
  유지하고 revision URL로 handle 존재 여부를 노출하지 않는다.
- 1차 실험에서는 HTML·PNG cache-control과 redirect 정책을 바꾸지 않는다.
- Stage 3 gate가 X와 LinkedIn 모두에서 통과하기 전에는 Share Studio가 만드는 URL을 바꾸지 않는다.

## Stage 1 — revision URL·metadata 계약 고정

### 산출물

신규:

- `src/profile-shared/public-share-url.js`
- `src/profile-shared/__tests__/public-share-url.test.js`
- `mydocs/working/task_m100_101_stage1.md`

수정:

- `src/profile-runtime/open-graph.js`
- `src/profile-runtime/public-profile-document.js`
- `src/profile-runtime/__tests__/open-graph.test.js`
- `src/profile-runtime/__tests__/public-profile-document.test.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- 브라우저와 Node runtime에서 함께 import할 수 있고 I/O가 없는 공통 모듈을 만든다.
- 공통 모듈에 다음 책임을 둔다.
  - owner·usage timestamp에서 revision token 계산
  - handle 인코딩과 fixed·revision share path/URL 생성
  - fixed·revision share path의 엄격한 parsing
  - 빈 값, invalid date, 음수, 소수, `Number.MAX_SAFE_INTEGER` 초과 값 거부
- public document parser가 `/api/share/{handle}/r/{revision}`을 별도 request identity로 반환하게
  확장하되 기존 caller가 fixed route를 처리하는 계약을 깨지 않는다.
- Open Graph builder가 현재 profile revision을 한 번 계산한 뒤 share URL과 social image URL에
  같은 token을 사용하게 한다.
- matching·stale revision의 동작을 위 공통 구현 계약대로 테스트 먼저 고정한다.
- encoded handle, trailing slash, 추가 path segment, query 존재, `GET`·`HEAD` predicate 경계를
  table-driven fixture로 검증한다. query는 document 판별에 영향을 주지 않되 URL metadata에는
  포함하지 않는다.
- fixed route, private·missing fallback과 기존 cache header는 변경되지 않았음을 회귀 테스트한다.

### 검증

```bash
node --test \
  src/profile-shared/__tests__/public-share-url.test.js \
  src/profile-runtime/__tests__/open-graph.test.js \
  src/profile-runtime/__tests__/public-profile-document.test.js
git diff --check
```

### 완료 조건

- 동일 profile fixture에서 URL token과 모든 social image token이 완전히 같다.
- matching revision은 self canonical, stale revision은 현재 revision canonical로 수렴한다.
- invalid revision은 document predicate에서 제외된다.
- 기존 fixed route와 fallback fixture의 snapshot·header에 의도하지 않은 차이가 없다.

### 커밋

```text
Task #101 Stage 1: revision 공유 문서 계약 고정
```

## Stage 2 — runtime·SPA 착지 연결과 로컬 통합 검증

### 산출물

신규:

- `mydocs/working/task_m100_101_stage2.md`

수정:

- `src/profile-ui/publicProfileRoutes.js`
- `src/profile-ui/__tests__/publicProfileRoutes.test.js`
- 필요 시 `src/profile-ui/appRoutes.js`
- 필요 시 `src/profile-ui/__tests__/appRoutes.test.js`
- `src/profile-runtime/__tests__/dev-server.test.js`
- `src/profile-runtime/__tests__/production-server.test.js`
- `src/profile-runtime/sites/__tests__/backend.test.js`
- `src/profile-runtime/sites/__tests__/worker.test.js`
- `src/profile-runtime/sites/__tests__/full-stack.test.js`
- 필요 시 `src/profile-runtime/sites/__tests__/observability.test.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- 사람이 revision share URL을 열었을 때 기존 공개 profile 화면으로 착지하도록 client parser를
  확장한다. revision token은 공개 profile API lookup에 전달하지 않고 handle만 사용한다.
- 공통 public document predicate를 사용하는 Node production, dev, Sites backend·worker가
  revision path를 HTML document로 처리하는지 검증한다.
- `GET`은 body metadata를, `HEAD`는 같은 status·header와 빈 body를 제공하는 기존 계약을 유지한다.
- public owner-only route guard가 revision path를 backend API로 오분류하지 않고 문서 요청으로
  차단하는지 검증한다.
- private·missing·crawler User-Agent·raw handle redaction·static asset route의 회귀를 확인한다.
- Share Studio와 SNS target은 계속 fixed `/api/share/{handle}`를 사용한다. 이 Stage에서는
  platform 실험을 위한 revision URL을 공통 builder로 수동 생성하는 데까지만 연결한다.
- 로컬 runtime에서 fixed·matching·stale·invalid revision matrix를 curl과 자동 테스트로 대조한다.

### 검증

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

### 완료 조건

- Node production, dev, Sites에서 matching revision `GET`·`HEAD`가 동일 metadata 계약을 지킨다.
- revision URL을 브라우저로 열면 해당 handle의 기존 공개 profile이 표시된다.
- owner-only, private·missing 비열거, fixed route와 static/API routing에 회귀가 없다.
- Share Studio가 생성하는 외부 공유 URL은 아직 바뀌지 않는다.

### 커밋

```text
Task #101 Stage 2: revision 경로 runtime과 SPA 착지 연결
```

## Stage 3 — 승인된 Sites 실험 배포와 플랫폼 gate

### 산출물

신규:

- `mydocs/working/task_m100_101_stage3.md`

수정:

- `mydocs/orders/20260813.md`

제품 소스와 공식 문서는 이 Stage에서 수정하지 않는다. 검증 결과가 계약 수정을 요구하면
Stage 3을 완료 처리하지 않고 구현계획 변경 승인부터 다시 받는다.

### 변경 내용

- Stage 시작 전에 `.openai/hosting.json`이 지정한 배포 체계의 `sites-building`과
  `sites-hosting` Skill을 읽고, exact target·access·현재 saved version·rollback 기준을 확인한다.
- 실제 배포 전에 다음 정보를 작업지시자에게 제시하고 별도 승인을 받는다.
  - 배포 대상 validation site와 production 여부
  - 배포할 `local/task101` exact commit SHA
  - 기존 saved version·access 변경 여부
  - rollback 대상 version과 명령
- 승인된 validation target에만 exact task101 artifact를 배포한다. `main`, production access,
  production saved version과 #84 소유 상태는 변경하지 않는다.
- 동일 공개 profile에서 revision A와 카드 저장 또는 새 submit으로 생성된 revision B를 준비한다.
  사용자 데이터 mutation과 외부 SNS 게시·작성 창 사용 범위는 배포 승인 시 함께 확인한다.
- A·B URL별 application 증거를 기록한다.
  - status, final URL, `canonical`, `og:url`
  - `og:image`, `twitter:image`, image status·content type·ETag
  - desktop browser와 crawler User-Agent 응답 시각
- X composer에서 새 revision B URL의 최신 이미지와 최초 표시까지의 지연을 측정한다.
- LinkedIn composer와 Post Inspector에서 새 revision B URL의 최신 이미지를 확인한다.
- Threads, Facebook, Reddit에서 revision B 경로가 기존 fixed route 대비 회귀하지 않는지 확인한다.
- 플랫폼에는 게시를 완료하지 않고 작성 창 미리보기만 검증하는 것을 기본으로 한다. 게시가
  반드시 필요하면 실행 전에 작업지시자의 추가 승인을 받는다.

### gate 판정

통과 조건:

- application 응답에서 revision B URL·canonical·`og:url`·image token이 모두 B로 일치한다.
- X 새 작성 창이 허용한 관찰 시간 안에 revision B 최신 이미지를 표시한다.
- LinkedIn 새 작성 창 또는 Post Inspector가 revision B 최신 이미지를 표시하고 fixed URL의
  오래된 cache identity와 구분한다.
- Threads, Facebook, Reddit의 revision B 미리보기에 기능 회귀가 없다.

실패 조건과 처리:

- X 또는 LinkedIn 중 하나라도 revision B를 최신 카드로 인식하지 못하면 Stage 4로 진행하지 않는다.
- provider 결과와 application 결과를 분리해 Stage 3 보고서에 기록하고, canonical·redirect·header
  변경 또는 native share 대안의 새 수행계획 승인을 요청한다.
- gate 실패 상태에서는 Share Studio와 공식 문서를 fixed URL 계약 그대로 유지한다.

### 검증

배포 전:

```bash
npm run build:production
npm run verify:sites-fullstack
git diff --check
```

배포 후 자동·수동 검증은 승인된 validation origin을 명시해 수행하고, URL·시각·revision·결과를
Stage 3 보고서에 기록한다. 로그인 cookie, device code, auth header 등 secret은 보고서와 명령
출력에 남기지 않는다.

### 완료 조건

- 별도 배포 승인의 target·commit·rollback 경계와 실제 결과가 일치한다.
- X·LinkedIn gate가 모두 통과했거나, 실패 결과가 기록되고 Stage 4가 중단된다.
- validation 외 production 상태와 #84 소유 상태가 변하지 않았다.

### 커밋

```text
Task #101 Stage 3: revision 경로 플랫폼 실측 결과 기록
```

## Stage 4 — Share Studio 단일 revision URL 전환과 공식 문서 현행화

### 진입 조건

- Stage 3의 X·LinkedIn gate가 모두 통과하고 단계 보고서가 승인됐다.
- gate가 실패했으면 이 Stage를 시작하지 않고 수행·구현계획 변경 승인을 받는다.

### 산출물

신규:

- `mydocs/working/task_m100_101_stage4.md`

수정:

- `src/profile-ui/shareStudio.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/__tests__/shareStudio.test.js`
- 필요 시 `src/profile-ui/__tests__/cardImageReadiness.test.js`
- `tests/profile-ui.spec.js`
- `docs/readme-card.md`
- `docs/production-hosting.md`
- `docs/sites-operations.md`
- `mydocs/orders/20260813.md`

### 변경 내용

- `ShareStudio`에 owner `updatedAt`과 usage `uploadedAt`을 명시적으로 전달하고 공통 함수로 최신
  revision을 계산한다.
- 유효한 timestamp가 있으면 공유 링크 복사와 X, LinkedIn, Threads, Facebook, Reddit target이
  모두 동일한 revision path URL을 사용한다. 플랫폼별 URL variant는 만들지 않는다.
- timestamp가 없거나 invalid하면 기존 fixed `/api/share/{handle}`로 fail safe한다.
- 카드 설정 저장은 갱신된 owner timestamp, submit은 갱신된 usage timestamp를 profile state에서
  받은 뒤 share target을 다시 계산하는지 단위·E2E로 검증한다.
- share dialog readiness와 image load 경계를 유지해 저장 직후 이전 revision URL을 복사하지 않게 한다.
- 사용자 문서에는 새로 복사되는 URL, 기존 fixed URL·README 카드 하위 호환, 과거 revision이
  snapshot을 보장하지 않는다는 점을 기록한다.
- 아키텍처 문서에는 revision 계산, matching·stale canonical, private·missing fallback을 기록한다.
- 운영 문서에는 crawler response와 provider cache를 분리하는 smoke, X 처리 지연, LinkedIn Post
  Inspector 및 rollback 절차를 기록한다.
- `README.md`, production origin·access·saved version, DB schema는 수정하지 않는다.

### 검증

```bash
node --test \
  src/profile-shared/__tests__/public-share-url.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/cardImageReadiness.test.js \
  src/profile-ui/__tests__/publicProfileRoutes.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|공유"
git diff --check
```

### 완료 조건

- 같은 화면 상태에서 링크 복사와 다섯 SNS target의 decoded share URL이 완전히 같다.
- 카드 설정 저장·submit 후 revision URL이 바뀌며 현재 profile timestamp와 일치한다.
- invalid timestamp는 fixed route로 안전하게 fallback한다.
- 기존 fixed route·README 카드·private profile 계약과 공식 문서 링크에 회귀가 없다.

### 커밋

```text
Task #101 Stage 4: Share Studio revision 공유 URL 통일
```

## Stage 5 — 전체 회귀 검증과 비배포 PR handoff

### 산출물

신규:

- `mydocs/working/task_m100_101_stage5.md`

수정:

- 검증 실패가 task101 범위의 결함일 때만 관련 소스·테스트·문서
- `mydocs/orders/20260813.md`

Stage 5 승인 뒤 별도 최종 보고 절차에서 `mydocs/report/task_m100_101_report.md`를 작성하고,
최종 커밋·`publish/task101` push·`devel` 대상 PR을 준비한다.

### 변경 내용

- 전체 Node test, Playwright, production build와 Sites artifact 검증을 실행한다.
- revision URL·metadata·runtime·SPA·Share Studio·private fallback의 통합 matrix를 최종 점검한다.
- task101에서 production deploy, access, saved version을 변경하지 않았음을 확인한다.
- #84에 필요한 release handoff는 최종 보고서와 PR 본문에만 기록하며 #84 파일·브랜치를 수정하지 않는다.
- 검증 실패가 범위를 넓히면 수정하지 않고 구현계획 변경 승인을 요청한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
git diff --check
git status --short
```

### 완료 조건

- 모든 자동 검증이 통과하고 작업 worktree에 의도하지 않은 파일이 없다.
- Stage 3 evidence와 Stage 4 공식 문서가 최종 코드 계약과 일치한다.
- production mutation이나 신규 DB·provider API가 포함되지 않았다.
- 최종 보고 절차 진입 전 Stage 5 보고서가 작업지시자에게 승인됐다.

### 커밋

```text
Task #101 Stage 5: 전체 회귀 검증과 PR handoff 완료
```

## 검증 원칙

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행하고 실제 결과·소요 시간·실패 원인을 기록한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 테스트를 범위에 맞게 추가하되 기존 검증을 삭제하거나 완화해 통과시키지 않는다.
- 외부 플랫폼 결과는 비결정적이므로 application response와 provider preview 결과를 별도 증거로 남긴다.
- 계획 변경이 필요하면 소스를 먼저 수정하지 않고 수행계획서 또는 구현계획서를 갱신해 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 문서 수정 전에 위치 판단 변경 승인을 받는다.
- 각 Stage 완료 시 `task-stage-report` Skill을 적용해 소스·테스트·단계 보고서를 한 커밋으로 묶는다.
- Stage 5 승인 뒤에만 `task-final-report` Skill을 적용한다.

## 단계 의존성

- Stage 2는 Stage 1의 공통 URL·metadata 계약과 단계 보고서 승인 후 진행한다.
- Stage 3은 Stage 2의 세 runtime·SPA 로컬 검증과 단계 보고서 승인 후 진행한다.
- Stage 3의 실제 Sites 배포는 target·commit·rollback을 제시한 별도 작업지시자 승인에 의존한다.
- Stage 4는 Stage 3에서 X와 LinkedIn gate가 모두 통과하고 보고서가 승인돼야 진행한다.
- Stage 5는 Stage 4의 Share Studio·문서 변경과 보고서 승인 후 진행한다.
- 최종 보고서·publish branch·PR은 Stage 5 승인 후 별도 절차로 진행한다.

## 위험과 대응

- **LinkedIn이 revision path도 canonical cache로 합침**: self canonical·`og:url` 정렬을 실측하고,
  실패하면 Stage 4를 중단한 뒤 redirect·header 또는 native share 대안을 재설계한다.
- **X cold image 처리 지연**: crawler `200`과 composer 이미지 표시 시각을 분리해 측정하고 즉시 표시를
  보장한다고 문서화하지 않는다.
- **stale revision의 과거 snapshot 오해**: `200` current metadata 수렴 계약을 테스트·공식 문서에
  명시하고 DB history를 추가하지 않는다.
- **runtime과 UI revision 불일치**: 공통 순수 함수와 동일 fixture를 사용하고 모든 target URL을
  한 번 계산한 값에서 파생한다.
- **private handle 열거**: revision route에서도 site-root canonical·sample fallback을 유지하고
  private·missing 응답을 대조한다.
- **invalid revision route 오분류**: parser가 엄격하게 거부하도록 하고 API/static fallback·owner-only
  matrix를 세 runtime에서 검증한다.
- **#84 및 동시 worktree 충돌**: 각 Stage 시작 전 `origin/devel`, 활성 worktree와 배포 target을 확인하고
  같은 파일 변경이 들어오면 병합 전에 범위·순서를 다시 승인받는다.
- **외부 플랫폼 검증 중 게시 mutation**: 기본은 작성 창 미리보기까지만 수행하고 실제 게시가 필요하면
  별도 승인을 받는다.
- **검증 배포가 production에 영향**: validation target과 rollback version을 사전 확인하고 production
  access·saved version·`main`을 변경하지 않는다.

## 승인 요청 사항

- 위 5개 Stage 분할과 Stage별 산출물·검증 명령·커밋 메시지
- stale revision을 redirect 없이 `200` current metadata로 수렴시키는 상세 계약
- invalid revision을 public document route에서 제외하는 경계
- Stage 2까지 Share Studio fixed URL을 유지해 platform 실험 변수를 분리하는 순서
- Stage 3 시작 전에 Sites target·exact commit·rollback을 다시 승인받고, 실제 SNS 게시에는 추가 승인을
  받는 조건
- X와 LinkedIn 중 하나라도 gate를 통과하지 못하면 Stage 4 전체 SNS 전환을 중단하는 조건
- Stage 4에서 모든 SNS target을 플랫폼별 분기 없이 같은 revision URL로 통일하는 구현
- 승인된 세 공식 문서만 Stage 3 gate 통과 뒤 수정하고 `README.md`와 #84 production 상태를 유지하는 범위
- 각 Stage 종료 후 단계 보고서 승인을 받아야 다음 Stage로 진입하는 순서

승인되면 Stage 1의 공통 revision URL·metadata 계약 구현부터 시작한다.
