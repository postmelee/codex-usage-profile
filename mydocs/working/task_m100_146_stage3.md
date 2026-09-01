# Task #146 Stage 3 보고서 — 전체 회귀 검증과 릴리스 인계 확정

GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
구현계획서: [`task_m100_146_impl.md`](../plans/task_m100_146_impl.md)
Stage: 3

## 단계 목적

Stage 1·2에서 구현하고 작업지시자가 승인한 라이트 카드 Border Beam 보정을 저장소 전체 범위에서 재검증한다. 라이트·다크 동일 `md` 모션, 라이트 전용 색상·대비, 카드 geometry와 GIF 출력 계약이 다른 제품·백엔드·릴리스 경로를 깨뜨리지 않는지 확인한다.

Task #146 브랜치에서는 원격 Stage5와 production을 변경하지 않는다. #146 병합 뒤 보류 중인 Task #144가 새 `devel` 병합 커밋을 exact-main 후보로 다시 고정하고 main 승격, Stage5 재배포·스모크와 production 배포를 이어가도록 인계 경계를 확정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_146_stage3.md` | 전체 단위·E2E·production artifact 검증, 최종 범위 점검과 Task #144 인계 기록 |
| `mydocs/orders/20260830.md` | Stage 2 승인과 Stage 3 완료·최종 보고/PR 승인 대기 상태 반영 |

Stage 3 검증에서는 제품 코드·테스트를 추가 수정하지 않았다. Stage 3 보고서를 포함한 Task #146 전체 변경은 기준 커밋 `aaf997720f296265c8b306840f0eb8af67b08dfb` 대비 18개 파일, `+1,039/-26`이며 light golden binary 한 개를 포함한다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. Stage 3은 검증과 인계 문서만 추가하며 승인된 제품 동작을 변경하지 않는다.

- 기존 dark golden SHA-256 `aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680`과 bytes를 유지했다.
- 카드 PNG/SVG·소셜 렌더러인 `renderer.js`, `worker-renderer.js`, `social-canvas.js`는 기준 커밋 대비 변경되지 않았다.
- 라이트·다크의 `1497×918` 원본, `499:306` 표시 비율과 GIF `998×612 / 20fps / 96프레임 / 4.8초` 계약을 유지했다.
- 원격 Stage5·production Site, D1/R2, access/environment와 npm에는 쓰기 작업을 수행하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
git diff --name-status aaf997720f296265c8b306840f0eb8af67b08dfb...HEAD
shasum -a 256 src/profile-card/assets/ocean-beam-golden-v1.rgba-runs.bin src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin
git diff --quiet aaf997720f296265c8b306840f0eb8af67b08dfb...HEAD -- src/profile-card/assets/ocean-beam-golden-v1.rgba-runs.bin src/profile-card/renderer.js src/profile-card/worker-renderer.js src/profile-card/social-canvas.js
git diff --check
git status --short
```

결과:

- OK — `npm test`: 921개 중 915 pass, 6개 조건부 skip, fail·cancel·todo 0, 18.9초.
- OK — 첫 샌드박스 실행은 Miniflare가 임의 로컬 포트를 열 수 없어 `ready` 대기에서 중단했다. 동일 명령을 로컬 포트가 허용된 권한 확장 환경에서 처음부터 재실행해 위 유효 결과를 얻었다. 제품·테스트 실패로 집계하지 않았다.
- OK — `npm run test:e2e`: 전체 Playwright 110/110 통과, 2.0분. Task #146 동일 `md` 모션·geometry, Share Studio 실제 GIF 생성, handoff와 reduced-motion 회귀를 포함한다.
- OK — `npm run build:production`: server 63 modules, client 1,839 modules 통과. 기존 dark asset 2,450.74KB와 light asset 2,980.72KB가 Worker lazy 경로에 포함됐다.
- OK — `npm run verify:sites-production`: `ok: true`, artifact 10,900,957 bytes, client 15 files, worker 2 files, migration 6개, binding 3개.
- OK — 기준 커밋부터의 변경 파일은 Task #146 계획·보고, 카드 theme별 Beam/GIF 전달·asset·회귀 테스트 범위로 한정됐다.
- OK — dark golden·카드 native/Worker/social geometry 파일을 대상으로 한 `git diff --quiet` exit 0. dark golden SHA는 승인값을 유지했고 light golden SHA는 `1a1368c9b9c36e234fea3da7305da62565594c824c2261e9feb1aab988b76d1c`다.
- OK — `git diff --check` 경고 없음.
- OK — 검증 시작 시 작업 트리는 오늘할일 Stage 3 상태 변경 한 건 외에는 깨끗했다. 단계 보고서와 오늘할일을 묶어 커밋한 뒤 최종 clean 상태를 다시 확인한다.

## 잔여 위험

- 라이트 golden은 compressed 3,000,000 bytes 상한에 근접한다. SHA·compressed/decompressed 상한과 모든 frame effect count가 자동 회귀로 고정돼 있다.
- Task #146은 원격 배포를 수행하지 않았으므로 실제 Stage5·production 수용성은 아직 검증되지 않았다. 이는 Task #144에서 새 exact-main 후보를 고정한 뒤 수행해야 한다.
- #144가 이전 exact-main 후보를 재사용하면 Task #146 변경이 누락된다. #146 PR merge를 확인한 새 `devel` HEAD만 후속 후보로 사용할 수 있다.

## 다음 단계 영향

- 작업지시자가 Stage 3을 승인하면 `task-final-report` 절차로 최종 결과보고서, 오늘할일 완료 처리, 최종 커밋과 `publish/task146` PR을 준비한다.
- #146 PR merge 후 `pr-merge-cleanup`으로 이슈·브랜치·worktree를 정리한다.
- 그 다음 Task #144를 재개해 새 exact-main 후보 고정 → main 승격 → Stage5 재배포·원격 스모크 → production 배포 순서를 수행한다.
- Task #146 브랜치에서 Task #144의 원격 배포 작업을 선행하지 않는다.

## 승인 요청

- Stage 3 전체 회귀 검증과 Task #144 릴리스 인계 결과를 승인하면 최종 결과보고서 및 PR 단계로 진행한다.
