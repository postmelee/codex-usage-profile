# Task #39 Stage 3.5 보고서 — narrow GIF action 정렬·secondary 밀도 교정

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 3.5

## 단계 목적

좁은 desktop 화면의 GIF 모드에서 4열 grid 중 3개 열만 채워져 X·Reddit·GIF 저장
동작이 왼쪽으로 치우쳐 보이는 문제를 교정했다. GIF 첨부 안내 아래의 secondary action
밀도를 낮추고 modal 마지막 동작 뒤의 안전 여백을 늘렸다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ShareStudio.jsx` | backdrop 안내 상태와 primary action format을 명시하는 상태 attribute 추가 |
| `src/styles.css` | narrow GIF 3열 중앙 정렬, 안내 상태 secondary 36px 밀도, 64px 하단 safe padding |
| `tests/profile-ui.spec.js` | PNG/GIF 열 수, action 중심, secondary 밀도와 하단 padding 회귀 검증 |
| `mydocs/plans/task_m100_39_impl.md` | Stage 3.5 보정 범위와 desktop/mobile 경계 기록 |
| `mydocs/orders/20260828.md` | Stage 3.5 완료와 Stage 4 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 narrow grid는 형식과 무관하게
`repeat(4, 60px)`를 사용했다. GIF 모드에서는 action이 3개뿐이라 grid 전체는 중앙에
있어도 점유된 세 열은 왼쪽으로 치우쳐 보였다. action container에 format 상태를
명시하고 GIF에서만 3열을 사용해 점유 영역과 시각 중심을 일치시켰다.

secondary 축소와 64px 하단 padding은 `has-instructions` 상태의 narrow desktop에만
적용했다. 실제 mobile은 GIF selector와 안내가 DOM에 없으므로 기존 44px touch target을
유지한다. primary SNS icon 크기와 GIF 출력의 998×612·20fps·96-frame 계약도 변경하지
않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/gifExport.test.js
npm run test:e2e -- --grep "GIF instructions keep the scrim"
npm run test:e2e -- --browser=firefox --grep "GIF instructions keep the scrim"
npm run test:e2e -- --grep "Share Studio|GIF"
npm run build:production
git diff --check
```

결과:

- OK — Share Studio·GIF 단위 테스트 27개 통과, 실패·skip 없음.
- OK — Chromium narrow-scroll E2E 1개 통과.
- OK — Firefox narrow-scroll E2E 1개 통과.
- OK — 기본 Chromium Share Studio·GIF E2E 21개 통과, 실패·skip 없음.
- OK — 740×620에서 PNG 4열, GIF 3열이며 GIF action 묶음의 중심 오차가 0px이다.
- OK — 안내 상태 secondary action이 최소 높이 36px, 글자 11px, padding 4px 6px이고
  backdrop 하단 padding이 64px이다.
- OK — 실제 mobile 흐름의 기존 44px touch target과 PNG 4열 회귀 테스트가 통과했다.
- OK — production server 63 modules, client 1,838 modules build 통과. GIF Worker와
  2.45MB beam asset 분리는 그대로 유지됐다.
- OK — `http://127.0.0.1:4175/` production mock에서 ready GIF X 안내와 action 중심
  오차 0px을 확인하고, 740×620 E2E 캡처에서 compact secondary·하단 여백을 시각 확인했다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- narrow selector는 viewport width 760px 이하에만 적용된다. 브라우저 zoom이나 OS
  text scaling으로 label이 길어져도 60px action 열은 유지하므로 번역 추가 시 별도
  locale 회귀가 필요하다.
- 짧은 viewport는 콘텐츠를 강제로 한 화면에 압축하지 않고 backdrop 세로 scroll을
  유지한다. 64px 하단 여백은 마지막 동작이 화면 끝에 붙지 않게 하기 위한 의도다.

## 다음 단계 영향

- Stage 4 공식 문서와 통합 QA에서 desktop GIF 안내와 함께 760px 경계의 PNG 4열·GIF
  3열, mobile 44px touch target, 하단 64px safe padding을 최종 확인한다.
- GIF output preset과 파일 용량은 Stage 3.5의 영향을 받지 않는다.

## 승인 요청

- Stage 3.5 구현·Chromium/Firefox 검증·로컬 시각 확인을 완료했다. Stage 4 공식
  문서와 전체 통합 QA 진입은 작업지시자의 별도 승인을 기다린다.
