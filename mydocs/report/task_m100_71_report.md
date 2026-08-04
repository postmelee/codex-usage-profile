# Task M100 #71 최종 보고서 — locale 표시 계약 통합

GitHub Issue: [#71](https://github.com/postmelee/codex-usage-profile/issues/71)
연결 Issue: [#72](https://github.com/postmelee/codex-usage-profile/issues/72), [#73](https://github.com/postmelee/codex-usage-profile/issues/73)
마일스톤: M100

## 작업 요약

- 대상 이슈: #71, #72, #73
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: Codex 앱과 Profile의 숫자 축약 동작, Marketing locale custom copy source,
  Share Studio platform 보간과 공유 접근성 이름을 하나의 검증 가능한 locale 계약으로
  정리한다.

#71을 통합 대표 타스크로 사용하되 Stage 2·3·4를 각각 #71·#72·#73의 독립 구현
경계로 유지했다. #74 카드 theme customization, backend/API, CLI, card renderer와 production
배포는 승인된 제외 범위로 남겼다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/heatmap.js` | heatmap compact token 표시를 공용 locale formatter에 위임했다. | Profile daily·weekly·cumulative tooltip의 축약 표시 |
| `src/profile-ui/__tests__/formatters.test.js`, `src/profile-ui/__tests__/heatmap.test.js` | 영어·한국어·fallback compact 경계와 exact integer 보존을 고정했다. | formatter·heatmap 회귀 계약 |
| `src/profile-marketing/marketing-config.js` | caller가 명시한 key만 보존하는 immutable `copyOverrides`를 추가하고 Quickstart step을 id-only record로 정리했다. | Marketing config의 하위 호환 locale source 판별 |
| `src/profile-marketing/MarketingLanding.jsx` | 문자열 값 동등성 sentinel을 제거하고 key별 override/catalog resolver를 사용했다. | Marketing 영어·한국어 표시 문구 |
| `src/profile-marketing/__tests__/marketing-config.test.js`, `src/profile-marketing/__tests__/sites-config.test.js`, `src/profile-ui/__tests__/homeOnboarding.test.js` | 기본·partial·동일값 custom, Sites config와 Quickstart 순서를 검증했다. | Marketing·Sites config 회귀 계약 |
| `src/profile-ui/shareStudio.js`, `src/profile-ui/ShareStudio.jsx` | platform 포함 두 문구를 전용 helper에서 locale·target label로 한 번만 보간했다. | X·LinkedIn·Reddit instruction·composer 문구 |
| `src/profile-ui/messages.js`, `src/profile-ui/ProfileShell.jsx`, `src/profile-ui/CardProfilePage.jsx` | `Share profile`/`프로필 공유` 접근성 이름을 추가하고 표시 문구는 유지했다. | Profile Share 버튼 접근성 |
| `src/profile-ui/__tests__/shareStudio.test.js`, `src/profile-ui/__tests__/i18n.test.js`, `tests/profile-ui.spec.js` | 단일 보간, catalog parity, Profile 접근성 이름과 전체 locale 화면을 검증했다. | unit·browser E2E 회귀 계약 |
| `mydocs/plans/task_m100_71.md`, `mydocs/plans/task_m100_71_impl.md` | 세 이슈의 통합 범위, 단계, 문서 위치와 검증 계약을 기록했다. | 내부 수행·승인 근거 |
| `mydocs/working/task_m100_71_stage1.md`~`task_m100_71_stage5.md` | 단계별 조사·구현·검증·잔여 위험을 기록했다. | 내부 단계 추적 |
| `mydocs/report/task_m100_71_report.md` | 최종 수용 기준과 후속 작업을 장기 보관한다. | 내부 최종 보고 |

## 문서 위치 검증

제품·사용자·기여자·외부 통합·API·아키텍처·로드맵 문서는 변경하지 않았다. 이번 작업의
문서는 수행계획서가 정한 내부 승인·검증 산출물이며 실제 위치가 계획과 일치한다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현계획서 | `mydocs/plans/` | `mydocs/plans/` | OK | 세 이슈의 승인·실행 계약 |
| Stage 1~5 보고서 | `mydocs/working/` | `mydocs/working/` | OK | 단계별 검증 근거 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/` | OK | 장기 보관용 수용 기준 결과 |
| 제품 문서 | 해당 없음 | 해당 없음 | OK | 제품 계약·사용자 안내·API·아키텍처 변경 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| Profile compact formatter 구현 경로 | 공용 Intl formatter와 heatmap 수동 formatter 2개 | 공용 Intl formatter 1개 |
| Marketing custom copy 판별 | 기본 영어 문자열과 값 동등성 비교 | caller가 명시한 immutable override key map |
| Quickstart step의 locale 문구 source | step record와 catalog에 중복 가능 | id-only step과 locale catalog 1개 |
| Share Studio platform 보간 | placeholder 자기 치환 후 React 수동 치환 | 전용 formatter 1회 |
| Profile Share 접근성 이름 | 표시 문구 `Share`/`공유`와 동일 | `Share profile`/`프로필 공유`, 표시 문구 유지 |
| 전체 자동 검증 | 작업 전 기준 | Node 575건 중 569 통과·6 환경 skip, E2E 64/64 통과 |
| 변경 규모 | 해당 없음 | 25 files, 1,316 insertions, 104 deletions(계획·단계·최종 보고서 포함) |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| Codex locale-native compact 경계 동작을 Profile과 heatmap이 공유한다. | OK — 영어 `999,999 → 1M`, `999,999,999 → 1B`, 한국어 `1,000 → 1천`, `99,999,999 → 1억`, `999,999,999,999 → 1조` 및 fallback matrix 통과 |
| exact token count는 축약과 별도로 반올림 없이 유지한다. | OK — exact localized integer와 invalid input 회귀 test 통과 |
| Marketing은 명시 custom key만 override하고 누락 key는 현재 locale catalog를 사용한다. | OK — 기본·partial·전 key·기본값 동일 custom·invalid input unit 및 한국어 E2E 통과 |
| Quickstart는 id·순서·CTA와 sample-only/API 요청 없음 동작을 유지한다. | OK — id-only frozen record unit 및 Marketing E2E 통과 |
| Share Studio platform 문구는 영어·한국어에서 target label로 한 번만 보간된다. | OK — X·LinkedIn·Reddit instruction/composer 결과와 placeholder 부재 unit 통과 |
| Profile Share는 표시 문구·동작을 유지하면서 문맥이 분명한 접근성 이름을 제공한다. | OK — 영어·한국어 E2E와 keyboard·dialog·destination 회귀 통과 |
| production Sites artifact와 승인된 배포 형태가 유지된다. | OK — production build, full-stack verifier, production verifier 통과 |
| 승인된 제외 범위에 변경이 없다. | OK — package·lockfile, backend/API, CLI, card renderer, `.openai/hosting.json`, 배포 설정 diff 없음 |

### 단계별 검증 결과

- Stage 1: [`task_m100_71_stage1.md`](../working/task_m100_71_stage1.md) — 앱 version과 compact 경계 matrix, 세 이슈 구현 경계를 확정했다.
- Stage 2: [`task_m100_71_stage2.md`](../working/task_m100_71_stage2.md) — formatter·heatmap focused 12/12가 통과했다.
- Stage 3: [`task_m100_71_stage3.md`](../working/task_m100_71_stage3.md) — Marketing focused unit 17/17, E2E 3/3이 통과했다.
- Stage 4: [`task_m100_71_stage4.md`](../working/task_m100_71_stage4.md) — Share Studio focused unit 19/19, E2E 10/10이 통과했다.
- Stage 5: [`task_m100_71_stage5.md`](../working/task_m100_71_stage5.md) — Node 전체 575건 중 569 통과·6 환경 skip, E2E 64/64, production build와 두 Sites verifier가 통과했다.

최종 보고 절차에서 동일한 전체 Node·E2E·production build·두 artifact verifier를 다시
실행해 같은 결과를 확인했다. `git diff --check`도 통과했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- compact 결과는 JavaScript runtime의 ICU locale data에 의존한다. 경계 matrix가 지원
  runtime 변경 시 drift를 감지한다.
- `TEST_DATABASE_URL`과 test S3 환경이 없어 기존 PostgreSQL·S3 integration 6건은
  skip되었다. 이번 작업은 데이터 저장소·API·배포 설정을 변경하지 않았다.
- 원격 CI는 PR 게시 후 별도로 확인해야 한다.

### 후속 작업 후보

- [#74](https://github.com/postmelee/codex-usage-profile/issues/74) — Profile 카드
  customization과 light/dark R2 object·URL variant를 독립 타스크로 진행한다.
- #71·#72·#73 PR merge 후 production 배포와 MVP 공개 검증을 별도 승인 절차로 진행한다.

## 작업지시자 승인 요청

- 작업지시자는 Stage 5 결과 보고 후 같은 세션에서 최종 보고서 작성과 통합 PR 게시를
  명시적으로 승인했다. 본 보고서와 수용 기준 검증 결과를 기준으로 게시 절차를 진행한다.
