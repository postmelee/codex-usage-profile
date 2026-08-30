# Task #146 Stage 2 보고서 — 라이트 동일 모션 라이브·GIF 대비 보정

GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
구현계획서: [`task_m100_146_impl.md`](../plans/task_m100_146_impl.md)
Stage: 2 (2차 재작업)

## 단계 목적

Stage 1에서 연결한 정규화 카드 테마를 실제 시각 합성까지 확장한다. 다크 라이브의 기존 `md` Ocean 효과와 기존 Chrome golden bytes는 그대로 고정한다. 라이트도 다크와 같은 `md` conic mask, 둘레 회전, 위상, 폭, 4.8초 타이밍과 stroke·inner·bloom 레이어 구조를 사용하되, 흰 카드에서 보이도록 graphite/blue 색상과 레이어 opacity만 라이트 전용으로 조정한다.

Share Studio GIF 요청에도 canonical `cardTheme`을 전달해 라이브와 저장 GIF가 같은 테마별 색상·대비 계약을 사용하게 한다. 카드 본문과 geometry는 변경하지 않는다. 양 테마 모두 원본 `1497×918`, 표시 비율 `499:306`, 동일 bounds·반경을 유지하고 GIF는 `998×612`, 20fps, 4.8초, 96프레임 계약을 유지한다.

최초 Stage 2의 계산 스타일만으로 시각 수용성을 판단한 결과와 이후 라이트를 하단 좌→우 `line` 모션으로 분리한 결과는 작업지시자 검수로 모두 철회했다. 이 보고서는 다크와 완전히 같은 움직임·효과 구조에서 라이트 색상·대비만 변경한 최종 재작업 결과다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin` | installed Chrome에서 DPR 2로 캡처한 라이트 `md` 동일 모션 96 phase sparse golden |
| `src/profile-card/gif-animation.js` | 기존 다크 preset을 유지하고 같은 `md` 기반 라이트 전용 opacity scale 추가, GIF preset version 2 유지 |
| `src/profile-card/gif-beam-frames.js` | 정규화 theme에 따른 dark/light golden URL 선택 |
| `src/profile-marketing/MarketingLanding.jsx` | 같은 정규화 card theme로 theme별 live 색상·대비 preset을 선택하되 카드 bounds 유지 |
| `src/profile-ui/ShareStudio.jsx`, `gifExport.js`, `gifExport.worker.js` | `cardTheme`을 controller → Worker → asset loader·encoder까지 전달하고 Worker enum 검증 |
| `src/profile-card/__tests__/gif-animation.test.js`, `gif-beam-frames.test.js` | 동일 `md` preset, asset SHA·bounds·사분면 phase·대표 frame·seam·dark 무변경 회귀 |
| `src/profile-ui/__tests__/gifExport.test.js`, `themeSurfaceContract.test.js` | theme request·asset 선택·실제 dark/light encode·유효 enum·live 연결 회귀 |
| `tests/profile-ui.spec.js` | 양 테마 `md`, 동일 타이밍·geometry, 라이트 색상·opacity와 노드 유지 브라우저 회귀 |
| `mydocs/plans/task_m100_146.md`, `task_m100_146_impl.md` | 거절된 `line` 결과와 최종 동일 모션·테마별 대비 요구사항 반영 |
| `mydocs/orders/20260830.md` | Stage 2 재작업 상태 반영 |

신규 light asset은 compressed 2,980,721 bytes, decoded 12,998,178 bytes이며 SHA-256은 `1a1368c9b9c36e234fea3da7305da62565594c824c2261e9feb1aab988b76d1c`다. 실제 표시와 GIF 양자화에 영향을 주지 않는 alpha `1–2/255` 픽셀만 sparse asset에서 제외해 기존 compressed 3,000,000 bytes 계약을 유지했다.

기존 dark asset은 compressed 2,450,742 bytes, decoded 19,767,832 bytes와 SHA-256 `aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680`을 그대로 유지했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 제품 동작은 다음 경계 안에서 변경했다.

- 다크 live는 기존 `md / ocean / brightness 1.05 / strength 0.82 / duration 4.8s` 입력, opacity override 없음, 기존 golden을 그대로 사용한다.
- 라이트 live도 `md / ocean / brightness 1.05 / strength 0.82 / duration 4.8s`를 사용한다. theme의 graphite/blue 합성 위에 CSS scale `stroke 5 / inner 2.5 / bloom 1.25`만 적용한다.
- 두 테마는 같은 conic mask와 stroke·inner·bloom 레이어, 같은 linear perimeter rotation과 fade timing을 사용한다. 라이트에 `line` 또는 다른 이동 경로를 사용하지 않는다.
- GIF source key와 Worker request가 모두 canonical theme를 포함한다. preset version 2로 테마를 무시하던 이전 결과를 재사용하지 않는다.
- 카드 PNG·소셜 PNG renderer, publication/cache, persistent card style schema, 원격 배포 환경은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/themeSurfaceContract.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #146|Share Studio|Share handoff|loading and unavailable account states|card appearance"
npx playwright test tests/profile-ui.spec.js --grep "GIF"
npm run build:production
npm run verify:sites-production
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=width,height,nb_read_frames,duration,r_frame_rate -of json /private/tmp/task146-dark-same-motion-preview.gif
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=width,height,nb_read_frames,duration,r_frame_rate -of json /private/tmp/task146-light-same-motion-preview.gif
shasum -a 256 src/profile-card/assets/ocean-beam-golden-v1.rgba-runs.bin src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin
git diff --check
```

결과:

- OK — 계획된 Node 검증 36/36 통과, 실패·skip 없음.
- OK — 계획된 Playwright 회귀 27/27 통과. Share Studio, handoff, reduced-motion, loading, card appearance를 포함한다.
- OK — GIF 집중 Playwright 5/5 통과. 실제 Worker 생성·preview·download와 error·cancel·mobile 경계를 확인했다.
- OK — 실제 encoder의 dark/en GIF는 5,969,872 bytes, light/en GIF는 5,703,295 bytes로 모두 15MB 미만이다.
- OK — `ffprobe`에서 두 GIF 모두 `998×612`, 20fps, 4.8초, 96프레임으로 확인됐다.
- OK — 양 테마의 alpha 중심이 frame `0 / 24 / 48 / 72`에서 같은 `좌하단 → 좌상단 → 우상단 → 우하단` 순서를 지난다. dark 중심은 `(230.4,467.6) → (209.8,169.6) → (876.9,191.3) → (736.1,511.9)`, light 중심은 `(232.8,477.2) → (181.9,181.6) → (900.2,189.1) → (735.9,519.8)`이다.
- OK — 라이트 golden 96프레임 모두 효과 픽셀이 존재하며 최소 23,280개, 최대 39,577개다. frame 95→0 delta와 frame 0→1 delta의 비율은 `0.9904`로 loop seam이 인접 프레임 수준이다.
- OK — 실제 카드 위 라이트 대표 frame의 RGB 최대 채널 차이 p95는 `45 / 28 / 38 / 42`, max는 `130 / 105 / 139 / 131`이다. dark의 p95 `27 / 17 / 27 / 34`보다 흰 카드에서 국소 대비가 분명하다.
- OK — 실제 브라우저에서 dark와 light 모두 `data-card-beam-preset=md`, animation duration `4.8s, 0.6s`, strength `0.82`를 사용한다. dark는 white 계열 conic과 saturation `1.2`, light는 graphite 계열 conic과 saturation `1.5`, `stroke=5 / inner=2.5 / bloom=1.25`를 사용한다.
- OK — 테마 전환 전후 같은 Beam DOM·`data-beam` 식별자를 유지하고 이미지 원본 `1497×918`, CSS `aspect-ratio: 499 / 306`, 프레임 폭·높이·곡률이 허용 오차 안에서 동일하다.
- OK — production build server 63 modules, client 1,839 modules 통과. client에는 light asset 2,980.72KB와 기존 dark asset 2,450.74KB가 Worker lazy 경로로 포함된다.
- OK — Sites production artifact verifier `ok: true`; artifact 10,900,957 bytes, client 15 files, worker 2 files, migrations 6개, bindings 3개다.
- OK — GitHub Issue #146 본문을 동일 `md` 모션과 라이트 전용 색상·대비 수용 기준으로 정정했다.

## 시각 검수 자료

- 동기화 비교 GIF: `/private/tmp/task146-dark-light-same-motion-comparison.gif`
- 다크 실제 출력 GIF: `/private/tmp/task146-dark-same-motion-preview.gif`
- 라이트 실제 출력 GIF: `/private/tmp/task146-light-same-motion-preview.gif`
- 대표 phase contact sheet: `/private/tmp/task146-same-motion-contact.png`

동기화 비교 GIF는 왼쪽 다크와 오른쪽 라이트를 같은 96 phase에 맞춰 배치했다. 두 Beam의 위치가 같은 둘레 순서를 지나고, 라이트는 색상·대비만 더 선명하게 보인다. 비교용 배경과 축소 배치만 추가했으며 개별 실제 출력 GIF의 카드 canvas와 frame 계약은 변경하지 않았다.

## 잔여 위험

- GIF의 256색·1-bit alpha 양자화 때문에 CSS의 연속 alpha와 픽셀 단위로 완전히 같지는 않다. installed Chrome에서 동일 preset 96 phase를 캡처하고 실제 encoder 전체 loop를 별도로 확인해 차이를 제한했다.
- 라이트 golden은 기존 compressed size 상한에 근접한다. SHA, compressed/decompressed 상한, 96프레임 effect count를 테스트로 고정해 비정상 재생성을 즉시 실패시킨다.
- 원격 Stage5와 production은 Task #146 브랜치에서 변경하지 않았다. 병합 후 Task #144가 새 exact-main 후보를 고정해 다시 배포·스모크해야 한다.

## 다음 단계 영향

- 작업지시자가 이 Stage 2 시각 결과를 승인한 뒤에만 Stage 3 전체 `npm test`, 전체 Playwright, production build·artifact verifier로 진행한다.
- 최종 변경 목록에서 기존 dark golden SHA, 카드·소셜 PNG renderer와 geometry 무변경을 다시 확인한다.
- #146 병합 뒤 #144는 이전 exact-main 후보를 재사용하지 않고 새 `devel` 병합 커밋부터 main 승격·Stage5·production 검증을 이어간다.

## 승인 요청

- 라이트·다크가 같은 `md` 둘레 회전과 4.8초 타이밍을 사용하고 라이트만 graphite/blue 색상·opacity 대비가 강화된 Stage 2 결과를 승인하면 Stage 3 전체 회귀와 릴리스 인계 확정으로 진행한다.
