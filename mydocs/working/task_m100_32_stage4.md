# Task M100 #32 Stage 4 완료 보고

GitHub Issue: [#32](https://github.com/postmelee/codex-usage-profile/issues/32)
구현계획서: [`task_m100_32_impl.md`](../plans/task_m100_32_impl.md)
Stage: 4

## 단계 목적

Account Usage Contract v1 공개 프로필의 production 경계를 실제 runtime handler, backend store, public JSON/PNG와 browser UI에서 통합 검증한다. submit revision, visibility, cache와 public response 보안이 서로 분리되지 않고 같은 owner와 latest usage를 사용하는지 확인한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/__tests__/dev-server.test.js` | 실제 memory store, session, CLI token과 runtime backend handler를 사용하는 submit·publish·public JSON/PNG·revision·private 통합 회귀 추가 |
| `tests/profile-ui.spec.js` | public route를 짧은 viewport 내부 스크롤 QA에 포함하고 공개 DOM 내부 식별자 비노출 검증 추가 |
| `mydocs/orders/20260716.md` | 당일 Task #32 Stage 4 진행 및 완료 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

production 구현과 사용자 화면 본문은 변경하지 않았다. Stage 1~3에서 확정한 runtime, API와 UI 계약을 자동화된 통합 테스트로 고정했으며 기존 Home, owner Profile, Settings, Share, public profile E2E를 보존했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-runtime/__tests__/dev-server.test.js
npm run test:e2e -- --grep "public profile|keeps Home Profile"
npm test
npm run build
npm run test:e2e
git diff --check
```

결과:

- PASS: runtime 집중 테스트 6건 통과
- PASS: private 상태의 public JSON과 PNG가 동일한 safe `404`를 반환
- PASS: publish 후 public JSON과 998x612 PNG가 같은 GitHub owner와 latest Account Usage를 사용
- PASS: public JSON에 owner id, provider user id, raw token, digest와 revision 미노출
- PASS: public PNG GET/HEAD의 ETag 일치와 body/cache 동작 확인
- PASS: exact retry는 `unchanged`와 기존 ETag의 `304`를 유지
- PASS: newer changed submit은 같은 card URL에서 JSON capture/summary, ETag와 PNG bytes를 갱신
- PASS: private 전환 후 public JSON과 PNG가 즉시 차단되고 missing handle과 같은 외부 응답 사용
- PASS: 전체 Node 테스트 270건 통과
- PASS: production build 성공, 31 modules transformed
- PASS: 전체 Playwright 9건 통과
- PASS: 1280x900 desktop, 390x844 mobile, 1280x620 short viewport screenshot 직접 확인
- PASS: public card aspect ratio, navigation, text clipping, frame 내부 scroll과 horizontal overflow 이상 없음
- PASS: public DOM에 storage id, provider id, digest, local path가 없음
- PASS: `git diff --check` 오류 없음

## 잔여 위험

- 실제 GitHub OAuth credential을 task worktree로 가져오지 않아 이번 단계에서 live OAuth 로그인을 다시 실행하지 않았다. 이 단계는 synthetic owner/session/token을 사용하되 production runtime handler와 실제 card renderer를 통과했다.
- GitHub Camo와 배포 reverse proxy의 cache 반영 시간은 로컬 runtime에서 재현할 수 없으므로 배포 smoke 범위로 남는다.
- legacy snapshot API와 compatibility UI module은 이번 task 범위에 따라 삭제하지 않았다.

## 다음 단계 영향

- 구현계획서의 Stage 1~4가 모두 완료됐다. 다음 절차는 최종 결과보고서 작성, 전체 변경 검토와 `devel` 대상 PR 게시다.
- 최종 보고에는 public Account Usage backend, card 중심 public route, legacy 경계 문서와 본 통합 QA 결과를 함께 요약한다.
- production 배포 전에는 실제 OAuth origin, HTTPS cookie와 GitHub Camo를 별도 환경에서 smoke 검증해야 한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 `task-final-report` 절차로 최종 보고서와 PR 게시를 진행한다.
