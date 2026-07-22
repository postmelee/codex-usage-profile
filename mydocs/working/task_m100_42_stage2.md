# Task #42 Stage 2 완료 보고서

GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
구현계획서: [`task_m100_42_impl.md`](../plans/task_m100_42_impl.md)
Stage: 2

## 단계 목적

인증된 owner의 공개/비공개 전환을 structured store와 media store 사이에서 안전하게 오케스트레이션한다. owner row를 transaction의 첫 serialization key로 사용하고, `en`/`ko` immutable 저장 완료 뒤 stable publication을 commit point로 삼으며, 부분 실패 시 이전 공개 상태를 보존하거나 신규 stable을 제거하는 보상 경계를 구현한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/publication-service.js` | publish, refresh, unpublish transaction과 stable mutation 보상, visibility 동기화, 멱등 repair 구현 (347행) |
| `src/profile-media/__tests__/publication-service.test.js` | owner-first ordering, locale publication, 멱등/repair, immutable·copy·delete·commit 실패와 보상 검증 (378행) |
| `src/profile-media/index.js` | publication service export 추가 |
| `src/profile-card/service.js` | renderer input `sourceDigest`와 최종 PNG bytes 기반 `revision`/application ETag 분리 |
| `src/profile-card/index.js`, `src/profile-card/__tests__/service.test.js` | card digest helper export와 PNG bytes·avatar 변경 계약 검증 |
| `src/profile-backend/errors.js` | generic `media_unavailable` 오류 코드와 503 status 추가 |
| `src/profile-backend/http.js`, `src/profile-backend/__tests__/http.test.js` | publication service 주입/자동 생성, 기존 `PATCH /api/profile` 연계, safe 503 응답 검증 |
| `src/profile-backend/__tests__/account-usage-submit.test.js` | 실제 렌더 결과가 달라지는 usage 입력으로 PNG ETag 회귀 조건 정정 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업으로 문서 본문 변경은 해당 없다. 기존 `PATCH /api/profile` 요청 payload와 응답 shape는 유지했고, media store가 구성되지 않은 기존 runtime/test 경로는 기존 card visibility service를 계속 사용한다. 인증된 private preview와 현재 공개 route의 동작은 이 단계에서 변경하지 않았으며 공개 route의 R2-only 전환은 Stage 3 범위로 남겼다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-media/__tests__/publication-service.test.js
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-backend/__tests__/http.test.js
node --test
git diff --check
```

결과:

- OK — publication orchestration: 10 passed, 0 failed
- OK — profile card service: 11 passed, 0 failed
- OK — backend HTTP: 35 passed, 0 failed
- OK — 전체 회귀: 342 passed, 0 failed, 5 skipped (총 347 tests)
- OK — `git diff --check` 출력 없음
- SKIP — `TEST_DATABASE_URL` 기반 Postgres 4건과 `TEST_S3_*` 기반 S3 endpoint integration 1건은 환경변수 미설정으로 실행하지 않았다.

## 잔여 위험

- 공개 `/u/{handle}/card.png` route는 아직 structured store와 renderer를 사용한다. Stage 3에서 stable media lookup만 사용하도록 전환해야 한다.
- runtime media mode와 실제 R2 adapter 생성·readiness는 Stage 4 범위이므로 현재 production runtime에는 media store가 자동 연결되지 않는다.
- 보상 동작도 실패하는 distributed partial failure는 generic 503과 내부 `compensation: failed` 상태로 구분한다. 더 넓은 failure/concurrency matrix는 Stage 5에서 고정한다.

## 다음 단계 영향

- Stage 3 공개 route는 publication service가 기록한 stable metadata를 진실 원천으로 사용하고, `en`은 stable body, `ko`는 referenced immutable body를 반환해야 한다.
- 미published, private, 불완전 metadata와 storage 조회 실패는 동일한 public 404로 닫고, 인증 private preview는 on-demand `private, no-store`를 유지해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3로 진행한다.
