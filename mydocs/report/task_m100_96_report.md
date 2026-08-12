# Task #96 최종 보고서 — 테마 전환 텍스트와 Skeleton 팔레트 정합성 보정

GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
마일스톤: M100

## 작업 요약

- 대상 이슈: #96
- 마일스톤: M100 — v1.0 MVP
- 단계 수: 4
- 작업 목적: Home·Profile primary text가 하나의 테마 전환 창에서 함께 바뀌도록 semantic color
  ownership을 명시하고, page Skeleton은 site theme, card Skeleton은 card theme를 따르도록 분리한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/styles.css` | primary text direct token, page/card Skeleton token과 light card variant 추가 | dark/light 전환, Profile loading, 공용 card preview |
| `src/profile-marketing/MarketingLanding.jsx` | card theme prop과 정규화된 `data-card-theme` context 추가 | Home·Profile·intro 공용 card frame |
| `src/profile-ui/HomePage.jsx` | owner는 saved theme, operator/sample은 canonical dark 전달 | Home card Skeleton |
| `src/profile-ui/CardProfilePage.jsx` | owner draft theme를 card frame에 전달 | Profile card 설정 변경 중 preview |
| `src/profile-ui/PublicProfilePage.jsx` | public profile theme를 card와 intro에 전달 | 공개 Profile·공유 링크 |
| `src/profile-ui/PublicCardIntro.jsx` | intro frame에 card theme 전달 | 공유 링크 최초 card modal |
| `src/profile-ui/ShareStudio.jsx` | share frame에 card theme 전달 | 공유 modal warm/cold preview |
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | 응답 전 내부 card theme를 canonical dark로 명시 | owner/public Profile loading |
| `src/profile-ui/__tests__/themeSurfaceContract.test.js` | semantic text·page/card token·공용 callsite 계약 4건 | source regression |
| `tests/profile-ui.spec.js` | transition history, reduced motion, site/card 교차 palette E2E 5건 | Chromium·WebKit regression |
| `mydocs/plans/task_m100_96*.md` | 비배포 구현·검증 계획 | 내부 작업 근거 |
| `mydocs/working/task_m100_96_stage{1..4}.md` | 단계별 audit·구현·검증 결과 | 내부 검증 추적 |
| `mydocs/orders/20260812.md` | 오늘할일 상태와 완료 시각 | 내부 작업 보드 |

## 문서 위치 검증

제품·사용자·기여자·외부 통합·API·아키텍처·로드맵 문서는 변경하지 않았다. 사용자 문구·API·URL
계약을 바꾸지 않는 내부 UI 회귀 보정이므로 수행계획서가 선택한 `mydocs/plans`, `mydocs/working`,
`mydocs/report` 위치에만 작업 근거를 기록했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_96*.md` | OK | 계획서 문서 위치 표와 일치 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_96_stage{1..4}.md` | OK | 각 Stage 산출물과 일치 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_96_report.md` | OK | 중앙 최종 보고서 템플릿 적용 |
| 공개 문서 | 변경 없음 | 해당 없음 | OK | 공개 계약 변경 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| direct primary text selector | 문제 대상 7개가 상속에 의존 | 7개 모두 `--text-primary` 직접 소유 |
| light Profile page Skeleton | dark card base, 평균 RGB lightness 41 | site light base `rgb(222, 222, 220)` |
| card Skeleton theme context | 공용 frame에 없음 | 모든 공용 frame이 explicit `light|dark` 보유 |
| site dark × card light | dark placeholder 노출 가능 | white/light renderer palette와 일치 |
| site light × card dark | site와 혼동 가능 | canonical dark palette 독립 유지 |
| Task #96 WebKit 회귀 | 전용 교차·timing 검증 없음 | 5/5 통과 |
| 전체 Playwright | Task #96 회귀 없음 | Chromium 84/84 통과 |
| 전체 Node | 전용 source contract 없음 | 738건 중 732 통과, 실패 0, skip 6 |
| Sites local smoke | 변경 후 증거 없음 | 50 routes, cold 136.13ms, warm 67.53ms |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| Home Quickstart·step·identity text가 같은 transition window에서 전환 | OK — 중간 computed color와 종료 뒤 안정값 검증 |
| Profile display/stage heading이 종료 뒤 별도로 snap하지 않음 | OK — direct semantic ownership과 Chromium·WebKit timing 통과 |
| reduced motion에서 불필요 transition window 없음 | OK — attribute·transition 없이 즉시 최종색 적용 |
| page Skeleton이 site theme를 따름 | OK — light page는 밝은 base·어두운 sheen, dark page는 기존 dark 의미 유지 |
| card Skeleton이 card theme만 따름 | OK — site/card 교차 조합과 owner draft radio 전환 통과 |
| Home·Profile·intro·Share Studio 공용 frame context 누락 없음 | OK — source contract 4/4와 기존 handoff E2E 통과 |
| geometry·readiness·share motion 회귀 없음 | OK — Chromium 전체 84/84 통과 |
| production Sites 산출물과 route 계약 유지 | OK — build, artifact verifier, 50-route local smoke 통과 |
| 실제 배포 없이 PR·로컬 확인 handoff | OK — hosting/deploy 명령 미실행 |

### 단계별 검증 결과

- Stage 1: [`task_m100_96_stage1.md`](../working/task_m100_96_stage1.md) — text와 Skeleton ownership gap을 source 계약·expected failure로 고정했다.
- Stage 2: [`task_m100_96_stage2.md`](../working/task_m100_96_stage2.md) — 7개 primary text surface의 direct semantic ownership과 일반/reduced transition을 보정했다.
- Stage 3: [`task_m100_96_stage3.md`](../working/task_m100_96_stage3.md) — site/card Skeleton palette와 모든 공용 card theme context를 분리했다.
- Stage 4: [`task_m100_96_stage4.md`](../working/task_m100_96_stage4.md) — 전체 Node·Playwright·production artifact·50-route smoke를 통과하고 비배포 handoff를 확정했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 iOS Safari·Chrome의 compositor와 화면 밝기 체감은 자동 WebKit이 완전히 대체하지 않는다.
  작업지시자가 merge 전 로컬 서버와 실제 기기에서 최종 확인해야 한다.
- PR 게시 전후 모두 실제 Sites 배포를 수행하지 않는다. 배포는 #95·#96 merge 뒤 별도 요청에만
  진행한다.

### merge 전 실제 모바일 Gate

1. Home dark↔light에서 Quickstart와 모든 step title이 동시에 전환되는지 확인한다.
2. Profile dark↔light에서 이름·stats·activity text가 종료 뒤 깜빡이지 않는지 확인한다.
3. light owner/public Profile slow loading에서 page Skeleton이 밝게 보이는지 확인한다.
4. site light/dark와 card light/dark를 교차해 card Skeleton이 card theme만 따르는지 확인한다.
5. reduced motion 설정에서 shimmer와 불필요 transition이 제거되는지 확인한다.

### 후속 작업 후보

- [PR #97](https://github.com/postmelee/codex-usage-profile/pull/97) — #95 Home 카드 단일 reveal 보장 PR과 함께 merge Gate를 통과한다.
- [#84](https://github.com/postmelee/codex-usage-profile/issues/84) — #95·#96 merge 및 동시 배포 뒤 exact release candidate Gate C를 재개한다.

## 작업지시자 승인 요청

- 작업지시자가 #95와 #96을 실제 배포 없이 각각 PR 생성까지 진행하도록 승인했다. 이 보고서를
  기준으로 #96 devel 대상 ready PR을 게시하며, merge는 작업지시자의 로컬·실제 모바일 Gate 확인 뒤
  직접 수행한다.
