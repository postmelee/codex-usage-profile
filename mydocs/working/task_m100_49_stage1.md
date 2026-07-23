# Task #49 Stage 1 보고서 — Sites full-stack compatibility 경계와 local harness

GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
구현계획서: [`task_m100_49_impl.md`](../plans/task_m100_49_impl.md)
Stage: 1

## 단계 목적

기존 sample-only Sites marketing artifact와 분리된 full-stack React/Vite + Cloudflare Worker build 경계를 만든다. `/api/*`와 `/u/{handle}/card.png`를 backend seam으로 먼저 라우팅하고, 아직 구현하지 않은 D1/R2/backend는 503으로 닫는다. 기존 marketing, Cloud Run과 product build를 그대로 유지하면서 hosted artifact에 Node HTTP/filesystem, Postgres, AWS SDK와 native canvas가 들어가지 않음을 검증한다.

외부 GitHub OAuth는 starter가 제공하는 SIWC로 교체하지 않는다. 현재 Sites surface가 public access와 server-only runtime environment secret을 제공하고, dispatcher reserved callback `/callback`과 제품 callback `/api/auth/github/callback`이 충돌하지 않음을 확인했다. 실제 GitHub callback 성공은 계획대로 Stage 5 public Gate에서 검증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `build/sites-fullstack-vite-plugin.js` | 현재 Sites starter의 local `sites()` packaging 방식을 기존 project output에 맞게 적용하고 hosting metadata를 full-stack artifact에 포함 |
| `vite.sites-fullstack.config.js` | product React client와 Worker ESM을 `dist-sites-fullstack`에 분리 build하는 Cloudflare Vite 설정 |
| `src/profile-runtime/sites/config.js` | `ASSETS`/future `DB`/`PROFILE_MEDIA`, GitHub OAuth runtime secret, callback URL과 canonical origin 검증 |
| `src/profile-runtime/sites/backend.js` | Stage 2 전 API/public card 요청을 generic 503으로 닫는 injectable backend seam |
| `src/profile-runtime/sites/worker.js` | backend-first route, `ASSETS` direct read와 SPA fallback을 합성하는 Worker default export |
| `src/profile-runtime/sites/__tests__/config.test.js` | binding, OAuth callback, canonical origin과 secret-safe failure 6건 |
| `src/profile-runtime/sites/__tests__/worker.test.js` | API/public route, asset/SPA, fail-closed와 origin failure 5건 |
| `scripts/verify-sites-fullstack-artifact.mjs` | client/server/manifest shape, ESM export, forbidden import와 client secret 경계 검사 |
| `scripts/__tests__/verify-sites-fullstack-artifact.test.js` | 정상 artifact와 client secret/Node import/binding 조기 변경 거부 4건 |
| `package.json`, `package-lock.json` | current Sites starter와 같은 `@cloudflare/vite-plugin`/Wrangler 개발 도구 및 build/preview/verify script |
| `.gitignore` | generated full-stack artifact와 local Wrangler state 제외 |

신규 implementation/test/config 본문은 총 874줄이다. lockfile은 개발 도구의 transitive dependency 고정으로 1,521줄 추가, 27줄 삭제되었다.

`.openai/hosting.json`은 `d1: null`, `r2: null` 상태를 유지했고 `project_id`를 추가하지 않았다. Site, D1, R2, OAuth app, runtime secret과 access policy는 생성하거나 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

기존 product UI, backend service, Node runtime, Postgres/S3 adapter와 marketing Sites source는 수정하지 않았다. full-stack build와 Worker composition을 별도 파일·script·output directory로 추가했다.

기존 `npm run build`, `npm run build:cloud-run`, `npm run build:sites`가 모두 통과해 기존 artifact 의미가 보존됨을 확인했다. full-stack API가 실제 backend를 제공하는 것처럼 가장하지 않고 Stage 2 binding 전까지 `sites_backend_unavailable` 503으로 fail closed한다.

## 검증 결과

구현계획서 Stage 1 명령:

```bash
node --test src/profile-runtime/sites/__tests__/config.test.js
node --test src/profile-runtime/sites/__tests__/worker.test.js
node --test scripts/__tests__/verify-sites-fullstack-artifact.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run build:sites
npm run build:cloud-run
npm run build
node --test
git diff --check
```

결과:

- OK — Sites config test: 6/6 통과
- OK — Sites Worker test: 5/5 통과
- OK — artifact verifier test: 4/4 통과
- OK — full-stack build: Worker ESM 8.23 kB, client entry 304.88 kB, `ASSETS` binding과 `.openai/hosting.json` package 생성
- OK — artifact verifier: client 7 files, Worker 1 JS file, forbidden hosted import/client secret pattern 없음
- OK — marketing Sites build 통과
- OK — Cloud Run build 통과
- OK — default product build 통과
- OK — 전체 test: 393개 중 387 pass, 6 skip, 0 fail
  - skip은 기존 `TEST_DATABASE_URL`/`TEST_S3_*` 미설정 integration test다.
  - sandbox 안의 최초 실행은 production-server test 3건이 local listen `EPERM`으로 실패했으나, 동일 명령을 local listen 권한으로 재실행해 모두 통과했다.
- OK — local workerd smoke:
  - `GET /` → 200
  - `GET /settings` → 200 SPA fallback
  - `GET /api/auth/me` → 503 `sites_backend_unavailable`
- OK — `npm audit --omit=dev --audit-level=high`: production dependency 취약점 0건
- OK — `git diff --check`: 경고 없음

## Sites·외부 OAuth capability 확인

- current Sites starter는 별도 Sites npm package가 아니라 local `sites()` metadata plugin과 `@cloudflare/vite-plugin`을 사용한다. 이번 Stage도 같은 구조를 기존 Vite application에 적용했다.
- current Sites authentication guide는 public/external identity provider를 starter에서 새로 scaffold하지 말고 platform path를 확인하도록 요구한다.
- 현재 callable Sites surface에서 다음 platform primitive를 확인했다.
  - production runtime environment variable을 secret으로 저장하는 surface
  - Site를 public/custom/workspace access로 설정하는 surface
  - public URL의 Worker에 identity-less API request를 전달하는 deployment model
- dispatcher-owned SIWC reserved route는 `/callback`이고 제품 GitHub callback은 `/api/auth/github/callback`이므로 route 충돌이 없다.
- OpenAI developer-docs 검색에서는 Sites의 app-owned external OAuth를 명시적으로 보증하는 별도 공개 문서를 찾지 못했다. 따라서 Stage 1은 “지원 primitive와 local composition 확인”까지만 PASS로 보고, 실제 GitHub redirect/callback/session과 외부 CLI 접근은 Stage 5 Gate B의 hard acceptance로 유지한다.

## 잔여 위험

- Stage 1 Worker는 의도적으로 D1/R2와 실제 backend를 연결하지 않아 모든 API/public card 요청이 503이다. Stage 2부터 순서대로 해소한다.
- GitHub OAuth hosted 성공은 아직 검증하지 않았다. 현재 platform primitive는 확인했지만 실제 public callback이 실패하면 Stage 5에서 전체 Sites architecture를 FAIL 처리한다.
- current bundled Sites starter가 고정한 build/preview 개발 도구는 full `npm audit`에서 dev-only 취약점 7건을 보고한다. production dependency audit는 0건이고 배포 Worker/client bundle에는 해당 도구가 포함되지 않는다. local preview를 외부에 노출하지 않으며, Stage 5 전 current Sites template/toolchain 갱신 여부를 재확인한다.
- current Sites starter toolchain 일부는 Node 22 이상을 요구한다. 이번 build/smoke는 Node 24.15.0에서 통과했다. Cloud Run Node 20 artifact는 변경하지 않았지만 Sites build 재현 환경은 Node 22+로 관리해야 한다.
- D1/R2 logical binding은 계획대로 아직 `null`이다. 실제 binding/resource availability는 Stage 5 전에는 주장하지 않는다.

## 다음 단계 영향

- Stage 2는 `createProfileSitesWorker({ createBackendHandler })` seam을 사용해 D1 store와 shared rate limiter를 주입한다.
- `loadProfileSitesConfig({ requireDataBindings: true })`가 `DB`와 `PROFILE_MEDIA`의 조기 오구성을 generic 503으로 닫을 수 있다. Stage 2에서는 `DB`를 먼저 사용하되 `.openai/hosting.json`은 remote Gate 전까지 계속 `null`로 둔다.
- D1 adapter가 generic callback transaction을 모방하지 않도록 5개 named atomic operation을 실제 service call boundary로 승격해야 한다.
- Stage 2 artifact도 이번 verifier를 통과해야 하며, Worker import graph에 Postgres/Node filesystem이 유입되면 실패로 처리한다.

## 승인 요청

- Stage 1의 별도 full-stack Worker build, fail-closed backend seam, OAuth callback/origin 경계와 검증 결과를 승인하면 Stage 2 D1 structured store 및 named atomic operation POC로 진행한다.
