# Task #45 Stage 5 보고서 — 운영 rollback과 exact production cleanup

GitHub Issue: [#45](https://github.com/postmelee/codex-usage-profile/issues/45)
구현계획서: [`task_m100_45_impl.md`](../plans/task_m100_45_impl.md)
Stage: 5

## 단계 목적

Sites production에서 maintenance route와 service mode를 독립적으로
fail-close 전환하고, 공개 bridge 동안 owner payload 부재를 검증한다.
fresh owner plan과 repository 밖 `0600` backup을 exact confirmation으로
사용해 delete→restore→final delete를 증명하고, disposable
owner/session/token/D1/R2/local credential을 제거한 public normal 상태로
복구하는 것이 목적이다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `scripts/sites-profile-maintenance.mjs` | 15초 request timeout, `0600` atomic export, exact restore 입력과 민감정보 비노출 operator CLI |
| `scripts/__tests__/sites-profile-maintenance.test.js` | timeout, export/restore, apply confirmation과 credential 비노출 회귀 테스트 |
| `mydocs/plans/task_m100_45.md` | Gate B-R5~R8-R4와 Gate C 승인·실행·fail-close 결과 반영 |
| `mydocs/plans/task_m100_45_impl.md` | production transition revision, exact backup/delete/restore/final cleanup 기록 |
| `mydocs/working/task_m100_45_stage5.md` | Stage 5 단계 보고서와 세부 실행 증적 |
| `mydocs/orders/20260729.md` | Stage 5 완료와 Stage 6 승인 대기 상태 |
| production Site | public revision 26, environment revision 57, saved version 7, `disabled/normal`, operator secret absent |
| disposable production/local state | owner/session/token/D1/R2/backup/task CLI credential 제거 |

## 본문 변경 정도 / 본문 무손실 여부

Stage 5 이전의 제품 API, Account Usage Contract v1, 공개 card URL과 saved
version 7 source는 변경하지 않았다. 구현 변경은 maintenance operator CLI의
timeout·backup/restore 안전 경계에 한정했고, 기존 명령과 테스트를 보존한 채
옵션 검증을 추가했다.

수행계획서와 구현계획서는 승인된 retry와 실제 revision 결과를 기존 본문에
누적했으며 기존 승인·실패 기록을 삭제하거나 재작성하지 않았다. raw
operator/session/CLI token, 내부 owner ID, backup·credential path,
Account Usage payload는 source, argv 예시, 문서와 보고서에 기록하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test --test-concurrency=1 \
  scripts/__tests__/sites-profile-maintenance.test.js \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  src/profile-media/__tests__/r2-binding-maintenance.test.js \
  src/profile-runtime/sites/__tests__/maintenance.test.js
git diff --check
```

production 검증:

```text
bounded plan/export/retention/delete-account/restore operator CLI
landing/health/auth/public JSON/stable card/operator HTTP matrix
Sites access/environment/version/deployment connector readback
exact backup과 task 전용 credential cleanup
recent production Worker error-only log
```

결과:

- OK — maintenance 회귀 테스트 21개 중 21개 통과, 실패·skip 0개.
- OK — `git diff --check` 통과.
- OK — public bridge payload 부재와 maintenance HTTP 계약 3회 수렴.
- OK — pre-delete plan owner 1/object 15, export owner 1/object 4
  `private/unpublished`, same-backup restore와 fresh final plan owner 1/object
  4가 exact digest/count confirmation과 일치.
- OK — final owner plan `not_found`, retention candidate 0.
- OK — final public revision 26, environment revision 57, saved version 7,
  maintenance disabled, service normal, operator secret absent.
- OK — final landing/health `200`, auth `401`, disposable public
  JSON/card/operator `404`가 3회 수렴.
- OK — 검증 backup과 task 전용 CLI config/cache/credential exact 삭제,
  복구 불가.
- OK — 최근 120분 production Worker error event 0개.
- OK — 변경 산출물에서 operator token, 내부 owner ID, 임시 경로 노출 0개.

## 잔여 위험

- M100 공개·홍보 최종 판정은 Stage 6의 registry/Sites 재검증, 공식 문서
  drift와 비용 stop 판정을 통과해야 한다.
- Stage 1에서 확인한 development dependency audit 결과는 Stage 6에서
  production dependency audit와 분리해 재판정한다.
- Site는 공개 landing을 제공하지만 disposable test owner는 제거된
  상태다. 이후 실제 사용자는 OAuth/CLI submit을 통해 각자의 데이터를 새로
  생성한다.

## 다음 단계 영향

- Stage 6는 public revision 26, environment revision 57, saved version 7,
  `disabled/normal`, operator secret absent를 baseline으로 사용한다.
- npm `0.1.0` provenance/integrity와 Node 20/22/24 clean install,
  Site endpoint, final cleanup count, 로그 allowlist와 비용 stop을
  read-only로 재검증한다.
- 실제 runtime/문서 drift가 있을 때만 공식 문서를 최소 수정하고, M100
  공개·홍보 PASS/BLOCKED를 결정한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 Stage 6 release decision,
  문서 drift와 handoff 검증으로 진행한다.

## 상세 실행 기록

## Gate B-R5

- 실행일: 2026-07-29
- 범위: Sites access/environment와 saved version 7의 read-only plan 검증
- 제외: export, delete, restore, retention apply, owner/token/session cleanup

### 실행 결과

1. public access, environment revision 24, maintenance disabled, service normal,
   operator secret absent와 saved version 7 source를 재확인했다.
2. revision 25에서 fresh operator secret을 disabled/normal 상태로
   materialize하고 saved version 7을 배포했다.
3. revision 26에서 같은 secret key를 교체하면서 enabled/normal로 전환하고
   saved version 7을 배포했다.
4. 첫 bounded exact plan은 owner count 1이었지만 D1 owner-dependent 행과
   R2 객체를 합친 object count가 승인 기준 13이 아닌 15였고 digest도
   달랐다. private/unpublished 경계는 별도의 public route `404`로 확인했다.
5. 3회 연속 수렴 검증, service maintenance 전환과 Gate C 데이터 작업은
   수행하지 않았다.
6. revision 27에서 operator secret을 제거하고 maintenance disabled,
   service normal로 원복한 뒤 saved version 7을 다시 배포했다.

### 종료 상태

- Site access: public
- service: normal
- maintenance route: disabled
- operator secret: absent
- landing: `200`
- `/healthz`: `200`
- unauthenticated `/api/auth/me`: `401`
- disposable public profile/card: `404`
- unauthenticated operator route: `404`
- D1/R2 mutation: 없음

### 중단 사유

승인된 exact object count/digest가 첫 plan에서 일치하지 않았다. 증가 원인과
새 exact 기준을 별도로 검토하고 작업지시자 승인을 받기 전에는 Gate B/C를
재개하지 않는다.

## Gate B-R6 read-only 원인 조사

### 확인한 계약

- owner plan의 object count는 D1 count와 R2 count의 합계다.
- D1 count에는 OAuth state와 session을 포함한 transient owner-dependent
  행도 포함된다.
- R2 count는 immutable locale revision 수와 stable publication/tombstone
  유무를 합친 값이다.
- GitHub OAuth callback 1회가 owner에 연결된 OAuth state와 session을
  만들면 combined count가 2 증가할 수 있다.
- 새 card content의 publish/refresh/repair가 두 locale revision을 만들면
  R2 count도 2 증가할 수 있다.
- saved version 7 plan response에는 component count가 없으므로
  `13→15`만으로 두 경우를 구분할 수 없다.

### 권고 판정

과거 count 13을 장기 고정값으로 사용하지 않는다. 원격 data mutation 없이
사용자 login/submit/publish 활동을 멈춘 최대 60초 창에서 첫 fresh plan을
anchor로 잡고, 같은 owner count, combined count와 digest가 3회 연속
일치할 때만 Gate B의 maintenance/normal 전환을 계속한다. Gate C는 이
anchor를 재사용하지 않고 fresh plan/export exact 값으로 별도 승인받는다.

## Gate B-R6 실행 결과

1. revision 28에서 disabled/normal 상태로 fresh operator secret을
   materialize하고 saved version 7을 배포했다.
2. revision 29에서 같은 secret key를 교체하면서 enabled/normal로 전환했다.
3. 사용자 활동 동결 창의 첫 owner plan을 anchor로 잡았고 combined object
   count 15와 digest가 3회 연속 일치했다.
4. revision 30 service maintenance에서 landing과 `/healthz` `200`, auth
   `503`, `Retry-After: 300`, unauthenticated operator route `404`가
   일치했다.
5. revision 31 service normal에서 owner plan 3회가 같은 anchor와 일치했다.
   다만 deployment 직후 병렬 실행한 단일 auth probe가 기대한 `401`이
   아니었다.
6. 승인된 실패 조건에 따라 revision 32에서 secret을 제거하고
   maintenance disabled + service normal로 원복해 saved version 7을
   배포했다.
7. 원복 뒤 public access, landing/health `200`, auth `401`, private public
   profile/card와 unauthenticated operator route `404`를 확인했다.

### R6 판정

- owner plan combined count/digest 수렴: PASS
- service maintenance HTTP contract: PASS
- service normal 직후 단일 auth probe: BLOCKED
- safe rollback: PASS
- D1/R2 mutation: 없음

deployment 성공과 edge HTTP 수렴은 별도 시점일 수 있다. 다음 시도는 최대
60초 bounded HTTP convergence window에서 목표 응답이 연속 3회 일치할 때
통과시키고, window 안의 단일 stale 응답은 즉시 실패로 판정하지 않는 계획
변경이 필요하다.

## Gate B-R7 제안

- current baseline은 public access revision 16, environment revision 32,
  maintenance disabled, service normal, operator secret absent다.
- revision 33/34에서 disabled materialize→enabled overwrite 순서로 fresh
  secret을 적용한다.
- revision 35 maintenance와 revision 36 normal은 각 deployment 뒤 최대
  60초 동안 목표 HTTP contract가 3회 연속 일치해야 통과한다.
- 각 request는 15초 제한이며 한 round의 독립 probe는 병렬 실행한다.
- owner plan은 R6 anchor의 combined count 15와 내부 digest에 3회 연속
  일치해야 한다.
- revision 37에서 disabled/normal로 닫고 검증된 secret은 Gate C까지
  유지한다.
- 실패 시 secret 제거, disabled/normal, public access와 saved version 7로
  즉시 원복한다.
- export/delete/restore/retention apply/cleanup은 R7 범위 밖이다.

## Gate B-R7 실행 결과

1. revision 33/34의 secret materialize→enabled overwrite와 saved version
   7 배포를 완료했다.
2. owner plan 세 번은 owner count 1, combined count 15로 유효했지만
   digest가 R6 anchor와 달랐다.
3. revision 35에서 secret 제거, maintenance disabled, service normal로
   원복하고 saved version 7을 배포했다.
4. environment와 public access, landing/health `200`, auth `401`, public
   JSON/operator `404`는 정상이다.
5. public card는 최대 60초 동안 `404`로 수렴하지 않았고 후속 probe에서도
   `200 image/png`와 public cache policy를 반환했다. PNG body는
   수집하거나 저장하지 않았다.

### R7 판정

- owner plan R6 anchor digest: BLOCKED
- safe environment rollback: PASS
- public profile JSON: `404`
- public stable card: `200` — BLOCKED
- D1/R2 mutation: 없음

combined count 불변과 digest 변경, private public JSON과 public card 응답을
종합하면 D1 owner state와 R2 stable publication이 불일치한다. Gate B/C를
중단하고 Site access를 owner-only로 먼저 닫는 권고안 A를 별도 승인받는다.
R2 unpublish/repair/delete는 containment 뒤 fresh plan과 새 승인 없이는
수행하지 않는다.

## Gate B-R7-E owner-only containment

- 승인: 권고안 A
- 변경 대상: Site access policy만
- 변경 전: public revision 16
- 변경 후: custom owner-only revision 17
- allowed user: owner 1명
- 추가 user/group: 0명
- anonymous landing/health/public JSON/card: platform 4xx
- owner landing: signed-in account와 private card 로드 PASS
- environment: revision 35, maintenance disabled, service normal
- operator secret: absent
- saved version: 7 유지
- D1/R2 mutation: 없음

public card의 원본 stable inconsistency는 access gate 뒤에 격리돼 있다.
R2 stable state를 exact repair하고 owner/public 경계를 재검증하기 전에는
public access로 전환하지 않는다.

## Gate B-R8 제안

existing maintenance export→restore 경로를 exact stable repair에 사용한다.
D1 durable backup의 desired visibility가 private이고 현재 durable data와
동일하면 D1 restore는 idempotent다. 이후 restore contract가 R2 stable
publication의 current storage ETag를 확인하고 tombstone으로 교체한다.

- access: owner-only revision 17 유지
- environment: revision 36 materialize→37 enable→38 disable/normal
- pre-repair: owner plan count 15/digest 3회 수렴
- backup: repository 밖 mode `0600`, exact contract/digest/count
- mutation: D1 idempotent restore + R2 stable tombstone만
- post-repair: count 유지/new digest 3회 수렴, owner-session public card `404`
- temporary backup: 성공 검증 뒤 exact 삭제
- 제외: owner/revision delete, retention apply, session/token cleanup,
  public access 복구

## Gate B-R8 실행 결과

- revision 36/37 private deployment와 secret materialize/enable: PASS
- owner-only maintenance CLI plan: platform gate 차단
- export/restore: 미실행
- revision 38 disabled/normal/secret-absent private rollback: PASS
- access: owner-only revision 17 유지
- D1/R2 mutation: 없음

identity-less CLI는 app maintenance token이 유효해도 Sites platform gate를
통과할 수 없다. revoke 수단이 없는 SIWC bypass token은 생성하지 않는다.

## Gate B-R8-R1 제안

owner-only에서 service maintenance를 먼저 배포하고 access만 잠시 public으로
바꾸는 bridge를 사용한다. worker는 maintenance endpoint를 service stop보다
먼저 처리하므로 exact operator request는 가능하고, 일반 landing/auth/public
JSON/card는 generic `503`으로 차단된다.

- environment: revision 39 materialize→40 enabled/maintenance
- access: owner-only 17→public 18
- precondition: public bridge HTTP contract 3회 수렴, owner plan count
  15/digest 3회 수렴
- repair: mode `0600` pre-export→exact idempotent restore→R2 tombstone
- postcondition: plan count 15/new digest 3회, post-export stable unpublished
- cleanup: pre/post temporary backup exact 삭제
- containment: public 18→owner-only 19 while service maintenance
- final environment: revision 41 disabled/normal, operator secret retained
- 제외: SIWC bypass token, owner/revision delete, retention apply,
  session/token cleanup, 최종 public access

## Gate B-R8-R1 실행 결과

- revision 39 disabled/normal secret materialize private deployment: PASS
- revision 40 enabled/service-maintenance private deployment: PASS
- Sites connector public 전환: workspace internet publishing policy로 거부
- access: owner-only revision 17 유지
- plan/export/restore와 D1/R2 mutation: 미실행
- fail-closed revision 41 disabled/normal/secret-absent private rollback: PASS

connector 호출 주체로는 public access 전환이 불가능해 로그인된 Sites 설정
UI가 필요하다. 재시도 시 동일한 bridge 계약을 유지하되 environment revision은
42 materialize→43 enabled/maintenance→44 disabled/normal 순서로 이동하고,
access는 여전히 17→18→19를 요구한다. Chrome 창을 여는 별도 사용자 허가와
이 revision 보정 승인을 받은 뒤에만 재시도한다.

## Gate B-R8-R1 UI 재시도 결과

- revision 42 disabled/normal secret materialize private deployment: PASS
- revision 43 enabled/service-maintenance private deployment: PASS
- Chrome Sites 설정 UI access 17→public 18: PASS
- anonymous HTTP: auth/public JSON/card `503`, health `200`, operator `404`
- anonymous exact landing `/`: expected `503`, actual `200`
- plan/export/restore와 D1/R2 mutation: 미실행
- access public 18→owner-only 19 fail-close: PASS
- revision 44 disabled/normal/secret-absent private rollback: PASS

saved version 7의 Worker 소스는 operational stop을 asset handler보다 먼저
실행하지만 public access 직후 exact root에 기존 정적 응답이 남았다. 다음
보정안은 revision 45→46 private 준비 뒤 access public 20으로 열고, 같은 saved
version 7을 service-maintenance environment로 public production 재배포해
edge 상태를 갱신한 뒤 exact root를 포함한 HTTP 계약을 다시 검사한다. 이
open-world deployment는 별도 Gate B-R8-R2 승인을 요구한다.

## Gate B-R8-R2 실행 결과

- revision 45 disabled/normal secret materialize private deployment: PASS
- revision 46 enabled/service-maintenance private deployment: PASS
- Chrome Sites 설정 UI access 19→public 20: PASS
- saved version 7 env revision 46 public production deployment: PASS
- anonymous HTTP: auth/public JSON/card `503`, health `200`, operator `404`
- no-cache exact landing `/`: expected `503`, actual `200`
- plan/export/restore와 D1/R2 mutation: 미실행
- access public 20→owner-only 21 fail-close: PASS
- revision 47 disabled/normal/secret-absent private rollback: PASS

public production 재배포로도 exact root가 변하지 않아 Sites는 root 정적
marketing shell을 Worker operational stop과 별도 경로로 제공하는 것으로
판정한다. source `index.html`은 빈 root와 public client entry만 포함하고,
개인화는 auth/owner API 성공 뒤에만 로드된다. Gate B-R8-R3은 짧은 bridge
동안 generic marketing landing `200`을 허용하되 auth/public JSON/card
`503`, health `200`, operator `404`와 landing HTML의 owner/usage payload
부재를 요구하는 보정안이다.

## Gate B-R8-R3 실행 결과

- revision 48 disabled/normal secret materialize private deployment: PASS
- revision 49 enabled/service-maintenance private deployment: PASS
- Chrome Sites 설정 UI access 21→public 22: PASS
- landing `200`, HTML, 128 KiB bound: PASS
- auth/public JSON/card `503`, health `200`, operator `404`: PASS
- landing payload absence: FAIL
- plan/export/restore와 D1/R2 mutation: 미실행
- access public 22→owner-only 23 fail-close: PASS
- revision 50 disabled/normal/secret-absent private rollback: PASS

production artifact의 `index.html`은 402바이트 generic shell이고 public client
asset만 참조한다. R8-R3 검사는 owner payload뿐 아니라 non-empty inline
bootstrap script 자체도 금지해 payload가 아닌 platform bootstrap까지
실패로 분류할 수 있었다. Gate B-R8-R4는 executable bootstrap을 허용하되
public handle/owner card URL을 금지하고 `application/json` bootstrap을
구조적으로 순회해 owner/usage/publication 값이 없음을 검사한다.

## Gate B-R8-R4 실행 결과

- owner-only revision 23, environment revision 50
  disabled/normal/secret-absent와 saved version 7 preflight: PASS
- revision 51 disabled/normal secret materialize private deployment: PASS
- revision 52 enabled/service-maintenance private deployment: PASS
- Chrome Sites 설정 UI access 23→public 24: PASS
- executable bootstrap 허용 landing `200`/HTML/128 KiB bound, exact
  handle/owner card URL과 구조화된 owner/usage/publication payload 부재
  3회: PASS
- auth/public JSON/card `503`, health `200`, operator `404` 3회: PASS
- pre-plan owner 1/object 15/same digest 3회와 export 뒤 fresh anchor
  재확인: PASS
- pre-export contract/schema v1, owner 1, object 6,
  `private/publication`, mode `0600`, 금지 필드 없음: PASS
- exact restore owner 1/object 6/input digest 일치: PASS
- post-plan owner 1/object 15/새 digest 3회: PASS
- post-export contract/schema v1, owner 1, object 4,
  `private/unpublished`, mode `0600`, 금지 필드 없음: PASS
- 검증용 pre/post backup 두 파일과 전용 임시 디렉터리 exact 삭제:
  PASS, 복구 불가
- access public 24→owner-only 25: PASS
- revision 53 disabled/normal/operator secret retained saved version 7
  private deployment: PASS
- connector/UI owner-only 사용자 1/group 0, environment revision 53,
  disabled/normal, operator secret stored: PASS
- anonymous root `401`: PASS

Gate B-R8-R4는 승인된 exact restore와 private publication tombstone 전환까지만
수행했다. owner/session/token 삭제, retention apply, owner revision 삭제,
operator secret 제거는 수행하지 않았고 Gate C 승인 범위로 남긴다.

## Gate C exact cleanup 실행 결과

- owner-only revision 25, environment revision 53 disabled/normal,
  operator secret stored, saved version 7 preflight: PASS
- revision 54 Gate C secret rotation private deployment: PASS
- revision 55 enabled/service-maintenance private deployment: PASS
- Sites connector public 변경: workspace API 비활성화로 미적용, access
  revision 25 유지 확인
- Chrome Sites 설정 UI access 25→public 26과 connector readback: PASS
- public bridge landing payload 부재와 auth/public JSON/card `503`,
  health `200`, operator `404` 3회: PASS
- fresh owner plan owner 1/object 15/same digest 3회: PASS
- retention 90일/recent revision 5 dry-run candidate 0: PASS
- pre-delete export contract/schema v1, owner 1, object 4,
  `private/unpublished`, mode `0600`, 금지 필드 없음: PASS
- export 뒤 fresh plan owner 1/object 15/digest anchor 재대조: PASS
- first exact delete owner 1/object 15/digest 일치: PASS
- revision 56 enabled/normal saved version 7 public deployment: PASS
- first bounded HTTP convergence: 미수렴, 추가 mutation 중단
- 후속 단일 진단과 3회 재검증에서 landing/health `200`, auth `401`,
  public JSON/card/operator `404`: PASS
- first delete 뒤 owner plan `not_found`: PASS
- same-backup restore owner 1/object 4/input digest 일치: PASS
- restore 뒤 public JSON/card `404` 3회: PASS
- fresh final plan owner 1/object 4/same digest 3회: PASS
- final exact delete owner 1/object 4/digest 일치: PASS
- final owner plan `not_found`, landing/health `200`, auth `401`, public
  JSON/card/operator `404` 3회: PASS
- final retention dry-run candidate 0: PASS, apply 불필요
- 검증 backup과 전용 임시 디렉터리 exact 삭제: PASS, 복구 불가
- task 전용 CLI config/cache/credential 45파일·37디렉터리·2 symlink exact
  삭제: PASS, 복구 불가
- owner delete에 의한 server-side session/token 제거와 auth `401`: PASS
- revision 57 disabled/normal/operator secret removed saved version 7 public
  production deployment: PASS
- final connector: public access revision 26, environment revision 57,
  disabled/normal, operator secret absent, saved version 7: PASS

일반 Codex/OpenAI/GitHub/ChatGPT 인증정보와 브라우저 프로필은 변경하지
않았다. raw token/session/owner ID, backup·credential path와 usage payload는
기록하지 않았다.
