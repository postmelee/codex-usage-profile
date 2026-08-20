# Task #102 Stage 2 보고서 — 모바일 Share Studio 대상과 한 줄 layout 연결

GitHub Issue: [#102](https://github.com/postmelee/codex-usage-profile/issues/102)
구현계획서: [`task_m100_102_impl.md`](../plans/task_m100_102_impl.md)
Stage: 2

## 단계 목적

Stage 1의 모바일 실행 환경 판별과 target 목록 계약을 실제 Share Studio 최초
render에 연결한다. iOS·Android에서는 Facebook·LinkedIn을 DOM과 접근성 트리에서
제외하고 `X · Threads · Reddit · Save` 네 액션을 320px 이상 한 줄로 제공하면서,
viewport가 좁은 데스크톱에서는 기존 여섯 액션을 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ShareStudio.jsx` | 첫 render에서 navigator 기반 모바일 판별 후 target builder에 전달, 기존 map과 Save index 연속성 유지 |
| `src/styles.css` | 360px 이하 Share Studio primary action을 두 열로 강제하던 override 제거 |
| `tests/profile-ui.spec.js` | 좁은 desktop 6개 회귀, iPhone 390px·Android 320px 모바일 4개 DOM·한 줄·hit target·overflow·flicker 검증 추가 |
| `mydocs/orders/20260813.md` | Stage 2 완료와 Stage 3 승인 대기 상태 반영 |
| `mydocs/working/task_m100_102_stage2.md` | Stage 2 구현·검증·시각 확인·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. Share Studio의 open/close,
card handoff, focus trap, Save, 보조 복사, make-private와 animation index 계산은
재작성하지 않았다. 모바일 판별 boolean만 기존 `buildShareTargets()` 호출에 추가했고,
mobile media query의 다른 dialog·card·secondary action 규칙은 유지했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|Share card dialog"
git diff --check
```

결과:

- OK — Share Studio 단위 테스트 9/9 통과, 실패·skip 없음.
- OK — focused Playwright 15/15 통과. 기존 open/close, card handoff, resize,
  reduced motion, preview·clipboard 실패, make-private와 profile canvas 회귀도 함께 통과했다.
- OK — iPhone 13 context 390×844와 Pixel 5 Android context 320×800에서 primary
  action은 최초 관찰부터 animation 완료까지 항상 4개였다.
- OK — 두 모바일 context의 접근성 트리에는 X·Threads·Reddit·Save만 있고
  LinkedIn·Facebook link는 없었다.
- OK — 모바일 네 action의 `top` 차이는 1px 이하, 각 height는 44px 이상이고
  viewport 밖 bounds와 body/document horizontal overflow가 없었다.
- OK — 390×844 desktop browser context에서는 LinkedIn·Facebook을 포함한 여섯
  action과 기존 4+2 wrapping을 유지했다.
- OK — Playwright가 생성한 iPhone 390px·Android 320px·좁은 desktop 스크린샷을
  직접 확인했고 모바일 네 버튼의 한 줄 정렬, label과 카드의 잘림이 없었다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Playwright device context는 모바일 UA·touch·viewport와 DOM/layout 계약을 검증하지만
  실제 iOS·Android에 설치된 SNS 앱으로의 전환은 에뮬레이션하지 않는다. 최종 owner-only
  Sites 후보에서 작업지시자가 실기기 버튼을 직접 눌러 확인해야 한다.
- 외부 provider 앱 버전과 로그인 상태에 따라 composer handoff 결과가 달라질 수 있다.
  모바일에서 실패가 관찰된 Facebook·LinkedIn은 렌더 대상 자체에서 제외해 이 경계를
  명확히 했다.

## 다음 단계 영향

- Stage 3에서 `docs/readme-card.md`의 desktop/mobile target 차이와 자동 게시 비보장
  설명을 최소 현행화한다.
- 전체 Node·Playwright·production build 회귀를 통과한 exact commit만 owner-only Sites
  테스트 배포 후보로 사용한다.
- #101 Stage 4는 #102 병합 후 최신 `devel`을 반영하고 모바일 target 필터와 한 줄
  layout을 덮어쓰지 않아야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3로 진행한다.
