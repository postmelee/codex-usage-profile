# Task #102 최종 보고서 — 모바일 Share Studio SNS 대상과 공유 URL 보정

GitHub Issue: [#102](https://github.com/postmelee/codex-usage-profile/issues/102)
마일스톤: M100

## 작업 요약

- 대상 이슈: #102
- 마일스톤: M100 — v1.0 MVP
- 단계 수: 5
- 작업 목적: 모바일 실행 환경에서 안정적으로 작성 화면을 열지 못하는 Facebook·LinkedIn을
  제외하고 X·Threads·Reddit·Save를 한 줄로 제공하며, X 공식 Web Intent와 Threads 공백
  직렬화 문제를 보정하고 X 본문과 링크 사이의 단일 줄바꿈을 보장한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/shareStudio.js` | UA-CH 우선·UA/iPadOS fallback 모바일 판별, mobile target 필터, X `/intent/tweet` 단일 text의 LF 구분, Threads `%20` 직렬화 | SNS target 생성과 provider URL |
| `src/profile-ui/ShareStudio.jsx` | 첫 render에서 navigator 기반 판별 결과를 target builder에 전달 | Share Studio DOM·접근성·animation index |
| `src/styles.css` | 360px 이하 primary action 2열 override 제거 | 320px 이상 모바일 네 action 한 줄 layout |
| `src/profile-ui/__tests__/shareStudio.test.js` | navigator matrix, desktop/mobile 목록과 raw URL 인코딩 회귀 추가 | 순수 helper·provider 계약 |
| `tests/profile-ui.spec.js` | iPhone·Android·좁은 desktop target/layout 회귀, X path와 preview stale assertion 현행화 | 실제 브라우저 DOM·layout·기존 Share flow |
| `tests/e2eOrigin.js`, `tests/e2eOrigin.test.js` | 공용 loopback origin 정규화, worktree별 기본 port와 오류 계약 | 다중 worktree E2E 격리 |
| `playwright.config.js` | 공용 origin helper, spec-only discovery와 새 strict-port server로 다른 worktree source 재사용 차단 | Playwright discovery·server 생명주기 |
| `docs/readme-card.md` | desktop/mobile action 차이, 자동 입력 비보장, 공유 링크 fallback과 `저장` label 설명 | 공식 사용자 안내 |
| `mydocs/plans/task_m100_102*.md` | 수행·구현 계획과 단계별 수용 기준 | 내부 작업 근거 |
| `mydocs/working/task_m100_102_stage{1..5}.md` | 단계별 구현·검증·잔여 위험 | 내부 검증 추적 |
| `mydocs/orders/20260813.md` | 오늘할일 완료 시각 반영 | 내부 작업 보드 |
| `mydocs/report/task_m100_102_report.md` | 최종 결과와 수용 기준 검증 | 내부 최종 보고 |

## 문서 위치 검증

사용자에게 보이는 공유 대상과 provider 경계가 바뀌므로 수행계획서에서 선택한 기존 공식
사용자 문서 `docs/readme-card.md`만 최소 수정했다. README, 아키텍처·운영 문서와
`mydocs/manual`은 수정하지 않았다. 계획·단계·최종 보고서는 정해진 Hyper-Waterfall
산출물 위치를 사용했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 사용자 공유 안내 | `docs/readme-card.md` | `docs/readme-card.md` | OK | 기존 Share Studio 절의 대상·fallback 문장만 수정 |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_102*.md` | OK | 중앙 명명 규칙과 일치 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_102_stage{1..5}.md` | OK | 다섯 Stage 산출물과 일치 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_102_report.md` | OK | 중앙 최종 보고서 템플릿 적용 |
| README·아키텍처·운영 문서 | 변경 없음 | 해당 없음 | OK | 수행계획서 제외 범위와 diff 일치 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 모바일 primary action | X·Threads·LinkedIn·Facebook·Reddit·Save 6개, 4+2 또는 2열 wrap | X·Threads·Reddit·Save 4개, 320px 이상 한 줄 |
| 좁은 desktop primary action | 6개 | 320px·390px에서도 6개, 4+2 배치 유지 |
| 모바일 DOM·접근성 SNS target | 5개 | 3개; LinkedIn·Facebook 없음 |
| X 작성 path | `/intent/post` | 공식 `/intent/tweet` |
| X 본문·링크 separator | 별도 `text`, `url`을 X가 공백으로 결합 | 단일 `text` 안의 LF 1개를 raw `%0A`로 전달 |
| Threads 영어·한국어 공백 | raw query `+`, iOS 앱에서 literal plus 노출 | raw query `%20` |
| Threads 실제 plus | form 직렬화 혼동 위험 | `%2B` 보존과 decoded round-trip 검증 |
| Share Studio 단위 테스트 | 6개 | 9개, 9/9 통과 |
| E2E origin 계약 테스트 | 없음 | 3개, 3/3 통과 |
| Playwright 기본 server | 고정 5173, 기존 server 재사용 | worktree별 기본 port, 기존 server 재사용 안 함 |
| 전체 Node | Task #102 회귀 없음 | 782개 중 776 pass, 6 environment skip, 0 fail |
| 전체 Playwright | 모바일 환경 분기 전 95개 | 96/96 통과 |
| production build | 변경 후 증거 없음 | 1831 modules transformed, 성공 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| viewport가 아니라 실행 환경으로 모바일 판별 | OK — UA-CH boolean 우선, iPhone·iPod·iPad·Android UA와 MacIntel touch iPadOS fallback matrix 통과 |
| 모바일에서 Facebook·LinkedIn을 target/DOM에서 제거 | OK — iPhone·Android context 모두 link count 0, primary action 4개 |
| 좁은 desktop에서 기존 기능 유지 | OK — 320px·390px desktop UA에서 LinkedIn·Facebook 포함 6개와 4+2 배치 유지 |
| 모바일 네 action 한 줄·44px·overflow 없음 | OK — iPhone 390px와 Android 320px에서 top 편차 1px 이하, height 44px 이상, horizontal overflow 없음 |
| X 공식 composer URL과 본문·링크 개행 | OK — unit·E2E에서 `https://x.com/intent/tweet`, 단일 `text`, raw `%0A`, 별도 `url` 부재 확인 |
| Threads 영어·한국어 공백과 실제 plus 보존 | OK — raw `text`에 form space `+` 없음, `%20`과 `%2B` assertion 통과 |
| 기존 Reddit·Save·복사·privacy·motion 회귀 없음 | OK — focused 15/15와 전체 Playwright 96/96 통과 |
| E2E worktree 격리와 origin 정규화 | OK — config/spec 공용 helper, trailing slash·빈 값 계약, worktree별 port, server 재사용 차단 |
| Settings public handoff phase | OK — `data-share-preview-source="public"` 확인 뒤 same-origin 상대 target URL 검증 |
| 전체 제품·Sites 회귀와 build | OK — Node 782개 실패 0, Playwright 96/96, Vite build 성공, diff 경고 없음 |
| 공식 사용자 문서와 구현 일치 | OK — desktop/mobile action, provider 자동 입력 비보장·공유 링크 fallback, `저장` label 반영 |
| production/hosting 범위 보존 | OK — `.openai/hosting.json`, README, 운영·아키텍처 문서와 package/lockfile 변경 없음 |

### 단계별 검증 결과

- Stage 1: [`task_m100_102_stage1.md`](../working/task_m100_102_stage1.md) — 모바일 판별,
  desktop/mobile target 목록, X path와 Threads raw encoding 계약을 단위 테스트로 고정했다.
- Stage 2: [`task_m100_102_stage2.md`](../working/task_m100_102_stage2.md) — 실제 Share Studio
  연결과 iPhone 390px·Android 320px 한 줄, 좁은 desktop 6개를 Playwright와 스크린샷으로 확인했다.
- Stage 3: [`task_m100_102_stage3.md`](../working/task_m100_102_stage3.md) — 사용자 문서를
  현행화하고 Node 779·Playwright 96·production build 전체 회귀를 통과했다.
- Stage 4: [`task_m100_102_stage4.md`](../working/task_m100_102_stage4.md) — X의 별도
  `text`, `url`을 문구·LF·링크가 든 단일 `text`로 바꾸고 Node 779·Playwright 96과 Sites
  production artifact 전체 회귀를 통과했다.
- Stage 5: [`task_m100_102_stage5.md`](../working/task_m100_102_stage5.md) — PR 리뷰 8개
  정리 항목을 반영하고 공용 E2E origin·worktree server 격리, 320px desktop, Settings public
  handoff를 고정한 뒤 Node 782·Playwright 96과 Vite build 전체 회귀를 통과했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- Playwright mobile context는 UA·touch·viewport·DOM/layout과 raw X `%0A`를 검증하며,
  작업지시자가 owner-only iOS X 앱 작성창에서도 본문과 링크 사이 줄바꿈을 직접 확인했다.
  향후 provider 앱 버전 변화는 애플리케이션이 통제할 수 없는 경계로 남는다.
- provider 앱 버전과 로그인 상태에 따라 composer handoff 결과가 달라질 수 있다. 모바일에서
  Facebook·LinkedIn은 표시하지 않고 공유 링크 복사 fallback을 유지한다.
- owner-only Sites version 30은 exact Stage 4 source와 기존 environment·D1·R2 binding으로
  배포됐다. Stage 5는 test harness·문서·PR metadata만 바꾸므로 별도 배포하지 않는다.

### 후속 작업 후보

- [#101](https://github.com/postmelee/codex-usage-profile/issues/101) Stage 4는 #102 병합 뒤
  최신 `devel`을 반영하고 mobile target filter, X path, Threads spacing과 one-row layout을 보존한다.
- [#84](https://github.com/postmelee/codex-usage-profile/issues/84) production Gate는 #102의
  owner-only 실기기 확인과 PR merge 이후 exact candidate를 포함해 재검증한다.

## 작업지시자 승인 요청

- Stage 1~5와 전체 수용 기준, owner-only 실기기 확인, PR 리뷰 8개 반영을 완료한 ready PR을
  유지한다. merge와 Issue close는 작업지시자의 별도 승인으로 진행한다.
