# Task #74 Stage 4 완료 보고서

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
구현계획서: [`task_m100_74_impl.md`](../plans/task_m100_74_impl.md)
Stage: 4

## 단계 목적

Profile의 카드 미리보기와 공유 대표 URL에 적용할 테마와 언어를 owner 설정으로 저장한다. 사이트 화면 모드·브라우저 언어와 카드 PNG 선택을 분리하고, 이미 게시되는 `dark/light × en/ko` 네 변형 중 저장된 조합을 다시 생성 없이 선택하도록 구현한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `db/migrations/0005_card_locale.sql` | D1 owner에 기본값 `en`인 `card_locale` 제약 열 추가 |
| `src/profile-backend/postgres/migrations/0004_card_locale.{up,down}.sql` | PostgreSQL card locale 정·역 migration 추가 |
| `src/profile-card/presentation.js` | `en|ko` card locale 정규화 계약 추가 |
| `src/profile-backend/{store.js,atomic-operations.js,http.js}` 및 D1/PostgreSQL adapter | locale 저장·CAS 갱신·profile variant URL 직렬화 추가 |
| `src/profile-card/service-core.js` | locale-only 갱신에서 media 재생성을 생략하고 설정은 원자 저장 |
| `src/profile-api/client.js` | `{ cardStyle, cardLocale }` exact settings mutation 추가 |
| `src/profile-ui/CardStyleSettings.jsx` | 키보드 접근 가능한 테마·언어 radio group과 저장 상태 UI 추가 |
| `src/profile-ui/{CardProfilePage.jsx,HomePage.jsx,ShareStudio.jsx}` | draft preview, 저장 복원, saved selection과 UI locale 분리 적용 |
| `src/profile-ui/messages.js`, `src/styles.css` | 영어·한국어 문구, 반응형·focus·성공·오류 스타일 추가 |
| 관련 `__tests__`와 `tests/profile-ui.spec.js` | migration/API/locale-only/no-regeneration/save/reload/error 회귀 검증 추가 |
| `mydocs/plans/task_m100_74_impl.md` | 승인된 card language 확장과 Stage 4 검증 범위 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 기존 query 없는 `publicCardUrl`과 영어 기준 `publicCardUrls.light|dark`는 유지했으며, `cardLocale`, `publicCardVariantUrls`, `selectedPublicCardUrl`만 additive하게 확장했다. 기존 owner는 migration/default 정규화로 `en`을 사용한다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-backend/__tests__/d1-migration-contract.test.js \
  src/profile-backend/__tests__/d1-migrate.test.js \
  src/profile-backend/__tests__/d1-store.test.js \
  src/profile-backend/__tests__/postgres-migrate.test.js \
  src/profile-backend/__tests__/http.test.js \
  src/profile-ui/__tests__/cardStyleSettings.test.js \
  src/profile-ui/__tests__/i18n.test.js \
  src/profile-api/__tests__/client.test.js
npx playwright test tests/profile-ui.spec.js --grep "card appearance|card theme|카드 모양"
git diff --check
npm run build:sites
```

결과:

- OK — Node 93건 중 92건 통과, 실패 0건, PostgreSQL 실 DB up/down/up 1건은 `TEST_DATABASE_URL` 부재로 계획된 skip.
- OK — Playwright 저장·reload·오류 복구 2건 통과.
- OK — `git diff --check` 통과.
- OK — Sites Vite production build 통과.
- 추가 회귀 검증: 전체 `tests/profile-ui.spec.js`의 전·후반 분할 실행에서 변경 영향 범위가 통과했고, memory/file store 23건과 D1 maintenance 3건도 통과했다.

## 잔여 위험

- `TEST_DATABASE_URL`이 없어 PostgreSQL 실 DB migration up/down/up 및 adapter 통합 검증은 이번 환경에서 실행하지 못했다. migration 파일 pairing·SQL 계약은 통과했으며, Stage 6 또는 CI의 DB 제공 환경에서 재검증해야 한다.

## 다음 단계 영향

- Stage 5는 `selectedPublicCardUrl`이 저장된 `cardLocale × cardStyle.theme` 조합을 Share Studio URL, README Markdown, 공개 응답에서 일관되게 사용하는지 하위 호환 E2E를 확정한다.
- 사이트 UI locale은 브라우저 locale을 계속 따르고, 카드 이미지 locale만 `cardLocale`을 따른다. Share Studio는 두 값을 분리해 사용한다.
- locale-only 저장은 R2 object를 다시 생성하지 않으므로 Stage 5에서 기존 네 PNG 변형과 URL 선택만 검증하면 된다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 Share Studio·공개 URL 하위 호환 검증으로 진행한다.
