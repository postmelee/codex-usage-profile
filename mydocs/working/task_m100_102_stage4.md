# Task #102 Stage 4 보고서 — X 본문·링크 개행 보완

GitHub Issue: [#102](https://github.com/postmelee/codex-usage-profile/issues/102)
구현계획서: [`task_m100_102_impl.md`](../plans/task_m100_102_impl.md)
Stage: 4

## 단계 목적

owner-only Sites 실기기 확인에서 X 작성창이 별도 `text`, `url` query를 공백으로 합치는
결과를 확인했다. X Web Intent의 단일 `text`에 공유 문구, LF 1개, profile URL을 포함해
본문과 링크의 줄 구분을 애플리케이션이 직접 결정하도록 보완한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/shareStudio.js` | X target을 단일 `text` query로 바꾸고 문구와 링크 사이에 LF 1개 삽입 |
| `src/profile-ui/__tests__/shareStudio.test.js` | decoded text, raw `%0A`, 별도 `url` 부재 계약 추가 |
| `tests/profile-ui.spec.js` | 실제 Share Studio X href의 문구·LF·링크와 raw 직렬화 검증 |
| `mydocs/plans/task_m100_102_impl.md` | Stage 4 범위·완료 조건·배포 경계 추가 |
| `mydocs/orders/20260813.md` | Stage 4 진행 상태 반영 |
| `mydocs/report/task_m100_102_report.md` | 네 번째 단계와 X separator 결과 반영 |

## 본문 변경 정도 / 본문 무손실 여부

X target query 조합만 최소 수정했다. X origin·path, 공유 문구와 profile URL 자체,
Threads·LinkedIn·Facebook·Reddit query, 모바일 target 필터, Save와 layout은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js
PROFILE_E2E_ORIGIN=http://127.0.0.1:5193 npx playwright test tests/profile-ui.spec.js --grep "Share Studio|Share card dialog"
npm test -- --test-concurrency=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5195 npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- OK — Share Studio 단위 테스트 9/9 통과.
- OK — Share Studio 집중 Playwright 15/15 통과.
- OK — 전체 Node 779개 중 773 pass, 6 environment skip, 0 fail.
- OK — 전체 Playwright 96/96 통과.
- OK — Sites production client 1,831 modules와 Worker build 성공.
- OK — full-stack/production artifact 검증 모두 `ok: true`, migration 5개와 binding 3개 유지.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- URL query에는 LF가 `%0A`로 보존되지만 설치된 X 앱 버전이 작성창에서 이를 다시
  정규화할 가능성은 외부 provider 경계다. owner-only 재배포 후 iOS X 앱에서 한 번 더
  확인해야 한다.

## 다음 단계 영향

- 이 Stage 커밋을 `publish/task102`와 Sites source `main`에 push하고, 같은 SHA에서 만든
  artifact만 owner-only Sites에 저장·배포한다.
- PR merge와 Issue close는 작업지시자의 재확인 뒤 별도 승인으로 진행한다.

## 승인 요청

- 작업지시자가 요청한 구현·배포 범위에 따라 Stage 4 커밋을 owner-only Sites에 배포한다.
