# Task #96 최종 보고서 — 테마 전환 텍스트와 Skeleton 팔레트 정합성 보정

GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
마일스톤: M100

## 작업 요약

- 대상 이슈: #96
- 마일스톤: M100 — v1.0 MVP
- 단계 수: 4
- 작업 목적: Home·Profile primary text가 하나의 테마 전환 창에서 함께 바뀌도록 semantic color
  ownership을 명시하고, page Skeleton은 site theme, card Skeleton은 card theme를 따르도록 분리한다.
  PR 검토 중 확인한 모바일 성능 회귀에 대해서는 semantic surface로 transition 대상을 제한하고,
  card Skeleton은 퇴장 전환 뒤 DOM과 shimmer를 함께 정리한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/styles.css` | primary text direct token, page/card Skeleton token과 light card variant, semantic transition scope 추가 | dark/light 전환, Profile loading, 공용 card preview |
| `src/profile-marketing/MarketingLanding.jsx` | card theme context와 Skeleton 240ms 퇴장 후 unmount 추가 | Home·Profile·intro 공용 card frame |
| `src/profile-ui/HomePage.jsx` | owner는 saved theme, operator/sample은 canonical dark 전달 | Home card Skeleton |
| `src/profile-ui/CardProfilePage.jsx` | owner draft theme를 card frame에 전달 | Profile card 설정 변경 중 preview |
| `src/profile-ui/PublicProfilePage.jsx` | public profile theme를 card와 intro에 전달 | 공개 Profile·공유 링크 |
| `src/profile-ui/PublicCardIntro.jsx` | intro frame에 card theme 전달 | 공유 링크 최초 card modal |
| `src/profile-ui/ShareStudio.jsx` | share frame에 card theme 전달 | 공유 modal warm/cold preview |
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | 응답 전 내부 card theme를 canonical dark로 명시 | owner/public Profile loading |
| `src/profile-ui/__tests__/themeSurfaceContract.test.js` | semantic text·page/card token·공용 callsite·transition fan-out 계약 6건 | source regression |
| `tests/profile-ui.spec.js` | transition history, reduced motion, site/card 교차 palette, animation fan-out E2E 6건 | Chromium·WebKit regression |
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
| Home theme swap 활성 animation | 353개 | 83개, 약 76.5% 감소 |
| Profile theme swap 활성 animation | 1,154개 | 494개, 약 57.2% 감소 |
| theme swap heatmap cell animation | 364개 | 364개; palette 전환의 연속성을 유지 |
| ready card의 숨은 Skeleton | 203개 element와 shimmer 1개 유지 | 240ms 퇴장 뒤 DOM 제거, shimmer 0개 |
| Task #96 WebKit 회귀 | 전용 교차·timing 검증 없음 | 6/6 통과 |
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
| theme transition이 dense content 전체로 확산되지 않음 | OK — Home 83, Profile 494로 기존 1,154 대비 fan-out을 제한하면서 heatmap 364개의 연속 전환 유지 |
| ready card가 비활성 Skeleton 비용을 유지하지 않음 | OK — 240ms fade 뒤 subtree 제거, reduced motion shimmer 0 검증 |
| production Sites 산출물과 route 계약 유지 | OK — build, artifact verifier, 50-route local smoke 통과 |
| 실제 배포 없이 PR·로컬 확인 handoff | OK — hosting/deploy 명령 미실행 |

### 단계별 검증 결과

- Stage 1: [`task_m100_96_stage1.md`](../working/task_m100_96_stage1.md) — text와 Skeleton ownership gap을 source 계약·expected failure로 고정했다.
- Stage 2: [`task_m100_96_stage2.md`](../working/task_m100_96_stage2.md) — 7개 primary text surface의 direct semantic ownership과 일반/reduced transition을 보정했다.
- Stage 3: [`task_m100_96_stage3.md`](../working/task_m100_96_stage3.md) — site/card Skeleton palette와 모든 공용 card theme context를 분리했다.
- Stage 4: [`task_m100_96_stage4.md`](../working/task_m100_96_stage4.md) — 전체 Node·Playwright·production artifact·50-route smoke를 통과하고 비배포 handoff를 확정했다.

### PR 보정 검증 (2026-08-13)

- frontend Node 회귀: 119/119 통과
- Task #96 및 reduced-motion 브라우저 회귀: 7/7 통과
- Task #96 WebKit 회귀: 6/6 통과
- Home card·Share Studio·Profile card readiness 관련 시나리오: 13개 모두 최종 통과
- `npm run build:sites`: 통과
- `git diff --check`: 통과
- BorderBeam의 지속 애니메이션과 기존 화면 밖 정지 로직은 변경하지 않았다.
- heatmap transition 제거가 palette의 즉시 snap 회귀를 만들었으므로 해당 예외만 철회했다. Profile 전환은
  494개로 측정되어 기존 1,154개보다 약 57.2% 적고, 나머지 scoped transition·비활성 Skeleton
  정리 최적화는 유지한다.

### PR 보정 검증 2 — 단일 timeline 보장 (2026-08-13)

- ancestor surface와 descendant text의 중복 `color` transition을 제거해 semantic text가 하나의
  240ms animation에서 시작색부터 최종색까지 이동하도록 보정했다.
- heatmap은 theme swap 동안에만 동일한 240ms timeline을 사용하고 평상시 100ms 피드백은 유지한다.
- frame-level 회귀는 text·heatmap의 시작 keyframe이 바뀌지 않고 animation currentTime이 단조
  증가하는지 확인한다.
- Chromium theme surface 10/10, 전체 Profile UI 86/86, WebKit Task #96 7/7, 관련 Node 25/25가
  통과했다.
- production Sites full-stack build와 artifact verify가 통과했다. 실제 배포는 수행하지 않았다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 iOS Safari·Chrome의 compositor와 화면 밝기 체감은 자동 WebKit이 완전히 대체하지 않는다.
  작업지시자가 merge 전 로컬 서버와 실제 기기에서 최종 확인해야 한다.
- BorderBeam은 의도한 지속 효과이므로 이번 보정에서 유지했다. 위 두 병목 보정 뒤에도 실기기 스크롤
  저하가 재현될 때만 별도 측정 근거로 observer 범위·compositor 비용을 후속 검토한다.
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
