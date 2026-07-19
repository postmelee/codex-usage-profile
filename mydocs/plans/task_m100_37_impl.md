# Task M100 #37 구현계획서

수행계획서: [`task_m100_37.md`](task_m100_37.md)
GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
마일스톤: M100

## 구현 전제

- Cloud Run을 GitHub OAuth, browser session, device login, CLI submit, visibility 변경, private preview와 PNG render의 유일한 canonical runtime으로 둔다.
- Neon은 structured record, R2는 공개 card media의 후속 production 진실 원천으로 정하되 이번 task에서 실제 migration이나 provider write를 완료하지 않는다.
- ChatGPT Sites는 익명 landing, sample/public card와 Quickstart를 제공하는 optional public frontend로 제한한다.
- Sites의 sign-in action은 Cloud Run app으로 전체 페이지 이동한다. Sites origin에서 GitHub OAuth callback, session cookie, device approval, submit API 또는 visibility mutation을 처리하지 않는다.
- Sites와 Cloud Run 사이에 shared session cookie, broad credentialed CORS 또는 D1/Neon 이중 저장을 도입하지 않는다.
- React component와 CSS는 공통 source를 사용하고 host 차이는 명시적인 capability/config로 주입한다. Sites 전용 UI 복사본을 만들지 않는다.
- Cloud Run production host는 `dev-server.js`의 Vite middleware를 사용하지 않고 빌드된 static asset과 기존 backend handler를 제공한다.
- container는 `PORT` 환경변수와 `0.0.0.0` bind, SIGTERM graceful shutdown, ephemeral filesystem을 전제로 한다.
- 현재 JSON file store를 production durable storage라고 표현하지 않는다. POC fixture 또는 명시적 local/spike mode 외에는 production startup에서 fail closed한다.
- Sites build에는 `node:http`, `node:fs`, `@napi-rs/canvas`와 backend secret이 포함되지 않아야 한다.
- `.openai/hosting.json`의 D1/R2 binding은 Sites를 진실 원천으로 사용하지 않으므로 이번 POC에서 `null`로 유지한다.
- external provider credential, 유료 resource 또는 remote deployment 생성은 해당 Stage 진입 시 별도 승인을 받는다. 승인되지 않으면 local artifact와 preview smoke를 완료 기준으로 구분해 기록한다.
- UI 차이가 발생하면 desktop/mobile browser 화면을 작업지시자에게 제공하고 시각 승인 전 다음 Stage로 진행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Host capability와 production runtime 계약 | host capability, deployment config, build boundary test | focused Node tests, host artifact 검사 |
| 2 | Cloud Run container POC | production server, Docker artifact, container smoke | build, container health/static/API/PNG/SIGTERM smoke |
| 3 | Sites public frontend POC와 auth handoff | Sites manifest/build, anonymous capability, Cloud Run navigation | Sites build/preview, focused E2E, bundle secret 검사 |
| 4 | Neon/R2 adapter boundary와 보안 계약 | adapter contract, origin/redirect 보강, 공식 hosting 문서 | backend contract/security tests, docs check |
| 5 | 이중 배포·시각 비교와 fallback 결론 | 통합 smoke, visual QA, Cloud Run-only fallback | full test/build/e2e, desktop/mobile 승인 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| production hosting architecture와 platform boundary | `docs/production-hosting.md` | Stage 4 신규 작성 | OK | 유지보수자와 후속 migration task의 공식 진실 원천 |
| Cloud Run/Sites spike 결과와 시각 비교 | `mydocs/working/` | `mydocs/working/task_m100_37_stage{N}.md` | OK | 일회성 검증 로그를 공식 계약과 분리 |
| 수행·구현계획서 | `mydocs/plans/` | `task_m100_37.md`, 본 문서 | OK | Hyper-Waterfall 승인 기록 |
| 최종 결과보고서 | `mydocs/report/` | `mydocs/report/task_m100_37_report.md` | OK | 검증 결과, 한계와 후속 issue handoff 보존 |

## Stage 1 — Host capability와 production runtime 계약

### 산출물

신규:

- `src/profile-hosting/host-capabilities.js`
- `src/profile-hosting/__tests__/host-capabilities.test.js`
- `src/profile-runtime/deployment-config.js`
- `src/profile-runtime/__tests__/deployment-config.test.js`
- `vite.sites.config.js`
- `src/profile-hosting/sites-entry.jsx`
- `scripts/verify-sites-artifact.mjs`
- `mydocs/working/task_m100_37_stage1.md`

수정:

- `src/App.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-runtime/config.js`
- `package.json`
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. host별 기능을 boolean 산재 대신 검증 가능한 capability object로 정의한다.
   - `cloud-run`: account/session, OAuth login, device approval, submit, visibility mutation, private preview, server PNG render를 허용한다.
   - `sites`: anonymous landing, sample/public card, Quickstart와 Cloud Run sign-in navigation만 허용한다.
   - public frontend가 canonical app URL을 모르면 sign-in을 비활성 상태로 표시하고 mock account로 대체하지 않는다.
2. `App.jsx`와 Home account 상태 로딩을 capability에 연결한다.
   - Sites mode에서는 same-origin `/api/account`를 호출하지 않는다.
   - Sites가 account unavailable을 signed-out 상태로 오인하거나 반복 polling하지 않는다.
   - public route와 landing은 기존 공통 component/CSS를 재사용한다.
3. deployment config를 순수 parser로 분리한다.
   - host mode, canonical app URL, public data origin, bind host, `PORT`, store mode를 명시적으로 검증한다.
   - `PORT`는 양의 정수 범위만 허용하고 기본 bind host는 production에서 `0.0.0.0`이다.
   - Sites canonical app URL은 HTTPS production origin 또는 명시적 loopback development origin만 허용한다.
   - malformed URL, cross-origin credential mode와 production file-store 오용은 startup 전에 오류로 처리한다.
4. package scripts와 browser-only build 경계를 구분한다.
   - 기존 `dev`는 local Vite + backend 개발 흐름을 유지한다.
   - `build:cloud-run`, `build:sites`, `start`의 이름과 output 책임을 고정한다.
   - Stage 1의 Sites config는 browser-only Vite artifact를 생성하며, 실제 Sites plugin/hosting manifest 연결은 Stage 3에서 보강한다.
   - package manager와 lockfile은 기존 npm을 유지한다.
5. build boundary test를 추가한다.
   - Sites entry와 빌드 artifact에서 Node built-in과 native renderer import를 금지한다.
   - Cloud Run capability가 기존 backend/API route를 제거하지 않음을 test fixture로 고정한다.
6. Stage 1에서는 화면 layout이나 animation을 변경하지 않는다. host state 차이로 UI가 달라지면 Stage 보고 전 작업지시자 시각 검증을 요청한다.

### 검증

```bash
node --test src/profile-runtime/__tests__/deployment-config.test.js src/profile-hosting/__tests__/host-capabilities.test.js
npm run build
npm run build:sites
node scripts/verify-sites-artifact.mjs
git diff --check
```

검증 관점:

- Cloud Run과 Sites capability가 상호 배타적인 auth/mutation 권한을 가진다.
- Sites mode는 same-origin authenticated API를 호출하지 않는다.
- invalid deployment config와 production file-store 오용이 fail closed한다.
- Sites frontend artifact에 server/native module이 포함되지 않는다.
- 기존 local development와 Cloud Run backend contract를 capability 분리로 훼손하지 않는다.

### 커밋

```text
Task #37 Stage 1: host capability와 production runtime 계약 확정
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
   - Vite middleware 없이 빌드된 frontend asset을 제공한다.
   - `/api/*`와 `/u/:handle/card.png`는 기존 fetch-style backend/host adapter를 재사용한다.
   - `/healthz`는 외부 provider를 변경하지 않는 liveness 응답을 제공하고 credential이나 store path를 노출하지 않는다.
   - SPA fallback은 asset path와 API/card route를 침범하지 않는다.
2. process lifecycle을 Cloud Run contract에 맞춘다.
   - `PORT`와 `0.0.0.0`을 사용한다.
   - SIGTERM에서 신규 요청 수락을 중지하고 진행 중 request 종료 후 제한 시간 내 닫는다.
   - unhandled startup config error는 명확한 non-zero exit로 종료한다.
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
   - `/`, static asset, anonymous `/api/account`, representative 404/error mapping과 seeded PNG endpoint를 검증한다.
   - SIGTERM 후 container가 정상 종료되는지 확인한다.
6. Docker가 로컬에 없거나 provider architecture를 재현할 수 없는 경우 node production host smoke와 image build 실패 원인을 구분한다. Docker 검증을 생략한 채 Stage를 완료하지 않고 작업지시자에게 blocker를 보고한다.

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

## Stage 3 — Sites public frontend POC와 auth handoff

### 산출물

신규:

- `.openai/hosting.json`
- `src/profile-hosting/sites-env.js`
- `src/profile-hosting/__tests__/sites-env.test.js`
- `mydocs/working/task_m100_37_stage3.md`

수정:

- `package.json`
- `package-lock.json`
- `vite.sites.config.js`
- `src/profile-hosting/sites-entry.jsx`
- `scripts/verify-sites-artifact.mjs`
- `src/App.jsx`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/accountUi.js`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. 기존 Vite project에 Sites production build path를 추가한다.
   - 기존 React/Vite 구조와 npm lockfile을 보존한다.
   - Sites plugin과 Cloudflare Worker-compatible ESM output을 사용한다.
   - Cloud Run build와 Sites build가 서로의 entry/config를 암묵적으로 가져오지 않게 한다.
2. `.openai/hosting.json`에는 logical service metadata만 둔다.
   - Sites가 canonical store가 아니므로 D1과 R2 binding은 `null`로 둔다.
   - GitHub client secret, session secret, Neon URL, R2 credential을 manifest 또는 public env에 넣지 않는다.
3. Sites public capability를 구현한다.
   - `/`는 sample card와 Quickstart를 공통 UI source로 렌더링한다.
   - public profile/card 진입은 public data origin 또는 Cloud Run canonical URL로 연결한다.
   - private owner UI, settings, device approval와 submit mutation은 Sites navigation에서 노출하지 않는다.
4. sign-in handoff를 명확히 한다.
   - Sign in은 Cloud Run canonical app의 same-origin OAuth entry로 전체 페이지 navigation한다.
   - callback 이후 사용자는 Cloud Run origin의 authenticated home/settings에서 계속 작업한다.
   - Sites로 session을 다시 전달하거나 URL에 session/token을 붙이지 않는다.
5. artifact verifier로 다음을 금지한다.
   - `node:http`, `node:fs`, `@napi-rs/canvas`, backend handler와 durable store code.
   - secret-like environment variable name/value와 private account fixture.
   - same-origin `/api/account`, device approval, submit 또는 mutation call.
6. local Sites preview에서 anonymous landing, sample/public card와 Cloud Run sign-in URL을 검증한다.
7. UI가 Cloud Run landing과 달라지면 1280x900과 390x844 screenshot을 제공하고 작업지시자 시각 승인 후 Stage 보고서를 작성한다.
8. 실제 Sites publish는 build/preview 통과 후 외부 resource 생성 승인을 별도로 요청한다. 승인 전에는 connector 배포를 실행하지 않는다.

### 검증

```bash
node --test src/profile-hosting/__tests__/sites-env.test.js src/profile-hosting/__tests__/host-capabilities.test.js
npm run build:sites
node scripts/verify-sites-artifact.mjs
npm run test:e2e -- --grep "Sites|Home"
git diff --check
```

검증 관점:

- Sites public UI는 Cloud Run landing과 같은 component/CSS source를 사용한다.
- Sites artifact에 native/server dependency, credential과 state-changing API가 없다.
- anonymous 상태를 account unavailable 오류로 표시하지 않는다.
- sign-in은 token 전달 없이 Cloud Run canonical app으로 이동한다.
- D1/R2가 Sites source of truth로 활성화되지 않는다.
- Cloud Run canonical URL이 없을 때 fake sign-in이 아니라 명시적인 disabled/fallback 상태를 사용한다.

### 커밋

```text
Task #37 Stage 3: Sites public frontend와 Cloud Run auth handoff 구현
```

## Stage 4 — Neon/R2 adapter boundary와 보안 계약

### 산출물

신규:

- `src/profile-backend/store-contract.js`
- `src/profile-backend/__tests__/store-contract.test.js`
- `src/profile-media/media-store-contract.js`
- `src/profile-media/__tests__/media-store-contract.test.js`
- `docs/production-hosting.md`
- `mydocs/working/task_m100_37_stage4.md`

수정:

- `src/profile-backend/http.js`
- `src/profile-backend/index.js`, store contract 주입 경계가 필요한 최소 범위
- `src/profile-runtime/host-adapter.js`
- `src/profile-backend/__tests__/http.test.js`
- `README.md`, 공식 hosting 문서 링크 추가가 필요한 경우
- `mydocs/orders/20260719.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. 현재 backend가 요구하는 structured store contract를 executable contract test로 명시한다.
   - owner, OAuth state, session, CLI challenge/token digest, device, usage revision, visibility의 읽기·쓰기 책임을 구분한다.
   - one-time consume, idempotent submit, owner isolation과 concurrent update에서 필요한 atomicity를 기록한다.
   - 현재 file store를 contract fixture로 실행하되 Neon 구현이나 schema migration은 추가하지 않는다.
2. public media store contract를 정의한다.
   - stable owner card key, immutable revision object, content type/etag/cache metadata와 publish/unpublish 동작을 구분한다.
   - private preview는 Cloud Run on-demand render이고 public object만 R2 대상임을 고정한다.
   - R2 SDK, credential과 실제 bucket write는 이번 task에 추가하지 않는다.
3. cross-origin 보안 경계를 보강한다.
   - default는 credentialed cross-origin API를 허용하지 않는다.
   - Sites가 직접 읽어야 하는 항목이 있을 때만 명시적 origin의 anonymous public GET/HEAD를 허용한다.
   - preflight와 `Vary: Origin`을 정확히 처리하고 wildcard origin + credential 조합을 금지한다.
   - OAuth `redirect_to`는 Cloud Run local path allowlist만 허용하며 protocol-relative/external URL을 거부한다.
   - state-changing browser request는 기존 same-origin session, SameSite cookie와 CSRF 계약을 유지한다.
4. `docs/production-hosting.md`를 공식 진실 원천으로 작성한다.
   - Cloud Run, Neon, R2, Sites 역할과 데이터 흐름을 명시한다.
   - required env/secrets를 public/server-only로 분류하되 실제 값을 기록하지 않는다.
   - startup, health, persistence, card cache, rollback과 Cloud Run-only fallback을 설명한다.
   - 실제 remote 배포가 검증된 항목과 설계만 확정된 항목을 분리한다.
   - Sites가 지원 중단되거나 build에 실패해도 Cloud Run canonical app이 독립적으로 동작해야 함을 명시한다.
5. 후속 migration issue 입력을 문서에 남긴다.
   - Neon schema/transaction migration.
   - R2 materialization/cache invalidation.
   - provider secrets/custom domain/observability/backup/retention.
   - 필요 시 Sites publish 운영 절차.

### 검증

```bash
node --test src/profile-backend/__tests__/store-contract.test.js src/profile-media/__tests__/media-store-contract.test.js src/profile-backend/__tests__/http.test.js
rg -n "Cloud Run|Neon|R2|Sites|OAuth|CORS|CSRF|fallback" docs/production-hosting.md
node scripts/verify-sites-artifact.mjs
npm test
git diff --check
```

검증 관점:

- Neon/R2 후속 adapter가 구현해야 할 atomicity, idempotency와 failure policy가 executable/document contract로 고정된다.
- 이번 Stage가 실제 provider client와 dual write를 도입하지 않는다.
- Sites origin에 credentialed mutation access를 열지 않는다.
- external/protocol-relative redirect와 wildcard credential CORS가 거부된다.
- official document가 수행계획서의 platform 책임과 fallback을 정확히 반영한다.

### 커밋

```text
Task #37 Stage 4: Neon R2 adapter 경계와 hosting 보안 계약 확정
```

## Stage 5 — 이중 배포·시각 비교와 fallback 결론

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

1. local hosting matrix를 자동화한다.
   - Cloud Run production server/container landing, health, API와 PNG route.
   - Sites build/preview의 anonymous landing, public card/Quickstart와 sign-in handoff.
   - Sites artifact를 제거하거나 unavailable 상태로 둔 Cloud Run-only fallback.
2. desktop/mobile 시각 비교를 수행한다.
   - 1280x900과 390x844에서 같은 fixture와 locale을 사용한다.
   - landing hero, card ratio, header, Quickstart, sign-in handoff의 clipping/overflow/overlap을 확인한다.
   - host별 허용된 차이는 authenticated capability와 sign-in destination뿐이어야 한다.
   - UI 차이가 있으면 작업지시자의 직접 시각 승인을 받고 승인 결과를 Stage 보고서에 기록한다.
3. security/privacy smoke를 수행한다.
   - Sites DOM/bundle에는 cookie, token, provider secret, owner-only metadata가 없어야 한다.
   - Cloud Run logs와 health response에는 secret, local storage path와 raw usage가 없어야 한다.
   - navigation URL에 session/token을 포함하지 않는다.
4. remote deployment는 별도 승인에 따라 분기한다.
   - 승인된 경우 Cloud Run과 Sites를 각각 배포하고 public health/landing/handoff를 smoke한다.
   - Neon/R2 실제 migration이 제외되어 있으므로 remote Cloud Run은 POC mode와 production readiness를 명확히 구분한다.
   - 승인되지 않았거나 credential이 없으면 remote 미검증을 숨기지 않고 local artifact 결과와 분리한다.
   - 임의 custom domain, DNS, paid database/bucket 또는 secret을 생성하지 않는다.
5. Sites가 실패하는 경우 Cloud Run-only fallback을 최종 권장안으로 유지하고 Sites dependency를 Cloud Run build/startup에서 제거할 수 있어야 한다.
6. 통합 검증 후 후속 issue 후보를 확정한다.
   - Neon production store migration.
   - R2 public card pipeline.
   - Cloud Run production deploy/secrets/observability.
   - optional Sites publication/operations.

### 검증

```bash
npm test
npm run build:cloud-run
npm run build:sites
node scripts/verify-sites-artifact.mjs
docker build -t codex-usage-profile:task37 .
node scripts/smoke-hosting-matrix.mjs
npm run test:e2e
git diff --check
```

검증 관점:

- Cloud Run canonical app이 Sites 없이 전체 MVP backend surface를 제공한다.
- Sites public frontend는 backend secret과 mutation capability 없이 build/preview된다.
- 두 host의 공개 landing이 대표 viewport에서 시각적으로 동등하고 텍스트가 잘리지 않는다.
- Sites sign-in 후 Cloud Run origin에서 인증 흐름을 계속한다.
- remote 미검증 항목과 provider migration 잔여 작업이 명확히 보고된다.
- full test/build/e2e와 작업지시자 시각 승인이 완료된다.

### 커밋

```text
Task #37 Stage 5: hosting matrix와 Cloud Run fallback 검증 완료
```

## 전체 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- `npm test`, Cloud Run/Sites build, container smoke와 `npm run test:e2e`를 최종 보고 전에 다시 실행한다.
- Docker와 remote provider 검증은 결과를 구분한다. local Node smoke를 container 또는 remote deployment 성공으로 대체 기록하지 않는다.
- 외부 resource/secret 생성 전 작업지시자 승인을 받고 승인 범위를 벗어난 custom domain이나 유료 resource를 만들지 않는다.
- UI 변경 또는 Cloud Run/Sites 시각 차이가 있으면 작업지시자 직접 검증 승인을 받은 뒤 다음 단계로 진행한다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지면 구현 전에 수행계획서 또는 구현계획서를 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 각 Stage 산출물과 `mydocs/working/task_m100_37_stage{N}.md`를 같은 단계 커밋에 묶는다.
- 커밋 메시지는 `Task #37 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- external credential 또는 remote deployment blocker만으로 불완전한 Stage를 완료 처리하지 않는다. 승인된 local-only 수용 기준으로 계획이 변경되면 먼저 문서와 승인을 갱신한다.

## 단계 의존성

- Stage 2는 Stage 1의 host capability와 deployment config 승인 후 진행한다.
- Stage 3은 Cloud Run canonical production host가 성립한 뒤 진행한다. Sites가 먼저 auth/backend 책임을 가져가지 않는다.
- Stage 4는 Cloud Run/Sites request/data 경계를 실제 artifact에서 확인한 뒤 adapter와 보안 계약을 확정한다.
- Stage 5는 Stage 4 공식 문서와 security contract 승인 후 진행한다.
- remote Cloud Run/Sites deployment는 Stage 2/3 local build가 통과하고 작업지시자가 외부 resource 생성을 승인한 경우에만 수행한다.

## 위험과 대응

- **Sites runtime 제약 변화**: Sites adapter를 optional build로 격리하고 Cloud Run build/startup이 Sites plugin이나 manifest에 의존하지 않게 한다.
- **동일 UI와 동일 기능의 혼동**: host capability를 UI contract에 주입하고 Sites에는 authenticated 상태나 mutation CTA를 모사하지 않는다.
- **Cross-origin 인증 확대**: Sites는 navigation handoff만 사용하며 session 공유, token query와 credentialed CORS를 금지한다.
- **Native renderer container 실패**: production Linux image에서 실제 PNG 생성/decode를 Stage 2 필수 smoke로 둔다.
- **Ephemeral file store 오용**: production mode에서 file store startup을 거부하고 POC mode를 명시적으로 분리한다.
- **Neon/R2 범위 확장**: adapter contract와 공식 문서까지만 구현하고 provider SDK, schema migration, bucket write는 후속 issue로 넘긴다.
- **이중 배포 drift**: shared component/CSS를 유지하고 host entry에는 capability/config만 둔다. 대표 viewport screenshot으로 차이를 검증한다.
- **Provider 비용과 secret 의존**: remote resource 생성은 별도 승인하며 local artifact 결과와 remote 결과를 분리한다.
- **Public data cache 불일치**: 이번 task에서는 media contract와 stable key/revision 정책만 확정하고 실제 R2 cache invalidation 완료를 주장하지 않는다.

## 승인 요청 사항

- 위 5개 Stage의 순서, 산출물, 검증 명령과 커밋 메시지
- Cloud Run을 먼저 canonical production host로 성립시킨 뒤 Sites public frontend를 연결하는 의존 순서
- Sites manifest의 D1/R2 binding을 `null`로 유지하고 sign-in을 Cloud Run navigation으로 제한하는 구현 경계
- production file store를 fail closed하고 Neon/R2는 adapter contract까지만 다루는 범위
- UI 변경 시 Stage 진행을 멈추고 desktop/mobile 시각 승인을 받는 검증 절차
- remote Cloud Run/Sites 배포와 외부 resource 생성은 local build 통과 후 별도 승인을 받는 조건

승인되면 Stage 1의 host capability와 deployment config 구현을 시작한다.
