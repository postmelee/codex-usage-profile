# Task #99 Stage 4 보고서 — 최근 업데이트 통합 검증 handoff

GitHub Issue: [#99](https://github.com/postmelee/codex-usage-profile/issues/99)
구현계획서: [`task_m100_99_impl.md`](../plans/task_m100_99_impl.md)
Stage: 4

## 단계 목적

Home, owner Profile, public Profile에 연결한 최근 업데이트 시각이 최신 `devel`과
결합된 상태에서도 locale, mobile, theme, reduced motion 및 기존 카드·공유 흐름을
회귀시키지 않는지 통합 검증한다. production Sites artifact와 LAN/mobile 시나리오까지
확인해 PR 게시 근거를 완성한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/HomePage.jsx` | 업데이트 문구가 없는 초기 상태에도 고정 높이 slot을 유지해 인증 정보 준비 전후 Home 카드 하단 layout 이동 방지 |
| `src/styles.css` | Home update slot의 16px 기하와 표시 문구의 block layout 고정 |
| `tests/profile-ui.spec.js` | Home slot 유지, public Profile 한국어 시맨틱 시각, 최신 `devel`의 공유 URL 계약과 결합 회귀 검증 |
| `mydocs/working/task_m100_99_stage4.md` | 전체 자동 검증과 LAN/mobile 확인 결과 기록 |
| `mydocs/report/task_m100_99_report.md` | Task #99 수용 기준과 단계별 결과 종합 |
| `mydocs/orders/20260813.md` | Task #99 완료 상태와 완료 시각 기록 |

## 본문 변경 정도 / 본문 무손실 여부

- Stage 1–3의 `usage.uploadedAt` 기준, locale formatter, `<time datetime>` 계약은 유지했다.
- Home은 문구가 없을 때도 16px slot만 예약하며 접근성 트리에 빈 콘텐츠를 추가하지 않는다.
- API·DB·migration·card PNG·social image·OG metadata는 변경하지 않았다.
- 최신 `devel`의 Task #102 공유 URL·E2E origin 보정을 merge commit으로 결합했고,
  공용 오늘할일 파일은 #99와 #102 행을 모두 보존했다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
npx playwright test tests/profile-ui.spec.js --browser=webkit --grep "Task #99" --workers=1
git diff --check
git status --short
```

결과:

- OK — 전체 Node 테스트 787개 중 781개 통과, 환경 의존 6개 skip, 실패 0
- OK — 전체 Playwright E2E 100/100 통과
- OK — Task #99 WebKit 집중 회귀 6/6 통과
- OK — production server/client artifact build 통과
- OK — Sites full-stack artifact 검증 `ok: true`, migration 5개·client 8개 확인
- OK — local full-stack smoke 50 route 통과, public PNG 84,939 bytes 확인
- OK — `git diff --check` 공백 오류 없음
- OK — LAN Home·owner/public Profile 접근과 mobile 표시를 작업지시자가 직접 확인
- OK — 임시 LAN OAuth callback을 loopback callback으로 복구하고 검증 서버 종료

## 잔여 위험

- 작업 당시 GitHub 원격 `devel`은 PR #103(Task #102)까지 확인됐다. 별도 worktree의
  #100·#101 변경이 이후 병합되면 `tests/profile-ui.spec.js`와
  `mydocs/orders/20260813.md`의 양쪽 계약을 다시 보존해야 한다.
- 실제 Sites 배포와 production 공개 전환은 Task #99 범위가 아니며 후속 release gate에서 수행한다.

## 다음 단계 영향

- Task #99 최종 보고서와 PR을 게시한 뒤 CI 통과와 작업지시자 merge 승인을 기다린다.
- 후속 release 작업은 Task #99 PR과 진행 중인 관련 worktree의 병합 순서를 반영해
  최신 `devel`에서 production 검증을 다시 수행한다.

## 승인 요청

- 작업지시자의 “전체 검증 재실행 → 최종 보고서와 PR 게시” 지시에 따라
  최종 보고서·게시 커밋·PR 생성 절차로 진행한다.
