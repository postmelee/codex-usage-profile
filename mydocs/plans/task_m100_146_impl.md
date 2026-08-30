# Task #146 구현계획서 — 라이트 카드 Border Beam 테마 대비 보정

수행계획서: [`task_m100_146.md`](task_m100_146.md)
GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Beam 테마 소유권 연결과 계약 고정 | `MarketingLanding.jsx`, `themeSurfaceContract.test.js` | 명시적 동일 테마 전달, 공유 프리셋 비변경 |
| 2 | 라이트·다크 시각 및 상호작용 동등성 검증 | `tests/profile-ui.spec.js` | 대비 분리, 동일 기하, handoff·reduced-motion 회귀 |
| 3 | 전체 회귀 검증과 릴리스 인계 | 전체 검증 결과와 인계 기록 | 단위·E2E·production build·artifact verifier |

## 문서 위치 확인

수행계획서에서 공개 제품 계약 변경이 없다고 판단했으므로 공식 문서 루트는 수정하지 않는다. 모든 계획·단계·최종 보고 산출물은 내부 작업 추적용 `mydocs/`에 둔다.

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| Task #146 계획·단계·최종 보고서 | `mydocs/` | `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | OK | 공개 문서 변경 없음 |

## Stage 1 — Beam 테마 소유권 연결과 계약 고정

### 산출물

신규:

- `mydocs/working/task_m100_146_stage1.md`

수정:

- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-ui/__tests__/themeSurfaceContract.test.js`

### 변경 내용

- `MarketingCardPreview` 렌더마다 `normalizeCardTheme(cardTheme)`을 한 번 평가한 `resolvedCardTheme`을 만든다.
- `BorderBeam`에 `theme={resolvedCardTheme}`을 명시하고 `CardImageFrame`에도 `cardTheme={resolvedCardTheme}`을 전달한다.
- 기존 `PROFILE_CARD_BORDER_BEAM_PRESET`의 `durationSeconds`, `colorVariant`, `brightness`, `size`, `strength` 전달은 그대로 둔다.
- 소스 계약 테스트에 정규화된 단일 테마가 Beam과 카드 프레임 양쪽에 전달된다는 검증을 추가한다.
- `src/profile-card/gif-animation.js`, Animated GIF golden asset, 카드·소셜 렌더러는 수정하지 않는다.

### 검증

```bash
node --test src/profile-ui/__tests__/themeSurfaceContract.test.js
git diff -- src/profile-card/gif-animation.js
git diff --check
```

추가 확인:

- `git diff --name-only`에 승인된 Stage 1 소스·테스트·보고서 외 제품 파일이 없는지 확인한다.
- 다크 테마에서도 `resolvedCardTheme`이 `dark`로 전달되어 기존 기본 동작과 의미가 동일한지 소스 계약으로 확인한다.

### 커밋

```text
Task #146 Stage 1: Border Beam 카드 테마 소유권 연결
```

## Stage 2 — 라이트·다크 시각 및 상호작용 동등성 검증

### 산출물

신규:

- `mydocs/working/task_m100_146_stage2.md`

수정:

- `tests/profile-ui.spec.js`

조건부 수정:

- 라이트 내장 테마만으로 시각 수용 기준을 충족하지 못하면 소스 변경을 진행하지 않는다. 작업지시자의 별도 승인을 받은 뒤에만 `src/profile-marketing/MarketingLanding.jsx`의 라이트 전용 보정 범위를 구현계획서에 추가한다.

### 변경 내용

- 인증된 `/profile` 카드 설정 시나리오에 라이트·다크 Beam 테마 대비와 기하 동등성 검증을 추가한다.
- 다크 상태에서 카드 이미지 원본 크기, CSS 종횡비, Beam 프레임 bounding box·곡률, 핵심 Beam 계산 스타일을 기록한다.
- 라이트로 전환하고 최신 draft 이미지가 준비된 뒤 같은 값을 다시 측정한다.
- 다크는 기존 흰색 계열 Beam 표현을 유지하고, 라이트는 내장 라이트 테마의 어두운 대비 계열로 전환되어 두 계산 스타일이 명확히 다름을 확인한다.
- 라이트·다크 모두 이미지 원본 `1497×918`, CSS `aspect-ratio: 499 / 306`, 프레임 폭·높이·곡률이 허용 오차 안에서 같음을 확인한다.
- 기존 preview 노드·Beam 노드를 유지하는 decoded-preview handoff와 `prefers-reduced-motion: reduce` 시 비활성화 계약을 함께 회귀 검증한다.
- 로컬 production build를 브라우저에서 열어 라이트·다크 각각 동일한 뷰포트와 카드 상태로 캡처하고, 라이트 대비 및 다크 비회귀를 육안 확인한다. 캡처는 검증 산출물로만 사용하고 제품 파일로 커밋하지 않는다.

### 검증

```bash
npx playwright test tests/profile-ui.spec.js --grep "Task #146|Share handoff|loading and unavailable account states|card appearance"
npm run build:production
npm run verify:sites-production
git diff -- src/profile-card/gif-animation.js
git diff --check
```

수동/브라우저 확인:

- production build의 `/profile`에서 다크·라이트 카드 전환 후 Beam 색상 대비를 같은 뷰포트로 비교한다.
- 양쪽 프레임의 표시 크기와 상하좌우 여백이 동일한지 캡처 및 브라우저 측정값으로 확인한다.
- 내장 라이트 테마만으로 Beam이 충분히 구분되지 않으면 Stage 2를 완료 처리하지 않고 추가 보정 승인 요청으로 전환한다.

### 커밋

```text
Task #146 Stage 2: 라이트 다크 Beam 동등성 회귀 검증
```

## Stage 3 — 전체 회귀 검증과 릴리스 인계

### 산출물

신규:

- `mydocs/working/task_m100_146_stage3.md`

수정:

- Stage 3 검증에서 발견된 Task #146 범위 내 테스트·코드 보정 파일(필요한 경우에만)

### 변경 내용

- 전체 단위 테스트와 Playwright E2E, production build 및 Sites production artifact verifier를 실행한다.
- 최종 변경 파일 목록에서 공유 GIF 프리셋, GIF golden asset, 카드·소셜 렌더러, 카드 기하·레이아웃이 변경되지 않았음을 확인한다.
- Stage 1·2의 라이트 대비, 다크 비회귀, 동일 크기·비율, handoff·reduced-motion 근거를 단계 보고서에 모은다.
- Task #146 병합으로 인해 Task #144가 기존 후보를 재사용할 수 없음을 명시하고, #144가 새 `devel` 병합 커밋을 exact-main 후보로 고정한 뒤 main 승격·Stage5 재배포·원격 스모크를 다시 수행하도록 인계한다.

### 검증

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
git diff -- src/profile-card/gif-animation.js
git diff --check
git status --short
```

추가 확인:

- `git diff --name-only aaf997720f296265c8b306840f0eb8af67b08dfb...HEAD`로 Task #146 승인 범위 밖 제품 파일이 없는지 확인한다.
- 원격 Stage5와 production 환경에는 Task #146 브랜치에서 쓰기 작업을 하지 않는다.

### 커밋

```text
Task #146 Stage 3: 전체 회귀 검증과 릴리스 인계 확정
```

## 검증

- 각 Stage 검증 명령은 해당 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않고 같은 Stage에서 원인을 수정·재검증한다.
- 라이트 내장 테마가 시각 수용 기준을 충족하지 못하면 추가 보정을 임의 구현하지 않고 구현계획 변경 승인을 요청한다.
- 다크 카드의 Beam 표현 또는 라이트·다크 카드 기하가 달라지면 회귀로 처리한다.
- Stage 3 전체 검증과 작업 트리 정리가 끝난 뒤에만 최종 결과보고서 및 PR 단계로 이동한다.

## 커밋

- 구현계획서와 오늘할일 갱신은 별도 기본형 커밋으로 기록한다.
- 각 단계 소스·테스트는 `mydocs/working/task_m100_146_stage{N}.md`와 함께 하나의 단계 커밋으로 묶는다.
- 단계 커밋은 다음 메시지를 사용한다.
  - `Task #146 Stage 1: Border Beam 카드 테마 소유권 연결`
  - `Task #146 Stage 2: 라이트 다크 Beam 동등성 회귀 검증`
  - `Task #146 Stage 3: 전체 회귀 검증과 릴리스 인계 확정`

## 단계 의존성

- Stage 1은 구현계획 승인 후에만 시작한다.
- Stage 2는 Stage 1 구현·검증·단계 보고서 승인 후 시작한다.
- Stage 3은 Stage 2 자동·시각 검증과 단계 보고서 승인 후 시작한다.
- 최종 보고 및 PR은 Stage 3 단계 보고서 승인 후 시작한다.
- Task #144의 exact-main 재고정은 Task #146 PR 병합 후 진행한다.

## 위험과 대응

- **라이브러리 테마 계산 스타일 변경**: 내부 DOM 전체를 고정하지 않고 공개 `theme` 입력, 핵심 밝기 계열 차이, 활성 상태와 기하 계약을 검증한다.
- **라이트 추가 보정이 공유 프리셋에 스며듦**: Stage 2 결정 게이트를 두고, 필요 시 공유 상수와 분리된 라이브 웹 라이트 전용 입력만 별도 승인 대상으로 삼는다.
- **비동기 테마 전환 측정 오염**: 새 draft 카드가 decoded·ready 상태가 된 뒤 측정하고 기존 handoff 테스트와 함께 노드 안정성을 확인한다.
- **테스트 뷰포트 편차**: 자동 비교는 같은 Playwright 프로젝트·뷰포트·상태 안에서 수행하고 기하는 허용 오차를 명시한다.
- **릴리스 후보 혼입**: Task #146에서는 원격 배포를 금지하고 병합 후 Task #144가 새 exact-main부터 다시 진행한다.

## 승인 요청 사항

- Stage 1의 단일 정규화 테마 전달과 소스 계약 테스트 범위
- Stage 2의 라이트·다크 계산 스타일, 동일 `1497×918`·`499:306`·프레임 기하, handoff·reduced-motion 검증 범위
- 라이트 내장 테마가 부족하면 구현을 중지하고 라이트 전용 보정을 별도 승인받는 결정 게이트
- Stage 3의 전체 회귀 검증과 #144 exact-main 재고정 인계 방식
- 위 단계별 산출물, 검증 명령, 커밋 메시지
