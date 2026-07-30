# Task #55 Stage 2 보고서 — preload/decode와 identity-safe 전환

GitHub Issue: [#55](https://github.com/postmelee/codex-usage-profile/issues/55)
구현계획서: [`task_m100_55_impl.md`](../plans/task_m100_55_impl.md)
Stage: 2

## 단계 목적

Home 카드 source를 인증·profile 응답과 동시에 교체하지 않고, detached
image의 `load`와 `decode()`가 끝난 current generation만 visible DOM에
commit한다. slow session/image, failure와 logout race에서 이전 owner
source나 identity가 다시 노출되지 않도록 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/homeCardTransition.js` | dependency-injectable preload/decode loader, abort 판별과 source equality helper 추가 |
| `src/profile-ui/__tests__/homeCardTransition.test.js` | decode, no-decode fallback, failure, abort와 source equality unit test 추가 |
| `src/profile-ui/HomePage.jsx` | operator→owner/sample target 계산, generation-safe preload, logout reset과 ready-gated action 연결 |
| `src/profile-marketing/MarketingLanding.jsx` | visible source가 없을 수 있는 preview와 `aria-busy`, card status/source data 연결점 추가 |
| `tests/profile-ui.spec.js` | operator success/404/503, slow owner, single DOM commit, logout race, owner 404/503/decode failure와 storage 부재 E2E 추가 |
| `mydocs/orders/20260730.md` | Stage 2 완료와 Stage 3 승인 대기 상태 반영 |
| `mydocs/working/task_m100_55_stage2.md` | Stage 2 구현·검증 결과 기록 |

## 본문 변경 정도 / 본문 무손실 여부

기존 account/profile/public API, Share Studio source ref, publish/unpublish
mutation과 Sites linkage는 변경하지 않았다. Home이 사용하는 카드 image
선택·교체 시점과 action ready gate만 변경했다. owner id와 preview URL은
React memory 안에서만 사용하며 local/session storage, URL query, IndexedDB
또는 service worker cache를 새로 사용하지 않는다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-marketing/__tests__/marketing-config.test.js \
  src/profile-ui/__tests__/homeCardTransition.test.js

npm run test:e2e -- --grep "Home card transition"
npm test
npm run test:e2e
git diff --check
```

결과:

- OK — config/transition/loader unit test 16건 통과
- OK — Stage 2 전용 Playwright E2E 8건 통과
- OK — 전체 Node 단위·통합 테스트 504건 중 498건 통과, 환경 미설정
  gated test 6건 skip, 실패 0건
- OK — 전체 Playwright 회귀 31건 통과
- OK — slow profile/image 동안 owner preview는 DOM에 없고 ready 뒤 한 번만
  owner source로 commit
- OK — logout 뒤 stale owner image 완료를 무시하고 operator source로 복귀
- OK — operator/owner 404·503과 owner decode failure는 static sample 또는
  unavailable 상태로 fail-close
- OK — public Share는 decoded owner source가 ready일 때만 활성화
- OK — browser storage에 owner/preview 값이 남지 않으며
  `git diff --check` 통과

## 잔여 위험

- Stage 2는 functional `aria-busy`와 data state만 제공한다. loading 중
  기존 카드 pixel을 가리는 neutral skeleton과 crossfade는 Stage 3에서
  구현해야 한다.
- reduced-motion 상태의 skeleton 정지와 desktop/mobile 시각 회귀는
  Stage 3 검증 범위다.

## 다음 단계 영향

- Stage 3는 `.home-card-media[data-card-status="loading"]`와
  `aria-busy="true"`를 기준으로 기존 카드 box 내부에 skeleton veil을
  추가한다.
- skeleton은 pending source나 owner overlay를 노출하지 않고, ready/fallback
  전환에서만 약 240ms opacity crossfade를 수행해야 한다.
- `prefers-reduced-motion: reduce`에서는 shimmer와 crossfade를 모두
  제거해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3로 진행한다.
