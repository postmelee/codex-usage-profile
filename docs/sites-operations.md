# Sites 운영 가이드

이 문서는 Codex Usage Profile의 canonical ChatGPT Sites 배포를 owner-only
후보에서 공개 MVP까지 운영하는 절차다. Sites Worker, D1 `DB`, native R2
`PROFILE_MEDIA`가 기본 경로이며 Cloud Run/Postgres/S3-compatible R2는
fallback이다. remote 변경은 해당 작업의 수행계획과 Gate 승인을 각각 받은
범위에서만 수행한다. production origin은
`https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`이고,
검증된 public baseline saved version 7의 HTML profile은 `/?profile={handle}`, stable
README card는 `/u/{handle}/card.png`를 사용한다. 현재는 Gate B blocker 복원 뒤
saved version 16의 custom owner-only 상태다. owner-only version 15에서 root query는
Worker 전에 정적 `index.html`로 처리됨을 확인했다. 다음 후보의 canonical
share/OG 문서는 Worker 전달이 확인된 `/api/share/{handle}`을 사용하고 social
preview는 정합한 `/u/{handle}/social.png` 또는 packaged
`/assets/codex-social-sample.png`다.
동적 metadata와 social image 후보는 owner-only와 public smoke가 완료되기
전까지 production 기능으로 안내하지 않는다. extension 없는 `/u/{handle}`은
public Gate에서도 `/`로 `307` 전환된 경로이므로 Sites share URL로 사용하지 않는다.

## 현재 production baseline

| 항목 | 값 |
|---|---|
| Site | `Codex Usage Profile` |
| saved version/source | 16 / `bbc0e0e6686a0b0b5c5ddc6dfb3c91ec5eaa5377` |
| access | custom owner-only revision 49, owner 1명, 추가 user/group 0명 |
| environment | revision 77 |
| service | `normal` |
| maintenance | `disabled` |
| maintenance operator secret | absent |
| disposable QA state | owner/session/token/D1/R2/local credential 없음 |

원복 access는 직전 custom owner-only policy다. owner 1명만 허용하고 추가
user, workspace group과 tenant group은 0개로 둔다. application rollback은
version 7 이전의 saved version을 명시적으로 선택하되, data/schema rollback은
별도 digest/count 승인 없이 수행하지 않는다.

Sites는 현재 public beta이며 eligible ChatGPT plan에 포함된다. plan별 usage
limit은 모든 Site에 적용되고 ChatGPT가 한도 접근을 알린다. 한도 도달 시 새
Site 생성, storage 추가 또는 high-usage Site의 public 유지가 제한될 수 있다.
고정 수치나 장기 가격은 보장하지 않으며, [Sites 문서](https://learn.chatgpt.com/docs/sites)와
[가격 FAQ](https://learn.chatgpt.com/docs/pricing#how-much-does-sites-cost)를
운영 시점마다 다시 확인한다.

## 운영 불변식

- 검증된 commit을 source로 push하고 같은 commit에서 만든 `dist/`만 saved
  version으로 저장한다. production deployment는 saved version만 사용한다.
- `.openai/hosting.json`의 기존 project와 `DB`/`PROFILE_MEDIA` linkage를
  재사용한다. 새 Site나 storage를 임의로 만들지 않는다.
- GitHub client secret과 maintenance token은 Sites environment secret으로만
  보관한다. source, archive, URL, 로그와 보고서에 값을 복제하지 않는다.
- access policy 변경은 deployment와 별도다. staging/candidate 검증은
  owner-only를 사용한다. production public access를 닫을 때는 직전 owner-only
  custom policy의 owner 1명, 추가 user/group 0개를 그대로 복원한다.
- 추가 plan, 결제수단 또는 자동 초과 과금이 필요하면 공개와 신규 submit을
  중단한다. 자동 유료 전환은 허용하지 않는다.

## Runtime 설정

| Key | 기본값·범위 | 의미 |
|---|---|---|
| `GITHUB_CLIENT_ID` | production OAuth app identifier | 공개 식별자 |
| `GITHUB_CLIENT_SECRET` | secret | server-side OAuth exchange |
| `PROFILE_MAINTENANCE_MODE` | disabled, exact `enabled`만 활성 | 숨겨진 operator route gate |
| `PROFILE_MAINTENANCE_TOKEN` | 필요할 때만 임시 secret, safe baseline은 absent | operator route 인증 |
| `PROFILE_SERVICE_MODE` | `normal` | `normal`, `maintenance`, `owner-only`, `quota-stop`; 알 수 없는 값은 `maintenance` |
| `PROFILE_STOP_RETRY_AFTER_SECONDS` | 300, 1~86400 | maintenance/quota stop 재시도 지연 |
| `PROFILE_ACCOUNT_USAGE_BURST_LIMIT` | 5, 1~1000 | D1 shared burst count |
| `PROFILE_ACCOUNT_USAGE_BURST_WINDOW_MS` | 10000, 1000~3600000 | burst window |
| `PROFILE_ACCOUNT_USAGE_SUSTAINED_LIMIT` | 30, 1~1000 | D1 shared sustained count |
| `PROFILE_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS` | 60000, 1000~3600000 | sustained window |

rate-limit 값이 없거나 정수·범위를 벗어나면 승인된 기본값을 사용한다. sustained
limit/window가 burst보다 작아지는 조합도 전체 기본값으로 닫힌다. counter는
D1 row의 atomic window update만 사용하며 process memory fallback이나 bypass는
없다.

## Health, 응답과 관찰

`GET|HEAD /healthz`는 Worker와 required binding 준비 상태만
`ok|unavailable`로 반환한다. binding 이름·metadata·payload는 반환하지 않는다.
binding 또는 설정이 준비되지 않으면 `503`과 `Retry-After: 5`다.

| 상태 | 영향 범위 | 공개 응답 |
|---|---|---|
| normal rate limit | Account Usage submit | `429 rate_limited`, window 종료까지 `Retry-After` |
| `quota-stop` | Account Usage submit | `429 sites_quota_stop`, 설정된 `Retry-After` |
| `owner-only` runtime stop | public profile/card read | 존재 여부를 숨기는 `404` |
| owner-only access policy | Site 전체 anonymous 접근 | platform auth gate |
| `maintenance` | maintenance route 외 backend | `503 sites_maintenance`, 설정된 `Retry-After` |
| D1/R2/asset provider unavailable | 해당 backend/asset | generic `503`, 기본 `Retry-After: 5` |
| operator route disabled/인증 실패 | maintenance route | generic `404` |

Worker request event는 `requestId`, `routeClass`, `method`, `status`,
`durationBucket`, `errorCode`, `retryable` 일곱 필드만 기록한다. URL/query,
cookie, Authorization, OAuth code/state, session/token/device code, owner,
usage/card bytes와 exception 원문은 기록하지 않는다. 응답의 `x-request-id`로
사용자 오류와 같은 event를 연결한다.
`card.png`와 `social.png`는 모두 raw handle을 남기지 않는 `public_card`로
축약한다.

## Owner-only candidate 배포

1. Site project, URL/slug, title, access, saved version/deployment와 environment
   key 존재 여부를 read-only로 확인한다. secret plaintext는 읽거나 출력하지
   않는다.
2. `npm run build:production`, `npm run verify:sites-fullstack`,
   `npm run verify:sites-production`을 같은 clean commit에서 실행한다.
3. Sites packaging helper로 `dist/`, hosting metadata와 migration을 하나의
   archive로 만든다. source push commit과 archive commit이 같음을 확인한다.
   현재 `devel`의 Task #74·#78 누적 candidate는 D1 migration `1..5`와
   `0004_card_style.sql`, `0005_card_locale.sql`이 누락·중복 없이 manifest
   순서로 포함돼야 한다.
4. temporary `PROFILE_MAINTENANCE_MODE=enabled`와 새 operator secret을
   environment에 설정하고, saved version을 한 번 만들어 private deployment
   operation으로 배포한다. non-terminal 상태는 같은 version/deployment id를
   끝까지 조회한다.
5. owner-only access가 유지된 상태에서 protected migration을 실행한 뒤
   read-only readiness로 exact 결과를 확인한다. `migrate`는 manifest에 포함된
   pending migration만 적용하며 owner selector나 SQL을 입력으로 받지 않는다.

   ```bash
   npm run sites:profile-maintenance -- migrate \
     --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
   npm run sites:profile-maintenance -- readiness \
     --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
   ```

   migrate 응답은 `appliedVersions`, `newlyAppliedVersions`, `operation=migrate`
   외 필드를 포함하지 않아야 한다. readiness 응답은 `operation=readiness`,
   `ready=true`이고 `expectedVersions`와
   `appliedVersions`가 순서까지 정확히 같아야 한다. owner/usage/token/session,
   SQL/provider message와 R2 metadata가 포함되면 통과로 취급하지 않는다.
   Sites가 package migration의 physical schema를 먼저 적용하고 application
   `schema_migrations` metadata를 남기지 않은 경우, migration 1·2의 모든
   explicit table/index DDL과 migration 3~5의 additive column contract가
   candidate와 exact-match할 때만 metadata-only로 reconcile한다. 일부 object만
   있거나 drift가 있으면 mutation 전 `maintenance_conflict`로 중단한다.
   `schema_migrations` table이 아직 없거나 expected version이 누락된 상태는
   `migration_not_ready`로 중단한다. 실제 D1/provider 장애는 inspection,
   reconciliation, apply, verification 또는 exact manifest version의 bounded
   code만 반환하고 SQL/provider 원문을 노출하지 않는다.
6. readiness 성공 직후 `PROFILE_MAINTENANCE_MODE=disabled`로 바꾸고 operator
   secret을 제거한 environment를 같은 source saved version에 적용한다.
   owner-only access를 유지하면서 operator route가 generic `404`, `/healthz`가
   `200`인지 확인한다. 이 전환이나 확인이 실패하면 다음 단계로 진행하지
   않는다.
7. maintenance가 닫힌 candidate에서 OAuth/session/logout, packed CLI,
   private preview, 카드 dark/light·en/ko 저장, 네 README PNG의 GET/HEAD/304,
   query 없는 dark 호환, publish/unpublish/ETag/404를 검증한다. 이어서 crawler
   User-Agent로 `/api/share/{handle}` HTML의 canonical·`og:url`·`og:image`와
   Twitter Card metadata를 확인하고, 정합 publication의
   `/u/{handle}/social.png` GET/HEAD/If-None-Match 304와 2400x1260 응답을
   검증한다. 이어서 legacy social-missing fixture에서 personalized route 404와
   HTML의 `/assets/codex-social-sample.png` 선언, fallback asset GET/HEAD 200을
   함께 확인한다. private·missing handle은 동일한 기본 OG/unavailable HTML과
   packaged sample로 닫히고 README/social PNG는 같은 404여야 한다.
8. error event를 확인한 뒤 profile private와 test token/session revoked
   baseline을 복원한다.

배포, readiness, maintenance 비활성화 또는 기능 smoke 중 하나라도 실패하거나
expected/applied에 missing 또는 unexpected version이 있으면 기능 smoke,
데이터 작업과 public 전환을 수행하지 않는다. 이전 saved version과 owner-only
policy를 유지하고 environment를 disabled/secret-absent baseline 또는 직전 key
set으로 되돌린 뒤 operator route `404`와 같은 health를 확인한다. provider
오류의 원문을 출력하거나 원격 D1을 임의 수정해 통과시키지 않는다.

## Environment와 OAuth rotation

1. exact production callback은 canonical origin의
   `/api/auth/github/callback`으로 고정한다.
2. production OAuth app의 homepage/callback을 먼저 준비하되 secret 값은
   repository 밖에서만 전달한다.
3. Sites environment에서 client id와 secret을 같은 승인 범위로 교체한다.
   maintenance token은 별도 secret으로 회전한다.
4. environment revision이 적용된 같은 saved version을 owner-only로
   재배포한다.
5. 새 browser login/callback/session/logout을 통과한 뒤 이전 OAuth secret과
   maintenance token을 폐기한다. 실패하면 이전 app/key set으로 원복한다.

## Export, restore와 account deletion

항상 `plan -> export -> exact digest/count 확인 -> apply -> 재검증` 순서다.
backup은 repository 밖의 사용자 지정 위치에 `0600`으로 저장하고, 보고에는
contract/schema version, digest와 count만 남긴다.

- export는 owner identity, latest usage/snapshot, visibility, canonical
  `cardStyle`, `cardLocale`, `presentationDigest`와 publication metadata만
  포함한다. OAuth state, session, challenge, token digest와
  rate-limit row는 포함하지 않는다.
- restore는 disposable target에서 먼저 수행하고 export와 같은 digest/count를
  확인한다. 인증 상태는 복구하지 않으므로 다시 로그인해야 한다.
- account deletion은 dark authority를 먼저 tombstone으로 확인한 뒤 light stable과
  theme·locale별 revision plan, D1 owner-dependent plan이 일치할 때만 apply한다.
- partial failure나 stale ETag/digest/count에서는 다음 mutation을 중단한다.
  같은 backup으로 일관성을 복구하거나 `repair-publication`을 exact ETag
  조건으로 수행한다.

operator CLI는 `npm run sites:profile-maintenance -- <command>`를 사용하며
mutation에는 `--apply`, exact owner id/handle, digest/count 확인이 모두
필요하다. token은 `PROFILE_MAINTENANCE_TOKEN` environment에서만 읽는다.

## Retention

expired OAuth state, CLI challenge, session과 revoked/expired token은 plan에서
count를 확인한 뒤 정리한다. public stable object와 tombstone은 retention
cleanup 대상이 아니다. dark authority가 참조하는 light stable과 immutable key,
owner+theme+locale별 최근 5개와 90일 이내 key를 보호한다. authority 없는 light
stable은 orphan candidate가 될 수 있다.

개인 MVP에서는 매월 90일 dry-run을 수행하고 자동 schedule은 두지 않는다.

```bash
npm run sites:profile-maintenance -- retention \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site \
  --retention-days 90
```

apply는 repository 밖 backup, latest digest/count와 삭제 후보 승인을 확인한
뒤에만 실행한다. 실제 사용자 데이터 backup의 보존·폐기는 해당 account
deletion Gate에서 별도로 승인한다. disposable QA 데이터의 검증 backup은
exact restore/delete와 final digest/count를 확인하고 영구 삭제가 승인된
경우에만 즉시 폐기할 수 있다. backup path와 payload는 command 기록, 문서
또는 log에 남기지 않는다.

`npm run cleanup:card-media`는 기본 dry-run이다. apply 전에 R2 export/restore
가능성과 최신 stable 참조를 다시 확인한다. 삭제된 R2 object는 이 도구로
복구할 수 없으므로 backup 없이 apply하지 않는다.

## Public smoke, production cutover와 원복

Gate B smoke 또는 Gate C cutover의 승인된 시간과 범위에서만 public access를
연다.

1. owner-only health, saved version, OAuth callback, quota/추가 과금 표시와
   원복할 exact custom access policy를 다시 확인한다. 같은 saved version과
   environment 후보의 protected readiness exact-match 성공 기록이 없으면
   public 전환을 시작하지 않는다. readiness 뒤 maintenance를
   disabled/secret-absent로 복원하고 operator route `404`를 확인한 기록도
   필수다.
2. test profile은 private, test token/session은 새 일회성 값으로 준비한다.
3. public access로 전환하고 anonymous landing, private API 401/403, private
   profile/card의 query 없음·theme·locale 조합 404, OAuth/CLI/submit, publish 뒤
   query 없는 dark와 dark/light × en/ko 네 README PNG의 `GET|HEAD|304`, 설정 저장
   뒤 `selectedPublicCardUrl` 전환을 확인한다. 이어서 `/api/share/{handle}` HTML의
   canonical/OG/Twitter metadata와 locale 문구, `/u/{handle}/social.png`의
   `GET|HEAD|304`·2400x1260을 확인한다. 기존 public publication처럼 social object가
   없으면 personalized route 404와 HTML의 packaged sample URL·asset 200을 함께
   확인한다. private 및 missing 상태에서 HTML이 같은 기본 metadata/unavailable
   화면과 packaged sample로 닫히고 social PNG가 같은 404인지 검증한 뒤 unpublish
   후 모든 README/social PNG 조합 404를 확인한다.
4. Gate B는 즉시 custom owner-only로 원복하고 anonymous platform auth gate,
   owner-only allowlist, token/session revoke와 public card 404를 재확인한다.
   Gate C는 정상 결과일 때 public access를 유지하고, 실패나 stop trigger가
   하나라도 있으면 같은 원복 절차를 먼저 수행한다.
5. recent error event를 확인해 query/credential/identity/usage bytes가 없음을
   검증한다.

중간 실패도 같은 원복 절차를 먼저 수행한다. public 상태에서 원인 분석을
계속하지 않는다. 현재 saved version 7 baseline의 공개 화면은
`/?profile={handle}`을 사용하지만 owner-only version 15에서 root query initial
HTML이 정적 asset으로 처리됨을 확인했다. 다음 후보는 `/api/share/{handle}`에서
handle별 canonical/OG/Twitter metadata와 같은 SPA 공개 화면을 제공한다. root
query와 extension 없는 `/u/{handle}`은 source 하위 호환으로만 유지하며
production share link로 안내하지 않는다.

## 로그와 quota stop

로그 조회는 smoke 시간대와 `x-request-id`로 좁힌다. route class별 429/503,
retryable 비율과 duration bucket만 집계한다. raw request/response나 provider
exception을 추가로 출력하지 않는다.

다음 조건이면 `PROFILE_SERVICE_MODE=quota-stop`으로 신규 submit을 먼저
중단하고, 필요하면 `owner-only` access 또는 `maintenance`로 전환한다.

- Sites/D1/R2 plan upgrade, 결제수단 또는 자동 초과 과금이 요구된다.
- quota 부족으로 OAuth, submit, preview 또는 stable card 계약을 유지하지
  못한다.
- 반복 provider failure에서 generic 404/429/503과 export/restore를 보장하지
  못한다.
- 예상하지 못한 anonymous traffic 또는 abuse로 개인 프로젝트 운영 한도를
  넘는다.

## Rollback과 Cloud Run fallback 평가

일반 candidate와 public cutover의 protected readiness는 missing뿐 아니라
unexpected migration version도 계속 거부한다. 신규 후보가 알지 못하는 schema를
자동 승인하지 않기 위한 배포 certification gate이며 CLI에 우회 옵션을 두지
않는다.

application rollback은 이전 saved version을 재배포한다. 이미 적용된 더 높은
migration version을 이전 saved version의 store가 허용하더라도 exact candidate
gate를 통과한 것으로 간주하지 않는다. 긴급 rollback이 필요하면 다음 조건을
별도 Gate에서 검토하고 작업지시자 승인을 받은 경우에만 known-compatible saved
version을 선택한다.

- 이전 application이 요구하는 migration version이 모두 적용돼 있다.
- 추가된 migration이 이전 application의 read/write 계약과 backward-compatible
  하다는 source/migration 검토 증적이 있다.
- owner-only health, backup 가능성, 원복할 exact saved version/access policy가
  확인됐다.
- 자동 readiness 우회가 아니라 승인 기록에 unexpected version과 호환성 근거가
  남는다.

schema/data rollback은 먼저 승인된 D1/R2 backup 복구 가능성을 검증하고,
backward-compatible migration 구간을 벗어나면 자동으로 진행하지 않는다.
Task #74의 `card_style`과 `card_locale`은 default가 있는 additive column이며 기존
query 없는 dark stable key를 보존한다. 따라서 이전 saved version application
rollback 후보는 새 column과 light object를 무시할 수 있지만, readiness의
unexpected version 우회와 실제 rollback 실행은 여전히 별도 Gate 승인 사항이다.

Cloud Run fallback은 다음 순서로 평가하며 별도 승인 전에는 provider resource를
만들지 않는다.

1. owner-only/maintenance 상태에서 Sites 장애와 quota/가격 조건을 기록한다.
2. `npm run build:cloud-run`, Postgres migration test, S3-compatible media test와
   `npm run smoke:hosting-matrix`로 기존 artifact 회귀를 확인한다.
3. 필요한 Cloud Run, Postgres/Neon, R2/S3 plan과 증분 비용을 다시 산정한다.
4. exact origin/OAuth callback, data export/import, cookie/CORS, rollback과 비용
   stop을 별도 수행계획서와 승인 Gate로 정한다.
5. fallback이 검증되기 전까지 Sites data를 삭제하거나 public origin을
   전환하지 않는다.
