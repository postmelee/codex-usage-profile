# Task #100 Stage 1 보고서 — canonical selection 계약과 memory store

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
구현계획서: [`task_m100_100_impl.md`](../plans/task_m100_100_impl.md)
Stage: 1

## 단계 목적

media contract v4의 storage key와 네 immutable revision 구조를 유지하면서 publication이 대표
`theme`·`locale`을 소유하도록 additive canonical pair를 정의한다. selector가 없는 요청과 명시
selector 요청을 구분하는 공통 resolver를 만들고 memory store에서 queryless canonical 동작,
explicit variant 하위 호환과 legacy dark/en fallback을 먼저 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/media-store-contract.js` | canonical pair normalizer·selection resolver 추가, v4 publication과 memory read/publish/unpublish에 적용 |
| `src/profile-media/index.js` | 새 contract helper 두 개를 공개 export에 추가 |
| `src/profile-media/__tests__/media-store-contract.test.js` | canonical/explicit/legacy/partial-invalid behavior matrix와 stable key 회귀 추가 |
| `src/profile-media/__tests__/publication-service.test.js` | 기존 service publication의 dark/en canonical 기본값 회귀 추가 |
| `src/profile-media/__tests__/_r2-fixtures.js` | Stage 2 adapter 검증용 canonical pair fixture option 추가 |
| `mydocs/orders/20260813.md` | Stage 1 완료와 Stage 2 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 공개 URL, storage key, contract version, revision
object 수와 explicit variant 의미는 변경하지 않았다. 기존 v3/v4 publication에 canonical field가
모두 없으면 dark/en으로 해석하고, 새 v4 input은 두 field를 함께 정규화한다. 한 field만 있거나
지원하지 않는 값이면 TypeError로 거절한다.

memory store의 queryless 결과는 canonical revision bytes를 사용하되 외부 `stableKey`는 계속
`cards/v2/public/{handle}/card.png`다. `theme` 또는 `locale` field가 하나라도 있는 요청은 explicit
mode이며 누락 축은 dark/en 기본값을 유지한다. `inspectStableCard()`의 내부 authority 표현은 기존
dark/en stable record로 보존했다.

## 검증 결과

구현계획서 Stage 1 명령:

```bash
node --test src/profile-media/__tests__/media-store-contract.test.js src/profile-media/__tests__/publication-service.test.js
git diff --check
```

결과:

- OK — 25 tests, 25 pass, 0 fail, 0 skip.
- OK — canonical light/ko queryless read, theme-only·locale-only explicit read, selector 외 option이 있는
  queryless conditional read와 queryless stable key를 검증했다.
- OK — legacy canonical pair 전체 부재는 dark/en, partial/invalid pair는 fail-close하는 contract를
  검증했다.
- OK — `git diff --check` 경고 없음.

추가 회귀 명령:

```bash
node --test src/profile-media/__tests__/*.test.js
```

결과:

- OK — 99 tests 중 97 pass, 0 fail, 환경 변수가 없는 Postgres/S3 integration 2건 skip.
- OK — 기존 memory concurrency, publication compensation, R2/S3 adapter, maintenance와 social card
  test가 additive contract helper 변경 뒤에도 통과했다.

## 잔여 위험

- R2/S3 adapter는 아직 canonical metadata를 object authority에 기록하거나 읽지 않는다. Stage 2에서
  `canonical-theme`, `canonical-locale`을 추가하고 legacy 전체 부재·partial invalid를 구분해야 한다.
- publication service는 아직 owner의 저장 theme·locale을 publication input으로 전달하지 않아 새
  publication도 기본 dark/en을 쓴다. 설정 transaction과 함께 Stage 3에서 연결한다.
- public HTTP route는 아직 selector 부재를 dark theme으로 변환한다. Stage 3 전까지 실제 외부
  queryless 응답 의미는 바뀌지 않는다.

## 다음 단계 영향

- Stage 2 adapter는 `normalizeProfileMediaCanonicalSelection()`과
  `resolveProfileMediaSelection()`을 공통 진실 원천으로 사용한다.
- authority metadata는 canonical pair를 항상 함께 쓰고 함께 읽는다. 둘 다 없으면 dark/en legacy,
  하나만 없거나 invalid이면 `invalid`로 fail-close한다.
- R2/S3 read는 selector를 먼저 dark/en으로 normalize하지 않고 dark authority를 읽은 뒤 resolver로
  canonical/explicit selection을 결정해야 한다.
- snapshot/restore, authority equality와 maintenance sanitize/digest가 canonical pair를 보존하는지
  Stage 2 failure·concurrency·maintenance 테스트로 닫는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 R2·S3 publication authority 정합화로 진행한다.
