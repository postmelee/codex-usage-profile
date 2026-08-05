# Task #74 Stage 2 단계 보고서

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
구현계획서: [`task_m100_74_impl.md`](../plans/task_m100_74_impl.md)
Stage: 2

## 단계 목적

공개 카드 미디어 계약에 light/dark theme 축을 추가하되 기존 query 없는 dark URL과 legacy contract v3 객체를 보존한다. light stable 객체는 staging representation으로 취급하고 query 없는 dark stable 객체를 최종 authority로 삼아, publication id와 presentation digest가 일치할 때만 공개 응답하도록 memory/R2/S3/HTTP 경계를 구현한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/media-store-contract.js` | contract v4, theme-aware revision/stable key, nested representation, legacy v3 dark reader와 memory store를 구현했다. |
| `src/profile-media/index.js` | theme/format/legacy contract 상수와 정규화·representation helper를 공개했다. |
| `src/profile-media/r2-binding/store.js` | light 선행 staging, dark authority commit/read, metadata coherence와 conditional race 재검증을 구현했다. |
| `src/profile-media/s3/store.js` | S3-compatible COPY/HEAD/GET 경로에 동일한 dual stable authority 계약을 구현했다. |
| `src/profile-backend/http.js` | 공개 GET/HEAD의 `theme=dark|light` strict normalize와 fail-closed 404 매핑을 구현했다. |
| `src/profile-media/__tests__/*.test.js`, `src/profile-media/__tests__/_r2-fixtures.js` | legacy 호환, light serving, metadata drift, missing/stale light, HEAD→GET race를 검증했다. |
| `src/profile-backend/__tests__/http.test.js` | query 없는 dark 호환, strict theme, media-only light serving과 generic 404를 검증했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 외부 동작은 기존 `/u/{handle}/card.png`와 legacy v3 dark publication을 유지했다. 신규 `?theme=light`는 contract v4 dark authority와 light metadata/body가 일치할 때만 응답하며, Stage 3 전까지 기존 publication service는 v3 dark publication을 계속 생성한다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-media/__tests__/media-store-contract.test.js \
  src/profile-media/__tests__/r2-binding-store.test.js \
  src/profile-media/__tests__/r2-binding-failure.test.js \
  src/profile-media/__tests__/r2-publication-concurrency.test.js \
  src/profile-media/__tests__/s3-store.test.js \
  src/profile-media/__tests__/s3-failure.test.js \
  src/profile-backend/__tests__/http.test.js
git diff --check
```

결과:

- OK — Node 테스트 87건 중 86건 통과, 실패 0건.
- SKIP — `TEST_S3_ENDPOINT`, `TEST_S3_BUCKET`, `TEST_S3_ACCESS_KEY_ID`, `TEST_S3_SECRET_ACCESS_KEY`가 없어 실제 S3/MinIO endpoint 통합 테스트 1건을 의도대로 건너뛰었다. command-client 기반 S3 계약 테스트는 통과했다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- Stage 2는 저장·serving 경계만 확장했다. 실제 publication service가 네 PNG representation을 생성·갱신하는 작업은 Stage 3 범위이므로 현재 제품 흐름에서 light URL은 아직 생성되지 않는다.
- 실패한 light staging 뒤 남을 수 있는 비권위 객체의 maintenance/export/cleanup 처리는 Stage 3에서 theme-aware count/digest/recheck 계약으로 확장해야 한다.
- 실제 S3/MinIO endpoint 동작은 gated 환경변수가 없는 현재 환경에서는 검증하지 못했다.

## 다음 단계 영향

- Stage 3 publication service는 contract v4 입력으로 dark/light × en/ko 네 revision을 모두 put한 뒤 light를 staging하고 dark authority를 최종 commit해야 한다.
- visibility compensation, maintenance, export/restore와 orphan cleanup은 query 없는 dark authority를 먼저 재검증하고 light pointer의 publication id/presentation digest를 함께 처리해야 한다.
- legacy v3 dark publication과 query 없는 공개 URL은 이후 단계에서도 유지해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 publication·maintenance·cleanup 일관성 구현으로 진행한다.
