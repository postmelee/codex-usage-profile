# Task #83 Stage 4.7 완료 보고서 — PR 리뷰 차단 항목 보정

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4.7

## 단계 목적

PR #85 리뷰에서 확인한 병합 차단 항목 두 묶음을 최소 범위로 보정한다. 동일한
`displaySrc`를 가진 새 card image lease가 A→null→A 전환에서 cleanup되지 않는 누수를
막고 실제 React hook lifecycle 회귀로 고정한다. hosted D1 migration 3~5의 수동 column
specification은 실제 migration SQL과 함께 검증하고, apply failure stage code 허용 범위를
manifest에서 파생해 다음 migration 추가 시 진단이 generic code로 퇴행하지 않게 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/cardImageReadiness.js` | cleanup effect가 문자열 대신 visible lease identity를 추적하도록 변경 |
| `src/profile-ui/__tests__/fixtures/card-image-readiness.html`, `card-image-readiness-harness.jsx` | 실제 React hook을 A→null→A로 구동하고 cache clear·unmount disposal을 관찰하는 브라우저 fixture 추가 |
| `tests/profile-ui.spec.js` | 동일 source 재획득 뒤 object URL이 정확히 한 번 revoke되는 회귀 테스트 추가 |
| `src/profile-runtime/sites/maintenance.js` | bounded migration apply stage code를 `D1_MIGRATION_MANIFEST`에서 파생 |
| `src/profile-runtime/sites/__tests__/maintenance.test.js` | migration 3~5 실제 SQL fragment와 hosted reconciliation spec 정합, manifest 마지막 version 진단 code 검증 |
| `mydocs/plans/task_m100_83_impl.md` | Stage 4.7 포함·제외 범위, 문서 위치, 검증·병합 경계 기록 |
| `mydocs/orders/20260812.md` | Stage 4.7 진행·완료 상태 기록 |
| `mydocs/report/task_m100_83_report.md` | 최종 local candidate, 검증 수치와 #84 handoff 정정 |

새 공식 제품 문서는 만들거나 수정하지 않았다. #84의 canonical route·Gate C 수용 기준
보정은 Task #83 merge·cleanup 뒤 별도 승인된 task에서 수행하도록 유지했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 변경 단계이므로 문서 본문 무손실 여부는 해당하지 않는다. card fetch/decode/cache
정책, last-ready 표시, owner/public scope, HTTP cache와 D1 migration 실행·reconciliation
정책은 변경하지 않았다. cleanup effect의 lease identity와 migration 진단 allowlist 생성
방식만 바로잡고 실제 migration SQL을 기존 reconciliation 경로에 투입하는 테스트를 더했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-runtime/sites/__tests__/maintenance.test.js src/profile-ui/__tests__/cardImageReadiness.test.js
npx playwright test --grep "card readiness releases reacquired same-source leases"
node --test --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- 집중 Node 검증: maintenance와 card resource 23/23 통과
- 실제 React hook 회귀: 수정 전 동일 테스트가 `cleared: 1`, `revoked: []`로 실패해
  누수를 재현했고, lease identity 보정 뒤 1/1 통과하며 object URL을 정확히 한 번 회수
- 전체 Node 검증: 727개 중 721개 통과, 외부 Postgres/S3 조건 6개 skip, 실패 0
- 전체 Playwright E2E: 75/75 통과
- production build: server 60 modules, client 1,828 modules, consumed manifest 제거
- full-stack verifier: client 8, worker 2, migration 5, raw 3,998,544 bytes,
  gzip 2,165,754 bytes, `ok: true`
- production verifier: artifact 6,230,696 bytes, bindings 3, migration 5와 동일 Worker
  크기, `ok: true`
- `git diff --check`: 이상 없음

전체 Node suite의 Miniflare/D1와 Playwright/Vite는 localhost listen이 허용된 검증
환경에서 실행했다. 테스트용 Playwright Chromium revision만 로컬 cache에 설치했으며
저장소 dependency나 production artifact에는 추가하지 않았다.

## 잔여 위험

- avatar failure backoff/retry 의미, card cache sliding TTL, state updater 내부 side effect,
  decode timeout과 R2/social provider degradation 정책은 검토 결과 비차단 후속 범위다.
- owner-only saved version 23은 Stage 4.6 source를 유지한다. Stage 4.7 local candidate는
  Sites에 재배포하지 않았으므로 #84에서 merge된 exact `main` source로 owner-only 재검증해야 한다.
- public access와 X·Threads·카카오톡 최종 실측은 #84 Gate C 범위다.

## 다음 단계 영향

- 이 단계의 source·문서 commit을 기존 `publish/task83` PR #85에 push하고 CI를 확인한다.
- CI가 모두 통과하면 self-merge하지 않고 작업지시자가 직접 merge하도록 넘긴다.
- merge 뒤 `pr-merge-cleanup`으로 #83을 정리한 다음 #84의 실제 공유 경로와 Gate C
  수용 기준을 보정하고 릴리스 절차를 시작한다.

## 승인 요청

- 작업지시자가 Stage 4.7 보정과 CI 통과 뒤 직접 merge 경계를 승인했다. 산출물과 전체
  검증 결과를 최종 보고서에 반영해 기존 PR #85를 갱신한다.
