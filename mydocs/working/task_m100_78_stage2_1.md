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
레이아웃 1200 x 630   (좌표 기준)
출력     2400 x 1260  (레이아웃 x 2)
카드     960 x 588.6974  (x=120, y=20.6513, scale 1.9238)
여백     좌우 120, 상하 20.65
```

출력 배율 2배는 작업지시자 확인 후 추가했다. 1200x630 그대로 내보내면 카드 콘텐츠가 1.9238배로 그려져 `card.png`의 3배 대비 선형 해상도가 64%로 떨어지고, 특히 44pt 아바타가 132px에서 85px로 줄어 리샘플링 열화가 눈에 띄었다. 2배 출력에서는 카드 콘텐츠가 3.85배, 아바타가 169px로 `card.png`보다 선명하다. Open Graph 이미지는 1200x630이 최소 권장치이고 플랫폼이 더 큰 이미지를 허용하므로 `og:image:width/height`는 실제 값인 2400x1260을 선언한다.

종횡비 499:306을 보존하고 양축 중앙 정렬한다. 캔버스 배경은 카드 테마 배경색을 그대로 쓴다.

## 설계 판단 3건

- **여백을 투명으로 둔다.** 초기 구현은 캔버스 배경에 카드 테마 배경색을 채웠으나, 작업지시자 지시로 여백을 투명으로 바꾸었다. 카드 자체의 크기, 비율, 테두리 곡선은 그대로 유지되고 둥근 모서리가 여백과 구분되어 보인다. 팔레트에 캔버스용 색을 추가하지 않으므로 렌더러 시각 디자인 변경이라는 제외 범위도 건드리지 않는다.
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
- OK. `social-renderer.test.js` 8개 통과. 1200x630 출력, 여백 투명도, 둥근 모서리 노출, 카드 영역 내부 콘텐츠, 바이트 결정성, Worker SVG 배치와 본문 재사용, 기존 카드 SVG 치수 유지
- OK. `npm test` 전체 649개 중 643 pass, 0 fail, 6 skipped. Stage 1 시점 636 pass 대비 증가분은 이번 테스트 16개
- OK. `git diff --check` 경고 없음
- OK. 렌더 결과를 육안 확인했다. 카드가 잘리지 않고 좌우 여백이 균등하다

## 잔여 위험

- Worker 렌더러의 소셜 출력은 SVG 구조까지만 검증했다. 실제 resvg 렌더 결과는 Wasm 자산이 필요해 Stage 2.2 또는 Stage 3의 통합 검증에서 확인한다.
- **투명 여백의 플랫폼 합성 색을 우리가 통제할 수 없다.** X, Meta 계열, 카카오는 미리보기 이미지를 자체 서버로 미러링하면서 알파를 흰색 또는 검정으로 평탄화하거나 JPEG로 변환할 수 있다. dark 카드가 흰 여백 위에 놓이면 의도한 대로 보이지만, light 카드가 흰색으로 평탄화되면 모서리가 다시 사라지고 dark 카드가 검정으로 평탄화되면 여백이 카드와 붙어 보인다. Stage 6의 실플랫폼 확인에서 세 플랫폼 x 두 테마를 실측하고, 결과가 나쁘면 테마별 불투명 여백으로 되돌리는 선택지를 남긴다.

## 다음 단계 영향

- Stage 2.2는 `renderProfileSocialCardPng`와 Worker `renderSocial`을 발행 경로에 연결하고, `cards/v2/public/{handle}/social.png` stable key와 전용 store 메서드를 세 어댑터에 추가한다.
- OG 폴백 이미지는 운영자 핸들의 소셜 이미지를 가리키므로 Stage 2.2에서 함께 연결한다.

## 승인 요청

- Stage 2.1 산출물과 검증 결과를 승인하면 Stage 2.2로 진행한다.
