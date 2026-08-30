# Task #146 구현계획서 — 라이트 카드 Border Beam 테마 대비 보정

수행계획서: [`task_m100_146.md`](task_m100_146.md)
GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Beam 테마 소유권 연결과 계약 고정 | `MarketingLanding.jsx`, `themeSurfaceContract.test.js` | 명시적 동일 테마 전달, 공유 프리셋 비변경 |
| 2 | 라이트 전용 라이브·GIF keyline과 동등성 검증 | 테마별 live config, light golden, Worker theme 전달, 회귀 테스트 | 실제 픽셀 대비, dark golden 보존, 동일 기하·출력 계약 |
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

## Stage 2 — 라이트 전용 라이브·GIF keyline과 동등성 검증

### 산출물

신규:

- `src/profile-card/assets/ocean-light-keyline-golden-v1.rgba-runs.bin`

수정:

- `src/profile-marketing/MarketingLanding.jsx`
- `src/profile-ui/ShareStudio.jsx`
- `src/profile-ui/gifExport.js`
- `src/profile-ui/gifExport.worker.js`
- `src/profile-ui/__tests__/gifExport.test.js`
- `src/profile-ui/__tests__/themeSurfaceContract.test.js`
- `src/profile-card/gif-animation.js`
- `src/profile-card/gif-beam-frames.js`
- `src/profile-card/__tests__/gif-animation.test.js`
- `src/profile-card/__tests__/gif-beam-frames.test.js`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260830.md`
- `mydocs/working/task_m100_146_stage2.md`

### 변경 내용

- 기존 Stage 2의 “계산 스타일 문자열이 다르므로 시각 수용 가능” 결론을 철회하고 작업지시자 검수 실패를 보고서에 정정한다.
- 다크 라이브는 기존 `md / ocean / brightness 1.05 / strength 0.82` 입력을 그대로 유지한다.
- 라이트 라이브는 같은 4.8초 궤도와 Ocean 계열을 유지하면서 `line` 기반 어두운 keyline을 주 효과로 쓰고 bloom 의존도를 낮추는 전용 layer config를 적용한다.
- Share Studio와 GIF controller가 canonical `cardTheme`을 Worker request에 포함하고, Worker는 다크 기존 golden 또는 라이트 신규 golden을 선택해 encoder에 전달한다.
- GIF export preset version을 올려 기존 테마 미반영 cache key와 결과를 재사용하지 않는다.
- installed Chrome에서 승인된 라이트 live config의 96 phase를 `998×612` transparent sparse asset으로 캡처하고 binary parser·SHA·대표 frame·95→0 seam 계약을 고정한다.
- 다크 golden binary SHA와 대표 렌더 bytes가 변경되지 않음을 회귀 검증한다.
- 라이트·다크 모두 이미지 원본 `1497×918`, CSS `aspect-ratio: 499 / 306`, 프레임 폭·높이·곡률이 허용 오차 안에서 같음을 확인한다.
- 기존 preview 노드·Beam 노드를 유지하는 decoded-preview handoff와 `prefers-reduced-motion: reduce` 시 비활성화 계약을 함께 회귀 검증한다.
- 로컬 production build와 실제 Share Studio Save GIF를 열어 라이트·다크 각각 같은 카드 geometry와 사분면 phase로 캡처한다. 라이트 keyline의 실제 perimeter 픽셀 대비와 전체 loop 식별성을 확인하고 캡처는 검증 산출물로만 사용한다.

### 검증

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/themeSurfaceContract.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #146|Share Studio|Share handoff|loading and unavailable account states|card appearance"
npm run build:production
npm run verify:sites-production
git diff --check
```

수동/브라우저 확인:

- production build의 `/profile`에서 다크·라이트 카드 전환 후 한 주기 keyline 위치와 대비를 같은 뷰포트로 비교한다.
- 양쪽 프레임의 표시 크기와 상하좌우 여백이 동일한지 캡처 및 브라우저 측정값으로 확인한다.
- Share Studio에서 light GIF를 실제 생성·저장해 `998×612 / 96프레임 / 50ms / 무한 반복 / 15MB 미만`과 눈에 보이는 전체 loop를 확인한다.
- 다크 golden SHA·대표 frame과 dark GIF byte baseline이 유지되는지 확인한다.
- 라이트 keyline이 충분히 구분되지 않으면 Stage 2를 완료 처리하지 않는다.

### 커밋

```text
Task #146 Stage 2: 라이트 전용 라이브 GIF keyline 보정
```

## Stage 3 — 전체 회귀 검증과 릴리스 인계

### 산출물

신규:

- `mydocs/working/task_m100_146_stage3.md`

수정:

- Stage 3 검증에서 발견된 Task #146 범위 내 테스트·코드 보정 파일(필요한 경우에만)

### 변경 내용

- 전체 단위 테스트와 Playwright E2E, production build 및 Sites production artifact verifier를 실행한다.
- 최종 변경 파일 목록에서 다크 GIF golden, 카드·소셜 렌더러와 카드 기하·레이아웃이 변경되지 않았음을 확인한다.
- Stage 1·2의 라이트 대비, 다크 비회귀, 동일 크기·비율, handoff·reduced-motion 근거를 단계 보고서에 모은다.
- Task #146 병합으로 인해 Task #144가 기존 후보를 재사용할 수 없음을 명시하고, #144가 새 `devel` 병합 커밋을 exact-main 후보로 고정한 뒤 main 승격·Stage5 재배포·원격 스모크를 다시 수행하도록 인계한다.

### 검증

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
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
- 라이트 내장 테마의 시각 수용 실패와 2026-08-30 작업지시자 범위 확장 승인을 Stage 2 보고서에 기록한다.
- 라이트 live·GIF 전체 loop가 식별되지 않으면 계산 스타일·frame hash가 달라도 실패로 처리한다.
- 다크 카드의 Beam 표현 또는 라이트·다크 카드 기하가 달라지면 회귀로 처리한다.
- Stage 3 전체 검증과 작업 트리 정리가 끝난 뒤에만 최종 결과보고서 및 PR 단계로 이동한다.

## 커밋

- 구현계획서와 오늘할일 갱신은 별도 기본형 커밋으로 기록한다.
- 각 단계 소스·테스트는 `mydocs/working/task_m100_146_stage{N}.md`와 함께 하나의 단계 커밋으로 묶는다.
- 단계 커밋은 다음 메시지를 사용한다.
  - `Task #146 Stage 1: Border Beam 카드 테마 소유권 연결`
  - `Task #146 Stage 2: 라이트 전용 라이브 GIF keyline 보정`
  - `Task #146 Stage 3: 전체 회귀 검증과 릴리스 인계 확정`

## 단계 의존성

- Stage 1은 구현계획 승인 후에만 시작한다.
- Stage 2는 Stage 1 구현·검증·단계 보고서 승인 후 시작한다.
- Stage 3은 Stage 2 자동·시각 검증과 단계 보고서 승인 후 시작한다.
- 최종 보고 및 PR은 Stage 3 단계 보고서 승인 후 시작한다.
- Task #144의 exact-main 재고정은 Task #146 PR 병합 후 진행한다.

## 위험과 대응

- **라이브러리 테마 계산 스타일 변경**: 내부 DOM 전체를 고정하지 않고 공개 `theme` 입력, 핵심 밝기 계열 차이, 활성 상태와 기하 계약을 검증한다.
- **라이트 보정이 다크 프리셋에 스며듦**: theme별 live config와 asset 선택을 명시하고 기존 dark golden SHA·대표 frame을 고정한다.
- **GIF 테마 누락 재발**: source key뿐 아니라 Worker request schema와 encoder 호출에서 `cardTheme`을 검증한다.
- **정지 프레임 테스트의 거짓 양성**: 사분면 phase의 perimeter 픽셀 대비와 실제 저장 GIF 전체 loop를 수용 기준으로 추가한다.
- **비동기 테마 전환 측정 오염**: 새 draft 카드가 decoded·ready 상태가 된 뒤 측정하고 기존 handoff 테스트와 함께 노드 안정성을 확인한다.
- **테스트 뷰포트 편차**: 자동 비교는 같은 Playwright 프로젝트·뷰포트·상태 안에서 수행하고 기하는 허용 오차를 명시한다.
- **릴리스 후보 혼입**: Task #146에서는 원격 배포를 금지하고 병합 후 Task #144가 새 exact-main부터 다시 진행한다.

## 승인 요청 사항

- Stage 1의 단일 정규화 테마 전달과 소스 계약 테스트 범위
- Stage 2의 라이트·다크 계산 스타일, 동일 `1497×918`·`499:306`·프레임 기하, handoff·reduced-motion 검증 범위
- 작업지시자 시각 검수 실패에 따라 Stage 2를 재개하고 라이트 전용 live·GIF keyline을 구현하는 범위
- Stage 3의 전체 회귀 검증과 #144 exact-main 재고정 인계 방식
- 위 단계별 산출물, 검증 명령, 커밋 메시지

2026-08-30 작업지시자가 다크와 라이트의 시각 합성 프리셋을 분리하고 Stage 2를 재개하는 위 변경을 승인했다.
