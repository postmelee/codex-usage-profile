# Task #74 Stage 6 완료 보고서

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
구현계획서: [`task_m100_74_impl.md`](../plans/task_m100_74_impl.md)
Stage: 6

## 단계 목적

Stage 1~5에서 구현한 카드 테마·언어 설정, publication service v4의 네 PNG 변형,
선택 URL과 Share Studio 계약을 전체 product/Sites 산출물에서 통합 검증했다. 공식
사용법과 운영 문서를 v4 media authority, 다섯 D1 migration, export·restore·cleanup과
rollback 절차에 맞추고 실제 production 변경 전 deploy candidate 기준을 확정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/readme-card.md` | dark/light × en/ko 카드 URL, query 없는 dark 하위 호환과 카드 설정·공유 절차 문서화 |
| `docs/production-hosting.md` | media contract v4, dual stable authority, 다섯 migration, retention·export·rollback 및 별도 배포 Gate 명시 |
| `docs/sites-operations.md` | candidate packaging, 네 PNG smoke, exact cleanup·restore와 rollback 운영 절차 갱신 |
| `scripts/verify-sites-production-artifact.mjs` | production artifact의 D1 migration allowlist를 `0001`~`0005`로 확장 |
| `scripts/__tests__/verify-sites-fullstack-artifact.test.js` | 다섯 migration 수·순서·future migration 거부 회귀 검증 |
| `scripts/__tests__/verify-sites-production-artifact.test.js` | production verifier fixture와 allowlist를 다섯 migration으로 갱신 |
| `scripts/__tests__/smoke-sites-production-local.test.js` | production smoke readiness 기대 migration 수를 5로 갱신 |
| `scripts/smoke-sites-fullstack-local.mjs` | legacy dark publication 보완 후 dark/light × en/ko 네 application ETag 검증 |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | maintenance readiness가 다섯 migration을 요구하도록 갱신 |
| `src/profile-backend/accounts.js` | 신규 OAuth owner의 atomic D1 upsert 전에 canonical card locale/style 기본값 보장 |
| `src/profile-backend/__tests__/accounts.test.js` | 신규 owner canonical 카드 설정 기본값 회귀 테스트 추가 |
| `mydocs/orders/20260804.md` | Task #74 Stage 6 완료 상태 반영 |
| `mydocs/working/task_m100_74_stage6.md` | Stage 6 범위·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

공식 문서는 기존 운영 절차를 보존하면서 media contract v4와 추가 migration을
증분 반영했다. 통합 검증 중 신규 OAuth owner가 memory store에서는 정규화되지만
D1 atomic upsert에는 nullable 카드 설정을 전달하는 결함을 발견해 저장 직전에
canonical `en`·`dark/none` 기본값을 보장했다. 기존 owner, usage payload, query 없는
dark URL, 공개·비공개 전환과 v3 dark reader 계약은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- OK — 전체 Node 607건 중 601건 통과, 실패 0건, 환경 의존 6건 skip. real-workerd D1과 local Miniflare full-stack 포함.
- OK — Playwright 65건 전부 통과. 카드 설정 저장·공유, 네 변형 URL, mobile·keyboard·locale·theme 회귀 포함.
- OK — production/Sites server·client build 성공. server 50 modules, client 1822 modules transformed.
- OK — full-stack verifier: client file 7개, worker file 2개, migration file 5개, hosted mode 확인.
- OK — production verifier: artifact 5,690,005 bytes, binding 3개, migration file 5개, secret·credential·local path 검사 통과.
- OK — `git diff --check` 통과.

환경 의존 skip:

- `TEST_DATABASE_URL` 부재로 PostgreSQL seed, concurrency/failure injection, migration up/down/up, adapter, media concurrency 5건을 실행하지 않았다.
- `TEST_S3_*` 부재로 S3 integration 1건을 실행하지 않았다.
- 같은 계약의 memory/file/D1/local Miniflare 검증은 통과했으며, 원격 PostgreSQL/S3 검증은 production 배포 Gate 전 잔여 검증으로 유지한다.

## 잔여 위험

- 실제 production D1 migration, Sites saved version 배포, R2 네 변형 object 생성과 공개 smoke는 아직 실행하지 않았다.
- PostgreSQL과 gated S3 integration은 환경 변수가 제공되는 배포 전 검증에서 다시 실행해야 한다.
- 이전 saved version rollback은 additive schema와 query 없는 dark stable object를 전제로 한다. 원격 배포 시 migration 전 export와 exact rollback smoke가 필요하다.

## 다음 단계 영향

- 다음 단계는 최종 보고서 작성과 `publish/task74` PR 게시이며, production 배포는 포함하지 않는다.
- PR 병합 후에도 production migration·deploy·공개 전환은 별도 Gate 승인과 운영 문서의 export→migrate→deploy→smoke→rollback 순서를 따라야 한다.
- 배포 후보는 D1 migration `0001`~`0005`, media contract v4, dark/light × en/ko 네 PNG 변형을 하나의 불가분 계약으로 취급해야 한다.

## 승인 요청

- Stage 6 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시 단계로 진행한다.
- 실제 production migration·배포·공개 전환은 별도 Gate에서 승인한다.
