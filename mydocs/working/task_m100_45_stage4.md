# Task #45 Stage 4 보고서 — public profile과 stable R2 cache

GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
구현계획서: [`task_m100_45_impl.md`](../plans/task_m100_45_impl.md)
Stage: 4

## 단계 목적

Stage 3의 private owner, primary CLI token과 browser session을 이어받아
same-origin UI의 publish/unpublish, public HTML/JSON과 stable R2 PNG의
GET·HEAD·304, `en`/`ko`/fallback, content-addressed application ETag와
exact submit retry를 production에서 검증한다. 종료 전에는 다시
private/unpublished로 닫고 모든 public data route가 `404`인지 확인한다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_45_impl.md` | revoked token 기대값을 canonical `410 gone`으로 보정하고 PNG bytes 기반 ETag 판정 기준 명시 |
| `mydocs/working/task_m100_45_stage4.md` | public JSON·R2 card·submit retry·unpublish와 safe-state 검증 기록 |
| `mydocs/orders/20260729.md` | Task #45를 Stage 4 완료·Stage 5 승인 대기로 갱신 |
| production public publication | bounded 검증 동안 생성·갱신 후 UI unpublish, Stage 종료 시 private/public route `404` |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, package/lockfile, 공식 사용자 문서, npm registry, GitHub
release를 변경하지 않았다. Site access, environment, saved version,
deployment, service mode와 maintenance mode도 변경하지 않았다.

구현계획서는 Stage 3에서 승인받은 revoked-token factual correction
`401`→`410 gone`과 Stage 4에서 승인받은 권고안 A만 최소 수정했다.
권고안 A는 application ETag의 진실 원천이 Account Usage document revision이
아니라 렌더링된 PNG bytes의 SHA-256이라는 기존 계약을 명시한다.

production 변경은 same-origin publish/unpublish와 승인된 Account Usage
Contract v1 accepted submit·exact retry에 한정된다. aggregate 값, token,
session cookie, internal owner/device/storage id, local credential 경로와
local Codex session data는 파일, argv, URL, stdout와 보고서에 기록하지
않았다. Contract document와 token은 exact public package를 실행한 ephemeral
process memory에서만 사용했다.

## public profile과 JSON allowlist

- authenticated private card와 `Publish card`를 확인한 뒤 same-origin UI로
  일시 publish했다.
- canonical `/?profile=postmelee`는 public profile을 렌더링했고 public JSON
  `/api/profiles/public/postmelee`는 `200`, `Cache-Control: no-store`였다.
- public JSON의 exact allowlist는 다음과 같다.
  - top-level: `owner`, `usage`, `visibility`, `publicCardUrl`
  - owner: `displayName`, `githubLogin`, `avatarUrl`, `handle`
  - usage metadata: `capturedAt`, `uploadedAt`, `usage`
  - Account Usage: `summary`, `dailyUsageBuckets`
  - summary와 bucket: Contract v1 aggregate field만 포함
- owner/internal provider id, content digest/revision, token/session과 local
  path를 포함한 forbidden key는 0건이다.
- public JSON으로 재구성한 Contract v1 digest와 authenticated status의
  latest revision이 일치했다. stable card URL도 publish 전후 같은
  `/u/postmelee/card.png`다.

## stable R2 card와 cache 결과

- default와 `locale=en`의 PNG body, SHA-256과 application ETag가 같았다.
- `locale=ko`는 English와 다른 PNG SHA-256/application ETag를 사용했다.
- unsupported locale은 English body/application ETag로 fallback했다.
- 모든 public card GET은 `200`, `Content-Type: image/png`,
  `Cache-Control: public, no-cache, must-revalidate`였다.
- ETag는 quoted base64url SHA-256 형식이고 각 PNG SHA-256과 일치했다.
- HEAD는 GET과 같은 content type, cache-control과 ETag를 반환하면서 body가
  없었다.
- matching `If-None-Match`는 같은 ETag, body 없는 `304`를 반환했다.
- public card request는 structured profile store나 on-demand private preview가
  아니라 R2 stable publication에서 직접 서빙되는 executable contract와
  production 응답을 함께 충족했다.

## accepted submit, exact retry와 ETag 판정

- exact public `codex-usage-profile@0.1.0`과 analyzer `0.2.0`으로 실제
  Account Usage Contract v1을 다시 읽었다.
- 새 `capturedAt`으로 document digest가 달라진 실제 문서는 public 상태에서
  `accepted`, `idempotent=false`였고 public JSON latest revision도 같은
  accepted revision으로 갱신됐다.
- 같은 memory document의 exact retry는 `unchanged`,
  `idempotent=true`였으며 latest revision과 stable card ETag가 바뀌지
  않았다.
- analyzer의 `summary`/`dailyUsageBuckets`는 이전 공개 문서와 같았다.
  따라서 렌더링된 PNG bytes와 application ETag도 유지됐다.
- 이후 별도 bounded recheck에서도 실제 render input은 같았고 submit은
  실행하지 않았다. synthetic usage는 만들지 않았다.
- 작업지시자가 권고안 A를 승인해 다음 판정을 적용했다.
  - render input과 PNG bytes가 같을 때 content-addressed ETag 유지: PASS
  - render input이 바뀐 newer submit에서 ETag가 바뀌는 계약:
    `account-usage-submit.test.js` executable regression PASS
  - stable URL과 public JSON revision 갱신, exact retry의 ETag 불변: PASS

## unpublish와 production 종료 상태

- 각 bounded public 검증 직후 same-origin UI의 `Make private`로
  unpublish했다.
- authenticated root는 private card와 `Publish card`를 다시 렌더링했다.
  private preview는 executable contract에서
  `Cache-Control: private, no-store`를 유지한다.
- canonical public profile은 `Profile unavailable`이고 public JSON,
  default/`en`/`ko`/unsupported stable card가 모두 `404`다.
- Site는 active, public access revision `14`, saved version `7`,
  environment revision `13`, service normal, maintenance disabled다.
- 최근 90분 error-only Worker event에서 unexpected 5xx는 0건이다. 관찰된
  `not_found`는 private 원복 뒤 의도적으로 확인한 public JSON/card
  `404`뿐이다.
- primary token, browser session과 owner-only local credential은 Stage 5
  lifecycle 검증을 위해 유지했다. config directory `0700`, credential
  file `0600`이며 product credential을 다른 위치로 복제하지 않았다.

## 검증 결과

실행 명령:

```bash
node <ephemeral exact-public-0.1.0 Contract v1 submit/retry runner>
node <ephemeral public JSON/R2 card matrix runner>
node <ephemeral private rollback matrix runner>
node --test \
  src/profile-backend/__tests__/account-usage-submit.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-media/__tests__/r2-binding-store.test.js \
  src/profile-card/__tests__/worker-renderer.test.js
git diff --check
```

추가 production 검증:

```text
authenticated UI private→publish→Share→Make private→private
canonical public HTML과 explicit public JSON allowlist
stable R2 PNG default/en/ko/unsupported GET·HEAD·If-None-Match
actual Contract v1 accepted submit→same-memory exact retry
unpublish 뒤 canonical unavailable와 JSON/card 전체 404
Sites project/access/version/environment key presence와 recent error log
```

결과:

- OK — public HTML/JSON `200`, JSON no-store와 forbidden key 0건.
- OK — default/en 일치, ko 분리, unsupported→en fallback.
- OK — public PNG content type/cache, quoted digest ETag와 SHA-256 일치.
- OK — HEAD bodyless `200`, matching ETag bodyless `304`.
- OK — actual Contract revision accepted, public JSON latest revision 일치.
- OK — exact retry `unchanged`, latest revision과 stable ETag 불변.
- OK — 동일 PNG bytes의 content-addressed ETag 유지와 render input 변경 시
  ETag 변경 executable regression.
- OK — focused Node test 56개 중 56개 통과, 실패·skip 0건.
- OK — unpublish 뒤 canonical unavailable, public JSON/card 전체 `404`.
- OK — Site access/version/environment/운영 baseline 유지, unexpected 5xx 0건.
- OK — `git diff --check` 통과.

## 잔여 위험

- production에서 자연스럽게 변한 `summary`/`dailyUsageBuckets`를 이번
  bounded window 안에 관찰하지 못했다. 실제 aggregate 변경 시 ETag 변경은
  executable regression으로 검증했고, 작업지시자 승인에 따라 release
  blocker가 아닌 후속 production 관찰 항목으로 유지한다.
- browser surface는 authenticated private PNG response header를 직접
  반환하지 않는다. 실제 private PNG 렌더링과 동일 endpoint의 executable
  contract로 `private, no-store`를 교차 검증했다.
- maintenance disabled 상태에서는 remote D1/R2 exact count와 immutable
  revision retention을 직접 조회하지 않았다. Stage 5 Gate B/C의 fresh
  plan에서 owner/handle/digest/count가 승인값과 같은지 재확인한다.
- primary browser session, CLI token, owner와 task credential은 Stage 5
  export/restore/final cleanup을 위해 의도적으로 유지한다.
- Stage 1의 dev/build dependency audit low 1, high 7은 그대로 남아 있다.
  production dependency audit 0이므로 현재 runtime/CLI blocker는 아니다.

## 다음 단계 영향

- Stage 5는 private/unpublished owner와 public JSON/card 전체 `404`에서
  시작한다.
- Site access는 public revision `14`, saved version `7`, environment
  revision `13`, service normal, maintenance disabled baseline이다.
- Gate B 전환은 같은 saved version만 사용하고 access owner-only/public,
  maintenance/service mode를 각 전환별 fresh operator secret으로 검증한다.
- Gate C destructive lifecycle은 fresh owner/handle/D1/R2
  digest·count plan이 승인값과 일치할 때만 export→exact
  delete→restore/repair→fresh final delete를 수행한다.
- Stage 5 실행은 이 보고서 승인만으로 자동 허용하지 않는다. 구현계획서의
  Gate B exact transition과 Gate C fresh destructive plan에 각각 별도
  승인이 필요하다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5의 read-only Gate B/C
  preflight와 exact 승인 입력 작성으로 진행한다.
