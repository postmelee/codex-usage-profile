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

[`store-contract.js`](../src/profile-backend/store-contract.js)는 provider 중립 structured-store 표면과 production adapter의 원자성 요구를 정의한다. 현재 memory/file store는 이 표면의 contract fixture다. file store는 local 개발과 spike에서만 사용하며 Cloud Run 다중 인스턴스 production store가 아니다.

Neon adapter는 다음 연산을 DB transaction 또는 동등한 compare-and-swap으로 구현해야 한다.

| 연산 | 직렬화 키 | 필수 결과 |
|---|---|---|
| OAuth callback 완료 | `oauthState.id` | pending state를 정확히 한 요청만 소비하고 owner/session/state를 함께 commit |
| CLI login 승인 | `cliLoginChallenge.id` | pending·미만료 challenge만 한 번 승인 |
| CLI login 교환 | `cliLoginChallenge.id` | approved challenge마다 token digest를 정확히 하나 발급 |
| Account Usage submit | `owner.id` | `capturedAt`과 `contentDigest`로 stale/conflict/idempotent/new를 원자적으로 판정하고 device touch와 함께 commit |
| visibility 변경 | `owner.id` | owner와 latest usage/snapshot이 같은 공개 상태를 노출 |

부분 commit은 허용하지 않는다. unique constraint는 provider identity, handle, token digest, device/user code, owner+device key와 owner/handle latest record를 보호해야 한다. 읽기와 목록 API는 owner scope를 우회할 수 없어야 한다.

현재 서비스 write path는 동기식 file-store API를 사용한다. 따라서 이 문서와 contract test만으로 Neon multi-instance 안전성이 구현되었다고 간주하지 않는다. 실제 Neon schema, async adapter, transaction wiring과 migration이 완료될 때까지 production `PROFILE_STORE_MODE=external`은 전용 adapter 주입 없이는 시작하지 않아야 한다.

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

### 후속 adapter 값

Neon 연결 문자열, R2 access key/secret과 signing credential은 server-only secret이어야 한다. Neon project/branch id, R2 account/bucket 이름과 public media origin은 민감하지 않을 수 있지만 운영 설정으로 관리한다. 정확한 env 이름은 provider adapter issue에서 확정하며, 이름을 확정하기 전에 임시 credential을 image 또는 Sites bundle에 넣지 않는다.

## Startup, Health, Cache, Rollback

1. Cloud Run process는 `0.0.0.0:$PORT`에서 시작하고 malformed canonical origin, production file store와 누락된 external adapter를 startup 전에 거부한다.
2. `/healthz`는 process liveness만 확인하며 Neon/R2를 변경하지 않고 credential, store path와 payload를 노출하지 않는다.
3. production readiness를 선언하기 전 Neon migration/connection과 required R2 configuration을 별도 startup check로 검증해야 한다. 일시적인 provider 장애로 모든 instance가 동시에 재시작하지 않도록 liveness와 dependency readiness를 구분한다.
4. public stable card는 ETag 재검증을 사용한다. immutable revision은 장기 보존할 수 있지만 stable URL은 항상 최신 published revision을 가리킨다.
5. application rollback은 이전 Cloud Run revision으로 되돌린다. DB migration은 최소 한 application rollback 구간 동안 backward compatible해야 한다.
6. R2 publish 실패 시 이전 stable object를 유지한다. unpublish 실패를 성공으로 응답하지 않는다.
7. Sites를 배포하지 못하거나 철회해도 Cloud Run `/`을 그대로 canonical landing으로 사용한다. Sites fallback 때문에 Cloud Run CORS나 cookie scope를 확대하지 않는다.

## 검증 상태

### 로컬에서 검증됨

- Vite middleware 없는 production Node host와 built static asset 제공
- `0.0.0.0`, 임의 `PORT`, `/healthz`, API/card routing과 SIGTERM 종료
- Linux amd64 container에서 native PNG render
- production file store fail-closed와 generic startup error
- structured/file-store contract fixture와 device persistence
- media revision/publish/unpublish memory contract
- external/protocol-relative OAuth redirect 거부
- explicit cross-origin API/session mutation 거부와 CORS header 부재

### 설계만 확정됨

- 실제 Cloud Run remote deploy, ingress, custom domain과 Secret Manager 연결
- Neon schema, transaction, multi-instance concurrency, migration/backup/retention
- R2 bucket, immutable object write, stable object materialization과 cache invalidation
- production observability, alerting, abuse protection와 shared rate limiter
- ChatGPT Sites hosting plugin을 사용한 event/marketing publication

## 후속 작업

1. Neon schema와 async repository adapter를 만들고 contract의 다섯 atomic operation을 transaction test로 검증한다.
2. local file data를 Neon으로 이전하는 one-shot migration과 rollback 검증을 추가한다.
3. R2 adapter, immutable revision write, stable object publish/unpublish와 failure injection test를 구현한다.
4. Cloud Run Secret Manager, custom domain, structured log/metric, shared rate limiter, backup와 retention 정책을 구성한다.
5. 선택적으로 Sites marketing mirror를 게시하고 Cloud Run CTA, bundle privacy와 Cloud Run-only fallback을 운영 점검한다.
