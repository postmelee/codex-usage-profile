# Task #39 Stage 4 보고서 — 공식 문서와 통합 시각 QA

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 4

## 단계 목적

desktop web Share Studio의 Animated GIF 생성·저장 흐름과 지원 경계를 공식 사용자
문서에 반영했다. dark/light × en/ko 대표 카드를 실제 998×612 GIF로 생성해 고정 카드,
투명 배경, Ocean Border Beam, 용량과 seamless loop 계약을 최종 확인하고 전체 회귀 및
풀스택 산출물 검증을 수행했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/readme-card.md` | desktop GIF 생성·저장·X/Reddit 수동 첨부 절차, 고정 export 계약, 지원 경계와 문제 해결 추가 |
| `src/profile-card/__tests__/gif-beam-frames.test.js` | 승인된 Chrome beam asset의 95→0 seam, 고정 중심, 투명 네 모서리 회귀 검증 추가 |
| `vite.config.js` | Worker에서 처음 사용하는 `gifenc`를 dev server 시작 시 pre-bundle해 최초 GIF 생성 중 reload 방지 |
| `mydocs/working/task_m100_39_stage4.md` | Stage 4 범위, 검증, 잔여 위험과 종료 경계 기록 |
| `mydocs/orders/20260828.md` | Stage 4 완료와 최종 보고·PR 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

기존 `docs/readme-card.md`의 URL, cache, privacy, troubleshooting 설명은 유지했다. Social
preview 설명 뒤에 GIF 전용 절차와 export 계약을 새 절로 추가하고, 기존 troubleshooting
표에는 GIF 대기·X 제한·정적 표시·Reddit media 설정 항목만 추가했다.

문서는 desktop web에서 브라우저가 로컬로 GIF를 생성하고 사용자가 파일을 저장한 뒤 X나
Reddit composer에 직접 첨부한다는 현재 동작만 설명한다. mobile, 자동 업로드·첨부·게시,
public GIF URL, GIF clipboard/Web Share, README·공개 카드의 GIF 전환은 지원 범위에 포함하지
않았다. UI와 GIF export 계약은 변경하지 않았고, `vite.config.js`는 development 의존성
최적화 시점만 고정한다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
git diff --check
```

결과:

- OK — Node test 906개 중 900개 통과, 실패 없음, 환경 의존 PostgreSQL·S3 6개 skip.
- OK — Chromium E2E 108개 전부 통과. GIF 생성·preview·저장과 Share Studio desktop/mobile
  경계까지 포함했다.
- OK — production server 63 modules, client 1,838 modules build 통과. GIF Worker와
  2.45MB beam asset 분리를 유지했다.
- OK — Sites fullstack 산출물 14개 client file, 6개 migration, 2개 worker file 검증 통과.
- OK — local fullstack smoke 67 routes와 canonical update 2개 통과. public PNG 85,391 bytes.
- OK — dark/light × en/ko 대표 GIF 4개가 모두 998×612, 20fps, 4.8초, 96프레임,
  무한 루프, 256색 이하 global palette, transparent GIF 계약을 충족했다.
- OK — 대표 GIF 용량은 5,389,199–6,215,447 bytes로 web 15,000,000-byte 제한 이하다.
- OK — 네 대표 GIF 모두 중앙 798×412 영역의 96개 frame이 동일해 카드 본문이 고정되고
  perimeter effect만 움직인다.
- OK — 승인된 beam asset의 frame 95→0 RGBA delta는 67,198, frame 0→1은 67,081로
  seam/인접 ratio 1.001744이며, 중복 frame·급격한 loop jump와 opaque corner가 없다.
- OK — 0·24·48·72·95 frame contact sheet에서 dark/light와 en/ko의 가독성, tight transparent
  bounds, 순환하는 perimeter beam을 시각 확인했다.
- OK — `git diff --check` 출력 없음.

최초 전체 E2E에서는 Worker 전용 `gifenc`가 첫 사용 시 Vite dev optimization을 유발해
Reddit 안내 click 도중 페이지가 reload되면서 108개 중 1개가 timeout됐다. `gifenc`를 dev
server 시작 시 pre-bundle하도록 고정한 뒤 해당 단독 E2E와 전체 108개를 다시 실행해 모두
통과했다. Node 전체 검증도 sandbox loopback 제약으로 Miniflare 시작에서 대기한 실행을
중단하고 동일 명령을 local loopback 허용 환경에서 재실행해 통과했다.

## 잔여 위험

- 실제 X·Reddit 게시물 업로드는 외부 게시 동작이므로 수행하지 않았다. X·Reddit의 정책과
  각 Reddit community media 설정은 서비스 측에서 변경될 수 있다.
- X 공식 안내의 mobile GIF 제한은 5MB지만 이 기능은 desktop web 전용이며, 생성물은 X web
  15MB 제한을 기준으로 한다.
- avatar의 색상 복잡도에 따라 GIF 용량이 달라질 수 있으나 export는 15,000,000 bytes를
  초과하면 저장 성공으로 처리하지 않는 기존 계약을 유지한다.

## 다음 단계 영향

- 구현계획서의 Stage 1–4가 모두 완료됐다. 다음 작업은 최종 보고서 작성, 오늘할일 완료
  처리, publish branch push와 `devel` 대상 PR 생성이며 작업지시자의 별도 승인을 받아야 한다.
- PR 전에는 실제 deploy나 X·Reddit 게시를 수행하지 않는다.

## 승인 요청

- Stage 4 공식 문서·대표 GIF 시각 QA·전체 회귀 검증을 완료했다. 최종 보고와 PR 게시
  절차 진입은 작업지시자의 별도 승인을 기다린다.
