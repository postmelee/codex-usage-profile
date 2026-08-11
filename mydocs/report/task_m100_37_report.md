# Task M100 #37 최종 보고서

GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
마일스톤: M100

## 작업 요약

- 대상 이슈: #37
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: Cloud Run + Neon + R2를 canonical MVP architecture로 확정하고, Cloud Run 제품 runtime과 sample-only Sites marketing mirror를 서로 독립적인 POC로 검증한다.

Cloud Run은 GitHub OAuth, session, device login, CLI submit, card 생성·공유를 소유하는 단일 제품 runtime으로 정리했다. Sites는 공용 marketing component와 CSS로 sample card, Hero, Quickstart, Cloud Run root CTA만 렌더링하며 API, account, session 또는 provider storage를 소유하지 않는다. Neon structured store와 R2 public media는 실행 가능한 adapter contract까지만 정의하고 실제 provider migration과 remote deployment는 후속 작업으로 분리했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-runtime/` | production deployment config, Node HTTP adapter, static asset handler, Cloud Run server와 lifecycle을 추가했다. | Cloud Run startup, health, frontend/API/card route, graceful shutdown |
| `Dockerfile`, `.dockerignore` | Node 20 multi-stage production image와 non-root runtime을 구성했다. | Cloud Run container artifact, Linux native PNG renderer |
| `src/profile-backend/store-contract.js`, `src/profile-media/media-store-contract.js` | Neon/R2 후속 adapter가 지켜야 할 atomicity, idempotency, immutable revision과 publish 계약을 실행 가능한 형태로 정의했다. | durable structured store와 public card media 후속 구현 경계 |
| `src/profile-backend/http.js` | local-only OAuth return path, same-origin mutation과 explicit cross-origin 거부를 보강했다. | OAuth redirect, session mutation, CORS/CSRF 보안 경계 |
| `src/profile-marketing/` | 제품 Home과 Sites가 공유하는 sample-only marketing landing과 host별 config/entry를 분리했다. | Hero, sample card, Quickstart, Cloud Run CTA |
| `.openai/hosting.json`, `vite.sites.config.js`, `build/sites-vite-plugin.js`, `sites.html` | Sites-compatible 정적 marketing build POC를 추가했다. | 선택적 이벤트·홍보용 Sites mirror |
| `scripts/smoke-cloud-run-container.mjs`, `scripts/verify-marketing-artifact.mjs`, `scripts/smoke-hosting-matrix.mjs` | container runtime, sample-only artifact와 두 host 독립성을 검증한다. | 로컬 production POC와 privacy/failure boundary QA |
| `tests/profile-ui.spec.js`, `src/**/__tests__/` | deployment, production server, store/media contract, marketing config와 desktop/mobile 시각 계약 회귀를 추가했다. | 자동 수용 기준과 브라우저 회귀 |
| `docs/production-hosting.md`, `README.md` | canonical architecture, secret 분류, startup/fallback, 검증 완료·미완료 경계를 문서화했다. | 유지보수자와 후속 production migration 작업 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/orders/` | 수행·구현 계획, Stage 1~5 보고와 작업 상태를 기록했다. | Hyper-Waterfall 이력과 승인 근거 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| production hosting architecture와 platform boundary | `docs/production-hosting.md` | `docs/production-hosting.md` | OK | 구현계획서의 공식 제품 문서 위치와 일치한다. |
| Cloud Run·Sites Stage별 POC 및 검증 기록 | `mydocs/working/` | `mydocs/working/task_m100_37_stage1.md` ~ `task_m100_37_stage5.md` | OK | 일회성 검증 기록을 공식 제품 문서와 분리했다. |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_37.md`, `task_m100_37_impl.md` | OK | 계획된 Hyper-Waterfall 문서 위치와 일치한다. |
| 최종 결과보고서 | `mydocs/report/` | `mydocs/report/task_m100_37_report.md` | OK | 구현계획서의 최종 보고 위치와 일치한다. |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| production 제품 runtime | Vite local development host | Cloud Run용 production Node host와 multi-stage container POC |
| marketing 배포 surface | 제품 Home 단일 surface | 제품 Home + sample-only Sites mirror POC |
| hosting smoke entrypoint | 없음 | container smoke와 cross-host hosting matrix 2개 |
| durable store/media 경계 | file/memory 구현에 암묵적 | structured store와 public media 실행 계약 2개 |
| 최종 자동 검증 | Task 수용 검증 없음 | unit 305개, Playwright 15개, 두 production build, Docker/container 및 hosting matrix 통과 |
| 변경 규모 (`devel..HEAD`, 최종 보고서 포함) | 0 | 52개 파일, 4,713줄 추가·406줄 삭제 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| Sites 없이 Cloud Run artifact만으로 MVP 제품 경로가 동작한다. | OK — production build, Docker image, health/frontend/API/PNG/SIGTERM container smoke를 통과했다. |
| Sites bundle과 DOM에 account/API/session/secret/provider storage 코드가 없다. | OK — sample-only artifact 6개 검사와 hosting matrix의 sentinel 비노출 검사를 통과했다. |
| Sites CTA가 OAuth parameter나 사용자 식별자 없이 Cloud Run `/`로 이동한다. | OK — configured canonical origin의 root CTA를 artifact와 browser test에서 확인했다. |
| 두 host가 desktop/mobile에서 동일한 marketing UI를 보여준다. | OK — 1280x900과 390x844 metric 비교 E2E가 통과했고 작업지시자가 최종 화면을 승인했다. |
| Sites 실패가 Cloud Run MVP 검증과 출시를 막지 않는다. | OK — Sites 시작 전·실행 중·종료 후 Cloud Run health/frontend/API가 유지됐다. |
| remote provider 검증과 local artifact 결과를 구분한다. | OK — 공식 hosting 문서와 Stage 5 보고서에 원격 미검증 항목을 별도로 명시했다. |

최종 통합 검증:

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

- unit test 305개 통과, 실패 0개.
- Cloud Run 38개 모듈과 Sites 22개 모듈 production build 통과.
- Docker image build와 실제 container smoke 통과.
- sample-only Sites 파일 6개 검증과 hosting matrix 통과.
- Playwright 15개 통과, 실패 0개.
- `git diff --check` 통과.

### 단계별 검증 결과

- Stage 1: [`task_m100_37_stage1.md`](../working/task_m100_37_stage1.md) — deployment config와 공용 marketing component 경계를 확정했다.
- Stage 2: [`task_m100_37_stage2.md`](../working/task_m100_37_stage2.md) — Cloud Run production server와 Linux container smoke를 구현·검증했다.
- Stage 3: [`task_m100_37_stage3.md`](../working/task_m100_37_stage3.md) — Neon/R2 adapter 및 same-origin 보안 계약을 실행 가능한 테스트와 공식 문서로 고정했다.
- Stage 4: [`task_m100_37_stage4.md`](../working/task_m100_37_stage4.md) — sample-only Sites build/preview와 Cloud Run CTA를 검증했다.
- Stage 5: [`task_m100_37_stage5.md`](../working/task_m100_37_stage5.md) — Cloud Run 우선 hosting matrix, 전체 회귀와 desktop/mobile 시각 승인을 완료했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 Cloud Run, Neon, R2 또는 Sites 원격 리소스를 생성하거나 배포하지 않았다.
- Neon schema/migration, multi-instance transaction과 R2 immutable object materialization/cache invalidation은 아직 구현되지 않았다.
- production secret 주입, custom domain, observability, alerting, backup/retention과 shared abuse protection은 검증하지 않았다.
- 현재 JSON file store는 production durable source가 아니며 production mode에서는 fail closed한다.
- Sites remote publication은 optional marketing 작업이며 MVP readiness를 대신하지 않는다.

### 후속 작업 후보

- Neon production store adapter, schema migration과 multi-instance atomicity 구현.
- R2 public card materialization, stable object 갱신과 cache invalidation 구현.
- Cloud Run production resource, secrets, custom domain, observability와 rollback 구성.
- 실제 production login → device approval → submit → publish/share → stable image URL end-to-end smoke.
- optional Sites event publication과 유지·폐기 기준 확정.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 `publish/task37` 게시와 `devel` 대상 PR 생성 절차로 진행한다.
