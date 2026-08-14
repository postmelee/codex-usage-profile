# Task #100 Stage 2 보고서 — R2·S3 publication authority 정합화

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
구현계획서: [`task_m100_100_impl.md`](../plans/task_m100_100_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 정의한 additive v4 canonical pair와 selector resolver를 native R2·S3 adapter의 실제
authority metadata와 read/write 경로에 적용한다. queryless 요청이 D1이나 renderer를 호출하지 않고
dark stable authority의 저장 대표 설정을 따라가며, explicit variant·legacy fallback·failure·concurrency·
maintenance 계약을 그대로 유지하도록 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/r2-binding/store.js` | R2 canonical metadata read/write, authority-first selection, canonical publish/unpublish result와 authority equality 구현 |
| `src/profile-media/s3/store.js` | S3 canonical metadata read/write, authority-first selection, queryless publish result와 authority equality 구현 |
| `src/profile-media/r2-binding/maintenance.js` | v4 manifest·digest·repair publication에 canonical pair 보존 |
| `src/profile-media/__tests__/r2-binding-store.test.js` | R2 canonical/explicit/legacy/partial-invalid behavior matrix 추가 |
| `src/profile-media/__tests__/r2-binding-failure.test.js` | 동일 storage ETag에서 canonical authority drift fail-close 회귀 추가 |
| `src/profile-media/__tests__/r2-binding-maintenance.test.js` | object count 유지, canonical digest 변화와 tombstone/repair 보존 검증 |
| `src/profile-media/__tests__/s3-store.test.js` | S3 canonical/explicit/legacy/partial-invalid behavior matrix 추가 |
| `src/profile-media/__tests__/s3-failure.test.js` | 동일 storage ETag에서 canonical authority drift fail-close 회귀 추가 |
| `mydocs/orders/20260813.md` | Stage 2 완료와 Stage 3 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. contract version v4, dark/light stable key, 네
immutable revision key, authority·revision object 수와 cleanup prefix는 변경하지 않았다. 새 v4 dark
stable authority metadata에 `canonical-locale`, `canonical-theme` 두 field만 추가했으며 light stable
representation은 계속 dark stable의 publication id·presentation digest를 참조한다.

R2·S3 reader는 요청 입구에서 selector를 dark/en으로 먼저 바꾸지 않는다. dark authority를 읽어
canonical pair 전체를 검증한 뒤 selector가 없으면 canonical, 하나라도 있으면 explicit mode로 variant를
고른다. canonical이 light/ko여도 외부 `stableKey`는 queryless authority path이고 실제 bytes는 기존
light stable 또는 immutable ko revision에서 읽는다.

기존 v4 metadata에서 canonical pair가 모두 없으면 dark/en으로 읽는다. 둘 중 하나만 있거나 지원하지
않는 값이면 explicit 요청을 포함한 모든 authority read가 `invalid`로 fail-close한다. GET 중 같은
storage ETag에서 canonical metadata만 달라져도 `samePublicationAuthority`가 drift를 감지한다.

## 검증 결과

구현계획서 Stage 2 명령:

```bash
node --test src/profile-media/__tests__/r2-binding-store.test.js src/profile-media/__tests__/r2-binding-failure.test.js src/profile-media/__tests__/r2-publication-concurrency.test.js src/profile-media/__tests__/r2-binding-maintenance.test.js
node --test src/profile-media/__tests__/s3-store.test.js src/profile-media/__tests__/s3-failure.test.js
npm run cleanup:card-media -- --help
git diff --check
```

결과:

- OK — R2 27 tests, 27 pass, 0 fail, 0 skip.
- OK — S3 20 tests 중 19 pass, 0 fail, 설정되지 않은 실제 endpoint integration 1건 skip.
- OK — canonical light/ko queryless body·ETag·stable key, theme-only와 locale-only explicit 기본값을
  R2/S3에서 동일하게 검증했다.
- OK — legacy pair 전체 부재, partial/invalid pair, metadata drift, R2 publish/unpublish concurrency와
  S3 conditional read failure가 fail-close 또는 coherent retry 계약을 유지했다.
- OK — R2 owner manifest는 기존과 같은 v4 object count 6을 유지하고 canonical pair 변화가 maintenance
  digest에 반영되며 tombstone/repair 뒤에도 pair가 보존됐다.
- OK — cleanup CLI help가 dry-run 기본값과 기존 retention 조건을 출력했고 실제 삭제는 수행하지 않았다.
- OK — `git diff --check` 경고 없음.

추가 회귀 명령:

```bash
node --test src/profile-media/__tests__/*.test.js
```

결과:

- OK — 105 tests 중 103 pass, 0 fail, 환경 변수가 없는 Postgres/S3 integration 2건 skip.
- OK — memory contract, publication compensation, social card와 maintenance 전체 회귀 통과.

## 잔여 위험

- publication service는 아직 owner의 저장 theme·locale을 publication input에 넣지 않으므로 production
  publish는 canonical dark/en 기본값을 기록한다. Stage 3에서 owner/usage snapshot과 함께 연결한다.
- publication service의 이전 publication restore input은 아직 canonical pair를 복사하지 않는다.
  Stage 3 transaction refactor에서 restore·exact retry 경로와 함께 보정해야 한다.
- public HTTP route가 selector 부재를 dark로 변환하므로 외부 queryless endpoint는 아직 canonical
  mode를 호출하지 않는다. Stage 3에서 raw selector presence를 보존해야 한다.

## 다음 단계 영향

- Stage 3 publication input은 owner의 committed `cardStyle.theme`과 `cardLocale`을 각각
  `canonicalTheme`, `canonicalLocale`로 전달한다.
- settings prepare는 immutable revision만 쓰고 owner CAS 이전에는 이번 Stage의 stable authority
  writer를 호출하지 않는다. CAS 이후 committed owner/usage version을 확인한 뒤 publish한다.
- restore, idempotency와 supersession 비교는 canonical pair까지 보존해야 하며 exact same settings
  retry가 DB 성공/media 실패 간극을 수렴시키는 테스트를 둔다.
- HTTP route는 `theme`, `locale`의 실제 query 존재 여부만 store option에 반영하고 `v` 등 다른 query는
  canonical mode를 유지한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 설정 publication commit과 public endpoint 전환으로
  진행한다.
