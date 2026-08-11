# Task #83 Stage 4.4 완료 보고서 — 공유 전환과 공통 프로필 Skeleton 보정

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4.4

## 단계 목적

Stage 4.3 owner-only 후보 실측에서 Share Studio의 decoded source card가 중앙에 안착한 뒤
public target으로 교체될 때 image 기본 crossfade가 다시 시작해 opacity가 한 번 낮아지는
깜빡임을 확인했다. 또한 공개 profile의 구조형 Skeleton은 최상위 wrapper 하나의 sheen이
전체 내용을 횡단하고, 소유자 profile은 같은 ready layout 앞에서 text loading state를
사용했다. Stage 4.4는 spatial handoff와 cold readiness를 유지하면서 warm target의 중복
fade를 제거하고, 두 profile route를 identity-free 공통 구조형 Skeleton으로 통일하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | 공개·소유자 공통 identity-free profile loading 구조, 요소별 shimmer와 card preview Skeleton 추가 |
| `src/profile-ui/PublicProfilePage.jsx` | page 전용 loading component를 공통 Skeleton으로 교체하고 공개 접근성 문구 유지 |
| `src/profile-ui/CardProfilePage.jsx` | 소유자 text loading state를 같은 공통 Skeleton으로 교체 |
| `src/profile-ui/ShareStudio.jsx` | decoded source가 있는 public target에 warm handoff 전용 class를 부여 |
| `src/styles.css` | page-wide sheen 제거, identity·stats·activity·card별 loading 표현, 7행 activity mask와 reduced-motion 중지, warm target animation 제거 |
| `tests/profile-ui.spec.js` | warm target opacity/animation 연속성, 공개·소유자 Skeleton 구조와 요소별 shimmer, reduced-motion 회귀 검증 추가 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Stage 4.4 발견 근거, 승인 범위, 문서 위치, 구현·검증·중단 조건 기록 |
| `mydocs/orders/20260811.md` | Stage 4.4 owner-only 재배포·원격 smoke 완료와 사용자 직접 확인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경 단계이므로 문서 본문 무손실 여부는 해당하지 않는다. Share Studio는 warm source와
public target의 resource key, fetch/decode readiness와 spatial wrapper motion을 그대로 유지하고
target image에만 중복 crossfade를 적용하지 않는다. source가 없는 cold path는 기존 120ms
readiness fade를 유지한다. 공통 Skeleton은 실제 identity·usage를 렌더하지 않으며 공개·소유자
API 호출, route별 fetch, media URL·ETag/cache, D1/R2 publication과 Sites access 계약을
변경하지 않는다.

## 검증 결과

실행 명령:

```bash
npx playwright test -c /private/tmp/task83-playwright-stage44.config.js --grep "Share Studio hands off|owner Profile loading|public profile moves|profile loading Skeleton stops"
npm test -- --test-concurrency=1
npx playwright test -c /private/tmp/task83-playwright-stage44.config.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- 집중 Playwright E2E: 4/4 통과
- 전체 Node 검증: 726개 중 720개 통과, 6개 환경 조건 skip, 실패 0
- 전체 Playwright E2E: 72/72 통과
- warm handoff: public target 교체 뒤 `is-warm-handoff-target`, animation-name `none`,
  opacity `1`, hero Skeleton 비활성 상태 통과
- profile loading: 공개·소유자 모두 공통 920px 구조, identity 3개·stats 5개·activity 7행·
  card Skeleton, 단일 접근성 heading과 실제 identity 비노출 통과
- profile shimmer: 최상위 wrapper pseudo animation `none`, 요소별
  `home-card-skeleton-progress` 적용과 negative phase 분산 통과
- reduced motion: profile placeholder와 card Skeleton의 decorative animation-name `none`,
  sheen opacity `0` 통과
- theme contract: activity row mask를 raw component color 없이 표현하고 light/dark 회귀 통과
- 생산 빌드: server 60 modules, client 1,828 modules, manifest 제거와 보존 대상 0 확인
- full-stack verifier: client 8, worker 2, migration 5, raw 3,998,349 bytes,
  gzip 2,165,728 bytes, `ok: true`
- production verifier: artifact 6,227,118 bytes, bindings 3, migration 5와 동일 Worker
  크기, `ok: true`
- `git diff --check`: 이상 없음

원격 owner-only 검증:

- exact source `ca25800bb11619367f347a1090348427fe99adaa`를 saved version 21로 저장·배포
- access는 `custom`, owner allowlist 1명, group 0개, external visitor 0명,
  access revision 56으로 배포 전 경계 유지
- protected `/healthz`, owner profile과 공개 share HTML 경로: 모두 `200`
- hosted owner profile 첫 loading: 공통 profile Skeleton 1개, 독립 shimmer 요소 20개,
  최상위 wrapper animation `none`; 준비 뒤 Skeleton 제거와 공유 command 노출 확인
- hosted 공개 share 첫 loading: 공통 public profile Skeleton과 독립 shimmer 요소 20개,
  최상위 wrapper animation `none`; 준비 뒤 modal과 decoded card 노출 확인
- hosted Share Studio: source handoff 뒤 public target이 `is-warm-handoff-target`,
  animation-name `none`, opacity `1`, decoded image width 양수로 전환됨을 확인
- 화면의 기존 text loading UI는 제거됐고 `프로필 불러오는 중`은 1×1 clipped
  `sr-only` 접근성 문구로만 유지됨을 확인

전체 Node 검증의 Miniflare D1 fixture는 localhost listen이 허용된 검증 환경에서 실행했다.
Playwright 패키지 browser cache가 현재 revision과 맞지 않아 설치된 Chrome channel을 사용했고,
same-origin을 유지하도록 5187 transport에 맞춘 임시 테스트 사본만 사용했다. 제품 코드와
assertion은 바꾸지 않았고 임시 테스트 파일은 검증 직후 삭제했다.

## 잔여 위험

- hosted 자동 smoke는 DOM·computed style·decoded image 상태로 깜빡임 제거를 확인했다.
  사용자가 실제 화면에서 같은 전환의 지각 품질을 최종 확인해야 한다.
- card preview 내부는 Home에서 검증된 card-accurate Skeleton과 단일 card-local sheen을
  재사용한다. 이번 보정은 profile 전체를 횡단하던 page-wide sheen만 제거했다.
- public access 전환과 X·Threads·카카오톡 실측은 Task #84 Gate C 범위이며 이번 단계에
  포함하지 않는다.

## 다음 단계 영향

- Stage 4.4 exact source는 saved version 21로 owner-only 배포됐고 protected 경로와 hosted
  공유·profile loading 집중 smoke를 통과했다.
- 사용자가 같은 Stage 5 URL에서 owner profile 첫 loading, 공유 command의 중앙 이동 뒤
  무깜빡임, 공개 share direct entry의 요소별 Skeleton을 직접 확인한다.
- 사용자 확인 승인 뒤 `task-final-report`를 재개하며, public access 전환과 SNS 실측은
  Task #84 Gate C 전까지 수행하지 않는다.

## 승인 요청

- saved version 21의 owner profile·공유 modal·공개 share direct entry 직접 확인 결과를
  승인하면 Task #83 최종 보고 절차로 진행한다.
