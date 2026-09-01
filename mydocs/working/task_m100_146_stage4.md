# Task #146 Stage 4 보고서 — GIF golden 로더 경계와 리뷰 회귀 보완

GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
구현계획서: [`task_m100_146_impl.md`](../plans/task_m100_146_impl.md)
Stage: 4

## 단계 목적

[PR #147 리뷰](https://github.com/postmelee/codex-usage-profile/pull/147#issuecomment-5468155556)의 지적을 실제 코드·재현 결과와 대조해 보완한다. 작업지시자가 2026-08-31 “PR 갱신까지 진행해줘”라고 승인한 범위로 진행했으며, Stage 2에서 승인된 카드 크기·움직임·색상 결과는 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/gif-beam-frames.js` | 헤더 대신 실제 gzip body 3MB·해제 데이터 25MB 제한, 초과 즉시 stream 취소·reader 해제 |
| `src/profile-card/gif-animation.js` | 공통 테마 정규화, procedural 경로가 테스트/근사이며 승인된 live 대비를 보장하지 않음을 명시 |
| `src/profile-card/__tests__/gif-beam-frames.test.js` | 양쪽 에셋 헤더 누락·부정확한 길이, 3MB 경계, 압축·해제 초과, 취소 실패·lock 해제, 잘못된 gzip 회귀 |
| `src/profile-card/__tests__/gif-animation.test.js` | 대소문자·공백·잘못된 테마 preset 정규화 회귀 |
| `src/profile-ui/__tests__/gifExport.test.js` | 양쪽 golden 로드 실패 시 encoder·progress·complete를 호출하지 않는 회귀 |
| `mydocs/plans/task_m100_146_impl.md` | 검증 명령의 실제 renderer 파일명 정정 |

리뷰 기준 HEAD `bcc8d3c62b41cbfb47b9091d3c642fe661dc1b1c` 이후 제품·테스트 보완은 5개 파일 `+206/-16`이다. golden binary·live preset 수치·CSS·카드 renderer는 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

- 기존 단계 보고와 시각 승인 근거는 보존했다. 공식 제품 문서는 변경하지 않고 수행계획서에서 승인된 내부 작업 문서 위치를 유지한다.
- 리뷰 1: gzip 재압축 level 0/1/6/9 실측 최대 2,981,261 bytes로 3MB 초과 가설은 재현되지 않았다. 대신 헤더 누락 시 `Number(null) === 0`으로 dark/light 모두 정상 에셋이 거부되는 기존 문제가 재현됐다. 상한을 늘리지 않고 실제 body를 읽으며 제한하도록 수정했다.
- HTTP `Content-Length`는 Fetch가 HTTP content coding을 해제한 body와 다른 크기를 나타낼 수 있다. 헤더를 신뢰해 상한을 결정하지 않는 근거는 [Fetch 표준](https://fetch.spec.whatwg.org/#http-network-fetch)을 따른다. 실제 에셋 gzip 해제는 별도 단계로 유지한다.
- 리뷰 2: procedural 대비값을 바꾸면 승인되지 않은 두 번째 효과 변경이 되므로 근사 경로임을 주석으로 명시했다. production은 golden 로드 실패 시 기존 typed error로 종료하고 procedural encode를 호출하지 않음을 dark/light 모두 검증했다.
- 리뷰 3: `getProfileCardBorderBeamPreset`도 `normalizeCardTheme`을 사용하게 했다. 기존 정규화된 호출부 결과는 동일하다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/themeSurfaceContract.test.js
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
git diff --quiet bcc8d3c62b41cbfb47b9091d3c642fe661dc1b1c -- src/profile-card/assets src/profile-marketing/MarketingLanding.jsx src/profile-card/social-canvas.js src/profile-card/renderer.js src/profile-card/worker-renderer.js
shasum -a 256 src/profile-card/assets/ocean-beam-golden-v1.rgba-runs.bin src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin
git diff --check
```

결과:

- OK — 수정 전 새 회귀 8개 중 7개가 실패해 헤더·정규화 문제와 경계 검사 누락을 확인했다. 기존 Worker fail-closed 회귀 1개는 수정 전에도 통과했다.
- OK — 수정 후 집중 Node 44/44 통과, 16.3초.
- OK — 전체 `npm test`: 929개 중 923 pass, 6 조건부 skip, fail·cancel·todo 0, 24.6초.
- OK — 전체 Playwright 110/110 통과, 1.8분. 양쪽 테마 geometry·대비, 실제 GIF 생성·다운로드, 실패·재시도·취소, handoff·reduced-motion 포함.
- 초기 E2E는 다른 검증/빌드와 겹친 실행에서 Vite optimized dependency URL이 504 `Outdated Optimize Dep`를 반환했다. trace에서 `hover-tilt_web-component.js`와 `gifenc.js`의 504를 확인하고 4 failed·1 interrupted·67 passed·38 미실행 상태로 중단했다. 제품 코드를 바꾸지 않고 새 서버에서 단독으로 전체 재실행한 결과가 위 110/110이다. 후속 검증에서는 E2E 실행 중 같은 checkout의 빌드·dependency cache 갱신을 겹치지 않는다.
- OK — production build: server 63 modules, client 1,839 modules. artifact verifier `ok: true`, 10,901,144 bytes, client 15 files, worker 2 files, migration 6개, binding 3개.
- OK — artifact는 리뷰 전 10,900,957 bytes보다 187 bytes 증가했다. 저장소 12,000,000-byte 예산 잔여량은 1,098,856 bytes(9.16%)다.
- OK — 양쪽 golden, live 호출부와 카드 native/Worker/social renderer 대조 exit 0. dark SHA `aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680`, light SHA `1a1368c9b9c36e234fea3da7305da62565594c824c2261e9feb1aab988b76d1c` 유지.
- OK — `git diff --check` 경고 없음. `1497×918 / 499:306`, GIF `998×612 / 96프레임 / 20fps / 4.8초`, live opacity scale·preset version 2는 변경하지 않았다.

## 잔여 위험

- 원격 Stage5·production HTTP 전송과 실제 GIF 저장 검증은 미수행이며 #144에서 새 exact-main 후보로 수행해야 한다. 로컬 헤더 변형 회귀는 주입 Response 기반이므로 원격 CDN 검증을 대체하지 않는다.
- light asset은 3MB 상한까지 19,279 bytes만 남아 있다. 향후 재생성 시 size·SHA 회귀와 전체 artifact 예산을 다시 확인해야 한다.
- GitHub의 Node 20/22/24 체크는 CLI package 범위다. 이번 웹·GIF·Playwright·production 검증은 로컬 실행 근거이며 PR에 구분한다.
- golden 재생성 스크립트는 아직 없다. 기존 절차와 수치는 보존하고 별도 이슈 후보로 인계한다.

## 다음 단계 영향

- `task-final-report`로 최종 결과와 오늘할일 완료를 갱신하고, 기존 `publish/task146`에 fast-forward push해 PR #147 본문과 리뷰 대응을 갱신한다.
- merge·이슈 close·원격 배포는 하지 않는다. #144는 #146 merge 이후 새 exact-main으로 HTTP 상태·헤더·실제 golden body와 양쪽 GIF 생성을 확인한다.

## 승인 요청

- 2026-08-31 작업지시자의 “PR 갱신까지 진행해줘” 지시에 따라 본 단계와 최종 보고·PR 갱신까지 진행한다. merge와 #144 배포 재개는 별도 승인이 필요하다.
