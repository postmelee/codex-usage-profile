# Task #95 최종 보고서 — 인증·화면 복귀 시 Home 카드 단일 reveal 보장

GitHub Issue: [#95](https://github.com/postmelee/codex-usage-profile/issues/95)
마일스톤: M100

## 작업 요약

- 대상 이슈: #95
- 마일스톤: M100 — v1.0 MVP
- 단계 수: 4
- 작업 목적: 인증 판정과 화면 복귀 중 Home 카드가 중간 target을 노출하지 않고 최종 카드만 한 번
  reveal하도록 target authority와 presentation readiness를 일치시킨다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/homeCardTarget.js` | auth/profile 입력을 unresolved 또는 최종 operator/owner/sample target으로 해석하는 순수 resolver 추가 | Home 카드 target 선택 |
| `src/profile-ui/homeCardTransition.js` | generation의 immutable target provenance와 current target readiness 판정 추가 | owner decode·fallback·stale completion |
| `src/profile-ui/HomePage.jsx` | render 시점 target 불일치와 auth 미확정 상태를 Skeleton으로 동기 차단 | Home 최초 진입·로그인 복귀·Profile 복귀·reload·logout |
| `src/profile-ui/__tests__/homeCardTarget.test.js` | target authority 입력·출력 계약 검증 | 순수 상태 모델 회귀 |
| `src/profile-ui/__tests__/homeCardTransition.test.js` | 원래 target provenance와 fallback readiness 회귀 보강 | transition 단위 회귀 |
| `tests/profile-ui.spec.js` | MutationObserver 기반 상태 이력, direct/복귀/cold-warm 경로와 stale resource E2E 보강 | Chromium·WebKit UI 회귀 |
| `mydocs/plans/task_m100_95*.md` | 비배포 구현·검증 계획과 merge 전 실제 모바일 Gate 기록 | 내부 작업 근거 |
| `mydocs/working/task_m100_95_stage{1..4}.md` | 단계별 재현·구현·회귀·통합 검증 결과 기록 | 내부 검증 추적 |
| `mydocs/orders/20260812.md` | 오늘할일 상태와 완료 시각 기록 | 내부 작업 보드 |

## 문서 위치 검증

제품·사용자·기여자·외부 통합·API·아키텍처·로드맵 문서는 변경하지 않았다. URL·API·사용자
동작 계약을 바꾸지 않는 내부 UI 상태 보정이므로 수행계획서가 선택한 `mydocs/plans`,
`mydocs/working`, `mydocs/report` 위치에만 작업 근거를 기록했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_95*.md` | OK | 계획서 문서 위치 표와 일치 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_95_stage{1..4}.md` | OK | 각 Stage 산출물과 일치 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_95_report.md` | OK | 중앙 최종 보고서 템플릿 적용 |
| 공개 문서 | 변경 없음 | 해당 없음 | OK | 공개 계약 변경 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| authenticated Home 상태 이력 | auth/profile 확정 전에 `ready(operator)`가 나타날 수 있음 | `loading → ready(owner 또는 owner fallback)` 단조 이력 |
| 최종 target provenance | fallback 전환 시 원래 target을 상태에서 증명할 수 없음 | generation마다 immutable `target` 보존 |
| Task #95 WebKit 복귀 시나리오 | 별도 회귀 없음 | direct·Profile 복귀·cold/warm 3/3 통과 |
| 전체 Playwright | Task #95 상태 이력 회귀 없음 | Chromium 82/82 통과 |
| 전체 Node | target authority 전용 테스트 없음 | 739건 중 733 통과, 실패 0, skip 6 |
| Sites local smoke | 변경 후 증거 없음 | 50 routes, cold 136.46ms, warm 66.08ms |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 로그인 후 Home 복귀에서 최종 owner 카드만 한 번 reveal | OK — 상태 이력이 `loading → ready(owner)`이고 intermediate operator ready 없음 |
| Profile 상단 브랜드를 통한 full navigation도 동일한 단조 reveal | OK — Chromium·WebKit 복귀 E2E 통과 |
| cold/warm reload에서 cache 유무와 무관하게 깜빡임 상태 후퇴 없음 | OK — 연속 reload 2회 상태 이력 assertion 통과 |
| logout 뒤 stale owner resource가 재등장하지 않음 | OK — stale generation/source/identity 회귀 통과 |
| anonymous·no usage·owner image 실패 fallback 의미 보존 | OK — target resolver·transition Node와 기존 E2E 통과 |
| production Sites 산출물과 route 계약 유지 | OK — build, artifact verifier, 50-route local smoke 통과 |
| 실제 배포 없이 PR·로컬 확인 handoff | OK — 배포 명령 미실행, Stage 4에 실제 기기 merge Gate 기록 |

### 단계별 검증 결과

- Stage 1: [`task_m100_95_stage1.md`](../working/task_m100_95_stage1.md) — intermediate ready 이력을 재현하고 target 계약을 expected failure로 고정했다.
- Stage 2: [`task_m100_95_stage2.md`](../working/task_m100_95_stage2.md) — 순수 target authority와 immutable transition provenance로 단일 reveal을 구현했다.
- Stage 3: [`task_m100_95_stage3.md`](../working/task_m100_95_stage3.md) — Profile 복귀·cold/warm·logout stale lifecycle 회귀를 Chromium·WebKit에 추가했다.
- Stage 4: [`task_m100_95_stage4.md`](../working/task_m100_95_stage4.md) — 전체 Node·Playwright·production build·Sites artifact·local smoke를 통과하고 비배포 handoff를 확정했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 모바일 Safari·Chrome의 OAuth provider 왕복과 compositor paint는 자동 테스트가 완전히
  대체하지 않는다. PR merge 전 작업지시자가 Stage 4 체크리스트를 실제 기기에서 확인해야 한다.
- PR 게시 전후 모두 Sites 실제 배포를 수행하지 않는다. 배포는 #95·#96 merge 뒤 별도 요청에만
  진행한다.

### 후속 작업 후보

- [#96](https://github.com/postmelee/codex-usage-profile/issues/96) — theme 전환 중 일부 텍스트 후행
  깜빡임과 light mode Skeleton palette를 별도 release blocker로 보정한다.
- [#84](https://github.com/postmelee/codex-usage-profile/issues/84) — 두 release blocker merge·배포 뒤
  exact release candidate Gate C를 다시 검증한다.

## 작업지시자 승인 요청

- 작업지시자가 #95와 #96을 실제 배포 없이 각각 PR 생성까지 진행하도록 승인했다. 이 보고서를
  기준으로 #95 devel 대상 Open PR을 게시하며, merge는 작업지시자의 로컬·실제 모바일 Gate 확인
  뒤 직접 수행한다.
