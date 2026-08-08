# Task #78 구현계획서 — 소셜 공유 OG 메타데이터와 PublicProfilePage 카드 인트로

수행계획서: [`task_m100_78.md`](task_m100_78.md)
GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | OG 계약과 문서 핸들러 | `src/profile-runtime/open-graph.js`, `src/profile-runtime/public-profile-document.js` | `npm test`, 태그 계약 단위 테스트 |
| 2 | 소셜 캔버스와 단일 이미지 | `src/profile-card/social-canvas.js`, `src/profile-media/publication-service.js` | `npm test`, PNG 크기·단일 객체·갱신 확인 |
| 3 | 런타임 연결과 운영 모드 | `sites/worker.js`, `sites/backend.js`, `production-server.js`, `dev-server.js` | `npm test`, 크롤러 UA 3런타임 대조, owner-only 차단 |
| 4 | 공개 카드 통일과 소유자 안내 | `src/profile-ui/PublicProfilePage.jsx` | `npm test`, 실측 600x368, 응답 균일성 |
| 5 | 모션 공용화와 인트로 모달 | `src/profile-ui/useCardHandoffMotion.js`, `PublicCardIntro.jsx` | `npm test`, `npm run test:e2e` |
| 6 | Share Studio 재구성과 통합 검증 | `ShareStudio.jsx`, `docs/readme-card.md` | `npm test`, `npm run test:e2e`, 실플랫폼 확인 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/readme-card.md` | `docs/` | `docs/readme-card.md` (Stage 6) | OK | 새 문서를 만들지 않고 공유 흐름 절만 수정 |

## Stage 1 — OG 계약과 문서 핸들러

### 산출물

신규:

- `src/profile-runtime/open-graph.js`
- `src/profile-runtime/public-profile-document.js`
- `src/profile-runtime/__tests__/open-graph.test.js`
- `src/profile-runtime/__tests__/public-profile-document.test.js`

수정:

- 없음. `host-adapter.js`는 건드리지 않는다.

### 변경 내용

- `buildProfileOpenGraphTags({ profile, handle, locale, origin })`를 만들어 태그 집합을 순수 함수로 생성한다. 공개 프로필이면 handle별 태그, 비공개·미존재면 사이트 기본 태그를 반환한다.
- 태그 값은 수행계획서 설계 방향을 그대로 따른다. `og:type=website`, `og:title={handle}'s Codex card`, `og:description`은 ko/en 고정 문구, `og:url`과 canonical은 쿼리 없는 `/u/{handle}`, `og:image`는 `/u/{handle}/social.png?v={revision}`.
- `og:image:width=1200`, `og:image:height=630`, `og:image:type`, `og:image:alt`, `og:locale`, `og:locale:alternate`, `twitter:card=summary_large_image`와 `twitter:title|description|image|image:alt`를 포함한다.
- 속성값은 HTML 이스케이프한다. 특히 `&`는 `&amp;`로 출력한다.
- `v` 리비전 토큰은 `uploadedAt`을 초 단위 epoch로 변환해 사용한다. `presentationDigest`는 cardStyle만 반영하므로 사용하지 않는다.
- 문구 로케일은 요청 `?locale`을 우선하고, 없으면 소유자 저장 `cardLocale`을 따른다. 이미지는 이 값에 영향받지 않는다.
- `createPublicProfileDocumentHandler({ loadIndexHtml, resolveProfile, publicBaseUrl })`를 만든다. `/u/{handle}` GET/HEAD를 판별하고, 프로필을 조회해 태그를 만들고, index.html의 `<head>`에 주입해 응답한다. 매칭되지 않으면 `null`을 반환해 호출 측이 기존 처리로 넘어가게 한다.
- 라우팅 경계는 바꾸지 않는다. `isProfileBackendRoutePath`와 `looksLikeStaticAsset`은 그대로 두고 `host-adapter.js`를 수정하지 않는다. Sites 백엔드 핸들러는 `environment.ASSETS`를 받지 않으므로 라우트를 승격하면 index.html을 읽을 수 없다.
- `resolveProfile`은 단일 인덱스 조회로 제한한다. handle에서 owner와 최신 usage의 `uploadedAt`만 얻고 카드 렌더나 미디어 조회를 하지 않는다.
- HTML 응답 캐시 헤더는 짧은 `s-maxage`와 `must-revalidate`로 두고 값은 테스트에 고정한다. 핸들별 응답이 섞이지 않도록 `vary`와 캐시 키 조건을 테스트로 고정한다.
- `loadIndexHtml`은 주입 지점에서 문자열을 반환하는 비동기 함수로 정의한다. 런타임별 구현은 Stage 3에서 연결한다.

### 검증

```bash
npm test
git status --short
git diff --check
```

- `host-adapter.js`와 그 테스트가 변경되지 않았는지 `git status --short`로 확인한다.

### 커밋

```text
Task #78 Stage 1: Open Graph 태그 계약과 공개 프로필 문서 핸들러
```

## Stage 2 — 소셜 캔버스와 단일 이미지

조사 결과 두 가지가 계획 시점 가정과 달라 하위 단계로 나눈다.

- 미디어 계약은 버전 4에 v3 레거시 분기를 유지하고 어댑터가 memory, r2-binding, s3 셋이다. `representations`에 format 축을 넣으면 계약 버전 인상과 정합성 검사 재작업이 따라온다. 승인된 범위가 아니므로 계약 버전을 유지하고 독립 stable key와 전용 store 메서드를 사용한다.
- 카드 렌더러는 Node용(`renderer.js`)과 Worker용(`worker-renderer.js`) 두 구현이며 프로덕션 Sites는 Worker 구현을 쓴다. 소셜 출력도 양쪽에 필요하다.

### Stage 2.1 산출물

신규:

- `src/profile-card/social-canvas.js`
- `src/profile-card/__tests__/social-canvas.test.js`
- `src/profile-card/__tests__/social-renderer.test.js`

수정:

- `src/profile-card/renderer.js`
- `src/profile-card/worker-renderer.js`

### Stage 2.1 변경 내용

- 1200x630 캔버스 배치 계약을 단일 모듈로 고정한다. 카드는 960 x 588.7로 축소해 중앙 배치하고 좌우 120, 상하 20.7 여백을 둔다. 종횡비 499:306을 보존한다.
- 배치 모듈은 렌더러를 import하지 않는다. 카드 논리 크기를 자체 상수로 두고 렌더러 값과 일치하는지 테스트로 고정해 순환 import를 피한다.
- Node 렌더러에 `renderProfileSocialCardPng`를 추가한다. 카드 드로잉을 `drawCard`로 분리해 기존 경로와 공유하고, 소셜 경로는 배경을 채운 뒤 translate/scale 후 같은 드로잉을 호출한다.
- Worker 렌더러의 SVG 본문을 `createWorkerProfileCardBody`로 분리하고 `createWorkerProfileSocialCardSvg`가 1200x630 래퍼에 같은 본문을 배치한다. 렌더 팩토리는 `renderSocial`을 함께 노출한다.
- 캔버스 여백은 투명으로 둔다. 카드의 크기, 비율, 테두리 곡선은 원본 그대로 유지하고 둥근 모서리가 여백과 구분되어 보이게 한다. 새 색을 도입하지 않는다.
- 기존 카드 출력의 바이트와 SVG 치수는 변경하지 않는다.

### Stage 2.2 산출물

수정:

- `src/profile-card/service-core.js`
- `src/profile-media/media-store-contract.js`
- `src/profile-media/publication-service.js`
- `src/profile-media/maintenance-contract.js`
- `src/profile-media/r2-binding/store.js`
- `src/profile-media/s3/store.js`
- `src/profile-runtime/open-graph.js`
- `src/profile-backend/http.js`
- `scripts/cleanup-orphan-card-media.mjs`
- 각 영역 `__tests__`

### Stage 2.2 변경 내용

- 미디어 계약 버전은 유지한다. `cards/v2/public/{handle}/social.png` stable key와 전용 store 메서드를 추가하고 memory, r2-binding, s3 세 어댑터가 동일하게 구현한다.
- `publishOwnerCard`에 소셜 객체 생성을 편입한다. publish, 카드 설정 저장 경유의 `ensurePublishedCardVariants`, 사용량 갱신 refresh가 모두 같은 경로를 지나므로 별도 트리거를 만들지 않는다. 소유자가 저장한 `cardLocale`과 `cardStyle.theme`으로 하나만 만든다.
- `unpublishOwnerCard`가 소셜 객체도 함께 제거한다.
- `GET|HEAD /u/{handle}/social.png` 라우트를 추가한다. theme/locale 쿼리는 받지 않고 `v`는 무시 가능한 캐시 버스터다. 응답은 publication 존재를 먼저 확인하므로 unpublish 이후에는 노출되지 않는다. ETag, 304, 404 계약은 `card.png`와 같다.
- OG 폴백 `og:image`를 운영자 핸들의 소셜 이미지로 지정한다. 운영자 핸들은 `MARKETING_OPERATOR_CARD_HANDLE`과 같은 값을 사용한다.
- orphan cleanup 판정에 소셜 stable key를 포함한다.
- `/u/{handle}/card.png`의 경로, 응답, ETag는 변경하지 않는다.

### 검증

```bash
npm test
npm run cleanup:card-media -- --dry-run
git diff --check
```

- Stage 2.1은 출력 PNG가 1200x630이고 여백과 배치가 설계값과 일치하는지, 결정적인지, 기존 카드 SVG 치수가 그대로인지 확인한다.
- Stage 2.2는 로컬 서버에서 다음을 확인한다.
  - `curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" .../u/{handle}/social.png`
  - 카드 설정을 light/en으로 저장한 뒤 같은 URL의 이미지가 갱신
  - 저장 전후 소셜 객체가 하나만 존재
  - unpublish 후 `social.png`가 404
  - `card.png` 바이트 무변경

### 커밋

```text
Task #78 [Stage 2.1]: 소셜 1200x630 캔버스 배치와 두 렌더러 출력
Task #78 [Stage 2.2]: 단일 social.png 발행과 공개 라우트
```

## Stage 3 — 런타임 연결과 운영 모드 반영

### 산출물

수정:

- `src/profile-runtime/sites/worker.js`
- `src/profile-runtime/sites/backend.js`
- `src/profile-runtime/production-server.js`
- `src/profile-runtime/dev-server.js`
- 각 영역 `__tests__`

`static-assets.js`와 `host-adapter.js`는 수정하지 않는다.

### 변경 내용

- Sites: `handleProfileSitesRequest`에서 문서 핸들러를 조립한다. `loadIndexHtml`은 `environment.ASSETS.fetch(new Request(INDEX_PATH, request))`, `resolveProfile`은 D1 store 조회를 사용한다. 문서 핸들러가 `null`을 반환하면 기존 `hostHandler` 경로로 넘어간다.
- Node 프로덕션: `startProductionServer`에서 같은 조립을 수행한다. `loadIndexHtml`은 빌드 산출물의 index.html 읽기를 사용한다.
- dev: `createProfileRuntimeNodeHandler`에서 `/u/{handle}`을 vite 미들웨어보다 먼저 처리한다. `loadIndexHtml`은 루트 index.html을 읽어 `vite.transformIndexHtml(url, html)`을 거친 문자열을 반환한다. dev store는 `config.profileStoreFile` 기반 파일 store로 구성한다.
- 비공개·미존재 handle은 사이트 기본 태그로 폴백하고 상태 코드는 200을 유지한다. 프로필 존재 여부를 상태 코드로 구분하지 않는다.
- `createProfileSitesOperationalStopResponse`의 `owner-only` 차단 판정에 `/^\/u\/[^/]+$/` GET/HEAD를 추가한다. 차단 응답은 기존 공개 라우트와 같은 형태를 따른다.
- 정적 자산 경로와 API 경로는 기존 동작을 유지한다.

### 검증

```bash
npm test
git diff --check
```

- 크롤러 User-Agent로 세 런타임 응답을 대조한다.
  - `curl -sA "Twitterbot/1.0" .../u/{handle} | grep -o '<meta [^>]*>'`
  - `curl -sA "facebookexternalhit/1.1" .../u/{handle}`
  - `curl -sA "kakaotalk-scrap/1.0" .../u/{handle}`
- 비공개 handle과 미존재 handle 응답이 동일한지 확인한다.
- `PROFILE_SERVICE_MODE=owner-only`에서 `/u/{handle}` HTML이 차단되고, `normal`에서는 정상 응답하는지 확인한다.
- HTML 응답의 캐시 헤더와 `vary`를 확인한다.
- `git status --short`로 `static-assets.js`와 `host-adapter.js`가 변경되지 않았는지 확인한다.

### 커밋

```text
Task #78 Stage 3: 런타임별 문서 핸들러 연결과 owner-only 차단
```

## Stage 4 — 공개 카드 통일과 소유자 안내

### 산출물

수정:

- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/messages.js`
- `src/styles.css`
- `src/profile-ui/__tests__/`

### 변경 내용

- raw `<img className="public-profile-card">`를 `MarketingCardPreview`로 교체한다. 600px 상한, hover-tilt, BorderBeam, 스켈레톤, glare가 함께 적용된다.
- 더 이상 쓰이지 않는 `.public-profile-card` 규칙을 정리한다. 새 카드 CSS는 만들지 않는다.
- unavailable 분기에서, 인증된 세션의 handle과 경로 handle이 일치할 때만 "아직 비공개" 안내와 `카드 공개하기` CTA를 노출한다.
- CTA는 `client.updateProfileVisibility("public")`를 호출하고 성공 시 공개 프로필을 재조회한다. 자동 전환은 하지 않는다.
- 소유자 판별은 클라이언트 세션 비교로만 수행한다. `/api/profiles/public/{handle}` 응답은 변경하지 않는다.
- ko/en 메시지를 추가한다.

### 검증

```bash
npm test
git diff --check
```

- 1440px 뷰포트에서 `/profile`과 `/u/{handle}` 카드 실측이 600x368로 일치하는지 확인한다.
- 비공개 handle과 미존재 handle의 `/api/profiles/public/{handle}` 응답을 status, body, 헤더까지 대조한다.
- 비로그인 방문자와 다른 계정 방문자에게 안내가 노출되지 않는지 확인한다.

### 커밋

```text
Task #78 Stage 4: 공개 카드 컴포넌트 통일과 비공개 소유자 안내
```

## Stage 5 — 모션 공용화와 인트로 모달

### Stage 5.1 산출물

신규:

- `src/profile-ui/useCardHandoffMotion.js`
- `src/profile-ui/__tests__/useCardHandoffMotion.test.js`

수정:

- `src/profile-ui/ShareStudio.jsx`

### Stage 5.1 변경 내용

- `buildRectTransform`, `resolveSourceRect`, 열기·닫기·handoff 시퀀스를 공용 훅으로 추출한다.
- `ShareStudio`는 훅을 사용하도록 바꾸고 동작은 그대로 유지한다. 이 하위 단계에서는 새 기능을 넣지 않는다.

### Stage 5.2 산출물

신규:

- `src/profile-ui/PublicCardIntro.jsx`
- `src/profile-ui/__tests__/PublicCardIntro.test.js`

수정:

- `src/profile-ui/PublicProfilePage.jsx`
- `src/styles.css`
- `src/profile-ui/messages.js`

### Stage 5.2 변경 내용

- `PublicProfilePage` 진입 시 배경 블러 모달로 카드를 노출한다. 매 진입마다 표시하며 로그인 상태로 자기 링크를 열 때도 동일하다.
- 등장은 360도 회전으로 정의한다. `hover-tilt`가 자체 transform을 쓰므로 회전은 바깥 래퍼에 `perspective`와 함께 적용한다.
- 닫으면 하단 `공유된 Codex 카드` 위치로 인계한다. 목적지가 뷰포트 밖이면 먼저 스크롤로 이동시킨 뒤 인계하거나 목적지 rect를 스크롤 보정한다.
- 모달 안에 카드 생성 CTA를 배치한다.
- `prefers-reduced-motion`이면 회전을 생략한다.

### 검증

```bash
npm test
npm run test:e2e
git diff --check
```

- Stage 5.1 완료 시 홈과 `/profile`의 Share Studio 열기·닫기·handoff 회귀가 없는지 먼저 확인한다.
- Stage 5.2는 모달 열기, 닫기 인계, 스크롤 보정, reduced-motion 분기를 확인한다.

### 커밋

```text
Task #78 [Stage 5.1]: Share Studio 인계 모션 공용 훅 추출
Task #78 [Stage 5.2]: 공개 프로필 카드 인트로 모달
```

## Stage 6 — Share Studio 재구성과 통합 검증

### 산출물

수정:

- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/shareStudio.js`
- `src/profile-ui/cardShare.js`
- `src/profile-ui/messages.js`
- `docs/readme-card.md`
- 각 영역 `__tests__`

### 변경 내용

- 보조 액션을 1차 `공유 링크 복사`(HTML 주소), 2차 `README Markdown`, 3차 `이미지 원본 주소` 순으로 재배치한다.
- `buildShareTargets`가 X, LinkedIn, Reddit intent에 공유 링크를 전달하게 한다.
- ko/en 메시지를 갱신한다.
- `docs/readme-card.md`의 공유 흐름 절을 갱신한다. 기존 내용을 먼저 읽고 바뀐 부분만 수정한다.

### 검증

```bash
npm test
npm run test:e2e
git status --short
git diff --check
```

- Issue #78 수용 기준 10개 항목을 재확인한다.
- 배포 후 X, Threads, 카카오톡에서 실제 공유를 확인하고 카카오 OG 캐시 초기화 도구를 실행한다.

### 커밋

```text
Task #78 Stage 6: Share Studio 액션 재구성과 공유 문서 갱신
```

## Stage 7 — PR 리뷰 보정

PR #80 리뷰에서 확인한 정합성·캐시·조회 비용 4건을 보정한다. 작업지시자가 같은 스레드에서 리뷰 코멘트를 먼저 등록한 뒤 보정과 보정 코멘트까지 진행하도록 승인했다.

### 산출물

- `src/profile-card/service-core.js`, `src/profile-media/publication-service.js` — 카드 설정 CAS 성공 이후에만 stable social 이미지를 조건부 commit
- `src/profile-media/media-store-contract.js`, `r2-binding/store.js`, `s3/store.js` — social storage ETag와 조건부 read/write 계약
- `src/profile-backend/http.js` — `If-None-Match`를 media store로 전달하고 304 본문 검증 생략
- `src/profile-runtime/open-graph.js`, `public-profile-resolver.js` — owner·usage 복합 밀리초 이미지 리비전
- memory/file/D1/Postgres structured store — `getPublicProfileSummaryByHandle` projection, contract v3
- `docs/production-hosting.md` — contract v3와 공개 프로필 단일 JOIN 조회 계약 현행화
- 관련 단위·통합 테스트와 `mydocs/working/task_m100_78_stage7.md`

### 변경 내용

1. social bytes는 설정 저장 전에 렌더링하되 stable object를 쓰지 않는다. owner 설정 CAS에 성공한 요청만 준비 시점의 storage ETag를 조건으로 commit한다. 경합 중 storage ETag가 바뀌면 owner와 usage revision을 다시 확인하고 현재 요청이 여전히 최신일 때만 bounded retry한다.
2. `og:image?v=`는 owner `updatedAt`과 usage `uploadedAt` 중 최신 시각의 밀리초 epoch를 사용한다. 같은 초 안의 연속 설정 저장도 URL이 달라진다.
3. social conditional GET은 HEAD/metadata로 application ETag를 먼저 비교하고, 일치하면 R2/S3 body를 읽지 않은 채 304를 반환한다.
4. 공개 문서 resolver는 provider-neutral projection 메서드 하나만 호출한다. D1과 Postgres는 owner/latest usage를 한 JOIN statement로 읽는다.

### 검증

```bash
npm test
npm run test:e2e
npm run build
git diff --check
```

- DB CAS 강제 실패 뒤 social ETag/body와 owner 설정이 모두 이전 값인지 확인
- 동시에 같은 설정을 저장한 두 요청 중 승자 한 요청만 social PUT을 수행하는지 확인
- R2/S3 조건부 hit가 HEAD 한 번으로 끝나고 GET을 호출하지 않는지 확인
- D1/Postgres projection이 JOIN statement 한 번만 실행하는지 확인

### 커밋

```text
Task #78 Stage 7: PR 리뷰 정합성·캐시·조회 비용 보정
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 갱신하고 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_78_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #78 Stage {N}: {요약}`, 하위 단계는 `Task #78 [Stage {N.M}]: {요약}` 형식을 따른다.

## 단계 의존성

- Stage 2는 Stage 1의 `v` 토큰 형식과 이미지 URL 형태 확정 후 진행한다.
- Stage 3은 Stage 1의 문서 핸들러와 Stage 2의 `social.png` 경로가 모두 있어야 실제 응답을 검증할 수 있다.
- Stage 5.2는 Stage 4의 `MarketingCardPreview` 교체와 Stage 5.1의 훅 추출이 끝난 뒤 진행한다.
- Stage 6의 실플랫폼 확인은 배포 이후에만 가능하므로, 배포 전에는 크롤러 UA 응답 확인까지만 수행한다.
- Stage 7은 PR 리뷰 코멘트 등록 뒤 진행하며, 보정 커밋 push와 새 CI 통과 후 보정 코멘트를 등록한다.

## 위험과 대응

- **Share Studio 회귀**: Stage 5.1을 기능 변경 없는 추출로 한정하고, 홈과 `/profile` 동작 확인을 통과한 뒤에만 5.2로 넘어간다.
- **세 런타임 불일치**: 태그 생성과 주입을 공통 모듈에 두고 런타임별로는 `loadIndexHtml`만 다르게 주입한다. Stage 3에서 세 응답을 대조한다.
- **라우팅 경계 훼손**: `isProfileBackendRoutePath`는 `looksLikeStaticAsset`과 공유되므로 수정하지 않는다. Stage 1과 Stage 3 검증에 해당 파일 무변경 확인을 포함한다.
- **D1 hot path**: OG HTML은 공개 카드 PNG와 달리 D1을 탄다. `getPublicProfileSummaryByHandle` projection이 owner/latest usage를 한 JOIN statement로 읽고 짧은 edge 캐시를 둔다.
- **owner-only 노출**: 공개를 닫은 상태에서 OG 썸네일이 노출되지 않도록 Stage 3에서 차단 목록을 확장하고 모드별 응답을 검증한다.
- **소셜 이미지 갱신 누락**: 설정 저장은 social 준비 → owner CAS → storage ETag 조건부 commit 순서로 고정한다. 실패·패배 요청은 stable social object를 쓰지 않는다.
- **미디어 키 하위 호환**: 기존 `card` format 키를 먼저 고정한 뒤 `social` format을 추가한다. cleanup 판정에서 기존 객체가 orphan으로 오인되지 않는지 dry-run으로 확인한다.
- **handle 열거 오라클**: Stage 4 검증에 비공개와 미존재 응답 동일성 대조를 포함한다.
- **플랫폼 캐시**: Stage 6 실측은 신규 공유 또는 캐시 초기화 이후에 수행한다.

## 승인 요청 사항

- 6단계 분할과 Stage 5의 하위 단계 구성
- 각 Stage의 산출물 경로와 신규 모듈 이름
- 각 Stage의 검증 명령
- 커밋 메시지 형식과 문구
- Stage 6의 실플랫폼 확인을 배포 이후로 미루는 검증 순서
