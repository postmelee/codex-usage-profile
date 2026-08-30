# Task #146 최종 보고서 — 라이트 카드 Border Beam 테마 대비 보정

GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
마일스톤: M100

## 작업 요약

- 대상 이슈: #146
- 마일스톤: M100
- 단계 수: 3
- 작업 목적: 라이트 카드의 Border Beam을 흰 배경에서 식별 가능하게 보정하되 다크와 같은 모션·geometry·GIF 출력 계약을 유지한다.

Task #144의 Stage5 릴리스 후보 검증에서 라이트 카드의 애니메이션이 흰 카드 배경과 섞여 거의 보이지 않는 문제가 발견됐다. 카드와 Beam이 같은 정규화 테마를 소비하도록 소유권을 연결하고, 라이트에는 다크와 동일한 `md` conic 둘레 회전·위상·폭·4.8초 타이밍 위에서 graphite/blue 색상과 opacity 대비만 강화했다.

라이브 미리보기와 저장 GIF가 같은 카드 테마를 사용하도록 Share Studio → GIF controller → Worker → golden asset 경로에 canonical `cardTheme`을 전달했다. 기존 dark live preset과 dark golden bytes, 카드 PNG/SVG·소셜 renderer, 카드 크기·비율은 변경하지 않았다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-marketing/MarketingLanding.jsx` | 카드 테마를 한 번 정규화해 `BorderBeam`과 카드 프레임에 함께 전달하고 theme별 대비 preset 선택 | 라이브 프로필 카드 미리보기 |
| `src/profile-card/gif-animation.js` | dark preset 보존, 같은 `md` 기반 light opacity scale과 GIF preset version 2 추가 | 라이브 Beam·GIF cache contract |
| `src/profile-card/gif-beam-frames.js` | 정규화 theme별 dark/light golden asset 선택 | GIF Worker frame source |
| `src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin` | Chromium DPR 2에서 캡처한 light `md` 96 phase sparse golden | 라이트 저장 GIF 애니메이션 |
| `src/profile-ui/ShareStudio.jsx`, `gifExport.js`, `gifExport.worker.js` | canonical `cardTheme`을 Worker request, asset loader와 encoder까지 전달·검증 | Share Studio GIF 생성 |
| `src/profile-card/__tests__/gif-animation.test.js`, `gif-beam-frames.test.js` | preset·SHA·사분면 phase·대표 frame·seam·dark 무변경 계약 | 카드 GIF 단위 회귀 |
| `src/profile-ui/__tests__/gifExport.test.js`, `themeSurfaceContract.test.js` | theme request·asset 선택·실제 dark/light encode·라이브 소유권 회귀 | GIF/UI 소스 계약 |
| `tests/profile-ui.spec.js` | 양 테마 동일 모션·geometry, 라이트 대비, handoff·reduced-motion·GIF 브라우저 회귀 | 전체 사용자 흐름 E2E |
| `mydocs/plans/task_m100_146*.md`, `mydocs/working/task_m100_146_stage*.md`, `mydocs/orders/20260830.md` | 승인 범위, 단계별 구현·검증, #144 인계와 작업 상태 기록 | 내부 하이퍼-워터폴 추적 |

제품·테스트 변경은 기준 커밋 `aaf997720f296265c8b306840f0eb8af67b08dfb` 대비 12개 파일, `+428/-26`과 light golden binary 한 개다.

## 문서 위치 검증

공개 제품·사용자·기여자·외부 통합·API·아키텍처·로드맵 계약은 변경하지 않았다. 수행계획서 판단대로 공식 문서 루트는 수정하지 않고 하이퍼-워터폴 산출물만 `mydocs/`에 추가·수정했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| Task #146 계획·단계·최종 보고서 | `mydocs/` | `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | OK | 기준 diff에 공식 문서 루트 변경 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 라이브 카드 테마 소유권 | `BorderBeam`이 기본 dark theme 사용 | 카드와 Beam이 하나의 canonical `light/dark` theme 공유 |
| dark live motion | `md / ocean / 4.8s / strength 0.82` | 동일, 변경 없음 |
| light live motion | 흰 카드에서 white 계열 효과가 약함 | dark와 같은 `md / ocean / 4.8s / strength 0.82`, graphite/blue 및 `stroke 5 / inner 2.5 / bloom 1.25` |
| GIF theme 선택 | dark/light 모두 dark golden 사용 | dark 기존 golden, light 전용 동일 `md` phase golden 선택 |
| dark golden | 2,450,742 bytes, SHA `aacd0c7…a680` | 동일 bytes·SHA |
| light golden | 없음 | compressed 2,980,721 bytes, decoded 12,998,178 bytes, SHA `1a1368c…d1c` |
| light 효과 frame | theme별 golden 없음 | 96프레임 모두 존재, effect pixel 최소 23,280·최대 39,577 |
| loop seam | light 전용 근거 없음 | frame 95→0 / 0→1 delta 비율 `0.9904` |
| 카드 원본·표시 비율 | `1497×918`, `499:306` | 동일 |
| GIF 출력 계약 | `998×612`, 20fps, 96프레임, 4.8초, 15MB 미만 | 동일; dark 5,969,872 bytes, light 5,703,295 bytes |
| 전체 자동 검증 | 변경 전 기준 | Node 915 pass·6 조건부 skip·0 fail, Playwright 110/110, production artifact OK |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 라이트·다크가 같은 `md` 둘레 회전·위상·폭·4.8초 타이밍을 사용한다. | OK — 양 테마 preset과 animation duration이 같고 frame `0/24/48/72`가 모두 좌하단→좌상단→우상단→우하단 순서를 지난다. |
| 라이트 Beam이 흰 카드에서 분명하게 식별된다. | OK — graphite/blue 합성과 전용 opacity를 적용했고 대표 frame RGB 차이 p95 `45/28/38/42`로 dark `27/17/27/34`보다 국소 대비가 높다. 작업지시자가 동기화 비교 GIF를 시각 승인했다. |
| 다크 효과와 golden은 변경되지 않는다. | OK — 기존 preset override 없음, golden SHA `aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680`과 renderer bytes 유지. |
| 카드 크기·반경·비율과 내용 레이아웃이 동일하다. | OK — 라이트·다크 모두 원본 `1497×918`, CSS `499:306`, 동일 bounds·radius를 Playwright로 비교했다. 카드 native/Worker/social renderer는 기준 diff가 없다. |
| 저장 GIF가 카드 테마를 반영하고 출력 계약을 유지한다. | OK — canonical theme가 Worker까지 전달되고 두 실제 GIF가 `998×612 / 20fps / 96프레임 / 4.8초 / 15MB 미만`이다. |
| loop가 끊기지 않고 라이트의 모든 frame에 효과가 존재한다. | OK — light effect count 최소 23,280, seam ratio `0.9904`, 대표 frame SHA와 asset SHA 고정. |
| reduced-motion과 Share handoff가 회귀하지 않는다. | OK — 전체 Playwright에서 애니메이션 비활성화, 기존 Beam 노드 pause/resume와 decoded-source handoff를 검증했다. |
| 저장소 전체와 production artifact가 회귀하지 않는다. | OK — `npm test` 915 pass·6 조건부 skip·0 fail, `npm run test:e2e` 110/110, production build와 verifier `ok: true`. |
| Task #146이 원격 릴리스 후보를 임의 변경하지 않는다. | OK — Stage5·production·D1/R2·access/environment·npm 쓰기 작업 없음. |

### 단계별 검증 결과

- Stage 1: [`task_m100_146_stage1.md`](../working/task_m100_146_stage1.md) — 카드와 Border Beam의 단일 정규화 테마 소유권을 연결하고 소스 계약을 고정했다.
- Stage 2: [`task_m100_146_stage2.md`](../working/task_m100_146_stage2.md) — 거절된 `line` 결과를 철회하고 동일 `md` 모션의 라이트 색상·대비, theme별 GIF golden과 96프레임 시각·수치 계약을 구현했다.
- Stage 3: [`task_m100_146_stage3.md`](../working/task_m100_146_stage3.md) — 전체 Node·Playwright·production artifact 회귀와 dark renderer 무변경, Task #144 릴리스 인계를 확정했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- light golden은 compressed 3,000,000 bytes 상한에 근접한다. SHA·compressed/decompressed 상한과 모든 frame effect count가 자동 회귀로 고정돼 있다.
- GIF는 256색·1-bit alpha이므로 CSS 연속 alpha와 픽셀 단위로 완전히 같지는 않다. 동일 Chromium preset 96 phase 캡처와 실제 encoder loop로 차이를 제한했다.
- Task #146에서는 원격 Stage5·production 수용성을 검증하지 않았다. #144가 새 exact-main 후보를 고정한 후 재배포·스모크해야 한다.

### 후속 작업 후보

- 기존 Task #144 재개: #146 PR merge 확인 → 새 `devel` HEAD exact-main 후보 고정 → main 승격 → Stage5 재배포·원격 스모크 → production 배포.
- 별도 신규 기능·버그 이슈 후보는 없음.

## 작업지시자 승인 요청

- 작업지시자는 2026-08-30 Stage 3 결과를 승인하고 최종 보고서·PR 게시 진행을 지시했다. 이 승인 범위로 `publish/task146` PR을 생성하되 merge와 배포는 별도 승인 전 수행하지 않는다.
