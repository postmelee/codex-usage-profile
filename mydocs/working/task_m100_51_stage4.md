# Task #51 Stage 4 단계 보고서

GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)  
구현계획서: [`task_m100_51_impl.md`](../plans/task_m100_51_impl.md)  
Stage: 4

## 단계 목적

Gate A 승인 범위 안에서 production GitHub OAuth, D1/R2 linkage와 migration을 포함한 Sites full-stack candidate를 기존 Site에 배포하고, 공개 접근을 열지 않은 owner-only 상태에서 데이터 lifecycle과 GitHub/CLI/card 계약을 검증한다. 검증 종료 시 maintenance를 비활성화하고 test session/token/publication을 정리해 Stage 5 Gate B의 입력을 고정한다.

## 산출물

| 파일 또는 원격 상태 | 변경 요약 |
|---|---|
| `src/profile-runtime/sites/worker.js` | 정적 파일이 아닌 SPA GET/HEAD에 `/index.html` fallback을 적용했다. |
| `src/profile-runtime/sites/__tests__/worker.test.js` | provider asset redirect와 SPA fallback 경계를 회귀 테스트로 고정했다. |
| `src/profile-ui/AccountMenu.jsx` | Sites가 root 이외 SPA HTML 경로를 `/`로 보내는 제약을 피해 설정 링크를 `/?view=settings`로 변경했다. |
| `src/profile-ui/appRoutes.js` | root-query 설정 화면을 기존 Settings route와 같은 화면으로 해석한다. |
| `src/profile-ui/__tests__/appRoutes.test.js` | root-query Settings route 판정을 검증한다. |
| `tests/profile-ui.spec.js` | 실제 Settings 링크 계약을 E2E 기대값과 정렬했다. |
| Sites saved version 5 | source `6e08ee62ba4fd4c3e2e18726568390da436eb115`, 25-file archive를 기존 Site에 저장했다. |
| Sites production deployment | saved version 5를 environment revision 5로 private deployment해 `succeeded`를 확인했다. |
| production GitHub OAuth app | `Codex Usage Profile`, homepage는 production Site origin, callback은 `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/api/auth/github/callback`으로 고정했다. client secret은 Sites secret으로만 보관한다. |
| repository 밖 durable backup | 원본 export 5 objects를 mode `0600`으로 보존한다. payload와 실제 경로는 저장소·로그·보고서에 기록하지 않았다. |

배포 중 확인한 hosted 차이를 source/test로 보완하기 위해 다음 하위 단계 커밋을 사용했다.

- `06fc582` — Worker SPA fallback 보완
- `6e08ee6` — Sites용 Settings root-query route 보완과 saved version 5 source
- `6235f9f` — 배포 동작과 E2E 기대값 정렬(test-only)

## 본문 변경 정도 / 본문 무손실 여부

기존 제품·운영 문서는 변경하지 않았다. 앱이 제공하던 API, Account Usage Contract v1, GitHub OAuth/session, CLI와 card URL 계약은 유지했다. source 변경은 SPA asset fallback과 owner Settings 화면의 Sites 호환 진입점에 한정했다.

Sites 앞단은 `/settings`, `/device`, `/profile` 같은 extension 없는 직접 HTML deep link를 Worker보다 먼저 `307 /`로 보낸다. 내부 Settings 링크는 `/?view=settings`로 우회해 실제 owner UI에서 token revoke까지 검증했지만, 기존 clean deep link 자체의 호스팅 계층 동작은 바뀌지 않았다.

## 원격 검증 결과

### Site, access와 environment

- production URL: `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`
- display title: `Codex Usage Profile`
- saved version: 5
- deployment: `succeeded`
- access: `custom`, owner 1명만 허용, user 추가 0명, workspace/tenant group 0개
- environment revision: 5
- `PROFILE_MAINTENANCE_MODE=disabled`
- `PROFILE_SERVICE_MODE=normal`
- burst limit: 5/10초, sustained limit: 30/60초, stop retry: 300초
- GitHub client secret과 maintenance token은 Sites secret으로 확인했으며 plaintext를 읽거나 기록하지 않았다.
- 배포·환경·OAuth 준비 과정에서 plan upgrade, 결제수단 등록 또는 추가 과금 승인 요구가 나타나지 않았다. 이는 이번 작업 중 관찰 결과이며 향후 가격·quota의 영구 보장은 아니다.

### D1/R2 lifecycle

- 기존 Stage 5 test data cleanup plan/apply: 19 objects, 종료 후 0 remaining
- 원본 export: 5 objects, manifest digest/count 일치
- disposable restore: 5 objects, profile 값 diff 0
- stale/avatar mismatch repair: guard 불일치는 `409`로 거부했고 production fallback repair 3 objects 성공
- post-repair disposable cleanup: 9 objects, 종료 후 0 remaining
- disposable backup은 검증 종료 후 폐기해 복구할 수 없다.
- 원본 durable backup은 보존한다. 인증·일시 상태, secret과 로컬 세션은 backup 대상이 아니다.
- maintenance를 비활성화한 뒤 maintenance route가 generic `404`를 반환했다.

### OAuth, CLI와 card

- production GitHub OAuth callback, secure session과 owner account load 성공
- packed CLI device login → browser approval → exchange → Account Usage Contract v1 submit 성공
- 전송 범위는 승인된 집계 필드뿐이며 prompt, response, Codex/OpenAI 인증정보와 로컬 session file은 전송하지 않았다.
- private-by-default profile과 private preview `200`, `private, no-store` 확인
- publish 후 stable card `GET 200`, `HEAD 200`, matching ETag의 `304`, missing card `404` 확인
- unpublish 후 public profile/card 모두 `404` 확인
- Settings UI에서 임시 CLI token을 revoke했고 같은 token의 status가 `410 gone`인 것을 확인했다.
- packed CLI local credential 제거와 GitHub browser session logout 완료
- 종료 상태에서 API token 0개, profile visibility `private`, public profile/card `404`

### 로그와 민감정보

- 최근 30분 Worker event 24건과 최근 180분 error-only event 12건을 검사했다.
- error-only 항목은 검증에서 의도한 `auth 401`, public/asset `404`, revoked account usage token `410`이었다.
- Worker execution outcome은 `ok`였고 unexpected 5xx/crash를 확인하지 못했다.
- cookie는 redacted marker, authorization은 실제 bearer가 아닌 8자 masking 값으로만 남았다.
- GitHub secret, maintenance token, Account Usage 집계 필드, prompt/response/private payload가 log에 나타나지 않았다.

## 검증 결과

실행 명령:

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm test
npm run test:e2e
git diff --check
```

결과:

- `npm test`: OK — 477 tests, 471 pass, 6 skip, 0 fail
- `npm run test:e2e`: OK — 15 pass, 0 fail
- `npm run build:production`: OK
- `npm run verify:sites-fullstack`: OK — client 7, migration 2, worker 2
- `npm run verify:sites-production`: OK — artifact 5,399,868 bytes, expected bindings 3
- `git diff --check`: OK
- card renderer가 전체 병렬 test run 한 번에서 worker-level로 일시 실패했으나 같은 파일 단독 재실행 2/2와 최종 전체 재실행 477/477에서 통과했다.

## 잔여 위험

- Sites는 extension 없는 root 외 HTML deep link를 Worker 앞단에서 `307 /`로 처리한다. Settings 내부 이동은 root-query route로 해결했지만 `/settings`, `/device`, `/profile`, `/u/{handle}` clean HTML deep link의 직접 진입은 그대로다. Stage 5에서는 공개 card `.png` 계약과 별도로 anonymous HTML profile 요구 범위를 확인해야 한다.
- 이번 단계에서는 owner-only 접근만 검증했다. anonymous landing, unauthenticated API, GitHub OAuth와 rate-limit 경계는 짧은 Gate B public smoke에서 확인해야 한다.
- Sites beta의 가격·quota와 과금 정책은 바뀔 수 있다. 각 Gate에서 추가 과금/upgrade 요구를 다시 확인하고 나타나면 즉시 owner-only로 중단한다.
- 원본 durable backup은 민감한 repository 밖 운영 자산이다. Stage 6 보존 기간 승인 전까지 mode `0600`을 유지하고 payload/path를 공유하지 않는다.

## 다음 단계 영향

- Gate B가 승인되기 전 Site access는 `custom` owner-only를 유지하며 public access update를 호출하지 않는다.
- Gate B는 saved version 5와 environment revision 5를 그대로 사용하고 source/environment를 변경하지 않는다.
- public smoke는 anonymous landing/static, unauthenticated private API, GitHub OAuth, packed CLI, publish/unpublish stable card와 abuse guard만 bounded request로 수행한다.
- smoke 종료 즉시 access를 같은 owner-only policy로 원복하고 publication/session/token/test data를 정리한다.
- clean HTML deep link가 Gate B의 필수 사용자 계약이면 공개 전환을 중단하고 별도 route 설계를 승인받아야 한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 Gate B로 진행한다.
- Gate B 승인 범위는 기존 URL을 잠시 public으로 전환해 정해진 anonymous/OAuth/CLI/card matrix만 확인한 뒤 즉시 owner-only로 원복하는 것이다. 최종 공개 전환은 포함하지 않으며 추가 과금이 요구되면 진행하지 않는다.
