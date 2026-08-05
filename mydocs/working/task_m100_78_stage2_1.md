# Task #78 Stage 2.1 보고서 — 소셜 1200x630 캔버스 배치와 두 렌더러 출력

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 2.1

## 단계 목적

소셜 미리보기에서 카드가 잘리지 않도록 1200x630 캔버스 배치 계약을 고정하고, Node와 Worker 두 렌더러가 같은 배치로 소셜 PNG를 만들 수 있게 한다. 저장과 발행은 Stage 2.2로 넘긴다.

## 계획 대비 변경

구현계획서 Stage 2를 조사 결과에 따라 2.1과 2.2로 나누었다. 근거 두 가지를 구현계획서에 함께 기록했다.

- 미디어 계약은 버전 4에 v3 레거시 분기를 유지하고 어댑터가 셋이다. `representations`에 format 축을 넣으면 계약 버전 인상과 정합성 검사 재작업이 따라오므로, 계약 버전을 유지하고 독립 stable key와 전용 store 메서드를 쓰기로 승인받았다.
- 카드 렌더러가 Node용과 Worker용 두 구현이고 프로덕션 Sites는 Worker 구현을 쓴다. 계획서에 없던 사실이며 소셜 출력도 양쪽에 필요하다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/social-canvas.js` | 신규. 캔버스 배치 계약과 `computeSocialCanvasLayout` |
| `src/profile-card/renderer.js` | `renderProfileSocialCardPng` 추가, 카드 드로잉을 `drawCard`로 분리 |
| `src/profile-card/worker-renderer.js` | SVG 본문을 `createWorkerProfileCardBody`로 분리, `createWorkerProfileSocialCardSvg`와 `renderSocial` 추가 |
| `src/profile-card/__tests__/social-canvas.test.js` | 신규. 배치 계약 9개 테스트 |
| `src/profile-card/__tests__/social-renderer.test.js` | 신규. 두 렌더러 출력 7개 테스트 |

## 고정한 배치

```
캔버스 1200 x 630
카드   960 x 588.6974  (x=120, y=20.6513, scale 1.9238)
여백   좌우 120, 상하 20.65
```

종횡비 499:306을 보존하고 양축 중앙 정렬한다. 캔버스 배경은 카드 테마 배경색을 그대로 쓴다.

## 설계 판단 3건

- **배경색을 새로 만들지 않았다.** 캔버스 배경에 카드 테마 배경색을 그대로 써서, 결과가 "여백이 넓은 카드"로 보인다. 팔레트에 캔버스용 색이 없고, 색을 추가하는 것은 이번 task의 제외 범위인 렌더러 시각 디자인 변경에 해당한다.
- **배치 모듈이 렌더러를 import하지 않는다.** 두 렌더러가 배치 모듈을 import하므로 반대 방향 의존은 순환이 된다. 카드 논리 크기를 배치 모듈의 자체 상수로 두고, 렌더러 값과 일치하는지 테스트로 고정해 드리프트를 막았다.
- **Worker 렌더러는 본문 분리로 처리했다.** 카드 SVG를 문자열로 감싸는 대신 본문 마크업을 함수로 분리해 두 래퍼가 공유한다. 소셜 SVG가 카드 SVG의 본문을 그대로 포함하는지 테스트로 고정했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/social-canvas.test.js
node --test src/profile-card/__tests__/social-renderer.test.js
npm test
git diff --check
```

결과:

- OK. `social-canvas.test.js` 9개 통과
- OK. `social-renderer.test.js` 7개 통과. 1200x630 출력, 안전 영역 배경색, 카드 영역 내부 콘텐츠, 바이트 결정성, Worker SVG 배치와 본문 재사용, 기존 카드 SVG 치수 유지
- OK. `npm test` 전체 649개 중 643 pass, 0 fail, 6 skipped. Stage 1 시점 636 pass 대비 증가분은 이번 테스트 16개
- OK. `git diff --check` 경고 없음
- OK. 렌더 결과를 육안 확인했다. 카드가 잘리지 않고 좌우 여백이 균등하다

## 잔여 위험

- Worker 렌더러의 소셜 출력은 SVG 구조까지만 검증했다. 실제 resvg 렌더 결과는 Wasm 자산이 필요해 Stage 2.2 또는 Stage 3의 통합 검증에서 확인한다.
- 캔버스 배경이 카드 배경과 같아 카드 경계가 보이지 않는다. 의도한 선택이지만 시각적으로 카드를 구분하고 싶으면 별도 승인이 필요하다.

## 다음 단계 영향

- Stage 2.2는 `renderProfileSocialCardPng`와 Worker `renderSocial`을 발행 경로에 연결하고, `cards/v2/public/{handle}/social.png` stable key와 전용 store 메서드를 세 어댑터에 추가한다.
- OG 폴백 이미지는 운영자 핸들의 소셜 이미지를 가리키므로 Stage 2.2에서 함께 연결한다.

## 승인 요청

- Stage 2.1 산출물과 검증 결과를 승인하면 Stage 2.2로 진행한다.
