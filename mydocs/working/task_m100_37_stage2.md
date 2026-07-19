# Task M100 #37 Stage 2 보고서

GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
구현계획서: [`task_m100_37_impl.md`](../plans/task_m100_37_impl.md)
Stage: 2

## 단계 목적

Vite 개발 미들웨어 없이 빌드된 제품 프론트엔드, 기존 API와 카드 PNG를 한 Node process에서 제공하는 Cloud Run container POC를 구현한다. Cloud Run의 `PORT`, `0.0.0.0`, Linux x86_64와 종료 신호 계약을 검증하고, durable adapter가 없는 production 시작은 fail closed하도록 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `Dockerfile` | Node 20 multi-stage build, production dependency와 정적 산출물만 포함한 non-root runtime image 구성 |
| `.dockerignore` | secret, local store, Git metadata, 개발 산출물의 build context 유입 차단 |
| `src/profile-runtime/production-server.js` | health/static/API/card routing, Cloud Run bind/port, production store 주입 경계, SIGTERM/SIGINT graceful shutdown 구현 |
| `src/profile-runtime/static-assets.js` | 정적 asset MIME/cache/security header, SPA fallback과 asset 404 경계 구현 |
| `src/profile-runtime/node-http.js` | Node request/response와 Web Fetch API 변환, listen/close 공통 처리 분리 |
| `src/profile-runtime/runtime-backend.js` | dev/production runtime이 공유하는 backend handler와 GitHub client 생성 책임 분리 |
| `src/profile-runtime/dev-server.js` | 공통 Node adapter와 backend 생성기를 재사용하도록 축소하고 기존 export 호환 유지 |
| `src/profile-runtime/__tests__/production-server.test.js` | static/SPA/cache/path, health/API/card route, arbitrary port, idempotent close, external adapter fail-closed 검증 |
| `scripts/smoke-cloud-run-container.mjs` | seeded store를 이용한 health/static/API/실제 PNG/SIGTERM smoke와 production file-store 거부·로그 비노출 검증 |
| `package.json` | production `start`, Cloud Run container smoke 명령 추가 |
| `README.md` | linux/amd64 container POC build/smoke 절차와 spike store 한계 명시 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. 기존 개발 서버의 request/response adapter와 runtime backend 생성 로직을 공통 모듈로 이동했으며, 기존 공개 export를 `dev-server.js`에서 재노출해 기존 테스트와 호출 계약을 유지했다. 제품 UI와 카드 렌더링 코드는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-runtime/__tests__/production-server.test.js src/profile-runtime/__tests__/deployment-config.test.js
npm run build:cloud-run
docker build -t codex-usage-profile:task37 .
node scripts/smoke-cloud-run-container.mjs codex-usage-profile:task37
docker build --platform linux/amd64 -t codex-usage-profile:task37-amd64 .
docker image inspect codex-usage-profile:task37-amd64 --format '{{.Architecture}} {{.Os}} {{.Config.User}}'
node scripts/smoke-cloud-run-container.mjs codex-usage-profile:task37-amd64
npm test
git diff --check
```

결과:

- OK: production server/deployment 집중 테스트 13개 통과
- OK: 전체 290개 테스트 통과
- OK: Cloud Run frontend build, 38개 module transform 및 production asset 생성
- OK: native Linux image build와 container smoke 통과
- OK: Cloud Run 대상 `linux/amd64` image build, `amd64 linux node` 확인과 container smoke 통과
- OK: 같은 process에서 `/healthz`, `/`, hashed JavaScript asset, anonymous API 401, unknown API 404와 실제 PNG signature 확인
- OK: SIGTERM 이후 exit code 0, secret/cookie/store path 로그 비노출 확인
- OK: `production + file store` container startup이 non-zero로 거부되고 generic startup 오류만 출력됨
- OK: `git diff --check` 통과

Cloud Run 대상 architecture 판단은 [Google Cloud Run container runtime contract](https://docs.cloud.google.com/run/docs/container-contract)의 Linux x86_64 ABI와 `0.0.0.0`/`PORT` 요구사항을 기준으로 했다.

## 잔여 위험

- production external store adapter는 아직 주입되지 않았으므로 실제 production 모드 container는 의도적으로 시작을 거부한다.
- Neon schema/migration, R2 media write와 provider credential은 Stage 3 이후 별도 범위다.
- 로컬 amd64 emulation은 대상 architecture의 image/PNG 실행을 검증하지만 실제 Cloud Run 배포, ingress, secret injection과 platform shutdown timing을 대체하지 않는다.
- 실제 production GitHub OAuth origin, secure cookie와 CSRF 정책은 Stage 3 보안 계약에서 검증해야 한다.

## 다음 단계 영향

- Stage 3은 `createProductionStore()`의 주입 경계를 기준으로 Neon 호환 store contract를 정의해야 한다.
- public media는 현재 on-demand PNG route를 유지한 채 R2 대상 key/etag/publish contract만 추가해야 한다.
- production file store 금지와 generic startup error 계약을 후속 adapter 구현에서도 유지해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3으로 진행한다.
