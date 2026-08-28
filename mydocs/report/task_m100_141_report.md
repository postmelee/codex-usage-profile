# Task #141 최종 보고서 — 라이트 카드 소셜 썸네일의 플랫폼별 경계 대비 보정

GitHub Issue: [#141](https://github.com/postmelee/codex-usage-profile/issues/141)
마일스톤: M100

## 작업 요약

- 대상 이슈: #141
- 마일스톤: M100
- 단계 수: 본 Stage 3개 + Stage 3.1·3.2 회귀 보강 2개
- 작업 목적: X처럼 투명 픽셀을 흰색으로 합성하는 플랫폼에서도 라이트 카드 경계를 분명히 하되, 다크·라이트 카드의 크기와 내부 geometry는 완전히 동일하게 유지한다.

라이트 소셜 이미지의 카드 바깥에만 불투명 `#F3F5F7` neutral canvas와 논리 `1px`/출력 `2px`의 `#D0D7DE` outline을 적용했다. 기존 `1200×630` 논리 캔버스, `2400×1260` 출력, 카드 위치·크기·radius·내부 배치는 변경하지 않았다. 다크 소셜의 투명 여백과 무테두리 표현, standalone README 카드도 기존 동작을 유지한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-card/social-canvas.js` | 라이트 전용 social surface/frame 공유 계약 추가 | 소셜 캔버스 표현 |
| `src/profile-card/renderer.js` | native 라이트 social을 background → 기존 card → outline 순서로 렌더링하고 version 갱신 | native social PNG |
| `src/profile-card/worker-renderer.js` | Worker SVG에 같은 light-only surface/frame을 적용하고 version 갱신 | production Worker social PNG/SVG |
| `src/profile-card/service-core.js` | fallback renderer version을 새 native contract와 정렬 | renderer source digest |
| `src/profile-card/__tests__/renderer.test.js` | native standalone light/dark 전체 alpha geometry 동일성 고정 | standalone 회귀 |
| `src/profile-card/__tests__/social-canvas.test.js` | 기존 layout exact 값과 light-only surface/frame 파생값 고정 | layout 회귀 |
| `src/profile-card/__tests__/social-renderer.test.js` | native 픽셀·bounds와 Worker SVG 구조·theme geometry 동일성 고정 | native/Worker social 회귀 |
| `src/profile-card/__tests__/worker-renderer.test.js` | Worker 실제 PNG의 surface/bounds와 standalone alpha geometry 고정 | Worker raster 회귀 |
| `src/profile-card/__tests__/service.test.js` | 이전/현재 renderer source digest 분리 검증 | cache identity |
| `src/profile-media/__tests__/social-card-publication.test.js` | stable key/publication ID를 유지한 body·revision·etag 갱신 검증 | 공개 이미지 refresh |
| `docs/readme-card.md` | 라이트 social의 neutral canvas/outline과 다크·standalone 제외 범위 안내 | 공식 사용자 문서 |
| `mydocs/plans/task_m100_141*.md` | 승인 범위, geometry 계약과 단계별 구현 계획 기록 | 작업 계획 |
| `mydocs/working/task_m100_141_stage*.md` | Stage 1~3.2 결과와 검증 근거 기록 | 단계 보고 |
| `mydocs/orders/20260828.md` | Task #141 진행·완료 상태 기록 | 오늘할일 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/readme-card.md` | `docs/` | `docs/readme-card.md` | OK | 기존 README 카드·소셜 이미지 사용자 문서에 공개 동작만 최소 반영했다. |
| `mydocs/plans/task_m100_141*.md` | `mydocs/plans/` | `mydocs/plans/` | OK | 수행계획서와 구현계획서를 계획 문서 위치에 작성했다. |
| `mydocs/working/task_m100_141_stage*.md` | `mydocs/working/` | `mydocs/working/` | OK | 각 단계 보고서를 작업 기록 위치에 작성했다. |
| `mydocs/report/task_m100_141_report.md` | `mydocs/report/` | `mydocs/report/task_m100_141_report.md` | OK | 장기 보관용 최종 보고서 위치가 수행계획과 일치한다. |

새 공식 문서 루트, API·아키텍처·로드맵 문서는 만들거나 변경하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 라이트 social 외곽 픽셀 | 투명, 플랫폼 배경 합성에 의존 | `[243,245,247,255]` (`#F3F5F7`), 불투명 |
| 라이트 card outline | 없음 | `#D0D7DE`, 논리 `1px`/출력 `2px` |
| 논리/출력 canvas | `1200×630` / `2400×1260` | 동일 |
| social card logical bounds | `x=120`, `y≈20.6513026052`, `w=960`, `h≈588.6973947896` | 동일 |
| 관찰 가능한 card coverage | `x=240–2159`, `y=41–1218`, `1920×1178` | 동일 |
| card 원본 종횡비 | `499:306` | 동일 |
| standalone card | `1497×918` | 동일 |
| 다크 social 외곽 | 투명, 무테두리 | 동일 |
| native/default renderer version | `codex-share-card-2` | `codex-share-card-3` |
| Worker renderer version | `codex-share-card-2-resvg-wasm-1` | `codex-share-card-3-resvg-wasm-1` |
| card body/outline radius source | native·Worker body와 social outline의 값 3곳 동기화 필요 | `SOCIAL_CARD_LOGICAL_RADIUS` 단일 정의를 세 경로가 공유 |
| 전체 Node test | Stage 3 기준 883개 중 pass 877, skip 6 | Stage 3.2 기준 887개 중 pass 881, skip 6, fail 0 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 흰색 합성 플랫폼에서도 라이트 카드 경계가 식별된다. | OK — 외곽 `#F3F5F7`와 inset `#D0D7DE` outline을 native/Worker 실제 PNG 픽셀로 확인했다. |
| 카드 크기·위치·종횡비와 내부 배치가 변경되지 않는다. | OK — `computeSocialCanvasLayout()` exact 값과 `1920×1178` coverage bounds를 유지했다. |
| 다크·라이트 카드 본체는 색상 외 geometry가 동일하다. | OK — native/Worker standalone 전체 1,374,246 픽셀의 alpha 차이가 각각 0이고, Worker SVG 구조를 palette 정규화 후 완전 동일 비교했다. |
| 다크 social은 기존 투명 padding과 무테두리를 유지한다. | OK — native/Worker outer pixel alpha 0 및 light/dark coverage bounds 직접 동일 비교를 통과했다. |
| standalone README 카드는 변경되지 않는다. | OK — light/dark 모두 `1497×918`, corner alpha 0, center alpha 255를 유지했다. |
| native와 production Worker가 같은 surface·geometry 계약을 사용한다. | OK — 공유 수치, SVG 순서, 실제 PNG 색상·bounds 회귀를 통과했고 Stage 3.2에서 body와 outline radius도 단일 상수로 결합했다. |
| 기존 공개 social identity를 유지하며 새 bytes가 반영된다. | OK — stable social key와 publication ID를 유지한 채 body·revision·etag가 갱신됨을 검증했다. |
| 저장소 전체 회귀와 production artifact가 유효하다. | OK — 전체 Node test 887개, production build, Sites full-stack verifier와 보호 경로 검사를 통과했다. |

### 단계별 검증 결과

- Stage 1: [`task_m100_141_stage1.md`](../working/task_m100_141_stage1.md) — 라이트 surface/frame, native/Worker parity와 다크·standalone 무회귀를 고정했다.
- Stage 2: [`task_m100_141_stage2.md`](../working/task_m100_141_stage2.md) — renderer version/source digest, stable publication refresh와 공식 문서를 정렬했다.
- Stage 3: [`task_m100_141_stage3.md`](../working/task_m100_141_stage3.md) — 실제 이미지 pixel·시각 QA, 전체 test/build/verifier를 완료했다.
- Stage 3.1: [`task_m100_141_stage3_1.md`](../working/task_m100_141_stage3_1.md) — 다크·라이트 geometry 동일성을 전체 alpha와 SVG 구조 직접 비교로 영구 회귀화했다.
- Stage 3.2: [`task_m100_141_stage3_2.md`](../working/task_m100_141_stage3_2.md) — PR 리뷰에 따라 body/outline radius를 단일 상수로 결합하고 native/Worker corner overhang 전수 회귀를 보강했다.

Stage 3.2에서 핵심 회귀 34개와 전체 Node test 887개를 다시 실행해 전부 통과했고, production
build, Sites verifier와 `git diff --check`를 통과했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 X·Threads crawler의 배경 합성 및 cache 갱신은 외부 플랫폼 통제 영역이다. production 배포, 실제 게시와 cache purge는 이번 task 범위에서 수행하지 않았다.
- Canvas와 resvg의 subpixel anti-alias fringe는 rasterizer별로 다를 수 있다. 따라서 social coverage는 alpha 128 이상으로 비교하며, layout 좌표·coverage bounds·standalone alpha geometry는 동일성 테스트로 고정했다.

### 후속 작업 후보

- 라이트 social golden PNG는 현재 correctness를 막는 결함은 아니지만, public binary와 byte baseline
  유지 정책을 함께 정할 수 있는 별도 task 후보로 남긴다.
- 외부 플랫폼 실게시 확인이 필요해질 경우 production 배포 이후 별도 운영 검증 task로 분리한다.

## 작업지시자 승인 요청

- 2026-08-28 같은 작업 스레드에서 Stage 3.1 결과 확인 후 “진행해줘” 지시로 최종 보고서 작성, 오늘할일 완료 처리와 PR 게시를 승인받았다.
- PR #142 리뷰 검토 후 “권장 처리안으로 진행해줘” 지시로 Stage 3.2 공통 radius 결합, corner overhang 회귀와 import 정렬을 승인받았다.
