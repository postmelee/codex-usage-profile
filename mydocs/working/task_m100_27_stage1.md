# Task M100 #27 Stage 1 완료 보고

GitHub Issue: [#27](https://github.com/postmelee/codex-usage-profile/issues/27)
구현계획서: [`task_m100_27_impl.md`](../plans/task_m100_27_impl.md)
Stage: 1

## 단계 목적

API token이 로그인 session만 있으면 무제한 생성되는 문제를 backend 정책으로 차단했다. 이번 단계의 목표는 owner별 active CLI token 최대 3개 제한을 token service에 고정하고, settings token 생성 경로와 device-code token 교환 경로가 같은 제한을 공유하도록 검증하는 것이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/tokens.js` | `DEFAULT_MAX_ACTIVE_CLI_TOKENS = 3` 추가, `issueCliToken`에서 owner별 active token 제한 적용 |
| `src/profile-backend/index.js` | token 제한 기본값 export 추가 |
| `src/profile-backend/__tests__/tokens.test.js` | owner별 active token 3개 제한, owner 격리, revoke 후 재생성 검증 추가 |
| `src/profile-backend/__tests__/http.test.js` | settings token 4번째 생성 거부, device-code poll 교환 제한 공유, revoke 후 교환 성공 검증 추가 |
| `mydocs/orders/20260617.md` | Stage 1 완료 및 Stage 2 승인 대기 상태 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없음. 기존 token 생성/list/revoke, raw token 1회 표시, digest 미노출 contract는 유지했다. 새 동작은 `revokedAt`이 없는 owner별 CLI token이 3개 이상일 때 token 발급 요청이 `conflict`로 실패하는 것이다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
```

결과:

- OK: 35개 테스트 통과
- OK: service 단위에서 active token 3개 제한과 revoke 후 재생성 검증
- OK: HTTP 단위에서 settings token 4번째 생성 요청은 409 `conflict`
- OK: device-code token 교환도 같은 active token 제한을 공유
- OK: raw token/digest 노출 범위 관련 security test 유지

## 잔여 위험

- UI는 아직 active token 3개 상태를 선제적으로 표시하거나 create button을 비활성화하지 않는다. Stage 2에서 처리한다.
- SameSite/CSRF 점검은 아직 수행하지 않았다. Stage 3에서 session cookie와 mutation route 경계를 검토한다.

## 다음 단계 영향

- Stage 2는 `DEFAULT_MAX_ACTIVE_CLI_TOKENS`와 settings token list를 기준으로 active token count를 계산해 UI 제한 상태를 표시하면 된다.
- Backend는 이미 settings token 생성과 device-code token 교환에 같은 제한을 적용하므로, UI는 409 `conflict` 응답도 사용자 메시지로 처리해야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 — Settings token limit UI로 진행한다.
