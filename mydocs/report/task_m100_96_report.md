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
| `src/styles.css` | primary text direct token, page/card Skeleton token과 light card variant, semantic transition scope와 Share 중 beam pause 추가 | dark/light 전환, Profile loading, 공용 card preview |
| `src/profile-marketing/MarketingLanding.jsx` | card theme context, Skeleton 240ms 퇴장 후 unmount, Share와 BorderBeam active 수명 분리, readiness 중 안정적인 tilt host 유지 | Home·Profile·intro 공용 card frame |
| `src/profile-ui/HomePage.jsx` | owner는 saved theme, operator/sample은 canonical dark 전달 | Home card Skeleton |
| `src/profile-ui/CardProfilePage.jsx` | owner draft theme를 card frame에 전달 | Profile card 설정 변경 중 preview |
| `src/profile-ui/PublicProfilePage.jsx` | public profile theme를 card와 intro에 전달 | 공개 Profile·공유 링크 |
| `src/profile-ui/PublicCardIntro.jsx` | intro frame에 card theme를 전달하고 close-only offscreen handoff 활성화 | 공유 링크 최초 card modal |
| `src/profile-ui/useCardHandoffMotion.js` | 공개 intro의 동일 크기 offscreen close 이동, zero-opacity 보존, source 즉시 복원 | card modal 닫기·source handoff |
| `src/profile-ui/ShareStudio.jsx` | share frame에 card theme를 전달하고 이미 디코딩된 source resource 재사용 | 공유 modal warm/cold preview |
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | 응답 전 내부 card theme를 canonical dark로 명시 | owner/public Profile loading |
| `src/profile-ui/ThemeProvider.jsx` | 모든 preference 변경이 같은 theme transition window를 열도록 전환 진입점 단일화 | header toggle·Settings 화면 모드 |
| `src/profile-ui/ThemeToggle.jsx` | toggle 전용 transition helper를 제거하고 provider 계약 사용 | header 화면 모드 toggle |
| `src/profile-ui/__tests__/themeSurfaceContract.test.js` | semantic text·page/card token·공용 callsite·bounded surface·BorderBeam 수명 계약 7건 | source regression |
| `src/profile-ui/__tests__/useCardHandoffMotion.test.js` | offscreen translate opt-in과 zero-opacity 보존 계약 | motion geometry·flicker regression |
| `tests/profile-ui.spec.js` | transition history, reduced motion, site/card 교차 palette, Home·loading surface와 intro close E2E | Chromium·WebKit regression |
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
| Home theme swap 활성 animation | 353개 | 89개, 약 74.8% 감소; divider·avatar 6개 포함 |
| Profile theme swap 활성 animation | 1,154개 | 494개, 약 57.2% 감소 |
| theme swap heatmap cell animation | 364개 | 364개; palette 전환의 연속성을 유지 |
| ready card의 숨은 Skeleton | 203개 element와 shimmer 1개 유지 | 240ms 퇴장 뒤 DOM 제거, shimmer 0개 |
| 공개 intro close | offscreen source에서 이동 취소 후 modal card 재등장 | target 크기 translate, opacity replay·image 재요청 없음 |
| Task #96 WebKit 회귀 | 전용 교차·timing 검증 없음 | 12/12 통과 |
| 전체 Playwright | Task #96 회귀 없음 | Chromium 90/90 통과 |
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
| geometry·readiness·share motion 회귀 없음 | OK — Chromium 전체 88/88 및 후속 intro close·기존 Task #92 geometry 회귀 통과 |
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

### PR 리뷰 보정 검증 3 — bounded surface 누락 해소 (2026-08-13)

- universal selector를 되살리지 않고 Home divider·anonymous access·계정 avatar, Profile loading,
  Settings token row 등 실제 theme-dependent surface만 background/border allowlist에 추가했다.
- Home의 5개 Quickstart divider와 avatar 1개가 새로 참여해 활성 animation은 83개에서 89개가
  되었으며, 기존 353개 대비 약 74.8% 감소 상태를 유지한다.
- CSS source contract는 `@media (prefers-reduced-motion)` 내부 규칙을 top-level rule과 합치지 않도록
  brace depth를 추적하고, JSX 구현 서식에 결합된 `return null` 정규식 단언은 제거했다.
- Chromium Task #96 9/9, 전체 Profile UI 88/88, WebKit Task #96 9/9, 관련 Node 119/119가
  통과했다.
- production Sites full-stack build와 artifact verify, `git diff --check`가 통과했다. 실제 배포는
  수행하지 않았다.

### 로컬 보정 검증 4 — 공개 intro close 연속성 복구 (2026-08-13)

- Task #92의 공용 viewport safety는 유지하고, 공개 Profile intro close에만 동일 크기 offscreen
  translate를 opt-in해 화면 아래의 실제 card slot 방향으로 이동을 복구했다.
- `opacity: 0`을 `1`로 바꾸던 falsy fallback을 제거해 handoff 직전 modal card 재등장을 막았다.
- Node handoff 7/7, Chromium·WebKit intro close 각 1/1, 기존 Task #92 모바일 Share Studio 2/2가
  통과했다. 브라우저 회귀는 이동 거리, scale 1 유지, opacity 양의 jump 없음, source 최종 opacity 1,
  card image 추가 요청 0건을 함께 확인한다.
- 변경은 현재 LAN 로컬 서버에 반영했으며 push·CI·리뷰 반영 코멘트 전 실제 모바일 확인 Gate를
  유지한다.

### 로컬 보정 검증 5 — 실기기에서 보이는 close 이동 복구 (2026-08-13)

- iPhone 15 WebKit 조건으로 실제 LAN URL의 close frame을 측정해 기존 easing이 첫 유효 frame에
  전체 거리의 절반 이상을 소모하는 지각 회귀를 확인했다.
- close가 느리게 출발한 뒤 화면 밖으로 가속하도록 조정해 782px 이동이
  `27 → 58 → 96 → 139 → … → 782px`로 여러 frame에 걸쳐 보이게 했다.
- E2E는 첫 유효 이동량이 전체 거리의 25% 미만인지 함께 검증해 같은 회귀를 고정한다.
- 실제 OAuth·cookie·mutation 없이 로그인 상태만 재현하는 읽기 전용 LAN preview에서 Home 계정
  메뉴와 Share Studio warm handoff, card ready, console error 0건을 확인했다.

### 로컬 보정 검증 6 — 절반 가림 Home card handoff 복구 (2026-08-13)

- 로그인된 Home card가 viewport에 절반만 보이면 완전 가시성 검사 때문에 Share Studio가
  `target` fallback되어 중앙에서 바로 나타나는 회귀를 재현했다.
- viewport 가시 면적이 25% 이상인 source만 동일 크기 translate를 허용해, 일부 보이는 card는 현재
  위치에서 중앙으로 이어지고 완전히 화면 밖이거나 비정상적으로 큰 source는 계속 차단한다.
- 모바일은 계속 `scale(1)`을 유지하며 열기·닫기에 같은 geometry 계약을 적용한다.
- 실제 LAN WebKit에서 source top `-103px`, height 약 `207px` 조건이 `source/translate`로 바뀌었고,
  Node 109/109, Chromium·WebKit Task #96 각 11/11, Chromium 전체 90/90, 기존 Task #92 WebKit
  2/2가 통과했다.

### 로컬 보정 검증 7 — Share close BorderBeam 위상 보존 (2026-08-13)

- source card가 돌아온 직후 새 `beam-fade-in 0.6s`가 시작되는 별도 animation 위상 회귀를 확인했다.
- Share open 중에도 빔의 active 수명은 유지하고 animation만 pause해, source handoff 뒤 같은 위상에서
  이어지도록 변경했다. source card가 opacity 0인 동안에는 빔이 노출되지 않는다.
- 실제 LAN WebKit frame 측정에서 beam 위상은 공유 중 559ms로 고정되었고 종료 후 559ms부터 재개됐다.
  새 0ms fade-in, source opacity 하락, card image URL 변경은 없었다.
- Profile UI Node 110/110, Chromium·WebKit Task #96 각 12/12, Chromium 종합 Share 회귀 1/1,
  production Sites full-stack build·artifact verify와 `git diff --check`가 통과했다.

### 로컬 보정 검증 8 — 로컬 Share 전체 화면 crash 제거 (2026-08-13)

- `127.0.0.1`로 접속한 인증 preview가 LAN 주소의 canonical card URL을 받으면 same-origin loader가
  render 중 예외를 던져 Share 클릭 뒤 빈 화면만 남는 것을 재현했다.
- canonical URL은 복사·저장 계약에 유지하고, 화면 preview만 현재 origin의 동일 handle public card
  경로로 안전하게 rebase했다. 다른 handle·route의 외부 URL은 거부한다.
- 실제 인증 preview에서 Share 열기·닫기·재열기와 console error 0건을 확인했다.
- Profile UI Node 111/111, 관련 Chromium Share 회귀 3/3, local canonical URL WebKit 회귀 1/1,
  production Sites full-stack build·artifact verify, `git diff --check`가 통과했다.

### 로컬 보정 검증 9 — Share close 단일 source handoff (2026-08-13)

- BorderBeam 위상 보정 뒤에도 남은 미세한 반짝임을 frame 단위로 재측정했다. 화면의 source card
  `src`는 유지됐지만 Share Studio가 source URL을 별도로 디코딩해 다른 Blob으로 교체했고, 도착 후
  modal copy와 source card가 각각 120ms opacity transition을 실행해 새 card가 덮이는 듯 보였다.
- Share 버튼을 누를 때 보존한 실제 `sourceCardImage.displaySrc`를 modal 복귀에도 그대로 사용하고,
  source card는 transition 없이 즉시 노출한 뒤 modal copy만 fade-out하도록 단일 handoff로 변경했다.
- source의 기존 inline style은 modal 정리 시 원래 값으로 복원한다.
- Profile UI Node 111/111, 데스크톱·모바일 Share Studio Chromium 13/13, production Sites full-stack
  build·artifact verify와 `git diff --check`가 통과했다. 작업지시자가 동일 LAN 모바일에서 반영을
  확인했다.

### 로컬 보정 검증 10 — card root와 theme preference 전환 단일화 (2026-08-13)

- card readiness가 바뀔 때 `div`와 `hover-tilt`를 교체하던 conditional root가 card subtree를
  remount해 Profile scroll jump, Share source ref 상실, BorderBeam 재시작을 함께 만들었음을 배포본과
  local commit 비교로 확인했다.
- 하나의 `hover-tilt` host를 계속 유지하고, 비활성 속성만 중립값으로 바꿔 custom element가 같은
  node를 in-place upgrade하도록 보정했다. delayed render 전·중·후 card와 BorderBeam node identity,
  `scrollY`를 함께 검증한다.
- theme transition ownership을 `ThemeToggle`에서 `ThemeProvider.setPreference()`로 이동해 Settings의
  System·Light·Dark 선택도 header와 같은 240ms transition 및 reduced-motion 의미를 사용한다.
- Profile UI Node 112/112, Chromium·WebKit Task #96 각 13/13, production Sites full-stack build와
  artifact verify, `git diff --check`가 통과했다. 작업지시자가 로컬 동작을 확인했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 iOS Safari·Chrome의 compositor와 화면 밝기 체감은 자동 WebKit이 완전히 대체하지 않는다.
  작업지시자가 merge 전 로컬 서버와 실제 기기에서 최종 확인해야 한다.
- BorderBeam은 의도한 지속 효과로 유지하되 Share에서 source card가 숨겨진 동안만 기존 위상을
  pause한다. 실기기 스크롤 저하가 재현될 때만 별도 측정 근거로 observer 범위·compositor 비용을
  후속 검토한다.
- 보정 전 commit `27ebcfa`로 저장한 Sites version 28은 실제 배포가 시작되지 않았고 이번 리뷰
  보정으로 superseded 되었다. 로컬 확인·새 commit push·CI 통과 뒤 동일 commit으로 새 version을
  저장해야 한다.

### merge 전 실제 모바일 Gate

1. Home dark↔light에서 Quickstart와 모든 step title이 동시에 전환되는지 확인한다.
2. Profile dark↔light에서 이름·stats·activity text가 종료 뒤 깜빡이지 않는지 확인한다.
3. light owner/public Profile slow loading에서 page Skeleton이 밝게 보이는지 확인한다.
4. site light/dark와 card light/dark를 교차해 card Skeleton이 card theme만 따르는지 확인한다.
5. reduced motion 설정에서 shimmer와 불필요 transition이 제거되는지 확인한다.
6. 공개 Profile 최초 intro를 닫을 때 card가 확대 없이 아래 slot 방향으로 이동하고 다시 깜빡이지
   않는지 확인한다.
7. Home·Profile Share를 닫아 card가 원래 위치로 돌아온 직후 테두리가 재점등하지 않고 기존 흐름을
   자연스럽게 이어가는지 확인한다.
8. `127.0.0.1`과 LAN URL 양쪽에서 Home Share가 빈 화면 없이 열리고 닫힌 뒤 다시 열리는지 확인한다.

### 후속 작업 후보

- [PR #97](https://github.com/postmelee/codex-usage-profile/pull/97) — #95 Home 카드 단일 reveal 보장 PR과 함께 merge Gate를 통과한다.
- [#84](https://github.com/postmelee/codex-usage-profile/issues/84) — #95·#96 merge 및 동시 배포 뒤 exact release candidate Gate C를 재개한다.

## 작업지시자 승인 요청

- 작업지시자가 #95와 #96을 실제 배포 없이 각각 PR 생성까지 진행하도록 승인했다. 이 보고서를
  기준으로 #96 devel 대상 ready PR을 게시하며, merge는 작업지시자의 로컬·실제 모바일 Gate 확인 뒤
  직접 수행한다.
