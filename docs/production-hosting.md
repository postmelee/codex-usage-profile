# Production Hosting Architecture

## 결정

MVP 제품의 canonical architecture는 Cloud Run + Neon + R2다.

- Cloud Run은 제품 프론트엔드, GitHub OAuth, browser session, device login, CLI submit, private card preview와 render를 같은 origin에서 제공한다.
- Neon은 owner, OAuth state, session, CLI challenge와 token digest, device, latest usage와 visibility 같은 structured record의 durable source다.
- R2는 공개된 card media만 제공한다. private preview와 비공개 사용자의 데이터는 R2에 기록하지 않는다.
- ChatGPT Sites는 선택적인 marketing mirror다. sample card, 제품 설명, Quickstart와 Cloud Run 이동 CTA만 포함하며 제품 API나 사용자 데이터를 호출하지 않는다.

Sites 배포 실패는 MVP release를 막지 않는다. Cloud Run landing이 제품 진입점과 marketing fallback을 모두 담당한다.

## 요청과 신뢰 경계

```text
browser / CLI
      |
      v
Cloud Run (canonical HTTPS origin)
  |        |
  |        +-- private preview: render on demand
  |
  +-- Neon: structured account and usage state
  |
  +-- R2: public immutable revisions + stable public card object

ChatGPT Sites (optional marketing only)
  +-- full-page CTA --> Cloud Run /
  +-- no OAuth, session, API, Neon, R2, or user data access
```

Cloud Run API는 same-origin 제품 경계다. 외부 `Origin`이 포함된 `/api/*` 요청은 기본적으로 거부하며 `Access-Control-Allow-Origin`을 추가하지 않는다. Sites도 Cloud Run credential이나 API를 가져오지 않는다.

Browser session mutation의 CSRF 방어는 host-only session cookie, `HttpOnly`, production `Secure`, `SameSite=Lax`, explicit cross-origin `Origin` 거부와 `Sec-Fetch-Site: same-origin` 검사를 함께 사용한다. 브라우저가 해당 헤더를 보내지 않는 요청은 기존 session 검증을 계속 적용한다. OAuth state는 일회용이며 `redirect_to`는 `/`로 시작하는 Cloud Run local path만 허용한다. external URL, protocol-relative URL, backslash와 control character가 포함된 값은 저장하지 않는다.

CLI Bearer 요청은 browser cookie에 의존하지 않는다. CLI는 `Origin` 헤더를 보내지 않으며 token digest로 owner가 고정된다. raw CLI token과 GitHub OAuth access token은 durable store에 기록하지 않는다. OAuth state ID와 session ID는 인증성 secret으로 분류해 application log, metric과 trace에 기록하지 않는다.

## Structured Store Contract

[`store-contract.js`](../src/profile-backend/store-contract.js)는 provider 중립 structured-store 표면과 production adapter의 원자성 요구를 정의한다. memory/file store는 이 표면의 contract fixture로, `transaction(runner)` 스코프를 단일 프로세스 직렬화(스냅샷/복원)로 구현한다. file store는 local 개발과 spike에서만 사용하며 Cloud Run 다중 인스턴스 production store가 아니다.

production adapter는 [`src/profile-backend/postgres/`](../src/profile-backend/postgres/)의 벤더 중립 Postgres 구현이다(배포 대상은 Neon). 각 원자 연산의 read-modify-write 전체가 하나의 DB transaction 안에서 실행되고, transaction 내 단일행 조회는 `FOR UPDATE`로 직렬화 키 row를 잠근다. schema는 [`postgres/migrations/`](../src/profile-backend/postgres/migrations/)의 versioned migration으로 관리하며, unique constraint 위반은 contract의 `conflict` 오류로 매핑된다.

adapter가 transaction으로 구현하는 연산은 다음과 같다.

| 연산 | 직렬화 키 | 필수 결과 |
|---|---|---|
| OAuth callback 완료 | `oauthState.id` | pending state를 정확히 한 요청만 소비하고 owner/session/state를 함께 commit |
| CLI login 승인 | `cliLoginChallenge.id` | pending·미만료 challenge만 한 번 승인 |
| CLI login 교환 | `cliLoginChallenge.id` | approved challenge마다 token digest를 정확히 하나 발급 |
| Account Usage submit | `owner.id` | `capturedAt`과 `contentDigest`로 stale/conflict/idempotent/new를 원자적으로 판정하고 device touch와 함께 commit |
| visibility 변경 | `owner.id` | owner와 latest usage/snapshot이 같은 공개 상태를 노출 |

부분 commit은 허용하지 않는다. unique constraint는 provider identity, handle, token digest, device/user code, owner+device key와 owner/handle latest record를 보호하며 schema DDL에서 강제된다. 읽기와 목록 API는 owner scope를 우회할 수 없다. CLI token 검증의 `lastUsedAt` touch는 submit transaction 밖에서 실행된다 — 거부된 submit도 token 사용 시도를 기록하는 기존 동작을 보존하기 위한 의도적 경계다.

위 다섯 연산은 실 Postgres에서 병렬 중복 소비 거부와 실패 주입 시 부분 commit 부재를 검증하는 test suite로 고정되어 있다(`postgres-store.test.js`, `postgres-concurrency.test.js`, `TEST_DATABASE_URL` 설정 시 실행). production `PROFILE_STORE_MODE=external`은 `NEON_DATABASE_URL`이 없거나 migration이 적용되지 않은 database에 대해 시작을 거부한다.

local file store 스냅샷은 `npm run migrate:seed`(`scripts/migrate-file-store-to-postgres.mjs`)로 Postgres에 one-shot 적재한다. dry-run은 transaction rollback으로 검증만 수행하고, 재실행은 primary-key upsert로 idempotent하며, rollback은 스냅샷에 있는 id만 제거한다. 이 도구는 이전 직후 사용을 전제로 한다.

## Public Media Contract

[`media-store-contract.js`](../src/profile-media/media-store-contract.js)는 R2 adapter가 따라야 할 수명주기를 정의한다.

- immutable revision: `cards/v1/owners/{ownerId}/revisions/{revision}.png`
- stable public object: `cards/v1/owners/{ownerId}/card.png`
- content type: `image/png`
- cache policy: `public, no-cache, must-revalidate`
- validation metadata: revision, ETag, created/published timestamp

Publish는 immutable revision을 먼저 보존한 뒤 stable object를 원자적으로 새 revision으로 전환해야 한다. 같은 revision과 같은 bytes의 재시도는 idempotent다. 같은 revision에 다른 bytes나 ETag를 쓰면 conflict다. 새 revision 저장이나 stable object 갱신이 실패하면 이전 stable card를 유지한다.

Unpublish는 stable public object만 제거한다. immutable revision retention과 삭제 주기는 별도 정책으로 관리한다. private preview는 Cloud Run에서 요청 시 render하며 R2에 저장하거나 public cache header를 적용하지 않는다.

이번 단계에는 R2 SDK, bucket credential, object write와 public route 연결이 포함되지 않는다. memory media store는 계약 검증용이며 production storage가 아니다.

## Runtime Configuration

실제 값은 Secret Manager 또는 배포 플랫폼 설정에 저장하며 저장소와 image에 포함하지 않는다.

### 현재 runtime 값

| 설정 | 분류 | 설명 |
|---|---|---|
| `PROFILE_RUNTIME_MODE=production` | server config | production validation과 secure-cookie 강제 |
| `PROFILE_STORE_MODE=external` | server config | file store production 사용 차단 |
| `CANONICAL_APP_ORIGIN` / `PUBLIC_BASE_URL` | public config | HTTPS canonical origin과 OAuth callback/card URL 기준 |
| `PORT` | platform config | Cloud Run이 주입하는 listen port |
| `HOST` | server config | 기본값 `0.0.0.0`; 일반적으로 override 불필요 |
| `GITHUB_CLIENT_ID` | public identifier | GitHub OAuth application identifier |
| `GITHUB_CLIENT_SECRET` | secret | OAuth code exchange 전용 server secret |
| `PROFILE_STATIC_ROOT` | image config | 빌드된 frontend asset 위치; 보통 image 기본값 사용 |
| `SESSION_SECURE_COOKIES` | server config | production server가 `true`로 강제 |

`PROFILE_STORE_FILE`은 local/spike 전용이다. production persistent disk나 backup 대체물로 사용하지 않는다.

### Postgres/Neon adapter 값

| 설정 | 분류 | 설명 |
|---|---|---|
| `NEON_DATABASE_URL` | secret | Postgres 연결 문자열. Neon pooled(pgbouncer) endpoint를 사용한다. pool 생성 시점에만 읽으며 config 객체·로그로 전파하지 않는다 |
| `DATABASE_URL` | secret | `NEON_DATABASE_URL` 부재 시 fallback (로컬/일반 Postgres) |
| `TEST_DATABASE_URL` | test 전용 | 설정 시 Postgres integration test가 실행되고, 없으면 skip되어 `npm test`는 어디서나 green이다 |

connection pool은 인스턴스당 소형(max 4)이고 idle 연결을 빠르게 반환한다. statement timeout은 transaction마다 `SET LOCAL`로 적용해 transaction-mode pooling에서도 유효하다. migration은 instance 부팅 시 자동 실행하지 않으며 배포 단계에서 `npm run migrate:postgres -- up`으로 명시 실행한다(advisory lock으로 동시 실행 직렬화).

R2 access key/secret과 signing credential은 server-only secret이어야 한다. R2 account/bucket 이름과 public media origin은 민감하지 않을 수 있지만 운영 설정으로 관리한다. R2 env 이름은 provider adapter issue에서 확정한다.

## Startup, Health, Cache, Rollback

1. Cloud Run process는 `0.0.0.0:$PORT`에서 시작하고 malformed canonical origin, production file store와 누락된 `NEON_DATABASE_URL`을 startup 전에 거부한다.
2. `/healthz`는 process liveness만 확인하며 Neon/R2를 변경하지 않고 credential, store path와 payload를 노출하지 않는다.
3. dependency readiness는 liveness와 분리되어 있다. runtime이 직접 생성한 Postgres store는 startup 시 `verifyReadiness()`로 연결과 migration 적용 상태를 검증하고, 미적용 migration이 있으면 실행할 명령을 안내하며 시작을 거부한다. required R2 configuration 검증은 R2 adapter task에서 같은 방식으로 추가한다.
4. public stable card는 ETag 재검증을 사용한다. immutable revision은 장기 보존할 수 있지만 stable URL은 항상 최신 published revision을 가리킨다.
5. application rollback은 이전 Cloud Run revision으로 되돌린다. DB migration은 최소 한 application rollback 구간 동안 backward compatible해야 한다.
6. R2 publish 실패 시 이전 stable object를 유지한다. unpublish 실패를 성공으로 응답하지 않는다.
7. Sites를 배포하지 못하거나 철회해도 Cloud Run `/`을 그대로 canonical landing으로 사용한다. Sites fallback 때문에 Cloud Run CORS나 cookie scope를 확대하지 않는다.

## Data Retention, Backup, PII 최소화

structured store의 기본 정책이다. 세부 보존 기간과 자동화는 Cloud Run 배포 task(#43)에서 운영 값과 함께 확정한다.

### 저장 데이터와 PII 최소화

- 저장하는 개인 식별 정보는 GitHub 공개 identity(login, display name, avatar/profile URL, provider user id)와 owner가 선택한 handle로 한정한다. usage 문서는 analyzer 계약상 identity-free다.
- raw CLI token, raw device code, GitHub OAuth access token은 저장하지 않는다. schema에 해당 컬럼이 존재하지 않으며(digest 컬럼만 존재), 실 flow가 남긴 전체 상태에 raw 값이 없음을 test로 고정했다(`postgres-concurrency.test.js`의 secret scan과 column allowlist).
- usage와 snapshot은 owner당 latest 1건만 저장한다. 시계열 히스토리를 축적하지 않는 것 자체가 1차 데이터 최소화 장치다.

### Retention 기본 정책

- expired/consumed OAuth state, expired CLI challenge, expired/revoked session과 token 행은 만료 시점 이후 인증에 사용될 수 없으나 행 자체는 남는다. 타임스탬프는 ISO-8601 UTC text로 사전순 비교가 시간순과 일치하므로, 운영 정리는 `DELETE ... WHERE expires_at < $now` 형태의 명시적 작업으로 수행한다. 자동 정리 주기는 #43에서 확정한다.
- 계정 삭제(owner 및 종속 레코드 일괄 제거)는 아직 제품 기능이 아니다. README 보안 절의 미해결 항목과 동일하게 후속 task로 관리한다.

### Backup과 복구

- migration은 최소 한 application rollback 구간 동안 backward compatible해야 한다(위 5항). `npm run migrate:postgres -- down`은 스키마 롤백 경로를 제공한다.
- database 백업/PITR은 Neon project의 기능을 사용하며 보존 기간은 #43에서 플랜과 함께 확정한다. seeding 도구의 rollback은 백업 대체물이 아니라 이전 직후의 원상 복원 수단이다.

## 검증 상태

### 로컬에서 검증됨

- Vite middleware 없는 production Node host와 built static asset 제공
- `0.0.0.0`, 임의 `PORT`, `/healthz`, API/card routing과 SIGTERM 종료
- Linux amd64 container에서 native PNG render
- production file store fail-closed와 generic startup error
- structured/file-store contract fixture와 device persistence
- Postgres schema migration up/down/재실행과 clean database bootstrap (로컬 Docker Postgres 17)
- Postgres adapter의 contract 표면, 5개 atomic operation transaction과 `FOR UPDATE` 직렬화
- 5개 연산의 병렬 중복 소비 거부와 실패 주입 시 부분 commit 부재
- raw CLI token/device code/OAuth access token 미저장(secret scan·column allowlist)과 owner scope 격리
- `PROFILE_STORE_MODE=external` production 기동: 미마이그레이션 DB 거부, 마이그레이션 DB 기동·종료
- file store 스냅샷의 Postgres seeding(dry-run/실행/idempotent 재실행/rollback)
- media revision/publish/unpublish memory contract
- external/protocol-relative OAuth redirect 거부
- explicit cross-origin API/session mutation 거부와 CORS header 부재
- sample-only Sites client/Worker/manifest build와 browser preview
- Sites artifact의 API/account/session/provider secret 및 사용자 fixture 부재
- configured Cloud Run root CTA와 query, OAuth state, 사용자 식별자 부재
- Sites 시작 전·실행 중·종료 후 Cloud Run health/API/frontend 독립 동작
- Cloud Run Home과 Sites mirror의 desktop/mobile marketing layout 비교

### 설계만 확정됨

- 실제 Cloud Run remote deploy, ingress, custom domain과 Secret Manager 연결
- 실제 Neon project 연결(원격 콜드스타트·pooled endpoint 실측)과 백업 보존 기간
- R2 bucket, immutable object write, stable object materialization과 cache invalidation
- production observability, alerting, abuse protection와 shared rate limiter
- ChatGPT Sites remote project 생성과 event/marketing publication

로컬 검증은 로컬 Docker Postgres 기준이다. 원격 Neon 배포 성공을 의미하지 않으며, R2가 도입되기 전까지 공개 card 요청이 Postgres를 직접 조회하므로 Neon scale-to-zero 재개 지연이 card 응답에 노출될 수 있다. 이 리스크는 R2 stable object 도입(#42)으로 해소된다.

## 후속 작업

1. R2 adapter, immutable revision write, stable object publish/unpublish와 failure injection test를 구현한다.
2. Cloud Run Secret Manager, custom domain, structured log/metric, shared rate limiter와 backup/retention 운영 값을 구성한다.
3. 선택적으로 Sites marketing mirror를 게시하고 Cloud Run CTA, bundle privacy와 Cloud Run-only fallback을 운영 점검한다.
