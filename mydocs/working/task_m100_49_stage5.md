# Task #49 Stage 5 보고서 — hosted Sites 핵심 흐름과 비용 Gate 검증

GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
구현계획서: [`task_m100_49_impl.md`](../plans/task_m100_49_impl.md)
Stage: 5

## 단계 목적

Stage 4까지 local workerd에서 검증한 Sites full-stack Worker, D1 structured store, native R2 publication, Worker PNG renderer와 기존 GitHub OAuth/CLI 계약을 실제 Sites production deployment에서 검증한다. Gate A에서는 추가 과금 없는 현재 계정 범위, owner-only Site, test OAuth app, D1/R2 linkage와 migration을 승인받고, Gate B에서는 제한 시간 동안 public access와 실제 owner Account Usage Contract v1 집계 전송을 별도로 승인받았다.

공개 검증 종료 뒤 Site와 profile을 비공개로 복구하고 browser session 및 CLI token을 폐기한다. Site, D1, R2와 test OAuth app 자체는 Stage 6의 architecture 판정과 처리 결정 전까지 유지한다.

## 산출물

| 파일·외부 산출 | 변경 요약 |
|---|---|
| `.openai/hosting.json` | Sites가 반환한 opaque project linkage와 logical binding `DB`, `PROFILE_MEDIA` 기록 |
| `build/sites-vite-plugin.js` | hosted D1 migration package를 Sites artifact에 포함하도록 candidate build 보완 |
| `scripts/verify-sites-fullstack-artifact.mjs`와 test | hosted linkage, migration, client/server 경계 검증 보강 |
| `src/profile-marketing/__tests__/sites-config.test.js` | 실제 linkage가 생긴 뒤에도 marketing fixture가 독립적으로 검증되도록 조정 |
| `src/profile-runtime/github-oauth-client.js`와 test | GitHub REST `/user` 요청에 필수 `User-Agent: codex-usage-profile` 추가 |
| Sites project `appgprj_6a62f58721788191a7cd82f37320f244` | `DB`, `PROFILE_MEDIA`, GitHub OAuth secret을 연결한 Stage 5 test Site |
| saved version 2 / deployment `appgdep_6a630f37aa3c8191b713f54614674d41` | commit `f2202ad`를 production URL에 배포한 최종 hosted candidate |
| GitHub test OAuth app `3749395` | hosted callback smoke 뒤 loopback callback으로 복구한 test-only app |

Stage 5 source는 계획서에 따라 candidate 고정 commit `494fc8e`와 hosted OAuth 최소 보완 commit `f2202ad`로 분리했다. 배포된 saved version 2는 `f2202ad`를 참조하며, 이 보고서 commit과 혼동하지 않는다.

## 본문 변경 정도 / 본문 무손실 여부

기존 API, CLI Account Usage Contract v1, GitHub owner identity, public/private profile과 stable card route 의미는 변경하지 않았다. hosted 검증에서 발견된 유일한 source 결함은 GitHub REST user lookup의 `User-Agent` 누락이었다. token exchange 자체는 성공했지만 GitHub `/user` 응답을 정상 JSON으로 받을 수 없었고, 표준 header 추가 뒤 실제 callback과 secure session이 통과했다.

전송한 실제 owner 데이터는 승인된 Account Usage Contract v1의 다음 allowlist로 제한했다.

- top-level: `contractVersion`, `capturedAt`, `summary`, `dailyUsageBuckets`
- summary: `lifetimeTokens`, `peakDailyTokens`, `longestRunningTurnSec`, `currentStreakDays`, `longestStreakDays`
- 90개 일별 집계 bucket

프롬프트, 응답, Codex/OpenAI 인증정보, GitHub secret/token, 로컬 session 파일과 identity field는 전송 문서에 포함하지 않았다. Site owner record와 승인된 집계 usage, immutable card revision은 D1/R2에 test data로 남아 있지만 profile은 `private`이고 stable public route는 tombstone/404 상태다.

## Gate와 deployment 결과

### Gate A

- 작업지시자가 “추가 과금 없이” 현재 ChatGPT 계정 범위의 owner-only Site, test OAuth app, D1/R2 linkage, migration과 candidate deployment를 승인했다.
- Site는 한 번만 생성했고 `.openai/hosting.json`의 같은 opaque `project_id`를 재사용했다.
- logical binding은 `DB`, `PROFILE_MEDIA`이며 S3 credential이나 AWS SDK를 hosted runtime에 추가하지 않았다.
- D1 migration 2개가 packaged artifact와 remote deployment에 적용됐다.
- runtime secret 값은 source, manifest와 보고서에 기록하지 않았다.

### Gate B

- 작업지시자가 public test access와 실제 owner Account Usage Contract v1 집계 전송을 명시 승인했다.
- production URL: `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`
- GitHub OAuth callback은 public smoke 동안 Site callback을 사용했고 종료 뒤 작업지시자가 `http://127.0.0.1:5173/api/auth/github/callback` 복구를 확인했다.
- 최종 deployment 상태는 `succeeded`, environment revision은 2다.
- Gate B 종료 뒤 Sites access revision 5는 owner 1명, 사용자 allowlist 0명, group allowlist 0명의 custom owner-only 상태다. 비로그인 요청은 401이다.

## 검증 결과

구현계획서 Stage 5 명령:

```bash
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm test
npm run test:e2e
git diff --check
```

결과:

- OK — `npm run build:sites-fullstack`
  - Worker/client, Wasm, font와 D1 migration을 포함한 hosted artifact 생성
- OK — `npm run verify:sites-fullstack`
  - client 7 files, Worker 1 file, migration 2개
  - Worker raw 3,823,944 bytes, compressed 2,129,753 bytes
  - hosted linkage와 server-only/client 경계 통과
- OK — `npm test`
  - 436개 중 430 pass, 6 env-gated skip, 0 fail
  - D1 OAuth callback, CLI exchange, usage submit, visibility의 5개 원자 연산 경쟁 검증 포함
- OK — `npm run test:e2e`
  - Playwright 15/15 통과
- OK — `npm run build`
- OK — `git diff --check`: 경고 없음

### GitHub OAuth와 browser session

- OK — 실제 GitHub code exchange, owner `postmelee` identity lookup과 callback 200
- OK — `Secure`, `HttpOnly` session cookie 발급
- OK — `/api/auth/me` 200 후 logout 200, cookie clear와 이후 401
- OK — cross-origin session mutation 403, same-origin mutation 200
- OK — client secret, OAuth code/state와 session 원문을 source·report에 보존하지 않음

### packed CLI와 D1

- OK — packed CLI device login → owner approve → poll/exchange → status
- OK — 승인된 실제 Contract v1 submit 후 authenticated private card 생성
- OK — 같은 Contract 문서를 동시에 두 번 submit
  - 한 요청 201 `accepted`, `idempotent=false`
  - 한 요청 200 `unchanged`, `idempotent=true`
  - stable card application ETag와 body 불변
- OK — 같은 device code를 동시에 poll
  - 한 요청만 token 발급
  - 다른 요청은 410 `gone`
- OK — Gate B에서 만든 CLI token 2개만 정확히 revoke
  - revoke 뒤 두 token 모두 account status 410
  - owner token 목록 2개에서 0개로 감소
- OK — local real-workerd D1 concurrency 6/6
  - duplicate OAuth callback은 session 1개만 commit
  - duplicate CLI exchange는 token 1개만 commit
  - competing usage/visibility는 한 winner만 commit하고 partial record 없음

### private/public profile과 R2 stable serving

- OK — usage 전 private/public profile과 card 404
- OK — usage 후 authenticated private preview 200, `image/png`, `private, no-store`
- OK — private 상태의 public profile/card 404
- OK — publish 뒤 stable card GET 200, HEAD 200, matching `If-None-Match` 304
- OK — GET/HEAD/304 application ETag 동일, public cache는 `public, no-cache, must-revalidate`
- OK — missing handle 404
- OK — concurrent public/private visibility 요청 뒤 명시적 private 전환으로 deterministic final state 고정
- OK — unpublish 뒤 public profile/card 404, authenticated preview는 계속 200/no-store
- OK — R2 immutable revision과 tombstone은 보존하고 profile은 `private`

관리형 remote bucket에 provider fault를 주입하는 안전한 surface는 없었다. 따라서 R2 PUT/HEAD/GET failure와 D1 CAS 보상 실패의 fail-closed 503, 더 최신 publication 비침범은 Stage 3의 native R2 failure/concurrency test로 검증했고, remote에서는 실제 publication 경쟁과 최종 404 수렴까지만 확인했다.

### 비노출 검사

- OK — production root HTML과 실제 JS/CSS asset 2개 스캔
  - GitHub client secret, Sites bypass token, OAuth/device/session/token marker 없음
  - Gate B session·CLI token 실제 값과 일치하는 문자열 없음
- OK — public/profile/card response와 header에 private usage·credential 없음
- OK — 최근 5분 Worker error log event 0개
- OK — test session cookie, raw CLI token과 Contract 원문은 local mode 0600 임시 파일로만 다루고 폐기

### 비용·한도 관찰

- Gate A는 현재 ChatGPT 유료 계정에 포함된 Sites 범위와 “추가 과금 없음”을 조건으로 승인됐다.
- Site 생성, D1/R2 linkage, migration, saved version/deployment와 public/owner-only access 전환 과정에서 결제, plan upgrade 또는 유료 기능 활성화를 수행하지 않았다.
- 이번 검증의 관찰 기준 증분 인프라 비용은 0원이다. 다만 Sites public beta는 account별 고정 수치 quota와 초과 과금 계약을 도구 응답으로 제공하지 않으므로, 무제한 무료나 장기 가격 보장은 아니다.

## 원복과 부산물

- Site access: owner-only custom access로 복구
- profile: `private`, public profile/card 404
- browser session: logout과 cookie 폐기 확인
- CLI token: Gate B 생성분 2개 모두 revoke, 이후 410
- GitHub test OAuth callback: loopback 주소 복구를 작업지시자가 확인
- local 임시 cookie, token, OAuth code/state, Contract 원문, PNG/response와 package smoke artifact: 삭제
- 유지: Site, D1/R2 linkage와 test OAuth app, D1의 test owner/집계 usage, R2 immutable revision/tombstone

material remote resource 삭제는 수행하지 않았다. Stage 6에서 Sites 채택/기각 판정과 함께 유지·비공개·삭제를 별도 결정한다.

## 잔여 위험

- Sites는 public beta이며 account별 numeric runtime/D1/R2 quota와 장기 가격 보장이 명시적 tool output으로 제공되지 않는다. 현재 계정에서 추가 과금 없이 동작한 관찰과 향후 정책 보장은 구분해야 한다.
- remote R2 provider failure를 직접 주입하지 못했다. 정상 publication, 경쟁과 unpublish는 hosted에서 통과했지만 provider fault/compensation은 local real contract test가 근거다.
- Gate B 실제 집계 usage와 immutable media는 remote D1/R2에 남아 있다. owner-only/private/404로 닫혀 있지만 material 삭제가 필요하면 Stage 6에서 별도 승인과 cleanup 경로가 필요하다.
- test OAuth app은 유지 중이며 active secret 값은 Sites secret store 밖에 보고하지 않았다. production cutover 때는 production 전용 OAuth app 또는 최종 secret rotation/정리가 필요하다.
- 공개 smoke 중 app-level GitHub OAuth는 정상 동작했지만 Sites owner-only access에서는 방문자가 먼저 Sign in with ChatGPT gate를 통과해야 한다. production 공개 전환 정책은 Stage 6 후속 migration에서 다시 승인받아야 한다.

## 다음 단계 영향

- Stage 6는 local-only 추정이 아니라 이번 hosted 결과를 기준으로 Sites + D1 + R2의 canonical MVP 채택 여부를 판정한다.
- 기능 동등성, GitHub OAuth, CLI submit, D1 원자성, native R2 stable serving과 Worker renderer는 hosted PASS 근거로 사용할 수 있다.
- 비용 결론은 “현재 계정·현재 Sites beta에서 관찰된 증분 비용 0원”으로 한정하고, numeric quota/정책 변경을 stop/fallback trigger로 문서화해야 한다.
- Cloud Run + Neon + R2 artifact와 Task #43은 삭제·close하지 않고 fallback으로 유지한다.
- Stage 6 승인 전 `docs/production-hosting.md`, #43/#46 상태와 remote resource 유지·삭제 결정을 변경하지 않는다.

## 승인 요청

- Stage 5 hosted 검증 결과와 원복 상태를 승인하면 Stage 6 architecture 판정, `docs/production-hosting.md` 최소 갱신과 최종 handoff로 진행한다.
- 이 승인은 Site/D1/R2/test OAuth app의 삭제나 production 공개 전환 승인이 아니다.
