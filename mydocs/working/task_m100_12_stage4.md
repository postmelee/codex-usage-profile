# Task M100 #12 Stage 4 보고서

GitHub Issue: [#12](https://github.com/postmelee/codex-usage-profile/issues/12)
구현계획서: [`task_m100_12_impl.md`](../plans/task_m100_12_impl.md)
Stage: 4

## 단계 목적

Stage 4의 목적은 Stage 3 HTTP runtime에 맞춰 frontend/API client가 session account 경계를 사용할 수 있게 만들고, GitHub OAuth/session/durable store 설정과 보안 주의점을 README에 정리하는 것이다. 기존 공개 프로필 화면과 Share-only 상단 UI는 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-api/client.js` | `/api/auth/me`, `/api/auth/logout`, GitHub login URL builder client method 추가 |
| `src/profile-api/__tests__/client.test.js` | session credential fetch, 401 anonymous 처리, logout, login URL 생성 테스트 추가 |
| `src/App.jsx` | 앱 시작 시 current account를 조회하고 profile 화면에 session 상태 경계 전달 |
| `src/profile-ui/ProfilePage.jsx` | `authState` prop을 `ProfileShell`로 전달 |
| `src/profile-ui/ProfileShell.jsx` | visible 메뉴 변경 없이 hidden session status와 `data-auth-status` 연결 |
| `README.md` | runtime configuration, MVP login/submit flow, OAuth/session/durable store 보안 안내 추가 |
| `mydocs/orders/20260611.md` | 날짜 변경 후 오늘할일 Stage 4 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드와 README 변경이다. 기존 profile render, public snapshot lookup, submit client contract는 유지했다. UI는 상단 우측 Share 단독 구성을 유지했고, session 상태는 보이는 메뉴나 버튼을 추가하지 않고 내부 상태와 접근성용 hidden text로만 연결했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
git diff --check
```

브라우저 확인:

```text
http://127.0.0.1:5173/u/meleeisdeveloping
```

결과:

- OK: 전체 `npm test` 102개 통과.
- OK: `npm run build` 통과.
- OK: `git diff --check` 통과.
- OK: 브라우저 확인에서 topbar action은 `Share` 1개만 표시됐다.
- OK: backend host adapter가 없는 Vite preview에서 `data-auth-status="unavailable"` 상태로 격리되고 profile ready 화면은 유지됐다.
- OK: 브라우저 console error log는 비어 있었다.

## 잔여 위험

- 실제 OAuth code exchange client와 host adapter env wiring은 아직 없다. README는 host adapter가 넘겨야 할 설정 이름과 목적만 명시한다.
- callback 이후 사용자 redirect/성공 화면은 아직 JSON envelope 수준이다. 사용자-facing login 완료 UX는 #5/#6 이후 별도 UI 단계에서 정리해야 한다.
- production DB, rate limit, CSRF review, backup policy는 Stage 5 최종 handoff 위험으로 남긴다.

## 다음 단계 영향

- Stage 5에서 full validation과 secret scan을 수행하고 #5 CLI, #6 README card endpoint가 이어받을 runtime contract를 정리한다.
- #5는 client의 GitHub login URL builder와 Stage 3 approve/exchange route를 기준으로 `npx ... submit` 로그인 흐름을 구현할 수 있다.
- #6은 README에 정리한 public/private visibility 경계를 기준으로 카드 이미지 URL과 Markdown snippet을 구현하면 된다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 통합 보안 검증과 MVP handoff로 진행한다.
