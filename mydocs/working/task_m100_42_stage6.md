# Task #42 Stage 6 완료 보고서

GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
구현계획서: [`task_m100_42_impl.md`](../plans/task_m100_42_impl.md)
Stage: 6

## 단계 목적

[PR #48 리뷰 코멘트](https://github.com/postmelee/codex-usage-profile/pull/48#issuecomment-5054026577)의 승인된 발견 1·5를 반영한다. 공개 card의 publication 부재·불완전 상태와 R2 provider 장애를 404/503으로 분리하고, stable HEAD→GET 사이 conditional 412를 한 번 재시도해 일시적 republish 경합이 404로 캐시되지 않게 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/media-store-contract.js`, `index.js` | `conflict`, `invalid`, `not_found`, `unavailable` store error code를 공통 계약으로 export |
| `src/profile-media/s3/store.js` | malformed object를 `invalid`로 분류하고 `NoSuchBucket`을 unavailable로 처리, stable conditional GET을 publication HEAD부터 1회 재시도 |
| `src/profile-media/__tests__/s3-store.test.js`, `s3-failure.test.js` | malformed metadata, NoSuchBucket, 성공 retry와 반복 412 unavailable 회귀 test 추가 |
| `src/profile-media/publication-service.js`, 관련 test | `invalid` stable publication을 incomplete repair 대상으로 유지 |
| `src/profile-backend/http.js`, 관련 test | missing/invalid/conflict 404와 transient/unknown generic 503·`Retry-After: 5` 분기 |
| `docs/production-hosting.md`, `docs/readme-card.md` | 공개 card 404/503와 conditional read recovery 계약 현행화 |
| `mydocs/report/task_m100_42_report.md` | 단계 수, 수용 기준과 최종 검증 결과를 Stage 6 기준으로 갱신 |
| `mydocs/orders/20260723.md` | Task #42 Stage 6 완료 기록 |

## 본문 변경 정도 / 본문 무손실 여부

- 기존 공개 URL, successful GET/HEAD/304, private/missing/incomplete 404와 private preview 계약은 유지했다.
- R2 provider·timeout·bucket 또는 예상 밖 adapter 장애만 generic `503 media_unavailable`로 분리했다. response에 credential, endpoint, bucket, cause를 포함하지 않는다.
- stable GET의 `If-Match`는 metadata/body 혼합 방지를 위해 유지하고, 412가 한 번 발생한 경우에만 최신 HEAD부터 다시 읽는다.
- 승인 범위 밖인 cleanup 전수 재확인·incomplete metadata fail-safe 중단과 기존 metadata shape는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-media/__tests__/s3-store.test.js src/profile-media/__tests__/s3-failure.test.js
node --test src/profile-media/__tests__/publication-service.test.js
node --test src/profile-backend/__tests__/http.test.js
npm test
npm run build
git diff --check
```

결과:

- OK — S3 adapter/failure: 16건 중 15 pass, `TEST_S3_*` 미설정 1 skip, 0 fail
- OK — publication service: 11 pass, 0 fail
- OK — backend HTTP: 40 pass, 0 fail
- OK — 전체 회귀: 378건 중 372 pass, 환경 의존 6 skip, 0 fail
- OK — Vite production build: 38 modules, build 오류 없음
- OK — `git diff --check`: 오류 없음
- OK — 추가 client bundle 검사에서 R2 secret env와 S3 client 흔적이 검출되지 않음

## 잔여 위험

- 실제 `TEST_S3_*` endpoint와 `TEST_DATABASE_URL`이 없어 S3-compatible remote 1건과 PostgreSQL 환경 의존 5건은 실행하지 못했다.
- conditional read는 한 번만 재시도하므로 republish가 연속 두 번 겹치면 의도대로 503을 반환한다. 실제 provider latency와 이미지 proxy 동작은 #43 remote 검증 범위다.
- cleanup 전수 재스캔의 비용 개선은 현재 오삭제 방지 의미를 약화하지 않는 방식으로 #43에서 검토해야 한다.

## 다음 단계 영향

- Stage 6는 PR 리뷰 보완의 마지막 구현 단계다. `publish/task42`를 갱신하고 PR #48 본문에 새 head SHA, Stage 6, 372 pass·6 skip 결과와 리뷰 처리 범위를 반영한다.
- 리뷰 코멘트에는 별도 명시가 없어 답글이나 resolve를 수행하지 않는다.

## 승인 요청

- Stage 6 산출물과 갱신된 PR #48을 검토한 뒤 merge 승인을 요청한다.
