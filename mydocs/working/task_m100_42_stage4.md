# Task #42 Stage 4 완료 보고서

GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
구현계획서: [`task_m100_42_impl.md`](../plans/task_m100_42_impl.md)
Stage: 4

## 단계 목적

공개 owner의 Account Usage submit이 structured usage 저장 후 stable card publication을 동기 갱신하도록 연결한다. media 실패 시 저장 결과를 보존한 채 안전한 exact retry가 가능한 503 계약을 제공하고, development memory media와 production external R2 media의 생성·readiness·shutdown 경계를 runtime에 연결한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/http.js` | accepted 및 exact idempotent public submit 뒤 `refreshPublishedCard`를 호출하고, refresh 실패를 generic `media_unavailable`로 정규화한다. |
| `src/profile-backend/errors.js`, `index.js` | `media_unavailable`의 고정 503, `Retry-After: 5`, 안전한 error factory/export를 정의한다. |
| `src/profile-backend/__tests__/http.test.js` | accepted/idempotent refresh 호출, refresh 실패 뒤 usage commit 보존, exact retry 복구와 stable header를 검증한다. |
| `src/profile-media/publication-service.js` | publication 실패를 공통 media unavailable error factory로 생성해 HTTP retry 계약을 일관되게 유지한다. |
| `packages/codex-usage-profile-cli/src/submit.js` | 503 `media_unavailable`을 usage 저장 완료와 안전한 재실행을 알리는 `submit_media_unavailable`로 매핑한다. |
| `packages/codex-usage-profile-cli/test/submit.test.js`, `integration.test.js` | media 오류 안내와 비자동 retry, accepted/idempotent submit의 stable ETag 자동 refresh를 검증한다. |
| `src/profile-runtime/deployment-config.js`, `config.js` | `PROFILE_MEDIA_MODE=memory|external`을 정규화하고 production에서 external만 허용한다. config 결과에는 credential을 포함하지 않는다. |
| `src/profile-runtime/runtime-backend.js` | development/runtime backend의 기본 memory media store를 생성해 publication service에 주입한다. |
| `src/profile-runtime/production-server.js` | external mode에서만 `R2_*`를 읽어 S3-compatible store를 만들고, runtime 소유 media store의 readiness와 close를 관리한다. |
| `src/profile-runtime/__tests__/deployment-config.test.js` | media mode 기본값, production 제한, invalid mode를 검증한다. |
| `src/profile-runtime/__tests__/dev-server.test.js` | 별도 media fixture 주입 없이 memory default와 submit 후 stable 자동 refresh를 검증한다. |
| `src/profile-runtime/__tests__/production-server.test.js` | R2 env fail-closed, external adapter 계약, runtime-owned readiness/close와 injected store 비소유 경계를 검증한다. |
| `.env.example` | local memory mode, production `R2_*`, gated MinIO/S3-compatible `TEST_S3_*` 이름을 예시한다. |
| `mydocs/orders/20260723.md` | Task #42 상태를 Stage 4 완료·승인 대기로 기록한다. |

## 본문 변경 정도 / 본문 무손실 여부

제품·아키텍처 본문 문서는 변경하지 않았다. `.env.example`에는 승인된 runtime/media 환경변수 이름만 추가했다. 기존 private preview, public route URL/locale/cache 계약, structured submit response shape와 Share Studio UI 제외 범위는 보존했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/http.test.js
node --test packages/codex-usage-profile-cli/test/submit.test.js
node --test src/profile-runtime/__tests__/deployment-config.test.js src/profile-runtime/__tests__/dev-server.test.js src/profile-runtime/__tests__/production-server.test.js
npm run build
! rg -n "R2_SECRET_ACCESS_KEY|TEST_S3_SECRET_ACCESS_KEY" dist src/profile-ui
node --test
git diff --check
```

추가 검사:

```bash
! rg -n "@aws-sdk/client-s3|HeadBucketCommand|cloudflarestorage|R2_SECRET_ACCESS_KEY|TEST_S3_SECRET_ACCESS_KEY" dist src/profile-ui
```

결과:

- OK — backend HTTP 39건 통과. public accepted/idempotent refresh와 usage commit 보존·exact retry 복구를 확인했다.
- OK — CLI submit 7건 통과. media refresh 503을 credential 재로그인 없이 안전한 재실행으로 안내한다.
- OK — deployment/dev/production runtime 24건 통과. memory/external mode, readiness, ownership·close를 확인했다.
- OK — Vite production build 성공. client bundle 38 modules, build 오류 없음.
- OK — `dist`와 `src/profile-ui`에서 R2/test secret env 이름 및 AWS S3 client 흔적이 검출되지 않았다.
- OK — 전체 357건 중 352건 통과, 환경 의존 5건 skip, 실패 0건.
- OK — `git diff --check` 통과.

## 잔여 위험

- 실제 `TEST_S3_*` endpoint와 `TEST_DATABASE_URL`이 없어 S3-compatible endpoint 1건과 Postgres 환경 의존 4건은 계획대로 skip했다.
- command-level S3 failure/timeout, publish↔unpublish 및 submit refresh concurrency는 Stage 5의 failure matrix에서 추가 검증해야 한다.
- immutable revision retention/orphan cleanup 도구와 정책 문서, README card 운영 문서는 Stage 5 범위다.

## 다음 단계 영향

- Stage 5는 이번 단계의 production R2 factory와 submit refresh를 대상으로 failure injection 및 owner별 concurrency 순서를 고정해야 한다.
- cleanup은 stable metadata가 참조하는 revision을 보호하고, 기본 dry-run·90일·최근 5개·삭제 직전 재확인 규칙을 구현해야 한다.
- 최종 문서는 최초 publish, locale, submit refresh 실패/재시도와 server-only env 운영 계약을 현재 제품 문서 위치에 반영해야 한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 — failure/concurrency·retention·문서 통합으로 진행한다.
