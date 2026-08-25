# Task #130 최종 보고서 — 미제출 계정 Home을 운영자 카드로 표시

GitHub Issue: [#130](https://github.com/postmelee/codex-usage-profile/issues/130)
마일스톤: M100

## 작업 요약

- 대상 이슈: #130
- 마일스톤: M100
- 단계 수: 3
- 작업 목적: 사용량을 제출하지 않은 GitHub 계정의 Home에서 현재 계정 identity가 합성된 sample
  통계 대신 locale-aware 운영자 stable card를 표시한다.

authenticated profile이 ready이고 usage가 없는 상태를 명시적인 operator target으로 분리했다.
operator image가 실패해 static sample로 fallback해도 현재 계정 identity를 합성하지 않으며,
submitted owner preview 실패의 기존 personalized sample과 anonymous/loading/logout 계약은 보존했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/homeCardTarget.js` | authenticated ready no-usage를 operator target으로 선택 | Home card target resolver |
| `src/profile-ui/__tests__/homeCardTarget.test.js` | no-usage operator와 error sample outcome 단위 계약 분리 | resolver 회귀 검증 |
| `src/profile-ui/HomePage.jsx` | personalized sample identity에 `hasUsage === true` gate 추가 | Home sample fallback overlay |
| `tests/profile-ui.spec.js` | 정상 operator, 404/503 fallback, owner preview 무요청과 action E2E 보강 | Home 사용자 상태 회귀 |
| `mydocs/plans/task_m100_130*.md` | 수행·구현 계획과 3개 Stage 경계 기록 | 내부 작업 계획 |
| `mydocs/working/task_m100_130_stage{1..3}.md` | 단계별 변경·검증·승인 경계 기록 | 내부 단계 보고 |
| `mydocs/orders/20260824.md`, `mydocs/orders/20260825.md` | Task 진행·완료 상태 기록 | 내부 오늘할일 보드 |
| `mydocs/report/task_m100_130_report.md` | 수용 기준과 전체 검증 결과 보관 | 내부 최종 보고 |

backend/API, card renderer, operator handle/endpoint, static sample asset, public docs,
`.openai/hosting.json`과 production 배포에는 영향이 없다.

## 문서 위치 검증

제품/사용자/기여자/외부 통합/API/아키텍처/로드맵 계약은 변경하지 않았다. 수행계획서의 문서 위치
판단대로 작업 계획과 검증 이력만 Hyper-Waterfall 내부 경로에 작성했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_130*.md` | OK | 승인된 계획 문서 위치와 일치 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_130_stage{1..3}.md` | OK | 각 Stage commit에 포함 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_130_report.md` | OK | 장기 보관용 최종 결과 문서 |
| README·공식 제품 문서 | 변경 없음 | 해당 없음 | OK | 명령·URL·API와 공개 사용법 변경 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| authenticated ready no-usage target | static sample | locale-aware operator stable card |
| no-usage personalized identity overlay | 표시 | 미표시 |
| no-usage owner preview 요청 | 0회 | 0회 유지·E2E 명시 검증 |
| operator failure 전용 authenticated E2E | 없음 | 2개(404, 503) |
| 제품·테스트 source diff | 기준 | 4개 파일, +118/-26 lines |
| 전체 Node test | 기준 suite | 869개 중 863 pass, 6 conditional skip, 0 fail |
| 전체 Playwright E2E | 기준 suite | 103 pass, 0 fail |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| authenticated ready no-usage Home은 locale-aware operator card를 표시 | OK — source kind `operator`, URL `/u/postmelee/card.png?locale=en`, decoded blob 확인 |
| no-usage card media에는 current owner identity overlay가 없음 | OK — `.home-card-sample-identity`와 owner avatar가 card media에 없음 |
| no-usage owner preview endpoint 무요청 | OK — `/api/profile/card.png` request count 0 |
| operator 404/503는 static sample로 fail closed하고 identity를 합성하지 않음 | OK — `sample`/`fallback`, decoded asset, overlay 부재 확인 |
| no-usage action은 submit-first disabled이고 Publish·Share 미노출 | OK — 정상·404·503 E2E 모두 통과 |
| submitted owner preview 실패 personalized sample 유지 | OK — owner 404/503·decode failure positive 회귀 통과 |
| anonymous, auth/profile Skeleton과 logout reset 유지 | OK — 집중 및 전체 Playwright 회귀 통과 |
| production Sites artifact와 제외 경로 무변경 | OK — build/verifier 통과, manifest·asset·backend·renderer·공식 docs task diff 없음 |
| PR 준비 품질 | OK — `git diff --check` 경고 없음, 최종 보고 전 working tree clean |

### 단계별 검증 결과

- Stage 1: [`task_m100_130_stage1.md`](../working/task_m100_130_stage1.md) — resolver·transition
  단위 테스트 16개 통과, no-usage operator 우선순위 확정.
- Stage 2: [`task_m100_130_stage2.md`](../working/task_m100_130_stage2.md) — 집중 Playwright
  8개 통과, 정상·404·503 미제출 경로와 submitted owner 회귀 확정.
- Stage 3: [`task_m100_130_stage3.md`](../working/task_m100_130_stage3.md) — Node 869개,
  Playwright 103개, production build 및 Sites full-stack/production verifier 통과.

최종 보고 직전 최신 `origin/devel`을 확인하고 동일한 전체 Node·Playwright·production
build·verifier와 제외 경로 검증을 다시 실행해 같은 결과를 확인했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- production deploy와 live Site mutation은 승인된 제외 범위이므로 실행하지 않았다.
- 제품 변경 및 로컬 production artifact 검증 범위의 잔여 실패는 없다.

### 후속 작업 후보

- 없음. Task #130 범위 밖 브라우저/OAuth 동작은 필요 시 별도 이슈로 진단한다.

## 작업지시자 승인 요청

- 최종 보고서와 Open PR의 수용 기준 결과를 검토한 뒤 merge 여부를 승인해 주세요.
