# Task M100 #3 수행계획서

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)
마일스톤: M100

## 목적

최신 Codex Profile 화면을 웹페이지에서 확인할 수 있도록 snapshot 기반 프로필 화면을 구현한다. 이번 task의 결과물은 사용자가 제공한 Codex 앱 스크린샷과 `codex-extracted/` 분석 결과를 기준으로 하되, 웹페이지 용도에 맞춰 Profile 본문 UI를 중심으로 재현하는 것이다.

이번 task는 #2에서 만든 `profile-snapshot` schema, fixture, selector를 화면 렌더링 입력으로 사용한다. pairing API, 로컬 CLI push, README PNG 생성, OpenAI 로그인은 후속 issue 범위로 남기고, 우선 sample snapshot으로 재현 가능한 사용자 화면과 상호작용을 고정한다.

## 배경

초기 목표는 Codex 프로필 카드와 GitHub README 삽입 기능이었지만, 최신 Codex 앱에는 Profile 설정 화면과 별도의 공유 카드 저장 기능이 추가되었다. 사용자는 단순 카드보다 Codex Profile 화면 전체를 웹에서 확인하고 싶어 하며, 이후 CLI push와 pairing API로 로컬 활동 데이터를 웹에 반영하는 구조를 원한다.

#2에서는 서버에 저장 가능한 정제 snapshot 계약과 selector를 만들었다. #3은 이 계약을 실제 화면으로 검증하는 첫 사용자-facing task이며, 이후 #4 API, #5 CLI, #6 README 이미지 endpoint가 같은 snapshot을 공유할 수 있는지 확인하는 기준 화면이 된다.

참고 근거:

- `codex-extracted/webview/assets/settings-page-CzYYqdVO.js`
- `codex-extracted/webview/assets/settings-content-layout-Dm8iYKt_.js`
- `codex-extracted/webview/assets/profile-DFD9l1SG.js`
- `src/profile-snapshot/fixtures/sample-snapshot.js`
- `src/profile-snapshot/selectors.js`
- 작업지시자가 제공한 Codex Profile/Share modal 스크린샷

## 범위

### 포함

- sample snapshot 기반 Profile preview route 구현
- Profile 본문 중심 app shell과 top action 구현
- avatar, display name, username, plan pill, 5개 stat bar 렌더링
- Daily / Weekly / Cumulative token activity heatmap 변환과 탭 전환
- daily cell hover tooltip: `{tokens} tokens on {date}`
- Activity insights와 Most used plugins 영역 렌더링
- loading, empty, unavailable 상태
- desktop 1512px급 viewport와 mobile viewport responsive layout
- heatmap 변환 단위 테스트
- Playwright 기반 desktop/mobile screenshot, tab 전환, tooltip 확인

### 제외

- pairing API와 snapshot 저장 backend
- 로컬 CLI push 구현
- README PNG endpoint와 GitHub README 자동 갱신
- OpenAI 계정 로그인
- 프로필 edit/photo upload 기능
- Codex 앱 전체 기능 복제
- Codex 앱 내부 bundle을 그대로 embed하거나 런타임 의존성으로 사용하는 방식
- Codex 설정 sidebar/navigation 전체 재현

## 설계 방향

- 기존 저장소는 Node ESM 기반 snapshot 패키지만 있으므로, UI 구현 단계에서 React + Vite 기반의 최소 프론트엔드 scaffold를 도입하는 것을 기본 방향으로 둔다. 구현 전 기존 구조가 새로 발견되면 그 구조를 우선한다.
- 화면 입력은 `src/profile-snapshot`의 sample snapshot과 selector를 사용한다. UI 컴포넌트가 raw Codex 응답이나 인증 파일에 직접 접근하지 않도록 한다.
- route는 `/u/:handle`을 우선 구현하고, 개발/검증 편의를 위해 필요하면 동등한 preview route를 함께 둔다.
- 시각 기준은 작업지시자가 첨부한 Codex Profile 화면 스크린샷과 추출 bundle 분석 결과다. 랜딩 페이지나 마케팅 hero가 아니라 실제 앱 설정 화면을 첫 화면으로 만든다.
- desktop과 mobile 모두 Profile 본문 중심 single-column shell을 유지한다. Codex settings sidebar는 사용자가 불필요하다고 판단했으므로 제외하고, top action과 profile content에 집중한다.
- heatmap은 selector 또는 UI 전용 변환 함수에서 daily, weekly, cumulative mode를 분리한다. daily tooltip은 날짜와 token 값을 snapshot 기준으로 계산한다.
- UI 색상, spacing, radius, typography는 Codex dark settings 화면의 조용한 tool surface에 맞춘다. CSS token을 두되, 과도한 장식 배경이나 별도 landing composition은 만들지 않는다.
- Playwright screenshot은 검증 산출물로 사용하되, 생성된 이미지 파일을 저장소에 남길지는 구현계획서에서 결정한다.
- `codex-extracted/`는 분석 입력 자료로만 사용한다. 해당 untracked 폴더를 task 산출물로 추가하거나 수정하지 않는다.

## 문서 위치 판단

이번 task는 사용자용 공식 문서를 만들지 않는다. UI 동작 계약은 코드와 테스트로 검증하고, 세부 단계 결과는 Hyper-Waterfall 산출물에 기록한다. heatmap 변환 규칙이나 responsive 기준이 후속 task에서 반복 참조될 만큼 복잡해지면 구현계획서에서 `mydocs/tech/` 내부 기술 노트 추가 여부를 확정한다.

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
|---|---|---|---|---|---|
| `해당 없음` | 공식 문서 | 사용자/기여자 | `해당 없음` | `docs/` 또는 `specs/` | 이번 task는 public 사용법/API 문서가 아니라 실행 UI 구현과 검증이 목적이다. |
| `mydocs/working/task_m100_3_stage{N}.md` | 작업 산출물 | 내부 작업자/에이전트 | `mydocs/working/` | `docs/` | 단계별 판단과 검증 로그는 Hyper-Waterfall 작업 기록이다. |
| `mydocs/report/task_m100_3_report.md` | 작업 산출물 | 내부 작업자/에이전트 | `mydocs/report/` | `docs/` | 최종 결과와 잔여 리스크 기록용이며 사용자 문서가 아니다. |

## 예상 변경 파일

신규:

- `index.html`
- `vite.config.js`
- `playwright.config.js`
- `src/main.jsx`
- `src/App.jsx`
- `src/profile-ui/ProfilePage.jsx`
- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/ProfileHeader.jsx`
- `src/profile-ui/ProfileStats.jsx`
- `src/profile-ui/TokenActivityChart.jsx`
- `src/profile-ui/ActivityInsights.jsx`
- `src/profile-ui/profileRoutes.js`
- `src/profile-ui/heatmap.js`
- `src/profile-ui/__tests__/heatmap.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`

수정:

- `package.json`
- 필요 시 `src/profile-snapshot/selectors.js`
- 필요 시 `src/profile-snapshot/index.js`

이번 task 산출물:

- `mydocs/orders/20260608.md`
- `mydocs/plans/task_m100_3.md`
- `mydocs/plans/task_m100_3_impl.md`
- `mydocs/working/task_m100_3_stage{N}.md`
- `mydocs/report/task_m100_3_report.md`

## 잠정 단계

- **Stage 1 — 프론트엔드 scaffold와 route 기반**
  - React + Vite 기반 앱 진입점과 `/u/:handle` preview route를 만든다.
  - #2 sample snapshot을 화면 데이터로 연결한다.
  - settings shell의 큰 레이아웃과 기본 loading/empty/unavailable 상태를 만든다.

- **Stage 2 — Profile 본문 정적 구조 재현**
  - avatar, display name, username, plan pill, 5개 stat bar를 구현한다.
  - Activity insights와 Most used plugins 리스트를 snapshot 값으로 렌더링한다.
  - desktop/mobile에서 주요 텍스트가 겹치지 않도록 responsive constraints를 둔다.

- **Stage 3 — Token activity heatmap 상호작용**
  - Daily / Weekly / Cumulative 변환 함수를 구현하고 단위 테스트를 추가한다.
  - 탭 전환과 daily cell tooltip을 구현한다.
  - chart grid, month label, hover state의 안정적인 치수를 고정한다.

- **Stage 4 — 시각 검증과 마감 정리**
  - Playwright로 desktop/mobile screenshot, tab 전환, tooltip 동작을 검증한다.
  - CSS color/theme token을 검토하고 Codex dark settings 화면과의 차이를 줄인다.
  - stage 보고서와 최종 보고서에 검증 결과와 후속 issue 의존성을 정리한다.

## 검증 계획

### 단계별 검증

- Stage 1
  - `npm test`
  - `npm run build`
  - route 진입 시 sample snapshot 화면 또는 상태 화면이 렌더링되는지 확인
- Stage 2
  - `npm test`
  - desktop/mobile viewport에서 header, stat bar, insights, plugins 텍스트 겹침 확인
- Stage 3
  - `npm test`
  - heatmap 변환 단위 테스트
  - Playwright tab 전환과 daily tooltip 확인
- Stage 4
  - `npm test`
  - `npm run build`
  - Playwright desktop/mobile screenshot 확인
  - `git diff --check`
  - CSS color/theme token 검토

### 통합 검증

- sample snapshot으로 `/u/:handle` 또는 동등한 preview route에서 프로필 화면이 렌더링된다.
- Daily / Weekly / Cumulative 전환이 동작한다.
- daily heatmap cell hover 시 `{tokens} tokens on {date}` 형식의 tooltip이 보인다.
- Activity insights와 Most used plugins가 snapshot 값과 일치한다.
- 1512px급 desktop viewport와 mobile viewport에서 텍스트 겹침이 없다.
- `git status --short`가 PR 준비 전 빈 출력이다. 단, 작업 전부터 존재한 untracked `codex-extracted/`는 이번 task 산출물로 취급하지 않는다.
- `git diff --check`가 경고 없이 통과한다.

## 리스크

- **Codex UI 정확도 한계**: 추출 bundle은 minified 산출물이고 실제 앱 내부 자산을 그대로 재사용하지 않는다. 스크린샷과 분석 결과를 기준으로 시각 구조를 최대한 맞추되, 법적/기술적 리스크가 있는 runtime embed는 피한다.
- **프론트엔드 scaffold 도입 범위 증가**: 저장소에 아직 UI 앱 구성이 없으므로 Vite, Playwright, 관련 npm script를 새로 추가해야 한다. 구현계획서에서 의존성 설치와 검증 명령을 분리한다.
- **heatmap mode 해석 차이**: Codex 내부 Daily/Weekly/Cumulative 계산의 정확한 기준이 바뀔 수 있다. snapshot 원천 데이터를 보존하고 UI 변환 함수를 테스트로 고정해 후속 조정을 쉽게 한다.
- **responsive fidelity**: desktop Codex settings 화면을 mobile에 그대로 축소하면 텍스트 겹침이 생길 수 있다. mobile은 같은 정보 구조를 유지하되 화면 폭에 맞는 compact layout을 승인 범위에 포함한다.
- **후속 API 의존성**: #4/#5 전에는 실제 사용자 데이터 갱신이 없다. 이번 task는 sample snapshot 기반 preview로 한정한다.

## 승인 요청 사항

- #3 범위를 snapshot 기반 Profile settings UI 재현, heatmap 상호작용, 상태 화면, Playwright 검증으로 한정하는 것을 승인해 달라.
- pairing API, CLI push, README PNG endpoint, OpenAI 로그인, profile edit/photo upload를 이번 task에서 제외하는 것을 승인해 달라.
- UI scaffold는 React + Vite를 기본 방향으로 도입하고, 실제 구현 단계에서 기존 구조가 발견되면 그 구조를 우선하는 설계 방향을 승인해 달라.
- 공식 사용자 문서는 이번 task에서 만들지 않고, 필요한 작업 기록은 `mydocs/working/`과 `mydocs/report/`에 남기는 문서 위치 판단을 승인해 달라.

승인되면 `task_m100_3_impl.md`에서 단계별 산출물, 검증 명령, 커밋 메시지를 구체화한다.
