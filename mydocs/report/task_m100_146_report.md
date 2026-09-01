# Task #146 최종 보고서 — 라이트 카드 Border Beam 테마 대비 보정

GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
마일스톤: M100

## 작업 요약

- 대상 이슈: #146
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: 라이트 카드의 Border Beam을 흰 배경에서 식별 가능하게 보정하되 다크와 같은 모션·geometry·GIF 출력 계약을 유지한다.

Task #144의 Stage5 릴리스 후보 검증에서 라이트 카드의 애니메이션이 흰 카드 배경과 섞여 거의 보이지 않는 문제가 발견됐다. 카드와 Beam이 같은 정규화 테마를 소비하도록 소유권을 연결하고, 라이트에는 다크와 동일한 `md` conic 둘레 회전·위상·폭·4.8초 타이밍 위에서 graphite/blue 색상과 opacity 대비만 강화했다.

라이브 미리보기와 저장 GIF가 같은 카드 테마를 사용하도록 Share Studio → GIF controller → Worker → golden asset 경로에 canonical `cardTheme`을 전달했다. 기존 dark live preset과 dark golden bytes, 카드 PNG/SVG·소셜 renderer, 카드 크기·비율은 변경하지 않았다.

2026-08-31 PR #147 리뷰 후 Stage 4에서 golden loader의 헤더 누락 문제를 실제 body 상한 검사로 보완하고, exported preset 정규화와 production golden 실패 시 procedural 대체 금지 회귀를 추가했다. 양쪽 승인 golden·live 대비값·움직임은 그대로 유지했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-marketing/MarketingLanding.jsx` | 카드 테마를 한 번 정규화해 `BorderBeam`과 카드 프레임에 함께 전달하고 theme별 대비 preset 선택 | 라이브 프로필 카드 미리보기 |
| `src/profile-card/gif-animation.js` | dark preset 보존, 같은 `md` 기반 light opacity scale·preset version 2, preset 테마 정규화와 procedural 근사 경계 명시 | 라이브 Beam·GIF cache contract |
| `src/profile-card/gif-beam-frames.js` | 정규화 theme별 golden 선택, 헤더 대신 실제 gzip body 3MB·해제 데이터 25MB 제한과 초과 취소 | GIF Worker frame source |
| `src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin` | Chromium DPR 2에서 캡처한 light `md` 96 phase sparse golden | 라이트 저장 GIF 애니메이션 |
| `src/profile-ui/ShareStudio.jsx`, `gifExport.js`, `gifExport.worker.js` | canonical `cardTheme`을 Worker request, asset loader와 encoder까지 전달·검증 | Share Studio GIF 생성 |
| `src/profile-card/__tests__/gif-animation.test.js`, `gif-beam-frames.test.js` | preset 정규화·SHA·phase·seam·dark 무변경, 헤더·실제 크기 경계·stream 취소 회귀 | 카드 GIF 단위 회귀 |
| `src/profile-ui/__tests__/gifExport.test.js`, `themeSurfaceContract.test.js` | theme 전달·실제 dark/light encode·라이브 소유권, golden 실패 시 encoder 미호출 회귀 | GIF/UI 소스 계약 |
| `tests/profile-ui.spec.js` | 양 테마 동일 모션·geometry, 라이트 대비, handoff·reduced-motion·GIF 브라우저 회귀 | 전체 사용자 흐름 E2E |
| `mydocs/plans/task_m100_146*.md`, `mydocs/working/task_m100_146_stage*.md`, `mydocs/orders/20260830.md`, `20260831.md` | 승인 범위, 단계별 구현·검증, 리뷰 보완, #144 인계와 작업 상태 기록 | 내부 하이퍼-워터폴 추적 |

제품·테스트 변경은 기준 커밋 `aaf997720f296265c8b306840f0eb8af67b08dfb` 대비 12개 파일, 텍스트 `+633/-41`과 light golden binary 한 개다. 이 중 리뷰 보완은 5개 파일 `+206/-16`이며 binary 변경은 없다.

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
| golden 크기 제한 | `Content-Length` 누락 시 정상 에셋 거부, 해제 후 크기 검사 | 실제 gzip body 3MB·해제 25MB를 읽는 도중 제한, 초과 즉시 취소 |
| preset 테마 정규화 | `" LIGHT "` 입력이 asset 선택과 불일치 | 카드·golden과 같은 공통 정규화 |
| 전체 자동 검증 | 리뷰 전 Node 915 pass·6 skip | Node 923 pass·6 조건부 skip·0 fail, Playwright 110/110, production artifact OK |
| production artifact | 리뷰 전 10,900,957 bytes | 10,901,144 bytes (+187), 12MB 예산 잔여 1,098,856 bytes |

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
| 헤더 없이 정상 golden을 읽고 실제 상한은 지킨다. | OK — 양쪽 에셋의 헤더 누락·오류 길이, 3MB 정확한 경계, 압축·해제 초과 취소, malformed gzip 회귀 통과. |
| golden 실패가 미승인 근사 효과로 대체되지 않는다. | OK — dark/light 모두 load 실패 시 typed error로 종료, encoder·progress·complete 호출 없음. |
| 저장소 전체와 production artifact가 회귀하지 않는다. | OK — `npm test` 923 pass·6 조건부 skip·0 fail, `npm run test:e2e` 110/110, production build와 verifier `ok: true`. |
| Task #146이 원격 릴리스 후보를 임의 변경하지 않는다. | OK — Stage5·production·D1/R2·access/environment·npm 쓰기 작업 없음. |

### 단계별 검증 결과

- Stage 1: [`task_m100_146_stage1.md`](../working/task_m100_146_stage1.md) — 카드와 Border Beam의 단일 정규화 테마 소유권을 연결하고 소스 계약을 고정했다.
- Stage 2: [`task_m100_146_stage2.md`](../working/task_m100_146_stage2.md) — 거절된 `line` 결과를 철회하고 동일 `md` 모션의 라이트 색상·대비, theme별 GIF golden과 96프레임 시각·수치 계약을 구현했다.
- Stage 3: [`task_m100_146_stage3.md`](../working/task_m100_146_stage3.md) — 전체 Node·Playwright·production artifact 회귀와 dark renderer 무변경, Task #144 릴리스 인계를 확정했다.
- Stage 4: [`task_m100_146_stage4.md`](../working/task_m100_146_stage4.md) — 헤더 의존 제거·실제 byte 제한·테마 정규화·golden 실패 회귀를 보완했다. 집중 Node 44/44, 전체 Node 929개 중 923 pass·6 skip, 전체 Playwright 110/110, artifact 10,901,144 bytes를 확인했다.

### 검증 한계와 재실행 기록

- 초기 Stage 4 E2E는 병행 검증 중 Vite dependency cache의 `hover-tilt`·`gifenc` 요청이 504 `Outdated Optimize Dep`로 실패해 중단했다. 코드 변경 없이 새 개발 서버에서 단독으로 전체 재실행한 결과가 110/110이다. E2E 중 같은 checkout의 빌드·dependency cache 갱신을 겹치지 않는다.
- GitHub Node 20/22/24 체크는 CLI package와 npm tarball 검증이다. 웹·GIF·Playwright·production artifact를 검증하는 CI가 아니며, 위 수치는 로컬 검증 결과다.
- Stage 4에서는 새 시각 디자인을 만들지 않았다. Stage 2 작업지시자 시각 승인과 양쪽 golden SHA를 보존하고 기존 geometry·효과 E2E를 재실행했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- light golden은 2,980,721 bytes로 실제 gzip body 상한 3,000,000 bytes까지 19,279 bytes만 남는다. 상한은 늘리지 않았으며 SHA·실제 compressed/decompressed 상한과 frame effect count를 자동 회귀로 보호한다.
- production artifact는 10,901,144 bytes로 저장소 예산 12,000,000 bytes까지 1,098,856 bytes(9.16%)가 남는다. 향후 golden 추가/재생성 시 전체 예산을 함께 확인해야 한다.
- GIF는 256색·1-bit alpha이므로 CSS 연속 alpha와 픽셀 단위로 완전히 같지는 않다. 동일 Chromium preset 96 phase 캡처와 실제 encoder loop로 차이를 제한했다.
- Task #146에서는 원격 Stage5·production 수용성을 검증하지 않았다. #144가 새 exact-main 후보를 고정한 후 양쪽 golden HTTP 상태·헤더·실제 body 및 실제 GIF 생성·저장을 스모크해야 한다. 주입 Response 기반 단위 테스트는 CDN 검증을 대체하지 않는다.

### 후속 작업 후보

- 기존 Task #144 재개: #146 PR merge 확인 → 새 `devel` HEAD exact-main 후보 고정 → main 승격 → Stage5 재배포·원격 스모크 → production 배포.
- golden 재생성 자동화: 기존 Chromium capture 절차·opacity·phase·sparse threshold와 SHA 검증을 재현 가능한 스크립트로 묶는 별도 이슈 후보다. 이번에는 등록·구현하지 않았다.

## 작업지시자 승인 요청

- 작업지시자는 2026-08-30 Stage 3 결과를 승인하고 최종 보고서·PR 게시 진행을 지시했다. 이 승인 범위로 `publish/task146` PR을 생성하되 merge와 배포는 별도 승인 전 수행하지 않는다.
- 2026-08-31 “PR 갱신까지 진행해줘” 지시에 따라 Stage 4 보완·재검증·보고와 기존 PR #147 갱신까지 진행한다. merge·이슈 close·#144 배포는 수행하지 않는다.
