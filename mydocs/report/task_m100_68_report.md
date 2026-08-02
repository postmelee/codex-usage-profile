# Task M100 #68 최종 보고서

GitHub Issue: [#68](https://github.com/postmelee/codex-usage-profile/issues/68)
마일스톤: M100

## 작업 요약

- 대상 이슈: #68
- 마일스톤: M100
- 단계 수: 4개 Stage와 Stage 3.1 시각 보정 1회
- 작업 목적: 브라우저 locale을 단일 진실 원천으로 사용해 활성 웹 UI의 영어·한국어
  문구, formatter, 접근성 이름과 카드 공유 locale을 일치시킨다.

신규 국제화 dependency나 수동 언어 선택기를 추가하지 않고 저장소 내부의 경량 message
catalog·formatter·React Provider를 구현했다. `ko-*` 브라우저는 한국어, 그 밖의 언어는
영어를 사용하며 실행 중 `languagechange`도 UI와 `<html lang>`에 함께 반영한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/messages.js` | 동일한 230개 ID를 가진 영어 기준·한국어 message catalog와 안전한 fallback 정의 | 활성 웹 UI 문구·상태·접근성 이름 |
| `src/profile-ui/i18n.js`, `LocaleProvider.jsx` | browser locale resolver, message 보간, formatter cache, `languagechange`, `<html lang>` 동기화 | product와 Sites React root의 전역 locale 상태 |
| `src/main.jsx`, `src/profile-marketing/sites-entry.jsx` | 첫 React 렌더 전에 locale을 결정하고 같은 값으로 Provider 초기화 | 초기 언어 깜빡임 방지, product/Sites 진입점 일치 |
| `src/profile-ui/*.jsx`, `src/profile-marketing/MarketingLanding.jsx` | Home, menu/shell, Settings, device approval, owner/public Profile, heatmap, Share Studio 문구 이관 | visible text, loading·empty·error, 버튼·tooltip·ARIA |
| `src/profile-ui/accountUi.js`, `deviceApproval.js`, `formatters.js`, `heatmap.js`, `cardShare.js`, `shareStudio.js` | 공통 locale adapter와 날짜·숫자·token·기간 formatter 연결 | 순수 helper API와 카드/share locale 계약 유지 |
| `src/profile-ui/__tests__/*.test.js`, `src/profile-marketing/__tests__/*.test.js`, `tests/profile-ui.spec.js` | en/ko/fallback, catalog parity, formatter, 전체 활성 route와 동적 언어 변경 회귀 검증 | 단위·통합·접근성·E2E 안전망 |
| `src/styles.css` | owner Profile 상태 안내를 기존 content 상단 기준선에 정렬 | anonymous/loading/unavailable/empty 상태의 시각 일관성 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/`, `mydocs/orders/`의 Task #68 문서 | 승인 범위, 단계 결과, 통합 검증과 잔여 위험 기록 | Hyper-Waterfall 작업 추적 |

전체 Task diff는 43개 파일, 2,834줄 추가, 507줄 삭제다. backend, D1/R2, CLI,
card renderer, package·lockfile, static asset과 `.openai/hosting.json`은 변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_68.md`, `task_m100_68_impl.md` | OK | 승인된 설계·Stage·제외 범위를 내부 작업 문서로 기록 |
| 단계 보고서 | `mydocs/working/` | `task_m100_68_stage1.md`~`stage4.md`, `stage3_1.md` | OK | 각 단계 구현과 검증을 단계 커밋에 포함 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_68_report.md` | OK | 전체 수용 기준과 잔여 위험을 장기 보관 |
| 공식 제품 문서 | 변경 없음 | 해당 없음 | OK | 자동 감지 기능이며 새 명령·사용자 설정·공개 API가 없음 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 전역 지원 locale | 화면별 고정 문자열·독립 adapter | `en`, `ko`와 영어 fallback 1개 경로 |
| message catalog | 전역 catalog 없음 | 영어 230 ID·한국어 230 ID, parity·빈 값 검사 |
| React locale bootstrap | 없음 | product·Sites 2개 entry에서 mount 전 동기화 |
| 동적 브라우저 언어 반영 | 없음 | `languagechange`에서 UI·formatter·`html lang` 동시 갱신 |
| 전체 E2E | Task 시작 전 46건 | 56/56 통과 |
| 전체 Node 검증 | Task 시작 전 540건 | 550건 중 544 통과·환경 의존 6 skip·실패 0 |
| 변경량 | 해당 없음 | 43개 파일, +2,834/-507줄 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| `ko-KR`에서 활성 UI와 접근성 문자열이 한국어로 일치 | OK — Home, Sites onboarding, Settings, device approval, owner/public Profile, heatmap, Share Studio E2E 통과 |
| `en-US`와 미지원 locale이 영어와 안전한 fallback 사용 | OK — `ja-JP`/`fr-FR`로 모든 활성 route를 순회하고 영어 문구·`html lang=en` 확인 |
| message key 누락·빈 값·ID 직접 노출 방지 | OK — 영어·한국어 230 ID parity, 문자열·비어 있지 않음, unknown ID generic fallback 단위 테스트 통과 |
| 브라우저 언어 변경 시 UI·formatter·문서 언어 동기화 | OK — Profile 문구, compact token, 날짜 tooltip, 카드 URL과 `<html lang>` 동시 변경 확인 |
| heatmap·summary·Share Studio·card/share locale 일치 | OK — 영어 기본과 한국어 `?locale=ko`, exact token, 날짜·월, 공유 URL E2E 통과 |
| 고유명사·사용자 데이터·CLI 명령 유지 | OK — Codex/GitHub/README/소셜 서비스명, owner identity, submit 명령 계약 유지 |
| 인증·공개·device·share 기능 회귀 없음 | OK — Playwright 56/56 통과 |
| backend/API/storage/CLI/renderer/hosting manifest 무변경 | OK — 제한 경로 diff 빈 출력 |
| production artifact 유효, 원격 배포 없음 | OK — full-stack·production verifier `ok: true`; 배포·공개 설정 변경 없음 |
| 최종 정적 검증 | OK — `git diff --check` 통과 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_68_stage1.md): locale resolver, catalog, formatter,
  Provider와 두 entry의 초기 `html lang` 계약 구현
- [Stage 2](../working/task_m100_68_stage2.md): 공통 shell, Home/Sites onboarding,
  Settings와 device approval 이관
- [Stage 3](../working/task_m100_68_stage3.md): owner/public Profile, heatmap,
  formatter, Share Studio와 카드 locale 통합
- [Stage 3.1](../working/task_m100_68_stage3_1.md): 로컬 시각 검토에서 발견한 Profile
  상태 안내의 상단 정렬 보정
- [Stage 4](../working/task_m100_68_stage4.md): 활성 import graph literal 감사,
  fallback·동적 locale E2E와 Sites production artifact QA

최종 통합 검증 결과:

- `npm test`: 550건 중 544 통과, 환경 의존 6건 skip, 실패 0
- `npm run test:e2e`: 56/56 통과
- `npm run build`: 1,819 modules transformed
- `npm run build:sites`: 25 modules transformed
- `npm run build:production`: server 48·client 1,819 modules transformed
- `npm run verify:sites-fullstack`: `ok: true`
- `npm run verify:sites-production`: `ok: true`, artifact 5,602,286 bytes

## 잔여 위험과 후속 작업

### 잔여 위험

- 영어·한국어 외 browser locale은 승인된 정책에 따라 영어로 fallback한다.
- PostgreSQL `TEST_DATABASE_URL` 미설정 5건과 S3 `TEST_S3_*` 미설정 1건은 외부
  통합 환경에서만 실행되며 이번 frontend locale 변경 경로와 무관하다.
- 비활성 `src/profile-ui/ProfilePage.jsx`의 이전 raw 문구는 활성 import graph에 없어서
  변경하지 않았다. 다시 사용하려면 공통 Provider·catalog 계약을 먼저 적용해야 한다.
- production Sites에 배포하지 않았으므로 실제 호스팅 반영은 별도 승인된 배포 절차가 필요하다.

### 후속 작업 후보

- [#69](https://github.com/postmelee/codex-usage-profile/issues/69) — system·light·dark
  테마 토큰과 전환 구현

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인했으므로 `publish/task68` 게시와 `devel`
  대상 PR을 생성한다. merge는 작업지시자가 직접 승인한다.
