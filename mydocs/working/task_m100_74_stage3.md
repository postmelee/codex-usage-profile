# Task #74 Stage 3 단계 보고서

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
구현계획서: [`task_m100_74_impl.md`](../plans/task_m100_74_impl.md)
Stage: 3

## 단계 목적

Stage 2에서 확정한 media contract v4와 dual stable authority를 실제 publish·refresh·설정 저장 흐름에 연결한다. dark/light × en/ko 네 PNG를 light 선행 staging 후 dark authority로 공개하고, structured CAS 실패 시 publication ID와 storage ETag를 기준으로 보상한다. owner maintenance, exact repair/delete와 orphan cleanup도 theme-aware count·digest·재검증 계약으로 확장한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/publication-service.js` | normalized card style로 네 변형을 생성하고 light revision을 먼저 저장한 뒤 v4 authority를 commit한다. legacy v3 dark revision 재사용, settings prepare/rollback과 v3/v4 compensation을 구현했다. |
| `src/profile-card/service-core.js`, `src/profile-backend/http.js` | 공개 owner의 카드 설정 저장 전에 v4 media를 수렴시키고 owner CAS 실패 시 준비된 publication을 rollback하도록 내장 publication service를 연결했다. |
| `src/profile-media/media-store-contract.js`, `src/profile-media/r2-binding/store.js`, `src/profile-media/s3/store.js` | 동일 bytes의 legacy v3 dark immutable revision을 v4 전환 중에만 제한적으로 재사용하고 그 외 presentation drift는 계속 fail-close한다. |
| `src/profile-media/maintenance-contract.js`, `src/profile-media/r2-binding/maintenance.js` | revision을 owner·theme·locale별로 분류하고 dark/light stable 및 네 representation의 exact count, metadata, 보호 집합과 repair 계약을 구현했다. |
| `src/profile-runtime/sites/maintenance.js`, `scripts/sites-profile-maintenance.mjs` | export/restore object count와 repair 입력을 v4 nested representation으로 확장하고, light 변형을 먼저 복구한 뒤 dark authority를 교체하도록 했다. |
| `scripts/cleanup-orphan-card-media.mjs` | v4 authority가 참조하는 네 revision을 보호하고 light stable을 집계하며, unknown contract에서 삭제 없이 중단하도록 보강했다. 기본 dry-run과 삭제 직전 authority 재조회는 유지했다. |
| 관련 publication·HTTP·R2 maintenance·Sites maintenance·cleanup 테스트 | 네 변형 publish, legacy 수렴, 설정 rollback, public light route, exact count, repair 순서, cleanup 보호와 unknown contract fail-close를 검증했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 기존 query 없는 dark 공개 URL, legacy v3 dark publication 읽기, private owner의 media 비변경, tombstone 우선 unpublish와 dry-run cleanup 기본값은 유지했다. v4 전환 호환은 동일 owner·locale·revision·ETag의 legacy dark immutable 객체에만 허용하며 light 또는 metadata가 다른 객체는 계속 충돌로 처리한다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-media/__tests__/publication-service.test.js \
  src/profile-media/__tests__/publication-concurrency.test.js \
  src/profile-media/__tests__/r2-publication-concurrency.test.js \
  src/profile-media/__tests__/r2-binding-maintenance.test.js \
  src/profile-backend/__tests__/d1-maintenance.test.js \
  scripts/__tests__/cleanup-orphan-card-media.test.js \
  scripts/__tests__/sites-profile-maintenance.test.js
git diff --check
```

결과:

- OK — 지정 Node 테스트 46건 중 45건 통과, 실패 0건.
- SKIP — `TEST_DATABASE_URL`이 없어 PostgreSQL의 서로 다른 owner 동시 publish 통합 테스트 1건을 의도대로 건너뛰었다. memory와 R2 publication 동시성 테스트는 모두 통과했다.
- OK — 보강 검증으로 profile media 전체 67건 중 65건 통과, 실패 0건, gated PostgreSQL/S3 endpoint 2건 skip을 확인했다.
- OK — profile card 전체 41건, HTTP 43건, Sites maintenance 9건을 모두 통과했다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- 실제 PostgreSQL과 S3/MinIO endpoint 환경변수가 없어 외부 endpoint 통합 테스트 2건은 실행하지 못했다. in-memory, command-client, native R2 fake, D1 Miniflare 경계는 통과했다.
- unpublish 뒤 남는 비권위 light stable 객체는 공개 authority가 없어 serving되지 않으며 retention/owner exact cleanup이 처리한다. 운영 환경에서 apply할 때는 기존처럼 fresh plan과 digest/count 재확인이 필요하다.
- Profile 화면의 테마 선택·preview·저장 UX는 Stage 4 범위이므로 아직 사용자 UI에서 새 설정을 조작할 수 없다.

## 다음 단계 영향

- Stage 4는 `GET /api/profile`의 저장된 `cardStyle`과 theme별 private preview URL을 사용해 draft와 saved state를 분리해야 한다.
- 저장 버튼은 기존 `PATCH /api/profile/card-settings`만 호출하며, 성공 응답 후 selected/public URL을 갱신하고 실패 시 draft를 유지해야 한다. 공개 owner의 v4 media 수렴과 rollback은 이번 Stage의 backend가 담당한다.
- 사이트 전역 Appearance와 카드 theme는 독립 상태로 유지하고 future effect preset을 같은 canonical `cardStyle` composition에 추가할 수 있어야 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 Profile light/dark 전환·미리보기·저장 UX 구현으로 진행한다.
