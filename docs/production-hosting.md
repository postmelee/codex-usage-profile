# Production Hosting Architecture

## 결정

M100 MVP의 canonical target architecture는 **ChatGPT Sites + D1 + native R2**다.

- Sites Worker는 제품 frontend, app-owned GitHub OAuth, browser session, device login, CLI submit, private card preview와 public card route를 같은 origin에서 제공한다.
- D1은 owner, OAuth state, session, CLI challenge/token digest, device, latest Account Usage와 visibility의 durable source다.
- native R2 binding은 immutable card revision과 stable public card publication만 저장한다. private preview는 session 인증 뒤 on-demand render하며 R2에 저장하지 않는다.
- Worker-compatible JS/Wasm renderer가 Sites의 hosted card renderer다.

이 결정은 Task #49 Stage 5의 실제 hosted OAuth, CLI, D1, R2와 renderer 검증에 따른 **architecture 적합성 PASS**다. 현재 Stage 5 Site, D1/R2와 test OAuth app은 owner-only 검증 자원이며 production cutover가 아니다. canonical build 전환, production OAuth app/custom domain, production data 경계, monitoring/backup과 공개 access는 별도 migration task에서 승인받는다.

기존 **Cloud Run + Neon + S3-compatible R2** 구현과 deployment artifact는 tested fallback으로 유지한다. Sites beta 정책·한도 변경, 추가 과금 요구, hosted runtime blocker 또는 장기 장애가 발생하면 이 fallback으로 전환한다. fallback 삭제는 별도 architecture 결정 없이는 허용하지 않는다.

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

| 기준 | Stage 5 근거 | 판정 |
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

[`store-contract.js`](../src/profile-backend/store-contract.js)는 provider-neutral contract v2와 production adapter의 다섯 named atomic operation을 정의한다. application service는 generic transaction callback이나 provider SQL을 알지 않는다.

canonical Sites adapter는 [`src/profile-backend/d1/`](../src/profile-backend/d1/)의 D1 구현이다. schema와 ordered migration은 [`db/migrations/`](../db/migrations/)에 있고 Sites artifact의 `.openai/drizzle/`에 package된다. D1 adapter는 prepared statement, conditional update와 batch를 사용하며 process memory lock으로 원자성을 보완하지 않는다.

| 연산 | 직렬화 키 | 필수 결과 |
|---|---|---|
| OAuth callback 완료 | `oauthState.id` | pending state를 정확히 한 요청만 소비하고 owner/session/state를 함께 commit |
| CLI login 승인 | `cliLoginChallenge.id` | pending·미만료 challenge만 한 번 승인 |
| CLI login 교환 | `cliLoginChallenge.id` | approved challenge마다 token digest를 정확히 하나 발급 |
| Account Usage submit | `owner.id` | `capturedAt`과 `contentDigest`로 stale/conflict/idempotent/new를 원자적으로 판정하고 device touch와 함께 commit |
| visibility 변경 | `owner.id` | owner와 latest usage/snapshot이 같은 공개 상태를 노출 |

부분 commit은 허용하지 않는다. unique constraint는 provider identity, handle, token digest, device/user code, owner+device key와 owner/handle latest record를 보호한다. 읽기와 목록 API는 owner scope를 우회할 수 없다. shared Account Usage rate limit도 D1 row의 atomic window update를 사용하며 raw token을 key나 record로 저장하지 않는다.

위 다섯 연산은 real-workerd D1에서 duplicate callback/exchange, competing submit/visibility와 rollback을 검증한다. Stage 5에서는 실제 hosted duplicate submit/exchange도 한 결과만 commit했다.

fallback adapter는 [`src/profile-backend/postgres/`](../src/profile-backend/postgres/)의 벤더 중립 Postgres 구현이다. 같은 named operation contract를 transaction과 `FOR UPDATE`로 구현하고 [`postgres/migrations/`](../src/profile-backend/postgres/migrations/)를 사용한다. memory/file store는 local contract fixture이며 production durable store가 아니다. 기존 `npm run migrate:seed` one-shot Postgres 적재 도구도 fallback과 data export 참고 경로로 유지한다.

## Public Media Contract

[`media-store-contract.js`](../src/profile-media/media-store-contract.js)는 R2 adapter가 따라야 할 수명주기를 정의한다.

- contract version: `3`
- immutable revision: `cards/v2/owners/{ownerId}/revisions/{locale}/{revision}.png`
- stable public object: `cards/v2/public/{handle}/card.png`
- locale: `en`, `ko`를 하나의 publication metadata로 함께 가리킨다. query가 없거나 지원하지 않는 locale은 `en`으로 fallback한다.
- content type: `image/png`
- cache policy: `public, no-cache, must-revalidate`
- stable state: `publication` 또는 `unpublished` tombstone
- validation metadata: owner, handle, publication id, locale별 immutable key/revision/application ETag, created/published timestamp

revision은 최종 PNG bytes의 SHA-256 base64url digest이며 quoted application ETag도 같은 정규화 값을 사용한다. storage ETag는 S3/R2 conditional copy와 body 일관성 검증에만 사용하고 HTTP ETag로 노출하지 않는다.

canonical adapter는 [`src/profile-media/r2-binding/`](../src/profile-media/r2-binding/)의 native `R2Bucket` 구현이다. `putRevision`은 create-only conditional write를 사용한다. Publish는 `en`, `ko` immutable revision을 검증한 뒤 stable key에 `en` body와 두 locale pointer metadata를 조건부 materialize한다. 같은 revision과 bytes의 재시도는 idempotent이고 다른 bytes/metadata는 conflict다.

`GET|HEAD /u/{handle}/card.png`는 native R2 binding만 조회하며 D1, owner/usage record와 on-demand renderer를 호출하지 않는다. stable publication/locale revision이 없거나 stable state가 tombstone이면 같은 public `404`다. provider·timeout·bucket 장애와 예상 밖 adapter failure는 storage 정보를 숨긴 `503 media_unavailable`, `Retry-After: 5`로 구분한다. private preview는 session 인증 후 on-demand render하며 R2에 저장하지 않고 `private, no-store`를 사용한다.

stable GET은 관찰한 storage ETag를 조건으로 body를 읽어 publication metadata와 bytes가 섞이지 않게 한다. concurrent republish가 HEAD→GET 사이에 완료되면 최신 stable HEAD부터 한 번만 다시 읽고, 두 번째 경합은 `503`으로 반환한다.

Public 전환은 두 locale revision과 stable materialization을 완료한 뒤 D1 visibility CAS를 commit한다. Unpublish는 native R2 `delete`의 conditional precondition 부재 때문에 stable object를 물리 삭제하지 않고, 직전 storage ETag가 일치할 때만 tombstone으로 교체한 뒤 D1 visibility를 private으로 commit한다. immutable revision은 retention 대상으로 남는다.

D1 CAS가 실패하면 자신이 쓴 stable publication/tombstone의 storage ETag가 그대로일 때만 조건부 보상한다. 더 최신 publication을 덮거나 tombstone으로 바꾸지 못한다. 보상으로 일관성을 증명할 수 없으면 generic 503과 internal repair-required 결과로 fail closed한다.

Public Account Usage submit은 usage commit 뒤 현재 visibility/latest usage를 다시 읽고 stable publication을 refresh한다. media refresh 실패는 usage commit을 되돌리지 않고 `503 media_unavailable`, `Retry-After: 5`를 반환한다. 같은 document의 exact retry는 idempotent usage 결과로 publication을 다시 시도한다.

fallback S3 adapter도 public HTTP contract는 같지만 stable object를 물리 삭제할 수 있다. provider 내부 보상 방식이 달라도 public/private, application ETag와 404/503 의미는 같아야 한다.

## Hosted Renderer Contract

Sites Worker는 [`worker-renderer.js`](../src/profile-card/worker-renderer.js)의 `@resvg/resvg-wasm` renderer와 bundled Noto Sans KR font를 사용한다.

- output: 결정적 1497×918 PNG
- locale: `en`, `ko`
- application revision/ETag: 최종 PNG digest
- avatar: HTTPS allowlist, timeout/body-size/content-type 제한 뒤 실패 시 initial fallback
- private preview: on-demand/no-store
- public card: renderer를 호출하지 않고 R2 stable publication만 조회

native `@napi-rs/canvas` renderer와 Node runtime은 Cloud Run fallback에서 유지한다. 두 renderer는 byte-identical일 필요는 없지만 같은 정보 구조, locale, 크기와 가독성을 유지한다.

## Runtime Configuration

실제 값은 Sites runtime environment 또는 fallback Secret Manager에 저장하며 저장소와 build artifact에 포함하지 않는다. `.openai/hosting.json`에는 opaque `project_id`와 logical D1/R2 binding 이름만 기록한다.

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
3. `/healthz`는 Worker와 required binding existence를 generic 상태로 검증하되 credential, binding metadata와 payload를 노출하지 않는다. API/R2 route는 dependency 오류를 generic 503으로 닫는다.
4. public stable card는 application ETag 재검증을 사용한다. immutable revision은 장기 보존할 수 있지만 stable URL은 최신 publication 또는 unpublished tombstone만 나타낸다.
5. R2 publish/unpublish 실패는 이전 public object를 잘못 교체하지 않는다. D1/R2 일관성을 증명할 수 없으면 성공으로 응답하지 않고 fail closed한다.
6. application rollback은 이전 saved version deployment로 수행한다. data/schema rollback이 필요한 변경은 별도 migration/backup 절차를 먼저 검증한다.
7. Site access 변경은 deployment와 별도다. test/staging은 owner-only를 기본값으로 하고 public 전환은 정확한 URL·OAuth callback·data 범위를 승인받은 뒤에만 수행한다.
8. fallback 전환 시 기존 Cloud Run artifact를 배포하고 Neon/S3-compatible R2 설정을 연결한다. fallback 때문에 Sites 또는 Cloud Run의 CORS/cookie scope를 확대하지 않는다.

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

structured store의 기본 정책이다. 세부 보존 기간, D1 export/backup과 자동화는 Sites MVP migration task에서 운영 값과 함께 확정한다.

### 저장 데이터와 PII 최소화

- 저장하는 개인 식별 정보는 GitHub 공개 identity(login, display name, avatar/profile URL, provider user id)와 owner가 선택한 handle로 한정한다. usage 문서는 analyzer 계약상 identity-free다.
- raw CLI token, raw device code, GitHub OAuth access token은 저장하지 않는다. D1/Postgres schema에는 digest와 record metadata만 있고, local/hosted flow와 client artifact scan으로 raw credential 비저장을 검증한다.
- usage와 snapshot은 owner당 latest 1건만 저장한다. 시계열 히스토리를 축적하지 않는 것 자체가 1차 데이터 최소화 장치다.

### Retention 기본 정책

- expired/consumed OAuth state, expired CLI challenge, expired/revoked session과 token 행은 만료 시점 이후 인증에 사용될 수 없으나 행 자체는 남는다. 타임스탬프는 ISO-8601 UTC text로 사전순 비교가 시간순과 일치하므로, D1 운영 정리는 `DELETE ... WHERE expires_at < ?` 형태의 명시적 작업으로 수행한다. 자동 정리 주기는 migration task에서 확정한다.
- 계정 삭제(owner 및 종속 레코드 일괄 제거)는 아직 제품 기능이 아니다. README 보안 절의 미해결 항목과 동일하게 후속 task로 관리한다.
- public stable object와 unpublished tombstone은 cleanup 대상이 아니다. immutable revision은 stable metadata가 참조하는 모든 key, owner+locale별 최근 5개, 생성 후 90일 이내를 보호한다. 나머지만 orphan candidate다.
- `npm run cleanup:card-media`는 기본 dry-run이며 paginated stable scan을 revision scan보다 먼저 수행한다. 출력은 candidate key, reason, age와 summary로 제한한다.
- 실제 삭제에는 `npm run cleanup:card-media -- --apply`가 필요하다. 각 candidate 삭제 직전에 stable metadata를 다시 전수 확인하고 새 publication이 참조하면 skip한다. 삭제는 R2에서 복구할 수 없으므로 dry-run 결과와 bucket backup/복구 정책을 확인한 뒤에만 실행한다.
- 자동 cleanup schedule과 90일/최근 5개 운영 값의 조정은 migration task에서 비용·복구 목표와 함께 결정한다.

### Backup과 복구

- D1 migration은 최소 한 saved-version rollback 구간 동안 backward compatible해야 한다. production data를 넣기 전에 export/restore smoke와 보존 위치를 확정한다.
- R2는 stable/tombstone과 immutable revision을 함께 export할 수 있어야 한다. cleanup apply 전에 export/복구 가능성을 확인한다.
- fallback Postgres의 `npm run migrate:postgres -- down`, Neon backup/PITR와 seeding rollback은 계속 보존하지만 Sites D1 backup을 대신하지 않는다.
- Stage 5 test owner/집계 usage와 immutable media는 owner-only/private 상태로 유지 중이다. production cutover 전 별도 production resource를 만들거나 승인된 cleanup으로 test data를 제거한다.

## 검증 상태

### 실제 Sites에서 검증됨

- saved version 2와 production deployment `succeeded`
- logical D1 `DB`, native R2 `PROFILE_MEDIA`, migration 2개와 Worker renderer composition
- app-owned GitHub OAuth code exchange, GitHub identity, secure browser session과 logout
- packed CLI device login/approve/exchange, Contract v1 submit과 token revoke
- authenticated private preview 200/no-store와 private/public/missing 404
- publish/unpublish, stable GET/HEAD/If-None-Match 304와 application ETag
- duplicate usage submit의 accepted/idempotent 결과와 one-token device exchange
- cross-origin session mutation 거부
- client asset/response/header secret·private-data 비노출
- public smoke 종료 뒤 owner-only access, private visibility와 revoked token/session 원복

### local real runtime/contract에서 검증됨

- real-workerd D1 migration, store, shared rate limit과 다섯 named atomic operation
- D1 duplicate callback/exchange, concurrent submit/visibility와 failure rollback
- native R2 contract v3 revision/stable/tombstone, conditional write/read와 failure/concurrency matrix
- publication service의 D1 CAS 보상, newer publication 비침범과 repair-required fail closed
- Worker renderer의 1497×918 결정성, `en`/`ko`, avatar success/fallback과 browser/CLI full-stack
- Worker hosted import graph의 Node/native/Postgres/S3 credential 부재
- 기존 Node/Cloud Run/Postgres/S3-compatible fallback build와 contract 회귀
- orphan cleanup dry-run/apply guard와 stable tombstone 보존

### production cutover 전에 남음

- Stage 5 test resource와 분리된 production data/resource 정책 또는 승인된 test data cleanup
- production OAuth app/custom domain과 최종 public access
- D1/R2 export, backup/restore와 account deletion/retention job
- hosted event 조회와 quota/비용 stop 값·alert 운용 검증
- managed remote provider fault injection을 대신하는 운영 관찰·repair procedure

Stage 5의 provider fault injection 공백은 위 판정의 승인된 위험 수용이다. 정상 hosted contract와 local failure/concurrency test가 깨지면 PASS 근거도 무효가 된다.

## 후속 작업

별도 Sites MVP migration task에서 다음을 순서대로 수행한다.

1. canonical product build를 Sites full-stack surface로 정리하되 Cloud Run/Neon/S3 fallback artifact와 tests를 삭제하지 않는다.
2. production OAuth app, custom domain, public access와 CLI 기본 service origin을 exact 값으로 승인받는다.
3. Stage 5 test D1/R2를 재사용할지 production resource를 분리할지 결정하고, test owner/usage/media cleanup 또는 migration을 수행한다.
4. D1/R2 export, backup/restore, retention/account deletion과 repair procedure를 구현·검증한다.
5. 구현된 structured event와 abuse/rate-limit·비용 stop 값을 owner-only
   candidate에서 확인하고 alert 기준을 확정한다.
6. owner-only candidate → 제한 public smoke → production cutover를 별도 Gate로 진행한다.

GitHub Issue #43과 #46은 Task #49에서 close하거나 수정하지 않았다. migration task를 등록할 때 #43은 Cloud Run fallback deployment로 유지·재범위화하고, #46의 marketing-only 원격 게시 범위는 Sites canonical full-stack 전환과 중복되지 않도록 별도 결정한다.
