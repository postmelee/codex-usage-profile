# Task #83 Stage 3.8 완료 보고서

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 3.8

## 단계 목적

Stage 3.7의 owner-only version 15에서 `/?profile={handle}` 요청이 Worker에 도달하지 않고 정적 `index.html`로 처리되는 production 반증을 확인했다. 반면 `/u/{handle}` 및 `/api/...` 요청은 Worker에 전달되었다. 이 단계는 해당 증거를 바탕으로, 공개 프로필의 서버 렌더링 공유 문서를 Worker 전달이 보장되는 `/api/share/{handle}` 경로로 보정하는 것이 목적이다.

이번 보정은 공개 전환이 아니다. owner-only 재배포 전까지 production 계약은 변경하지 않으며, 별도 승인 후 보호된 환경에서 metadata와 readiness를 다시 검증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/public-profile-document.js` | `/api/share/{handle}`의 정확한 GET/HEAD 요청을 공개 프로필 문서 요청으로 해석하고 기존 `/u/{handle}` 및 root query 호환을 유지 |
| `src/profile-runtime/open-graph.js` | canonical 및 공유 URL 생성 계약을 `/api/share/{handle}`로 변경하고 social image 계약은 유지 |
| `src/profile-runtime/sites/observability.js` | `/api/share/{handle}`를 원시 handle 없이 `public_profile`로 분류 |
| `src/profile-ui/shareStudio.js` | Share Studio의 복사·공유 URL을 `/api/share/{handle}`로 변경 |
| `src/profile-ui/publicProfileRoutes.js` | 클라이언트 라우터가 `/api/share/{handle}`와 기존 호환 경로를 모두 인식하도록 보정 |
| `scripts/smoke-sites-fullstack-local.mjs` | full-stack 공유 문서 GET/HEAD 및 canonical 검증을 새 경로로 이동 |
| `src/profile-runtime/**/__tests__`, `src/profile-ui/__tests__`, `tests/profile-ui.spec.js` | runtime, Worker, 관측성, UI 및 E2E 회귀 검증을 새 경로 계약에 맞춰 보강 |
| `README.md`, `docs/readme-card.md`, `docs/sites-operations.md`, `docs/production-hosting.md` | 현재 saved version 7 화면, Stage 3.7 root query 한계, 다음 후보 `/api/share/{handle}`를 구분해 문서화 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | production 반증, Stage 3.8 보정 범위, 재배포·Gate B의 별도 승인 경계를 기록 |

## 본문 변경 정도 / 본문 무손실 여부

기존 공개 데이터 조회, 공개 여부 판정, README 카드, social image, OAuth/CLI 흐름 및 R2 자산 계약은 변경하지 않았다. `/u/{handle}`와 `/?profile={handle}` 파싱 호환도 유지하되, 사용자에게 제공하는 새 공유 문서 URL과 canonical만 Worker 전달 경로인 `/api/share/{handle}`로 이동했다.

공개 문서에는 아직 배포되지 않은 기능을 production CTA로 표현하지 않았고, 현재 production과 다음 배포 후보를 분리해 기존 사용자 안내를 보존했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-runtime/__tests__/public-profile-document.test.js src/profile-runtime/__tests__/public-profile-resolver.test.js src/profile-runtime/__tests__/open-graph.test.js src/profile-runtime/sites/__tests__/backend.test.js src/profile-runtime/sites/__tests__/observability.test.js src/profile-runtime/sites/__tests__/worker.test.js src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js src/profile-ui/__tests__/appRoutes.test.js src/profile-ui/__tests__/accountUi.test.js
npm run smoke:sites-fullstack:local
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:production-build
git diff --check
```

결과:

- 집중 Node 검증: 73/73 통과
- 로컬 Sites full-stack smoke: `ok: true`, 44개 route 검증 통과
- 전체 Node 검증: 709개 중 703개 통과, 6개 환경 조건 skip, 실패 0
- Playwright E2E: 64/64 통과
- production build: production manifest 제거 확인, 보존 대상 0
- full-stack verifier: client 7, worker 2, migration 5, raw 3,992,787 bytes, gzip 2,164,520 bytes 확인
- production build verifier: artifact 4,888,456 bytes, bindings 3, migration 5 및 동일 Worker 크기 확인
- `git diff --check`: 이상 없음

## 잔여 위험

- `/api/share/{handle}`가 실제 Sites owner-only production에서 Worker에 전달되고 canonical/OG/Twitter metadata를 반환하는지는 아직 검증하지 않았다.
- 현재 원격은 안전한 owner-only version 15 상태이며, 이 단계에서는 새 배포·환경 변경·readiness 처리·Gate B 판정을 수행하지 않았다.
- 실제 배포 검증에서 새 경로가 기대와 다르면 fail-closed로 중단하고 public 전환으로 진행하지 않아야 한다.

## 다음 단계 영향

- 별도 승인 후 이 Stage 3.8 커밋을 owner-only saved version으로 배포한다.
- 보호된 세션과 비로그인 경계에서 `/api/share/{handle}` GET/HEAD, canonical, OG/Twitter, fallback, 비공개/미존재 응답과 로그 비식별화를 확인한다.
- production 증거가 모두 통과한 뒤 migration 3~5 readiness를 수행하고, 그 결과를 근거로 Gate B 승인을 다시 요청한다.
- Gate B 이전에는 public access 전환과 X·Threads·카카오톡 실측을 수행하지 않는다.

## 승인 요청

- Stage 3.8 산출물과 검증 결과를 승인하면 이 커밋의 owner-only 재배포 및 보호된 `/api/share/{handle}` metadata/readiness 검증으로 진행한다. public 전환은 이번 승인 범위에 포함하지 않는다.
