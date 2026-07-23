# Task #42 Stage 3 완료 보고서

GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
구현계획서: [`task_m100_42_impl.md`](../plans/task_m100_42_impl.md)
Stage: 3

## 단계 목적

공개 카드 URL을 structured store와 on-demand renderer에서 분리하고, media store의 stable publication만 서빙하도록 전환한다. 공개 GET/HEAD/304/404, `en`/`ko` locale, private preview 비영속 경계를 실행 가능한 테스트로 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/http.js` | 공개 카드 GET/HEAD를 `mediaStore.getPublishedCard` 전용 경로로 교체하고 media contract의 content type/cache control/application ETag를 검증한다. media 없음·불완전 metadata·adapter 오류는 같은 404로 닫는다. |
| `src/profile-backend/__tests__/http.test.js` | `en`/`ko`/fallback, GET/HEAD/304/unpublish, 공개 route의 structured store·renderer non-access, 동일 404, private preview media non-write를 검증한다. |
| `src/profile-media/s3/store.js` | body를 읽지 않는 `ko` HEAD/304에서도 stable metadata가 참조한 immutable revision의 존재와 application ETag를 확인한다. |
| `src/profile-media/__tests__/s3-store.test.js` | 참조된 `ko` immutable object가 없을 때 HEAD/304가 fail closed하는 회귀 테스트를 추가한다. |
| `src/profile-runtime/__tests__/dev-server.test.js` | memory media store를 runtime fixture에 연결하고 stable publication, HEAD, conditional GET, private 404 및 명시적 republish 경계를 검증한다. |
| `src/profile-runtime/__tests__/host-adapter.test.js` | locale query를 포함한 공개 HEAD route가 backend handler로 전달되는지 고정한다. |
| `packages/codex-usage-profile-cli/test/integration.test.js` | Stage 4의 submit 자동 refresh 전까지 CLI submit만으로 stable ETag가 바뀌지 않고 명시적 republish 후 변경되는 단계 경계를 반영한다. |
| `mydocs/orders/20260722.md` | Task #42 상태를 Stage 3 완료·승인 대기로 갱신한다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업으로 문서 본문 재작성은 없다. 인증된 private preview의 session 인증, on-demand render, `private, no-store` 동작과 공개 URL 형식은 보존했다. 공개 route의 데이터 원천만 승인된 stable media 계약으로 교체했으며 Share Studio UI와 runtime external R2 wiring은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/http.test.js
node --test src/profile-runtime/__tests__/dev-server.test.js src/profile-runtime/__tests__/host-adapter.test.js
node --test src/profile-media/__tests__/media-store-contract.test.js
node --test src/profile-media/__tests__/s3-store.test.js
node --test packages/codex-usage-profile-cli/test/integration.test.js
node --test
git diff --check
```

결과:

- OK — backend HTTP 37건 통과. 공개 media-only GET/HEAD/304/404와 private preview 경계를 확인했다.
- OK — runtime dev-server/host-adapter 11건 통과. stable route 전달과 runtime fixture 동작을 확인했다.
- OK — media store contract 6건 통과.
- OK — S3 adapter 4건 통과, 설정이 없는 실제 S3-compatible endpoint 1건은 계획대로 skip했다.
- OK — CLI integration 2건 통과. Stage 3의 명시적 republish 경계를 확인했다.
- OK — 전체 350건 중 345건 통과, 환경 의존 5건 skip, 실패 0건.
- OK — `git diff --check` 통과.

## 잔여 위험

- production runtime은 아직 external media mode와 R2 client를 생성·주입하지 않는다. Stage 4에서 `PROFILE_MEDIA_MODE=external`과 `R2_*` fail-closed wiring을 구현해야 한다.
- public owner의 changed/idempotent CLI submit 후 동기 media refresh와 `media_unavailable` 503 safe retry 계약은 Stage 4 범위다. 현재 Stage 3에서는 기존 stable이 명시적 republish 전까지 유지된다.
- `TEST_S3_*`와 `TEST_DATABASE_URL`이 없어 실제 S3-compatible endpoint와 Postgres 환경 의존 테스트 5건은 실행되지 않았다.

## 다음 단계 영향

- Stage 4는 이 단계에서 고정한 media-only public route에 runtime media store를 주입하고, changed/idempotent submit 양쪽에서 `refreshPublishedCard`를 호출해야 한다.
- submit 후 structured usage commit은 보존하되 media refresh 실패를 generic 503과 안전한 exact retry로 표현해야 한다.
- frontend import graph와 client bundle에는 `R2_*`, `TEST_S3_*` key 및 credential 값이 포함되지 않음을 검증해야 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 — future submit refresh와 runtime wiring으로 진행한다.
