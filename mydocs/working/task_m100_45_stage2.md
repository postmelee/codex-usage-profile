# Task #45 Stage 2 보고서 — fresh OAuth와 private-by-default 흐름

GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
구현계획서: [`task_m100_45_impl.md`](../plans/task_m100_45_impl.md)
Stage: 2

## 단계 목적

Gate A에서 승인된 production origin과 `postmelee` identity를 사용해 fresh
GitHub OAuth, browser session, published CLI `0.1.0` device login과 narrow
submit token 발급을 검증한다. Account Usage Contract v1 집계만 전송하고,
owner가 private/unpublished 상태를 유지하며 authenticated preview와
anonymous public 경계가 계약대로 동작하는지 확인한다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_45_stage2.md` | OAuth/device login, Contract v1 submit, private-by-default와 보안 검증 기록 |
| `mydocs/orders/20260728.md` | Task #45를 Stage 2 완료·Stage 3 승인 대기로 갱신 |
| production disposable state | owner 1, browser session 1, submit token 1, submitted device 1, latest usage 1 생성 |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, package/lockfile, 공식 사용자 문서, npm registry와 GitHub
release를 변경하지 않았다. Site access, environment, saved version,
deployment, service mode와 maintenance mode도 변경하지 않았다. production
변경은 승인된 disposable owner/session/device/token과 Contract v1 latest
usage 생성에 한정된다.

OAuth code/state, device challenge, token, cookie, internal owner id, local
credential 경로, Account Usage aggregate 값과 local Codex session data는
source, argv, URL, stdout와 보고서에 기록하지 않았다. Stage 3~4에서 같은
owner 흐름을 이어가기 위해 primary CLI token, browser session과 owner-only
local credential은 유지한다.

## fresh OAuth와 device login 결과

- fresh product session에서 시작했고 OAuth 완료 전 `/api/auth/me`는
  unauthenticated였다.
- GitHub OAuth identity와 requested handle은 승인 입력과 같은
  `postmelee`다. OAuth state는 일회성으로 소비됐고 callback 뒤 product
  session이 생성됐다.
- OAuth 직후 account는 usage가 없는 fresh private owner로 표시됐다. 기존
  usage나 public profile/card는 나타나지 않았다.
- exact public `codex-usage-profile@0.1.0 login`의 device challenge를 한 번
  승인했다. CLI poll은 한 번의 교환으로 완료됐고 submit token은 정확히
  1개다.
- task 전용 config directory permission은 `0700`, credential file은
  `0600`, symlink는 0개다. 기존 사용자 config/cache/credential을
  읽거나 덮어쓰지 않았다.
- submit 전 exact `status --json`은 account `postmelee`, visibility
  private, token present, latest usage absent와 profile private를
  allowlist 범위에서 확인했다.

## Contract v1 submit과 private-by-default 결과

- exact public `codex-usage-profile@0.1.0 submit --json`은 exit 0으로
  완료됐다. application log에는 신규 accepted submit
  `account_usage:201`이 정확히 1건 나타났다.
- submit 뒤 `status --json`은 latest usage present,
  `contractVersion=1`, `capturedAt`/`uploadedAt` 존재만 확인했다.
  aggregate 값은 출력하거나 보고서에 복제하지 않았다.
- Contract top-level은 `contractVersion`, `capturedAt`, `summary`,
  `dailyUsageBuckets`만 허용하며 identity, credential, prompt, response,
  tool data와 local path가 없는 계약 검증을 통과했다.
- authenticated root에서 private card가
  `/api/profile/card.png`를 통해 정상 렌더링됐다. public stable card route나
  publish 동작은 사용하지 않았다.
- anonymous canonical profile은 unavailable 상태이고 public JSON
  `/api/profiles/public/postmelee`와 stable card
  `/u/postmelee/card.png`는 모두 `404`다. publication/R2 public object는
  생성되지 않았다.
- executable contract test는 authenticated private owner preview가
  `Cache-Control: private, no-store`를 사용함을 확인했다. 실제 authenticated
  browser에서도 같은 private endpoint의 PNG가 정상 로드됐다.
- Settings 기준 visibility는 private, API token은 1/3, submitted device는
  1개다. `Publish card` 동작은 실행하지 않았다.

## 보안과 로그 검증

- OAuth state replay/expiry, callback/session/logout와 secure host-only cookie
  계약을 focused test로 검증했다.
- device poll interval/expiry, one-token exchange, credential permission과
  symlink 거부를 focused test로 검증했다.
- 최근 production application event 50건에서 5xx와 Worker failure는
  0건이다. application log source는
  `requestId`, `routeClass`, `method`, `status`, `durationBucket`,
  `errorCode`, `retryable` allowlist 밖의 field가 0건이다.
- provider metadata의 Authorization header 3건은 모두 explicit redaction이고
  Bearer value 형태가 아니었다. cookie header 20건도 모두 explicit
  redaction이며 제품 session cookie 이름은 0건이다.
- OAuth code/state와 device user code query 노출은 각각 0건이다. 실제
  token/cookie value, Account Usage payload와 local path의 log 노출은
  관찰되지 않았다.
- Stage 종료 시 Site는 active/public access revision `14`, saved version
  `7`, environment revision `13`, service normal, maintenance disabled로
  Stage 1 baseline과 같다.

## 검증 결과

실행 명령:

```bash
node --test --test-concurrency=1 \
  packages/codex-usage-profile-cli/test/device-login.test.js \
  packages/codex-usage-profile-cli/test/credentials.test.js \
  packages/codex-usage-profile-cli/test/integration.test.js \
  src/profile-backend/__tests__/oauth-runtime.test.js \
  src/profile-backend/__tests__/session.test.js \
  src/profile-backend/__tests__/account-usage-submit.test.js \
  src/profile-backend/__tests__/http.test.js
git diff --check
```

추가 production 검증:

```text
exact public CLI 0.1.0 login/status/submit
fresh GitHub OAuth와 one-time device approval
authenticated account/settings/private card
anonymous auth/public JSON/stable card
Sites project/access/version/environment read-only state
recent production Worker application/provider metadata log
```

결과:

- OK — focused Node test 69개 중 69개 통과, 실패·skip 0건.
- OK — fresh OAuth state/callback/session과 one-token device login 완료.
- OK — exact CLI submit accepted 1건, Contract v1 latest usage 생성.
- OK — account/token/device/latest usage count가 각각 예상한 1건이다.
- OK — authenticated private card 렌더링과 private no-store 계약 확인.
- OK — anonymous public JSON/card `404`, public publication 없음.
- OK — production 5xx/Worker failure/application allowlist 위반 0건과
  credential metadata redaction 확인.
- OK — Site access/environment/version/운영 모드는 Stage 1 baseline 유지.
- OK — `git diff --check` 통과.

## 잔여 위험

- browser API는 session cookie를 추출하지 않고 authenticated response
  header를 직접 반환하지 않는다. 실제 private PNG 렌더링과 동일 endpoint의
  executable contract test로 `private, no-store`를 교차 검증했다. Stage 3의
  same-origin/cross-origin 경계 검증에서 이 계약을 계속 확인한다.
- maintenance disabled 상태에서는 remote D1/R2 exact count를 직접 조회하지
  않았다. fresh pre-state, account/settings UI, CLI status, accepted submit
  1건과 public JSON/card `404`로 owner 1, token 1, device 1, latest usage 1,
  public object 0을 확인했다. destructive count/digest는 Gate B/C의 fresh
  plan에서 별도로 재확인한다.
- primary browser session, CLI token과 local credential은 Stage 3~4 연속
  검증을 위해 의도적으로 유지한다. Stage 5 final cleanup 전에는 폐기하지
  않으며, credential을 보관한 task 전용 임시 state도 그때까지 유지한다.
- Stage 1의 dev/build dependency audit low 1, high 7은 그대로 남아 있다.
  production dependency audit 0이므로 현재 runtime/CLI blocker는 아니다.
- provider metadata는 Authorization/cookie를 redaction 처리했다. Stage 3의
  negative origin/token probe 뒤에도 credential marker와 5xx를 다시
  확인한다.

## 다음 단계 영향

- Stage 3는 현재 private owner, primary token, browser session과 latest
  Contract v1 snapshot을 그대로 이어받는다.
- 범위는 identical retry의 unchanged, same-capturedAt/older conflict,
  secondary token revoke, unauthenticated/invalid token, origin/CORS/CSRF와
  log allowlist 검증이다.
- Stage 3에서도 public publish, Site access/environment 전환,
  maintenance/export/delete/cleanup은 금지한다.
- 현재 Stage 2 판정은 PASS이며 Stage 3 진입을 막는 blocker는 없다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3의 submit idempotency,
  conflict/revocation과 origin·CSRF·log 보안 경계 검증으로 진행한다.
