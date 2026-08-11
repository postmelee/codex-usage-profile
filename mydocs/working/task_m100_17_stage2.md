# Task M100 #17 Stage 2 보고서

GitHub Issue: [#17](https://github.com/postmelee/codex-usage-profile/issues/17)
구현계획서: [`task_m100_17_impl.md`](../plans/task_m100_17_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 만든 device login domain model을 HTTP API로 노출했다. CLI가 device login을 시작하고, 브라우저 session을 가진 사용자가 user code를 승인하며, CLI가 device code로 poll해 raw CLI token을 한 번만 수령할 수 있는 route contract를 구현하는 것이 목적이었다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/http.js` | `POST /api/auth/device`, `POST /api/auth/device/authorize`, `POST /api/auth/device/poll` route 추가, device start/poll serializer 추가, legacy CLI start 응답에 device fields 추가 |
| `src/profile-backend/__tests__/http.test.js` | device start/authorize/poll happy path, missing session, expired poll 테스트 추가 |
| `mydocs/orders/20260614.md` | 2026-06-14 작업 보드 생성 및 #17 Stage 2 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. 기존 `/api/cli/login/*`, GitHub OAuth callback, snapshot submit/public lookup route는 유지했다. 새 `/api/auth/device*` route는 추가 방식으로 구현했고, challenge serializer는 raw device code digest를 노출하지 않는다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-backend/__tests__/http.test.js
git diff --check
```

결과:

- OK: `http.test.js` 12개 테스트 통과
- OK: `git diff --check` 경고 없음

## 잔여 위험

- `/device` 승인 화면은 아직 없다. Stage 3에서 route/client/UI를 연결해야 한다.
- Stage 2는 backend API contract 중심이라 실제 브라우저에서 anonymous 사용자가 GitHub login 후 `/device`로 복귀하는 UX는 Stage 3에서 검증한다.

## 다음 단계 영향

- Stage 3은 `POST /api/auth/device/authorize`를 호출하는 최소 승인 UI를 만들면 된다.
- UI는 start 응답의 `verificationUriComplete`가 `/device?user_code=...` 형태임을 전제로 user code query를 읽을 수 있다.
- CLI 구현(#5)은 `POST /api/auth/device`와 `POST /api/auth/device/poll`을 사용하면 된다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 minimal device approval UI로 진행한다.
