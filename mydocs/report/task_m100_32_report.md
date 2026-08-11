# Task M100 #32 최종 보고서

GitHub Issue: [#32](https://github.com/postmelee/codex-usage-profile/issues/32)
마일스톤: M100

## 작업 요약

- 대상 이슈: #32
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: production `/u/:handle`을 Account Usage Contract v1과 GitHub identity를 사용하는 card 중심 공개 프로필로 전환하고, public HTML·JSON·PNG의 공개 조건과 갱신 경계를 일치시킨다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-card/service.js` | owner와 latest Account Usage를 함께 검증하는 public profile resolver 추가 | public JSON·PNG 공통 공개 조건 |
| `src/profile-backend/http.js` | 익명 `GET /api/profiles/public/:handle`과 명시적 response allowlist 추가 | public profile API, 비공개·누락 fail-closed 처리 |
| `src/profile-api/client.js` | public Account Usage profile client 추가 | frontend public profile 조회 |
| `src/profile-ui/publicProfileRoutes.js` | loading·ready·unavailable 상태와 public profile loader 추가 | `/u/:handle` route state |
| `src/profile-ui/PublicProfilePage.jsx` | GitHub identity와 stable PNG를 표시하는 공개 card 화면 추가 | public profile UI |
| `src/App.jsx` | production public route를 Account Usage card 화면으로 전환 | application routing |
| `src/styles.css` | desktop·mobile·short viewport card와 frame 제약 추가 | public profile responsive UI |
| `src/profile-runtime/__tests__/dev-server.test.js` | submit·publish·public JSON/PNG·revision·private runtime 통합 회귀 추가 | store, runtime handler, cache 갱신 경계 |
| `src/profile-card/__tests__/service.test.js`, `src/profile-backend/__tests__/http.test.js`, `src/profile-backend/__tests__/security.test.js` | 공개 조건, allowlist와 내부 메타데이터 비노출 검증 추가 | backend·security regression |
| `src/profile-api/__tests__/client.test.js`, `src/profile-ui/__tests__/publicProfileRoutes.test.js`, `tests/profile-ui.spec.js` | public client, route state, desktop·mobile·short viewport E2E 추가 | frontend·browser regression |
| `README.md`, `docs/readme-card.md` | current Account Usage public HTML·JSON·PNG와 stable card URL 문서화 | 사용자·공개 card 문서 |
| `docs/usage-snapshot-v2.md`, `docs/codex-usage-analyzer.md`, `docs/cli-submit.md` | current Account Usage와 legacy UsageSnapshot v2 책임 경계 정리 | 호환 계약·통합 문서 |
| `mydocs/plans/task_m100_32.md`, `mydocs/plans/task_m100_32_impl.md` | 수행계획서와 구현계획서 작성 | 작업 계획 |
| `mydocs/working/task_m100_32_stage1.md` ~ `stage4.md` | 단계별 완료 보고 | 작업 기록 |
| `mydocs/report/task_m100_32_report.md` | 최종 보고서 | 작업 기록 |
| `mydocs/orders/20260713.md`, `20260715.md`, `20260716.md`, `20260717.md` | 작업 진행과 완료 상태 기록 | 오늘할일 보드 |

## 문서 위치 검증

새 공식 문서 루트를 만들지 않고 기존 `README.md`와 `docs/` 문서를 현재 production 계약에 맞게 수정했다. 작업 계획·단계 보고·최종 보고는 Hyper-Waterfall 지정 위치를 유지했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| public route와 README card 안내 | `README.md`, `docs/readme-card.md` | 동일 | OK | 기존 사용자 문서의 현행 동작만 갱신 |
| legacy snapshot 계약 | `docs/usage-snapshot-v2.md` | 동일 | OK | 기존 호환 계약 문서에서 production 미사용 경계 명시 |
| analyzer·CLI 통합 안내 | 기존 `docs/` 문서 | `docs/codex-usage-analyzer.md`, `docs/cli-submit.md` | OK | 기존 공식 통합 문서의 계약 표현만 최소 수정 |
| 수행·구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_32.md`, `task_m100_32_impl.md` | OK | 계획 문서 위치와 일치 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_32_stage{1..4}.md` | OK | 단계 기록 위치와 일치 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_32_report.md` | OK | 최종 기록 위치와 일치 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| production `/u/:handle` 데이터 경계 | sample·legacy UsageSnapshot v2 기반 full profile | public Account Usage API와 stable PNG 기반 card profile |
| public HTML·JSON·PNG 공개 조건 | HTML과 PNG의 조회 경계가 분리됨 | owner, latest usage, visibility, handle 일치를 공유 |
| public JSON 응답 | Account Usage 전용 endpoint 없음 | GitHub 표시 정보, 공개 usage, visibility, stable card URL만 allowlist 반환 |
| private·missing·invalid 외부 상태 | 경로별 처리 차이 가능 | identity 없는 동일 unavailable UI와 safe `404` |
| submit 갱신 통합 회귀 | endpoint별 단위 검증 | exact retry와 changed submit의 JSON·ETag·PNG 동기 갱신 검증 |
| 전체 Node 테스트 | 기준 `devel` 회귀 세트 | public API·route·runtime 회귀를 포함해 270건 통과 |
| 전체 Playwright 시나리오 | 5건 | 9건 통과 |
| 변경 규모 | 기준 branch `devel` | 최종 보고서 작성 직전 28 files, 1,911 insertions, 198 deletions |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| `/u/:handle`은 Account Usage Contract v1과 GitHub identity만 사용한다. | OK — production route에서 sample snapshot과 legacy full-profile selector import 제거, public API 기반 card UI 적용 |
| public HTML·JSON·PNG는 같은 공개 조건을 사용한다. | OK — 공유 service resolver와 runtime 통합 테스트에서 owner·latest usage·visibility·handle 일치 검증 |
| 공개 응답은 저장소 내부 식별자와 credential 메타데이터를 노출하지 않는다. | OK — explicit allowlist와 backend·DOM security 회귀 통과 |
| private, missing, malformed, mismatch는 identity를 노출하지 않는다. | OK — 동일 safe `404`와 unavailable UI 확인 |
| 같은 image URL은 새 submit 뒤 최신 PNG를 반환한다. | OK — changed submit에서 capture/summary, ETag와 PNG bytes 갱신 확인 |
| exact retry는 불필요한 card revision 변경을 만들지 않는다. | OK — `unchanged`, 기존 ETag와 `304` 유지 확인 |
| desktop, mobile, short viewport에서 card가 frame을 넘지 않는다. | OK — 1280x900, 390x844, 1280x620 Playwright 시각 검증 통과 |
| `npm test`, production build, Playwright와 `git diff --check`가 통과한다. | OK — Node 270건, build 31 modules, Playwright 9건 통과 |

### 단계별 검증 결과

- Stage 1: profile-card service 9건, backend HTTP·security 39건, durable store 4건, 전체 Node 263건 통과
- Stage 2: API·public route 집중 검증, production build, public E2E 4건, 전체 Node 269건, 전체 Playwright 9건 통과
- Stage 3: production legacy import·낡은 문구 검색 결과 정리, 전체 Node 269건, production build 통과
- Stage 4: runtime 집중 6건, 전체 Node 270건, production build 31 modules, 전체 Playwright 9건, desktop·mobile·short viewport 시각 검증 통과
- 최종 재검증: `npm test` 270건, `npm run build` 31 modules, 격리 포트 Playwright 9건, `git diff --check` 통과

## 잔여 위험과 후속 작업

### 잔여 위험

- 실제 GitHub OAuth credential을 task worktree로 복사하지 않아 이번 task에서 live OAuth 로그인을 반복하지 않았다. runtime 통합 검증은 synthetic owner/session/token을 사용했지만 production handler와 실제 PNG renderer를 통과했다.
- GitHub Camo와 배포 reverse proxy의 cache 지연, production HTTPS origin과 secure cookie는 로컬 환경에서 재현하지 않았다.
- legacy snapshot API와 compatibility UI module은 기존 소비자 보호를 위해 남겨 두었다. production entry에서는 사용하지 않는다.

### 후속 작업 후보

- landing/Quickstart onboarding을 별도 이슈로 등록해 GitHub 로그인과 CLI submit 흐름을 제품 첫 화면에 안내
- production deployment 환경에서 OAuth callback, `Secure` session cookie, public JSON·PNG와 GitHub Camo 갱신 smoke 수행
- legacy UsageSnapshot v2 소비자가 없음을 확인한 뒤 별도 제거 여부 결정

## 작업지시자 승인 요청

- 작업지시자가 최종 보고와 PR 게시 진행을 승인했다. 본 보고서를 최종 커밋한 뒤 `publish/task32`를 게시하고 `devel` 대상 non-draft PR의 review·merge 승인을 요청한다.
