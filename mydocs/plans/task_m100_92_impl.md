# Task #92 구현계획서 — 모바일 공유 카드 전환과 계정 메뉴 터치 회귀 보정

- 수행계획서: [`task_m100_92.md`](task_m100_92.md)
- GitHub Issue: [#92](https://github.com/postmelee/codex-usage-profile/issues/92)
- 마일스톤: M100 — v1.0 MVP
- 상태: 구현 승인 대기

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 재현과 회귀 계약 확정 | 모바일 모션·터치 known-failure E2E, 원인 측정값 | 집중 Playwright, 기존 키보드·모바일 기준선 |
| 2 | 모바일 공유 카드 전환 보정 | capability·사각형 안전성 판정, scale 없는 모바일 공간 전환 | 모션 단위 테스트, 모바일·데스크톱 Share Studio E2E |
| 3 | 계정 메뉴 터치 생명주기 보정 | 지연된 focus-out dismiss, 모바일 항목 활성화 계약 | 모바일 터치·키보드·외부 클릭·로그아웃 E2E |
| 4 | 통합 검증과 실제 기기 실측 인계 | 전체 검증, Sites 산출물 검증, Safari·Chrome 확인 경로 | 전체 unit/E2E/build/verify, 실제 모바일 Gate |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_92*.md` | OK | 내부 작업 계획 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_92_stage{N}.md` | OK | 각 Stage 소스와 함께 커밋 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_92_report.md` | OK | 전체 검증과 실제 기기 결과 기록 |
| README·공개 문서 | 해당 없음 | 해당 없음 | OK | 사용자 기능·공개 계약 변경 없음 |

## Stage 1 — 재현과 회귀 계약 확정

### 산출물

신규:

- `mydocs/working/task_m100_92_stage1.md`

수정:

- `tests/profile-ui.spec.js`

### 변경 내용

- 모바일 Share Studio 테스트가 최종 레이아웃만 확인하던 공백을 보완한다.
- 홈 카드의 출발 사각형을 의도적으로 불안전한 값으로 만들어 현재 구현이 제한 없는 `scale()` 시작 프레임을 받아들이는지 측정한다.
- 애니메이션의 첫 keyframe, 출발·도착 사각형, 계산된 scale, 첫 프레임 뷰포트 경계를 진단값으로 고정한다.
- 모바일 계정 메뉴에서 `relatedTarget = null`인 focus-out 뒤 링크 또는 로그아웃 활성화가 소실되는 이벤트 순서를 재현한다.
- 두 회귀의 최종 수용 조건은 Playwright `test.fail()`로 알려진 실패임을 표시한다. Stage 1 CI는 통과시키되 Stage 2·3 보정 시 annotation을 제거하지 않으면 unexpected pass가 발생하도록 한다.
- 데스크톱 카드 전환과 계정 메뉴 키보드 테스트를 기준선으로 함께 실행한다.
- 제품 소스는 수정하지 않는다.

### 검증

```bash
npx playwright test tests/profile-ui.spec.js --grep "Task #92|account menu exposes Profile|card owner can publish" --workers=1
git diff --check
```

### 커밋

```text
Task #92 Stage 1: 모바일 회귀 재현과 계약 고정
```

## Stage 2 — 모바일 공유 카드 전환 보정

### 산출물

신규:

- `src/profile-ui/__tests__/useCardHandoffMotion.test.js`
- `mydocs/working/task_m100_92_stage2.md`

수정:

- `src/profile-ui/useCardHandoffMotion.js`
- `src/profile-ui/ShareStudio.jsx` 또는 동일한 전환 호출부
- `src/styles.css` — 재현 결과 CSS 안전장치가 필요한 경우에만 수정
- `tests/profile-ui.spec.js`

### 변경 내용

- User-Agent가 아닌 입력 capability와 사각형·뷰포트 안전성으로 공간 전환 모드를 선택하는 순수 판정 계약을 추가한다.
- fine pointer이고 출발·도착 비율과 시작 프레임 경계가 안전한 경우 기존 `translate + scale` FLIP을 유지한다.
- coarse pointer 또는 안전하지 않은 사각형에서는 target 크기를 유지한 `scale(1)` 카드가 출발 카드의 중심 위치에서 도착 위치로 이동하게 한다.
- 위치 이동마저 유효 뷰포트를 벗어나는 경우에만 target 위치에 고정된 짧은 진입 전환으로 정착한다.
- 공간 이동은 기존 decelerate easing과 카드 전환 시간 범위를 유지하며 과도한 scale·overshoot를 허용하지 않는다.
- 닫기 전환에도 같은 안전 판정을 적용해 모바일에서 다시 확대되지 않게 한다.
- Stage 1의 공유 모션 `test.fail()`을 제거하고 모바일 첫 프레임과 최종 프레임이 모두 뷰포트 안전 계약을 만족하게 한다.
- 데스크톱 `data-motion-origin="source"`, reduced-motion, viewport resize fallback, warm-source 캐시 계약을 유지한다.

### 검증

```bash
node --test src/profile-ui/__tests__/useCardHandoffMotion.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #92 mobile Share Studio|card owner can publish|Share card dialog fits|reduced motion|settles after resize" --workers=1
git diff --check
```

### 커밋

```text
Task #92 Stage 2: 모바일 공유 카드 공간 전환 보정
```

## Stage 3 — 계정 메뉴 터치 생명주기 보정

### 산출물

신규:

- `mydocs/working/task_m100_92_stage3.md`

수정:

- `src/profile-ui/AccountMenu.jsx`
- `tests/profile-ui.spec.js`

### 변경 내용

- `blur` 이벤트에서 메뉴를 즉시 언마운트하지 않고 다음 animation frame에 실제 `activeElement`가 메뉴 밖인지 확인한다.
- 예약한 focus-out 검사는 메뉴 재진입, 항목 활성화, 외부 dismiss, 컴포넌트 정리 시 취소해 stale close를 막는다.
- Profile·Settings 링크는 기본 활성화가 성립한 뒤 메뉴를 닫고, Log out은 기존 비동기 결과와 오류 상태를 유지한다.
- 외부 pointer down과 Escape는 기존 즉시 dismiss 책임을 유지한다.
- Stage 1의 계정 메뉴 `test.fail()`을 제거하고 `relatedTarget = null` 터치 시퀀스에서도 Profile·Settings 이동과 Log out 요청이 각각 한 번 실행됨을 검증한다.
- 키보드 첫 항목 포커스, Arrow/Home/End 탐색, Escape 복귀, 포커스 이탈 닫힘을 회귀 검증한다.

### 검증

```bash
npx playwright test tests/profile-ui.spec.js --grep "Task #92 mobile account menu|account menu exposes Profile|device approval common header" --workers=1
git diff --check
```

### 커밋

```text
Task #92 Stage 3: 계정 메뉴 터치 활성화 순서 보정
```

## Stage 4 — 통합 검증과 실제 기기 실측 인계

### 산출물

신규:

- `mydocs/working/task_m100_92_stage4.md`

수정:

- `mydocs/orders/20260812.md`
- 검증 중 실제 회귀가 확인된 Task #92 범위 파일만 최소 수정

### 변경 내용

- 전체 unit/E2E와 프로덕션 Sites 빌드·산출물 검증을 실행한다.
- 설치된 Playwright WebKit이 있으면 같은 모바일 집중 테스트를 실행한다. 브라우저 바이너리 또는 의존성 설치가 필요하면 작업지시자 승인을 먼저 받는다.
- 실제 모바일 Safari와 Chrome에서 홈 Share 열기·닫기, Profile·Settings·Log out을 확인할 로컬 또는 승인된 배포 URL과 체크리스트를 제공한다.
- 실제 기기 확인 전에는 Task #84 Stage 5와 마케팅을 계속 차단한다.
- 실측 결과와 Task #84 재개 판단을 Stage 4 보고서에 기록한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
git diff --check
git status --short
```

가용한 경우 추가 실행:

```bash
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #92" --workers=1
```

### 커밋

```text
Task #92 Stage 4: 통합 검증과 모바일 실측 준비
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- known-failure annotation은 해당 보정 Stage에서 반드시 제거한다.
- 제품 코드 변경 없이 재현할 수 없는 경우 Stage 1 보고서에서 근거를 제시하고 구현계획 변경 승인을 요청한다.
- 실제 기기와 자동화 결과가 다르면 실제 기기 동작을 우선하고 재현 계약을 보강한다.
- 계획 변경이나 문서 위치 변경이 필요하면 구현 전에 승인을 다시 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_92_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #92 Stage {N}: {핵심 내용 요약}` 형식을 따른다.
- 전체 Stage 완료 후 `task-final-report` 절차로 최종 보고서·오늘할일·PR을 처리한다.

## 단계 의존성

- Stage 1은 승인된 수행계획과 본 구현계획 승인 후 시작한다.
- Stage 2는 Stage 1 재현·원인 계약과 단계 보고 승인 후 진행한다.
- Stage 3은 Stage 2 모션 보정 검증과 단계 보고 승인 후 진행한다.
- Stage 4는 Stage 3 메뉴 보정 검증과 단계 보고 승인 후 진행한다.
- Task #84 Stage 5는 Task #92 Stage 4 실제 기기 Gate 승인 전까지 진행하지 않는다.

## 위험과 대응

- **실제 iOS 이벤트 순서와 Chromium 에뮬레이션 차이**: null-relatedTarget 시퀀스를 자동화하고 실제 Safari·Chrome Gate를 별도로 둔다.
- **인위적 사각형 재현과 실제 동적 viewport 차이**: 순수 안전성 테스트와 실제 첫 프레임 경계 측정을 함께 사용한다.
- **모바일 scale 제거로 공간 연속성이 약화**: target 크기를 유지한 중심점 위치 이동으로 카드의 출발·도착 관계를 보존한다.
- **데스크톱 모션 회귀**: 기존 fine-pointer FLIP 테스트와 애니메이션 keyframe 계약을 유지한다.
- **지연된 blur가 메뉴를 남겨둠**: 외부 pointer down·Escape·실제 activeElement 검사를 각각 검증한다.
- **WebKit 자동화 환경 부재**: 무단 설치하지 않고 기존 CI 또는 실제 기기 검증으로 보완한다.

## 승인 요청 사항

- Stage 1에서 제품 소스 없이 두 known failure를 재현하고 `test.fail()`로 추적하는 방식을 승인한다.
- Stage 2에서 모바일/coarse pointer는 scale을 제거하되 중심점 기반 위치 이동은 유지하는 방향을 승인한다.
- Stage 3에서 즉시 blur close를 다음 animation frame의 실제 포커스 검사로 변경하는 방향을 승인한다.
- Stage 4 실제 모바일 Safari·Chrome Gate 전까지 Task #84 Stage 5를 차단하는 순서를 승인한다.
