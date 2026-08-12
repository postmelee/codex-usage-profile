# Task #92 최종 보고서 — 모바일 공유 카드 전환과 계정 메뉴 터치 회귀 보정

GitHub Issue: [#92](https://github.com/postmelee/codex-usage-profile/issues/92)
마일스톤: M100

## 작업 요약

- 대상 이슈: #92
- 마일스톤: M100
- 단계 수: 4개 Stage, 실제 모바일 보정 하위 단계 3개
- 작업 목적: 모바일 Safari·Chrome에서 공유 카드가 과도하게 확대되고 계정 메뉴 항목이
  이동 전에 닫히던 회귀를 보정하면서 데스크톱 FLIP, reduced-motion, 키보드 접근성과
  카드 readiness 계약을 유지한다.

Stage 1에서 모바일 공유 전환의 unsafe scale과 `blur.relatedTarget === null`일 때 메뉴가
동기적으로 닫히는 원인을 회귀 테스트로 고정했다. Stage 2는 coarse pointer에서 목표 카드의
크기를 유지하고 중심점만 이동하도록 분리했으며, 안전하지 않은 좌표는 최종 위치에서
진입하게 했다. Stage 3은 blur dismiss를 다음 프레임의 실제 focus 상태로 판정해 터치
활성화를 우선했다.

실제 모바일 검증 중 Safari 최소 폭, 소스·목표 카드의 전환 프레임, surface별 radius와
익명 헤더 폭 차이를 추가로 발견했다. 승인된 Stage 4 하위 보정에서 source card hiding,
논리 카드 radius의 렌더링 폭 비례 계산, 모바일 익명 헤더 재배치를 반영했다. 작업지시자가
실제 모바일에서 계정 메뉴 이동, 공유 열기·닫기 애니메이션, Home·Share 카드 radius와
익명 헤더가 정상임을 확인해 Task #92 범위를 닫았다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/useCardHandoffMotion.js` | pointer·viewport·사각형 안전성 기반 전환 모드와 scale 없는 모바일 이동을 구현 | Home·Profile 공유 전환 |
| `src/profile-ui/ShareStudio.jsx` | 전환 중 소스 카드 숨김과 목표 프레임 준비 상태를 연결 | 공유 modal 첫·마지막 frame |
| `src/profile-ui/AccountMenu.jsx` | null-relatedTarget blur를 지연 판정하고 항목 활성화를 우선 | 모바일 Profile·Settings·Log out |
| `src/profile-ui/useCardFrameRadius.js` | 논리 카드 radius를 실제 렌더링 폭에 비례해 계산하고 resize 추적 | Home·Profile·Share 카드 기하 |
| `src/profile-marketing/MarketingLanding.jsx` | Home 카드에 공통 frame radius를 적용하고 transition source를 표시 | Home 카드·공유 진입 |
| `src/styles.css` | 모바일 최소 폭, source hiding, radius 변수와 익명 헤더 폭을 보정 | 반응형 레이아웃·전환 시각 |
| `src/profile-ui/__tests__/*.test.js` | handoff 판정과 radius 계산 단위 회귀를 추가 | 모션·기하 계약 |
| `tests/profile-ui.spec.js` | 모바일·데스크톱·WebKit·메뉴·radius·헤더 E2E를 추가 | 브라우저 회귀 검증 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | 계획, 단계 결과, 모바일 Gate와 후속 릴리즈 차단 항목 기록 | 작업 추적 |

최종 보고서 작성 전 branch diff는 16파일, +1,574/-58줄이다. 테스트·작업 문서가 큰 비중을
차지하며 제품 변경은 위 UI와 스타일 경계에 한정한다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| Task #92 계획서 | `mydocs/plans/` | `mydocs/plans/` | OK | 내부 구현 판단과 승인 경계를 계획 문서에 기록 |
| Task #92 단계 보고서 | `mydocs/working/` | `mydocs/working/` | OK | Stage별 재현·구현·검증 결과 기록 |
| Task #92 최종 보고서 | `mydocs/report/` | `mydocs/report/` | OK | 장기 보관할 수용 결과와 후속 작업 경계 기록 |
| README·공개 문서 | 해당 없음 | 변경 없음 | OK | 사용자 기능, API, 데이터·공유 URL 계약을 변경하지 않음 |

새 공식 문서 루트는 만들지 않았으며, 수행계획서의 문서 위치 판단과 실제 산출물이
일치한다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| coarse-pointer 공유 시작 scale | source/target 비율로 확대될 수 있음 | 항상 `scale(1)`, 유효 중심점 이동만 허용 |
| unsafe 시작 위치 | 유효 viewport 밖 전환 가능 | target 고정 진입으로 fail-close |
| null-relatedTarget blur | 메뉴 즉시 unmount | 다음 frame activeElement 판정 뒤 외부 focus일 때만 dismiss |
| surface별 카드 radius | 컨테이너 CSS radius가 렌더링 폭과 독립 | 1200px 논리 카드 radius를 실제 폭에 비례 계산 |
| Node 검증 | Task 착수 기준선 | 150개 실패 없음, 기존 환경 조건 1개 skip |
| Playwright 전체 E2E | Task 착수 기준선 | 79/79 pass |
| WebKit Task #92 집중 검증 | 없음 | 4/4 pass |
| Sites local full-stack smoke | Task 착수 기준선 | 50 routes, public PNG 84,958 bytes, cold 156.08ms, warm 72.82ms |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 모바일 공유 modal이 과도하게 확대되지 않고 유효 viewport 안에서 정착 | OK — coarse pointer scale 제거, unsafe 위치 fail-close와 E2E 통과 |
| 데스크톱 fine-pointer FLIP와 reduced-motion 유지 | OK — 전체 Playwright와 집중 handoff 회귀 통과 |
| Profile·Settings·Log out 터치 활성화가 메뉴 닫힘보다 먼저 완료 | OK — null-blur·항목 활성화·외부 dismiss E2E와 실제 모바일 이동 확인 |
| Home·Profile·Share가 동일한 카드 radius 기하 사용 | OK — 공통 hook 단위 테스트와 Home·Share 실제 모바일 확인 |
| 모바일 익명 헤더에서 Sign in이 잘리지 않음 | OK — 모바일 익명 헤더 E2E와 실제 화면 확인 |
| 기존 카드 image readiness·source 재사용 유지 | OK — 전체 단위·E2E 0 fail |
| Sites production artifact와 route 계약 유지 | OK — production build, full-stack verifier와 50-route smoke 통과 |
| 실제 모바일 Gate | OK — 작업지시자가 계정 메뉴, 공유 애니메이션, radius, 익명 헤더 정상 동작 확인 |

최종 통합 검증은 다음 결과로 종료했다.

```text
Node: 150 tests / 0 fail / 1 existing environment-condition skip
Playwright: 79 / 79 pass
WebKit Task #92 focused: 4 / 4 pass
production build: server 60 modules / client 1,829 modules
full-stack verifier: hosted / migration 5 / client 8 / worker 2 / ok true
full-stack local smoke: 50 routes / public PNG 84,958 bytes / ok true
git diff --check: clean
```

### 단계별 검증 결과

- Stage 1 — [`task_m100_92_stage1.md`](../working/task_m100_92_stage1.md): 모바일 unsafe scale과 null-blur 메뉴 회귀 재현·계약 고정
- Stage 2 — [`task_m100_92_stage2.md`](../working/task_m100_92_stage2.md): capability 기반 scale 없는 모바일 공간 전환과 fail-close 구현
- Stage 3 — [`task_m100_92_stage3.md`](../working/task_m100_92_stage3.md): 계정 메뉴 터치 활성화 우선과 외부 dismiss 생명주기 보정
- Stage 4 — [`task_m100_92_stage4.md`](../working/task_m100_92_stage4.md): Safari 최소 폭·전환 frame·radius·익명 헤더 보정, 전체 검증과 실제 모바일 Gate 완료

## 잔여 위험과 후속 작업

### 잔여 위험

- Task #92 범위의 릴리즈 차단 결함은 없다.
- 인증 후 또는 다른 화면에서 Home으로 복귀할 때 모바일에서 카드가
  `ready → loading → ready`로 한 번 더 전환되는 현상은 Home의 비동기 표시 대상 결정
  문제이며 Task #92의 공유 handoff·메뉴 생명주기와 원인이 다르다.
- 테마 전환 종료 뒤 일부 상속 텍스트가 뒤늦게 snap되고 light mode Skeleton이 dark
  팔레트를 사용하는 문제는 semantic color·Skeleton theme ownership 문제이며 Task #92의
  카드 기하·모션 경계와 다르다.

### 후속 작업 후보

- 릴리즈 차단 1순위 — 인증·화면 복귀 시 Home 카드가 최종 owner target을 확정할 때까지
  Skeleton을 유지하고 한 번만 reveal하도록 상태 전환을 보정한다.
- 릴리즈 차단 2순위 — 테마 전환 텍스트의 명시적 semantic color ownership과 page/card
  Skeleton 팔레트를 정합화한다.
- Task #84 Gate C와 마케팅은 위 두 이슈가 완료되고 exact release candidate가 다시
  검증될 때까지 재개하지 않는다.

## 작업지시자 승인 요청

- 작업지시자가 Task #92의 실제 모바일 결과를 승인하고 현재 상태로 마무리한 뒤 두 후속
  결함을 릴리즈 차단 이슈로 등록하라고 지시했다. 이 승인을 근거로 최종 보고서와 오늘할일을
  완료 처리하고 `devel` 대상 ready PR을 게시한다.
- PR은 self-merge하지 않는다. CI 통과 뒤 작업지시자가 직접 검토·merge하며, merge 후
  `pr-merge-cleanup`으로 이슈와 branch/worktree 부산물을 정리한다.
