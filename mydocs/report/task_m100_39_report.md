# Task #39 최종 보고서 — 웹 전용 Animated GIF 생성 및 저장

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
마일스톤: M100

## 작업 요약

- 대상 이슈: #39
- 마일스톤: M100
- 단계 수: 본 Stage 4개, 승인된 품질·리뷰 보정 Stage 3.1–3.5와 4.1 6개
- 작업 목적: 사용자가 desktop web Share Studio에서 현재 사용량 카드를 움직이는
  투명 GIF로 생성·미리보기·저장하고 X 또는 Reddit에 직접 첨부할 수 있게 한다.

카드 본문은 회전·기울기·확대·이동 highlight 없이 고정하고 기존 웹 카드의 Ocean
Border Beam만 4.8초 동안 순환한다. GIF bytes는 server·D1·R2로 보내지 않고 desktop
browser의 module Worker에서만 생성한다. mobile과 기존 PNG·공유·privacy 동작은
그대로 유지했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-card/gif-animation.js`, `gif-beam-frames.js`, `gif-binary.js`, `gif-encoder.js` | social card 공용 geometry에서 파생한 998×612·20fps·96-frame preset, 승인 Chrome beam renderer, global palette encoder와 bounded binary inspector | GIF 출력 계약과 품질 |
| `src/profile-card/assets/ocean-beam-golden-v1.rgba-runs.bin` | 승인 Chrome 96-frame Ocean Border Beam sparse capture | GIF perimeter effect |
| `src/profile-ui/gifExport.js`, `gifExport.worker.js` | same-origin PNG fetch, canonical 문자열 revision 정규화, sequential Worker encode, progress·cancel·timeout·Blob URL 생명주기 | desktop browser GIF 생성 pipeline |
| `src/profile-ui/ShareStudio.jsx`, `shareStudio.js`, `messages.js` | PNG/GIF selector, 자동 생성·skeleton·preview·저장·retry, 25% live progress와 X/Reddit disclosure 안내 | Share Studio desktop UX·접근성·ko/en copy |
| `src/styles.css` | GIF 상태, format 전환, compact 안내, narrow scrim·중앙 정렬·safe padding | Share Studio 반응형 layout과 motion |
| `src/profile-marketing/MarketingLanding.jsx` | 웹 카드와 GIF가 공유하는 Ocean Border Beam preset 사용 | 기존 웹 카드 effect 값 보존 |
| `src/profile-card/__tests__/gif-*.test.js`, `src/profile-ui/__tests__/*.test.js`, `tests/profile-ui.spec.js` | encoder·binary·Worker lifecycle·Share UX·mobile 회귀·seam·시각 계약 자동 검증 | 단위·브라우저 회귀 방지 |
| `package.json`, `package-lock.json` | `gifenc@1.0.3` exact production dependency와 integrity 고정 | browser GIF encoding dependency |
| `vite.config.js` | Worker 첫 사용 중 dev server reload를 막도록 `gifenc` pre-bundle | 개발·E2E 최초 GIF 생성 안정성 |
| `docs/readme-card.md` | GIF 생성·저장·수동 첨부 절차, output 계약, 지원 경계와 문제 해결 | 공식 사용자 문서 |
| `mydocs/plans/task_m100_39*.md`, `mydocs/working/task_m100_39_stage*.md`, `mydocs/orders/*.md` | 승인 범위, Stage 4.1 PR 리뷰 대응, 단계별 결과와 진행 상태 기록 | Hyper-Waterfall 작업 기록 |

PR 최초 게시 시점 변경은 `devel` 대비 36개 파일, 6,544줄 추가, 91줄 삭제였다. Stage 4.1은
최신 `devel`을 merge한 뒤 7개 제품·테스트 파일과 계획·단계·최종·오늘할일 문서를 추가로
보정했다. binary asset은 텍스트 줄 수에 포함되지 않는다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/readme-card.md` | 기존 공식 사용자 문서 최소 수정 | `docs/readme-card.md` | OK | 수행·구현계획서에서 선택한 위치에 desktop GIF 절과 troubleshooting만 추가 |
| `task_m100_39.md`, `task_m100_39_impl.md` | `mydocs/plans/` | `mydocs/plans/` | OK | 승인 범위와 Stage 1–4 계약을 계획 문서에 보존 |
| Stage·최종 보고서 | `mydocs/working/`, `mydocs/report/` | `mydocs/working/`, `mydocs/report/` | OK | 단계별 보고와 장기 보관용 최종 보고를 지정 위치에 작성 |

제품 API·외부 통합·아키텍처·로드맵 문서는 새로 만들거나 이동하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| desktop Share Studio 출력 | PNG만 지원 | PNG 또는 Animated GIF |
| GIF preset | 없음 | 998×612, 20fps, 4.8초, 96 frames, 무한 loop |
| GIF animation | 없음 | 고정 카드 + Ocean Border Beam만 이동 |
| GIF 배경·palette | 없음 | rounded card 밖 alpha 0, global palette 최대 256색, dithering 없음 |
| 대표 GIF 용량 | 없음 | dark/light × en/ko 5,389,199–6,215,447 bytes |
| GIF SNS 안내 | 없음 | X·Reddit 수동 저장·작성 창·첨부 3단계 |
| mobile | PNG-only | PNG-only 유지, GIF DOM·Worker 없음 |
| 전체 Node 검증 | 기능 추가 전 해당 없음 | 917개 중 911 통과, 6 환경 의존 skip, 실패 0 |
| 전체 browser E2E | 기능 추가 전 해당 없음 | Chromium 109개 통과, 실패·skip 0 |
| production client build | GIF Worker·beam asset 없음 | 1,839 modules, Worker 30.56KB, beam asset 2,450.74KB |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 출력 preset과 binary invariant | OK — 998×612, 96 frames, 각 5cs, repeat 0, global palette 최대 256색, local palette 없음, transparent/disposal 1 |
| 승인 시제품과 animation | OK — 카드 본문 고정, Ocean Border Beam만 이동하며 95→0 seam/인접 delta ratio 1.001744 |
| transparent tight bounds | OK — rounded corner 밖 alpha 0, canvas 외부 여백·drop shadow 없음 |
| browser-only Worker pipeline | OK — same-origin PNG, one job, sequential encode, progress, cancel·timeout·stale message·typed error 검증 |
| Blob 저장 계약 | OK — `image/gif`, `codex-usage-profile.gif`, 15,000,000 bytes 미만에서만 ready |
| desktop Share Studio UX | OK — GIF 선택 즉시 skeleton·생성, ready preview·Save GIF, error·Retry, PNG 복귀 검증 |
| GIF 공유 안내 | OK — X·Reddit만 노출하고 저장→composer→직접 첨부 안내, PNG 5개 direct composer 유지 |
| mobile·접근성·reduced motion | OK — mobile PNG-only, keyboard/live status·ko/en copy, reduced-motion static PNG 검증 |
| compact viewport | OK — scrim 연속성, height-aware preview, GIF 3열 중앙 정렬, secondary 밀도와 64px safe padding 검증 |
| 문자열·malformed revision | OK — 공용 parser로 canonical 문자열을 정규화하고 malformed 값은 `null`로 격리해 닫힌 dialog 렌더 크래시 제거 |
| GIF live progress·안내 ARIA | OK — 시각 진행률은 유지하고 낭독은 25% 단위, X·Reddit 패널은 재선택 닫기와 active `aria-controls`를 갖는 disclosure로 검증 |
| 공식 사용자 문서 | OK — desktop GIF 절차, X web 15MB, Reddit media 설정, 미지원 경계를 `docs/readme-card.md`에 기록 |
| 전체 Node 회귀 | OK — `npm test -- --test-concurrency=1`: 911 pass, 6 환경 의존 skip, 0 fail |
| 전체 browser 회귀 | OK — `npm run test:e2e`: 109 pass, 0 fail |
| production build | OK — server 63 modules, client 1,839 modules build 완료 |
| Sites 산출물 | OK — client 14 files, migrations 6, worker 2 files, hosted artifact 검증 완료 |
| local fullstack smoke | OK — 67 routes, canonical update 2개, public PNG 85,391 bytes 검증 완료 |
| diff 무결성 | OK — `git diff --check` 출력 없음 |

PostgreSQL·S3 외부 fixture 6개는 환경 변수가 없는 로컬 통합 검증에서 계획대로 skip됐다.
이 기능이 변경하는 GIF·Share Studio·Sites 경로는 전체 Node·Playwright·local fullstack
검증에서 모두 실행됐다.

### 단계별 검증 결과

- Stage 1: [`task_m100_39_stage1.md`](../working/task_m100_39_stage1.md) — GIF 출력
  preset, encoder dependency, palette와 binary inspector 고정
- Stage 2: [`task_m100_39_stage2.md`](../working/task_m100_39_stage2.md) — module Worker,
  resource bound, lifecycle과 Blob 생성 pipeline 검증
- Stage 3: [`task_m100_39_stage3.md`](../working/task_m100_39_stage3.md) — desktop GIF
  생성·미리보기·저장 UX와 mobile PNG 회귀 검증
- Stage 3.2: [`task_m100_39_stage3_2.md`](../working/task_m100_39_stage3_2.md) — 승인
  Chrome frame asset으로 시제품과 perimeter raster 일치
- Stage 3.3: [`task_m100_39_stage3_3.md`](../working/task_m100_39_stage3_3.md) — X·Reddit
  수동 GIF 첨부 안내 복원
- Stage 3.4: [`task_m100_39_stage3_4.md`](../working/task_m100_39_stage3_4.md) — compact
  viewport scrim과 안내 layout 교정
- Stage 3.5: [`task_m100_39_stage3_5.md`](../working/task_m100_39_stage3_5.md) — narrow
  GIF action 중앙 정렬과 secondary 밀도 교정
- Stage 4: [`task_m100_39_stage4.md`](../working/task_m100_39_stage4.md) — 공식 문서,
  대표 GIF 4종 시각 QA와 전체 통합 검증
- Stage 4.1: [`task_m100_39_stage4_1.md`](../working/task_m100_39_stage4_1.md) — 최신
  `devel` 통합, revision 차단 크래시와 진행률·disclosure 접근성 보정

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 X·Reddit 계정 업로드·게시는 외부 mutation이므로 수행하지 않았다. 저장된 GIF의
  실제 첨부와 게시 결과는 작업지시자 수동 확인 범위다.
- X·Reddit 정책과 Reddit community별 media 허용 설정은 서비스 측에서 변경될 수 있다.
- avatar 색상 복잡도와 desktop 성능에 따라 용량·생성 시간이 달라질 수 있다. 제품은
  10MB source, 15MB output, 60초 timeout을 보수적 안전 경계로 유지하며 초과 시 품질을
  자동 하향하지 않고 오류로 종료한다. 현재 리뷰 실측과 전체 회귀에서 timeout에
  근접한다는 증거는 없었다.
- module Worker·OffscreenCanvas 등 capability가 없는 desktop browser에서는 GIF를
  지원하지 않고 기존 PNG 흐름을 유지한다.

### 후속 작업 후보

- 릴리스 후 실제 X·Reddit 첨부 결과와 플랫폼 정책 변화를 별도 운영 확인한다.
- field에서 실제 timeout이나 생성 성능 문제가 수집될 때만 계측·최적화를 별도 이슈로
  검토한다.
- 리뷰의 비차단 제안인 media-query hook 공용화, dead renderer 제거, binary sub-block
  skip 최적화는 차단 수정과 분리해 필요성과 영향 범위를 별도로 평가할 수 있다.
- mobile GIF, 자동 첨부·업로드, public GIF URL, GIF clipboard/Web Share는 이번 범위에
  포함하지 않았으며 필요성이 확인될 때 독립 이슈로 평가한다.

## 작업지시자 승인 요청

- 작업지시자가 2026-08-28 Stage 4.1 리뷰 보정과 PR 갱신을 승인했다. 이 보고서와
  오늘할일을 merge 단계 커밋하고 `publish/task39`의 기존 PR #143을 갱신한 뒤
  리뷰·merge 승인 요청을 전달한다.
