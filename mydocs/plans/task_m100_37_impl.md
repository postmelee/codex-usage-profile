# Task M100 #37 구현계획서

수행계획서: [`task_m100_37.md`](task_m100_37.md)
GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
마일스톤: M100

## 구현 전제

- Cloud Run + Neon + R2를 실제 MVP의 단일 canonical architecture로 둔다.
- Cloud Run만 GitHub OAuth, browser session, device login, CLI submit, visibility 변경, private preview와 PNG/GIF render를 처리한다.
- Neon은 structured record, R2는 공개 card media의 후속 production 진실 원천으로 정하되 이번 spike에서 실제 migration이나 provider write를 완료하지 않는다.
- ChatGPT Sites는 OpenAI Sites 관련 이벤트·홍보 기회를 위한 optional marketing mirror다. Sites 배포 성공 여부는 MVP release gate가 아니다.
- Sites에는 sample card, Hero, 제품 설명, Quickstart와 Cloud Run 이동 CTA만 둔다.
- Sites는 GitHub OAuth URL을 직접 구성하지 않고 `Create your card` 또는 `Open app` CTA로 Cloud Run `/`에 전체 페이지 이동한다.
- Sites는 실제 사용자 계정, usage, public/private card, settings, publish/share 상태와 Cloud Run API를 조회하지 않는다.
- Sites에 session cookie, GitHub client secret, submit token, Neon/R2 credential, D1/R2 provider binding을 배치하지 않는다.
- Cloud Run과 Sites가 공유하는 코드는 marketing component와 CSS로 제한한다. Cloud Run의 account loader나 product router를 Sites에 포함한 뒤 feature flag로 숨기지 않는다.
- Cloud Run production host는 `dev-server.js`의 Vite middleware를 사용하지 않고 빌드된 static asset과 기존 backend handler를 제공한다.
- container는 `PORT`, `0.0.0.0`, SIGTERM graceful shutdown과 ephemeral filesystem을 전제로 한다.
- 현재 JSON file store를 production durable storage라고 표현하지 않는다. POC fixture 또는 명시적 local/spike mode 외에는 production startup에서 fail closed한다.
- external provider credential, 유료 resource 또는 remote deployment 생성은 해당 Stage에서 별도 승인을 받는다.
- UI 차이가 발생하면 desktop/mobile browser 화면을 작업지시자에게 제공하고 시각 승인 전 다음 Stage로 진행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Cloud Run runtime과 marketing component 계약 | deployment config, shared marketing boundary, browser-only artifact 검사 | focused Node tests, build boundary 검사 |
| 2 | Cloud Run container POC | production server, Docker artifact, container smoke | health/static/API/PNG/SIGTERM smoke |
| 3 | Neon/R2 adapter boundary와 Cloud Run 보안 계약 | store/media contract, redirect·cookie·CSRF, 공식 hosting 문서 | backend contract/security tests |
| 4 | Sites marketing mirror POC | Sites manifest/build, sample landing, Cloud Run CTA | Sites build/preview, bundle privacy 검사 |
| 5 | Cloud Run 우선 통합 QA와 marketing mirror 비교 | hosting matrix, visual QA, Cloud Run-only fallback | full test/build/e2e, desktop/mobile 승인 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| production hosting architecture와 platform boundary | `docs/production-hosting.md` | Stage 3 신규 작성 | OK | 유지보수자와 후속 migration task의 공식 진실 원천 |
| Cloud Run 제품 runtime·Sites marketing mirror spike 결과와 시각 비교 | `mydocs/working/` | `mydocs/working/task_m100_37_stage{N}.md` | OK | 일회성 검증 로그를 공식 계약과 분리 |
| 수행·구현계획서 | `mydocs/plans/` | `task_m100_37.md`, 본 문서 | OK | Hyper-Waterfall 승인 기록 |
| 최종 결과보고서 | `mydocs/report/` | `mydocs/report/task_m100_37_report.md` | OK | 검증 결과, 한계와 후속 issue handoff 보존 |

## Stage 1 — Cloud Run runtime과 marketing component 계약

### 산출물

신규:

- `src/profile-runtime/deployment-config.js`
- `src/profile-runtime/__tests__/deployment-config.test.js`
- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-marketing/marketing-config.js`
- `src/profile-marketing/__tests__/marketing-config.test.js`
- `src/profile-marketing/sites-entry.jsx`
- `vite.sites.config.js`
- `scripts/verify-marketing-artifact.mjs`
- `mydocs/working/task_m100_37_stage1.md`

수정:

- `src/profile-ui/HomePage.jsx`
- `src/profile-runtime/config.js`
- `package.json`
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. Cloud Run deployment config를 순수 parser로 분리한다.
   - bind host, `PORT`, canonical app origin, store mode와 runtime mode를 명시적으로 검증한다.
   - `PORT`는 양의 정수 범위만 허용하고 production 기본 bind host는 `0.0.0.0`이다.
   - canonical app origin은 HTTPS production origin 또는 명시적 loopback development origin만 허용한다.
   - malformed URL과 production file-store 오용은 startup 전에 오류로 처리한다.
2. Cloud Run Home과 Sites가 공유할 marketing component 경계를 만든다.
   - Hero, sample card, 제품 설명, Quickstart와 CTA를 `profile-marketing`에 둔다.
   - identity/account menu, private card, publish/share CTA는 Home이 별도 product slot으로 합성한다.
   - marketing component는 API client, account state, router mutation과 provider SDK를 import하지 않는다.
3. marketing config를 순수 값으로 관리한다.
   - sample fixture와 CTA label/destination을 실제 사용자 상태와 분리한다.
   - Sites canonical app URL이 없으면 CTA를 비활성화하고 mock production URL로 대체하지 않는다.
   - 긴 번역 문자열에서도 heading, CTA와 Quickstart가 잘리지 않는 기존 responsive 제약을 유지한다.
4. browser-only Sites contract artifact를 먼저 만든다.
   - Stage 1에서는 일반 Vite build로 marketing entry의 dependency boundary만 검증한다.
   - 실제 Sites plugin과 `.openai/hosting.json` 연결은 Stage 4에서 수행한다.
   - artifact에는 `node:http`, `node:fs`, `@napi-rs/canvas`, backend/API/account code가 없어야 한다.
5. package scripts의 책임을 구분한다.
   - 기존 `dev`와 `build`는 local/product 흐름을 유지한다.
   - `build:cloud-run`, `build:marketing`, `start`의 output 책임을 고정한다.
   - package manager와 lockfile은 기존 npm을 유지한다.
6. Stage 1에서 marketing extraction으로 화면이 달라지면 Stage 보고 전에 작업지시자 시각 검증을 요청한다.

### 검증

```bash
node --test src/profile-runtime/__tests__/deployment-config.test.js src/profile-marketing/__tests__/marketing-config.test.js
npm run build
npm run build:marketing
node scripts/verify-marketing-artifact.mjs
git diff --check
```

검증 관점:

- invalid deployment config와 production file-store 오용이 fail closed한다.
- marketing component가 product account/API와 독립적이다.
- Cloud Run Home은 기존 authenticated/private card 흐름을 잃지 않는다.
- marketing artifact에 server/native/account module과 secret이 포함되지 않는다.
- sample fixture가 실제 사용자 데이터처럼 표시되거나 저장되지 않는다.

### 커밋

```text
Task #37 Stage 1: Cloud Run runtime과 marketing component 계약 확정
```

## Stage 2 — Cloud Run container POC

### 산출물

신규:

- `Dockerfile`
- `.dockerignore`
- `src/profile-runtime/production-server.js`
- `src/profile-runtime/static-assets.js`
- `src/profile-runtime/__tests__/production-server.test.js`
- `scripts/smoke-cloud-run-container.mjs`
- `mydocs/working/task_m100_37_stage2.md`

수정:

- `package.json`
- `src/profile-runtime/config.js`
- `src/profile-runtime/host-adapter.js`
- `src/profile-runtime/dev-server.js`, 공통 request adapter 분리가 필요한 최소 범위
- `README.md`, local container POC 실행법만 필요한 경우
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. production Node server를 추가한다.
   - Vite middleware 없이 빌드된 product frontend asset을 제공한다.
   - `/api/*`와 `/u/:handle/card.png`는 기존 fetch-style backend/host adapter를 재사용한다.
   - `/healthz`는 외부 provider를 변경하지 않는 liveness 응답을 제공하고 credential이나 store path를 노출하지 않는다.
   - SPA fallback은 asset, API와 card route를 침범하지 않는다.
2. process lifecycle을 Cloud Run contract에 맞춘다.
   - `PORT`와 `0.0.0.0`을 사용한다.
   - SIGTERM에서 신규 요청 수락을 중지하고 진행 중 request 종료 후 제한 시간 내 닫는다.
   - startup config error는 명확한 non-zero exit로 종료한다.
3. production file store 오용을 차단한다.
   - container smoke는 명시적인 `spike`/fixture mode에서만 temporary store를 사용한다.
   - production mode에서 file store만 설정된 경우 startup을 거부한다.
   - 로그에는 secret, cookie, OAuth code, token 또는 raw usage payload를 출력하지 않는다.
4. multi-stage Docker image를 작성한다.
   - Node 20 계열 Linux base에서 dependency install과 frontend build를 분리한다.
   - runtime에는 production dependency와 build artifact만 포함한다.
   - 가능한 경우 non-root user로 실행하고 writable path를 temporary directory로 제한한다.
   - `@napi-rs/canvas`가 대상 architecture에서 로드되고 PNG decode 가능한지 smoke한다.
5. container smoke script를 추가한다.
   - 임의 host port로 시작하고 health readiness를 기다린다.
   - `/`, static asset, anonymous `/api/account`, 대표 error mapping과 seeded PNG endpoint를 검증한다.
   - SIGTERM 후 container가 정상 종료되는지 확인한다.
6. Docker가 로컬에 없거나 provider architecture를 재현할 수 없으면 node production host smoke와 image build 실패를 구분한다. Docker 검증을 생략한 채 Stage를 완료하지 않는다.

### 검증

```bash
node --test src/profile-runtime/__tests__/production-server.test.js src/profile-runtime/__tests__/deployment-config.test.js
npm run build:cloud-run
docker build -t codex-usage-profile:task37 .
node scripts/smoke-cloud-run-container.mjs codex-usage-profile:task37
git diff --check
```

검증 관점:

- container가 임의 `PORT`와 `0.0.0.0` 계약을 지킨다.
- health, static landing, API와 PNG route가 동일 process에서 응답한다.
- production server는 Vite dev middleware에 의존하지 않는다.
- native renderer가 Linux image에서 실제 PNG를 생성한다.
- SIGTERM이 정상 종료되고 container filesystem을 durable source로 주장하지 않는다.
- response/log에 deployment secret과 local path가 노출되지 않는다.

### 커밋

```text
Task #37 Stage 2: Cloud Run production container POC 구현
```

## Stage 3 — Neon/R2 adapter boundary와 Cloud Run 보안 계약

### 산출물

신규:

- `src/profile-backend/store-contract.js`
- `src/profile-backend/__tests__/store-contract.test.js`
- `src/profile-media/media-store-contract.js`
- `src/profile-media/__tests__/media-store-contract.test.js`
- `docs/production-hosting.md`
- `mydocs/working/task_m100_37_stage3.md`

수정:

- `src/profile-backend/http.js`
- `src/profile-backend/index.js`, store contract 주입 경계가 필요한 최소 범위
- `src/profile-runtime/host-adapter.js`
- `src/profile-backend/__tests__/http.test.js`
- `README.md`, 공식 hosting 문서 링크 추가가 필요한 경우
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. structured store contract를 executable contract test로 명시한다.
   - owner, OAuth state, session, CLI challenge/token digest, device, usage revision, visibility의 책임을 구분한다.
   - one-time consume, idempotent submit, owner isolation과 concurrent update atomicity를 기록한다.
   - 현재 file store를 contract fixture로 실행하되 Neon SDK, schema migration이나 dual write는 추가하지 않는다.
2. public media store contract를 정의한다.
   - stable owner card key, immutable revision object, content type/etag/cache metadata와 publish/unpublish 동작을 구분한다.
   - private preview는 Cloud Run on-demand render이고 public object만 R2 대상임을 고정한다.
   - R2 SDK, credential과 실제 bucket write는 이번 task에 추가하지 않는다.
3. Cloud Run same-origin 보안 경계를 보강한다.
   - Sites가 Cloud Run API를 호출하지 않으므로 Sites용 CORS를 추가하지 않는다.
   - default는 cross-origin credential/API access를 거부한다.
   - OAuth `redirect_to`는 Cloud Run local path allowlist만 허용하며 protocol-relative/external URL을 거부한다.
   - state-changing browser request는 existing same-origin session, SameSite cookie와 CSRF 계약을 유지한다.
4. `docs/production-hosting.md`를 공식 진실 원천으로 작성한다.
   - Cloud Run, Neon, R2와 Sites marketing mirror의 역할을 구분한다.
   - required env/secrets를 public/server-only로 분류하되 실제 값을 기록하지 않는다.
   - startup, health, persistence, card cache, rollback과 Cloud Run-only fallback을 설명한다.
   - Sites는 이벤트·홍보용 비차단 배포이며 product data path가 아님을 명시한다.
   - 실제 remote 배포가 검증된 항목과 설계만 확정된 항목을 분리한다.
5. 후속 migration issue 입력을 문서에 남긴다.
   - Neon schema/transaction migration.
   - R2 materialization/cache invalidation.
   - Cloud Run secrets/custom domain/observability/backup/retention.
   - optional Sites event publication/operations.

### 검증

```bash
node --test src/profile-backend/__tests__/store-contract.test.js src/profile-media/__tests__/media-store-contract.test.js src/profile-backend/__tests__/http.test.js
rg -n "Cloud Run|Neon|R2|Sites|OAuth|CSRF|fallback|marketing" docs/production-hosting.md
npm test
git diff --check
```

검증 관점:

- Neon/R2 후속 adapter의 atomicity, idempotency와 failure policy가 contract로 고정된다.
- 실제 provider client와 dual write를 도입하지 않는다.
- Sites를 위해 Cloud Run CORS/session 범위를 확대하지 않는다.
- external/protocol-relative redirect와 cross-origin credential access가 거부된다.
- 공식 문서가 Cloud Run 제품과 Sites marketing mirror를 혼동하지 않는다.

### 커밋

```text
Task #37 Stage 3: Neon R2 경계와 Cloud Run 보안 계약 확정
```

## Stage 4 — Sites marketing mirror POC

### 산출물

신규:

- `.openai/hosting.json`
- `src/profile-marketing/sites-config.js`
- `src/profile-marketing/__tests__/sites-config.test.js`
- `mydocs/working/task_m100_37_stage4.md`

수정:

- `package.json`
- `package-lock.json`
- `vite.sites.config.js`
- `src/profile-marketing/sites-entry.jsx`
- `scripts/verify-marketing-artifact.mjs`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. existing Vite project에 Sites production build path를 연결한다.
   - 기존 React/Vite 구조와 npm lockfile을 보존한다.
   - Sites plugin과 Cloudflare Worker-compatible ESM output을 사용한다.
   - Cloud Run build/startup이 Sites plugin이나 manifest에 의존하지 않게 한다.
2. `.openai/hosting.json`에는 Sites project linkage만 둔다.
   - D1과 R2 binding은 모두 `null`로 둔다.
   - GitHub secret, session secret, Neon URL, R2 credential을 manifest/public env에 넣지 않는다.
3. Sites marketing mirror를 구성한다.
   - sample fixture 기반 Hero/card, 제품 설명과 Quickstart를 렌더링한다.
   - `Create your card`/`Open app` CTA는 configured Cloud Run `/`로 이동한다.
   - Sign in, account menu, settings, device approval, publish/share와 사용자별 route를 렌더링하지 않는다.
   - 실제 public card endpoint나 Cloud Run API를 fetch하지 않는다.
4. artifact verifier로 다음을 금지한다.
   - `node:http`, `node:fs`, `@napi-rs/canvas`, backend handler와 durable store.
   - `/api/`, OAuth/device/session 문자열과 secret-like environment value.
   - private account fixture, 사용자 handle/avatar와 runtime usage payload.
5. local preview에서 sample card, Quickstart와 Cloud Run CTA navigation을 검증한다.
6. 1280x900과 390x844에서 Cloud Run landing marketing area와 시각 비교한다.
   - Cloud Run account/product action은 비교 대상에서 제외한다.
   - layout, typography, card ratio, animation/reduced-motion이 달라지면 작업지시자 시각 승인을 받는다.
7. 실제 Sites publish는 build/preview 통과 후 별도 승인받는다. 이벤트 제출 URL과 access level을 확인하기 전 공개 배포하지 않는다.

### 검증

```bash
node --test src/profile-marketing/__tests__/sites-config.test.js src/profile-marketing/__tests__/marketing-config.test.js
npm run build:sites
node scripts/verify-marketing-artifact.mjs
npm run test:e2e -- --grep "Marketing|Home"
git diff --check
```

검증 관점:

- Sites는 동일 marketing component/CSS로 sample landing을 렌더링한다.
- artifact에 native/server/API/account/session dependency와 credential이 없다.
- sample data가 실제 사용자 identity나 usage에서 파생되지 않는다.
- CTA는 token이나 OAuth parameter 없이 Cloud Run `/`로 이동한다.
- D1/R2 binding과 cross-origin API가 활성화되지 않는다.
- Sites 실패가 Cloud Run build와 제품 동작에 영향을 주지 않는다.

### 커밋

```text
Task #37 Stage 4: Sites marketing mirror POC 구현
```

## Stage 5 — Cloud Run 우선 통합 QA와 marketing mirror 비교

### 산출물

신규:

- `scripts/smoke-hosting-matrix.mjs`
- `mydocs/working/task_m100_37_stage5.md`

수정:

- `tests/profile-ui.spec.js`
- `docs/production-hosting.md`, 실제 검증 결과와 fallback 보정이 필요한 경우
- `README.md`, 검증된 실행 경로 링크가 필요한 경우
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. Cloud Run canonical path를 먼저 통합 검증한다.
   - production server/container landing, health, API와 PNG route.
   - Sites artifact가 없어도 build/startup과 MVP surface가 유지된다.
   - Cloud Run 검증 실패는 Sites 작업으로 우회하지 않는다.
2. marketing mirror를 별도 smoke한다.
   - Sites build/preview의 sample landing, Quickstart와 Cloud Run CTA.
   - Sites build/deploy 실패를 Cloud Run MVP blocker로 처리하지 않는다.
3. desktop/mobile 시각 비교를 수행한다.
   - 1280x900과 390x844에서 같은 marketing fixture와 locale을 사용한다.
   - Hero, card ratio, header, Quickstart와 CTA의 clipping/overflow/overlap을 확인한다.
   - Cloud Run account/product action을 제외한 marketing UI 차이는 작업지시자 승인을 받는다.
4. security/privacy smoke를 수행한다.
   - Sites DOM/bundle에는 cookie, token, provider secret, owner/account metadata가 없어야 한다.
   - Cloud Run logs와 health response에는 secret, local storage path와 raw usage가 없어야 한다.
   - Sites CTA URL에는 session, OAuth state와 user identifier를 포함하지 않는다.
5. remote deployment는 별도 승인에 따라 분기한다.
   - Cloud Run remote POC는 product runtime 검증으로 기록한다.
   - Sites remote 배포는 이벤트·홍보 산출물로 별도 기록하며 MVP readiness를 대신하지 않는다.
   - Neon/R2 실제 migration이 제외되어 있으므로 POC와 production-ready 상태를 구분한다.
   - 임의 custom domain, DNS, paid database/bucket 또는 secret을 생성하지 않는다.
6. 통합 검증 후 후속 issue 후보를 확정한다.
   - Neon production store migration.
   - R2 public card pipeline.
   - Cloud Run production deploy/secrets/observability.
   - Sites event publication과 유지/폐기 기준.

### 검증

```bash
npm test
npm run build:cloud-run
docker build -t codex-usage-profile:task37 .
node scripts/smoke-cloud-run-container.mjs codex-usage-profile:task37
npm run build:sites
node scripts/verify-marketing-artifact.mjs
node scripts/smoke-hosting-matrix.mjs
npm run test:e2e
git diff --check
```

검증 관점:

- Cloud Run canonical app이 Sites 없이 전체 MVP backend surface를 제공한다.
- Sites는 backend/API/account/session 없이 standalone marketing artifact로 동작한다.
- 두 host의 marketing UI가 대표 viewport에서 시각적으로 동등하고 텍스트가 잘리지 않는다.
- Sites CTA 이후 실제 로그인과 사용자 card 작업은 Cloud Run origin에서 시작한다.
- remote 미검증 항목과 provider migration 잔여 작업이 명확히 보고된다.
- full test/build/e2e와 작업지시자 시각 승인이 완료된다.

### 커밋

```text
Task #37 Stage 5: Cloud Run 우선 hosting QA와 marketing mirror 검증 완료
```

## 전체 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- Cloud Run test/build/container smoke를 Sites build보다 먼저 실행한다.
- Sites 실패를 Cloud Run MVP 검증 성공으로 합치거나 반대로 Cloud Run 실패를 Sites로 대체하지 않는다.
- Docker와 remote provider 검증은 결과를 구분한다. local Node smoke를 remote deployment 성공으로 기록하지 않는다.
- 외부 resource/secret 생성 전 작업지시자 승인을 받고 custom domain이나 유료 resource를 임의로 만들지 않는다.
- UI 변경 또는 marketing UI 시각 차이가 있으면 작업지시자 직접 검증 승인을 받은 뒤 다음 단계로 진행한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 각 Stage 산출물과 `mydocs/working/task_m100_37_stage{N}.md`를 같은 단계 커밋에 묶는다.
- 커밋 메시지는 `Task #37 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- external credential 또는 remote deployment blocker만으로 불완전한 Stage를 완료 처리하지 않는다.

## 단계 의존성

- Stage 2는 Stage 1의 Cloud Run deployment config와 marketing boundary 승인 후 진행한다.
- Stage 3은 Cloud Run canonical production host가 성립한 뒤 진행한다.
- Stage 4는 Cloud Run 제품 architecture와 보안 경계를 확정한 뒤 시작한다. Sites를 MVP runtime 선행조건으로 만들지 않는다.
- Stage 5는 Cloud Run 경로를 먼저 검증한 뒤 Sites mirror를 별도 검증한다.
- remote Cloud Run/Sites deployment는 local build가 통과하고 작업지시자가 외부 resource 생성을 승인한 경우에만 수행한다.

## 위험과 대응

- **Sites public beta와 이벤트 변화**: marketing adapter를 optional build로 격리하고 Cloud Run MVP가 Sites manifest/plugin에 의존하지 않게 한다.
- **마케팅 미러와 실제 제품 혼동**: sample 표시와 Cloud Run 이동 CTA를 명확히 하고 account/public card를 Sites에서 모사하지 않는다.
- **이벤트 목적의 범위 확장**: Sites backend, external OAuth, D1/R2와 API fetch를 금지해 이벤트 산출물이 MVP 일정을 지연하지 않게 한다.
- **Native renderer container 실패**: production Linux image에서 실제 PNG 생성/decode를 Stage 2 필수 smoke로 둔다.
- **Ephemeral file store 오용**: production mode에서 file store startup을 거부하고 POC mode를 명시적으로 분리한다.
- **Neon/R2 범위 확장**: adapter contract와 공식 문서까지만 구현하고 provider SDK, schema migration, bucket write는 후속 issue로 넘긴다.
- **두 landing의 시각 drift**: marketing component/CSS만 공유하고 대표 viewport screenshot으로 차이를 검증한다.
- **Provider 비용과 secret 의존**: remote resource 생성은 별도 승인하며 local artifact 결과와 remote 결과를 분리한다.

## 승인 요청 사항

- Cloud Run + Neon + R2를 단일 MVP architecture로 두고 Sites를 이벤트·홍보용 marketing mirror로 한정하는 방향
- Sites가 sample card, Hero, Quickstart와 Cloud Run CTA만 제공하고 API/account/session/storage를 전혀 소유하지 않는 경계
- 위 5개 Stage의 순서, 산출물, 검증 명령과 커밋 메시지
- production file store를 fail closed하고 Neon/R2는 adapter contract까지만 다루는 범위
- Cloud Run 검증을 항상 Sites보다 먼저 수행하고 Sites 실패를 MVP release blocker로 삼지 않는 수용 기준
- remote Cloud Run/Sites 배포와 외부 resource 생성은 local build 통과 후 별도 승인을 받는 조건

승인되면 Stage 1의 Cloud Run deployment config와 shared marketing component 계약 구현을 시작한다.
