# Task M100 #68 Stage 4 완료 보고서

GitHub Issue: [#68](https://github.com/postmelee/codex-usage-profile/issues/68)
구현계획서: [`task_m100_68_impl.md`](../plans/task_m100_68_impl.md)
Stage: 4

## 단계 목적

활성 route import graph를 기준으로 전역 locale 적용 상태를 다시 감사하고, 영어·한국어·
미지원 locale fallback과 런타임 `languagechange` 계약을 회귀 테스트로 고정했다. 원격
Sites 배포 없이 client·Sites·production artifact를 모두 빌드하고 검증했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/messages.js` | Profile 사용량 요약 접근성 이름의 영어·한국어 메시지 추가 |
| `src/profile-ui/ProfileStats.jsx` | 활성 owner/public Profile의 하드코딩된 `Profile stats` 접근성 이름을 공통 locale 사전으로 이관 |
| `src/profile-ui/__tests__/i18n.test.js` | 영어·한국어 ID parity에 더해 모든 메시지의 문자열·비어 있지 않음 계약 검증 |
| `tests/profile-ui.spec.js` | 미지원 locale의 전체 활성 route fallback, 한국어 public Profile 접근성 이름, `languagechange` 후 날짜·숫자·`html lang` 동기화 검증 |
| `mydocs/working/task_m100_68_stage4.md` | 전역 감사·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

활성 Profile 요약의 접근성 이름 1건과 locale 회귀 테스트만 변경했다. 시각 구조, 인증·
상태 machine, API payload, card renderer, backend, D1/R2, CLI, package와 Sites hosting
설정은 변경하지 않았다.

활성 import graph 감사에서 다음 항목은 사용자 노출 누락이 아닌 오탐으로 분리했다.

- `src/profile-ui/ProfilePage.jsx`의 raw 문구: `App.jsx`에서 import하지 않는 이전 비활성 화면
- 테스트 fixture의 영어 API error message와 CSS selector: 화면에 직접 노출되지 않는 검증 입력
- `ABCD-1234`, `Codex`, `GitHub`, `README`, 소셜 서비스명: 예시 코드 또는 고유명사
- owner display name·handle·device name: 서버 또는 사용자 데이터
- browser storage 문자열: locale 저장이 아니라 storage 접근 금지를 검증하는 단위 테스트

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
npm run build
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git status --short
git diff origin/devel -- .openai/hosting.json src/profile-backend src/profile-runtime/sites packages package.json package-lock.json public/assets
```

결과:

- OK — Node 550건 중 544건 통과, 환경 의존 6건만 skip, 실패 0건
  - PostgreSQL `TEST_DATABASE_URL` 부재 5건
  - S3 `TEST_S3_*` 부재 1건
- OK — Playwright E2E 56/56 통과
- OK — 미지원 `ja-JP`/`fr-FR` 환경에서 Home, Settings, device approval,
  owner/public Profile, Share Studio가 영어와 `html lang=en`으로 fallback
- OK — 한국어 public Profile의 section·summary·card 접근성 이름이 한국어 사전과 일치
- OK — `languagechange` 후 Profile 문구, 날짜, 숫자, 카드 locale URL과 `html lang` 동기화
- OK — client build 성공, 1,819 modules transformed
- OK — Sites marketing build 성공, 25 modules transformed
- OK — production full-stack server 48 modules·client 1,819 modules transformed
- OK — Sites full-stack artifact verifier `ok: true`
- OK — Sites production artifact verifier `ok: true`, artifact 5,602,286 bytes
- OK — 제한 경로 diff는 빈 출력
- OK — `git diff --check` 통과
- OK — 원격 Sites 배포·공개 설정·environment/access/secret 변경 없음

## 잔여 위험

- 한국어·영어 외 브라우저 locale은 승인된 기본 정책에 따라 영어로 fallback한다.
- PostgreSQL·S3 외부 연동 테스트 6건은 환경 변수가 있는 별도 통합 환경에서만 실행된다.
- 비활성 `ProfilePage.jsx`는 제품 import graph에 없으므로 이번 범위에서 제거하거나 번역하지
  않았다. 다시 활성화하려면 공통 locale provider와 사전 계약을 적용해야 한다.

## 다음 단계 영향

- 구현 Stage는 모두 완료되었다. 다음 단계는 Task #68 최종 보고서 작성과 `devel` 대상 PR
  게시다.
- production 배포와 공개 설정 변경은 이번 Task의 최종 보고·PR 범위에도 포함하지 않는다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Task #68 최종 보고서 작성과 PR 게시를 진행한다.
