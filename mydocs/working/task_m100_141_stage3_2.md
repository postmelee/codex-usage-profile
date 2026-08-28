# Task #141 Stage 3.2 보고서 — PR 리뷰 radius 결합과 모서리 회귀 보강

GitHub Issue: [#141](https://github.com/postmelee/codex-usage-profile/issues/141)
구현계획서: [`task_m100_141_impl.md`](../plans/task_m100_141_impl.md)
Pull Request: [#142](https://github.com/postmelee/codex-usage-profile/pull/142)
리뷰 근거: [issuecomment-5450222547](https://github.com/postmelee/codex-usage-profile/pull/142#issuecomment-5450222547)
Stage: 3.2

## 단계 목적

PR 리뷰에서 확인된 card body radius와 social outline radius의 암묵적 결합을 구조적으로 닫는다.
native Canvas body, Worker SVG body와 social outline이 하나의 `SOCIAL_CARD_LOGICAL_RADIUS`를
소비하도록 하고, light outline이 동일 renderer의 dark card alpha geometry 밖으로 눈에 보이게
돌출하지 않는지 전체 픽셀 회귀로 고정한다. 기능과 출력 계약은 바꾸지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/renderer.js` | native card body의 radius 리터럴을 공유 상수로 교체 |
| `src/profile-card/worker-renderer.js` | Worker card body `rx` 리터럴을 같은 공유 상수로 교체 |
| `src/profile-card/__tests__/social-renderer.test.js` | native light shape의 dark alpha geometry 밖 visible overhang 전수 검사 추가, import 정렬 |
| `src/profile-card/__tests__/worker-renderer.test.js` | Worker의 동일 overhang 전수 검사 추가, import 정렬 |
| `src/profile-card/__tests__/social-canvas.test.js` | named import 정렬 |
| `mydocs/plans/task_m100_141_impl.md` | 승인된 post-review Stage 3.2 범위와 검증 기록 |
| `mydocs/report/task_m100_141_report.md` | Stage 3.2 결과와 light golden 후속 후보 반영 |
| `mydocs/orders/20260828.md` | Stage 3.2 완료 시각 반영 |

## 본문 변경 정도 / 본문 무손실 여부

사용자 문서와 공개 API 변경은 없다. radius 값은 계속 논리 `32`이고 renderer version, social canvas,
card bounds, palette, publication, route와 cache 계약도 그대로다. 기존 dark golden test가 통과해
native dark social bytes가 바뀌지 않았음을 함께 확인했다. 라이트 golden PNG는 새 public binary와
byte baseline 정책이 필요한 별도 개선이므로 이번 리뷰 보강 범위에서 추가하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
npm test -- --test-concurrency=1
npm run build:production
npm run verify:sites-fullstack
rg -n "SOCIAL_CARD_LOGICAL_RADIUS|roundRect\\(0, 0, CARD_LOGICAL_WIDTH, CARD_LOGICAL_HEIGHT, 32\\)|rx=\\\"32\\\"" src/profile-card
git diff --check
```

결과:

- OK — targeted renderer test 34개 통과, fail·skip 없음.
- OK — 전체 Node test 887개: pass 881, fail 0, skip 6, duration 약 22.9초.
- OK — production build: server 63 modules, client 1834 modules.
- OK — Sites full-stack verifier: `ok: true`, hosted mode, client files 12, Worker files 2,
  migrations 6, raw Worker bytes 4,035,209.
- OK — radius 값 `32`의 정의는 `social-canvas.js` 한 곳만 남고 native body, Worker body와
  outline 파생값이 모두 그 상수를 소비한다. 기존 body radius 리터럴 검색 결과는 없다.
- OK — 정상 출력에서 tolerance를 넘는 light shape의 dark alpha geometry 밖 픽셀은 native 0,
  Worker 0이다.
- OK — native transform/direct-path 차이로 dark alpha 0 영역에 RGB 채널 차이 최대 2인 15개
  subpixel fringe가 있어 tolerance를 2로 고정했다. 리뷰 재현처럼 outline radius만 논리 24로
  분리한 진단에서는 같은 기준으로 1,900픽셀이 검출되어 실제 불일치를 가리지 않는다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- 라이트 social에는 committed golden PNG가 없다. 현재 공유 상수화, native/Worker 실제 PNG의
  색상·bounds·corner overhang과 SVG 구조 회귀가 correctness를 보호하므로 merge 차단 위험은 아니다.
- golden 추가는 public binary와 byte baseline 유지 정책을 결정하는 별도 후속 task 후보로 남긴다.

## 다음 단계 영향

- 추가 구현 Stage는 없다. 이 commit을 `publish/task141`에 push하고 PR #142의 HEAD 고정 링크,
  변경 내역과 검증 결과를 Stage 3.2 기준으로 갱신한다.
- PR review에서 지적한 medium finding과 import nit은 해소되고, light golden low finding은 후속 후보로
  명시된다.

## 승인 요청

- Stage 3.2의 공통 radius 결합, corner overhang 회귀와 검증 결과를 승인하면 PR #142 merge 검토로
  진행한다.
