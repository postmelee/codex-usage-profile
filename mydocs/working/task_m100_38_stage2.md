# Task M100 #38 Stage 2 완료 보고

GitHub Issue: [#38](https://github.com/postmelee/codex-usage-profile/issues/38)
구현계획서: [`task_m100_38_impl.md`](../plans/task_m100_38_impl.md)
Stage: 2 (피드백 보정 2.6 포함)

## 단계 목적

Home의 실제 카드와 전체 화면 Share Studio의 중앙 카드를 하나의 연속된
대상처럼 보이게 하는 shared-card motion을 구현했다. 첨부 이미지의 desktop
구도를 기준으로 강한 dim/blur, 중앙 title/card/action column, 우측 상단 close와
네 개 원형 primary action을 정렬하고, 기존 기능은 낮은 대비 secondary row로
축약했다. 작업지시자 피드백에 따라 소셜 action을 이미지 복사 안내
disclosure로 바꾸고, 공식 형태의 단색 로고, 저장 toast와 close source
handoff를 추가했다. 추가 피드백으로 한국어 공유 안내의 3번 문구를 고정하고,
참조 Codex 앱과 동일한 check-circle SVG를 저장 성공 toast에 적용했다.
후속 피드백에서는 안내 패널의 높이 animation이 3번 항목을 일시적으로
자르는 문제를 제거했다. 이어서 기존 reveal 감각을 유지해 달라는 피드백에
따라 고정 높이 대신 콘텐츠 자동 높이 위에서 동작하는 clip-path reveal로
160ms motion을 복원했다. 마지막으로 안내 panel close 시 DOM을 즉시
제거하지 않고 120ms 역방향 motion을 완료한 뒤 unmount하도록 보정했다.
후속 피드백으로 안내 panel의 실제 레이아웃 공간 확장과 중앙 column의 상향
이동을 동일한 160ms/ease-out 진행률로 동기화했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-marketing/MarketingLanding.jsx` | 선택형 source card ref와 transition suspension 경계를 추가하고, 공유 중 tilt와 Border Beam의 동작을 정지했다. 기본 marketing caller는 새 prop 없이 기존 동작을 유지한다. |
| `src/profile-ui/HomePage.jsx` | Share click 직전 source card rect를 snapshot하고 source ref/rect를 Studio에 전달하며, close 뒤 상태를 정리한다. |
| `src/profile-ui/ProfileShell.jsx` | topbar Share trigger에서 장식 아이콘을 제거하고 text-only action으로 통일했다. |
| `src/profile-ui/BrandLogo.jsx` | X, LinkedIn, Reddit의 단색 20×20 inline SVG 실루엣을 분리했다. |
| `src/profile-ui/Icons.jsx` | 범용 share/social path를 제거하고 안내용 globe와 참조 Codex 앱의 20×21 check-circle SVG를 18×18 toast 아이콘으로 추가했다. |
| `src/profile-ui/shareStudio.js` | 소셜 작성 창 URL, 3단계 안내와 이미지 복사·저장 toast의 `ko`/`en` copy를 추가하고 한국어 3번 문구를 `게시물에 이미지를 붙여넣으세요`로 고정했다. |
| `src/profile-ui/ShareStudio.jsx` | source/target rect 기반 FLIP open·close, source handoff, 소셜 안내 disclosure, PNG ClipboardItem 복사와 상단 toast를 구현하고 안내 panel의 자연 높이 측정, open/close phase와 animation 완료·fallback timer lifecycle을 추가했다. |
| `src/profile-ui/__tests__/shareStudio.test.js` | X·LinkedIn·Reddit 작성 창 URL과 한국어 3번 안내 문구 계약을 실제 안내 흐름에 맞게 고정했다. |
| `src/styles.css` | source handoff, 공식형 로고 action, 상단 toast motion, 측정 높이·margin·padding·clip-path를 함께 확장하는 160ms 안내 panel reveal과 120ms 역방향 close motion을 구현했다. |
| `tests/profile-ui.spec.js` | text-only Share, logo, 한국어 3번 안내의 실제 panel bounds, open/close motion 계약과 midpoint, panel 공간·상단 column 이동 진행률 동기화, PNG clipboard, 저장 toast와 desktop/mobile 구도를 검증했다. |
| `mydocs/plans/task_m100_38_impl.md` | 작업지시자 피드백으로 변경된 소셜 disclosure와 close handoff 계약을 실제 구현에 맞게 정정했다. |
| `mydocs/orders/20260729.md` | Stage 2 완료와 Stage 3 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기본
`MarketingLanding`/Sites caller는 신규 prop을 전달하지 않아 기존 카드 tilt와
Border Beam 동작이 유지된다. Home의 source card는 공유 중에도 layout 자리를
보존하며 opacity만 교차 전환한다. 기존 provider 공유, Image URL/README 복사,
PNG 저장, 비공개 전환과 modal focus lifecycle은 유지했다. 외부 provider에
이미지를 자동 업로드하지 않고 브라우저 Clipboard API로 PNG를 복사한 뒤
사용자가 작성 창에 붙여넣는 경계를 명확히 했다.

## 검증 결과

실행 명령:

```bash
npm run build
npx playwright test tests/profile-ui.spec.js
node --test \
  src/profile-ui/__tests__/cardShare.test.js \
  src/profile-ui/__tests__/shareStudio.test.js
git diff --check
```

결과:

- OK — Vite production build 성공, 40 modules transformed.
- OK — profile UI Playwright E2E 18개 통과, 실패 0개.
- OK — card/share Node unit test 7개 통과, 실패 0개.
- OK — `git diff --check` 출력 없음.
- OK — 1280×900에서 source card rect가 공유 중에도 0.75px 허용 범위 안에서
  유지되고, motion origin이 `source`이며 keyframe property가
  `transform`/`opacity`로 제한됨을 확인했다.
- OK — 1512×982에서 title/card/action 중심축 오차 1px 이하, card
  600×367.9px, title → card → action 순서와 우측 상단 close 위치를 확인했다.
- OK — settled desktop screenshot 2종을 첨부 이미지와 직접 비교해 strong
  dim/blur, 중앙 column, 원형 action과 compact secondary row 구도를 확인했다.
- OK — 중복 Escape 중 close/focus 복구가 한 번만 완료되고, source tilt가
  다시 활성화됨을 확인했다.
- OK — X/LinkedIn/Reddit action마다 선택 상태와 3단계 안내가 표시되고,
  `image/png` ClipboardItem 복사, 작성 창 allowlist, 저장 완료 toast를
  확인했다.
- OK — `ko-KR` 실제 UI에서 `게시물에 이미지를 붙여넣으세요`가 3번 안내로
  표시되고, 성공 toast가 20×21 viewBox의 두 fill path를 18×18로 렌더링함을
  확인했다.
- OK — 안내 패널에 `max-height` 제한이 없고 정착 시 clip-path 하단 inset이
  0%이며, 3번 항목의 하단 좌표가 패널 하단 안에 포함되는 것을 한국어 실제
  UI와 mobile viewport에서 확인했다.
- OK — 안내 panel reveal이 기존 `160ms`/`ease-out`/`-6px → 0` motion과
  `100% → 0%` 하단 reveal 계약을 유지함을 Web Animations API로 확인했다.
- OK — 안내 panel close가 `120ms`/`ease-in`으로 opacity와 `0 → -6px`,
  하단 reveal `0% → 100%`를 역재생하고 animation 완료 후 unmount되는 것을
  60ms midpoint screenshot과 Web Animations API로 확인했다.
- OK — 1280×900에서 open animation의 0ms·80ms·159ms frame을 고정해
  panel 레이아웃 공간 확장 진행률과 title/card/action column의 상향 이동
  진행률 차이가 3% 이내임을 확인했다.
- OK — close가 `closing → handoff → unmount` 순서로 진행되고 handoff 중
  source와 motion card가 동시에 연결되어 한 프레임 공백이 없음을 확인했다.
- OK — 1280×900과 390×844 screenshot을 첨부 화면과 직접 비교해 action
  logo, 안내 panel, 선택 상태와 가로 overflow 부재를 확인했다.

## 잔여 위험

- mobile·short viewport와 reduced-motion의 상세 회귀 및 source 없음·0-size·
  image failure 시나리오는 Stage 3에서 전용 검증을 추가해야 한다.
- source와 target 이미지가 네트워크 지연으로 서로 다른 시점에 decode되는
  경우의 placeholder 품질은 Stage 3 failure 검증에서 확인해야 한다.
- 브라우저가 PNG ClipboardItem을 지원하지 않거나 권한을 거부하는 경우의
  전용 실패 회귀는 Stage 3에서 보강해야 한다.

## 다음 단계 영향

- Stage 3는 현재 desktop motion과 구도를 변경하지 않고 responsive spacing,
  short viewport scroll, reduced-motion의 공간 이동 제거와 failure fallback을
  고정해야 한다.
- 현재 FLIP 구현은 invalid rect 또는 detached source를 자동으로 target fade로
  낮추므로 Stage 3는 해당 fallback을 E2E로 증명하는 데 집중할 수 있다.
- Stage 3는 desktop 안내 panel의 구도를 유지한 채 short viewport,
  reduced-motion, clipboard rejection과 preview failure를 검증해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3로 진행한다.
