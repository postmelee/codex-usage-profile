# Task #83 Stage 4.1 완료 보고서

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4.1

## 단계 목적

Stage 4 owner-only 후보의 실제 브라우저 검증에서 확인한 카드 로딩 회귀를 release
blocker로 보정한다. 공개 profile JSON과 PNG가 준비되기 전에는 identity-free 구조형
Skeleton과 정확한 `499 / 306` 카드 공간을 유지하고, 현재 generation의 PNG가
`load`·`decode`된 뒤에만 intro flip과 Share Studio handoff를 시작하는 것이 목적이다.

소유자 profile의 theme/locale draft도 last-ready 이미지를 유지한 채 최신 source만
원자적으로 교체한다. private/public cache header, 카드 URL·bytes, D1/R2 publication과
visibility 계약은 변경하지 않고, 실제로 확인된 동일 source concurrent render만
bounded in-flight dedupe로 줄인다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/cardImageReadiness.js` | same-origin PNG fetch, Blob object URL, `load`·`decode`, generation/abort, last-ready와 release를 묶은 공통 카드 readiness hook 추가 |
| `src/profile-ui/__tests__/cardImageReadiness.test.js` | 단일 fetch/decode/release, 비PNG·unsafe source, abort 경계를 검증 |
| `src/profile-marketing/MarketingLanding.jsx` | 홈의 exact card Skeleton을 재사용 가능한 `CardImageFrame`·`CardImageSkeleton`으로 승격하고 loading/ready/error·원본 source 관찰 경계를 추가 |
| `src/profile-ui/PublicProfilePage.jsx`, `src/profile-ui/PublicCardIntro.jsx` | 공개 JSON loading을 identity-free profile/card Skeleton으로 교체하고 한 readiness resource를 resting card와 intro가 공유하도록 변경 |
| `src/profile-ui/CardProfilePage.jsx` | theme/locale source 변경 중 last-ready 보존, 최신 decoded preview 준비 전 share/publish action gate 적용 |
| `src/profile-ui/ShareStudio.jsx` | raw image를 공통 frame으로 교체하고 ready 전 handoff 중지, image error의 stable fallback settle 적용 |
| `src/profile-ui/useCardHandoffMotion.js` | `ready` 입력과 `preparing` phase를 추가해 decode 전 공간 모션을 막고 재오픈 직후 close 경합을 차단 |
| `src/profile-card/service-core.js` | 동일 source digest의 concurrent cache miss를 하나의 renderer promise로 합치고 성공·실패 뒤 in-flight entry를 정리 |
| `src/profile-card/__tests__/service.test.js`, `src/profile-ui/__tests__/cardStyleSettings.test.js` | renderer 1회 실행과 profile share readiness 정적 계약을 추가·정합화 |
| `src/styles.css` | 공통 fallback, exact card/profile Skeleton, Share Studio card frame, mobile·reduced-motion 상태 스타일 추가 |
| `tests/profile-ui.spec.js` | delayed/error/decode, last-ready draft race, intro/Share Studio gate, reduced-motion, 구조형 loading과 Blob source 계약 E2E 추가 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | 발견 근거, 승인 범위, 문서 위치, 검증·중단 조건과 owner-only 후속 경계를 기록 |
| `mydocs/orders/20260811.md` | Stage 4.1 local source·검증 완료와 owner-only 재배포 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

공식 사용자·운영 문서는 변경하지 않았다. public card/social URL, PNG bytes와 ETag/cache
header, private preview `private, no-store`, D1/R2 publication·visibility API를 보존했다.
홈의 기존 transition state machine도 변경하지 않고 시각 frame만 재사용 가능하게
분리했다.

카드 렌더러는 결과나 cache key를 바꾸지 않았다. 동일 source digest가 동시에 miss인
경우에만 기존 promise를 공유하며, avatar URL/bytes와 최종 revision 검증은 기존대로
유지한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/cardImageReadiness.test.js src/profile-ui/__tests__/homeCardTransition.test.js src/profile-card/__tests__/service.test.js
npm run test:e2e -- --grep "public profile waits for one decoded card|public profile intro removes spatial motion|public profile moves from a neutral loading state|card appearance keeps the last decoded preview"
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- 집중 Node 검증: 26/26 통과
- Stage 4.1 신규 Playwright 회귀: 4/4 통과
- 전체 Node 검증: 716개 중 710개 통과, 6개 환경 조건 skip, 실패 0
- 전체 Playwright E2E: 69/69 통과
- delayed 공개 PNG: `preparing` 동안 이미지·공간 animation 0개와 Skeleton 유지,
  decode 및 `naturalWidth > 0` 뒤에만 intro opening 실행 확인
- profile draft: dark/light·en/ko 연속 변경 중 이전 decoded Blob 유지, 최신 source만
  ready commit되고 stale request가 선택을 되돌리지 않음
- error/reduced-motion: Share Studio fallback에서 action·close 유지, public intro와
  Share Studio의 spatial motion 제거 확인
- renderer: 동일 source digest concurrent miss에서 render 1회 실행, 실패 포함
  in-flight 정리와 기존 avatar/PNG cache·revision 테스트 통과
- production build: production manifest 제거 확인, 보존 대상 0
- full-stack verifier: client 8, worker 2, migration 5, raw 3,993,455 bytes,
  gzip 2,164,616 bytes 확인
- production verifier: artifact 6,211,425 bytes, bindings 3, migration 5 및 동일
  Worker 크기 확인
- private preview, public GET/HEAD/ETag, social publication, card settings CAS와 D1/R2
  회귀는 전체 Node 검증에서 통과
- `git diff --check`: 이상 없음

## 잔여 위험

- 본 Stage source는 아직 Sites에 배포하지 않았다. 실제 후보의 cold/warm dark/light
  ready 체감과 protected profile/intro/Share Studio 동작은 새 exact source의
  owner-only saved version에서 비교해야 한다.
- 현재 원격 safe baseline은 saved version 18, source
  `e431cc88ba73b02341a170fe5c38117d4552e42a`, access revision 56,
  environment revision 85다. 새 배포 전까지 이 기준은 변경하지 않는다.
- React Strict Mode의 개발 effect replay는 테스트 환경에서 같은 fetch를 최대 두 번
  시작할 수 있다. production에서는 한 readiness fetch를 Blob URL로 두 카드 surface가
  공유하며 DOM image의 별도 원본 URL 재요청은 없다.
- permanent public Gate C와 SNS 재실측은 #84 범위다. Stage 4.1 owner-only 집중 smoke에서
  public access나 disposable publication을 다시 만들지 않는다.

## 다음 단계 영향

- 이 보고서와 source를 한 Stage 4.1 commit으로 고정하고 exact commit을 기존 Site의
  owner-only saved version으로 배포한다.
- protected `/?view=profile`, `/api/share/{handle}`, theme/locale draft, intro와 Share
  Studio의 loading→ready sequencing, readiness `[1,2,3,4,5]`, maintenance disabled,
  operator `404`, health `200`과 owner-only allowlist를 집중 확인한다.
- 원격 집중 smoke가 통과하면 결과와 exact source를 최종 보고서에 반영하고
  `task-final-report` 절차를 재개한다. public access 전환은 포함하지 않는다.

## 승인 요청

- Stage 4.1 산출물과 local 검증 결과를 승인하면 exact commit의 owner-only 재배포와
  카드 readiness 집중 smoke로 진행한다.
