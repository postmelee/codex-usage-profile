# Task #137 Stage 5 보고서 — production exact-main patch release

GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
구현계획서: [`task_m100_137_impl.md`](../plans/task_m100_137_impl.md)
Stage: 5

## 단계 목적

Stage 3에서 owner-only 검증하고 Stage 4에서 npm으로 게시한 exact main을 canonical production에
배포한다. public access를 유지한 채 maintenance/migration 안전 Gate를 통과하고 Task #134 변경
표면만 최소 live smoke로 확인한다.

## 산출물

| 항목 | 변경 요약 |
|---|---|
| production source | exact main `27e8705fdc152534a4e4b726cac32f625a3c7763`을 configured source branch에 push했다. |
| saved version 5 | exact production archive를 저장했다. 27 files, 5,437,440 bytes, content hash `sha256:86b9960123ceb46975b0681212efcc2a7a8fe8fc302f7f4eee2ca0705e1db5d2`다. |
| maintenance-on deployment | environment revision 7에서 saved version 5 public deployment가 성공했다. |
| migration/readiness | expected/applied가 모두 `[1,2,3,4,5,6]`이고 ready 상태임을 확인했다. |
| maintenance-off deployment | secret을 제거한 environment revision 8에서 같은 saved version 5 재배포가 성공했다. |
| 최소 production smoke | `@latest=0.1.4` stale credential recovery, device approval 완료 위계와 same-process submit을 검증했다. |
| `docs/production-hosting.md` | 현재 production version/source/artifact/environment와 Task #137 실측 이력을 반영했다. |
| `mydocs/orders/20260825.md` | Stage 5 완료와 Stage 6 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, migration과 manifest는 수정하지 않았다. `docs/production-hosting.md`의 현재 live 표를
version 5 실측값으로 갱신하고 기존 release 이력 앞에 Task #137 증거를 추가했다. Task #108 이하의
과거 이력은 보존했다. production owner/D1/R2 data를 삭제하지 않았고 profile visibility는 private,
기존 token과 browser session은 유지했다.

## 검증 결과

실행·확인 항목:

```text
production access/version/environment/D1 baseline read-only 확인
exact-main production target materialize·package·artifact verifier
configured source push와 saved version source/archive provenance 대조
maintenance-on public deploy → migrate → readiness
maintenance disabled·secret remove → 같은 version public redeploy
/healthz, operator route와 recent errors-only Worker log 확인
격리 @latest=0.1.4 login → token revoke → 같은 submit 재인증·continuation
device approval 완료 화면의 standalone/submit-context 다음 행동 확인
검증 token revoke, local logout와 private visibility 확인
git diff --check
git status --short
```

결과:

- OK — 배포 전 baseline은 public access revision 10, saved version 4/source `61f72fc`, environment
  revision 6, maintenance disabled·service normal·operator secret absent였다.
- OK — production archive는 exact main `27e8705`, canonical production project/origin, logical
  `DB`/`PROFILE_MEDIA`, Worker entry와 migration 1–6을 포함했다.
- OK — saved version 5 source는 exact main과 같고 저장 artifact는 27 files, 5,437,440 bytes,
  content hash `sha256:86b9960123ceb46975b0681212efcc2a7a8fe8fc302f7f4eee2ca0705e1db5d2`다.
- OK — maintenance-on deployment와 maintenance-off 재배포가 모두 `succeeded`했다. access revision 10은
  변하지 않았고 final environment revision 8은 maintenance disabled·service normal·token absent다.
- OK — migrate는 applied `[1,2,3,4,5,6]`, newly applied `[]`였고 readiness는 expected/applied가
  순서까지 `[1,2,3,4,5,6]`, `ready=true`였다.
- OK — final `/healthz`는 200, unauthenticated operator route는 404다. recent errors-only log의 4xx는
  의도한 revoked token 410, anonymous/private/operator 경계이며 5xx와 Worker failure는 없다.
- OK — public `@latest`는 version `0.1.4`와 canonical production 기본 origin을 사용했다. 새 login token을
  폐기해 stale local credential을 만든 뒤 같은 `submit --json`은
  `Saved login is no longer valid. Reconnecting...`을 출력하고 새 device approval 뒤 중단 없이
  Contract v1 `accepted`, non-idempotent submit으로 완료됐다.
- OK — standalone login 승인 완료 화면은 submit 명령을 주 행동으로 안내하고 설정 가이드 링크를
  제거했으며 홈·프로필은 보조 링크로 남겼다. submit continuation 승인 완료 화면은 추가 명령 없이
  터미널로 돌아가 현재 제출 결과를 확인하도록 안내했다.
- OK — submit 결과와 Settings 모두 visibility `private`를 유지했다. 검증 전 active token 1개를 보존하고
  두 차례 생성한 검증 token은 각 revoke해 최종 1개로 복원했으며 격리 credential은 logout 후
  `No credential found. Run login first.`를 확인했다.
- OK — production owner에는 기존 usage가 있어 remote fresh-owner empty 상태를 만들기 위한 데이터 삭제는
  수행하지 않았다. EN/KO 미제출 Home은 Stage 1 E2E 결과를 사용했고, 합의에 따라 카드 설정 조합·SNS
  반복 smoke는 생략했다.

## 잔여 위험

- 로그인된 완전 신규 production owner의 미제출 Home은 실제 신규 계정으로 독립 재현하지 않았다.
  local E2E와 기존 운영 계정의 인증 경계를 근거로 비차단 판정한다.
- production version 5의 application rollback 후보는 version 4다. migration 6은 additive이지만 active
  account deletion operation이 있으면 기존 application으로 임의 rollback하지 않는다.

## 다음 단계 영향

- Stage 6은 npm tag/run/registry, Stage5 version 38, production version 5, access/environment/migration과
  exact main SHA를 다시 교차 대조하고 공식 운영 이력·최종 보고서를 완성해야 한다.
- 제품·Site 추가 mutation과 사용자 smoke는 필요하지 않다. final task PR만 생성한다.

## 승인 요청

- Stage 5 production exact-main 배포와 최소 smoke 결과를 승인하면 Stage 6 release provenance audit와
  최종 보고 단계로 진행한다.
