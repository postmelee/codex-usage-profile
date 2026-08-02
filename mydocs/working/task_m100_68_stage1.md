# Task M100 #68 Stage 1 완료보고서

GitHub Issue: [#68](https://github.com/postmelee/codex-usage-profile/issues/68)
구현계획서: [`task_m100_68_impl.md`](../plans/task_m100_68_impl.md)
Stage: 1 — 전역 locale 기반과 메시지 계약

## 단계 목적

웹 UI 전체가 후속 Stage에서 동일한 locale을 사용할 수 있도록 영어·한국어 메시지 계약,
브라우저 언어 resolver, locale formatter, React Provider와 두 frontend entry의 초기
`<html lang>` 동기화를 구현한다. 이 단계에서는 기존 영어 UI 문구와 인증·route 동작을
이관하거나 변경하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/messages.js` | 영어 기준·한국어 parity를 갖는 초기 공통 메시지 사전과 조회 API |
| `src/profile-ui/i18n.js` | 지원 locale 판정, browser 우선순위, fallback·보간, cached Intl formatter, document 동기화와 `languagechange` 구독 |
| `src/profile-ui/LocaleProvider.jsx` | locale·`t`·number/date formatter를 제공하는 React context와 hook |
| `src/profile-ui/__tests__/i18n.test.js` | locale·catalog·formatter·bootstrap·event 구독 계약 6건 |
| `src/main.jsx` | product root를 Provider로 감싸고 mount 전 문서 locale 초기화 |
| `src/profile-marketing/sites-entry.jsx` | Sites marketing root에 동일 bootstrap과 Provider 적용 |
| `mydocs/orders/20260803.md` | Task #68을 Stage 2 승인 대기 상태로 갱신 |

신규 locale 기반 파일은 356줄이며 두 entry는 합계 13줄 추가·2줄 교체다.
`index.html`과 `sites.html`은 이미 정적 영어 fallback인 `lang="en"`을 갖고 있어 불필요한
본문 변경을 만들지 않았다. 실행 시 두 entry가 React mount 전에 실제 browser locale로
해당 값을 덮어쓴다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 항목은 해당 없다. 기존 UI의 사용자 노출 영어 문구,
API·auth·route·card renderer 계약은 변경하지 않았다. 새 Provider는 context만 공급하며
Stage 2 전까지 기존 컴포넌트가 이를 소비하지 않으므로 화면 의미와 레이아웃은 보존된다.

새 dependency, browser storage, 수동 언어 선택기, backend/D1/R2/CLI, card renderer,
`.openai/hosting.json`, package·lockfile와 static asset 변경은 없다.

## 구현 결과

- `navigator.languages`에서 `en|ko`로 해석할 수 있는 첫 값을 선택하고, 없으면
  `navigator.language`, 최종적으로 `en`을 사용한다.
- 대소문자와 underscore를 정규화하며 `ko`, `ko-*`는 `ko`, 미지원 단일 locale은
  영어 fallback으로 처리한다.
- 영어·한국어 사전은 같은 ID 집합을 유지하고 locale·ID 누락 시 사용자에게 ID 대신
  locale별 일반 오류를 반환한다.
- 보간 값은 문자열로 안전하게 대체하고 number/date formatter는 resolved locale과
  옵션별 `Intl` 인스턴스를 재사용한다.
- product와 Sites marketing entry 모두 같은 bootstrap을 사용해 React mount 전
  `<html lang>`을 설정한다.
- Provider는 `languagechange`를 구독하고 unmount 시 listener를 제거한다. 변경 locale은
  context와 document language에 함께 반영된다.
- Sites의 기존 GitHub OAuth와 플랫폼 access/auth 경계는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/i18n.test.js
npm test
npm run build
npm run build:sites
git diff --check
git diff origin/devel -- .openai/hosting.json src/profile-backend src/profile-runtime/sites packages package.json package-lock.json public/assets
```

결과:

- OK — locale 단위 테스트 6건 통과, 실패·skip 없음.
- OK — 전체 Node 테스트 546건 중 540건 통과, 환경 의존 6건 skip, 실패 0건.
- OK — `npm run build`: 1,819 modules transformed, product bundle 생성 성공.
- OK — `npm run build:sites`: 25 modules transformed, marketing Sites bundle 생성 성공.
- OK — `git diff --check` 경고 없음.
- OK — hosting manifest, backend/runtime, packages, lockfile와 static asset 제한 경로 diff가
  빈 출력이다.

전체 테스트의 skip 6건은 기존 `TEST_DATABASE_URL` 미설정 PostgreSQL 검증 5건과
`TEST_S3_*` 미설정 외부 S3 endpoint 검증 1건이다. 이번 Stage가 변경한 frontend locale
경로와 무관하며 D1·로컬 Worker 검증을 포함한 나머지 회귀는 통과했다.

## 잔여 위험

- 현재 메시지 사전에는 Stage 1 기반 문구만 들어 있다. 실제 화면은 의도대로 기존 영어
  문구를 유지하며 전역 한·영 정합성은 Stage 2·3 이관 후 달성된다.
- Provider의 실제 DOM rerender와 `<html lang>` 동시 변경은 pure event 계약까지
  검증했다. 브라우저 context 기반 실제 `languagechange` E2E는 Stage 4에서 최종 검증한다.
- PostgreSQL·외부 S3 검증 6건은 필요한 환경 변수가 없어 기존 정책대로 skip됐다.

## 다음 단계 영향

- Stage 2 컴포넌트는 `useLocale()`의 `locale`, `t`, `formatNumber`, `formatDate`만
  사용하고 browser API나 message catalog를 직접 읽지 않는다.
- Home/marketing, 공통 shell/menu, Settings, device approval의 문구 ID를
  `messages.js`에 추가할 때 영어·한국어 parity 테스트를 함께 확장한다.
- 기존 상태 machine과 API 오류 code를 유지하고 사용자 노출 문구만 메시지 ID로
  치환한다.
- Stage 2 완료보고서 승인 전 Profile·heatmap·Share Studio 이관은 시작하지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 — 공통 shell·온보딩·관리 화면 이관으로
  진행한다.
