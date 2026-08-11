# Task #45 Stage 3 보고서 — submit idempotency와 보안 경계

GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
구현계획서: [`task_m100_45_impl.md`](../plans/task_m100_45_impl.md)
Stage: 3

## 단계 목적

Stage 2에서 만든 private owner, primary CLI token과 browser session을
이어받아 Account Usage Contract v1의 accepted/unchanged/conflict/stale
경계를 production에서 검증한다. secondary token revoke, issuing-origin
binding, same-origin session mutation, cross-origin/CORS 차단, invalid body,
rate-limit와 structured-log allowlist를 production 최소 요청과 local
real-workerd/D1/R2 회귀로 교차 검증한다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_45_stage3.md` | idempotency·conflict·revocation·Origin/CORS·invalid body·로그 검증 기록 |
| `mydocs/orders/20260729.md` | Task #45를 Stage 3 완료·Stage 4 승인 대기로 등록 |
| production private latest usage | 승인된 Contract v1 최신 집계 1회 accepted 후 exact retry, rejected probe 뒤 동일 revision 유지 |
| production secondary token | 1개 생성·성공 확인·revoke 완료, active token 목록에서 제거 |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, package/lockfile, 공식 사용자 문서, npm registry, GitHub
release를 변경하지 않았다. Site access, environment, saved version,
deployment, service mode와 maintenance mode도 변경하지 않았다.

production 변경은 private latest usage 갱신 1회, 같은 submitted device touch,
secondary narrow token의 일시 생성과 revoke에 한정된다. public publish,
R2 stable object 생성, Site access/environment 전환,
maintenance/export/delete/cleanup은 수행하지 않았다.

Account Usage aggregate 값, primary/secondary token, session cookie, internal
owner/token/device id, local credential 경로와 local Codex session data는
파일, argv, URL, stdout와 보고서에 기록하지 않았다. production probe는
Contract v1 문서와 token을 한 process memory에서만 사용했다. secondary
token은 일회성 stdin pipe로 전달하고 pipe와 probe script를 제거했다.

## submit idempotency와 저장 불변성

- exact public `codex-usage-profile@0.1.0`과 analyzer `0.2.0`으로 현재
  Contract v1 문서를 읽었다. top-level과 summary field는 승인 allowlist와
  일치하며 document digest는
  `8yHiXclPcjWttJ5ddnGcpce7aFAhccgVe3gpg6WKQKc`다.
- 기존 latest보다 새로운 `capturedAt`의 실제 집계를 private 상태에서
  한 번 submit했고 `201 accepted`, `idempotent=false`를 확인했다.
- 같은 memory document의 exact retry는 `200 unchanged`,
  `idempotent=true`였다. accepted/retry/status revision은 모두
  `usage_8yHiXclPcjWttJ5ddnGcpce7aFAhccgVe3gpg6WKQKc`로 일치했다.
- 같은 `capturedAt`에서 한 summary field만 바꾼 conflict와 1초 더 오래된
  stale document는 각각 `409 conflict`였다.
- conflict/stale와 invalid body probe 뒤 status의 latest revision과
  `capturedAt`은 accepted revision에서 바뀌지 않았다.
- owner visibility는 전체 과정에서 private이고 anonymous public JSON/card는
  계속 `404`다. public media refresh나 R2 publication은 발생하지 않았다.

## token·origin·CORS와 invalid body

- Settings UI에서 `Task 45 Stage 3` secondary token을 1개 생성했다.
  token의 첫 metadata status request는 `200`이었다.
- 같은 Settings UI에서 해당 token을 revoke했다. 서버에서 token 목록을
  다시 불러 secondary token 0, active primary token `1/3`을 확인했다.
- 고정 타이머 기반 첫 follow-up은 UI revoke보다 먼저 실행돼 `200`이어서
  증거에서 제외했다. server list 재조회 후 fresh 단일 request는
  `410 gone`으로 안전하게 거부됐다.
- 구현계획서의 `401` 기대값과 달리 current source,
  `http.test.js`, CLI error mapping과 기존 QA 보고서가 정의한 revoked-token
  계약은 `410 gone`이다. credential이 거부된다는 보안 목적은 충족하며
  제품 blocker는 아니다. Stage 4 승인과 함께 계획 기대값을
  `410 gone`으로 보정하는 승인을 요청한다.
- stored primary credential에 다른 HTTPS origin을 지정한 exact public CLI
  status는 request client 생성 전 local fail했다. token이 타 origin으로
  전송되지 않았다.
- same-origin session mutation은 Settings token create/revoke UI에서
  성공했다.
- literal opaque-origin browser tab은 browser URL 안전 정책상 만들지
  않았다. 대신 credential-free production request에 foreign HTTPS
  `Origin`을 부여한 token-create mutation이 `403 forbidden`,
  `Access-Control-Allow-Origin` 없음인지 확인했다. local HTTP 회귀는
  `Origin`과 `Sec-Fetch-Site`를 포함한 cross-site mutation 거부와
  same-origin 허용을 함께 검증했다.
- missing/invalid Bearer status는 각각 `401 unauthorized`,
  wrong content type은 `415 invalid_request`, oversized body는
  `413 invalid_request`, unknown Contract field는
  `400 validation_failed`였다.
- 모든 negative response top-level은 `ok`, `error`뿐이고 ACAO는 없었다.
  unknown field probe 전후 latest revision/capturedAt도 동일했다.
- production에서는 rate-limit threshold를 소진하지 않았다. local D1
  rate-limiter가 shared burst counter, `retry-after`, sustained rollback,
  raw token 비저장과 unbounded override 거부를 4/4 검증했다.

## production 로그와 종료 상태

- 최근 120분 Worker log 62건은 structured application event 31건과
  provider console envelope 31건이다.
- structured application source는
  `requestId`, `routeClass`, `method`, `status`, `durationBucket`,
  `errorCode`, `retryable` allowlist 위반 0건이다.
- Stage 3 핵심 route 결과는 account usage
  `201` 1건, `200` 7건, `409` 2건, `410` 1건,
  `401` 3건, `400/413/415` 각 1건과 cross-origin API `403` 1건이다.
- 5xx, Worker non-`ok` outcome, raw CLI token marker, 제품 session cookie
  이름, OAuth code/state query는 모두 0건이다.
- provider Authorization field 16건은 Bearer 형태 0건, 최대 길이 8자의
  placeholder다. cookie field 13건은 모두 explicit redaction이다.
- Stage 종료 시 Site는 active/public access revision `14`, saved version
  `7`, environment revision `13`, service normal, maintenance disabled다.
  `/healthz`는 `200`, `postmelee` public JSON/card는 각각 `404`다.
- authenticated browser에서 private card와 `@postmelee`가 렌더링되고,
  Settings visibility private, active token `1/3`, submitted device 1개를
  확인했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/security.test.js
node --test src/profile-backend/__tests__/http.test.js
node --test src/profile-backend/__tests__/d1-store.test.js
node --test src/profile-backend/__tests__/d1-rate-limiter.test.js
node --test src/profile-runtime/sites/__tests__/backend.test.js
node --test src/profile-runtime/sites/__tests__/observability.test.js
node --test src/profile-runtime/sites/__tests__/full-stack.test.js
node --test src/profile-media/__tests__/r2-binding-store.test.js
npm test --workspace packages/codex-usage-profile-cli
git diff --check
```

추가 production 검증:

```text
exact public CLI/analyzer accepted→exact retry→conflict/stale
secondary token create→status→revoke→fresh rejected status
issuing-origin mismatch local fail-before-request
same-origin Settings UI mutation
foreign Origin credential-free mutation과 ACAO 부재
missing/invalid auth, content type, body size, unknown Contract field
Sites state/version/environment read-only 확인
recent Worker application/provider log redaction
anonymous health/public JSON/stable card
```

결과:

- OK — local test 118개 중 118개 통과, 실패·skip 0건.
- OK — accepted `201`, exact retry `200 unchanged`, conflict/stale `409`.
- OK — rejected probe 뒤 latest digest/revision/capturedAt 불변.
- OK — secondary token 성공 후 revoke, fresh request `410 gone`.
- OK — credential origin mismatch는 request 생성 전 local fail.
- OK — same-origin mutation 성공, foreign Origin `403`, ACAO 없음.
- OK — generic `400/401/413/415` 경계와 metadata-only response.
- OK — D1 rate-limit, real-workerd/D1/R2와 CLI 회귀 통과.
- OK — structured-log allowlist 위반, credential marker, 5xx/Worker failure
  0건.
- OK — production public/version/normal/maintenance baseline과 private public
  `404` 유지.
- OK — `git diff --check` 통과.

## 잔여 위험

- 구현계획서가 revoked token을 `401`로 적었지만 canonical runtime 계약은
  `410 gone`이다. Stage 4 승인 시 이 보고서의 factual correction을
  계획 기대값 보정으로 함께 승인받아야 한다.
- browser URL 안전 정책으로 literal opaque-origin page form submit은
  수행하지 않았다. credential-free production foreign-Origin `403`과
  local `Origin`/`Sec-Fetch-Site` executable contract를 결합했으며,
  session cookie는 추출하지 않았다.
- maintenance disabled 상태에서는 remote D1/R2 exact count를 조회하지
  않았다. UI, status, public `404`, route log와 fresh state로 owner 1,
  primary active token 1, submitted device 1, latest usage 1,
  public object 0을 확인했다. Gate B/C exact plan에서 재검증한다.
- primary browser session, CLI token과 owner-only local credential은
  Stage 4를 위해 유지한다. task config directory `0700`, credential file
  `0600`, symlink 0이며 Stage 5 final cleanup 전에는 제거하지 않는다.
- Stage 1의 dev/build dependency audit low 1, high 7은 그대로 남아 있다.
  production dependency audit 0이므로 현재 runtime/CLI blocker는 아니다.

## 다음 단계 영향

- Stage 4는 현재 private owner, primary token, browser session과 latest
  digest를 이어받는다.
- same-origin UI로 일시 publish한 뒤 public HTML/JSON과 stable R2 PNG의
  GET/HEAD/304, `en`/`ko`/fallback, ETag/SHA-256/cache 계약을 검증한다.
- 실제 Account Usage 변경 submit이 stable URL은 유지하면서 ETag/digest를
  갱신하는지 확인한 뒤 same-origin UI로 즉시 unpublish한다.
- Stage 4 종료 상태는 다시 private/unpublished, public JSON/card `404`다.
  Site access/environment/maintenance와 destructive lifecycle은 계속
  변경하지 않는다.
- Stage 3 판정은 PASS이며, 위 `410 gone` 계획 기대값 보정을 수용하면
  Stage 4 진입 blocker는 없다.

## 승인 요청

- Stage 3 산출물과 검증 결과, revoked token 기대값을 `401`에서 canonical
  `410 gone`으로 보정하는 권고안을 승인하면 Stage 4의 일시 public publish,
  stable R2 card/cache 검증과 즉시 unpublish로 진행한다.
