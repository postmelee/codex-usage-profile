# Task M100 #35 최종 보고서

GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
마일스톤: M100

## 작업 요약

- 대상 이슈: #35
- 마일스톤: M100
- 단계 수: 5개 Stage와 Stage 5.1 UI 확인 보정
- 작업 목적: 공유 card는 정적 표현으로 유지하면서 owner/public Profile에 실제 Account
  Usage Contract v1 집계를 사용하는 일별·주간·누적 52주 token activity heatmap을 제공

최초 Stage 1·2의 card overlay 구현은 작업지시자가 승인한 계획 변경에 따라 Stage 3에서
제품 코드로부터 제거했다. 해당 보고서와 커밋은 의사결정 이력으로 보존하며 최종 제품은
Profile 전용 상세 탐색, Home과 동일한 owner card preview, 기존 공개·Share 흐름으로
구성한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/AccountUsageProfile.jsx` | owner/public 공용 identity, 5개 summary stat, token activity 구성 | Profile 정보 구조 |
| `src/profile-ui/TokenActivityChart.jsx` | 52주 일별·주간·누적 mode, hover·focus·touch, exact token 설정 | Profile heatmap 상호작용·접근성 |
| `src/profile-ui/heatmap.js` | UTC 52주 builder, mode별 합계·강도·semantic target, locale tooltip | Profile 집계 표시 계약 |
| `src/profile-ui/CardProfilePage.jsx` | owner Profile과 Home 공용 card preview·Share Studio 통합 | owner Profile·공개 설정 |
| `src/profile-ui/PublicProfilePage.jsx` | 공개 payload 기반 identity·stats·heatmap·card 구성 | public Profile |
| `src/profile-ui/publicProfileRoutes.js` | 공개 Account Usage payload 검증과 unavailable fail-close | 공개 route client guard |
| `src/profile-ui/ProfileHeader.jsx`, `src/profile-ui/formatters.js` | 중앙 정렬 identity와 summary formatter 지원 | owner/public 공용 UI |
| `src/styles.css` | responsive heatmap, tooltip, Profile layout, Home card parity | desktop·mobile·reduced motion UI |
| `src/profile-ui/__tests__/*.test.js`, `tests/profile-ui.spec.js` | builder, 공개 guard, interaction, privacy, card/share 회귀 | 단위·통합·browser 검증 |
| `mydocs/plans/task_m100_35*.md` | 원안, 계획 변경, 최종 구현 범위와 승인 기록 | 작업 설계 기록 |
| `mydocs/working/task_m100_35_stage*.md` | Stage 1~5 및 Stage 5.1 산출물·검증 기록 | 단계별 작업 증적 |
| `mydocs/orders/20260802.md` | Task #35 진행·완료 상태 기록 | 오늘할일 보드 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_35.md`, `task_m100_35_impl.md` | OK | 수행계획서의 문서 위치 판단과 일치 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_35_stage1.md`~`stage5.md` | OK | 각 승인 단계의 구현·검증 기록 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_35_report.md` | OK | 장기 보관용 최종 수용 기준 기록 |
| 공식 제품 문서 | 변경하지 않음 | 해당 없음 | OK | route, API, CLI와 사용자 설정 절차가 바뀌지 않음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| Profile token activity 기간 | 상세 heatmap 없음 | 최근 52주 |
| 일별 visual cell | 0개 | 52주 × 7일, 364개 |
| 주간·누적 semantic target | 0개 | mode별 52개, 주당 1개 |
| heatmap 보기 | 없음 | 일별·주간·누적 3개 |
| exact raw token 노출 | 해당 없음 | 기본 OFF, 사용자 checkbox 선택 시만 표시 |
| 전체 Node 테스트 | 기능 추가 전 기준 없음 | 540건 중 534건 통과, 환경 의존 6건 skip, 실패 0건 |
| 전체 Playwright E2E | 기능 추가 전 기준 없음 | 46건 통과 |
| Vite build | 해당 기능 없음 | 1,816 modules transformed, 성공 |
| 최종 branch diff | 0 | 20개 파일, 2,158 insertions, 340 deletions(최종 보고서 전 기준) |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| Home, owner/public card image와 README card에는 tooltip target이 없음 | OK — 계획 변경 전 overlay 코드를 Stage 3에서 제거하고 card 제한 경로 회귀 확인 |
| owner/public Profile이 실제 사용자의 daily bucket으로 52주 heatmap 생성 | OK — 공용 component와 owner/public browser 회귀 통과 |
| 일별·주간·누적 기간과 합계가 정확함 | OK — UTC·연도·윤년·미래 날짜·빈 날짜 단위 테스트 통과 |
| 주간·누적은 한 주당 하나의 semantic target 제공 | OK — mode별 52 target 계약 검증 |
| tooltip은 compact 값을 기본 제공하고 설정 시 exact token 제공 | OK — 기본 OFF, formatter·ARIA·상태 전환 회귀 통과 |
| hover, keyboard focus와 touch tap에서 같은 정보 제공 | OK — desktop·keyboard·mobile Playwright 검증 통과 |
| 좁은 화면은 최근 기간 우선이며 page horizontal overflow가 없음 | OK — chart-only scroll과 mobile viewport 회귀 통과 |
| owner visibility/share와 public card URL 동작에 회귀 없음 | OK — Home 공용 preview와 Share Studio·publish/private 회귀 통과 |
| no-usage·손상 payload에서 demo/다른 사용자 데이터가 노출되지 않음 | OK — owner/public empty·fail-close 검증 통과 |
| API, D1/R2, CLI, card renderer와 Sites hosting manifest 비변경 | OK — 제한 경로 diff가 빈 출력이고 Sites artifact verifier 통과 |

### 단계별 검증 결과

- Stage 1: [`task_m100_35_stage1.md`](../working/task_m100_35_stage1.md) — 최초 card
  geometry·tooltip 계약을 구현했으나 최종 방향에서 대체됨
- Stage 2: [`task_m100_35_stage2.md`](../working/task_m100_35_stage2.md) — 최초 card
  overlay 통합을 완료했으나 최종 방향에서 대체됨
- Stage 3: [`task_m100_35_stage3.md`](../working/task_m100_35_stage3.md) — card overlay
  제거, canonical daily bucket 기반 52주 pure data contract 검증
- Stage 4: [`task_m100_35_stage4.md`](../working/task_m100_35_stage4.md) — owner/public
  Profile 공용 heatmap, privacy·responsive interaction 통합 검증
- Stage 5: [`task_m100_35_stage5.md`](../working/task_m100_35_stage5.md) — exact token
  opt-in, Home card parity, Share Studio와 전체 unit·E2E·Sites artifact 검증
- Stage 5.1: Stage 5 보고서 부록 — owner/public Profile identity 중앙 정렬과 대표 E2E
  2건 재검증

최종 통합 검증 명령은 다음과 같다.

```bash
npm test
npm run test:e2e
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git diff origin/devel -- .openai/hosting.json src/profile-backend src/profile-runtime/sites packages package.json package-lock.json public/assets
```

## 잔여 위험과 후속 작업

### 잔여 위험

- `TEST_DATABASE_URL`, `TEST_S3_*`가 없는 로컬 환경이어서 PostgreSQL·S3 외부 endpoint
  검증 6건은 기존 정책대로 skip됐다. 이번 작업은 해당 backend·storage 경로를 수정하지
  않았으며 나머지 534개 Node 테스트와 46개 browser 테스트는 모두 통과했다.
- local build와 Sites artifact까지만 검증했다. production 배포, 원격 data,
  environment/access/secret mutation은 수행하지 않았다.
- 현재 UI의 고정 영어 문자열과 locale 기반 날짜·tooltip 사이에 언어가 섞일 수 있고,
  site 전체는 dark palette 중심이다. 이는 본 이슈의 Profile heatmap 범위를 넘으므로
  별도 후속 이슈로 추적한다.

### 후속 작업 후보

- 브라우저 locale을 자동 인식하는 전역 영어·한국어 message/formatter 정합성
- Codex의 appearance 개념을 참고한 `system | light | dark` semantic theme token과 전환

## 작업지시자 승인 기록

- 2026-08-02 작업지시자가 Stage 5.1까지의 결과를 확인하고 Task #35 최종 보고서 작성과
  `publish/task35` PR 게시를 승인했다.
- 같은 승인에서 위 두 후속 작업의 GitHub Issue 등록도 승인했다.
