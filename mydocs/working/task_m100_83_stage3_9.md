# Task #83 Stage 3.9 완료 보고서

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 3.9

## 단계 목적

Stage 3.8 owner-only version 16의 protected `/api/share/{handle}` metadata와
migration readiness는 통과했지만, Gate B 2차에서 기존 version 7 publication의
README card는 `200`이고 metadata가 선언한 social PNG는 `404`인 불일치가
확인됐다. missing 문서도 실제 운영자 social object에 의존해 깨진 이미지를
선언했다.

이 단계는 D1 공개 projection 뒤 R2 dark authority와 social metadata를 읽기
전용으로 대조해 정합한 개인화 이미지만 선언하고, legacy·missing·mismatch·provider
failure에서는 저장소에 포함된 2400x1260 sample을 사용하도록 보정하는 것이
목적이다. 실제 production 사용자의 설정·사용량·visibility를 변경하거나 on-demand
R2 backfill은 수행하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `public/assets/codex-social-sample.png`, `scripts/generate-social-sample.mjs` | 기존 sample view model과 renderer로 결정적으로 생성하는 2400x1260 packaged social fallback 추가 |
| `src/profile-card/__tests__/social-sample-asset.test.js` | packaged PNG와 재렌더 결과의 byte equality 및 exact dimensions 검증 |
| `src/profile-runtime/public-profile-resolver.js` | D1 공개 판정 뒤 R2 authority/social owner·publication id 및 ETag 정합성을 body 없이 확인하고 실패를 `socialImageAvailable=false`로 축약 |
| `src/profile-runtime/open-graph.js`, `src/profile-runtime/public-profile-document.js` | 실제 사용자 handle fallback 의존성을 제거하고 정합한 publication만 versioned personalized image, 나머지는 static sample을 선언 |
| `src/profile-runtime/sites/worker.js`, `src/profile-runtime/dev-server.js`, `src/profile-runtime/production-server.js` | Sites·개발·fallback production document resolver에 동일 media store를 연결 |
| `src/profile-runtime/sites/observability.js` | `social.png` GET/HEAD를 raw handle 없는 `public_card` route class로 축약 |
| `src/profile-runtime/**/__tests__`, `src/profile-runtime/sites/**/__tests__` | coherent·missing·mismatch·provider failure·private/missing·관측성 회귀 검증 보강 |
| `scripts/smoke-sites-fullstack-local.mjs` | static fallback GET/HEAD, personalized social, R2 social 제거 뒤 legacy HTML fallback과 personalized route 404를 real Worker·D1·R2·ASSETS에서 검증 |
| `docs/readme-card.md`, `docs/production-hosting.md`, `docs/sites-operations.md` | owner-only version 16 기준선, legacy social blocker, packaged fallback과 재배포·Gate 분리를 공식 문서에 반영 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Gate B 2차 반증, Stage 3.9 승인 범위·검증·커밋·Stage 4 의존성 기록 |

## 본문 변경 정도 / 본문 무손실 여부

README card/public API/visibility/R2 publication·ETag와 personalized social route의
404/503 계약은 변경하지 않았다. 공개 HTML이 social object의 존재를 추정하지 않고
실제 metadata 정합성을 확인하도록 읽기 경계만 강화했다. fallback은 사용자 데이터를
생성·수정하지 않으며 missing/private 문서는 계속 byte-identical 기본 metadata를
반환한다.

공개 문서는 현재 remote가 saved version 16 custom owner-only라는 사실과 다음 후보를
분리해 기록했다. 새 기능을 production CTA로 활성화하지 않았고, owner-only 재배포와
별도 Gate B 전에는 공개 전환을 안내하지 않는다.

## 검증 결과

실행 명령:

```bash
node scripts/generate-social-sample.mjs
node --test src/profile-card/__tests__/social-sample-asset.test.js src/profile-runtime/__tests__/public-profile-resolver.test.js src/profile-runtime/__tests__/open-graph.test.js src/profile-runtime/__tests__/public-profile-document.test.js src/profile-runtime/sites/__tests__/observability.test.js
npm run smoke:sites-fullstack:local
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- packaged sample: PNG 2400x1260, 재렌더 결과와 byte-identical
- 집중 Node 검증: 43/43 통과
- 로컬 Sites full-stack smoke: `ok: true`, 50개 route 검증 통과
- 전체 Node 검증: 712개 중 706개 통과, 6개 환경 조건 skip, 실패 0
- Playwright E2E: 64/64 통과
- production build: production manifest 제거 확인, 보존 대상 0
- full-stack verifier: client 8, worker 2, migration 5, raw 3,992,969 bytes,
  gzip 2,164,473 bytes 확인
- production verifier: artifact 5,095,456 bytes, bindings 3, migration 5 및
  동일 Worker 크기 확인
- `git diff --check`: 이상 없음

## 잔여 위험

- Stage 3.9 source는 아직 Sites에 배포하지 않았다. 현재 remote는 saved version 16,
  custom owner-only revision 49, maintenance disabled, service normal, operator secret
  absent 기준선이다.
- 새 owner-only saved version에서 legacy `/api/share/{handle}`가 packaged asset을
  선언하고 그 asset이 protected GET/HEAD `200 image/png`인지 아직 실측하지 않았다.
- X·Threads·카카오톡과 disposable 계정 mutation은 시작하지 않았다. owner-only
  protected 검증과 별도 Gate B 승인 전에는 public access를 열지 않는다.

## 다음 단계 영향

- 별도 승인 후 이 Stage 3.9 exact commit을 기존 Site의 owner-only saved version으로
  배포한다.
- protected `/api/share/{handle}` GET/HEAD가 legacy publication에서 personalized
  social URL을 선언하지 않고 `/assets/codex-social-sample.png`만 선언하는지, asset
  GET/HEAD와 readiness `1..5`를 exact-match로 확인한다.
- maintenance disabled/secret-absent, service normal, operator route `404`, health
  `200`, owner-only allowlist를 다시 확인한 뒤에만 Gate B 재승인을 요청한다.
- Stage 4 public cache·social provider 실측은 그 별도 Gate B 승인 후 진행한다.

## 승인 요청

- Stage 3.9 산출물과 검증 결과를 승인하면 exact commit의 owner-only 재배포 및
  protected fallback asset·metadata·readiness 검증으로 진행한다. public 전환은
  이번 승인 범위에 포함하지 않는다.
