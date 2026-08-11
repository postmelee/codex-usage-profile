# Task #42 Stage 1 완료 보고서

GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
구현계획서: [`task_m100_42_impl.md`](../plans/task_m100_42_impl.md)
Stage: 1

## 단계 목적

공개 card media의 저장 경계를 contract v2로 고정하고, Cloudflare R2와 MinIO에 공통으로 연결할 수 있는 AWS SDK 기반 S3-compatible adapter를 구현한다. locale별 immutable revision과 handle 기반 stable publication을 분리하고, 최종 PNG bytes의 SHA-256 digest를 revision 및 application ETag의 진실 원천으로 사용한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/media-store-contract.js` | contract v2, `en`/`ko` locale, owner revision/stable key, PNG digest 검증, publication record, memory fixture 구현 (401행) |
| `src/profile-media/index.js` | media contract와 S3 adapter의 server-side export 진입점 추가 (30행) |
| `src/profile-media/s3/client.js` | AWS S3 client 생성, R2/테스트 S3 env 해석, timeout/retry/path-style 설정 추가 (127행) |
| `src/profile-media/s3/store.js` | conditional immutable PUT, locale publication COPY, GET/HEAD metadata 검증, stable DELETE, 오류 정규화 구현 (496행) |
| `src/profile-media/__tests__/media-store-contract.test.js` | contract v2 key, locale, digest, 멱등성, publication 원자성, unpublish 회귀 검증 (207행) |
| `src/profile-media/__tests__/s3-store.test.js` | fake command client contract test와 `TEST_S3_*` gated integration test 추가 (287행) |
| `package.json`, `package-lock.json` | `@aws-sdk/client-s3` production dependency 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업으로 문서 본문 변경은 해당 없다. 기존 runtime/backend route에는 아직 adapter를 연결하지 않았으므로 현재 공개·private card 동작은 보존된다. 기존 media contract는 계획대로 version 2로 교체했으며, 해당 contract를 직접 사용하는 기존 테스트를 함께 갱신했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-media/__tests__/media-store-contract.test.js
node --test src/profile-media/__tests__/s3-store.test.js
node --test
git diff --check
```

결과:

- OK — media contract: 6 passed, 0 failed
- OK — S3 adapter: 3 passed, 0 failed, 1 skipped
- OK — 전체 회귀: 327 passed, 0 failed, 5 skipped (총 332 tests)
- OK — `git diff --check` 출력 없음
- SKIP — `TEST_S3_ENDPOINT`, `TEST_S3_BUCKET`, `TEST_S3_ACCESS_KEY_ID`, `TEST_S3_SECRET_ACCESS_KEY`가 없어 실제 S3/MinIO endpoint integration 1건은 실행하지 않았다.

## 잔여 위험

- 실제 R2/MinIO endpoint에서 conditional PUT, `MetadataDirective=REPLACE` copy, custom metadata round trip을 아직 검증하지 못했다. 환경이 제공되면 동일한 gated integration test를 재실행해야 한다.
- 이 단계는 저장 contract와 adapter만 구현했다. owner 직렬화, structured visibility transaction, 보상 동작은 Stage 2에서 연결하므로 아직 runtime publish 동작은 제공하지 않는다.

## 다음 단계 영향

- Stage 2 publication service는 `createProfileMediaRevisionDigest`를 사용해 최종 `en`/`ko` PNG bytes의 revision을 산출하고, 두 immutable write가 모두 끝난 뒤 stable copy를 publication commit point로 사용한다.
- publish/unpublish와 이후 submit refresh는 owner 단위 직렬화, visibility transaction, stable copy/delete 실패 보상을 함께 구현해야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
