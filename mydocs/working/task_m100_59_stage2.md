# Task M100 #59 Stage 2 완료보고서

GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
구현계획서: [`task_m100_59_impl.md`](../plans/task_m100_59_impl.md)
Stage: 2

## 단계 목적

device 승인 요청이 네트워크 재시도나 빠른 중복 입력으로 반복될 때 같은
owner가 이미 완료한 `approved` 또는 `exchanged` 상태를 안전하게
복구한다. pending 상태의 최초 승인은 기존 atomic transition만 사용하며,
다른 owner, 만료, not-found와 허용되지 않은 상태는 fail-closed 경계를
유지한다.

브라우저가 사용하는 `/api/auth/device/authorize` 응답은 후속 UI에 필요한
`status`, `intent`, `approvedAt`, `exchangedAt`만 반환하도록 좁혀 owner,
token, digest와 redirect metadata를 노출하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/cli-login.js` | owner id 선검증, 만료 우선 검사, same-owner 완료 상태와 approval race 1회 재조회 복구 |
| `src/profile-backend/http.js` | device authorize 전용 4필드 allowlist serializer 적용 |
| `src/profile-backend/store-contract.js` | pending atomic transition과 token 미발급 same-owner replay invariant 명시 |
| `src/profile-backend/__tests__/cli-login.test.js` | 빠른 중복 승인, approved/exchanged replay, cross-owner, expiry 우선과 owner validation 검증 |
| `src/profile-backend/__tests__/http.test.js` | device authorize 최소 응답 계약 검증 |
| `src/profile-backend/__tests__/security.test.js` | 승인 응답 secret/metadata 부재, same-owner replay와 cross-owner 차단 검증 |
| `src/profile-backend/__tests__/d1-concurrency.test.js` | real-workerd fast double approval, cross-owner와 token row 0건 검증 |
| `src/profile-backend/__tests__/postgres-concurrency.test.js` | Postgres same-owner 동시 승인과 token 미발급 회귀 추가 |
| `mydocs/orders/20260731.md` | Stage 2 완료보고 승인 대기로 상태 갱신 |
| `mydocs/working/task_m100_59_stage2.md` | Stage 2 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. pending 최초
승인과 CLI poll/exchange의 token-once 계약, legacy
`/api/cli/login/*` 응답은 보존했다.

완료 상태 복구는 challenge의 owner가 현재 인증 owner와 정확히 같고
challenge가 아직 만료되지 않았을 때만 허용한다. 복구 경로는 token
service나 `atomic.exchangeCliLogin`을 호출하지 않으며 token row를 쓰지
않는다. device authorize 외 serializer, `.openai/hosting.json`, D1/Postgres
schema와 production 배포 설정은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test \
  src/profile-backend/__tests__/cli-login.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-backend/__tests__/security.test.js \
  src/profile-backend/__tests__/d1-concurrency.test.js \
  src/profile-backend/__tests__/postgres-concurrency.test.js

$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test src/profile-backend/__tests__/store-contract.test.js

git diff --check
```

결과:

- OK — Stage 2 focused suite: 70 tests, 69 pass, 0 fail, 1 skip.
- OK — memory service에서 fast same-owner double approval이 같은 완료
  challenge를 반환하고 token row가 0건임을 확인.
- OK — approved/exchanged same-owner replay 성공, 다른 owner
  `invalid_request`, 완료 상태라도 만료를 우선해 `expired` 반환 확인.
- OK — device authorize 응답이 `status`, `intent`, `approvedAt`,
  `exchangedAt` 네 필드만 반환하고 owner/token/digest/redirect metadata를
  포함하지 않음을 확인.
- OK — D1 real-workerd에서 same-owner 동시 승인 2건이 동일 완료 상태로
  복구되고 cross-owner는 차단되며 token row가 0건임을 확인.
- SKIP — `TEST_DATABASE_URL`이 없어 Postgres concurrency/failure-injection
  suite 1건은 기존 test policy에 따라 명시적으로 skip.
- OK — store contract supplementary suite: 3 tests, 3 pass, 0 fail.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- `TEST_DATABASE_URL`이 없어 Postgres에서 새 same-owner 동시 승인 case를
  실제 database로 실행하지 못했다. 동일 service/store 경로의 test를
  추가했으며 memory와 D1 real-workerd 증적은 통과했다.
- `src/profile-api/client.js`는 아직 이전 device authorize 응답의
  `challenge` shape를 읽는다. 현재 UI는 반환 challenge를 사용하지 않아
  승인 자체는 유지되지만, 새 `intent`와 terminal 상태 소비는 Stage 3에서
  client와 UI를 함께 갱신해야 한다.
- 이 Stage에서는 production deploy와 database 작업을 수행하지 않았다.

## 다음 단계 영향

- Stage 3는 device authorize의 4필드 allowlist 응답을 그대로 소비하고
  `approved`와 `exchanged`를 모두 terminal success로 처리해야 한다.
- `submit`, `login`, `null` intent별 안내와 local origin용 `--server`
  command는 client-side pure helper에서 만들고 server 응답 필드를 명령에
  직접 삽입하지 않아야 한다.
- same-owner replay가 성공 응답이 되었으므로 UI의 빠른 중복 입력 방어와
  manual retry가 backend 오류 없이 동일 terminal 상태로 수렴할 수 있다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 — terminal 승인 UI와
  intent별 onboarding 구현으로 진행한다.
