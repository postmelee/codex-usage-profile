# Task #51 Stage 2 보고서 — Sites 데이터 lifecycle과 안전한 운영 도구

GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)
구현계획서: [`task_m100_51_impl.md`](../plans/task_m100_51_impl.md)
Stage: 2

## 단계 목적

Sites production의 D1/R2 데이터에 대해 인증·일시 상태를 제외한 versioned
backup/restore, retention, account deletion과 publication repair 계약을 만든다.
모든 mutation은 exact owner, digest, count와 `apply` 확인을 요구하고,
maintenance route는 명시적으로 활성화하지 않으면 generic 404로 닫힌다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/maintenance-contract.js` | backup schema/contract version, canonical digest, summary와 constant-work text 비교 계약을 정의한다. |
| `src/profile-backend/d1/maintenance.js` | durable export/restore, transient retention, private quiesce와 exact owner atomic deletion을 구현한다. |
| `src/profile-backend/d1/index.js` | D1 maintenance API를 export한다. |
| `src/profile-backend/index.js` | backend maintenance contract와 D1 API를 package surface로 export한다. |
| `src/profile-backend/__tests__/d1-maintenance.test.js` | real-workerd D1 export/restore/delete/retention과 schema·secret 부정 검증을 추가한다. |
| `src/profile-backend/__tests__/_d1-test-fixture.js` | test Worker의 maintenance 호출 seam을 추가한다. |
| `src/profile-backend/__tests__/_d1-worker-harness.js` | disposable D1 maintenance RPC를 test 전용으로 연결한다. |
| `src/profile-media/maintenance-contract.js` | stable/revision prefix와 referenced/recent/age retention 정책을 공용 계약으로 분리한다. |
| `src/profile-media/r2-binding/maintenance.js` | paginated manifest, tombstone, conditional repair, revision deletion과 retention을 구현한다. |
| `src/profile-media/r2-binding/store.js` | 새 tombstone metadata에 owner id를 기록해 재시도 scope를 강화한다. |
| `src/profile-media/r2-binding/index.js` | R2 maintenance API를 export한다. |
| `src/profile-media/index.js` | media maintenance 계약과 R2 API를 package surface로 export한다. |
| `src/profile-media/__tests__/r2-binding-maintenance.test.js` | owner deletion, republish race, retention 보호와 stale repair를 검증한다. |
| `src/profile-media/__tests__/_r2-binding-fake.js` | paginated list, delete hook/failure를 지원한다. |
| `src/profile-runtime/sites/maintenance.js` | default-disabled maintenance route와 cross-store fail-closed orchestration을 구현한다. |
| `src/profile-runtime/sites/config.js` | exact `enabled` mode와 maintenance token을 server runtime config로 읽는다. |
| `src/profile-runtime/sites/worker.js` | 좁은 maintenance route를 backend/assets보다 먼저 분리한다. |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | mode/token/origin/HTTPS/body guard, confirmation과 partial failure 순서를 검증한다. |
| `src/profile-runtime/sites/__tests__/config.test.js` | exact maintenance mode 활성화 조건을 검증한다. |
| `src/profile-runtime/sites/__tests__/worker.test.js` | 비활성 route가 assets로 빠지지 않고 generic 404인지 검증한다. |
| `scripts/sites-profile-maintenance.mjs` | plan/export/restore/retention/delete/repair operator CLI와 repository 밖 atomic 0600 export를 구현한다. |
| `scripts/__tests__/sites-profile-maintenance.test.js` | secret 비노출, dry-run, apply 확인과 backup file guard를 검증한다. |
| `scripts/cleanup-orphan-card-media.mjs` | 기존 S3 cleanup이 공용 R2 retention 선택 정책을 재사용하도록 정리한다. |
| `scripts/smoke-sites-fullstack-local.mjs` | real Worker에서 export→delete→session 제거→private restore→repair→retention cycle을 추가한다. |
| `src/profile-runtime/sites/__tests__/full-stack.test.js` | lifecycle이 포함된 30-route smoke 계약으로 갱신한다. |
| `package.json` | operator CLI 실행 script를 추가한다. |

구현계획서의 `backend.js`와 `worker-entry.js`는 기존 dependency factory와 renderer
주입 경로를 그대로 재사용할 수 있어 수정하지 않았다. 대신 maintenance service가
기존 backend dependency factory를 사용하고, Worker가 이미 전달받는 renderer를
maintenance에도 전달하도록 `worker.js`에서 연결했다. D1 schema 변경은 없어 신규
migration도 추가하지 않았다. 기존 cleanup test source도 수정하지 않고 공용 정책
변경에 대한 회귀 검증으로 그대로 사용했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 제품 store contract,
public API/UI, OAuth/session/CLI submit, Cloud Run/S3 fallback은 변경하지 않았다.
maintenance 기능은 product store method나 공개 API에 추가하지 않고 별도 operator
surface로 격리했다.

backup은 owner identity, latest usage/snapshot, visibility, submitted device와
publication metadata만 포함한다. OAuth state, session, CLI challenge, token
digest와 rate-limit row는 export/restore에서 제외하며 restore 뒤 재로그인이
필요하다. 실제 backup payload·경로, runtime secret과 원격 개인 data 식별자는
저장소와 본 보고서에 기록하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/d1-maintenance.test.js
node --test src/profile-media/__tests__/r2-binding-maintenance.test.js
node --test src/profile-runtime/sites/__tests__/maintenance.test.js
node --test scripts/__tests__/sites-profile-maintenance.test.js
node --test scripts/__tests__/cleanup-orphan-card-media.test.js
npm run smoke:sites-fullstack:local
npm run build:production
npm run verify:sites-fullstack
npm test
git diff --check
```

추가 검증:

```bash
$HOME/.codex/plugins/cache/openai-bundled/sites/0.1.31/scripts/package-site.sh \
  /private/tmp/codex-usage-profile-task51 <temporary-archive>
rg -n "maintenance-secret|local-maintenance-secret|secret-token-digest|secret-device-digest" dist
rg -n "PROFILE_MAINTENANCE_(MODE|TOKEN)|/__ops/profile-maintenance" dist/client
```

결과:

- OK — Stage 2 대상 테스트 25개 통과.
- OK — D1 real-workerd에서 durable export/restore idempotency, stale plan 거부,
  private quiesce, owner-dependent atomic delete와 transient retention을 확인했다.
- OK — backup schema 변경, 인증·일시 상태와 token/device digest 포함을 거부했다.
- OK — R2 manifest pagination, stable tombstone, referenced/recent/90일 보호,
  newer publication과 stale storage/application ETag에서 mutation 중단을 확인했다.
- OK — route mode/token 부재·오류, 길이가 다른 잘못된 token, cross-origin,
  insecure remote origin, method/content-type/body-size 오류가 safe response로
  거부되고 service mutation이 0건임을 확인했다.
- OK — operator mutation은 `apply`, expected digest/count와 exact owner 확인
  누락 시 fetch 전에 중단한다. export는 repository 밖 새 0600 file로만
  atomic 생성하며 payload·경로·secret을 stdout에 출력하지 않는다.
- OK — local full-stack Worker가 browser session, CLI submit, D1, R2, renderer,
  publish/unpublish와 maintenance export→delete→restore→repair→retention을
  30개 route에서 검증했다. account deletion 뒤 session이 복원되지 않음도
  확인했다.
- OK — 전체 테스트 460개 중 454개 통과, 환경 의존 6개 스킵, 실패 0개.
- OK — production artifact는 client file 7개, Worker JS file 2개,
  migration 2개, Worker raw 3,888,218 bytes, gzip 2,142,389 bytes였다.
- OK — Sites packaging helper가 최종 `dist/` archive 입력을 패키징했다.
  검증용 임시 archive는 확인 뒤 삭제했다.
- OK — client artifact와 전체 production artifact에서 fixture secret을 찾지
  못했고, client artifact에는 maintenance env 이름과 route가 없었다.
- OK — `git diff --check` 통과.

## 잔여 위험

- D1과 R2 사이에는 분산 transaction이 없다. account deletion은 stable
  tombstone과 D1 private 전환을 먼저 수행해 뒤 단계가 실패해도 공개 범위를
  늘리지 않는다. 실패 뒤에는 새 plan으로 재시도하거나 backup restore/repair가
  필요하다.
- R2 object delete는 조건부 delete를 지원하지 않아 각 삭제 직전에 stable
  digest와 object storage ETag를 재검사하고 삭제 뒤 부재를 확인한다. 운영 중
  concurrent publish를 허용하지 않는 maintenance window 절차는 Stage 3 문서와
  guardrail에서 확정해야 한다.
- maintenance mode와 token은 아직 hosted environment에 설정하지 않았다.
  production에서는 현재 route가 generic 404이며 실제 원격 lifecycle 검증은
  Gate A가 있는 Stage 4 이전에 수행하지 않는다.
- 기존 dependency audit 경고는 Stage 1과 동일하게 남아 있으며 dependency
  version과 lockfile은 변경하지 않았다.

## 다음 단계 영향

- Stage 3은 이 maintenance 계약을 바탕으로 structured observability,
  abuse/rate-limit·quota stop, production artifact verifier, 전체 local candidate와
  공식 Sites 운영 문서를 추가한다.
- Stage 3 운영 문서에는 maintenance window, secret rotation, plan/apply,
  backup 보호, partial failure 재계획과 Cloud Run fallback 평가 순서를 기록한다.
- 원격 Site version/deployment, runtime environment, D1/R2와 access policy는
  Stage 3에서도 변경하지 않는다. Stage 4 Gate A 승인 뒤에만 owner-only
  candidate를 생성한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3으로 진행한다.
