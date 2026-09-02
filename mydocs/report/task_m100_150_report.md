# Task #150 최종 보고서 — PNG·GIF 첨부 내보내기의 SNS 경계 보완

GitHub Issue: [#150](https://github.com/postmelee/codex-usage-profile/issues/150)
마일스톤: M100

## 작업 요약

- 대상 이슈: #150
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: Share Studio에서 저장하는 PNG·GIF를 `998×612 / 499:306 / 전 픽셀 불투명` 계약으로 통일하고, PNG는 SNS가 최종 clipping을 소유하게 하며 GIF는 X 표시 반경에 맞춰 투명 모서리와 이중 경계를 제거한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-card/attachment-canvas.js` | 첨부용 `998×612` canvas, dark `#181818`·light `#FFFFFF` 불투명 surface와 무경계 합성 계약 추가 | Save PNG·GIF의 base frame |
| `src/profile-ui/pngExport.js`, `src/profile-ui/ShareStudio.jsx` | stable URL 다운로드와 분리된 브라우저 PNG Blob 생성·저장 및 lifecycle 연결 | 데스크톱·모바일 Save PNG UX |
| `src/profile-card/gif-animation.js`, `src/profile-card/gif-beam-frames.js` | X 기준 output radius 32와 export preset v4 적용 | Save GIF effect geometry·cache key |
| `src/profile-card/gif-binary.js`, `src/profile-card/gif-encoder.js`, `src/profile-ui/gifExport.worker.js` | 투명 palette index를 제거하고 모든 frame을 불투명 global palette로 생성 | GIF binary·Worker 출력 계약 |
| `src/profile-card/assets/ocean-*-x-radius-v2.rgba-runs.bin` | 기존 dark/light 모션과 색상을 유지한 X 반경 Chrome golden으로 교체 | GIF perimeter effect |
| `src/profile-card/__tests__/*`, `src/profile-ui/__tests__/*`, `tests/profile-ui.spec.js` | dimension·alpha·surface·radius·phase·seam·파일 크기·저장 lifecycle 회귀 추가 | 단위·통합·브라우저 검증 |
| `docs/readme-card.md` | stable, attachment, OG 출력 계약과 X canonical GIF·Reddit best-effort 경계 문서화 | 공개 사용자 문서 |
| `mydocs/plans/task_m100_150*.md`, `mydocs/working/task_m100_150_stage*.md` | 계획, 단계별 구현·검증·승인 이력 기록 | 내부 작업 추적 |

기존 radius 64용 `ocean-beam-golden-v1.rgba-runs.bin`과 `ocean-light-keyline-golden-v1.rgba-runs.bin`은 preset v4에서 사용되지 않아 제거했다. Git 이력에서는 복구할 수 있다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/readme-card.md` | `docs/` | `docs/readme-card.md` | OK | Share Studio 사용자가 소비하는 공개 저장 규격이므로 기존 카드·GIF 사용자 문서에 최소 반영했다. |
| Task #150 계획·단계·최종 보고서 | `mydocs/` | `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | OK | 구현·검증·승인 이력을 내부 작업 산출물 위치에 보관했다. |

새 공식 문서 루트나 `mydocs/manual/` 문서는 만들지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| Save PNG 파일 계약 | stable PNG 직접 다운로드, `1497×918`, 둥근 모서리 밖 alpha 0 | attachment PNG Blob, `998×612`, alpha min/max `255/255` |
| Save GIF 바깥 픽셀 | `998×612`, transparent palette index 사용 | `998×612`, transparency flag·transparent index 없음, 모든 frame alpha 255 |
| 라이트 Save PNG 경계 | Stage 3 기준 `#F3F5F7` surface + `#D0D7DE` outline | `#FFFFFF` surface, 파일 내부 border·radius 없음 |
| GIF effect 반경 | output 64px, preset v3 | X 기준 output 32px, preset v4 |
| GIF 시간 계약 | 96 frames, 20fps, 50ms, 4.8초, 무한 반복 | 동일 |
| 대표 다크 PNG / 라이트 PNG | Stage 3: 109,360 / 106,604 bytes | Stage 4: 109,360 / 102,081 bytes |
| 대표 다크 GIF / 라이트 GIF | Stage 3: 6,211,471 / 5,573,674 bytes | Stage 4: 6,186,701 / 5,973,842 bytes |
| golden effect 자산 | dark 2,450,742 / light 2,980,721 bytes | dark 2,368,640 / light 2,793,151 bytes |
| stable README PNG | `1497×918`, 투명 모서리 | 변경 없음 |
| OG social PNG | `2400×1260` | 변경 없음 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| dark/light Save PNG와 GIF가 모두 `998×612`, `499:306`이며 전 픽셀·frame이 불투명하다. | OK — PNG alpha min/max `255/255`, GIF transparency flag·index 부재와 96개 frame 전체 불투명을 단위·E2E에서 확인했다. |
| 카드 내부 크기, 좌표, content bounds와 dark/light 나머지 geometry는 바뀌지 않는다. | OK — source를 `0,0,998,612` 전체 bounds에 합성하며 추가 padding·crop·translation이 없고 RGB geometry 대조를 통과했다. |
| Save PNG에는 정적 border 또는 encoded radius가 없고 SNS가 최종 clipping을 소유한다. | OK — dark/light corner와 라이트 상단 중앙이 카드 surface와 같고 attachment outline이 `null`임을 검증했다. |
| GIF만 X 표시 경계에 맞춘 output radius 32를 사용하며 기존 모션·색상·타이밍을 유지한다. | OK — 양쪽 golden의 radius 판별 픽셀, 동일 phase 사분면, 95→0 seam ratio `0.975`, 96 frames·20fps·4.8초를 확인했다. |
| 대표 GIF는 15MB 미만이다. | OK — dark `6,186,701`, light `5,973,842 bytes`다. |
| stable `/u/{handle}/card.png`, OG `/social.png`, 라이브 Border Beam은 변경되지 않는다. | OK — 기준 commit `e5eb6c6` 대비 stable/social renderer와 `MarketingLanding.jsx` diff가 없고 집중 회귀가 통과했다. |
| Share Studio 저장·실패·재시도·취소·모바일 PNG 경계가 회귀하지 않는다. | OK — 집중 Chromium E2E `7/7`, 전체 E2E `111/111` 통과했다. |
| 프로덕션 build와 Sites artifact가 유효하다. | OK — server 63 modules, client 1841 modules를 빌드했고 verifier `ok=true`, artifact `10,638,208 bytes`를 확인했다. |

### 단계별 검증 결과

- Stage 1: [`task_m100_150_stage1.md`](../working/task_m100_150_stage1.md) — 첨부 canvas와 Save PNG 분리, 집중 Node·E2E·build 검증 완료.
- Stage 2: [`task_m100_150_stage2.md`](../working/task_m100_150_stage2.md) — 불투명 GIF palette/encoder와 기존 motion 동등성 검증 완료.
- Stage 3: [`task_m100_150_stage3.md`](../working/task_m100_150_stage3.md) — Node 고유 test `937`개 중 `931 pass / 6 conditional skip / assertion failure 0`, 전체 Playwright `111/111`, production artifact 검증 완료.
- Stage 4: [`task_m100_150_stage4.md`](../working/task_m100_150_stage4.md) — 라이트 PNG 무경계와 X radius 32 GIF 시제품, 집중 Node `44/44`, E2E `7/7`, build·Sites verifier 검증 및 작업지시자 승인 완료.

### 최종 통합 재검증

- `node --test src/profile-card/__tests__/attachment-canvas.test.js src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/pngExport.test.js src/profile-ui/__tests__/gifExport.test.js`: `44/44` 통과.
- `npx playwright test tests/profile-ui.spec.js --grep "Task #150|Share Studio.*PNG|GIF"`: `7/7` 통과.
- `npm run build:production`: server `63`, client `1841` modules 빌드 성공.
- `npm run verify:sites-production`: `ok=true`, artifact `10,638,208 bytes`, client `15 files`, Worker `2 files`, bindings `3`, migrations `6`.
- `git diff --check`: 경고 없음.

## 잔여 위험과 후속 작업

### 잔여 위험

- 하나의 GIF가 X의 rounded clipping과 Reddit의 square clipping을 동시에 정확히 따를 수 없다. 이번 계약은 작업지시자 승인에 따라 X를 canonical 대상으로 하고 Reddit은 동일한 불투명 사각 GIF의 best-effort 표시로 둔다.
- X 업로드 후 발생하는 플랫폼 재인코딩과 표시 정책은 저장소 자동 검증 범위 밖이다. 로컬 산출물·Chromium 다운로드와 작업지시자 시제품 검수는 완료했지만, merge·배포 뒤 실제 게시 확인은 운영 검증으로 남는다.
- Node 24의 real-workerd `d1-concurrency.test.js` 정지는 기존 Issue #135와 동일한 저장소 환경 문제다. Task #150 assertion failure는 없었고 Node 22 real-workerd 6개 파일 `54/54` 및 분리 회귀로 보완했다.

### 후속 작업 후보

- Reddit 전용 square GIF 또는 플랫폼별 export preset은 실제 요구가 확인될 때 별도 이슈로 분리한다.
- Task #150 merge 후 production 반영은 별도 릴리스·배포 절차에서 수행한다.

## 작업지시자 승인 이력

- 2026-09-02: Stage 4 라이트 PNG 무경계·X radius 32 GIF 시제품 승인.
- 2026-09-02: 최종 보고·`publish/task150` push·`devel` 대상 PR 게시 절차 진행 승인.
