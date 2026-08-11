# Task #74 Stage 4.1 완료 보고서

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
구현계획서: [`task_m100_74_impl.md`](../plans/task_m100_74_impl.md)
Stage: 4.1

## 단계 목적

Stage 4 로컬 시각 검토에서 확인된 카드 설정과 공유 진입 사이의 상태 불일치를
보정했다. 카드 설정 안내에서 사이트 화면 모드 설정으로 직접 이동할 수 있게 하고,
공개 카드 설정이 변경된 상태에서 공유를 누르면 선택값을 먼저 저장한 뒤 저장된 대표
URL로 Share Studio를 열도록 했다. 저장 실패 시에는 Share Studio를 열지 않고 draft와
오류 안내를 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/CardProfilePage.jsx` | 변경된 카드 설정의 저장 성공 후 공유, 저장 중 상태, 실패 시 fail-closed 흐름 추가 |
| `src/profile-ui/CardStyleSettings.jsx` | 사이트 화면 모드 `설정` 링크를 `/?view=settings`에 연결 |
| `src/profile-ui/messages.js` | 설정 링크 문장과 `저장 후 공유`·`저장 중` 영어/한국어 문구 추가 |
| `src/styles.css` | 설정 링크의 theme token, hover, focus-visible 스타일 추가 |
| `src/profile-ui/__tests__/cardStyleSettings.test.js` | 설정 링크와 save-before-share 소스 계약 검증 추가 |
| `tests/profile-ui.spec.js` | 저장 성공 후 선택 URL Share Studio 진입과 저장 실패 시 미진입 E2E 추가 |
| `mydocs/working/task_m100_74_stage4_1.md` | 보정 범위·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

카드 설정·공유 UI와 관련 문구만 변경했다. 카드 PNG 생성, D1/PostgreSQL schema,
publication service v4, 기존 query 없는 `publicCardUrl`, 명시적 설정 저장 버튼과
공개/비공개 전환 계약은 변경하지 않았다. 설정 변경이 없는 기존 공유는 추가 저장 없이
기존 Share Studio를 그대로 연다.

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
npm run build:sites
git diff --check
```

결과:

- OK — Node 94건 중 93건 통과, 실패 0건, PostgreSQL 실 DB migration 1건은 `TEST_DATABASE_URL` 부재로 계획된 skip.
- OK — Playwright 2건 통과: 저장 성공 후 새 대표 URL로 Share Studio 진입, 저장 실패 시 Share Studio 미진입과 draft 유지.
- OK — Sites production build 성공, 27 modules transformed.
- OK — `git diff --check` 통과.

## 잔여 위험

- `TEST_DATABASE_URL`이 없어 PostgreSQL 실 DB migration up/down/up 통합 검증은 이번 환경에서 실행하지 못했다. SQL pairing과 HTTP/D1 계약은 통과했다.
- 자동 저장과 Share Studio 진입은 단일 browser mutation 기준이다. 다중 탭에서 같은 owner 설정을 동시에 변경하는 경우 기존 last-successful-write 동작을 유지한다.

## 다음 단계 영향

- Stage 5는 저장 완료 응답의 `selectedPublicCardUrl`을 Share Studio 이미지 URL, README Markdown, 다운로드와 공개 응답에서 동일하게 사용해야 한다.
- 저장 실패 시 Share Studio를 열지 않는 fail-closed 계약과 설정 변경이 없는 기존 공유의 무변경 동작을 유지해야 한다.
- 원격 Sites 배포와 공개 설정 변경은 이번 단계에 포함하지 않았다.

## 승인 요청

- Stage 4.1 산출물과 검증 결과를 승인하면 Stage 5 Share Studio·공개 URL 하위 호환 검증으로 진행한다.
