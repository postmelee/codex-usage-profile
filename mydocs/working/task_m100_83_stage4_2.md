# Task #83 Stage 4.2 완료 보고서 — avatar 복구성과 card resource 재사용 보정

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4.2

## 단계 목적

Stage 4.1 owner-only 후보에서 server-rendered card의 GitHub avatar fallback이 일시 장애
뒤에도 고착될 수 있고, 같은 문서에서 이미 decode한 card image를 다른 surface가 다시
fetch/decode하는 결함을 확인했다. Stage 4.2는 private/public HTTP cache와 R2 publication
계약을 바꾸지 않으면서 avatar 복구 경계를 명시하고, decoded image를 bounded tab-memory
resource로 재사용해 card 준비 지연을 줄이는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/service-core.js`, `service.js`, `index.js` | 5초 총 budget 안의 transient 1회 retry, 성공 avatar bytes 전용 TTL cache, failure PNG 비캐시와 bounded observer 계약 추가 |
| `src/profile-card/__tests__/service.test.js` | retry 성공, 최종 실패 재시도 가능성, 설정 revision 독립 TTL, invalid/oversize 무재시도와 observer 경계 검증 |
| `src/profile-backend/http.js` | avatar failure observer를 card service 생성 경계까지 전달 |
| `src/profile-runtime/sites/backend.js`, `worker.js`, `maintenance.js` | 일반·maintenance card 경로에 동일 Sites observer 주입 |
| `src/profile-runtime/sites/observability.js` | URL·identity·provider 원문이 없는 `profile_card_avatar` bounded event 추가 |
| `src/profile-runtime/sites/__tests__/observability.test.js` | exact field allowlist와 writer failure 무해성 검증 |
| `src/profile-ui/cardImageReadiness.js` | pending dedupe, decoded Blob lease, refcount, 60초 TTL, 12-entry LRU, owner scope와 explicit clear를 갖는 same-document resource cache 추가 |
| `src/profile-ui/__tests__/cardImageReadiness.test.js` | 순차·동시 재사용, TTL/LRU, owner 격리, failure eviction, pending abort와 exact-once revoke 검증 |
| `src/App.jsx` | owner 변경·logout에서 private owner resource를 clear/abort |
| `src/profile-ui/HomePage.jsx` | 홈도 공통 resource acquire를 사용하고 transition과 visible lease를 원자적으로 관리해 stale generation 경쟁 차단 |
| `src/profile-marketing/MarketingLanding.jsx` | Blob display source와 canonical `data-card-source-url` 분리 |
| `tests/profile-ui.spec.js` | 홈 Blob readiness·canonical source, owner decode failure와 Share Studio 재진입 public request 재사용 검증 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | 발견 근거, 승인 범위, same-document 한계, 검증과 owner-only 후속 경계 기록 |
| `mydocs/orders/20260811.md` | Stage 4.2 local 완료와 owner-only 재배포 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경 단계이므로 문서 본문 무손실 여부는 해당하지 않는다. 외부 card URL, private
`no-store`, public cache/ETag, D1/R2 publication과 OAuth/CLI 계약은 변경하지 않았다.
server avatar 실패 시 initials fallback은 유지하되 실패 결과와 그 결과로 만든 PNG를
고착시키지 않는다. client cache는 한 document runtime의 메모리에만 존재하며
local/session storage, Cache Storage, IndexedDB와 Service Worker를 사용하지 않는다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/service.test.js src/profile-runtime/sites/__tests__/observability.test.js src/profile-ui/__tests__/cardImageReadiness.test.js src/profile-ui/__tests__/homeCardTransition.test.js
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- 집중 Node 검증: 38/38 통과
- 전체 Node 검증: 725개 중 719개 통과, 6개 환경 조건 skip, 실패 0
- 전체 Playwright E2E: 69/69 통과
- avatar: transient 첫 실패 뒤 retry bytes render, 최종 failure 뒤 다음 독립 render 재시도,
  unsupported/oversize/non-retryable 무재시도, settings revision 독립 cache와 TTL 재확인 통과
- observability: exact `{ errorCode, attempt, retrying }` 입력과 bounded Sites event, writer
  throw 무해성 및 URL·identity·provider error 원문 비노출 통과
- client resource: 동일 key concurrent/sequence fetch·decode 1회, release 뒤 TTL 재진입,
  LRU/clear exact-once revoke, owner scope·variant·failure·abort 분리 통과
- Home/Share Studio: decoded Blob display와 canonical source metadata, public preview 재진입
  request 1회, logout stale generation, owner/public failure fallback과 action 유지 통과
- 생산 빌드: server 60 modules, client 1,827 modules, manifest 제거와 보존 대상 0 확인
- full-stack verifier: client 8, worker 2, migration 5, raw 3,998,348 bytes,
  gzip 2,165,726 bytes, `ok: true`
- production verifier: artifact 6,221,055 bytes, bindings 3, migration 5와 동일 Worker
  크기, `ok: true`
- `git diff --check`: 이상 없음

전체 E2E는 사용자가 실행 중인 별도 로컬 앱이 기본 5173 포트를 점유한 상태여서, 제품·
assertion 변경 없이 현재 프로젝트의 5177 Vite 서버로 transport만 우회해 실행했다. 이
검증용 우회 코드는 최종 산출물에서 제거했다.

## 잔여 위험

- Stage 4.2 source는 아직 Sites에 배포하지 않았다. 실제 hosted runtime의 avatar fetch와
  같은 tab 내 Home/Profile/Public intro/Share Studio 재진입은 exact source의 owner-only
  saved version에서 집중 확인해야 한다.
- tab-memory resource는 full document navigation 뒤 유지되지 않는다. 이는 private bytes를
  persistent storage에 남기지 않기 위한 의도된 경계이며, 새 문서에서는 기존 HTTP/server
  cache 계약을 따른다.
- GitHub avatar의 영구적인 invalid content나 provider 장애는 initials로 fail-soft한다.
  bounded retry는 일시 장애 복구용이며 provider 실패를 숨기거나 무한 재시도하지 않는다.
- 원격 safe baseline은 saved version 18, source
  `e431cc88ba73b02341a170fe5c38117d4552e42a`, access revision 56, environment
  revision 85이며 새 배포 전까지 변경하지 않는다.

## 다음 단계 영향

- 이 보고서와 source를 하나의 Stage 4.2 commit으로 고정한 뒤, 별도 승인으로 같은 exact
  source를 기존 Site의 owner-only saved version으로 배포한다.
- owner-only smoke는 avatar 실이미지 복구, Home → owner profile → Share Studio 재진입의
  card readiness와 cache 체감, theme/locale revision 격리, logout clear, readiness
  `[1,2,3,4,5]`, maintenance disabled와 safe baseline rollback 가능성을 집중 확인한다.
- public access 전환과 X·Threads·카카오톡 재실측은 포함하지 않으며 Task #84 Gate C에서
  수행한다.

## 승인 요청

- Stage 4.2 산출물과 검증 결과를 승인하면 exact source owner-only saved version 배포와
  protected 카드 흐름 집중 smoke로 진행한다.
