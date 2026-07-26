# Task #51 Stage 5 단계 보고서

GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)  
구현계획서: [`task_m100_51_impl.md`](../plans/task_m100_51_impl.md)  
Stage: 5

## 단계 목적

Gate B 승인 범위 안에서 production candidate Site를 짧게 public으로 전환해 anonymous, GitHub OAuth, packed CLI, private-by-default profile, publish/unpublish stable card와 security/rate-limit 경계를 검증한다. 검증 종료 시 public publication, browser session, CLI token/credential과 disposable owner data를 정리하고 Site access를 Stage 4와 같은 custom owner-only 정책으로 원복한다.

## 산출물

| 파일 또는 원격 상태 | 변경 요약 |
|---|---|
| `src/profile-runtime/sites/config.js` | Sites 앞단이 `/device` clean path를 `/`로 보내는 제약을 피해 CLI verification URI를 `/?view=device`로 고정했다. |
| `src/profile-runtime/sites/backend.js` | Sites device verification URI를 backend device flow에 전달한다. |
| `src/profile-runtime/sites/__tests__/config.test.js` | production device verification URI 계약을 검증한다. |
| `src/profile-ui/appRoutes.js` | root-query device approval 화면을 기존 Device route와 같은 화면으로 해석한다. |
| `src/profile-ui/DeviceApprovalPage.jsx` | device approval redirect를 root-query 경로로 유지한다. |
| `src/profile-ui/publicProfileRoutes.js` | 기존 `/u/{handle}`와 함께 Sites 호환 `/?profile={handle}`를 같은 공개 프로필 API 화면으로 해석한다. |
| `src/profile-ui/__tests__/appRoutes.test.js` | root-query device route 판정을 검증한다. |
| `src/profile-ui/__tests__/publicProfileRoutes.test.js` | Sites 공개 프로필 query route의 loading/unavailable 계약을 검증한다. |
| `tests/profile-ui.spec.js` | Sites root-query device approval과 public profile 진입점을 E2E로 고정했다. |
| Sites saved version 7 | source `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`, 19-file production archive를 기존 Site에 저장했다. |
| Sites production deployment | saved version 7을 최종 environment revision 7로 private deployment해 `succeeded`를 확인했다. |
| Sites access policy | 최종 `custom`, owner 1명만 허용, 추가 user와 workspace/tenant group 0개인 revision 13으로 원복했다. |
| repository 밖 원본 durable backup | Stage 4 원본 export를 mode `0600`으로 계속 보존한다. payload와 실제 경로는 저장소·로그·보고서에 기록하지 않았다. |

hosted smoke에서 발견한 clean path redirect를 최소 source/test 보완으로 처리한 하위 단계 커밋은 다음과 같다.

- `b854c91` — device approval을 `/?view=device`로 전환
- `745be1d` — public HTML profile을 `/?profile={handle}`로 지원

## 본문 변경 정도 / 본문 무손실 여부

기존 제품·운영 문서는 변경하지 않았다. Account Usage Contract v1, GitHub OAuth/session, CLI token, publish/unpublish와 stable card URL 계약은 유지했다. source 변경은 Sites가 지원하는 root-query device approval과 public profile 진입점에 한정했다.

Site 앞단의 extension 없는 clean HTML deep link 제약은 유지된다. device approval은 `/?view=device`, public HTML profile은 `/?profile={handle}`로 복구했다. `/u/{handle}` 직접 진입은 Worker보다 먼저 `307 /`로 이동하며, `.png` stable card와 JSON API는 이 제약을 받지 않는다.

## 원격 검증 결과

### public anonymous와 보안 경계

- landing과 static asset은 `200`, health는 `200`으로 응답했다.
- app session이 없는 `/api/auth/me`, private profile과 private preview는 `401`이었다.
- private/unpublished profile·card와 존재하지 않는 card는 `404`였다.
- cross-origin account read와 profile mutation, cross-site logout은 `403`이었고 허용 CORS header를 반환하지 않았다.
- invalid Bearer는 `401`이었다.
- 최종 owner/test data cleanup 뒤 public 상태에서 stable card, locale card, missing card와 maintenance route가 모두 `404`인 것을 재확인했다.

### OAuth, CLI와 card

- 첫 public smoke에서 GitHub OAuth와 private-by-default Home까지 성공했으나 packed CLI가 안내한 `/device`가 Sites 앞단에서 `/`로 이동했다.
- 중단 조건에 따라 publication 없이 즉시 owner-only로 원복하고 root-query device route를 보완해 saved version 6을 배포했다.
- 두 번째 public smoke에서 GitHub OAuth → root-query device approval → one-time exchange → packed CLI submit이 성공했다.
- 전송 범위는 승인된 Account Usage Contract v1 집계 필드뿐이다. prompt, response, Codex/OpenAI 인증정보와 로컬 session file은 전송하지 않았다.
- submit 직후 profile은 private였고 public profile/card는 `404`였다.
- publish 후 stable card `GET 200`, `HEAD 200`, matching ETag의 `304`, missing card `404`와 public profile JSON `200`을 확인했다.
- stable card는 `public, no-cache, must-revalidate`, profile JSON은 `no-store`였다.
- Share dialog의 Image URL과 README Markdown은 production stable `.png` URL을 사용했다.
- unpublish 뒤 UI가 다시 `Publish card` 상태가 됐고, cleanup 뒤 동일 stable card URL의 anonymous `404`를 확인했다.
- clean public HTML profile `/u/postmelee`는 `307 /`이지만 saved version 7의 Sites 호환 `/?profile=postmelee`는 owner-only 인증 점검에서 `200`으로 SPA를 제공했다.
- `/?profile=postmelee`의 공개 프로필 API rendering은 unit 6/6과 Playwright E2E에서 검증했다.

### duplicate, rate-limit과 credential cleanup

- 이미 교환된 device challenge를 다시 poll해 raw token이 재발급되지 않는 것을 확인했다.
- 순차 idempotent submit은 `200`과 idempotent metadata를 유지했다.
- 동시 submit 6건에서 5건은 idempotent `200`, 1건은 `429`와 `Retry-After: 1`이었다.
- Settings UI에서 Gate B CLI token을 revoke했고 active token이 `0/3`인 것을 확인했다.
- revoke 뒤 packed CLI status는 재로그인을 요구했고, local credential을 제거했다.
- GitHub browser app session을 logout해 Settings가 다시 `Sign in required` 상태가 됐다.

### 원격 data cleanup과 최종 상태

- exact owner deletion plan은 25 objects였고 digest/count를 고정해 apply했다.
- 삭제 전 disposable export 5 objects를 새 mode `0600` 파일로 만들었고, 삭제 완료 확인 뒤 영구 폐기했다.
- 삭제 뒤 같은 owner plan은 `not_found`였다.
- Stage 4 원본 durable backup은 mode `0600`으로 보존한다.
- temporary CLI credential, 승인된 usage capture, device-flow capture와 maintenance wrapper를 포함한 Gate B 임시 디렉터리를 영구 폐기했다.
- maintenance token은 cleanup 구간에 새 Sites secret으로 교체했으며 plaintext를 저장소·보고서에 기록하지 않았다.
- 최종 environment revision 7은 `PROFILE_MAINTENANCE_MODE=disabled`, `PROFILE_SERVICE_MODE=normal`이다.
- 최종 access policy revision 13은 `custom`, owner 1명, 추가 user/group 0개다.
- edge 전파 완료 뒤 landing, health, auth/profile API, stable card와 maintenance route의 anonymous 요청이 모두 platform `401`이었다.
- Sites recent Worker log 조회는 event 0건을 반환했다. production secret redaction은 이번 조회에서 새 log 표본을 얻지 못했고 local observability/security test로 재검증했다.
- 추가 과금, plan upgrade 또는 결제수단 등록 요구는 나타나지 않았다. 이는 이번 Gate 중 관찰 결과이며 향후 가격·quota의 영구 보장은 아니다.

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
npm run build:production
npm run verify:sites-production
npm run smoke:sites-fullstack:local
git diff --check
```

결과:

- `npm test`: OK — 477 tests, 471 pass, 6 skip, 0 fail
- `npm run test:e2e`: OK — 16 pass, 0 fail
- `npm run build:production`: OK
- `npm run verify:sites-production`: OK — artifact 4,654,172 bytes, client 7, migration 2, worker 2, expected bindings 3
- `npm run smoke:sites-fullstack:local`: OK — 35 routes verified
- `git diff --check`: OK
- 첫 전체 병렬 test run에서 renderer test file이 한 번 일시 실패했으나 같은 파일 단독 2/2와 최종 전체 재실행 477/477에서 통과했다.
- 최초 E2E 재실행은 로컬 Playwright Chromium 부재로 browser launch 전에 실패했다. 저장소 고정 Chromium을 설치한 뒤 16/16 통과했다.

## 잔여 위험

- `/u/{handle}` clean public HTML profile은 Sites 앞단에서 `307 /`로 이동한다. 기능은 `/?profile={handle}`로 복구했지만 URL 형태가 기존 clean path보다 덜 직관적이므로 Gate C 문서와 링크를 한 형식으로 고정해야 한다.
- 계정에 귀속되지 않은 만료 device challenge 2건은 exact owner deletion 범위에 포함되지 않는다. 교환 token, usage 또는 profile을 포함하지 않으며 retention threshold 이후 operator cleanup 대상이다.
- production recent Worker log 표본이 0건이어서 hosted log redaction을 이번 Gate에서 재관찰하지 못했다. local observability/security test와 응답 경계는 통과했다.
- Sites beta의 가격·quota와 과금 정책은 바뀔 수 있다. Gate C에서 추가 과금/upgrade 요구가 나타나면 public cutover를 중단해야 한다.
- 원본 durable backup은 민감한 repository 밖 운영 자산이다. Stage 6 보존 기간 승인 전까지 mode `0600`을 유지하고 payload/path를 공유하지 않는다.

## 다음 단계 영향

- Gate C가 승인되기 전 Site access는 `custom` owner-only를 유지하고 final public access update를 호출하지 않는다.
- 현재 production candidate는 saved version 7, environment revision 7, access policy revision 13이다.
- Gate C의 public 사용자 문서와 공유 링크는 HTML profile에 `/?profile={handle}`, image/README에 기존 `/u/{handle}/card.png`를 사용해야 한다.
- clean `/u/{handle}`를 canonical link로 쓰지 않는 한 public HTML profile 기능은 Sites 호환 route로 유지된다.
- final public access, README/공식 문서와 #43/#44/#45/#46·M100 metadata 변경은 Gate C exact 승인 뒤에만 수행한다.

## 승인 요청

- Stage 5와 Stage 5.2 산출물, owner-only 원복 결과를 검토해 승인해 달라.
- public HTML profile 기능 차단은 Sites 호환 route로 해소됐다. Gate C에서는 최종 public access, 문서 URL과 GitHub metadata exact diff를 별도로 승인해야 한다.
