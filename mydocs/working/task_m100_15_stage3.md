# Task M100 #15 Stage 3 완료 보고

## 단계 목표

Stage 1의 settings token API를 frontend API client와 `/settings` 화면에 연결했다. 사용자는 Settings에서 token 목록을 보고, 새 token을 생성해 raw token을 한 번 확인하고, token을 revoke할 수 있다.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `src/profile-api/client.js` | `listSettingsTokens`, `createSettingsToken`, `revokeSettingsToken` 추가 |
| `src/profile-api/__tests__/client.test.js` | settings token client method와 validation 검증 추가 |
| `src/profile-ui/SettingsPage.jsx` | API Tokens section, create/list/revoke state, one-time token reveal/copy UX 추가 |
| `src/styles.css` | settings token form/list/reveal/action button responsive style 추가 |
| `mydocs/orders/20260614.md` | Stage 3 완료 상태 갱신 |

## 구현 내용

- `client.listSettingsTokens()`는 session credential로 `GET /api/settings/tokens`를 호출한다.
- `client.createSettingsToken({ label })`는 session credential로 `POST /api/settings/tokens`를 호출하고 raw token과 metadata를 반환한다.
- `client.revokeSettingsToken(tokenId)`는 session credential로 `DELETE /api/settings/tokens/:tokenId`를 호출한다.
- Settings authenticated view에 `API Tokens` panel을 추가했다.
- token create 성공 시 raw token은 `createdToken` state에만 보관하고, Copy action 후 state에서 제거한다.
- token list state에는 `tokenRecord` metadata만 보관한다.
- token row는 panel 안의 nested card가 아니라 border row 형태로 렌더링한다.
- 좁은 화면에서는 input/action, reveal/copy, token row가 세로 배치되도록 반응형을 보강했다.

## 검증

```bash
npm test -- src/profile-api/__tests__/client.test.js
```

결과:

- OK: 12개 테스트 통과
- OK: token list/create/revoke client request가 session credential을 사용함
- OK: token id와 token label validation 동작 확인

추가 검증:

```bash
npm run build
git diff --check
```

결과:

- OK: Vite production build 통과
- OK: whitespace 경고 없음

Runtime smoke:

```text
GET http://127.0.0.1:5177/settings -> 200 text/html
GET http://127.0.0.1:5177/api/auth/me -> 401 application/json; charset=utf-8
```

브라우저 시각 검증 한계:

- Playwright package는 설치되어 있으나 로컬 browser binary가 없어 screenshot 검증은 수행하지 못했다.
- 실제 authenticated UI는 GitHub OAuth session 또는 route mock이 필요하므로 Stage 5에서 가능한 범위로 다시 확인한다.
- 현재 runtime dev server는 `http://127.0.0.1:5177`에서 실행 중이다.

## 남은 작업

- Stage 4에서 Settings Devices UI를 Stage 2 backend route에 연결한다.
- Stage 5에서 전체 테스트, build, 가능 범위의 browser QA를 다시 수행한다.

## 다음 단계 승인 요청

Stage 4 — Settings Devices UI 진행 승인을 요청한다.
