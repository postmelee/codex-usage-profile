# Task M100 #17 Stage 4 보고서

GitHub Issue: [#17](https://github.com/postmelee/codex-usage-profile/issues/17)
구현계획서: [`task_m100_17_impl.md`](../plans/task_m100_17_impl.md)
Stage: 4

## 단계 목적

Stage 1~3에서 구현한 device-code login API와 승인 UI의 보안 경계 조건을 테스트로 고정했다. raw device code, raw CLI token, token digest, device code digest가 의도하지 않은 응답과 저장 상태에 노출되지 않는지 확인하고, invalid/duplicate/expired/unknown code 흐름을 안정적인 에러 contract로 검증하는 것이 목적이었다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/__tests__/security.test.js` | device login 보안 회귀 테스트 추가. raw secret 노출 범위, challenge/tokenRecord serializer, duplicate/expired/invalid/unknown code 응답 검증 |
| `mydocs/orders/20260614.md` | #17 Stage 4 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

테스트 보강 작업이다. 런타임 코드, API route, UI 동작은 변경하지 않았다. 기존 forbidden secret detector 테스트는 유지하고, device login API 응답과 store export 상태에 대한 회귀 테스트만 추가했다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-backend/__tests__/security.test.js
npm test
npm run build
git diff --check
```

결과:

- OK: `security.test.js` 7개 테스트 통과
- OK: 전체 테스트 146개 통과
- OK: production build 성공
- OK: `git diff --check` 경고 없음
- OK: raw device code는 start 응답의 top-level `deviceCode`로만 노출되고 serialized challenge/store export에는 남지 않음
- OK: raw CLI token은 최초 approved poll 응답에서만 노출되고 reused poll 응답과 store export에는 남지 않음
- OK: serialized challenge/tokenRecord에 `deviceCodeDigest`, `tokenDigest`, raw token-like field가 포함되지 않음
- OK: invalid user code, duplicate approval, expired authorization, unknown device code poll이 stable error code로 응답함

## 잔여 위험

- 실제 GitHub OAuth provider와 브라우저 session을 포함한 end-to-end 로그인은 로컬 테스트 fixture 범위를 넘어선다. PR 전후 환경 변수와 GitHub OAuth app 설정이 준비된 환경에서 수동 검증이 필요하다.
- CLI submit 구현은 #5 범위다. 이번 단계는 CLI가 사용할 인증 API의 서버/UI 전제 조건만 완료했다.

## 다음 단계 영향

- #17의 구현 단계는 완료되었다. 다음 절차는 최종 보고서 작성, 오늘할일 완료 처리, `publish/task17` PR 생성이다.
- #5 CLI submit 연동은 `POST /api/auth/device`, `/api/auth/device/authorize`, `/api/auth/device/poll` contract를 사용할 수 있다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 최종 보고서/PR 게시 절차로 진행한다.
