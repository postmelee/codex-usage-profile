# Task #49 Stage 4 보고서 — Worker PNG renderer와 local full-stack 통합

GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
구현계획서: [`task_m100_49_impl.md`](../plans/task_m100_49_impl.md)
Stage: 4

## 단계 목적

기존 native PNG renderer와 public/private profile 계약을 유지하면서 Sites Worker에서 실행 가능한 JS/Wasm renderer를 추가한다. D1 store, shared rate limiter, native R2 binding, GitHub OAuth client, Worker renderer와 frontend asset binding을 하나의 local Worker runtime에 합성하고, 브라우저 session부터 실제 CLI device login/submit, private preview, publish/unpublish와 public serving까지 검증한다.

이번 Stage는 local build와 smoke까지만 수행했다. Site, D1, R2, OAuth app, runtime secret, saved version과 public deployment는 생성하거나 변경하지 않았다. `.openai/hosting.json`은 계속 `d1: null`, `r2: null`이며 `project_id`가 없다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/worker-renderer.js` | SVG layout과 `@resvg/resvg-wasm` rasterization으로 결정적 1497×918 PNG를 만드는 Worker renderer |
| `src/profile-card/worker-renderer-assets.js`, `assets/*.bin` | Wasm module과 Noto Sans KR 400/600 Korean/Latin font 4개를 build-time asset으로 주입 |
| `src/profile-card/service-core.js`, `service.js` | renderer-neutral card service core와 native renderer wrapper 분리, 기존 digest/cache/avatar 계약 유지 |
| `src/profile-card/renderer.js`, `index.js` | native fallback의 byte avatar 호환과 Worker renderer export |
| `src/profile-card/__tests__/worker-renderer.test.js` | `en`/`ko` 크기·결정성·정보 항목·digest 분리·avatar fallback 검증 |
| `src/profile-card/__tests__/worker-renderer-visual.test.js` | 대표 native/Worker 카드와 fallback 카드 시각 산출물 및 주요 영역 회귀 검증 |
| `src/profile-runtime/sites/backend.js`, `worker.js`, `worker-entry.js` | D1/R2/GitHub/renderer 전체 production composition과 asset route 결합 |
| `src/profile-runtime/sites/__tests__/_full-stack-worker-harness.js`, `full-stack.test.js` | 실제 workerd D1/R2, OAuth stub, Worker renderer와 frontend asset을 포함한 local test harness |
| `scripts/smoke-sites-fullstack-local.mjs` | 실제 CLI package entry로 device login→approve→exchange→submit 후 publish/public/unpublish를 검증하는 smoke |
| `vite.sites-fullstack.config.js`, `build/sites-fullstack-vite-plugin.js` | production/test Worker entry 분리와 `db/migrations/*.sql`의 `.openai/drizzle/` package |
| `scripts/verify-sites-fullstack-artifact.mjs`와 test | Wasm 1개, font 4개, D1 migration 2개, ESM/secret/import와 3 MB 압축 상한 검증 |
| `src/profile-backend/http.js`, `src/profile-runtime/runtime-backend.js`와 test | HTTP factory의 renderer injection과 Node/Cloud Run native 기본값 보존 |
| `package.json`, `package-lock.json` | `@resvg/resvg-wasm@2.6.2`와 local full-stack smoke 명령 추가 |

Worker renderer 본문은 342줄, renderer-neutral service core는 335줄이다. 전용 renderer test는 292줄이고 local full-stack smoke/harness/test는 542줄이다. bundled font 원본은 합계 1,124,468 bytes다.

`@resvg/resvg-wasm@2.6.2`의 license는 MPL-2.0, `@fontsource/noto-sans-kr@5.2.9`의 font license는 OFL-1.1로 확인했다.

Sites 호스팅 package 규칙에 맞춰 이미 승인된 D1 SQL 2개를 `dist-sites-fullstack/.openai/drizzle/`에 포함한다. Stage 4에서 schema를 새로 변경하거나 remote migration을 실행하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

외부 frontend/API/public card 계약은 변경하지 않았다. 인증된 `/api/profile/card.png`는 계속 on-demand, `no-store` private preview이고 `/u/{handle}/card.png`는 R2 stable publication만 GET/HEAD/304로 제공한다. private/missing/unpublished는 같은 404로 닫힌다.

기존 native renderer와 Node/Cloud Run runtime은 `service.js` wrapper 및 `runtime-backend.js` 기본 주입으로 유지했다. Worker hosted import graph만 native canvas를 제외하고 renderer-neutral core와 JS/Wasm renderer를 사용한다. application ETag는 계속 최종 PNG SHA-256 base64url digest이며 renderer version은 source digest를 분리한다.

avatar fetch는 기존 service의 `avatars.githubusercontent.com` HTTPS 제한, 3초 timeout, 2 MiB 상한과 PNG/JPEG/GIF/WebP allowlist를 재사용한다. fetch 또는 decode가 실패하면 initial fallback으로 수렴한다.

## 검증 결과

구현계획서 Stage 4 명령:

```bash
node --test src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-card/__tests__/worker-renderer-visual.test.js
node --test src/profile-runtime/sites/__tests__/full-stack.test.js
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
npm run build
npm run build:cloud-run
npm run build:sites
npm test
npm run test:e2e
git diff --check
```

결과:

- OK — Worker renderer 4/4와 visual regression 1/1 통과
  - 동일 `en`/`ko` 입력을 각각 두 번 렌더링한 PNG가 byte-identical
  - native/Worker 모두 1497×918
  - 한글 font, locale label, 전체 stat 정보, avatar success/failure 확인
- OK — local full-stack 1/1과 독립 smoke 통과
  - browser OAuth stub session, 실제 CLI device login/approve/exchange/submit
  - D1 migration version 1·2, structured store와 shared rate limit
  - R2 immutable/stable publication, private preview
  - public profile/card GET/HEAD/304, publish 전·unpublish 후 404
  - 같은 Worker runtime에서 15개 핵심 route 검증
- OK — full-stack build와 artifact verifier
  - client 7 files, Worker JS 1개, Wasm 1개, font 4개, D1 migration 2개
  - Worker raw 3,823,843 bytes, 파일별 gzip 합계 2,129,722 bytes
  - 3,000,000-byte 검증 상한의 70.99%
  - client에 server-only module/secret 이름 없음
  - Worker에 native canvas, S3/AWS SDK, Postgres와 filesystem import 없음
- OK — 기존 `build`, `build:cloud-run`, `build:sites` 통과
- OK — 전체 Node test 435개 중 429 pass, 6 skip, 0 fail
  - skip은 기존 `TEST_DATABASE_URL`/`TEST_S3_*` 미설정 integration test다.
- OK — Playwright E2E 15/15 통과
- OK — `git diff --check`: 경고 없음

### 시각 승인 산출물

대표 카드:

| 산출물 | 크기 | bytes | SHA-256 |
|---|---:|---:|---|
| native `en` | 1497×918 | 153,584 | `fb0c0663f6f3795924901312f22da17fe5de3cb8215a614b4df5dfb2b9bbde45` |
| Worker `en` | 1497×918 | 147,718 | `c5c6a14382e0c3fa41f9ff109a47256b8f0dc7a59bcc66ab56d52c83ebcb33aa` |
| native `ko` | 1497×918 | 146,803 | `6154b2d0026f81f37d21cc2686822d55a989e441a366e9da1b64fe0e1fe43fa5` |
| Worker `ko` | 1497×918 | 140,564 | `68aebbf20ca0ff26e0b3b10cd94d04c5050946f9a23e00ebb8c4d96bfa290596` |
| Worker avatar fallback `ko` | 1497×918 | 100,981 | `307a19435d6334e90c9f294ac78ebb25b74c729e44c846b042b05b14bd21ec01` |

현재 UI route screenshot:

| 화면 | desktop | mobile |
|---|---|---|
| login/home | 1280×1291 full page | 390×1355 full page |
| public profile | 1280×900 | 390×844 |
| device approval | 1280×900 | 390×844 |

local Worker 실측:

| 항목 | 결과 |
|---|---:|
| private preview cold HTTP wall time | 141.60 ms |
| private preview warm HTTP wall time | 68.16 ms |
| publish HTTP wall time | 150.57 ms |
| smoke public PNG | 84,966 bytes |
| Worker raw / gzip 합계 | 3,823,843 / 2,129,722 bytes |

이 latency는 local macOS의 HTTP wall time이며 provider CPU time이나 hosted p95가 아니다. 시각 산출물은 repository 밖 임시 경로에서 생성했고 source/commit에는 포함하지 않았다.

## 잔여 위험

- Worker artifact는 현재 Cloudflare Workers Free의 compressed script 3 MB 상한보다 작지만 70.99%를 사용한다. source map, platform packaging 방식이나 renderer/font 증가에 따라 여유가 줄 수 있다. 공식 limits: [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Cloudflare Workers Free의 일반 CPU allowance는 요청당 10 ms로 안내되지만 local wall time은 CPU time과 같지 않으며 OpenAI Sites public beta의 account별 managed runtime 한도도 공개된 고정 수치가 아니다. 따라서 renderer가 실제 hosted 한도에서 실행되는지는 Stage 5 Gate A/B에서 측정해야 한다. 공식 안내: [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Creating and managing ChatGPT Sites](https://help.openai.com/en/articles/20001339-creating-and-managing-chatgpt-sites)
- local workerd는 실제 remote D1/R2/OAuth/Sites routing과 quota를 대신하지 않는다. remote migration, secret, public callback, cold/warm latency와 로그 redaction은 Stage 5 전까지 미검증이다.
- JS/Wasm renderer는 native PNG와 byte-identical하지 않다. 정보 구조·크기·locale·가독성은 보존했지만 Stage 5 진입 전 작업지시자의 대표 이미지 시각 승인이 필요하다.
- Wasm 2.48 MB와 한글 font 1.12 MB가 raw bundle의 대부분이다. hosted runtime limit 또는 latency가 부적합하면 font subset 또는 pre-render/external renderer 재검토가 필요하다.
- `@resvg/resvg-wasm` 추가 뒤 `npm install`은 저장소 dependency tree에서 audit 결과 7건(1 low, 6 high)을 보고했다. 해당 package 자체의 transitive dependency는 0개이며 강제 audit fix는 범위 밖이라 실행하지 않았다.

## 다음 단계 영향

- 작업지시자의 Stage 4 시각 승인 전에는 Stage 5 external Gate A로 진행하지 않는다.
- 시각 승인 뒤 Stage 5 Gate A에서는 현재 account의 Sites 포함량/한도, `.openai/hosting.json` 상태, resource 이름, D1 migration command, nonproduction seed, GitHub OAuth callback/secret 입력과 restricted deployment 정책을 다시 제시하고 별도 승인을 받아야 한다.
- Gate A 승인 전까지 Site/D1/R2/project linkage를 만들지 않고 `.openai/hosting.json`의 `d1`/`r2`를 `null`로 유지한다.
- Stage 5 remote 결과에서 bundle/runtime/비용/기능 중 하나라도 수용 기준을 통과하지 못하면 Sites를 canonical MVP로 판정하지 않는다.

## 승인 요청

- 위 native/Worker `en`/`ko`, avatar fallback과 desktop/mobile login·profile·device approval 화면의 정보 보존과 가독성을 승인하면 Stage 5 Gate A 입력안을 제시한다.
- 이 승인은 Stage 5 resource 생성이나 deployment 승인과 분리된다. 다음 응답에서 Gate A를 검토한 뒤 명시적으로 승인받기 전에는 external 변경을 수행하지 않는다.
