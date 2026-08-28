# Task #39 Stage 3.4 보고서 — compact viewport scrim·안내 layout 교정

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 3.4

## 단계 목적

Firefox의 좁은 창에서 Share Studio를 세로 스크롤했을 때 하단 secondary action 영역에
검은 scrim이 적용되지 않고 원래 페이지 배경이 드러나는 문제를 교정했다. GIF 안내가
추가된 낮은 viewport에서는 preview와 panel 밀도를 함께 조정하고, 마지막 action 아래에
안전 여백을 보장했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ShareStudio.jsx` | GIF 안내가 열린 dialog에 `has-instructions` 상태 class 추가 |
| `src/styles.css` | scroll owner 자체 scrim, background-color enter/exit, 높이별 preview 520px/420px, narrow panel 밀도와 40px/48px 하단 여백 |
| `tests/profile-ui.spec.js` | 740×620 narrow scroll의 scrim·card·panel·bottom padding을 Chromium/Firefox에서 검증 |
| `mydocs/plans/task_m100_39_impl.md` | Stage 3.4 보정 범위와 회귀 계약 기록 |
| `mydocs/orders/20260828.md` | Stage 3.4 완료와 Stage 4 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 구조는 투명한
`.share-studio-backdrop` 안의 `position: fixed` pseudo-element만 scrim을 칠했다.
backdrop이 scroll owner이면서 `backdrop-filter` containing block이 되므로 긴 콘텐츠의
하단 scroll 영역에서는 pseudo-element 바깥의 원래 페이지 배경이 노출됐다.

scrim background를 scroll owner 자체로 옮겨 모든 scroll 위치에서 같은 색을 유지했다.
콘텐츠 opacity를 함께 바꾸지 않도록 기존 280ms enter·400ms exit와 reduced-motion
140ms·110ms를 background-color만 보간하는 animation으로 변경했다. 이는
`motion-design`의 단일 상태 속성 원칙과 enter decelerate/exit accelerate 방향을 따른다.

card 축소는 `has-instructions`이면서 높이 900px/760px 이하일 때 표시 width만
520px/420px로 제한한다. 생성·저장되는 GIF의 998×612·20fps·96-frame 데이터와
PNG/mobile 계약은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/gifExport.test.js
npm run test:e2e -- --grep "Share Studio|GIF"
npm run test:e2e -- --browser=firefox --grep "narrow scroll"
npm run build:production
git diff --check
```

결과:

- OK — Share Studio·GIF 단위 테스트 27개 통과, 실패·skip 없음.
- OK — 기본 Chromium Share Studio·GIF E2E 21개 통과, 실패·skip 없음.
- OK — Firefox 150 Playwright narrow-scroll E2E 1개 통과.
- OK — 740×620에서 안내 전 600px preview가 안내 후 420px로 축소되고, 안내 row
  gap 8px·최소 높이 28px·하단 padding 48px을 유지한다.
- OK — backdrop 끝까지 scroll한 뒤에도 background alpha가 0.9 이상이며 viewport
  하단 element가 backdrop이고 transparent pseudo-element가 존재하지 않는다.
- OK — reduced motion에서는 spatial keyframe 없이 140ms/110ms background fade만
  유지한다.
- OK — production server 63 modules, client 1,838 modules build 통과. GIF Worker와
  2.45MB beam asset 분리는 그대로 유지됐다.
- OK — `http://127.0.0.1:4175/` production mock에서 한국어 X 안내, 420px preview,
  compact 3단계 panel과 검은 scrim을 시각 확인했다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- 짧은 viewport에서는 전체 콘텐츠를 한 화면에 강제로 압축하지 않고 backdrop 세로
  scroll을 유지한다. 이는 카드·버튼 가독성과 40px/48px 하단 여백을 보존하기 위한
  의도된 동작이다.
- 실제 Firefox 창에는 캐시된 이전 build가 남을 수 있으므로 로컬 확인 시 새로고침이
  필요하다.

## 다음 단계 영향

- Stage 4 공식 문서와 통합 QA에서 desktop GIF 안내와 함께 compact viewport의
  scroll·scrim·height-aware preview 계약을 최종 확인한다.
- GIF output preset과 파일 용량은 Stage 3.4의 영향을 받지 않는다.

## 승인 요청

- Stage 3.4 구현·Chromium/Firefox 검증·로컬 시각 확인을 완료했다. Stage 4 공식
  문서와 전체 통합 QA 진입은 작업지시자의 별도 승인을 기다린다.
