# Task #141 Stage 3.1 보고서 — 다크·라이트 geometry 동일성 회귀 보강

GitHub Issue: [#141](https://github.com/postmelee/codex-usage-profile/issues/141)
구현계획서: [`task_m100_141_impl.md`](../plans/task_m100_141_impl.md)
Stage: 3.1

## 단계 목적

Stage 3 검토에서 제기된 다크·라이트 간 동일성 근거를 영구 회귀 테스트로 보강한다. 카드의
dimensions, transform, bounds, radius/alpha geometry와 내부 Worker SVG 구조는 동일하고, theme
palette 및 light social 전용 opaque canvas/outline만 의도적으로 다르다는 계약을 직접 비교한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/__tests__/renderer.test.js` | native standalone light/dark 전체 alpha channel geometry와 서로 다른 body color 검증 |
| `src/profile-card/__tests__/social-renderer.test.js` | native social bounds 직접 비교와 Worker palette/surface 제외 SVG 구조 완전 동일 비교 |
| `src/profile-card/__tests__/worker-renderer.test.js` | Worker social bounds 직접 비교와 standalone 전체 alpha channel geometry 검증 |
| `mydocs/orders/20260828.md` | Stage 3.1 완료와 최종 보고 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

test-only 보강이다. `renderer.js`, `social-canvas.js`, `worker-renderer.js`, `theme.js`, publication,
공식 문서와 media/route/hosting 계약은 수정하지 않았다. “색깔만 다르다”는 카드 본체에 적용하며,
social 외곽은 승인된 예외로 light가 `#F3F5F7` opaque canvas와 `#D0D7DE` outline을 사용하고 dark는
transparent canvas와 무테두리를 유지한다.

## 검증 결과

targeted 명령:

```bash
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
```

결과:

- OK — targeted test 34개 통과, 실패·skip 없음.
- OK — native standalone `1497×918` light/dark의 1,374,246개 전체 픽셀 alpha channel 차이 0.
- OK — Worker standalone `1497×918` light/dark의 1,374,246개 전체 픽셀 alpha channel 차이 0.
- OK — native/Worker social 모두 light 비배경 bounds와 dark alpha 128 이상 coverage bounds가
  `x=240–2159`, `y=41–1218`로 직접 동일 비교됐다.
- OK — Worker standalone SVG와 social card `<g>`에서 theme palette를 정규화하고 light-only
  surface를 제외한 문자열 구조가 완전히 동일하다. card/body 요소 순서, transform, 좌표, size와
  radius가 같음을 고정한다.
- OK — light/dark 대표 body RGB는 서로 달라 실제 theme palette 차이가 존재함도 함께 확인했다.

전체 회귀 명령:

```bash
npm test -- --test-concurrency=1
npm run build:production
npm run verify:sites-fullstack
git diff --check
```

결과:

- OK — 전체 Node test 887개: pass 881, fail 0, skip 6, duration 약 23.7초.
- OK — production full-stack build: server 63 modules, client 1834 modules.
- OK — Sites full-stack verifier: `ok: true`, hosted mode, client files 12, Worker files 2,
  migrations 6, raw Worker bytes 4,035,209.
- OK — `git diff --check` 출력 없음.
- OK — Stage 3.1 working diff는 위 테스트 3개와 단계 문서·오늘할일에만 한정된다.

## 잔여 위험

- 외부 SNS crawler의 실제 background 합성·cache 동작은 플랫폼 통제 영역이며 production 배포,
  실제 게시와 cache purge는 수행하지 않았다.
- rasterizer별 subpixel anti-alias fringe는 존재할 수 있으므로 card coverage는 alpha 128 이상으로
  비교한다. layout 좌표, coverage bounds와 standalone alpha geometry는 동일성 테스트로 고정됐다.

## 다음 단계 영향

- 모든 구현·보강 Stage가 완료됐다. 다음 승인을 받으면 `task-final-report` 절차로 Stage 1~3.1
  결과를 통합하고 오늘할일 완료 처리, 최종 커밋, `publish/task141` push와 `devel` 대상 PR을
  준비한다.
- 최종 보고에는 카드 본체의 테마 geometry 동일성과 social 외곽의 승인된 light-only 예외를
  구분해 기록한다.

## 승인 요청

- Stage 3.1의 light/dark geometry 동일성 회귀 보강과 전체 검증 결과를 승인하면 최종 보고와 PR
  게시 단계로 진행한다.
