# Task #83 Stage 4.3 완료 보고서 — Workerd avatar 호환과 공유 source-image handoff 보정

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4.3

## 단계 목적

Stage 4.2 owner-only 후보 실측에서 GitHub avatar URL 자체는 유효하지만 Workerd가
`fetch(url, { redirect: "error" })`를 `TypeError`로 거부해 카드가 initials fallback에
머무는 런타임 호환 결함을 확인했다. 또한 Home/Profile에서 이미 decode한 owner card를
Share Studio가 즉시 숨기고 public card를 새로 기다리면서 skeleton과 불완전한 card에
handoff motion이 적용되는 회귀를 확인했다. Stage 4.3은 HTTP cache key와 profile/usage
load 정책을 바꾸지 않으면서 avatar fetch를 fail-closed한 Workerd 호환 모드로 전환하고,
공유 진입 시 이미 보이는 decoded bitmap으로 motion을 시작한 뒤 public target을
백그라운드에서 준비해 안정적으로 교체하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/service-core.js` | avatar fetch를 `redirect: "manual"`로 전환하고 3xx 응답은 기존 non-2xx 검증에서 fail-closed 처리 |
| `src/profile-card/__tests__/service.test.js` | redirect 미추적, 단일 fetch, initials fallback, non-retryable 관측 계약 회귀 테스트 추가 |
| `src/profile-ui/HomePage.jsx` | 공유 클릭 순간의 decoded display Blob·canonical source·scope·source kind와 화면 좌표를 snapshot해 Share Studio로 전달 |
| `src/profile-ui/CardProfilePage.jsx` | 저장이 필요한 공유에서도 저장 전 source와 좌표를 고정하고 preview revision 변경 중 modal handoff를 유지 |
| `src/profile-ui/ShareStudio.jsx` | owner resource lease 재획득, captured Blob 즉시 fallback, source 기반 motion, open 정착 뒤 public target 교체와 실패 시 source 유지 추가 |
| `src/styles.css` | handoff source의 중복 image fade 제거와 public target 실패 상태 문구 스타일 추가 |
| `tests/profile-ui.spec.js` | 지연 target source 재사용, 완료 전 닫기·focus/visibility 복구, target 실패, Home/Profile/dirty Save & Share 회귀 검증 추가 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Stage 4.3 발견 근거, 승인 범위, 상태·캐시 경계, 구현·검증 계획 기록 |
| `mydocs/orders/20260811.md` | Stage 4.3 local 완료와 owner-only 재배포 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경 단계이므로 문서 본문 무손실 여부는 해당하지 않는다. avatar 요청은 redirect를
자동 추적하지 않으며 3xx를 기존 invalid HTTP response와 같은 non-retryable fallback으로
처리하므로 SSRF·redirect chain 허용 범위를 넓히지 않았다. owner/private와 public card의
canonical URL, cache key, HTTP cache/ETag, D1/R2 publication 계약은 변경하지 않았다.
공유 handoff는 같은 document runtime에서 이미 decode한 Blob을 일시적으로 재사용할 뿐
owner/public resource key를 합치거나 persistent storage에 이미지를 저장하지 않는다.
profile/usage는 각 직접 진입 route의 독립 동작을 보존하며 Home 전용 fetch 정책으로
축소하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/service.test.js src/profile-ui/__tests__/cardImageReadiness.test.js
node --test src/profile-ui/__tests__/*.test.js src/profile-card/__tests__/service.test.js
npm test -- --test-concurrency=1 --test-reporter=dot
npx playwright test profile-ui.stage43.tmp.spec.js --config /private/tmp/task83-playwright-stage43.config.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- avatar/card resource 집중 Node 검증: 25/25 통과
- profile UI와 avatar service 확장 Node 검증: 110/110 통과
- 전체 Node 검증: 726개 중 720개 통과, 6개 환경 조건 skip, 실패 0
- 전체 Playwright E2E: 71/71 통과
- avatar: `redirect: "manual"` exact option, 302 미추적, fetch 1회, initials fallback,
  `avatar_http_rejected` non-retryable 관측 경계 통과
- 공유 handoff: source와 modal의 Blob identity 일치, public target 지연 중 skeleton 미노출,
  source 좌표 기반 motion, open 정착 뒤 target 교체, target 실패 시 source 유지 통과
- 공유 종료: target 준비 전 Escape에서도 modal 종료, 원래 card visibility와 focus 복원 통과
- Home/Profile/dirty Save & Share와 public profile intro·reduced motion·mobile 회귀 통과
- 생산 빌드: server 60 modules, client 1,827 modules, manifest 제거와 보존 대상 0 확인
- full-stack verifier: client 8, worker 2, migration 5, raw 3,998,349 bytes,
  gzip 2,165,728 bytes, `ok: true`
- production verifier: artifact 6,224,776 bytes, bindings 3, migration 5와 동일 Worker
  크기, `ok: true`
- `git diff --check`: 이상 없음

전체 Node 검증의 Miniflare D1 fixture는 샌드박스의 localhost listen 제한에서 `EPERM`을
반환하므로 동일 source를 로컬 listen이 허용된 검증 환경에서 실행했다. 전체 E2E는
사용자가 실행 중인 별도 앱이 기본 5173 포트를 점유해 5187 transport로만 우회했다.
제품 코드와 assertion은 바꾸지 않았고 포트 치환용 임시 테스트 파일은 검증 직후 삭제했다.

## 잔여 위험

- Stage 4.3 source는 아직 Sites에 재배포하지 않았다. Workerd의 hosted avatar 실이미지와
  Home/Profile 공유 source handoff는 exact source의 owner-only saved version에서 다시
  확인해야 한다.
- public target은 별도 canonical resource이므로 처음 공유할 때 백그라운드 요청 자체는
  유지된다. 다만 사용자는 이미 decode된 source로 즉시 motion을 보고, target은 준비된
  뒤에만 교체된다.
- full document navigation 뒤에는 의도대로 tab-memory Blob lease가 사라진다. private
  이미지를 persistent storage에 남기지 않는 Stage 4.2 보안 경계를 유지한 결과다.
- public access 전환과 X·Threads·카카오톡 실측은 Task #84 Gate C 범위이며 이번 단계에
  포함하지 않는다.

## 다음 단계 영향

- 이 보고서와 source를 하나의 Stage 4.3 commit으로 고정한 뒤, 별도 승인으로 같은 exact
  source를 기존 Site의 owner-only saved version으로 재배포한다.
- owner-only smoke는 hosted GitHub avatar, Home/Profile의 첫 공유와 재진입, public target
  지연·교체, 카드 theme/locale 저장 직후 공유, 닫기·재열기와 reduced motion을 집중 확인한다.
- 사용자 직접 확인은 owner-only smoke가 통과한 saved version을 같은 Stage 5 URL에서
  제공한 뒤 진행한다.

## 승인 요청

- Stage 4.3 산출물과 검증 결과를 승인하면 exact source owner-only saved version 재배포와
  protected 공유 흐름 집중 smoke로 진행한다.
