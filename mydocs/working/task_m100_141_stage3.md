# Task #141 Stage 3 보고서 — 소셜 썸네일 통합 회귀와 시각 QA

GitHub Issue: [#141](https://github.com/postmelee/codex-usage-profile/issues/141)
구현계획서: [`task_m100_141_impl.md`](../plans/task_m100_141_impl.md)
Stage: 3

## 단계 목적

Stage 1~2에서 확정한 light social surface/frame, dark 무회귀, renderer version과 publication
refresh를 실제 native/Worker 출력과 전체 저장소 검증으로 확인한다. 제품 source와 공식 문서를
추가 수정하지 않고 pixel 대조, 전체 Node test, production build, Sites verifier와 보호 경로 검사를
완료한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/orders/20260828.md` | Stage 3 완료와 최종 보고 승인 대기 상태 반영 |
| `/private/tmp/task141-stage3-visual-qa.L9gz6R/*.png` | native/Worker light·dark social/standalone 원본과 승인 시제품 비교 contact sheet |
| `/private/tmp/task141-stage3-visual-qa.L9gz6R/visual-qa-summary.json` | dimensions, bounds, alpha와 representative RGB 픽셀 검사 결과 |

저장소 제품 source, 테스트와 공식 문서는 Stage 3에서 변경하지 않았다. `/private/tmp` 검증 산출물은
단계 커밋에 포함하지 않는다.

## 본문 변경 정도 / 본문 무손실 여부

해당 없음. Stage 1~2 본문을 그대로 검증했다. QA용 임시 script는 실행 후 제거했으며 저장소에는
오늘할일과 본 단계 보고서만 남는다. build/test가 만든 `dist/`, `.wrangler/`, `node_modules/`는
ignore 대상 검증 환경 산출물이다.

## 검증 결과

### 실제 이미지 pixel·시각 대조

동일 fixture로 native/Worker 각각 light·dark social과 standalone card를 렌더링했다.

- OK — 네 social PNG 모두 `2400×1260`, layout은 `x=120`, `y≈20.6513026052`,
  `w=960`, `h≈588.6973947896`, ratio `499:306` 유지.
- OK — native/Worker light의 비배경 bounds와 dark의 alpha 128 이상 coverage bounds는 모두
  `x=240–2159`, `y=41–1218`, `1920×1178`이다.
- OK — light outer pixel은 `[243,245,247,255]` (`#F3F5F7`), straight-edge border는
  `[208,215,222,255]` (`#D0D7DE`), card 내부는 `[255,255,255,255]`이다.
- OK — native/Worker dark outer pixel은 `[0,0,0,0]`. native Canvas의 기존 rounded fill에는
  `x=239`에 alpha 128 미만의 한 픽셀 anti-alias fringe가 있으나 coverage 경계와 layout은 동일하다.
- OK — native/Worker light·dark standalone PNG 네 개 모두 `1497×918`, corner alpha 0,
  center alpha 255를 유지한다.
- OK — 승인 시제품, native light, Worker light contact sheet를 수동 확인해 canvas/card 비율,
  상하좌우 여백, radius와 border 표현이 일치함을 확인했다.

### 구현계획서 지정 명령

```bash
npm test -- --test-concurrency=1
npm run build:production
npm run verify:sites-fullstack
git diff --exit-code origin/devel...HEAD -- src/profile-card/theme.js src/profile-runtime/open-graph.js src/profile-media/media-store-contract.js .openai/hosting.json
git diff --check
git status --short
```

결과:

- OK — 전체 Node test 883개: pass 877, fail 0, skip 6, duration 약 22.4초.
- OK — sandbox loopback 제한에서 최초 전체 test가 D1 concurrency에서 정체됐으나, Miniflare
  local loopback이 허용된 검증 환경에서 해당 test 7개와 전체 명령을 재실행해 정상 종료했다.
- OK — production full-stack build: server 63 modules, client 1834 modules, finalize manifest 제거 성공.
- OK — Sites full-stack verifier: `ok: true`, hosted mode, client files 12, Worker files 2,
  migrations 6, raw Worker bytes 4,035,209.
- OK — worktree 외부 `node_modules` symlink가 최초 build 주석에 로컬 실경로를 남겨 verifier가
  fail-closed했으며, worktree 내부 ignore 대상 실제 dependency directory로 검증 환경을 교정한 뒤
  rebuild/verifier가 통과했다. 제품 source 변경은 없었다.
- OK — `theme.js`, Open Graph document, media-store contract와 hosting config에 task diff 없음.
- OK — `git diff --check` 출력 없음. 임시 QA script 제거 후 Stage 3 산출 문서 외 untracked 없음.

## 잔여 위험

- 실제 X·Threads 등 외부 crawler의 배경 합성·cache 갱신은 플랫폼 통제 영역이며 이 단계에서
  원격 게시나 cache purge를 수행하지 않았다.
- production 배포는 승인 범위 밖이므로 수행하지 않았다. 현재 검증은 production artifact 생성과
  로컬 verifier까지다.

## 다음 단계 영향

- 모든 구현 Stage가 완료됐으므로 다음 승인을 받으면 `task-final-report` 절차로 최종 보고서,
  오늘할일 완료 시각, 최종 커밋, `publish/task141` push와 `devel` 대상 Open PR을 준비한다.
- final report에는 Stage 1 geometry/surface, Stage 2 version/publication/docs와 Stage 3 전체 회귀 결과를
  통합하고 배포·외부 cache 작업이 제외됐음을 명시한다.

## 승인 요청

- Stage 3 pixel QA, 전체 test/build/verifier와 보호 경로 검사 결과를 승인하면 최종 보고와 PR 게시
  단계로 진행한다.
