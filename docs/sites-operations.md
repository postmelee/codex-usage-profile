# Sites 운영 가이드

이 문서는 Codex Usage Profile을 local에서 stage5 owner-only 검증을 거쳐 공개
production으로 승격하는 표준 절차와 원복 경계를 기록한다. Sites Worker, D1 `DB`,
native R2 `PROFILE_MEDIA`가 기본 경로이며 Cloud Run/Postgres/S3-compatible R2는
fallback이다. remote 변경은 해당 작업의 수행계획과 Gate 승인을 각각 받은 범위에서만
수행한다.

2026-09-02 최종 audit 기준 canonical production은 public saved version 6/source
`6d3e600d2d33bb7a50147075d013ddd9b945d0b1`, access revision 10, environment revision
14다. stage5는 같은 exact source의 saved version 40, custom owner-only access revision
62, environment revision 131인 테스트 전용 Site다. 두 Site 모두 D1 migration
`[1,2,3,4,5,6]`을 사용하지만 project·D1·R2·OAuth·secret·session/token state는
공유하지 않는다.

Task #84 Gate C는 기존 stage5의 exact-main saved version 24를 public으로 전환했고,
이후 #101이 revision share 계약을 saved version 33에서 검증했다. Task #108은 새
canonical production을 별도 project와 durable resource로 공개하고, stage5를
owner-only saved version 36으로 전환했다. Task #144는 #137·#141·#39·#146을 포함한
exact main을 stage5 version 40에서 검증한 뒤 production version 6으로 공개했다. version 24와
33은 과거 release·validation 증적이며 현재 live 기준은 아래 표다.

owner-only version 15에서 root query는 Worker 전에 정적 `index.html`로 처리됐고,
extension 없는 `/u/{handle}`은 public Gate에서도 `/`로 `307` 전환됐다. 따라서
두 경로는 Sites share URL로 사용하지 않는다. 공개 문서는 Worker 전달과 public
smoke가 확인된 `/api/share/{handle}`만 사용한다.

## 현재 production·stage5 기준과 이력

| 항목 | 값 |
|---|---|
| Site | `Codex Usage Profile` production |
| live origin | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` |
| 역할 | canonical public production |
| saved version/source | 6 / `6d3e600d2d33bb7a50147075d013ddd9b945d0b1` |
| artifact | 30 files, 10,926,080 bytes, `sha256:6f905edbff7b7b5ea49a84c5f05bd6843319a59bda4fd47b44d0cabfdbfa53f4` |
| access | public revision 10 |
| environment | revision 14, production 전용 OAuth/secret과 D1/R2 binding |
| service | `normal` |
| maintenance | `disabled` |
| maintenance operator secret | absent |
| health/operator | `/healthz` `200`, 닫힌 operator route `404` |
| D1 readiness | migration `[1,2,3,4,5,6]` exact |
| CLI | public `latest=0.1.4`, production default origin |
| production data | 실제 운영 계정·session·token·media로 취급; stage5와 공유하지 않음 |

위 표는 desired state가 아니라 Task #144 Stage 5 종료 뒤 원격에서 다시 관찰한 live
상태다. production의 maintenance operator secret은 제거됐으므로 protected readiness는
배포 창에서만 임시 자격 증명으로 실행한다. 안전 종료 상태는 Sites의 read-only D1 audit,
`/healthz` `200`, 닫힌 operator route `404`로 확인한다.

| 시점 | saved version/source | access | environment | 의미 |
|---|---|---|---|---|
| Task #84 Gate C | 24 / `0c804733e41988467ecd7fbd8e6a152cbfc2fad0` | public revision 57 | revision 87 | exact-main production 공개 전환의 역사적 기준 |
| Task #101 validation | 33 / `53a7132630dcb6f43459880d79730e10e2b59d6e` | public revision 59 | revision 89 | revision share provider 검증 기준 |
| Task #84 Stage 5 | version 33 유지 | revision 59 유지 | revision 89 유지 | read-only 종료 audit, remote mutation 0건 |
| Task #108 Stage 5 | 36 / `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd` | custom owner-only revision 62 | revision 119 | 테스트 전용 exact-main 기준 |
| Task #137 production | 5 / `27e8705fdc152534a4e4b726cac32f625a3c7763` | public revision 10 | revision 8 | #137 release 종료 시점 기준 |
| Task #144 직전 production | version 5 유지 | public revision 10 유지 | revision 12 | Stage 3·4가 remote mutation 전에 관찰한 application rollback 기준 |
| Task #144 Stage 3 | 40 / `6d3e600d2d33bb7a50147075d013ddd9b945d0b1` | custom owner-only revision 62 | revision 131 | 현재 테스트 전용 exact-main 기준 |
| Task #144 Stage 5 | 6 / `6d3e600d2d33bb7a50147075d013ddd9b945d0b1` | public revision 10 | revision 14 | 현재 canonical production 기준 |

| 현재 target | origin | access/version | 역할 |
|---|---|---|---|
| production | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` | public revision 10 / version 6 | canonical production |
| stage5 | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | custom owner-only revision 62 / version 40 | synthetic fixture 전용 test |

stage5의 현재 application rollback 후보는 version 39/source
`0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`이며, 실제 재배포·access 변경과
data/schema rollback은 별도 승인 없이 수행하지 않는다. Site description에 남은
owner-only nonproduction 문구는 역사적 metadata이며 live access 판정에는 사용하지
않는다. stage5 D1에는 Task #122에서 진행한 테스트 operation 하나가 `structured`
phase·lease expired 상태로 남아 있으며 production blocker가 아니다. credential 전달과
live recovery는 [#125](https://github.com/postmelee/codex-usage-profile/issues/125)에서만
진행하고, release 승격이나 일반 retention으로 삭제하지 않는다.

Sites는 현재 public beta이며 eligible ChatGPT plan에 포함된다. plan별 usage
limit은 모든 Site에 적용되고 ChatGPT가 한도 접근을 알린다. 한도 도달 시 새
Site 생성, storage 추가 또는 high-usage Site의 public 유지가 제한될 수 있다.
고정 수치나 장기 가격은 보장하지 않으며, [Sites 문서](https://learn.chatgpt.com/docs/sites)와
[가격 FAQ](https://learn.chatgpt.com/docs/pricing#how-much-does-sites-cost)를
운영 시점마다 다시 확인한다.

## dual-Site target과 packaging

- `.openai/hosting.json`은 production project와 logical `DB`·`PROFILE_MEDIA`만 가리키는
  canonical manifest다.
- `.openai/hosting-targets.json`은 production·stage5의 nonsecret project/origin/binding
  registry다. credential과 environment 값은 기록하지 않는다.
- `scripts/materialize-sites-target.mjs`는 ignored `dist/`를 삭제하고 clean exact commit에서
  production build를 다시 만든다. repository 밖 임시 packaging root에 선택한 target
  manifest를 넣어 공식 Sites `package-site.sh`를 호출하며 archive path의 symlink를 포함한
  real path도 repository 밖이어야 한다.
- production/stage5 project 또는 origin이 같거나 canonical manifest가 production registry와
  다르면 packaging을 시작하지 않는다. `--expected-project-id`는 packaging 직전 live
  read-only Site preflight에서 얻은 값이어야 하며 registry/manifest와 다르면 중단한다.
  생성된 archive는 안전한 임시 경로에 다시 풀어 exact project/binding/migration과
  credential·절대 경로 검사를 반복한다.

```bash
npm run package:sites-target -- \
  --target production \
  --expected-project-id {live_preflight_project_id} \
  --source-sha {exact_clean_commit} \
  --archive /absolute/external/path/production.tar.gz \
  --package-helper /absolute/path/to/sites/scripts/package-site.sh
```

stage5 후보는 같은 명령에서 `--target stage5`와 live stage5 project id를 사용한다.
canonical manifest를 stage5 값으로 수정하거나 archive를 repository 안에 만들지 않는다.
실패한 실행이 이번에 만든 partial archive는 자동 정리되며, 이미 존재하던 archive는
덮어쓰거나 삭제하지 않는다. Stage 2에서는 guard와 test만 검증하며 source
push·save/deploy는 하지 않는다.

## 운영 불변식

- 검증된 commit을 source로 push하고 같은 commit에서 만든 `dist/`만 saved
  version으로 저장한다. production deployment는 saved version만 사용한다.
- `.openai/hosting.json`의 canonical production project와 `DB`/`PROFILE_MEDIA` linkage만
  production에 사용한다. stage5는 target materializer를 통해서만 선택한다. 승인된 Gate 밖에서
  새 Site나 storage를 만들지 않는다.
- v4 dark authority의 additive `canonicalTheme`·`canonicalLocale` pair가 queryless
  README image의 대표 설정이다. 둘 다 없는 legacy authority만 dark/en으로 읽고
  partial/invalid metadata는 공개 응답을 fail-close한다.
- 공개 설정 변경은 immutable revision을 prepare한 뒤 owner CAS가 성공한 경우에만
  최신 owner/usage version을 확인하고 card/social authority를 commit한다. DB 성공
  뒤 media 실패는 같은 설정 PATCH의 exact retry로 수렴시킨다.
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

## 표준 Local → stage5 → production 승격

아래 순서는 다음 release task가 재사용하는 최소 Gate다. source 저장, deployment,
access policy, environment, migration과 data disposal은 서로 다른 원격 변경이며 하나의
승인으로 묶지 않는다.

1. **Local certification** — clean exact commit에서 `npm ci`, 전체 unit/E2E,
   production build, Sites full-stack/production verifier, npm release verifier와 public
   scan을 통과시킨다. production과 stage5 registry/project가 겹치거나 archive source가
   clean commit과 다르면 중단한다.
2. **Stage5 save·owner-only deploy** — live project id를 read-only preflight하고
   target materializer로 repository 밖 archive를 만든다. 새 saved version을 만든 뒤
   custom owner-only access를 유지한 채 배포한다. stage5 전용 environment에서만 임시
   maintenance token을 설정해 migration/readiness를 실행하고 즉시 disabled·secret-absent로
   복원한다.
3. **Stage5 smoke** — explicit `--server` CLI, OAuth/session/logout, private preview,
   publish/unpublish, fixed README와 revision share를 synthetic 계정으로 검증한다. crawler
   실측이 필요할 때만 별도 승인으로 exact owner-only policy를 기록하고 일시 public으로
   연 뒤 작성 화면까지만 확인하고 즉시 같은 policy로 복원한다.
4. **Production save·private release Gate** — stage5에서 검증한 같은 source commit과
   migration manifest로 production archive와 saved version을 만든다. 신규 production
   cutover는 owner-only에서 검증한다. 이미 public인 production의 patch release는 access를
   임의 변경하지 않고 temporary application maintenance로 mutation을 닫은 뒤 배포·migration을
   완료한다. maintenance-on deployment가 terminal success여도 아래 owner-only 절차와 같은
   asset/route convergence Gate를 통과하기 전에는 migration을 보내지 않는다.
5. **Production public Gate** — maintenance disabled, operator secret absent,
   `/healthz` `200`, operator route `404`, exact migration과 error event를 확인한다. 별도
   public 승인 뒤에만 access를 열거나 유지하고, default-origin `@latest` CLI와 canonical
   OAuth/profile/card/share flow를 비파괴 smoke한다.
6. **Handoff** — source/version/access/environment, migration, npm provenance, 테스트
   credential revoke와 rollback 후보를 기록한다. stage5 synthetic data disposal도
   `plan -> export -> 승인 -> apply -> 재검증`을 따르며, active·terminal deletion
   operation은 일반 release에서 건드리지 않고 #125 같은 별도 recovery task로 넘긴다.

각 remote 단계 전에는 아래 표의 stop/rollback 경계를 사용한다.

| 변경 | 실패 시 기본 동작 |
|---|---|
| archive/save | 배포하지 않고 새 partial archive만 정리; 기존 saved version은 유지 |
| application deployment | migration 호환성과 active deletion operation을 확인한 뒤에만 이전 검증 version 재배포 |
| migration | maintenance를 유지하고 임의 SQL/metadata 보정 없이 exact drift를 보고 |
| environment | 직전 key set 또는 disabled·secret-absent safe baseline으로 복원 |
| access | 미리 기록한 exact owner-only custom policy 또는 직전 public policy로 별도 원복 |
| data/media disposal | 즉시 중단; backup·digest/count·persistent operation을 확인한 뒤 같은 operation만 재개 |

production과 stage5의 D1/R2/OAuth/secret/session/token은 서로 복사하지 않는다. source,
artifact contract, migration, logical binding 이름과 검증 절차만 승격한다.

## Owner-only candidate 배포

1. Site project, URL/slug, title, access, saved version/deployment와 environment
   key 존재 여부를 read-only로 확인한다. secret plaintext는 읽거나 출력하지
   않는다.
2. `npm run build:production`, `npm run verify:sites-fullstack`,
   `npm run verify:sites-production`을 같은 clean commit에서 실행한다. target archive는
   위 materializer가 기존 `dist/`를 제거하고 같은 commit에서 다시 build한 결과만 사용한다.
3. Sites packaging helper로 `dist/`, hosting metadata와 migration을 하나의
   archive로 만든다. source push commit과 archive commit이 같음을 확인한다.
   현재 release candidate는 D1 migration `1..6`과
   `0004_card_style.sql`, `0005_card_locale.sql`,
   `0006_account_deletion_operations.sql`이 누락·중복 없이 manifest 순서로
   포함돼야 한다.
4. temporary `PROFILE_MAINTENANCE_MODE=enabled`와 새 operator secret을
   environment에 설정하고, saved version을 한 번 만들어 private deployment
   operation으로 배포한다. non-terminal 상태는 같은 version/deployment id를
   끝까지 조회한다.
   terminal `succeeded`는 public edge의 새 Worker/client 수렴 완료를 뜻하지 않는다.
   최대 60초 동안 5초 간격으로 root HTML이 candidate client asset을 참조하고 해당 asset과
   `/healthz`가 `200`인지 확인한다. 이전 asset 또는 candidate asset `404`가 계속되면 protected
   mutation을 보내지 않고 중단한다.
5. owner-only access가 유지된 상태에서 protected migration을 실행한 뒤
   read-only readiness로 exact 결과를 확인한다. `migrate`는 manifest에 포함된
   pending migration만 적용하며 owner selector나 SQL을 입력으로 받지 않는다.

   ```bash
   npm run sites:profile-maintenance -- migrate \
     --origin {approved_target_origin}
   npm run sites:profile-maintenance -- readiness \
     --origin {approved_target_origin}
   ```

   migrate 응답은 `appliedVersions`, `newlyAppliedVersions`, `operation=migrate`
   외 필드를 포함하지 않아야 한다. readiness 응답은 `operation=readiness`,
   `ready=true`이고 `expectedVersions`와
   `appliedVersions`가 순서까지 정확히 같아야 한다. owner/usage/token/session,
   SQL/provider message와 R2 metadata가 포함되면 통과로 취급하지 않는다.
   Sites가 package migration의 physical schema를 먼저 적용하고 application
   `schema_migrations` metadata를 남기지 않은 경우, migration 1·2의 모든
   explicit table/index DDL, migration 3~5의 additive column contract와
   migration 6의 account deletion operation table·constraint·owner cascade가
   candidate와 exact-match할 때만 metadata-only로 reconcile한다. 일부 object만
   있거나 drift가 있으면 mutation 전 `maintenance_conflict`로 중단한다.
   `schema_migrations` table이 아직 없거나 expected version이 누락된 상태는
   `migration_not_ready`로 중단한다. 실제 D1/provider 장애는 inspection,
   reconciliation, apply, verification 또는 exact manifest version의 bounded
   code만 반환하고 SQL/provider 원문을 노출하지 않는다.
   위 convergence Gate 뒤 첫 migration 요청이 generic `404`를 반환하면 migration table과
   candidate asset identity를 read-only로 다시 확인한다. applied version이 불변이고 candidate
   route가 수렴한 경우에만 같은 요청을 정확히 한 번 재시도하며, 그 외에는 즉시 중단한다.
6. readiness 성공 직후 `PROFILE_MAINTENANCE_MODE=disabled`로 바꾸고 operator
   secret을 제거한 environment를 같은 source saved version에 적용한다.
   owner-only access를 유지하면서 operator route가 generic `404`, `/healthz`가
   `200`인지 확인한다. 이 전환이나 확인이 실패하면 다음 단계로 진행하지
   않는다.
7. maintenance가 닫힌 candidate에서 OAuth/session/logout, packed CLI,
   private preview, 카드 dark/light·en/ko 저장을 확인한다. queryless README URL은
   `Content-Type: image/png`, `public, no-cache, must-revalidate`, application ETag와
   저장된 대표 이미지를 반환해야 하며 설정·사용량 변경 뒤 같은 URL에서 새 ETag와
   bytes를 제공해야 한다. explicit dark/light × en/ko의 GET/HEAD/304 하위 호환,
   `v` query가 canonical 선택을 바꾸지 않는지, publish/unpublish/404도 검증한다.
   card authority와 social object의 owner/publication id가 같은지 확인한 뒤 crawler
   User-Agent로 fixed `/api/share/{handle}`와 최신
   `/api/share/{handle}/r/{revision}` HTML의 canonical·`og:url`·`og:image`와
   Twitter Card metadata를 확인한다. matching revision은 모든 token이 일치하고,
   stale revision은 `200` 현재 revision metadata로 수렴하며, invalid revision은
   public document로 처리되지 않아야 한다. 이어서 정합 publication의
   `/u/{handle}/social.png` GET/HEAD/If-None-Match 304와 2400x1260 응답을
   검증한다. 이어서 legacy social-missing fixture에서 personalized route 404와
   HTML의 `/assets/codex-social-sample.png` 선언, fallback asset GET/HEAD 200을
   함께 확인한다. private·missing handle은 동일한 기본 OG/unavailable HTML과
   packaged sample로 닫히고 README/social PNG는 같은 404여야 한다. 마지막으로
   `npm run cleanup:card-media` dry-run이 새 object를 만들거나 삭제하지 않고 현재
   authority 참조를 보호하는지 확인한다.
8. error event를 확인한 뒤 profile private와 test token/session revoked
   baseline을 복원한다.

배포, readiness, maintenance 비활성화 또는 기능 smoke 중 하나라도 실패하거나
expected/applied에 missing 또는 unexpected version이 있으면 기능 smoke,
데이터 작업과 public 전환을 수행하지 않는다. 이전 saved version과 owner-only
policy를 유지하고 environment를 disabled/secret-absent baseline 또는 직전 key
set으로 되돌린 뒤 operator route `404`와 같은 health를 확인한다. provider
오류의 원문을 출력하거나 원격 D1을 임의 수정해 통과시키지 않는다.

## 소셜 미리보기 revision smoke

Share Studio 전환이나 public cutover에서는 application 응답과 외부 provider 결과를
분리해 확인한다. provider 작성 화면의 성공만으로 backend metadata가 맞다고 판단하지
않고, crawler `200`만으로 provider cache가 갱신됐다고 판단하지 않는다.

1. 같은 public test profile에서 카드 저장 또는 새 submit 전 revision A와 이후 최신
   revision B를 기록한다. token은 `max(owner.updatedAt, usage.uploadedAt)`의 epoch
   milliseconds이며 URL은 `/api/share/{handle}/r/{revision}`이다.
2. B 문서의 status·final URL·`canonical`·`og:url`과 `og:image`,
   `og:image:secure_url`, `twitter:image` token이 모두 B인지 확인한다. social image의
   status·content type·ETag도 함께 기록한다.
3. desktop browser와 X, LinkedIn, Meta/Threads, Reddit crawler User-Agent로 B가
   같은 metadata를 반환하는지 확인한다. A stale 요청은 redirect 없이 `200` 현재 B
   metadata로 수렴해야 하며 과거 snapshot으로 해석하지 않는다.
4. 실제 제품과 같은 target 형식으로 X·LinkedIn·Threads·Facebook·Reddit 새 작성
   화면을 연다. 링크 복사와 다섯 target을 decode했을 때 모두 같은 B URL이어야 한다.
   게시·초안 저장은 하지 않는다.
5. X는 cold image 처리에 시간이 걸릴 수 있으므로 crawler 응답 시각과 composer 최초
   표시 시각을 따로 기록한다. 즉시 표시를 보장하지 않는다. LinkedIn 작성 화면이
   stale이면 [Post Inspector](https://www.linkedin.com/post-inspector/)에서 같은 B URL을
   재수집한 뒤 결과와 시각을 기록한다. 자동 cache purge나 provider OAuth/API 호출은
   운영 절차에 포함하지 않는다.
6. fixed `/api/share/{handle}`는 기존 링크 하위 호환으로 계속 확인하되 새 공유의 cache
   갱신 판정에는 사용하지 않는다. timestamp가 없거나 invalid한 profile의 Share Studio만
   fixed URL로 fail safe해야 한다.

Task #101 공개 validation에서는 X가 최신 revision을 약 11초 안에 표시했고 LinkedIn은
새 작성 화면에서 즉시 표시했다. Threads는 약 10초 뒤 표시됐으며 Facebook·Reddit도
최신 카드를 표시했다. 이 수치는 provider SLA가 아니라 해당 실측의 관찰값이다.

application metadata가 틀리거나 X·LinkedIn 중 하나가 새 revision을 최신 identity로
인식하지 못하면 공유 URL 전환을 중단하고 직전 application saved version을 다시
배포한다. application rollback은 이미 게시된 provider cache를 삭제하지 않으므로 기존
게시물의 소급 갱신이나 cache purge 성공을 rollback 조건으로 두지 않는다.

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
- account deletion은 최초 combined plan의 exact owner/handle, digest/count를
  승인하면 persistent operation을 한 번 만들고 publication tombstone, D1 private
  quiesce, R2 revision, D1 structured data 순서로 처리한다. R2 revision은 요청당
  기본 8개만 삭제하며 하나라도 남으면 D1 owner를 삭제하지 않는다.
- CLI는 delete-account에 한해 active operation을 먼저 plan으로 확인하고 같은
  operation ID와 최초 승인값으로 batch를 직렬 재개한다. 수동 재개가 필요하면
  safe progress의 ID를 `--operation-id`로 명시할 수 있지만 새 ID로 active 작업을
  덮어쓰지 않는다.
- live lease progress에는 1~120초의 `retryAfterSeconds`와 HTTP `Retry-After`가
  함께 제공된다. CLI는 해당 시간을 기다리고 read-only plan을 다시 확인한 뒤에만
  다음 apply를 보낸다.
- apply 응답을 받지 못했거나 `maintenance_conflict`가 발생하면 즉시 apply를
  겹쳐 보내지 않는다. read-only plan의 operation ID와 최초 digest/count가 같을
  때만 재개하고, active operation 없이 original plan이 그대로인 경우 initial
  apply를 한 번만 재시도한다. apply를 보낸 뒤 plan이 `not_found`인 경우에만
  최종 D1 삭제 완료로 판정하며 최초 plan의 `not_found`는 완료가 아니다.
- `maintenance_conflict`에 allowlist된 `reason=structured_state_changed`와
  `retryable=false`가 함께 있으면 terminal structured drift다. CLI는 완료 여부를
  놓치지 않도록 read-only plan을 정확히 한 번 확인한 뒤 추가 apply 없이 중단한다.
  reason이 없거나 알 수 없는 구버전·provider 응답은 terminal로 추측하지 않고 위의
  기존 conflict 경계를 따른다. 임의 reason, SQL, provider 원문과 row payload는
  출력하지 않는다.
- operation ID·승인값 불일치, phase·남은 revision 수 역행, 진행 정체, 반복 상한,
  stale ETag/digest/count에서는 다음 mutation을 중단한다.
  같은 backup으로 일관성을 복구하거나 `repair-publication`을 exact ETag
  조건으로 수행한다. v4 repair publication은 D1 owner에 저장된 canonical
  `cardLocale`·`cardStyle.theme` pair를 반드시 포함하며 pair 없는 입력은
  dark/en으로 추측하지 않고 mutation 전에 거절한다.

계정 삭제 전에는 다음처럼 repository 밖 backup을 확보하고 plan의 digest/count를
사람이 확인한다. CLI 출력은 safe progress JSON line과 마지막 completed summary만
사용하며 owner/handle, lease nonce, R2 key·ETag와 provider 오류 원문을 기록하지 않는다.

```bash
npm run sites:profile-maintenance -- plan \
  --origin {approved_target_origin} \
  --owner-id {exact_owner_id} \
  --handle {exact_handle}

npm run sites:profile-maintenance -- delete-account \
  --origin {approved_target_origin} \
  --owner-id {exact_owner_id} \
  --handle {exact_handle} \
  --expected-digest {approved_digest} \
  --expected-count {approved_count} \
  --apply
```

structured D1 batch가 실패하면 owner, dependent row, operation과 temporary claim은
모두 원상태여야 한다. 이 상태에서 application rollback은 진행하지 않는다.
maintenance를 계속 닫아 둔 채 active plan과 lease 만료를 확인하고, retryable
경계일 때만 같은 operation으로 재개한다. terminal structured drift면 backup과
exact plan 차이를 확인한 뒤 별도 보정 승인을 받는다. 복구가 필요하면
삭제 전에 만든 backup을 disposable target에서 검증한 뒤 restore하고, publication은
별도 exact repair 절차로 복원한다. operation은 owner와 함께 cascade 삭제되므로 별도
완료 ledger나 장기 PII 기록을 만들지 않는다.

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
  --origin {approved_target_origin} \
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
   profile/card의 query 없음·theme·locale 조합 404, OAuth/CLI/submit을 확인한다.
   publish 뒤 queryless README URL의 PNG content type, cache policy, ETag와 저장된
   canonical theme·locale bytes를 확인하고 설정·사용량 변경 뒤 같은 URL 갱신을
   검증한다. explicit dark/light × en/ko `GET|HEAD|304` 호환과
   `selectedPublicCardUrl` 전환도 확인한다. card/social owner·publication id가
   일치하는지 확인한 뒤 fixed `/api/share/{handle}`와 최신
   `/api/share/{handle}/r/{revision}` HTML의 canonical/OG/Twitter metadata와 locale
   문구, `/u/{handle}/social.png`의
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
계속하지 않는다. legacy saved version 7 baseline의 공개 화면은
`/?profile={handle}`을 사용하지만 owner-only version 15에서 root query initial
HTML이 정적 asset으로 처리됨을 확인했다. 현재 public validation 경로는
`/api/share/{handle}`에서 handle별 canonical/OG/Twitter metadata와 같은 SPA 공개
화면을 제공한다. root query와 extension 없는 `/u/{handle}`은 source 하위
호환으로만 유지하며 production share link로 안내하지 않는다.

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

share revision application rollback은 새 DB row나 media snapshot을 삭제하지 않는다.
revision path는 metadata cache identity이므로 이전 saved version 재배포만 수행하고,
외부 provider cache나 이미 게시된 링크를 파괴적으로 정리하지 않는다.

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
query 없는 dark stable key를 보존한다. Task #100의 canonical pair도 v4 authority의
additive metadata이므로 이전 v4 saved version application은 이 pair와 light object를
무시하고 queryless authority를 기존 dark/en으로 읽을 수 있다. 다만 readiness의
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
