# Task M100 #5 Stage 1 단계 보고서

GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
구현계획서: [`task_m100_5_impl.md`](../plans/task_m100_5_impl.md)
Stage: 1

## 단계 목적

`codex-usage-analyzer`가 생성하는 Account Usage Contract v1을 기존 CLI Bearer token의 owner에 안전하게 연결하고, 최신 usage 저장소와 공개 카드 endpoint가 같은 데이터로 갱신되도록 submit backend 계약을 구현한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/account-usage.js` | Account Usage Contract v1 exact-key validator, UTC 미래 시각 제한, null 보존 projection 추가 |
| `src/profile-card/index.js` | downstream contract 상수와 검증·정규화 API export |
| `src/profile-card/__tests__/account-usage.test.js` | 정상 계약, null semantics, unsupported version·unknown field·future timestamp 회귀 테스트 추가 |
| `src/profile-backend/account-usage-submit.js` | token owner binding, 최신 usage 저장, device upsert, replay conflict, opaque revision, process-local rate limiter 구현 |
| `src/profile-backend/errors.js` | `rate_limited` 오류 코드, 429 상태와 응답 헤더 전달 경계 추가 |
| `src/profile-backend/http.js` | `POST /api/account-usage/submit`, `GET /api/account-usage/status`, device header, 64 KiB 스트리밍 본문 제한, metadata-only 응답 구현 |
| `src/profile-backend/index.js` | Account Usage submit 서비스와 HTTP 계약 export |
| `src/profile-backend/__tests__/account-usage-submit.test.js` | 저장·null·idempotency·stale/conflict/future·secret·rate limit·card ETag 테스트 추가 |
| `src/profile-backend/__tests__/http.test.js` | submit/status 응답, body/content type, device, conflict, `Retry-After`, 기존 API 회귀 테스트 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 기존 `/api/snapshots/submit`, 공개 snapshot 조회, profile/card endpoint 계약은 유지했으며 전체 회귀 테스트로 동작 보존을 확인했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/account-usage-submit.test.js
node --test src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
node --test src/profile-card/__tests__/account-usage.test.js src/profile-card/__tests__/service.test.js
npm test
npm run build
git diff --check
```

결과:

- OK: Account Usage submit 서비스 테스트 6개 통과
- OK: HTTP·보안 테스트 36개 통과
- OK: Account Usage·card service 테스트 15개 통과
- OK: 전체 단위·통합 테스트 221개 통과
- OK: Vite production build 성공
- OK: whitespace 오류 없음

## 잔여 위험

- rate limiter는 현재 process-local 구현이므로 다중 인스턴스 production 배포에서는 shared limiter로 교체해야 한다.
- 기존 durable store는 단일 프로세스 파일 저장소이므로 production storage 선택과 동시성 보장은 후속 배포 작업에서 확정해야 한다.
- 실제 npm CLI와의 request deep-equal 및 packed CLI smoke는 Stage 3과 Stage 5 범위다.

## 다음 단계 영향

- Stage 2 CLI service client는 `POST /api/account-usage/submit`과 `GET /api/account-usage/status`를 그대로 사용할 수 있다.
- device identity는 body가 아니라 `x-codex-usage-profile-device-id`, `x-codex-usage-profile-device-name` 헤더로 전달해야 한다.
- submit body는 wrapper 없이 Account Usage Contract v1 document 자체이며, 401/409/410/413/415/429를 CLI의 안전한 오류로 매핑해야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 CLI package와 device login·credential 경계 구현으로 진행한다.
