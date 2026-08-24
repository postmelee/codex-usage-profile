# Production Hosting Architecture

## 결정

M100 MVP의 canonical target architecture는 **ChatGPT Sites + D1 + native R2**다.

- Sites Worker는 제품 frontend, app-owned GitHub OAuth, browser session, device login, CLI submit, private card preview와 public card route를 같은 origin에서 제공한다.
- D1은 owner, OAuth state, session, CLI challenge/token digest, device, latest Account Usage와 visibility의 durable source다.
- native R2 binding은 immutable card revision과 stable public card publication만 저장한다. private preview는 session 인증 뒤 on-demand render하며 R2에 저장하지 않는다.
- Worker-compatible JS/Wasm renderer가 Sites의 hosted card renderer다.

이 결정은 Task #49의 architecture 적합성 검증과 Task #51의 production
migration 결과에 따른 **MVP production PASS**다. Task #108은
`https://codex-usage-profile.meleeisdeveloping.chatgpt.site`를 별도 GitHub OAuth
app, D1/R2와 environment를 가진 canonical production으로 공개했다. production은
Stage 4 release 전 관찰 baseline에서 saved version 1과 public access revision 8을
사용하며 migration `[1,2,3,4,5]`가 적용돼 있다. 기존 stage5는 Stage 5의 owner-only
테스트 전환과 승인된 test data disposal이 끝날 때까지 별도 public validation 상태를
유지한다.

기존 **Cloud Run + Neon + S3-compatible R2** 구현과 deployment artifact는 tested fallback으로 유지한다. Sites beta 정책·한도 변경, 추가 과금 요구, hosted runtime blocker 또는 장기 장애가 발생하면 이 fallback으로 전환한다. fallback 삭제는 별도 architecture 결정 없이는 허용하지 않는다.

### Stage 4 release 전 production baseline

| 항목 | 값 |
|---|---|
| canonical origin | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` |
| Site title | `Codex Usage Profile` |
| saved version | 1 |
| deployed source | `9835fb94c7cd9116114a8b936d5e9eebfb0f85d0` |
| access | public revision 8 |
| environment | production 전용 OAuth/secret, maintenance disabled, service normal, operator secret absent |
| live readiness | health `200`, operator `404`, D1 migration exact `[1,2,3,4,5]` |
| CLI | public `latest=0.1.2`, production default origin |

이 표는 PR #112 병합으로 자동 갱신되는 desired state가 아니라 cutover 전에 원격에서
관찰한 live baseline이다. 신규 saved version, access revision과 deployed source는 exact
release 배포가 성공한 뒤 Stage 4 보고서에 기록한다.

### Task #108 dual-Site target

| 역할 | origin | manifest·resource 상태 |
|---|---|---|
| canonical production | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` | `.openai/hosting.json`; public version 1, D1/R2/environment attached |
| stage5 validation/test | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | `.openai/hosting-targets.json`에서만 선택; Stage 5 전까지 public version 33 continuity |

두 target은 source, migration, logical binding 이름과 test contract만 공유한다. Site project,
D1/R2 state, GitHub OAuth application/secret, browser session, CLI token, rate-limit state와 access
policy는 공유하지 않는다. production artifact는 canonical manifest로 만들고 stage5 artifact는
repository 밖 임시 packaging root에서 role-specific manifest를 materialize한다. packaging은
live read-only preflight에서 확인한 project id를 필수 입력으로 받아 registry와 대조하고,
exact clean source의 기존 `dist`를 제거한 뒤 production artifact를 다시 build한다. 공식 helper가
만든 archive는 임시 경로에 다시 풀어 manifest·binding·migration·credential/path 검사를
반복하며, 실패한 실행의 partial archive는 제거한다. connector가
physical D1/R2 provider ID를 노출하지 않으므로 ID 동일·상이 여부를 추정하지 않고, first private
deploy에서 서로 다른 Site project/manifest, empty baseline과 교차 state 부재로 분리를 검증한다.

Task #83 version 17은 Task #74의 owner `card_style`·`card_locale` additive
migration과 media contract v4, Task #78의 `/api/share/{handle}` Open Graph document,
2400x1260 `social.png`, Share Studio와 structured store contract v3 public summary
projection을 포함한다. R2 authority/social 정합성이 없으면 packaged sample을
선언하는 보정 뒤 owner-only와 제한된 public Gate B를 통과했고, 측정 직후 다시
owner-only로 복원했다. version 23은 이 공개 계약과 `/?view=profile` 소유자
경로를 유지하면서 card readiness, decoded resource reuse, avatar 복구, 공유 handoff,
공개·소유자 profile Skeleton과 transform-free 동시 reveal까지 보정한 exact source다.
이후 Task #84는 exact-main version 24/source
`0c804733e41988467ecd7fbd8e6a152cbfc2fad0`를 public access revision 57,
environment revision 87로 전환했다. Task #101은 version 33에서 fixed README와
revision share 계약을 검증했다. version 24와 version 33은 서로 충돌하는
"현재값"이 아니라 release cutover와 후속 validation의 시간 순서 증적이다.

## 요청과 신뢰 경계

```text
browser / CLI
      |
      v
ChatGPT Sites (canonical MVP HTTPS origin)
  |        |
  |        +-- private preview: render on demand
  |
  +-- D1 binding DB: structured account and usage state
  |
  +-- native R2 binding PROFILE_MEDIA
        +-- immutable revisions
        +-- stable public card / unpublished tombstone

Fallback:
Cloud Run (same product/API contract)
  +-- Neon: structured state
  +-- S3-compatible R2: public media
```

Sites API는 same-origin 제품 경계다. 외부 `Origin`이 포함된 `/api/*` 요청은 기본적으로 거부하며 `Access-Control-Allow-Origin`을 추가하지 않는다. CLI Bearer 요청은 `Origin`을 보내지 않는 별도 protocol이다. fallback Cloud Run도 같은 HTTP/security contract를 사용한다.

Browser session mutation의 CSRF 방어는 host-only session cookie, `HttpOnly`, production `Secure`, `SameSite=Lax`, explicit cross-origin `Origin` 거부와 `Sec-Fetch-Site: same-origin` 검사를 함께 사용한다. 브라우저가 해당 헤더를 보내지 않는 요청은 기존 session 검증을 계속 적용한다. OAuth state는 일회용이며 `redirect_to`는 `/`로 시작하는 same-origin local path만 허용한다. external URL, protocol-relative URL, backslash와 control character가 포함된 값은 저장하지 않는다.

CLI Bearer 요청은 browser cookie에 의존하지 않는다. CLI는 `Origin` 헤더를 보내지 않으며 token digest로 owner가 고정된다. raw CLI token과 GitHub OAuth access token은 durable store에 기록하지 않는다. OAuth state ID와 session ID는 인증성 secret으로 분류해 application log, metric과 trace에 기록하지 않는다.

## 판정 근거와 위험 수용

| 기준 | #49/#51 근거 | 판정 |
|---|---|---|
| 현재 계정의 증분 인프라 비용 | Sites/D1/R2 생성·migration·배포·공개 smoke 과정에서 결제나 plan upgrade 없이 동작 | PASS — 현재 계정/현재 beta 관찰로 한정 |
| GitHub OAuth와 browser session | 실제 code exchange, GitHub identity, secure session과 logout | PASS |
| packed CLI와 Account Usage | device approve/exchange, Contract v1 submit, token revoke | PASS |
| D1 원자성 | real-workerd 5개 named operation 경쟁 test와 hosted duplicate submit/exchange | PASS |
| native R2 publication | hosted publish/unpublish, GET/HEAD/304/404와 concurrency | PASS |
| Worker renderer | hosted private/public PNG와 build/runtime 한도 | PASS |
| secret/private-data 경계 | response/header/client asset와 짧은 오류 log scan | PASS |
| provider 장애 보상 | local native R2 failure/concurrency suite 통과; managed remote fault injection은 미실행 | 승인된 위험 수용 |

managed production bucket에 fault-injection seam을 추가하는 것은 개인·비상업 MVP의 위험과 복잡도를 늘린다. remote R2 장애 주입 공백은 작업지시자가 승인한 위험으로 수용하고, local contract/failure test와 hosted 정상·경쟁 결과를 근거로 사용한다. 공개 cutover task는 provider 장애 시 public route가 generic 503/404로 닫히는지 운영 관찰하고, repair/export 절차를 준비한다.

## Structured Store Contract

[`store-contract.js`](../src/profile-backend/store-contract.js)는 provider-neutral contract v3와 production adapter의 여섯 named atomic operation을 정의한다. application service는 generic transaction callback이나 provider SQL을 알지 않는다. v3는 공개 프로필 문서가 owner와 latest usage를 한 번에 읽는 `getPublicProfileSummaryByHandle` projection을 필수 read surface로 추가한다.

이 contract v3 projection과 fixed `/api/share/{handle}` document read path는 Task #83
version 17의 owner-only·public smoke에서 hosted 검증됐다. 반복 요청과 submit
전후 측정에서는 shared-cache HIT나 stale `Age` 증거를 확인하지 못했지만
application revision과 media ETag는 즉시 갱신됐고 privacy·publish 계약도
유지됐다. 따라서 cache source 변경은 release blocker가 아니며, 영구 public
전환 전 별도 추측성 최적화를 추가하지 않는다. version 7의
`/?profile={handle}` compatibility 화면과 version 15의 정적 root-query 반증은
legacy 비교 근거로만 유지한다.

canonical Sites adapter는 [`src/profile-backend/d1/`](../src/profile-backend/d1/)의 D1 구현이다. schema와 ordered migration은 [`db/migrations/`](../db/migrations/)에 있고 Sites artifact의 `.openai/drizzle/`에 package된다. D1 adapter는 prepared statement, conditional update와 batch를 사용하며 process memory lock으로 원자성을 보완하지 않는다.

| 연산 | 직렬화 키 | 필수 결과 |
|---|---|---|
| OAuth callback 완료 | `oauthState.id` | pending state를 정확히 한 요청만 소비하고 owner/session/state를 함께 commit |
| CLI login 승인 | `cliLoginChallenge.id` | pending·미만료 challenge만 한 번 승인 |
| CLI login 교환 | `cliLoginChallenge.id` | approved challenge마다 token digest를 정확히 하나 발급 |
| Account Usage submit | `owner.id` | `capturedAt`과 `contentDigest`로 stale/conflict/idempotent/new를 원자적으로 판정하고 device touch와 함께 commit |
| visibility 변경 | `owner.id` | owner와 latest usage/snapshot이 같은 공개 상태를 노출 |
| 카드 설정 변경 | `owner.id` | immutable media 준비 뒤 canonical `cardStyle`과 `cardLocale`을 한 번에 갱신하고, 성공한 owner revision만 stable card/social authority를 같은 publication id로 storage ETag 조건부 commit |
| account deletion structured phase | `owner.id` | exact owner·row count·usage/snapshot·submitted-device fingerprint guard 뒤 dependent row, operation과 owner를 하나의 batch로 삭제하거나 모두 rollback |

부분 commit은 허용하지 않는다. unique constraint는 provider identity, handle, token digest, device/user code, owner+device key와 owner/handle latest record를 보호한다. 읽기와 목록 API는 owner scope를 우회할 수 없다. shared Account Usage rate limit도 D1 row의 atomic window update를 사용하며 raw token을 key나 record로 저장하지 않는다.

submitted-device deletion guard는 safe key segment의 ASCII/code-unit 순서를 SQLite
`BINARY ORDER BY id`와 동일하게 canonicalize하고 `id`, `updatedAt`,
`lastSubmittedAt`을 모두 fingerprint에 포함한다. locale-dependent 정렬, count-only
guard와 transaction 분할은 허용하지 않는다. confirmed state drift만 기존
`maintenance_conflict`에 `structured_state_changed`, `retryable: false`를 선택적으로
추가하며, provider·constraint failure와 알 수 없는 reason은 generic conflict로 닫는다.

위 연산은 real-workerd D1에서 duplicate callback/exchange, competing submit/visibility/settings와 rollback을 검증한다. 기존 hosted 검증에서는 duplicate submit/exchange도 한 결과만 commit했다.

fixed `/api/share/{handle}`와 revision `/api/share/{handle}/r/{revision}` Open Graph 문서의 structured read는 D1에서 `owners`와 `latest_usages`를 JOIN하는 statement 한 번으로 끝난다. projection은 두 record가 모두 public이고 handle이 일치할 때만 `cardLocale`, owner `updatedAt`, usage `uploadedAt`을 반환한다. 이어서 R2 dark authority와 social metadata를 body 없이 읽어 owner/publication id와 ETag가 정합할 때만 `/u/{handle}/social.png?v=`를 선언한다. revision token은 owner·usage 두 시각 중 최신 값을 epoch milliseconds로 사용한다.

matching revision 문서는 요청 URL을 `canonical`·`og:url`로 사용하고 `og:image`,
`og:image:secure_url`, `twitter:image`에도 같은 token을 사용한다. stale revision은
redirect나 과거 snapshot을 제공하지 않고 `200` 현재 문서와 최신 revision metadata로
수렴한다. fixed route는 기존 self canonical 계약을 유지한다. invalid revision은
public document route에서 제외한다. private·missing·legacy·media mismatch/provider
failure는 handle 존재를 노출하지 않는 site-root canonical과
`/assets/codex-social-sample.png`로 fail closed하며 사용자 mutation이나 on-demand R2
write를 수행하지 않는다.

fallback adapter는 [`src/profile-backend/postgres/`](../src/profile-backend/postgres/)의 벤더 중립 Postgres 구현이다. 같은 named operation contract를 transaction과 `FOR UPDATE`로 구현하고 [`postgres/migrations/`](../src/profile-backend/postgres/migrations/)를 사용한다. memory/file store는 local contract fixture이며 production durable store가 아니다. 기존 `npm run migrate:seed` one-shot Postgres 적재 도구도 fallback과 data export 참고 경로로 유지한다.

## Public Media Contract

[`media-store-contract.js`](../src/profile-media/media-store-contract.js)는 R2 adapter가 따라야 할 수명주기를 정의한다.

아래 media contract v4 theme·social 항목은 Task #74·#78 누적 후보에서 시작해
Task #84 public Gate C와 Task #101 revision share validation까지 검증됐다. legacy
public baseline version 7은 기존 stable README card 계약만 제공했고, version 17
Gate B에서는 `social.png`와 light theme 계약을 제한 public으로 검증했다.

- contract version: `4` (`3`은 query 없는 dark legacy reader만 지원)
- dark immutable revision: `cards/v2/owners/{ownerId}/revisions/{locale}/{revision}.png`
- light immutable revision: `cards/v2/owners/{ownerId}/revisions/light/{locale}/{revision}.png`
- dark stable authority: `cards/v2/public/{handle}/card.png`
- light staged stable: `cards/v2/public/{handle}/themes/light/card.png`
- canonical selection: v4 authority의 `canonicalTheme`, `canonicalLocale` pair. 둘 다 없는 legacy v4는 dark/en, partial/invalid pair는 fail-closed다.
- theme: `dark`, `light`; 명시 selector mode에서 부재하면 dark다.
- locale: `en`, `ko`; 명시 selector mode에서 부재하면 en이다.
- content type: `image/png`
- cache policy: `public, no-cache, must-revalidate`
- social stable object: `cards/v2/public/{handle}/social.png`; 카드 설정 저장은 owner CAS 성공 뒤 storage ETag 조건부 교체
- social conditional GET: application ETag를 metadata로 먼저 비교하고 일치하면 object body를 읽지 않은 채 304
- stable state: `publication` 또는 `unpublished` tombstone
- validation metadata: owner, handle, publication id, presentation digest, format, canonical theme·locale pair, theme·locale별 immutable key/revision/application ETag, created/published timestamp

revision은 최종 PNG bytes의 SHA-256 base64url digest이며 quoted application ETag도 같은 정규화 값을 사용한다. storage ETag는 S3/R2 conditional copy와 body 일관성 검증에만 사용하고 HTTP ETag로 노출하지 않는다.

canonical adapter는 [`src/profile-media/r2-binding/`](../src/profile-media/r2-binding/)의 native `R2Bucket` 구현이다. `putRevision`은 create-only conditional write를 사용한다. Publish는 dark/light × en/ko 네 immutable revision을 검증하고 light stable을 stage한 뒤 dark stable authority를 마지막 CAS commit point로 materialize한다. 같은 revision과 bytes의 재시도는 idempotent이고 다른 bytes/metadata는 conflict다.

`GET|HEAD /u/{handle}/card.png`는 native R2 binding만 조회하며 D1, owner/usage record와 on-demand renderer를 호출하지 않는다. `theme`과 `locale` selector가 모두 없으면 authority의 canonical pair를 사용하고 `v` 같은 다른 query는 이 판정에 영향을 주지 않는다. 한 selector라도 있으면 explicit mode이며 누락 축은 dark/en이다. light 응답은 dark authority가 가리키는 publication id·revision과 light stable metadata/body가 모두 일치할 때만 제공한다. stable publication/theme/locale revision이 없거나 stable state가 tombstone, canonical metadata가 partial/invalid이면 같은 public `404`다. provider·timeout·bucket 장애와 예상 밖 adapter failure는 storage 정보를 숨긴 `503 media_unavailable`, `Retry-After: 5`로 구분한다. private preview는 session 인증 후 on-demand render하며 R2에 저장하지 않고 `private, no-store`를 사용한다.

누적 후보의 `GET|HEAD /u/{handle}/social.png`는 handle당 하나인 2400x1260 stable
object를 제공한다. `If-None-Match`가 application ETag와 일치하면 object body를
읽지 않고 `304`를 반환한다. dark authority와 social publication이 일치하지
않거나 private/unpublished/missing이면 존재 여부를 숨기는 `404`, provider
장애이면 generic `503 media_unavailable`을 반환한다. API share metadata는 이 route가
실제로 제공 가능한 경우만 개인화 URL을 사용한다. 그렇지 않으면 packaged sample을
사용하되 social route 자체의 404/503 계약은 바꾸지 않는다. 정합 publication과 legacy
missing social의 local real-Worker 회귀 검증은 완료됐지만 보정 source의 production
R2/HTTP smoke는 아직 수행하지 않았다.

Share Studio는 owner `updatedAt`과 usage `uploadedAt` 중 최신 값을 공통 builder로
계산해 링크 복사와 X·Threads·LinkedIn·Facebook·Reddit에 동일한 revision 문서 URL을
전달한다. 공개 profile API는 같은 계산값을 epoch millisecond `shareRevision`으로 반환하고 raw
owner `updatedAt`은 공개하지 않는다. builder는 명시적인 `shareRevision`을 우선하고, 없는 owner
응답만 기존 두 timestamp 계산으로 하위 호환한다. 유효한 timestamp가 하나도 없거나 명시적인
revision이 유효하지 않으면 이 share target만 fixed route로 fail safe한다. README Markdown은 revision 계산과 분리해
항상 fixed `/api/share/{handle}` href와 query 없는 `/u/{handle}/card.png` src를 사용한다.
따라서 submit이나 카드 설정 저장은 공유 링크·SNS target revision만 바꾸고 README Markdown
문자열은 바꾸지 않는다.
revision은 provider cache identity일 뿐 immutable media key나 DB history key가 아니다.

stable GET은 관찰한 storage ETag를 조건으로 body를 읽어 publication metadata와 bytes가 섞이지 않게 한다. concurrent republish가 HEAD→GET 사이에 완료되면 최신 stable HEAD부터 한 번만 다시 읽고, 두 번째 경합은 `503`으로 반환한다.

Public 전환은 네 revision, light stable stage와 dark authority commit을 완료한 뒤 D1 visibility CAS를 commit한다. Unpublish는 dark authority를 직전 storage ETag 조건의 tombstone으로 바꿔 두 theme를 먼저 닫은 뒤 D1 visibility를 private으로 commit한다. light stable과 immutable revision은 retention 대상으로 남지만 authority가 없으면 public serving되지 않는다.

D1 CAS가 실패하면 자신이 쓴 stable publication/tombstone의 storage ETag가 그대로일 때만 조건부 보상한다. 더 최신 publication을 덮거나 tombstone으로 바꾸지 못한다. 보상으로 일관성을 증명할 수 없으면 generic 503과 internal repair-required 결과로 fail closed한다.

Public Account Usage submit은 usage commit 뒤 현재 visibility/latest usage를 다시 읽고 stable publication을 refresh한다. media refresh 실패는 usage commit을 되돌리지 않고 `503 media_unavailable`, `Retry-After: 5`를 반환한다. 같은 document의 exact retry는 idempotent usage 결과로 publication을 다시 시도한다.

공개 카드 설정 저장은 네 immutable revision과 social bytes만 prepare하고 owner
CAS 전에는 stable authority를 바꾸지 않는다. CAS 성공 뒤 committed owner와
latest usage version이 준비 snapshot과 같을 때만 card/social authority를 같은
publication id로 조건부 commit한다. 더 최신 owner/usage가 앞선 prepare는
`superseded`이며 generic `503 media_unavailable`, `Retry-After: 5`로 재시도를
요청한다. authority CAS 뒤 supersede된 요청은 해당 authority가 여전히 current일
때 같은 publication id의 social object까지 수렴시킨 뒤 실패를 반환한다. DB 성공
뒤 media 실패는 같은 설정 PATCH의 exact retry가 canonical card와 social
publication을 수렴시킨다.

fallback S3 adapter도 public HTTP contract는 같지만 stable object를 물리 삭제할 수 있다. unpublish는 canonical light body가 아니라 dark stable authority의 storage ETag를 읽으므로 light stable drift가 private 전환을 막지 않는다. provider 내부 보상 방식이 달라도 public/private, application ETag와 404/503 의미는 같아야 한다.

## Hosted Renderer Contract

Sites Worker는 [`worker-renderer.js`](../src/profile-card/worker-renderer.js)의 `@resvg/resvg-wasm` renderer와 bundled Noto Sans KR font를 사용한다.

- output: 결정적 1497×918 PNG
- locale: `en`, `ko`
- theme: `dark`, `light`; normalized presentation registry의 static `none@1` 효과만 materialize
- application revision/ETag: 최종 PNG digest
- avatar: HTTPS allowlist, timeout/body-size/content-type 제한 뒤 실패 시 initial fallback
- private preview: on-demand/no-store
- public card: renderer를 호출하지 않고 R2 stable publication만 조회

native `@napi-rs/canvas` renderer와 Node runtime은 Cloud Run fallback에서 유지한다. 두 renderer는 byte-identical일 필요는 없지만 같은 정보 구조, locale, 크기와 가독성을 유지한다.

## Runtime Configuration

실제 값은 Sites runtime environment 또는 fallback Secret Manager에 저장하며 저장소와 build artifact에 포함하지 않는다. `.openai/hosting.json`에는 canonical production의 opaque `project_id`와 logical D1/R2 binding 이름만 기록한다. `.openai/hosting-targets.json`은 두 target의 nonsecret project/origin/binding만 기록하고 credential은 포함하지 않는다.

### Sites canonical 값

| 설정·binding | 분류 | 설명 |
|---|---|---|
| `DB` | D1 binding | structured store, named atomic operation과 shared rate-limit state |
| `PROFILE_MEDIA` | R2 binding | immutable card revision, stable publication과 tombstone |
| `GITHUB_CLIENT_ID` | public identifier | app-owned GitHub OAuth application identifier |
| `GITHUB_CLIENT_SECRET` | secret | OAuth code exchange 전용 server secret |
| `PROFILE_MAINTENANCE_MODE` / `PROFILE_MAINTENANCE_TOKEN` | operator gate/secret | exact enable과 secret을 모두 요구하는 숨겨진 lifecycle route |
| `PROFILE_SERVICE_MODE` | bounded server config | `normal`, `maintenance`, `owner-only`, `quota-stop`; invalid 값은 maintenance로 fail closed |
| `PROFILE_STOP_RETRY_AFTER_SECONDS` | bounded server config | stop response의 1~86400초 재시도 지연, 기본 300 |
| `PROFILE_ACCOUNT_USAGE_*` | bounded server config | D1 shared burst/sustained limit·window, invalid 조합은 승인된 기본값 |
| request origin | derived public config | canonical origin과 OAuth callback/public card URL 기준 |
| `ASSETS` | Sites binding | built frontend asset과 SPA fallback |

Sites hosted runtime은 S3 access key, `NEON_DATABASE_URL`, `R2_*`, `PORT`, `HOST`와 filesystem path를 요구하지 않는다. D1/R2 migration과 logical binding은 saved version package와 Sites linkage로 관리한다.

### 관찰과 운영 중단 계약

Worker는 request마다 correlation id, route class, method, status, duration
bucket, error code와 retryability만 structured event로 기록한다. URL query,
cookie, Authorization, OAuth code/state, session/token/device code, owner
identity, usage/card bytes와 exception 원문은 event schema에 들어갈 수 없다.
응답의 `x-request-id`로 같은 event를 찾는다.

`GET|HEAD /healthz`는 `worker`와 required `bindings`를 generic
`ok|unavailable`로만 구분한다. binding 이름, metadata와 payload를 노출하지
않으며 준비되지 않으면 `503`, `Retry-After: 5`다.

- D1 shared rate limit은 기본 burst 5/10초, sustained 30/60초이며 환경값은
  limit 1~1000, window 1000~3600000ms로 제한한다. process memory fallback과
  bypass는 없다.
- `quota-stop`은 Account Usage submit을 `429 sites_quota_stop`과 bounded
  `Retry-After`로 중단한다.
- runtime `owner-only` stop은 public profile/card를 동일한 `404`로 숨긴다.
  Site 전체 anonymous 차단은 별도 owner-only access policy가 담당한다.
- `maintenance`는 operator route와 health 외 backend를
  `503 sites_maintenance`로 닫는다. provider/binding unavailable도 내부
  정보를 숨긴 `503`과 bounded `Retry-After`다.

배포·environment rotation, export/restore, retention/account deletion,
public smoke/원복, log 확인, quota stop과 fallback 절차는
[`sites-operations.md`](sites-operations.md)를 따른다.

### Cloud Run fallback runtime 값

| 설정 | 분류 | 설명 |
|---|---|---|
| `PROFILE_RUNTIME_MODE=production` | server config | production validation과 secure-cookie 강제 |
| `PROFILE_STORE_MODE=external` | server config | file store production 사용 차단 |
| `PROFILE_MEDIA_MODE=external` | server config | memory media production 사용 차단과 R2 adapter 선택 |
| `CANONICAL_APP_ORIGIN` / `PUBLIC_BASE_URL` | public config | HTTPS canonical origin과 OAuth callback/card URL 기준 |
| `PORT` | platform config | Cloud Run이 주입하는 listen port |
| `HOST` | server config | 기본값 `0.0.0.0`; 일반적으로 override 불필요 |
| `GITHUB_CLIENT_ID` | public identifier | GitHub OAuth application identifier |
| `GITHUB_CLIENT_SECRET` | secret | OAuth code exchange 전용 server secret |
| `PROFILE_STATIC_ROOT` | image config | 빌드된 frontend asset 위치; 보통 image 기본값 사용 |
| `SESSION_SECURE_COOKIES` | server config | production server가 `true`로 강제 |

`PROFILE_STORE_FILE`은 local/spike 전용이다. production persistent disk나 backup 대체물로 사용하지 않는다.

### Cloud Run fallback Postgres/Neon 값

| 설정 | 분류 | 설명 |
|---|---|---|
| `NEON_DATABASE_URL` | secret | Postgres 연결 문자열. Neon pooled(pgbouncer) endpoint를 사용한다. pool 생성 시점에만 읽으며 config 객체·로그로 전파하지 않는다 |
| `DATABASE_URL` | secret | `NEON_DATABASE_URL` 부재 시 fallback (로컬/일반 Postgres) |
| `TEST_DATABASE_URL` | test 전용 | 설정 시 Postgres integration test가 실행되고, 없으면 skip되어 `npm test`는 어디서나 green이다 |

connection pool은 인스턴스당 소형(max 4)이고 idle 연결을 빠르게 반환한다. statement timeout은 transaction마다 `SET LOCAL`로 적용해 transaction-mode pooling에서도 유효하다. migration은 instance 부팅 시 자동 실행하지 않으며 배포 단계에서 `npm run migrate:postgres -- up`으로 명시 실행한다(advisory lock으로 동시 실행 직렬화).

### Cloud Run fallback R2/S3-compatible media 값

| 설정 | 분류 | 설명 |
|---|---|---|
| `R2_ENDPOINT` | server config | R2 S3-compatible origin. path, query와 embedded credential을 허용하지 않는다 |
| `R2_BUCKET` | server config | public card revision/stable object 전용 bucket |
| `R2_ACCESS_KEY_ID` | secret | server-side S3 signing access key |
| `R2_SECRET_ACCESS_KEY` | secret | server-side S3 signing secret |
| `R2_REGION` | server config | optional, 기본값 `auto` |
| `TEST_S3_ENDPOINT`, `TEST_S3_BUCKET`, `TEST_S3_ACCESS_KEY_ID`, `TEST_S3_SECRET_ACCESS_KEY` | test 전용 | 모두 설정된 경우에만 MinIO/R2-compatible integration suite 실행 |

R2 credential은 `PROFILE_MEDIA_MODE=external` adapter 생성 시점에만 읽고 runtime config, application response, log와 frontend bundle에 포함하지 않는다. runtime이 직접 생성한 S3 client만 shutdown에서 닫으며 injected test fixture의 수명은 caller가 관리한다.

## Startup, Health, Cache, Rollback

1. Sites는 exact pushed commit으로 saved version을 만들고, 저장된 version만 production deployment한다.
2. D1 migration은 deployment package에 포함하며 schema 변경은 최소 한 saved-version rollback 구간 동안 backward compatible해야 한다.
3. Task #119 누적 candidate readiness는 D1 migration `1..6`이 순서까지 정확히 일치해야 한다. `0004_card_style`, `0005_card_locale`은 이전 saved version이 무시할 수 있는 additive column이며, `0006_account_deletion_operations`는 owner cascade를 가진 additive operation table로 유지한다.
4. `/healthz`는 Worker와 required binding existence를 generic 상태로 검증하되 credential, binding metadata와 payload를 노출하지 않는다. API/R2 route는 dependency 오류를 generic 503으로 닫는다.
5. public stable card는 application ETag 재검증을 사용한다. immutable media revision은 장기 보존할 수 있지만 stable URL은 최신 publication 또는 unpublished tombstone만 나타낸다. share revision path는 별도 snapshot 보존을 뜻하지 않으며 stale 요청도 현재 metadata로 수렴한다.
6. R2 publish/unpublish 실패는 이전 public object를 잘못 교체하지 않는다. D1/R2 일관성을 증명할 수 없으면 성공으로 응답하지 않고 fail closed한다.
7. application rollback은 이전 saved version deployment로 수행한다. Task #100의 canonical pair는 v4 authority의 additive metadata이므로 이전 v4 reader는 이를 무시하고 queryless authority를 기존 dark/en으로 읽을 수 있다. migration 6 table도 기존 application read/write 경로가 참조하지 않지만 active 계정 삭제 operation이 있으면 application rollback을 금지하고 maintenance를 닫은 채 같은 operation을 완료하거나 복구 절차를 별도 승인한다. data/schema rollback이 필요한 변경은 별도 migration/backup 절차를 먼저 검증한다.
8. Site access 변경은 deployment와 별도다. test/staging은 owner-only를 기본값으로 하고 public 전환은 정확한 URL·OAuth callback·data 범위를 승인받은 뒤에만 수행한다.
9. fallback 전환 시 기존 Cloud Run artifact를 배포하고 Neon/S3-compatible R2 설정을 연결한다. fallback 때문에 Sites 또는 Cloud Run의 CORS/cookie scope를 확대하지 않는다.

Cloud Run fallback은 계속 `0.0.0.0:$PORT`, production file/memory store 거부, explicit migration, dependency readiness와 previous revision rollback 계약을 유지한다.

## 비용·한도와 stop/fallback 조건

Task #49에서 현재 ChatGPT 유료 계정의 Sites, D1과 R2 linkage·migration·배포·공개 smoke는 별도 결제나 plan upgrade 없이 완료됐다. 이 문서의 “증분 비용 0원”은 해당 계정과 당시 Sites beta에서 관찰한 결과이지 장기 가격·무제한 quota 보장이 아니다.

다음 중 하나가 발생하면 신규 공개/submit을 중단하고 Site를 owner-only 또는 maintenance 상태로 전환한 뒤 Cloud Run fallback을 평가한다.

- 별도 유료 plan, 결제수단 또는 자동 초과 과금 활성화를 요구한다.
- Worker/D1/R2 quota 부족으로 정상 login, submit, private preview 또는 stable card serving을 유지할 수 없다.
- Sites beta 정책 변경으로 app-owned GitHub OAuth, public CLI API 또는 required binding을 지원하지 않는다.
- 반복되는 provider failure에서 public/private fail-closed 계약이나 data export/복구 가능성을 보장할 수 없다.
- production monitoring에서 비용 0원 조건 또는 개인 프로젝트의 운영 한도를 벗어나는 사용량 증가가 확인된다.

MVP migration task는 비용·quota 표시를 배포 전 확인하고, 사용자가 늘면 architecture와 hosting channel을 점진적으로 재평가한다. 자동 유료 전환은 허용하지 않는다.

## Data Retention, Backup, PII 최소화

아래 값은 개인·비상업 MVP의 production 기본 정책이다. 자동 schedule을
추가해 별도 비용이나 권한을 늘리지 않고 operator가 매월 dry-run 결과를
검토한다.

### 저장 데이터와 PII 최소화

- 저장하는 개인 식별 정보는 GitHub 공개 identity(login, display name, avatar/profile URL, provider user id)와 owner가 선택한 handle로 한정한다. usage 문서는 analyzer 계약상 identity-free다.
- raw CLI token, raw device code, GitHub OAuth access token은 저장하지 않는다. D1/Postgres schema에는 digest와 record metadata만 있고, local/hosted flow와 client artifact scan으로 raw credential 비저장을 검증한다.
- usage와 snapshot은 owner당 latest 1건만 저장한다. 시계열 히스토리를 축적하지 않는 것 자체가 1차 데이터 최소화 장치다.

### Retention 기본 정책

- expired/consumed OAuth state, expired CLI challenge, expired/revoked session과
  token 행은 만료 뒤 인증에 사용할 수 없다. 매월
  `sites:profile-maintenance retention` 90일 dry-run으로 count를 확인하고,
  backup과 exact count 승인을 거친 경우에만 `--apply`한다.
- self-service 계정 삭제 UI는 아직 제품 기능이 아니다. owner 요청은
  operator가 export와 exact owner/handle/digest/count를 확인한 뒤
  `delete-account --apply`로 처리한다.
- 계정 삭제 operation은 최초 승인 digest/count, `prepare -> media -> structured`
  phase와 120초 lease를 D1 migration 6의 owner-scoped row에 보존한다. R2 revision은
  기본 8개 bounded batch로 직렬 삭제하고, live lease의 Retry-After 또는
  network-unknown 이후에는 read-only plan으로 같은 operation을 확인한 뒤 재개한다.
  R2 revision이 남아 있으면 owner를 삭제하지 않으며 최종 owner delete의 cascade가
  operation row도 제거한다. terminal `structured_state_changed`는 read-only plan 한 번
  뒤 추가 mutation 없이 중단하고, reason 없는 legacy conflict는 기존 bounded
  reconciliation을 유지한다.
- dark authority, light stable과 unpublished tombstone은 cleanup 대상이 아니다. immutable revision은 authority metadata가 참조하는 모든 key, owner+theme+locale별 최근 5개, 생성 후 90일 이내를 보호한다. authority가 없는 light stable과 나머지만 orphan candidate다.
- `npm run cleanup:card-media`는 기본 dry-run이며 paginated stable scan을 revision scan보다 먼저 수행한다. 출력은 candidate key, reason, age와 summary로 제한한다.
- 실제 삭제에는 `npm run cleanup:card-media -- --apply`가 필요하다. 각 candidate 삭제 직전에 stable metadata를 다시 전수 확인하고 새 publication이 참조하면 skip한다. 삭제는 R2에서 복구할 수 없으므로 dry-run 결과와 bucket backup/복구 정책을 확인한 뒤에만 실행한다.
- 자동 cleanup schedule은 MVP 범위에서 두지 않는다. 90일/최근 5개 운영 값을
  줄이거나 자동화하려면 비용·복구 목표를 다시 승인받는다.

### Backup과 복구

- D1 migration은 최소 한 saved-version rollback 구간 동안 backward
  compatible해야 한다. production data lifecycle 전에 실제 export,
  disposable restore/repair와 exact digest/count 일치를 검증했다.
- R2는 dark authority/tombstone, light stable과 네 theme·locale immutable revision을 함께 export할 수 있어야 한다. cleanup apply 전에 export/복구 가능성을 확인한다.
- fallback Postgres의 `npm run migrate:postgres -- down`, Neon backup/PITR와 seeding rollback은 계속 보존하지만 Sites D1 backup을 대신하지 않는다.
- Task #49/#51의 test owner, usage, session, token과 media는 승인된 cleanup 뒤
  0건이다. Task #45 fresh-owner QA도 private submit, temporary publish/unpublish,
  export/restore와 exact delete를 검증한 뒤 final owner plan `not_found`,
  retention candidate 0으로 종료했다.
- Task #45의 disposable owner/session/token/D1/R2, 검증 backup과 task 전용
  CLI config/cache/credential은 별도 Gate C 승인에 따라 exact 삭제했고 복구할
  수 없다. 일반 사용자 account deletion에서는 backup 보존 기간과 영구 삭제를
  해당 Gate에서 별도로 승인하며 실제 path와 payload는 문서·로그·repository에
  기록하지 않는다.

## 검증 상태

### 실제 Sites에서 검증됨

- Task #84 Stage 5 read-only audit에서 version 33, public access revision 59,
  environment revision 89와 9개 key 구성을 재확인했다. `/healthz`는 `200`, 닫힌
  operator route는 `404`, D1 `schema_migrations`는 exact `[1,2,3,4,5]`였으며
  version·access·environment·D1/R2·계정·session mutation은 수행하지 않았다.
- Task #101 saved version 33, source
  `53a7132630dcb6f43459880d79730e10e2b59d6e`의 공개 validation smoke:
  matching·stale revision canonical/image token 정합, X·LinkedIn 최신 light card,
  Threads·Facebook·Reddit 회귀와 fixed route 하위 호환. 실제 게시 없이 작성 화면만
  확인했고 X는 최초 표시까지 약 11초, Threads는 약 10초가 필요했다.
- Task #84 exact-main saved version 24, source
  `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`의 Gate C public cutover:
  public access revision 57, environment revision 87, OAuth·CLI·profile·README
  card·social media·privacy·non-enumeration과 X·Threads·카카오 preview 검증.
  이 값은 후속 validation 배포 전의 release 이력이다.
- Task #83 saved version 23, source
  `c030339d848f961c54358d9d3523b340bed09670`의 owner/public card readiness,
  decoded resource reuse, avatar, source-image handoff, 구조형 profile Skeleton과
  transform `none`·delay `0s` 동시 reveal owner-only hosted smoke
- Task #83 saved version 18, source
  `e431cc88ba73b02341a170fe5c38117d4552e42a`의 `/?view=profile` 메뉴·OAuth 복귀·
  공개 CTA 집중 smoke, readiness `[1,2,3,4,5]`와 owner-only safe baseline
- Task #83 saved version 17, source
  `4541e3be7fc1dce6d7e54bbe01ce279d1ceba05f`의 owner-only·제한 public Gate B:
  migration readiness `[1,2,3,4,5]`, canonical API share, packaged social fallback,
  README dark/light × en/ko, publish/unpublish, private/missing 비노출과 revision/ETag
  신선도
- 같은 Gate B의 반복 요청에서는 shared-cache HIT·stale `Age` 증거가 없었고,
  application revision/ETag가 즉시 갱신돼 cache 변경을 release blocker로 분류하지
  않음; 측정 뒤 disposable state를 정리하고 custom owner-only로 원복
- saved version 7, source
  `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`와 production deployment
  `succeeded`
- logical D1 `DB`, native R2 `PROFILE_MEDIA`, migration 2개와 Worker renderer composition
- production GitHub OAuth code exchange, GitHub identity, secure browser session과 logout
- packed CLI device login/approve/exchange, Contract v1 submit과 token revoke
- authenticated private preview 200/no-store와 private/public/missing 404
- publish/unpublish, stable GET/HEAD/If-None-Match 304와 application ETag
- duplicate usage submit의 accepted/idempotent 결과와 one-token device exchange
- cross-origin session mutation 거부
- client asset/response/header secret·private-data 비노출
- Gate B public smoke 종료 뒤 owner-only access, private visibility,
  revoked token/session과 owner data 0건 원복
- Task #45 final public access revision 26, anonymous landing과 health 200
- clean packed CLI의 device approve, Contract v1 submit, status 거부와 logout
- private default, publish/unpublish, canonical HTML/JSON, stable
  GET/HEAD/locale/304/404와 application ETag
- Task #45 disposable owner/session/token/D1/R2 guarded cleanup, final owner plan
  `not_found`, 90일 retention candidate 0건과 local CLI credential 제거
- final environment revision 57의 maintenance disabled, service mode normal,
  maintenance operator secret absent
- final recent error-only log의 5xx/Worker failure 0건과
  response/header/client allowlist 재확인

### local real runtime/contract에서 검증됨

- real-workerd D1 migration, store, shared rate limit과 named atomic operation
- D1 duplicate callback/exchange, concurrent submit/visibility와 failure rollback
- native R2 contract v3 legacy dark reader와 v4 theme·locale revision/dual stable/tombstone, conditional write/read와 failure/concurrency matrix
- publication service의 D1 CAS 보상, newer publication 비침범과 repair-required fail closed
- Worker renderer의 1497×918 결정성, dark/light × en/ko, avatar success/fallback과 browser/CLI full-stack
- Worker hosted import graph의 Node/native/Postgres/S3 credential 부재
- 기존 Node/Cloud Run/Postgres/S3-compatible fallback build와 contract 회귀
- orphan cleanup dry-run/apply guard와 stable tombstone 보존

### 공개 뒤 후속 운영 항목

- public npm `codex-usage-profile@0.1.2` provenance/integrity와 production 기본 origin을
  유지한다. npm package 내용 보정은 immutable `0.1.2`를 덮어쓰지 않고 새 patch로 처리한다.
- Task #45 clean production OAuth/CLI/D1/R2/card 전체 흐름 및 보안 QA
  완료 상태 유지
- 월별 90일 retention dry-run과 owner 요청 기반 account deletion
- Sites public beta의 plan별 limit 알림, public 유지 제한, traffic/quota 증가
  시 비용 stop과 error event 재평가
- managed remote provider fault injection을 대신하는 운영 관찰·repair procedure

Stage 5의 provider fault injection 공백은 위 판정의 승인된 위험 수용이다. 정상 hosted contract와 local failure/concurrency test가 깨지면 PASS 근거도 무효가 된다.

## 후속 작업

1. 월별 90일 retention dry-run과 owner 요청 기반 account deletion을 운영한다.
2. Sites의 plan별 limit 알림, public 유지 제한과 가격·정책 변경을
   주기적으로 확인한다.
3. 가격·quota·정책 또는 장기 장애 trigger가 실제로 발생할 때만 #43의
   Cloud Run/Neon/S3-compatible R2 fallback을 평가한다.
4. marketing-only Sites mirror였던 #46은 canonical full-stack Site와
   중복되므로 별도 구현하지 않는다.
