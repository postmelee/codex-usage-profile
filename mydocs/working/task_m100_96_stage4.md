# Task #96 Stage 4 보고서 — 통합 검증과 비배포 handoff

GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
구현계획서: [`task_m100_96_impl.md`](../plans/task_m100_96_impl.md)
Stage: 4

## 단계 목적

semantic text 전환과 site/card Skeleton palette 분리가 기존 Home·Profile·Settings·Share Studio·Sites
runtime 계약을 깨지 않았는지 전체 회귀와 production artifact로 검증한다. 실제 배포 없이 작업지시자가
로컬·실기기 확인 뒤 merge할 수 있는 PR handoff 상태를 만든다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_96_stage4.md` | 전체 회귀·artifact·route smoke와 배포 미수행 감사 기록 |
| `mydocs/orders/20260812.md` | Stage 4 완료와 최종 보고 진행 상태 기록 |

## 검증 결과

### Node 전체 회귀

```bash
npm test -- --test-concurrency=1
```

- 총 738건
- 통과 732건
- 환경 조건부 skip 6건
- 실패 0건
- TODO 0건

skip은 외부 Postgres·S3 테스트 환경 변수가 없는 경우의 기존 조건부 항목이다.

### Chromium 전체 UI 회귀

```bash
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --workers=1
```

- 통과 84/84
- 실패 0건
- Home/share mobile geometry, owner/public Profile loading/reveal, settings draft, reduced motion 포함

### WebKit Task #96 회귀

```bash
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --browser=webkit --grep "Task #96" --workers=1
```

- 통과 6/6
- site/card theme 교차 palette, owner draft, 일반/reduced text transition 포함

### production Sites artifact

```bash
npm run build:production
npm run verify:sites-fullstack
```

- production full-stack build 통과
- client 8 files
- Worker 2 files
- migration 5 files
- hosted linkage와 client/server 경계 검증 통과

### 로컬 full-stack route smoke

```bash
npm run smoke:sites-fullstack:local
```

- routes 50/50
- cold card render 136.13ms
- warm card render 67.53ms
- publish render 383.35ms
- public PNG 84,958 bytes

### 정적 검사

```bash
git diff --check
```

- 경고 없음.

### PR 보정 검증 (2026-08-13)

PR 게시 뒤 모바일 성능 측정에서 universal theme transition과 ready 상태에서도 남아 있는 card
Skeleton 비용을 확인해 #96 범위 안에서 보정했다. 카드 BorderBeam과 기존 화면 밖 정지 로직은
의도한 효과이므로 변경하지 않았다.

| 지표 | 보정 전 | 보정 후 |
|---|---:|---:|
| Home theme swap 활성 animation | 353 | 83 |
| Profile theme swap 활성 animation | 1,154 | 494 |
| Profile heatmap cell animation | 364 | 364 |
| ready card 비활성 Skeleton | 203 elements + shimmer 1 | 240ms 뒤 DOM 제거 + shimmer 0 |

heatmap transition 제거 뒤 실제 브라우저에서 palette가 먼저 snap하는 회귀가 확인되어 해당 예외만
철회했다. Profile 전체 활성 animation은 494개로 기존 1,154개 대비 약 57.2% 감소 상태를 유지한다.

```bash
node --test src/profile-ui/__tests__/*.test.js src/profile-marketing/__tests__/*.test.js
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --grep "Task #96|removes shimmer and crossfade" --config playwright.task96.config.js
npm run build:sites
git diff --check
```

- frontend Node 119/119 통과
- Task #96 + reduced-motion E2E 7/7 통과
- Task #96 WebKit E2E 6/6 통과
- Home card·Share Studio·Profile card readiness 관련 시나리오 13개 모두 최종 통과
- Sites 정적 build와 diff 검사 통과

### PR 보정 검증 2 — 단일 color transition ownership (2026-08-13)

실기기 관찰을 바탕으로 프레임별 Web Animations 상태를 추가 측정했다. surface ancestor와 semantic
text descendant가 상속 `color`를 동시에 transition해 descendant 시작 keyframe이 매 프레임
재설정되고, heatmap의 100ms 전환이 나머지 240ms 전환보다 먼저 끝나는 문제를 확인했다.

- surface selector는 `background-color`와 `border-color`만 소유하도록 제한했다.
- semantic text와 text-bearing control이 `color`를 직접 소유하도록 범위를 정리했다.
- heatmap은 평상시 100ms 반응을 유지하되 theme swap 동안에만 240ms 공통 timeline을 사용한다.
- 회귀 검증은 heading·heatmap의 시작 keyframe 고정, 240ms duration, currentTime 단조 증가와 최종
  색 도달을 프레임 표본으로 확인한다.

검증 결과:

- Chromium theme surface 10/10, 전체 Profile UI 86/86 통과
- WebKit Task #96 7/7 통과
- theme·heatmap 관련 Node 25/25 통과
- production Sites full-stack build 및 artifact verify 통과
- 전체 Node suite는 실행 환경에서 장시간 정지해 중단했으며, 변경 범위 Node·전체 UI·production
  artifact 검증으로 대체했다.

### PR 리뷰 보정 검증 3 — Home·loading surface allowlist (2026-08-13)

PR 코멘트에서 universal selector 제거 뒤 Home divider와 avatar surface가 bounded allowlist에서
누락된 점을 확인했다. 같은 원인의 실제 노출 surface를 다시 audit해 Home access/status/step, account
avatar/status dot, Profile loading border/base, Settings token divider를 명시적으로 추가했다. 공용 card
Skeleton과 Share Studio card는 site theme가 아니라 card theme가 소유하므로 이 allowlist에 넣지 않았다.

- 관련 Node: 119/119 통과
- Chromium Task #96: 9/9 통과
- Chromium 전체 Profile UI: 88/88 통과
- WebKit Task #96: 9/9 통과
- production Sites full-stack build 및 artifact verify 통과
- `git diff --check` 통과

source contract의 CSS helper는 top-level brace depth를 추적해 reduced-motion rule을 기본 rule과 합치지
않으며, `CardImageSkeleton`의 JSX 줄바꿈·서식에 결합된 정규식 단언은 제거했다.

### 로컬 보정 검증 4 — 공개 Profile intro close handoff (2026-08-13)

LAN 로컬 서버의 모바일·데스크톱 실측에서 공개 Profile 최초 intro를 닫으면 card가 원래 slot으로
이동하지 않고, 사라진 modal card가 잠깐 다시 나타나는 회귀를 확인했다. Task #92에서 Share Studio의
모바일 확대를 막기 위해 추가한 viewport 안전장치가 화면 아래의 공개 Profile card까지 target-only
fallback으로 분류했고, handoff의 `opacity: 0`을 falsy fallback이 `1`로 다시 해석한 것이 원인이었다.

- 공용 Share Studio의 viewport·scale 안전장치는 그대로 유지했다.
- 공개 intro의 close에만 target 크기를 유지한 offscreen translate를 허용했다.
- computed opacity는 유효한 `0`을 보존하고 숫자가 아닐 때만 fallback하도록 분리했다.
- close 동안 card image 재요청 없이 동일 resource를 유지하는지 회귀로 고정했다.

검증 결과:

- handoff geometry·opacity Node 7/7 통과
- Chromium 공개 intro close 1/1 통과
- WebKit 공개 intro close 1/1 통과
- 기존 Task #92 모바일 Share Studio 확대 방지·geometry 2/2 통과
- `git diff --check` 통과

### 로컬 보정 검증 5 — 모바일 close 이동의 지각 연속성 (2026-08-13)

실제 LAN 공개 Profile을 iPhone 15 WebKit 조건에서 frame 단위로 측정했다. offscreen slot까지의
translate 자체는 실행됐지만 기존 close easing이 첫 약 16ms에 전체 이동 거리의 절반 이상을 소모해,
실기기에서는 modal card가 즉시 사라지고 이동하지 않는 것처럼 보였다.

- 공개 intro close easing을 느리게 출발해 화면 밖으로 가속하는 곡선으로 조정했다.
- 782px 이동이 보정 전에는 첫 유효 frame에서 약 410px 진행됐지만, 보정 후에는
  `27 → 58 → 96 → 139 → … → 782px`로 여러 frame에 걸쳐 이어졌다.
- 브라우저 회귀는 첫 유효 이동량이 최종 이동 거리의 25% 미만인지 고정해 첫-frame jump를 막는다.
- Chromium·WebKit 공개 intro close 각 1/1이 통과했고, 읽기 전용 LAN 로그인 UI preview에서
  계정 메뉴, Home Share Studio, warm source, 최종 card ready와 console error 0건을 확인했다.
- preview는 synthetic account response만 제공하고 OAuth·cookie·mutation API를 사용하지 않는다.

### 로컬 보정 검증 6 — 부분 가시 Home card의 Share handoff (2026-08-13)

로그인된 Home에서 card가 viewport에 절반만 보일 때 Share Studio가 중앙에서 opacity로만 나타나는
회귀를 iPhone 15 WebKit 조건으로 재현했다. 기존 안전장치가 partially visible source의 동일 크기
translate까지 취소해 `motionMode=target`을 선택한 것이 원인이었다.

- translated target의 viewport 가시 면적이 25% 이상일 때만 source handoff를 허용했다.
- coarse pointer에서는 계속 `scale(1)`을 사용하므로 모바일 확대 회귀가 다시 생기지 않는다.
- 완전히 화면 밖이거나 비정상적으로 큰 source는 기존 target fallback을 유지한다.
- 열기와 닫기 모두 같은 부분 가시 geometry 계약을 사용한다.

검증 결과:

- handoff Node 9/9, 전체 Profile UI Node 109/109 통과
- Chromium·WebKit Task #96 각 11/11 통과
- Chromium 전체 Profile UI 90/90 통과
- 기존 Task #92 모바일 확대 방지·원본 geometry WebKit 2/2 통과
- 실제 LAN preview에서 source top `-103px`, height 약 `207px`인 절반 가림 조건이
  `motionOrigin=source`, `motionMode=translate`, `scale(1)`로 전환됨을 확인했다.

### 로컬 보정 검증 7 — Share close BorderBeam 재점등 제거 (2026-08-13)

Share Studio가 닫혀 source card가 원래 위치로 복원된 직후 테두리가 짧게 반짝이는 현상을 실제 LAN
WebKit에서 frame 단위로 측정했다. modal unmount와 같은 frame에 `BorderBeam`이 inactive에서 active로
바뀌며 `beam-fade-in`과 `beam-spin`이 0ms부터 재시작하는 별도 animation 위상 회귀를 확인했다.

- Share open 상태를 빔의 `active` prop과 분리해 같은 DOM·animation instance를 유지한다.
- source card가 숨겨진 동안 beam·pseudo-element·bloom animation만 `paused`로 두고, handoff 종료 뒤
  같은 위상에서 `running`으로 재개한다.
- 실제 LAN WebKit에서 공유 중 559ms 위상이 고정되고 종료 뒤 559ms부터 이어졌으며, 새 0ms
  `beam-fade-in`과 card image 재요청이 발생하지 않았다.
- Profile UI Node 110/110, Chromium·WebKit Task #96 각 12/12, Chromium 종합 Share 회귀 1/1,
  production Sites full-stack build와 artifact verify, `git diff --check`가 통과했다.

### 로컬 보정 검증 8 — 로컬 origin 불일치의 Share 전체 화면 crash 제거 (2026-08-13)

로컬 서버를 `127.0.0.1`로 열고 API가 같은 서버의 LAN canonical URL을 반환하는 조건에서 Share를
누르면, same-origin card loader가 절대 URL을 거부해 React tree 전체가 unmount되는 현상을 실제 인증
preview에서 재현했다.

- README·저장용 canonical URL은 그대로 유지한다.
- 화면 preview 요청만 현재 접속 origin의 검증된 `/u/{handle}/card.png` 경로로 정규화한다.
- 다른 handle이나 public card route가 아닌 외부 URL은 rebase하지 않는다.
- 동일 화면에서 Share 열기·닫기·재열기와 console error 0건을 확인했다.

검증 결과:

- Profile UI Node 111/111 통과
- local canonical URL Share 회귀 Chromium·WebKit 각 1/1 통과
- 부분 가시 모바일 handoff·BorderBeam 위상 회귀 포함 3/3 통과
- production Sites full-stack build·artifact verify, `git diff --check` 통과

### 로컬 보정 검증 9 — Share close source resource·opacity 단일화 (2026-08-13)

BorderBeam 위상 보정 뒤에도 남은 미세한 반짝임을 다시 frame 단위로 측정했다. 화면의 source card
`src`는 한 번도 바뀌지 않았지만 Share Studio 내부 source readiness가 같은 URL을 별도로 디코딩해
다른 Blob을 만들 수 있었고, modal card가 원래 위치에 도착한 뒤 modal copy와 source card가 각각
120ms opacity transition을 실행했다. 이 이중 합성 구간이 새 card가 덮인 뒤 재렌더되는 것처럼
보이게 했다.

- Share open 시 이미 보존한 실제 `sourceCardImage.displaySrc`를 modal source handoff에 그대로 쓴다.
- source URL을 Share Studio에서 다시 fetch/decode하지 않는다.
- source card는 handoff 순간 `transition: none`으로 즉시 노출하고 modal copy만 fade-out한다.
- source의 이전 inline style은 modal 정리 시 정확히 복원한다.
- 브라우저 회귀는 close 시 modal image가 원본 Blob과 같은지, source opacity가 즉시 `1`인지,
  transition duration이 `0s`인지 함께 검증한다.

검증 결과:

- Profile UI Node 111/111 통과
- 데스크톱·모바일 Share Studio Chromium 13/13 통과
- production Sites full-stack build·artifact verify 통과
- `git diff --check` 통과
- 작업지시자가 동일 LAN 모바일에서 반영을 확인했다.

### 로컬 보정 검증 10 — card host·theme transition 진입점 연속성 (2026-08-13)

로컬 Profile에서 card 모양을 바꾸면 scroll이 튀고 Share source·BorderBeam node가 교체되는 회귀를
배포본과 비교해 추적했다. `MarketingCardTilt`가 card readiness 동안 일반 `div`를 렌더한 뒤
`hover-tilt`로 root tag를 바꾸면서 React subtree 전체를 remount한 것이 직접 원인이었다. 같은 점검에서
헤더 toggle만 transition window를 열고 Settings의 화면 모드 radio는 즉시 theme를 바꿔, 같은 preference
API를 쓰면서도 화면별 전환 동작이 달랐음을 확인했다.

- unresolved 상태부터 하나의 `hover-tilt` host를 유지하고 custom element registration은 같은 node를
  in-place upgrade하도록 변경했다.
- tilt 비활성 상태에서는 transform·glare 값을 중립값으로 두고 touch scroll ownership을 page에 돌려준다.
- theme transition window를 `ThemeProvider.setPreference()`로 이동해 header와 Settings가 같은 240ms
  timeline 및 reduced-motion 계약을 사용한다.
- delayed card render 전·중·후 동일 card·BorderBeam node와 `scrollY`가 유지되는지 브라우저 회귀로
  고정했다.

검증 결과:

- Profile UI Node 112/112 통과
- Chromium Task #96 13/13 통과
- WebKit Task #96 13/13 통과
- Chromium delayed owner draft, Settings mouse·keyboard, Share BorderBeam 집중 회귀 통과
- WebKit delayed owner draft, Settings direct selection, Share 집중 회귀 통과
- production Sites full-stack build·artifact verify 통과
- `git diff --check` 통과
- 저장소 전체 Node suite는 변경 범위 밖 장시간 실행 구간에서 중단했으며, 변경 범위 Node·양 브라우저
  Task #96·production artifact 검증으로 보완했다.

### PR #97 결합 검증 — Home 단일 reveal과 Task #96 연속성 (2026-08-13)

PR #97 merge 뒤 `devel@a5d28c0`을 PR #98 branch에 병합했다. 두 task가 함께 수정한
`HomePage.jsx`와 `tests/profile-ui.spec.js`는 자동 병합됐고, 오늘할일 문서만 충돌해 #95·#96 완료 행을
모두 보존했다. 결합 상태에서 #95의 최종 owner target 단일 reveal과 #96의 theme·Skeleton·Share
handoff를 같은 브라우저 실행으로 검증했다.

검증 결과:

- Profile UI Node 117/117 통과
- Chromium Task #95·#96 16/16 통과
- WebKit Task #95·#96 16/16 통과
- production Sites full-stack build 통과
- artifact verifier: client 8, worker 2, migration 5, `ok: true`
- `git diff --check` 통과

## 배포 감사

- PR 게시 당시에는 Sites hosting/deploy 명령을 실행하지 않았다.
- 이후 작업지시자의 명시적 배포 요청에 따라 보정 전 commit `27ebcfa`를 Sites source에 push하고
  version 28을 저장했지만, public access 확인 단계에서 owner-only 배포가 안전하게 거부되어 실제
  production deployment는 시작되지 않았다.
- 이번 리뷰 보정으로 version 28은 superseded 상태이며 배포하지 않는다. 작업지시자의 로컬 확인,
  새 commit push와 CI 통과 뒤 같은 commit으로 새 Sites version을 만들어야 한다.

## 잔여 위험 및 수동 Gate

- 자동 WebKit은 통과했지만 실제 iOS Safari·Chrome의 compositor와 화면 밝기 체감은 작업지시자의 로컬
  서버 및 실기기 Gate로 최종 확인한다.
- 공개 Profile intro close는 WebKit 자동 검증까지 통과했으며, LAN URL에서 실제 모바일의 이동·깜빡임
  해소를 작업지시자가 최종 확인한다.
- Home·Profile Share close는 기존 beam 위상을 재개하며, 실제 모바일에서 복원 직후 테두리 재점등이
  사라졌는지 작업지시자가 최종 확인한다.
- #95와 #96은 각각 독립된 `devel` 대상 PR이므로 둘 다 merge된 뒤 한 번에 배포하는 흐름을 유지한다.

## 다음 단계 영향

- 최종 보고서를 작성하고 `publish/task96`에 push한 뒤 ready PR을 생성한다.
- PR 생성으로 작업을 멈추며 실제 배포는 수행하지 않는다.

## 승인 상태

- 작업지시자가 #96 PR 생성까지 승인했으므로 최종 보고와 PR 게시를 계속한다.
