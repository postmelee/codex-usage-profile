# Task #100 Stage 3 보고서 — 설정 publication commit과 public endpoint 전환

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
구현계획서: [`task_m100_100_impl.md`](../plans/task_m100_100_impl.md)
Stage: 3

## 단계 목적

공개 사용자의 카드 설정 저장을 immutable revision 준비, owner CAS, stable/social authority commit 순서로
분리한다. DB 저장 이후 media commit이 실패한 경우에도 같은 설정 요청으로 수렴하게 하고, queryless
공개 카드 endpoint가 저장된 대표 theme·locale을 따르도록 HTTP selector 전달 경계를 전환한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/publication-service.js` | 설정 publication prepare/commit 분리, committed owner·usage 최신성 검사, canonical pair publish·restore·idempotency와 social commit 정합성 구현 |
| `src/profile-card/service-core.js` | 모든 공개 설정 PATCH에서 media ensure를 실행해 post-CAS 실패 뒤 exact retry가 authority를 복구하도록 변경 |
| `src/profile-backend/http.js` | raw query의 `theme`·`locale` 존재 여부만 store에 전달하고 queryless social authority read를 canonical mode로 전환 |
| `src/profile-media/__tests__/publication-service.test.js` | owner CAS 전 stable authority 불변성과 CAS 후 canonical commit, legacy v4 upgrade 회귀 검증 |
| `src/profile-media/__tests__/social-card-publication.test.js` | 최초 대표 설정, CAS 실패 불변성, 동시 설정 winner, post-CAS 실패와 exact retry 수렴 검증 |
| `src/profile-backend/__tests__/http.test.js` | exact settings ensure, queryless·cache-buster canonical과 부분 selector explicit 동작 검증 |
| `mydocs/orders/20260813.md` | Stage 3 완료와 Stage 4 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 공개 API 응답 shape와 URL field 이름은 변경하지
않았다. `publicCardUrl`은 계속 queryless 고정 URL이고 `selectedPublicCardUrl`, `publicCardUrls`,
`publicCardVariantUrls`는 기존 explicit 선택 URL 계약을 유지한다.

공개 설정 prepare는 네 immutable revision과 social render 결과만 만들고 stable/social authority를 쓰지
않는다. owner 설정 CAS가 성공한 뒤 committed owner의 `updatedAt`, 저장 theme·locale과 최신 usage의
`uploadedAt`이 준비 snapshot과 같은 경우에만 storage ETag compare-and-set으로 authority를 바꾼다.
authority 조회 뒤에도 최신성을 다시 검사해 더 최신 owner/usage commit이 앞선 경합은 `superseded`로
종료한다. post-CAS media 실패는 DB 설정을 유지하며 동일 PATCH가 ensure를 다시 실행해 같은 설정의
canonical card와 social publication id를 복구한다.

공개 카드 HTTP route는 selector가 둘 다 없으면 canonical mode로 store를 호출한다. `v` 같은 무관한
query만 있어도 canonical이며, `theme` 또는 `locale`이 하나라도 있으면 explicit mode이고 누락 축은 기존
dark/en 기본값을 사용한다. first publish와 usage refresh도 owner의 저장 card theme·locale을 canonical
pair로 전달한다.

## 검증 결과

구현계획서 Stage 3 명령:

```bash
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-media/__tests__/publication-service.test.js src/profile-media/__tests__/publication-concurrency.test.js src/profile-media/__tests__/social-card-publication.test.js
node --test src/profile-backend/__tests__/http.test.js src/profile-runtime/__tests__/dev-server.test.js src/profile-api/__tests__/client.test.js
git diff --check
```

결과:

- OK — card service 18 tests, 18 pass, 0 fail, 0 skip.
- OK — publication·concurrency·social 25 tests 중 24 pass, 0 fail, 환경 변수가 없는 Postgres integration
  1건 skip.
- OK — backend HTTP·runtime·API 69 tests, 69 pass, 0 fail, 0 skip.
- OK — owner CAS 전 stable/social 불변, concurrent settings winner만 authority commit, post-CAS media 실패
  뒤 exact same PATCH 복구를 검증했다.
- OK — queryless와 `?v=1`은 저장된 light/ko canonical bytes, theme-only는 light/en, locale-only는
  dark/ko explicit bytes를 반환하는 계약을 검증했다.
- OK — runtime 실제 PNG renderer와 공개 JSON·PNG·visibility 동기화, 기존 API URL field regression을
  무변경 테스트 파일까지 포함해 재검증했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Share Studio의 README Markdown과 이미지 URL 복사는 아직 selected URL의 theme·locale query를 사용할
  수 있다. Stage 4에서 copy URL과 preview/download URL을 분리해야 한다.
- 이번 단계는 로컬 memory media store 통합과 Stage 2 adapter contract를 검증했으며 실제 production
  R2/S3 배포는 수행하지 않았다.

## 다음 단계 영향

- Stage 4는 profile response의 queryless `publicCardUrl`을 README·이미지 URL 복사 전용 canonical URL로
  사용하고, `selectedPublicCardUrl`은 preview·download·PNG clipboard 전용으로 유지한다.
- 설정 form에서 theme·locale이 바뀌어도 복사되는 URL에는 selector query가 없어야 하며 preview는 현재
  explicit 선택을 즉시 따라야 한다.
- canonical URL 부재 또는 unsafe protocol의 기존 disabled/error 동작과 locale별 문구는 유지한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 Share Studio 고정 README URL 전환으로 진행한다.
