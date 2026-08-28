# Task #141 Stage 1 보고서 — 소셜 surface 계약과 renderer parity

GitHub Issue: [#141](https://github.com/postmelee/codex-usage-profile/issues/141)
구현계획서: [`task_m100_141_impl.md`](../plans/task_m100_141_impl.md)
Stage: 1

## 단계 목적

라이트 소셜 썸네일이 흰색 플랫폼에서도 카드 경계를 유지하도록 neutral canvas와 subtle
outline을 추가한다. 기존 social canvas, 카드 배치와 카드 본문 크기는 그대로 유지하며 native
Canvas와 production Worker SVG에 같은 surface/frame 계약을 적용한다. 다크 소셜과 standalone
카드는 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/social-canvas.js` | 라이트 전용 `#F3F5F7` canvas, `#D0D7DE` logical 1px border와 inset outline 파생 helper 추가 |
| `src/profile-card/renderer.js` | native social render를 light에서만 background → 기존 card → outline 순서로 구성 |
| `src/profile-card/worker-renderer.js` | Worker social SVG에 같은 light-only surface와 outline 순서 적용 |
| `src/profile-card/__tests__/social-canvas.test.js` | 기존 layout exact 값과 light-only surface/inset/radius 계약 검증 |
| `src/profile-card/__tests__/social-renderer.test.js` | native light 픽셀·bounds, dark alpha, Worker SVG 순서와 card body 재사용 검증 |
| `src/profile-card/__tests__/worker-renderer.test.js` | Worker 실제 social PNG의 light surface/border와 dark transparent padding 검증 |
| `mydocs/orders/20260828.md` | Stage 1 완료와 Stage 2 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

카드 본문 렌더 함수, theme palette, heatmap/header/stats 좌표와 standalone card API는 수정하지
않았다. `computeSocialCanvasLayout()`의 상수·계산식·반환값도 그대로이며 출력은 계속
`2400×1260`, 계산상 카드는 `x=240`, `y≈41.3026`, `width=1920`, `height≈1177.3948`이다.
라이트 PNG에서 관찰한 비배경 카드 bounds는 기존과 같은 `x=240–2159`, `y=41–1218`,
`1920×1178`이다. 다크 social padding과 rounded corner 바깥 alpha는 계속 0이며 standalone
card는 `1497×918`과 기존 card body를 유지한다.

## 검증 결과

구현계획서 지정 명령:

```bash
node --test src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
git diff --check
```

결과:

- OK — 지정 Node test 27개 통과, 실패·skip 없음.
- OK — light canvas corner/padding은 `#F3F5F7`, alpha 255이고 straight edge는
  `#D0D7DE` logical 1px/output 2px로 검증했다.
- OK — native light의 비배경 bounds가 `x=240–2159`, `y=41–1218`임을 픽셀 전수 검사로
  고정했다.
- OK — Worker 실제 light social PNG와 SVG markup에서 surface/frame을 확인했고 dark에는
  surface markup과 opaque padding이 없음을 확인했다.
- OK — `git diff --check` 출력 없음.

추가 회귀 명령:

```bash
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/worker-renderer-visual.test.js
```

결과:

- OK — standalone native/Worker card 회귀 4개 통과, `1497×918` dimensions와 대표 content
  region 유지.

## 잔여 위험

- renderer version은 Stage 2에서 올리므로 기존에 공개된 light social object의 source digest와
  refresh 동작은 아직 새 계약으로 고정되지 않았다.
- native Canvas와 resvg의 rounded corner anti-alias 차이에 대한 대표 이미지 대조와 전체 회귀는
  Stage 3에서 수행한다.

## 다음 단계 영향

- Stage 2는 이 Stage의 shared surface/frame 수치를 변경하지 않고 renderer version을
  `codex-share-card-3` / `codex-share-card-3-resvg-wasm-1`로 갱신한다.
- 이미 공개된 light profile은 stable social key와 publication identity를 유지하면서 다음 기존
  refresh에서 body·revision·etag만 갱신되는지 회귀 테스트로 고정한다.
- `docs/readme-card.md`에는 light social의 neutral canvas와 subtle outline만 사용자 관점에서
  최소 설명한다.

## 승인 요청

- Stage 1의 light-only surface/frame 구현과 native/Worker parity 검증 결과를 승인하면 Stage 2로
  진행한다.
