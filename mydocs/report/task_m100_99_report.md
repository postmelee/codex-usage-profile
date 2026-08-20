# Task #99 최종 보고서 — Home과 Profile 최근 업데이트 시각

GitHub Issue: [#99](https://github.com/postmelee/codex-usage-profile/issues/99)
마일스톤: M100

## 작업 요약

- 대상 이슈: #99
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: Home과 owner/public Profile에서 마지막 사용량 제출 시각을 locale·현지 시간대에 맞는 낮은 위계의 시맨틱 정보로 제공한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/formatters.js` | `usage.uploadedAt` 유효성·locale·timezone formatter 추가 | 최근 업데이트 표시 계약 |
| `src/profile-ui/messages.js` | 영어·한국어 최근 업데이트 문구 추가 | UI locale |
| `src/profile-ui/LastUpdatedTime.jsx` | 유효한 시각만 `<time datetime>`으로 출력하는 공통 컴포넌트 추가 | Home·Profile 접근성 |
| `src/profile-ui/HomePage.jsx` | 인증 owner usage ready 시 카드와 identity 사이에 최근 업데이트 표시 및 안정 slot 연결 | Home |
| `src/profile-ui/AccountUsageProfile.jsx`, `src/profile-ui/ProfileHeader.jsx` | owner/public/private-preview 공통 Profile header에 최근 업데이트 전달·표시 | Profile |
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | ready update slot과 같은 세 번째 identity placeholder 추가 | Profile loading geometry |
| `src/profile-ui/PublicProfilePage.jsx` | private owner preview가 공통 Profile Skeleton을 사용하도록 누락 참조 보정 | public/private preview loading |
| `src/styles.css` | tertiary typography, Home/Profile slot, Skeleton 및 theme transition 정합 | desktop/mobile·light/dark |
| `src/profile-ui/__tests__/formatters.test.js`, `src/profile-ui/__tests__/lastUpdatedTime.test.js` | ko/en·timezone·invalid·시맨틱 markup 단위 계약 추가 | Node 회귀 |
| `tests/profile-ui.spec.js` | Home·owner/public Profile, loading geometry, mobile, locale, theme 통합 회귀 추가 | Playwright·WebKit |
| `mydocs/plans/task_m100_99*.md`, `mydocs/working/task_m100_99_stage*.md`, `mydocs/orders/20260813.md` | 범위·단계·검증·완료 이력 기록 | Hyper-Waterfall 내부 문서 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_99*.md` | OK | 승인 경계와 단계 설계를 내부 계획 위치에 보존 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_99_stage{1..4}.md` | OK | 각 단계 산출물·검증 근거 보존 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_99_report.md` | OK | PR·release 판단용 장기 기록 |
| 공개 문서 | 변경 없음 | 해당 없음 | OK | API·사용자 흐름·외부 계약을 변경하지 않음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 최근 업데이트 표시 표면 | 0개 | Home·owner Profile·public Profile 3개 공통 계약 |
| 시맨틱 timestamp | 없음 | 유효한 `usage.uploadedAt`에 `<time datetime>` 제공 |
| Task #99 WebKit 집중 회귀 | 없음 | 6/6 통과 |
| 전체 Playwright E2E | 기준 100개 | 100/100 통과 |
| 전체 Node 테스트 | 기준 suite | 787개 중 781개 통과·6개 skip·실패 0 |
| Sites local smoke | 기존 50 route | 50 route 통과·public PNG 84,939 bytes |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 사용량이 있는 Home과 Profile에서 `usage.uploadedAt` 표시 | OK — owner ready usage와 owner/public/private-preview 공통 Profile 경로 검증 |
| 한국어·영어 locale 및 현지 시간대 표현 | OK — formatter·component 단위 테스트와 Playwright locale 회귀 통과 |
| loading·empty·invalid timestamp에서 오해할 시각 미표시 | OK — invalid는 DOM 미생성, Home empty/error 및 Profile 빈 slot 검증 |
| Skeleton→ready 레이아웃 이동 방지 | OK — Profile 기하 2px 허용치 이내, Home 16px 안정 slot 유지 |
| mobile 잘림·과도한 줄바꿈 방지와 낮은 위계 유지 | OK — 390px Home/Profile와 LAN mobile 수동 확인 |
| light/dark·reduced motion 일관성 | OK — semantic theme transition과 reduced-motion 회귀 포함 전체 E2E 통과 |
| backend·media·OG 계약 무변경 | OK — UI·테스트·내부 문서만 변경, production artifact verifier 통과 |

### 단계별 검증 결과

- Stage 1: formatter·공통 `<time>` 컴포넌트 집중 테스트 17개 통과
- Stage 2: Home ready/empty/error·mobile·theme Playwright 3개 및 관련 단위 테스트 통과
- Stage 3: owner/public/private-preview Profile과 Skeleton 기하 Playwright 3개 및 관련 단위 테스트 통과
- Stage 4: Node 781 pass/6 skip, 전체 E2E 100/100, WebKit 6/6, production build·Sites verify·50-route smoke 통과

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 Sites 배포와 production 공개 전환은 이 task 범위 밖이다.
- 별도 worktree의 #100·#101이 후속으로 병합될 경우 공용
  `tests/profile-ui.spec.js`와 `mydocs/orders/20260813.md`를 최신 `devel` 기준으로 재결합해야 한다.

### 후속 작업 후보

- #100 README 카드 고정 URL의 대표 설정 자동 반영
- #101 X·LinkedIn 소셜 미리보기 revision 경로 캐시 갱신 실험
- #84 release gate에서 최신 `devel` production 후보 재검증 및 배포

## 작업지시자 승인 요청

- 작업지시자가 최신 `devel` 반영, 전체 검증, 최종 보고서와 PR 게시를 승인했으므로
  `publish/task99` push와 `devel` 대상 Open PR 생성으로 진행한다.
