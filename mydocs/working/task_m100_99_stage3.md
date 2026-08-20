# Task #99 Stage 3 보고서 — Profile 최근 업데이트와 Skeleton 정합

GitHub Issue: [#99](https://github.com/postmelee/codex-usage-profile/issues/99)
구현계획서: [`task_m100_99_impl.md`](../plans/task_m100_99_impl.md)
Stage: 3

## 단계 목적

owner, public, private-owner-preview Profile이 공유하는 header 경로에 최근 업데이트 시각을
연결하고, loading Skeleton의 세 번째 행과 ready update slot의 높이·간격을 맞춘다.
유효하지 않은 timestamp에서도 빈 slot의 기하만 유지하고 문구를 위조하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/AccountUsageProfile.jsx` | 공통 Profile header에 `usage.uploadedAt` 전달 |
| `src/profile-ui/ProfileHeader.jsx` | 이름·handle 아래 안정적인 update slot과 공통 `LastUpdatedTime` 연결 |
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | ready slot과 대응하는 세 번째 shimmer 행 추가 |
| `src/profile-ui/PublicProfilePage.jsx` | private-owner-preview 로딩 분기의 미정의 컴포넌트 참조를 공통 `ProfileLoadingSkeleton` 호출로 보정 |
| `src/styles.css` | ready/Skeleton update 행 높이·간격, tertiary typography, semantic theme transition 정합 |
| `src/profile-ui/__tests__/lastUpdatedTime.test.js` | valid/invalid timestamp에서 Profile update slot markup 계약 검증 |
| `tests/profile-ui.spec.js` | owner/public loading→ready 기하, public·private-preview timestamp 표시 검증 |
| `mydocs/orders/20260813.md` | Task #99를 Stage 3 완료·Stage 4 진행 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

- owner/public/private-owner-preview가 모두 기존 `AccountUsageProfile → ProfileHeader` 경로를
  사용하므로 페이지별 update 문구 복제 없이 한 번만 연결했다.
- 기존 profile header, stats, activity, card 좌표 계약은 Skeleton과 ready 양쪽에 동일한
  세 번째 행을 추가해 보존했다.
- invalid timestamp는 `<time>` 없이 `profile-last-updated-slot`의 최소 높이만 유지한다.
- private-owner-preview 로딩 중 존재하지 않는 `PublicProfileLoadingSkeleton`을 참조하던 경로는
  이미 사용 중인 공통 Skeleton에 동일 public locale 문구를 전달하도록 수정했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/lastUpdatedTime.test.js src/profile-ui/__tests__/profileRoutes.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js src/profile-ui/__tests__/theme.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #99.*Profile" --workers=1
git diff --check
```

결과:

- OK — component SSR, owner/public route, theme 단위 테스트 21개 통과
- OK — Task #99 Profile Playwright 3개 통과
- OK — owner loading Skeleton의 update placeholder와 ready `<time>` 기하 정합
- OK — public loading→ready에서 `datetime="2026-06-11T00:01:00.000Z"` 표시
- OK — private-owner-preview가 공통 loading Skeleton을 거쳐 같은 update slot 사용
- OK — 기존 profile geometry 비교의 모든 측정 항목이 top·height 2px 허용치 이내
- OK — `git diff --check` 공백 오류 없음

## 잔여 위험

- 전체 Node·Playwright 및 production artifact 검증은 Stage 4에서 실행해야 한다.
- 실제 사용자 환경의 locale·timezone, mobile Safari/Chrome 표시는 LAN 로컬 서버에서 작업지시자가 확인해야 한다.

## 다음 단계 영향

- Stage 4는 Home과 Profile의 ko/en, light/dark, reduced-motion 및 기존 share/card 흐름 전체 회귀를 검증한다.
- production Sites artifact가 API·DB·migration·card media 계약을 바꾸지 않았는지 verifier로 확인한다.
- 통합 검증 후 LAN 접속 가능한 로컬 runtime을 실행해 작업지시자 확인 URL을 제공한다.

## 승인 요청

- 작업지시자의 연속 진행 지시에 따라 Stage 4 — 통합 회귀·production artifact 검증 진입이 승인되었다.
