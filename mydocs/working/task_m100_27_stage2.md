# Task M100 #27 Stage 2 완료 보고

GitHub Issue: [#27](https://github.com/postmelee/codex-usage-profile/issues/27)
구현계획서: [`task_m100_27_impl.md`](../plans/task_m100_27_impl.md)
Stage: 2

## 단계 목적

Settings API Tokens UI에서 Stage 1 backend 제한을 사용자가 생성 전에 이해할 수 있게 표시했다. 이번 단계의 목표는 active token 3개 상태에서 create action을 비활성화하고, backend 409 `conflict` 응답도 같은 제한 메시지로 처리하는 것이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-shared/tokenLimits.js` | frontend/backend가 공유하는 active CLI token 기본 제한 상수 추가 |
| `src/profile-backend/tokens.js` | 기존 backend export contract를 유지하면서 shared token limit 상수 re-export |
| `src/profile-ui/SettingsPage.jsx` | token count badge, limit reached 상태, create disabled guard, conflict error copy 추가 |
| `src/styles.css` | token count badge와 limit note 스타일 추가 |
| `src/profile-api/__tests__/client.test.js` | settings token 409 `conflict` response가 code/status/message로 전달되는지 검증 |
| `mydocs/orders/20260617.md` | Stage 2 완료 및 Stage 3 승인 대기 상태 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없음. 기존 settings token create/list/revoke flow와 one-time raw token reveal UX는 유지했다. 새 UI는 token list가 준비된 뒤 active token 수를 `0/3` 형태로 표시하고, 3개 이상이면 create button을 `Limit reached` 상태로 비활성화한다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-api/__tests__/client.test.js
npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js
npm run build
git diff --check
```

결과:

- OK: profile API client test 14개 통과
- OK: backend token/http regression test 26개 통과
- OK: Vite production build 성공
- OK: `git diff --check` whitespace 경고 없음

수동 smoke:

- OK: runtime dev server가 `http://127.0.0.1:5177`에서 실행되는 것 확인
- MISS: 자동화 탭에는 로그인 session cookie가 없어 authenticated Settings token panel까지는 확인하지 못함

## 잔여 위험

- authenticated browser session에서 active token 3개 상태의 실제 visual smoke는 아직 미확인이다. Stage 4 통합 QA에서 작업지시자 로그인 세션 또는 별도 test store로 확인한다.
- token limit metadata를 API response에 넣지 않았기 때문에 UI는 list 결과 길이를 active token 수로 사용한다. backend list가 revoked token을 제외하는 기존 contract를 유지해야 한다.

## 다음 단계 영향

- Stage 3에서는 settings mutation route의 session cookie 경계와 SameSite/CSRF 정책을 점검한다.
- Stage 4에서는 실제 Settings 화면에서 3개 제한, revoke 후 재생성, 반복 클릭 방지를 수동으로 확인해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 — SameSite/CSRF hardening review로 진행한다.
