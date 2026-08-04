# Task M100 #74 구현계획서 — 카드 테마 커스터마이징과 공개 media 변형

수행계획서: [`task_m100_74.md`](task_m100_74.md)
GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | owner 카드 설정·migration·API 계약 | versioned `cardStyle`, preset registry, ordered D1/Postgres migration, settings mutation | registry/store/migration/HTTP/CSRF focused tests |
| 2 | media theme 축과 dual stable serving | media contract v4, theme-aware R2/S3 adapter | contract·GET/HEAD/304·failure/concurrency tests |
| 3 | publication·maintenance·cleanup 일관성 | 4 representation publish, authority commit, export/cleanup 보정 | compensation·maintenance·orphan exact-count tests |
| 4 | Profile light/dark 전환·미리보기·저장 | accessible card theme settings UI와 persisted draft/save flow | component/unit·Playwright save/reload/error tests |
| 5 | Share Studio·공개 URL 하위 호환 | selected theme URL/README와 public response | URL normalization·public/private E2E |
| 6 | 통합 검증·공식 문서·배포 준비 | product/Sites artifact, migration/ops 문서와 최종 보고 근거 | 전체 Node/E2E/build/verifier |

## 문서 위치 확인

수행계획서의 공식 문서·작업 산출물 위치 판단을 유지한다. 공개 URL과 R2 운영 계약이 실제로 바뀌는 Stage 6에서만 공식 문서를 수정하고, 단계별 판단과 검증은 `mydocs/`에 기록한다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| README 카드 사용법 | `docs/readme-card.md` | `docs/readme-card.md` | OK | Stage 6에서 theme query와 복사 URL 설명 |
| production media 계약 | `docs/production-hosting.md` | `docs/production-hosting.md` | OK | Stage 6에서 contract v4·authority·retention 반영 |
| Sites 운영 절차 | `docs/sites-operations.md` | `docs/sites-operations.md` | OK | Stage 6에서 migration·export/restore·rollback 반영 |
| 수행·구현계획서 | `mydocs/plans/` | `task_m100_74.md`, `task_m100_74_impl.md` | OK | 승인 범위와 실행 계약 |
| 단계 보고서 | `mydocs/working/` | `task_m100_74_stage1.md`~`stage6.md` | OK | 단계별 source·검증 근거 |
| 최종 보고서 | `mydocs/report/` | `task_m100_74_report.md` | OK | 전체 수용 기준과 잔여 위험 |

## 공통 구현 계약

### 카드 설정과 저장 모델

- 공개 입력은 versioned `cardStyle`만 허용한다. v1은 `{ schemaVersion: 1, theme: "light" | "dark", effect: { preset: "none", version: 1 } }`이며 owner 기본값은 dark/none이다. 사이트 전역 `system | light | dark` Appearance와 별도 상태로 관리한다.
- `src/profile-card/presentation.js`에 canonical schema, byte-size bound, preset registry, stable-key-order serialization과 `presentationDigest`를 둔다. UI, API, store, renderer와 media가 이 모듈의 normalized value만 사용하고 특정 third-party component prop은 저장하지 않는다.
- 초기 registry는 theme `light@1`, `dark@1`과 effect `none@1`만 활성화한다. registry entry는 `id`, `version`, allowed options/default, static renderer capability, optional preview adapter ID, optional animated frame/export capability를 선언한다. 알 수 없는 schema version, preset, version, option과 non-finite/범위 밖 값은 fail-closed다.
- future `beam.rotate@1`과 `beam.pulse@1`은 별도 registry entry로 추가하며, Border Beam의 `size`, `colorVariant`, `strength`, `duration`을 제품 소유의 bounded option으로 번역한다. package prop이나 CSS 문자열을 API/DB에 직접 저장하지 않는다.
- owner record에 `cardStyle`을 추가한다. 기존 memory/file store record와 신규 D1/Postgres row는 값이 없을 때 canonical dark/none으로 normalize해 구버전 export와 fixture를 읽을 수 있게 한다.
- D1 `0004_card_style.sql`, Postgres `0003_card_style.up/down.sql`을 ordered migration에 추가한다. D1은 bounded canonical JSON text, Postgres는 동등 JSONB를 additive default로 사용하며 이전 saved version이 새 column을 무시할 수 있는 rollback 구간을 검증한다.
- store contract에는 owner CAS 기반 `updateCardSettings` atomic operation을 추가한다. serialization key는 `owner.id`, 허용 변경은 normalized `cardStyle`, 결과는 갱신된 owner다.
- maintenance export/restore는 `cardStyle`과 `presentationDigest`를 포함한다. legacy backup의 누락값은 canonical dark/none으로 복원하고 알 수 없는 값은 fail-closed validation error다.

### owner API와 공개 response

- owner-only `PATCH /api/profile/card-settings`를 추가한다. body는 `{ "cardStyle": { ...versioned schema... } }`만 허용하며 unknown field, invalid schema/preset/option, oversized JSON, 비 JSON, anonymous, CSRF failure를 기존 error envelope로 거부한다.
- `GET /api/profile`과 settings mutation response는 기존 `publicCardUrl`을 query 없는 dark 호환 URL로 유지하면서 다음 additive field를 반환한다.
  - `cardStyle`: 저장된 canonical owner 카드 설정
  - `presentationDigest`: canonical 설정 digest
  - `selectedPublicCardUrl`: 저장값을 명시한 `?theme=light|dark` URL
  - `publicCardUrls`: `light`, `dark` 명시 URL map
- public profile JSON은 owner가 공개된 경우 같은 URL field를 제공할 수 있지만, 공개 media 재현에 필요한 allowlisted card style 외 private 설정은 노출하지 않는다.
- 공개 owner가 legacy dark-only publication 상태에서 light를 저장하면 settings service가 저장된 latest usage로 dual variant publication을 먼저 idempotent 보완한다. 성공 후에만 owner preference를 commit한다. 따라서 새 CLI submit 없이 선택 URL이 유효하고, media 보완 실패 시 preference와 Share URL은 바뀌지 않는다.
- private owner는 media write 없이 preference만 저장하며 다음 publish에서 네 representation을 만든다.

### renderer와 media contract v4

- `src/profile-card/theme.js`의 기존 palette와 native/Worker renderer를 재사용한다. dark baseline, logical/output dimension, avatar/heatmap/stat layout과 application ETag=digest 계약은 변경하지 않는다.
- theme은 media identity의 한 축이다. publication은 `light | dark` × `en | ko` 네 representation을 요구하고 각 PNG bytes digest를 독립 revision/ETag로 사용한다.
- 모든 representation metadata에는 `presentationDigest`와 `format: "png"`를 기록한다. media contract type은 `presentation × locale × format`을 표현할 수 있게 하지만 이번 task에서 materialize/serve하는 format은 PNG, effect preset은 none뿐이다.
- 기존 object 호환을 위해 dark key는 유지한다.
  - dark stable: `cards/v2/public/{handle}/card.png`
  - light stable: `cards/v2/public/{handle}/themes/light/card.png`
  - dark revision: 기존 `cards/v2/owners/{ownerId}/revisions/{locale}/{revision}.png`
  - light revision: `cards/v2/owners/{ownerId}/revisions/light/{locale}/{revision}.png`
- media contract version은 4로 올리고 metadata에는 `theme`, nested theme/locale pointer, publication id를 검증 가능한 형태로 기록한다. legacy v3 dark publication은 dark serving과 query 없는 URL에 한해 읽을 수 있게 한다.
- `theme` query 부재와 `theme=dark`는 dark, `theme=light`는 light다. 다른 값은 public route에서 일반 404/invalid request 기존 정책 중 HTTP contract test로 확정한 한 가지 결과만 사용한다. private preview의 기존 fallback은 별도 owner-only 계약으로 유지한다.

### future effect·animated export 확장 경계

- 브라우저 preview는 카드 내용 `<img>`와 장식 effect wrapper를 분리한다. future Beam adapter는 기존 `border-beam` dependency를 wrapper 내부에서만 사용하고 `pointer-events: none`, offscreen pause와 `prefers-reduced-motion` static fallback을 강제한다.
- static card renderer는 presentation registry의 theme/static fallback만 받는다. DOM/CSS animation 구현을 native/Worker PNG renderer에 직접 import하지 않는다.
- optional animated adapter contract는 normalized presentation, logical dimensions, duration/fps/frame-count bounds를 받아 timestamp별 RGBA/PNG frame을 결정적으로 생성하는 `sampleFrame(time)` capability로 둔다. encoder와 R2 publication은 이 frame contract에만 의존한다.
- future GIF/WebP 등 animated output은 save/publish 시 pre-generation하고 immutable digest object를 R2에 쓴 뒤 authority pointer commit 후에만 공개한다. public GET에서 생성하거나 external CSS/JS를 실행하지 않는다.
- animated asset 실패·초과 시간·초과 크기는 PNG stable object와 기존 saved style을 손상시키지 않는 별도 commit domain으로 둔다. exact limits, encoder 선택, Sites CPU 적합성과 format별 retention은 후속 task의 수행계획 승인 사항이다.
- future selected URL은 기존 `theme` query를 유지하면서 opaque `style={presentationDigest 또는 stable style id}`를 additive하게 도입할 수 있다. 이번 task는 response/metadata에 digest를 제공하되 `style` query와 animated URL은 노출하지 않는다.

### dual stable authority와 부분 실패

- 기존 dark stable object를 publication authority이자 최종 commit point로 사용한다. authority metadata는 publication id와 네 representation pointer를 모두 갖는다.
- publish 순서는 네 immutable revision put → light stable stage → dark authority CAS commit → structured visibility/preference commit이다.
- light GET은 dark authority를 먼저 검증하고, authority가 가리키는 publication id·revision과 light stable metadata/body가 모두 일치할 때만 응답한다. stage된 light 객체만 존재하거나 publication id가 다르면 404/503 fail-closed contract로 닫는다.
- dark GET은 legacy v3와 v4를 모두 지원하며 v4에서는 authority 자신을 반환한다. locale body conditional read와 concurrent HEAD→GET 재시도 제한은 기존 정책을 유지한다.
- unpublish는 dark authority를 CAS tombstone으로 바꿔 모든 theme route를 먼저 닫는다. light stable은 공개 authority가 없으므로 serving하지 않으며 retention/cleanup 대상이 된다.
- concurrent publish는 expected dark storage ETag를 최종 직렬화 기준으로 사용한다. loser의 staged light가 winner authority와 불일치하면 노출하지 않고, compensation/다음 refresh/cleanup이 수렴시킨다. 기존 공개 publication을 잘못 복구하지 않도록 publication id와 written storage ETag를 함께 비교한다.

### cleanup·maintenance·rollback

- stable scan은 dark authority를 먼저 읽고 참조된 light stable 및 네 immutable revision을 보호한다. authority 없는 light stable, 오래된 light/dark revision은 기존 retention window·최근 N개 정책 아래 candidate가 된다.
- cleanup apply는 각 삭제 직전 dark authority metadata를 다시 확인한다. publication id, digest, count가 계획과 다르면 삭제하지 않는다.
- Sites owner export/restore와 exact delete plan은 theme preference, dark authority, light stable과 네 representation count를 포함한다. legacy owner export는 dark-only로 허용하되 restore 후 light 선택을 완료 상태로 보고하지 않는다.
- 이전 saved version rollback 시 query 없는 dark serving은 계속 가능해야 한다. light route/settings API는 이전 버전에서 사라질 수 있으므로 migration은 additive하고 dark stable object를 그대로 보존한다.

### Profile 카드 설정 UX

- `Your Codex card` 영역의 실제 카드 preview 아래에 `Card appearance`/`카드 모양` 설정을 둔다. 이 설정은 Settings의 사이트 화면 모드가 아니라 공개 카드 기본 테마임을 설명한다.
- light/dark 두 옵션은 native radio group 또는 동등한 단일 선택 semantics를 사용한다. 각 옵션에 label과 짧은 설명을 제공하고 keyboard, visible focus, checked state를 지원한다.
- 선택 즉시 owner-only preview URL의 `theme` query를 바꿔 실제 renderer 결과를 보여준다. 서버 저장값과 draft를 분리해 저장 전에는 `Save card appearance` 버튼을 활성화하고, 변경 없음·요청 중에는 비활성화한다.
- 저장 성공 시 profile response, preview, Share Studio와 selected URL을 한 번에 갱신한다. 실패 시 draft는 사용자가 다시 시도할 수 있게 유지하되 저장값·공개 URL·visibility는 바꾸지 않고 locale별 오류를 표시한다.
- reload, 재로그인과 새 browser context에서 서버 저장값을 다시 읽는다. 사이트 Appearance 변경은 저장된 카드 선택을 덮어쓰지 않는다.
- 공개 여부와 카드 테마 저장은 독립 mutation이다. private owner도 테마를 저장할 수 있고, publish button/share availability의 기존 조건을 유지한다.

### Share·URL·locale 조합

- `buildLocalizedCardUrl`을 theme-aware helper로 확장하되 locale과 theme query를 각각 정규화한다. 선택 URL은 theme query를 항상 명시하고 영어 locale은 기존처럼 locale query를 생략한다.
- Share Studio의 PNG preview/download, URL 복사, README Markdown, X/LinkedIn/Reddit 흐름은 동일한 selected theme URL을 사용한다.
- 기존 `publicCardUrl` consumer와 query 없는 README는 dark를 계속 받는다. 사용자 저장값 때문에 기존 URL bytes가 암묵적으로 light로 바뀌지 않는다.
- private/unpublished owner의 query 없음, light, dark, locale 조합은 모두 동일하게 404다. provider/bucket 오류는 storage 상세 없이 generic 503과 `Retry-After`를 유지한다.

## Stage 1 — owner 카드 설정·migration·API 계약

### 산출물

신규:

- `db/migrations/0004_card_style.sql`
- `src/profile-backend/postgres/migrations/0003_card_style.up.sql`
- `src/profile-backend/postgres/migrations/0003_card_style.down.sql`
- `src/profile-card/presentation.js`
- `src/profile-card/__tests__/presentation.test.js`
- `mydocs/working/task_m100_74_stage1.md`

수정:

- `src/profile-backend/store-values.js`
- `src/profile-backend/store-contract.js`
- `src/profile-backend/atomic-operations.js`
- `src/profile-backend/store.js`
- `src/profile-backend/durable-store.js`
- `src/profile-backend/d1/{migration-manifest.js,store.js,maintenance.js}`
- `src/profile-backend/postgres/{migrate.js,store.js}`
- `src/profile-backend/http.js`
- `src/profile-api/client.js`
- 관련 backend/API tests와 fixture

### 변경 내용

- versioned owner `cardStyle`, preset registry/canonicalization/presentation digest, 기본 dark/none과 atomic `updateCardSettings`를 구현한다.
- D1/Postgres additive migration과 memory/file adapter parity를 구현한다.
- owner profile serialization, 테마별/선택 URL builder와 `PATCH /api/profile/card-settings`를 추가한다.
- 이 Stage의 public owner settings save는 media ensure hook을 호출할 seam까지만 정의하고, 실제 v4 publication은 Stage 3에서 연결한다. Stage 1 test fixture에서는 injected no-op/contract double로 경계를 고정한다.
- maintenance export/restore의 owner preference shape를 추가하되 media object count 변경은 Stage 3에서 완성한다.

### 검증

```bash
node --test \
  src/profile-card/__tests__/presentation.test.js \
  src/profile-backend/__tests__/store-contract.test.js \
  src/profile-backend/__tests__/store.test.js \
  src/profile-backend/__tests__/durable-store.test.js \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-backend/__tests__/d1-migrate.test.js \
  src/profile-backend/__tests__/d1-store.test.js \
  src/profile-backend/__tests__/postgres-migrate.test.js \
  src/profile-backend/__tests__/postgres-store.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-api/__tests__/client.test.js
git diff --check
```

### 커밋

```text
Task #74 Stage 1: owner 카드 설정과 migration API 계약
```

## Stage 2 — media theme 축과 dual stable serving

### 산출물

수정:

- `src/profile-media/media-store-contract.js`
- `src/profile-media/r2-binding/store.js`
- `src/profile-media/s3/store.js`
- `src/profile-media/index.js`
- `src/profile-backend/http.js`
- media contract/R2/S3/HTTP tests와 fixture

신규:

- `mydocs/working/task_m100_74_stage2.md`

### 변경 내용

- contract v4의 presentation/theme-aware revision/stable key, format capability, nested representation과 legacy v3 dark reader를 구현한다.
- memory, native R2와 S3-compatible adapter에 light stage, dark authority inspect/read, theme/locale selected body와 conditional GET을 구현한다.
- public GET/HEAD route가 `theme` query를 strict normalize하고 light 요청에서 authority/publication id를 검증하게 한다.
- native R2 fake와 S3 integration fixture에 metadata drift, missing light, stale publication id, HEAD→GET race를 추가한다.

### 검증

```bash
node --test \
  src/profile-media/__tests__/media-store-contract.test.js \
  src/profile-media/__tests__/r2-binding-store.test.js \
  src/profile-media/__tests__/r2-binding-failure.test.js \
  src/profile-media/__tests__/r2-publication-concurrency.test.js \
  src/profile-media/__tests__/s3-store.test.js \
  src/profile-media/__tests__/s3-failure.test.js \
  src/profile-backend/__tests__/http.test.js
git diff --check
```

### 커밋

```text
Task #74 Stage 2: public card media theme 변형과 authority serving
```

## Stage 3 — publication·maintenance·cleanup 일관성

### 산출물

수정:

- `src/profile-media/publication-service.js`
- `src/profile-media/maintenance-contract.js`
- `src/profile-media/r2-binding/maintenance.js`
- `src/profile-backend/d1/maintenance.js`
- `scripts/cleanup-orphan-card-media.mjs`
- `scripts/sites-profile-maintenance.mjs`
- publication/concurrency/maintenance/cleanup tests와 fixture

신규:

- `mydocs/working/task_m100_74_stage3.md`

### 변경 내용

- publish/refresh가 normalized cardStyle의 static fallback으로 네 PNG representation을 만들고 light stage 후 dark authority를 commit하게 한다.
- settings save의 `ensurePublishedCardVariants`를 연결해 legacy public owner가 submit 없이 v4 dual publication으로 수렴한 뒤 preference를 저장하게 한다.
- unpublish·structured visibility/preference failure compensation과 concurrent loser 수렴을 publication id/storage ETag matrix로 고정한다.
- maintenance export/restore/delete와 orphan cleanup을 theme-aware count/digest/recheck 계약으로 확장한다.
- default dry-run, apply 전 authority 재검증, mismatch fail-close와 tombstone/legacy dark 보호를 유지한다.

### 검증

```bash
node --test \
  src/profile-media/__tests__/publication-service.test.js \
  src/profile-media/__tests__/publication-concurrency.test.js \
  src/profile-media/__tests__/r2-publication-concurrency.test.js \
  src/profile-media/__tests__/r2-binding-maintenance.test.js \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  scripts/__tests__/cleanup-orphan-card-media.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js
git diff --check
```

### 커밋

```text
Task #74 Stage 3: card theme publication과 exact cleanup 일관성
```

## Stage 4 — Profile light/dark 전환·미리보기·저장

### 산출물

신규:

- 필요 시 `src/profile-ui/CardThemeSettings.jsx`
- `src/profile-ui/__tests__/cardStyleSettings.test.js`
- `mydocs/working/task_m100_74_stage4.md`

수정:

- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/AccountUsageProfile.jsx` 또는 owner card section composition
- `src/profile-ui/messages.js`
- `src/profile-ui/__tests__/i18n.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`

### 변경 내용

- `Your Codex card` preview 아래에 light/dark radio group과 저장 CTA를 추가한다. UI state는 전체 canonical `cardStyle` draft를 보유하고 이번 화면은 theme field만 변경하며 effect none을 보존한다.
- server saved theme, draft theme, mutation status와 error를 분리하고 draft 선택 즉시 private preview URL을 전환한다.
- 저장 성공 시 profile response와 preview를 갱신하고, 실패 시 저장값과 공개 URL을 보존한 채 재시도 가능한 draft/error를 유지한다.
- 한국어/영어 title, 설명, option, 저장/저장 중/성공·오류 문구와 catalog parity를 추가한다.
- keyboard, focus, checked, disabled/busy/live status와 mobile layout을 검증한다.
- reload, 재로그인에 해당하는 새 browser context, 사이트 Appearance 변경 후에도 서버 저장 카드 theme가 유지되는 시나리오를 추가한다.
- component boundary는 future effect preset selector/option panel을 같은 registry metadata에서 추가할 수 있게 `CardStyleSettings` composition으로 두고 Beam-specific prop/state를 page에 두지 않는다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/cardStyleSettings.test.js \
  src/profile-ui/__tests__/i18n.test.js \
  src/profile-api/__tests__/client.test.js
npx playwright test tests/profile-ui.spec.js --grep "card appearance|card theme|카드 모양"
git diff --check
```

### 커밋

```text
Task #74 Stage 4: Profile 카드 light dark 설정과 저장 UI
```

## Stage 5 — Share Studio·공개 URL 하위 호환

### 산출물

수정:

- `src/profile-ui/cardShare.js`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/shareStudio.js`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/PublicProfilePage.jsx`
- 관련 Share/public route tests
- `tests/profile-ui.spec.js`

신규:

- `mydocs/working/task_m100_74_stage5.md`

### 변경 내용

- URL helper가 locale과 theme query를 독립 normalize하고 selected theme를 명시하도록 한다.
- Share Studio preview/download, URL/README 복사와 social composer가 같은 selected URL을 사용하게 한다.
- query 없는 legacy dark URL, `?theme=dark`, `?theme=light`, locale 조합과 ETag 분리를 검증한다.
- private/unpublished/public, missing/malformed/legacy publication과 provider failure E2E를 보강한다.
- Profile의 저장 성공 직후 새 submit 없이 Share Studio가 바뀐 query URL을 제공하는 시나리오를 고정한다.

### 검증

```bash
node --test \
  src/profile-ui/__tests__/cardShare.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/publicProfileRoutes.test.js \
  src/profile-backend/__tests__/http.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|theme URL|README|public card"
git diff --check
```

### 커밋

```text
Task #74 Stage 5: selected card theme 공유 URL과 하위 호환
```

## Stage 6 — 통합 검증·공식 문서·배포 준비

### 산출물

수정:

- Stage 1~5 통합 회귀 발견 시 승인 범위 안의 source/test
- `docs/readme-card.md`
- `docs/production-hosting.md`
- `docs/sites-operations.md`
- Sites migration/artifact verifier와 필요한 manifest test
- `mydocs/orders/20260804.md`

신규:

- `mydocs/working/task_m100_74_stage6.md`
- 최종 단계 승인 후 `mydocs/report/task_m100_74_report.md`

### 변경 내용

- 전체 Node, Playwright, production/Sites build와 artifact verifier를 실행한다.
- clean D1 migration과 이전 schema upgrade, saved-version rollback 호환을 검증한다.
- 기존 dark-only public fixture를 v4로 보완하고 설정 저장·publish/unpublish·cleanup까지 end-to-end로 확인한다.
- 공식 문서에 theme query, query 없는 dark 호환, dual stable authority, retention/export/restore와 배포 순서를 반영한다.
- 실제 production migration/deploy와 공개 전환은 별도 승인 gate로 남기고 이 Stage에서는 deploy candidate와 rollback 절차까지만 확정한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

추가 확인:

- `TEST_DATABASE_URL` 또는 gated S3 endpoint가 없으면 해당 integration skip을 검증 한계에 명시한다.
- production artifact에 secret, credential, local path가 포함되지 않는지 verifier와 diff로 확인한다.
- migration 적용 전/후와 이전 saved version rollback에서 query 없는 dark card가 유지되는지 확인한다.

### 커밋

```text
Task #74 Stage 6: card theme 통합 검증과 공식 문서 정리
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- Stage 1~3은 schema/media consistency, Stage 4~5는 사용자 UX와 URL 계약, Stage 6은 전체 artifact와 운영 rollback을 각각 독립 승인 단위로 둔다.
- 실제 production D1 migration, Sites saved version 배포, environment/access 전환과 공개 smoke는 별도 Gate 승인 없이 실행하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_74_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 각 Stage의 지정 메시지를 사용한다.
- 구현계획 승인 전 제품 코드, migration과 공식 문서는 수정하지 않는다.

## 단계 의존성

- Stage 2는 Stage 1의 owner preference/API schema 승인 후 진행한다.
- Stage 3은 Stage 2 media contract v4와 dual stable read/write 검증 후 진행한다.
- Stage 4는 Stage 1 API와 Stage 3 public-owner ensure hook이 확정된 뒤 진행한다.
- Stage 5는 Stage 4 saved/draft state와 selected URL field가 확정된 뒤 진행한다.
- Stage 6은 Stage 1~5 보고서 승인 후 통합 검증·문서 단계로 진행한다.

## 위험과 대응

- **다중 R2 객체 원자성**: dark authority를 최종 commit point로 사용하고 light serving에서 publication id를 재검증한다.
- **legacy dark-only owner**: settings save와 이후 submit이 idempotent ensure를 수행하며, ensure 성공 전 preference/Share URL을 commit하지 않는다.
- **동시 settings/publish**: owner updatedAt CAS와 dark storage ETag/publication id를 각각 structured/media 직렬화 기준으로 사용하고 focused concurrency test를 둔다.
- **rollback 비대칭**: schema는 additive, query 없는 dark key는 그대로 유지해 이전 saved version이 핵심 공개 경로를 계속 읽게 한다.
- **cleanup 오삭제**: authority-first scan과 apply 직전 pointer 재검증, digest/count mismatch fail-close를 유지한다.
- **UI와 사이트 theme 혼동**: 카드 설정을 `Card appearance`로 별도 표기하고 site Appearance 변경과 무관한 서버 저장 상태로 검증한다.
- **arbitrary JSON/외부 prop 주입**: versioned allowlist registry, canonical serializer와 byte-size bound를 API/store 앞에서 공통 적용한다.
- **effect preview와 export 불일치**: preview adapter와 frame sampler가 같은 normalized preset/options를 사용하게 하고, third-party CSS는 persistence/renderer contract 밖에 둔다.
- **animated media 비용·부분 실패**: 이번 task에서는 PNG/none만 materialize하며 후속 GIF는 bounded pre-generation과 독립 authority/retention gate 없이는 활성화하지 않는다.
- **task 크기**: 여섯 Stage를 store/API, media, consistency, UI, share, integration으로 분리하고 단계 승인 없이 다음 영역으로 넘어가지 않는다.

## 승인 요청 사항

- 위 여섯 Stage 분할과 각 검증·커밋 경계를 승인 요청한다.
- Profile `Your Codex card` 아래 light/dark 전환·실제 preview·저장 CTA를 Stage 4 필수 범위로 승인 요청한다.
- `cardTheme` 단일 column 대신 versioned canonical `cardStyle`과 preset registry를 Stage 1에 구현하고, 이번 task의 활성 effect는 none으로 제한하는 확장 구조를 승인 요청한다.
- future Rotate/Pulse adapter와 GIF pre-generation을 migration 없이 추가할 수 있는 presentation digest/format/frame capability seam을 두되, 실제 효과 UI·GIF encoder/R2 객체는 후속 task로 유지하는 것을 승인 요청한다.
- legacy public owner가 light를 저장할 때 settings 요청 안에서 dual publication을 먼저 보완하고 저장을 commit하는 계약을 승인 요청한다.
- `publicCardUrl`은 query 없는 dark 호환으로 유지하고 `selectedPublicCardUrl`과 `publicCardUrls`를 additive하게 제공하는 API shape를 승인 요청한다.
- dark stable authority와 light stable staged object의 publication id 검증 구조를 승인 요청한다.
- production migration/deploy는 Stage 6 완료 후 별도 Gate로 남기는 것을 확인 요청한다.
