# Task #150 Stage 3 보고서 — Share Studio·문서·전체 회귀

GitHub Issue: [#150](https://github.com/postmelee/codex-usage-profile/issues/150)
구현계획서: [`task_m100_150_impl.md`](../plans/task_m100_150_impl.md)
Stage: 3

## 단계 목적

Stage 1·2에서 승인된 첨부용 PNG/GIF 계약을 바꾸지 않고 Share Studio의 다크·라이트·모바일 저장 흐름을 통합 검증한다. stable README PNG, 첨부용 PNG/GIF와 OG social image의 서로 다른 공개 계약을 공식 사용자 문서에 기록하고 전체 Node·Playwright·production artifact 회귀를 마감한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `tests/profile-ui.spec.js` | 라이트 PNG의 stable URL 분리·불투명 surface·outline과 모바일 PNG 실제 저장 검증을 추가 |
| `docs/readme-card.md` | stable `1497×918`, 첨부 `998×612`, social `2400×1260` 출력 계약과 opaque GIF palette를 문서화 |
| `mydocs/orders/20260902.md` | Task #150 진행 상태를 Stage 3 완료로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

`docs/readme-card.md`의 기존 게시, stable URL, revision share, 캐시, 개인정보와 실패 처리 내용은 보존했다. Stable URL 설명 바로 뒤에 네 출력의 목적·크기·outer pixel 차이를 한 표로 추가하고, 기존 GIF 표의 transparent 설명만 실제 opaque attachment 계약에 맞게 교체했다. Stage 3에서는 제품 source, stable renderer, social renderer, Beam golden asset과 출력 geometry를 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test
npm test -- --test-concurrency=1
node --test --test-concurrency=1 {Node 24 비-real-workerd 117개 test 파일}
node --test --test-concurrency=1 src/profile-runtime/__tests__/production-server.test.js src/profile-runtime/sites/__tests__/full-stack.test.js src/profile-ui/__tests__/lastUpdatedTime.test.js
npx --yes node@22 --test --test-concurrency=1 src/profile-backend/__tests__/d1-concurrency.test.js src/profile-backend/__tests__/d1-maintenance.test.js src/profile-backend/__tests__/d1-migrate.test.js src/profile-backend/__tests__/d1-rate-limiter.test.js src/profile-backend/__tests__/d1-store.test.js src/profile-runtime/sites/__tests__/maintenance.test.js
npm run test:e2e
npm run build:production
npm run verify:sites-production
node --test --test-concurrency=1 src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
git diff --quiet e5eb6c6 -- src/profile-card/assets/ocean-beam-golden-v1.rgba-runs.bin src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin src/profile-card/renderer.js src/profile-card/worker-renderer.js src/profile-card/social-canvas.js src/profile-card/social-renderer.js
git diff --check
```

결과:

- OK — Node 전체 회귀의 고유 test `937`개는 `931 pass`, 환경 조건 `6 skip`, assertion failure `0`건이다.
- OK — 기본 Node 24 runner는 저장소의 알려진 Issue #135와 동일하게 real-workerd `d1-concurrency.test.js` 진입에서 정지해 중단했다. Node 24 비-real-workerd 117개 파일은 샌드박스 권한만 필요한 7건을 제외해 `870 pass / 6 skip`이었고, 해당 3개 파일은 허용 환경에서 `13/13`, Node 22 real-workerd 6개 파일은 `54/54` 통과했다.
- OK — 전체 Playwright E2E `111/111` 통과. 다크·라이트 desktop PNG, 다크 GIF, mobile PNG 저장과 source 변경·close·retry·clipboard·README·social target 회귀를 포함한다.
- OK — production build 성공. server `63 modules`, client `1841 modules`와 GIF Worker·다크/라이트 golden asset을 생성했다.
- OK — production Sites verifier는 `10,908,575 bytes`, client `15 files`, Worker `2 files`, migration `6 files`, required binding `3`개를 확인했다.
- OK — stable `1497×918` card와 `2400×1260` social renderer 집중 검증 `34/34` 통과.
- OK — Task 시작 기준 `e5eb6c6` 대비 stable/social renderer와 다크·라이트 golden Beam 파일이 변경되지 않았다.
- OK — 최종 PNG/GIF 4종 모두 `998×612`, 전 픽셀·frame alpha min/max `255/255`다. GIF는 각각 `96` frames다.
- OK — 최종 파일 크기는 다크 PNG `109,360 bytes`, 라이트 PNG `106,604 bytes`, 다크 GIF `6,211,471 bytes`, 라이트 GIF `5,573,674 bytes`다.
- OK — 네 모서리는 다크 `rgba(24,24,24,255)`, 라이트 `rgba(243,245,247,255)`이고 라이트 상단 outline은 `rgba(208,215,222,255)`다.
- OK — `git diff --check` 경고 없음.

최종 검수 파일:

- `/private/tmp/task150-stage3/attachment-dark.png`
- `/private/tmp/task150-stage3/attachment-light.png`
- `/private/tmp/task150-stage3/attachment-dark.gif`
- `/private/tmp/task150-stage3/attachment-light.gif`

## 잔여 위험

- X가 업로드 후 적용하는 자체 재인코딩과 표시 border radius는 저장소에서 자동화할 수 없으므로 최종 실제 게시 검수는 작업지시자가 수행해야 한다.
- Node 24의 real-workerd 정지는 기존 Issue #135 범위이며 Task #150의 코드 변경과 무관하다. 지원 Node 22 분리 검증은 모두 통과했다.
- Stage 3 범위에는 production 배포가 포함되지 않는다.

## 다음 단계 영향

- 구현 Stage는 모두 완료됐다. 작업지시자 승인 후 `task-final-report` 절차로 최종 보고서, 오늘할일 완료, 최종 커밋, `publish/task150` push와 `devel` 대상 PR 생성을 진행한다.
- 최종 보고·PR 단계에서는 Stage 1~3 출력 계약을 변경하지 않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 최종 보고·PR 단계로 진행한다.
