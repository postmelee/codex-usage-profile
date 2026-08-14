# Task #100 구현계획서 — README 카드 고정 URL의 대표 설정 자동 반영

- 수행계획서: [`task_m100_100.md`](task_m100_100.md)
- GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
- 마일스톤: M100 — v1.0 MVP
- 상태: PR #105 Stage 7 구현·전체 검증 완료, push 준비

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | canonical selection 계약과 memory store | additive v4 publication, selector resolver, contract 회귀 | media contract·publication unit |
| 2 | R2·S3 publication authority 정합화 | canonical metadata, adapter read/write/restore·maintenance | R2/S3 failure·concurrency·maintenance |
| 3 | 설정 publication commit과 public endpoint 전환 | owner CAS 이후 publish, exact retry, queryless canonical 응답 | service·backend·runtime·API contract |
| 4 | Share Studio 고정 README URL 전환 | canonical copy와 explicit preview/download 분리 | UI unit·settings E2E |
| 5 | 통합 검증과 문서·#84 handoff | 공개 문서, 전체 build/smoke, 비배포 handoff | unit/E2E/build/verify/smoke |
| 6 | README 임베드 크기·클릭 대상 보정 | 50% HTML image, 공유 페이지 anchor, 재배포 smoke | unit/E2E/build/GitHub render/production smoke |
| 7 | PR #105 오류 경계·authority 정합성 보정 | generic 503, authority-only read, publication/social 수렴, UI degrade, repair pair | targeted failure·concurrency·adapter·UI·maintenance + full regression |

## 구현 불변식

### URL 선택 모드

- `/cards/v2/public/{handle}/card.png`처럼 `theme`, `locale` selector가 모두 없는 요청은 publication
  authority의 `canonicalTheme`, `canonicalLocale`을 따라 대표 이미지를 반환한다.
- `theme` 또는 `locale`이 하나라도 있으면 기존 explicit variant 요청이다. 누락된 축은 각각
  `dark`, `en`으로 보완한다.
- `?v=...`처럼 selector가 아닌 query만 있는 요청은 canonical 요청이다.
- 지원하지 않는 theme은 기존처럼 404, 지원하지 않는 locale은 기존처럼 `en` fallback을 유지한다.
  이 task에서 explicit URL의 공개 계약을 확대하거나 축소하지 않는다.
- 외부 canonical URL은 계속 queryless stable path 하나다. 내부 dark/en authority object와 실제로
  선택된 immutable revision은 storage 구현 세부사항이며 외부 URL로 노출하지 않는다.

### Publication contract

- media store contract version은 `v4`를 유지하고 publication에 `canonicalTheme`,
  `canonicalLocale`을 additive field로 추가한다. stable key, immutable revision key, object 수와
  cleanup prefix는 변경하지 않는다.
- R2/S3 object metadata에는 `canonical-theme`, `canonical-locale`을 추가한다.
- 두 canonical field가 모두 없는 기존 v3/v4 authority는 `dark/en`으로 읽어 현재 배포 bytes를
  보존한다. 둘 중 하나만 없거나 값이 지원 범위를 벗어나면 authority를 신뢰하지 않고 fail-close한다.
- clone, snapshot, rollback, `samePublicationAuthority`, maintenance sanitize/digest가 canonical pair를
  함께 운반하고 비교한다. unknown metadata를 무시하던 기존 reader와의 하위 호환을 유지한다.
- `inspectStableCard()`가 가리키는 내부 authority record는 계속 dark/en stable object일 수 있지만,
  그 publication이 canonical selection을 소유한다. canonical GET 결과의 공개 stable key는 queryless
  authority path로 유지한다.

### 설정 저장 transaction과 수렴

- public owner 설정 저장의 prepare 단계는 네 immutable revision과 publication/social payload만
  준비한다. owner D1 CAS 전에 stable authority 또는 social authority를 바꾸지 않는다.
- owner CAS 성공 뒤 committed owner `updatedAt`과 committed usage `uploadedAt`을 다시 확인한 후
  canonical pair가 포함된 stable authority를 compare-and-set으로 publish하고 같은 publication id의
  social authority를 publish한다.
- commit 시점에 더 최신 owner/usage가 있으면 준비 결과는 superseded로 취급한다. 동일 desired state가
  이미 publish됐으면 성공으로 수렴하며, 그 외 media failure는 API에서 unavailable로 처리한다.
- public 설정 PATCH는 theme·locale 값이 기존과 같아도 media ensure를 실행한다. 이전 요청이 DB CAS
  이후 media commit에서 실패한 간극을 exact retry 한 번으로 복구하기 위함이다. private owner는
  공개 media를 만들지 않는다.
- 최초 publish와 usage refresh의 기존 즉시 publish 흐름은 유지하되 항상 저장된 owner 설정으로
  canonical pair를 기록한다. unpublish는 기존 authority/social 제거와 fail-close 규칙을 유지한다.
- authority가 새 publication인데 social이 이전 publication이거나 누락되면 기존 social read 경로가
  publication id 불일치로 fail-close한다. social 실패 때문에 새 canonical card를 이전 설정으로
  되돌리지 않는다.

### API와 Share Studio 책임

- `publicCardUrl`은 queryless canonical URL의 진실 원천이다.
- `selectedPublicCardUrl`은 기존 consumer 호환과 preview/download를 위해 설정이 드러난 explicit
  variant URL 의미를 유지한다. `publicCardUrls`, `publicCardVariantUrls`도 변경하지 않는다.
- Share Studio는 canonical URL과 selected explicit URL을 별도 prop으로 받는다. README Markdown과
  이미지 URL 텍스트 복사는 canonical URL, 화면 preview·Save PNG·PNG clipboard bytes는 selected
  explicit URL을 쓴다.
- Home/CardProfile owner surface만 두 URL을 명시적으로 전달한다. Public Profile의 표시 이미지는
  기존 selected representation을 유지한다.
- CLI/API client는 `publicCardUrl`을 소비하는 현재 계약을 보강하되 새 CLI option이나 output field는
  만들지 않는다.
- README 복사 문자열은 GitHub Markdown이 허용하는 `<a><img></a>` HTML을 사용한다. `img`의 기본
  `width`는 `50%`, `src`는 query 없는 `publicCardUrl`, `a`의 `href`는 `/api/share/{handle}`이다.
  API와 CLI의 기존 `readmeMarkdown` field shape는 유지하고 같은 문자열 생성 계약을 공유한다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_100*.md` | OK | 내부 승인 경계와 Stage 1~7 범위 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_100_stage{N}.md` | OK | 단계별 증거와 함께 커밋 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_100_report.md` | OK | 전체 검증·handoff 기록 |
| 프로젝트 소개 | 저장소 루트 | `README.md` | OK | 복사 예시를 queryless canonical URL로 통일 |
| README 카드 사용자 계약 | `docs/` | `docs/readme-card.md` | OK | canonical·explicit 의미와 갱신 동작 |
| production hosting 계약 | `docs/` | `docs/production-hosting.md` | OK | authority metadata와 migration/fallback |
| Sites 운영 계약 | `docs/` | `docs/sites-operations.md` | OK | 배포 전후 검증·rollback·cleanup |

## Stage 1 — canonical selection 계약과 memory store

### 산출물

신규:

- `mydocs/working/task_m100_100_stage1.md`

수정:

- `src/profile-media/media-store-contract.js`
- 필요 시 `src/profile-media/index.js`
- `src/profile-media/__tests__/media-store-contract.test.js`
- `src/profile-media/__tests__/publication-service.test.js`
- `src/profile-media/__tests__/_r2-fixtures.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- canonical pair의 지원 값과 기본값을 media contract 한곳에서 정의한다. publication 생성·복제·검증
  모두 같은 normalizer를 쓰고, partial/invalid pair는 저장·조회 모두 거절한다.
- raw query selector presence와 normalized value를 분리하는 resolver를 추가한다. selector가 전혀 없으면
  publication canonical pair, 하나라도 있으면 누락 축의 dark/en 기본값으로 explicit variant를 고른다.
- memory store publication에 canonical pair를 저장하고 queryless `getPublishedCard()`가 해당 immutable
  revision bytes를 반환하도록 한다. explicit selector 경로의 기존 결과는 바꾸지 않는다.
- legacy v3/v4 fixture는 canonical pair가 모두 없으면 dark/en으로 읽고, partial pair fixture는
  fail-close하는 회귀를 둔다.
- stable authority의 storage record와 외부 canonical response key를 혼동하지 않도록 contract assertion을
  추가한다. 기존 key 계산과 immutable revision 수는 그대로인지 검증한다.
- adapter 소스와 서비스 소스는 이 Stage에서 바꾸지 않는다.

### 검증

```bash
node --test src/profile-media/__tests__/media-store-contract.test.js src/profile-media/__tests__/publication-service.test.js
git diff --check
```

### 커밋

```text
Task #100 Stage 1: canonical card selection 계약과 memory store 구현
```

## Stage 2 — R2·S3 publication authority 정합화

### 산출물

신규:

- `mydocs/working/task_m100_100_stage2.md`

수정:

- `src/profile-media/r2-binding/store.js`
- `src/profile-media/s3/store.js`
- `src/profile-media/r2-binding/maintenance.js`
- `src/profile-media/__tests__/r2-binding-store.test.js`
- `src/profile-media/__tests__/r2-binding-failure.test.js`
- `src/profile-media/__tests__/r2-publication-concurrency.test.js`
- `src/profile-media/__tests__/r2-binding-maintenance.test.js`
- `src/profile-media/__tests__/s3-store.test.js`
- `src/profile-media/__tests__/s3-failure.test.js`
- 필요 시 `scripts/cleanup-orphan-card-media.mjs`와 관련 테스트
- `mydocs/orders/20260813.md`

### 변경 내용

- R2/S3 authority writer가 canonical pair metadata를 함께 저장하고 reader가 stable authority를 먼저 읽은
  뒤 selector mode를 판정하도록 순서를 바꾼다. 요청 입구에서 selector를 dark/en으로 미리 normalize하지
  않는다.
- canonical GET은 publication pair가 가리키는 revision을 읽고 authority publication id·content type·
  checksum과 revision metadata를 검증한다. 명시 selector GET은 기존 revision 선택과 locale fallback을
  그대로 사용한다.
- `samePublicationAuthority`, snapshot/restore, retry·rollback payload에 canonical pair를 포함한다.
  같은 revision set이라도 pair가 다르면 authority 변경으로 판정한다.
- maintenance sanitize/digest가 additive metadata를 보존하고 legacy absence를 dark/en으로 정규화한다.
  partial/invalid metadata는 복구 대상으로 오인하지 않고 fail-close한다.
- cleanup은 새 key/object를 만들지 않았으므로 sweep 범위를 바꾸지 않는다. fixture와 dry-run assertion으로
  canonical metadata가 orphan 판정 또는 삭제 개수에 영향을 주지 않는지만 확인한다.
- memory/R2/S3에서 canonical·explicit·legacy·invalid behavior matrix가 같음을 adapter 공통 fixture로
  검증한다.

### 검증

```bash
node --test src/profile-media/__tests__/r2-binding-store.test.js src/profile-media/__tests__/r2-binding-failure.test.js src/profile-media/__tests__/r2-publication-concurrency.test.js src/profile-media/__tests__/r2-binding-maintenance.test.js
node --test src/profile-media/__tests__/s3-store.test.js src/profile-media/__tests__/s3-failure.test.js
npm run cleanup:card-media -- --help
git diff --check
```

### 커밋

```text
Task #100 Stage 2: R2 S3 canonical publication metadata 정합화
```

## Stage 3 — 설정 publication commit과 public endpoint 전환

### 산출물

신규:

- `mydocs/working/task_m100_100_stage3.md`

수정:

- `src/profile-media/publication-service.js`
- `src/profile-card/service-core.js`
- `src/profile-card/__tests__/service.test.js`
- `src/profile-media/__tests__/publication-service.test.js`
- `src/profile-media/__tests__/publication-concurrency.test.js`
- `src/profile-media/__tests__/social-card-publication.test.js`
- `src/profile-backend/http.js`
- `src/profile-backend/__tests__/http.test.js`
- 필요 시 `src/profile-runtime/__tests__/dev-server.test.js`
- `src/profile-api/__tests__/client.test.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- 설정 저장용 publication prepare와 commit을 분리한다. prepare는 immutable revision과 render 결과만
  만들고, stable/social authority write는 owner CAS 성공 이후에만 수행한다.
- commit은 저장소에서 committed owner와 usage version을 다시 읽어 준비 snapshot과 비교한다. 동일
  snapshot만 compare-and-set publish하고, 최신 상태가 앞섰으면 superseded, 동일 desired publication은
  idempotent success로 분류한다.
- exact same public settings PATCH에서도 ensure path를 실행해 DB 성공/media 실패 간극을 복구한다.
  owner CAS가 no-op이더라도 committed owner/usage를 기준으로 새 authority가 필요한지 판단한다.
- first publish와 usage refresh가 owner의 현재 card theme·locale을 canonical pair로 전달하는지, settings
  commit과 usage refresh가 경합해도 최신 owner/usage 조합만 남는지 concurrency 테스트로 고정한다.
- public card HTTP route는 raw query에서 `theme`, `locale`의 존재 여부를 보존해 store로 전달한다.
  selector 둘 다 없으면 canonical, 하나라도 있으면 explicit이며 `v` 같은 다른 query는 영향을 주지 않는다.
- profile response의 `publicCardUrl`은 queryless, `selectedPublicCardUrl`은 explicit이라는 기존 shape를
  assertion으로 고정한다. `publicCardUrls`, `publicCardVariantUrls`도 regression을 둔다.
- public/private 전환, unpublish, renderer failure, owner CAS conflict, post-CAS media failure와 exact retry를
  서비스와 HTTP 양쪽에서 검증한다.

### 검증

```bash
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-media/__tests__/publication-service.test.js src/profile-media/__tests__/publication-concurrency.test.js src/profile-media/__tests__/social-card-publication.test.js
node --test src/profile-backend/__tests__/http.test.js src/profile-runtime/__tests__/dev-server.test.js src/profile-api/__tests__/client.test.js
git diff --check
```

`dev-server.test.js`를 수정하지 않으면 해당 파일은 명령에 유지해 runtime query 전달 회귀만 재검증하고
Stage 3 보고서에 무변경 근거를 기록한다.

### 커밋

```text
Task #100 Stage 3: settings publication과 public card endpoint 전환
```

## Stage 4 — Share Studio 고정 README URL 전환

### 산출물

신규:

- `mydocs/working/task_m100_100_stage4.md`

수정:

- `src/profile-ui/cardShare.js`
- `src/profile-ui/shareStudio.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/__tests__/cardShare.test.js`
- `src/profile-ui/__tests__/shareStudio.test.js`
- `src/profile-ui/__tests__/cardStyleSettings.test.js`
- `src/profile-api/__tests__/client.test.js`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260813.md`

### 변경 내용

- share helper가 canonical URL에서 theme·locale query를 합성하거나 보존하지 않도록 한다. 안전한 absolute
  `publicCardUrl`을 그대로 Markdown image source와 이미지 URL copy text에 사용한다.
- Share Studio prop을 canonical copy URL과 selected asset URL로 분리한다. preview `<img>`, download fetch,
  PNG clipboard fetch는 selected asset, README/image URL 텍스트는 canonical URL을 사용한다.
- CardProfile/Home가 profile response의 두 URL을 각각 전달한다. 설정 form에서 theme·locale을 바꿔도
  preview/download는 즉시 explicit selection을 따라가고 copy 결과는 동일한 queryless URL인지 검증한다.
- canonical URL이 없거나 unsafe protocol이면 기존 disabled/error behavior를 유지한다. fallback 과정에서
  selected URL을 README 링크로 승격하지 않는다.
- locale별 Markdown alt text와 UI message는 유지하고 URL만 고정한다. `?theme=`, `?locale=` 및 stale
  selector가 README/image URL copy에 없는지 unit/E2E assertion을 둔다.
- 공개 profile 표시 surface는 이 Stage에서 canonical image로 바꾸지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/cardShare.test.js src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/cardStyleSettings.test.js src/profile-api/__tests__/client.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|card appearance" --workers=1
git diff --check
```

### 커밋

```text
Task #100 Stage 4: Share Studio 고정 README URL 전환
```

## Stage 5 — 통합 검증과 문서·#84 handoff

### 산출물

신규:

- `mydocs/working/task_m100_100_stage5.md`

수정:

- `README.md`
- `docs/readme-card.md`
- `docs/production-hosting.md`
- `docs/sites-operations.md`
- 검증 중 재현된 Task #100 범위의 최소 보정 파일
- `mydocs/orders/20260813.md`

### 변경 내용

- README와 사용자 문서의 Markdown 예시를 queryless `publicCardUrl` 하나로 통일한다. 설정·사용량 변경
  후 같은 URL의 응답 bytes가 갱신되고 explicit variant query는 호환 경로로 남는다고 설명한다.
- 운영 문서에 additive v4 metadata, legacy dark/en fallback, partial/invalid fail-close, D1-free public read,
  settings commit 순서와 exact retry 수렴 절차를 기록한다.
- 배포 전후 확인은 queryless URL의 content type·cache/ETag·선택 이미지, explicit URL 하위 호환,
  social publication id 정합성, cleanup dry-run을 포함한다. rollback 시 이전 v4 reader가 additive metadata를
  무시하고 dark/en authority bytes를 읽을 수 있음을 명시한다.
- 전체 Node/Playwright, production Sites build, artifact verifier, local full-stack smoke를 실행한다.
- 실제 배포는 수행하지 않는다. Task #84 worktree도 수정하지 않고, #100 merge 후 #84가 최신 devel을
  반영해 queryless canonical URL로 Gate C를 다시 확인할 handoff를 Stage 보고서에 남긴다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
npm run cleanup:card-media -- --help
git diff --check
git status --short
```

### 커밋

```text
Task #100 Stage 5: canonical README card 통합 검증과 문서 handoff
```

## Stage 6 — README 임베드 크기·클릭 대상 보정

### 산출물

신규:

- `src/profile-card/readme-embed.js`
- `src/profile-card/__tests__/readme-embed.test.js`
- `mydocs/working/task_m100_100_stage6.md`

수정:

- `src/profile-ui/cardShare.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/__tests__/cardShare.test.js`
- `src/profile-ui/__tests__/cardStyleSettings.test.js`
- `src/profile-backend/http.js`
- `src/profile-backend/__tests__/http.test.js`
- `packages/codex-usage-profile-cli/test/output.test.js`
- `packages/codex-usage-profile-cli/test/cli.test.js`
- `packages/codex-usage-profile-cli/README.md`
- `tests/profile-ui.spec.js`
- `README.md`
- `docs/readme-card.md`
- `docs/cli-submit.md`
- `mydocs/orders/20260813.md`

### 변경 내용

- README 임베드 문자열 생성기를 UI와 backend가 함께 쓰는 browser-safe module로 분리한다. 두 URL은
  credential 없는 absolute HTTP(S)만 허용하고 HTML attribute를 escape하며, 유효하지 않으면 fail-close한다.
- 기본 복사 결과는 `<a href="공유 URL"><img width="50%" src="고정 카드 URL" alt="Codex usage profile" /></a>`
  형식으로 고정한다. 사용자는 복사한 `width` 값만 바꿔 크기를 조절할 수 있고 `src`에는 selector나
  cache-buster query를 추가하지 않는다.
- Share Studio는 기존 `publicProfileUrl`과 `copyImageUrl`을 함께 생성기에 전달한다. 카드 클릭은
  `/api/share/{handle}`로 이동하고 preview/download/PNG clipboard는 Stage 4의 explicit asset 동작을 유지한다.
- account usage API와 CLI가 반환·출력하는 기존 `readmeMarkdown`도 같은 생성기를 사용한다. `profileUrl`과
  `imageUrl` field 의미 및 response shape는 변경하지 않는다.
- GitHub Markdown render API로 anchor `href`, image `width`, canonical source 보존을 확인한다. GitHub가
  image `src`를 Camo로 변환하는 것은 정상이며 바깥 anchor는 서비스 공유 URL로 남아야 한다.
- 사용자 문서는 새 기본 복사 형식, `width` 조절 방법, queryless image URL과 Camo 갱신 특성을 설명한다.
- 전체 검증 후 승인된 기존 Sites project에 재배포하고 Share Studio clipboard, 공유 페이지, stable PNG와
  GitHub renderer를 production URL로 smoke 검증한다.

### 검증

```bash
node --test src/profile-card/__tests__/readme-embed.test.js src/profile-ui/__tests__/cardShare.test.js src/profile-ui/__tests__/cardStyleSettings.test.js src/profile-backend/__tests__/http.test.js packages/codex-usage-profile-cli/test/output.test.js packages/codex-usage-profile-cli/test/cli.test.js
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

### 커밋

```text
Task #100 Stage 6: README 임베드 크기와 공유 링크 보정
```

## Stage 7 — PR #105 오류 경계·authority 정합성 보정

### 산출물

신규:

- `mydocs/orders/20260815.md`
- `mydocs/working/task_m100_100_stage7.md`

수정:

- `mydocs/plans/task_m100_100_impl.md`
- `src/profile-media/publication-service.js`
- `src/profile-card/service-core.js`
- `src/profile-media/s3/store.js`
- `src/profile-backend/http.js`
- `src/profile-runtime/public-profile-resolver.js`
- `src/profile-runtime/sites/maintenance.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-media/__tests__/s3-store.test.js`
- `src/profile-media/__tests__/publication-service.test.js`
- `src/profile-media/__tests__/social-card-publication.test.js`
- `src/profile-runtime/__tests__/public-profile-resolver.test.js`
- `src/profile-runtime/sites/__tests__/maintenance.test.js`
- `src/profile-ui/__tests__/cardStyleSettings.test.js`
- 필요 시 review failure를 더 직접 고정하는 동일 영역 테스트·운영 문서

### 변경 내용

- `ensurePublishedCardVariants`의 prepare 단계에서 발생한 plain media store 오류를 기존 publication
  경로와 같은 generic `503 media_unavailable`, `Retry-After: 5`로 정규화하고 내부 storage 메시지를
  숨긴다. `PATCH /api/profile/card-settings`에 store failure를 주입하는 HTTP 회귀를 추가한다.
- S3 unpublish와 social coherence 확인은 canonical representation body가 아니라 dark stable
  publication authority의 owner/publication/storage ETag만 읽는다. canonical light object가 없거나
  drift여도 private 전환과 coherent social 제공은 authority 기준으로 진행한다.
- publication CAS가 성공한 뒤 owner/usage가 supersede해도 이미 commit된 publication id가 authority인
  동안 준비된 social object를 같은 publication id로 수렴시킨다. authority가 더 최신 publication으로
  바뀌었으면 이전 요청은 쓰지 않는다. publication/social 사이의 공개 read는 계속 mismatch 404로
  fail-close한다.
- media commit 반환값이 `superseded`이면 설정 API가 성공 200으로 숨기지 않고 generic
  `media_unavailable` 재시도 신호를 반환한다. publication commit 직후 usage/owner revision이 바뀌는
  경합에서 canonical/social pair가 일치하고 호출자가 실패를 관측하는 회귀를 둔다.
- Share Studio 전체 dialog의 렌더 조건에서 README snippet을 분리한다. 공유 URL 또는 snippet을 만들 수
  없어도 preview, Save image, Copy image URL, Copy image는 유지하고 README 행만 숨긴다.
- Sites repair service가 저장된 owner `cardLocale`과 `cardStyle.theme`을 v4 repair publication의
  `canonicalLocale`, `canonicalTheme`으로 전달한다. low-level v4 repair는 canonical pair 누락을
  거절해 운영 입력이 조용히 dark/en으로 바뀌지 않게 한다.
- queryless canonical light read는 light stable 불일치 시 dark로 degrade하지 않고 기존 404
  fail-close 계약을 유지한다. exact same settings ensure도 post-CAS media 실패 복구 경로이므로
  유지하며, 두 의도를 테스트·주석으로 명확히 한다.

### 검증

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

### 커밋

```text
Task #100 Stage 7: PR 리뷰 오류 경계와 publication 정합성 보정
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다. 실패한 검증은 완료로 처리하지 않는다.
- Stage 1·2는 memory/R2/S3 behavior matrix, Stage 3은 transaction/concurrency, Stage 4는 사용자 복사
  동작, Stage 5는 전체 artifact와 운영 계약, Stage 6은 README HTML 생성 계약과 production 복사 결과,
  Stage 7은 review failure·supersession·authority-only read와 repair pair를 각각 독립 Gate로 삼는다.
- failure/concurrency test는 owner CAS 이전 authority 미변경, 최신 owner/usage supersession, exact retry
  수렴, social mismatch fail-close를 반드시 포함한다.
- 계획된 파일 밖 변경 또는 공개 문서 위치 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자
  승인을 받는다.
- Stage 6에서 승인된 기존 Sites project 재배포와 읽기·복사 smoke만 수행한다. Stage 7은 production
  재배포·원격 storage mutation 없이 코드·local full-stack·artifact 회귀만 검증한다. 원격 storage
  migration과 cleanup 실행은 이 task 범위에 포함하지 않는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_100_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 각 Stage에 고정한 `Task #100 Stage {N}: ...` 형식을 따른다.
- 최종 보고서와 PR 게시 절차는 모든 Stage 승인·검증 완료 뒤 `task-final-report` skill로 진행한다.

## 단계 의존성

- Stage 2는 Stage 1의 additive v4 publication shape와 resolver 승인 후 진행한다.
- Stage 3은 Stage 2의 R2/S3 authority read/write/restore 정합성 승인 후 진행한다.
- Stage 4는 Stage 3의 API URL 의미와 queryless endpoint가 확정된 뒤 진행한다.
- Stage 5는 Stage 4의 copy/preview 분리 검증과 단계 보고서 승인 후 진행한다.
- Stage 6은 Stage 5 production Gate에서 확인한 stable URL·Camo 동작을 전제로 README 임베드 표현만
  보정하며, 기존 publication과 cache 계약은 변경하지 않는다.
- Stage 7은 PR #105 owner review의 1·2·3·5·6·7·9·11·12번을 일곱 동작 묶음으로 보정한다. 4번의
  canonical light fail-close와 8번의 exact settings repair는 승인된 불변식으로 유지하고, 10·13·14번은
  이번 Stage의 correctness 범위 밖 후속 정리로 남긴다.

## 위험과 대응

- **설정 CAS와 media authority의 이중 저장소 간극**: CAS 이전 authority write를 금지하고, CAS 이후
  committed owner/usage version 검증과 exact retry ensure로 수렴시킨다.
- **오래된 요청의 최신 설정 덮어쓰기**: authority CAS에 owner `updatedAt`, usage `uploadedAt`,
  publication id를 포함하고 superseded 결과를 실패와 구분한다.
- **legacy metadata 오판**: canonical pair가 모두 없을 때만 dark/en fallback을 허용하고 partial/invalid는
  fail-close fixture로 고정한다.
- **`selectedPublicCardUrl` consumer 파손**: 의미를 바꾸지 않고 Share Studio에 canonical prop을 추가해
  복사 책임만 분리한다.
- **cache 때문에 같은 URL 갱신이 늦어 보임**: 기존 publication cache/ETag 계약과 invalidate 동작을
  adapter·HTTP·운영 smoke에서 확인하고 새 query cache-buster를 공개 계약으로 만들지 않는다.
- **GitHub가 HTML image를 Camo로 치환함**: image `src` 치환은 허용하되 바깥 anchor `href`와 `width`가
  보존되는지를 GitHub renderer와 실제 README에서 확인한다.
- **social card와 canonical card 불일치**: 동일 publication id로 publish하고 reader mismatch fail-close와
  post-CAS failure retry를 검증한다.
- **publication commit 직후 supersession**: 이미 authority가 된 publication의 social을 같은 id로
  수렴시킨 뒤 호출자에는 재시도 가능한 generic 실패를 반환하고, 더 최신 authority는 덮지 않는다.
- **repair의 canonical pair 유실**: v4 repair 입력에 pair를 강제하고 저장된 owner 설정에서 두 값을
  구성하는 회귀로 dark/en silent reset을 막는다.
- **Task #84 진행 중 worktree 충돌**: `.worktrees/task84`를 수정하지 않고 #100 merge 뒤 재정렬할 검증
  항목만 handoff한다.

## 승인 요청 사항

- 일곱 Stage의 분할, 산출물 경로, 검증 명령과 커밋 메시지를 승인한다.
- `v4`를 유지하면서 `canonicalTheme`, `canonicalLocale`을 additive publication field로 추가하고,
  legacy pair 전체 부재만 dark/en으로 읽는 계약을 승인한다.
- `publicCardUrl`은 canonical queryless, `selectedPublicCardUrl`은 explicit selected variant로 유지하는
  API 의미를 승인한다.
- public 설정 저장을 immutable prepare → owner CAS → supersession-safe authority/social commit 순서로
  바꾸고 exact retry ensure를 수렴 경로로 사용하는 설계를 승인한다.
- Share Studio의 README·이미지 URL 텍스트 복사는 canonical URL, preview/download/PNG clipboard는
  explicit selected URL을 사용하는 동작 분리를 승인한다.
- README와 기존 docs 세 문서를 Stage 5에서 수정하고 실제 배포는 하지 않는 범위를 승인한다.
- Stage 6에서 README 복사 결과를 50% HTML image와 `/api/share/{handle}` anchor로 바꾸고 API/CLI를
  통일하며, 검증된 source를 기존 Sites project에 재배포해 production smoke하는 범위를 승인한다.
- Stage 7에서 PR #105 review의 일곱 correctness 묶음을 보정하고 전체 회귀 뒤 기존
  `publish/task100`에 push하며, 검증 결과와 의도적으로 유지한 4·8번 판단을 review comment로 게시하는
  범위를 승인한다.
