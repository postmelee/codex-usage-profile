# Task M100 #6 수행계획서

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
마일스톤: M100

## 목적

GitHub 로그인 사용자가 자신의 Codex 사용량 카드를 웹에서 확인하고 GitHub README에 넣을 고정 PNG URL과 Markdown snippet을 복사할 수 있게 한다. 카드는 첨부 기준 이미지와 같은 499x306 logical canvas를 2배로 출력한 998x612 PNG로 렌더링한다.

CLI는 Codex App Server의 `account/usage/read`가 반환하는 사용량 정보와 일치하는 값만 전송한다고 가정한다. 이름, 사용자명, avatar는 CLI payload에서 받지 않고 웹서비스가 GitHub OAuth로 저장한 owner 정보만 사용한다. 같은 사용자가 새 사용량을 submit하면 README 소스를 수정하지 않아도 동일한 카드 URL이 최신 PNG를 반환해야 한다.

간단한 홈 화면에서 GitHub 로그인을 시작하고, 로그인 후 소유자 전용 `/profile` 화면에서 비공개 카드 미리보기, 공개 전환, 이미지 URL/Markdown 복사, PNG 저장까지 완료할 수 있는 흐름을 제공한다.

## 배경

Issue #6은 README 카드 endpoint와 Share UI를 M100의 공유 경계로 정의한다. 현재 저장소에는 GitHub OAuth/session, GitHub owner의 `displayName`·`githubLogin`·`avatarUrl`, 최신 snapshot 저장/공개 조회, Profile shell과 Share 버튼이 있다. 하지만 루트 `/`는 sample Profile로 사용되고 있으며, 카드 renderer, 공개 이미지 route, 소유자 카드 화면, 공개 전환 API, 링크 복사 UI는 없다.

공식 [Codex App Server 문서](https://developers.openai.com/codex/app-server#7-token-usage-chatgpt)의 `account/usage/read` 결과를 이번 task의 사용량 진실 원천으로 둔다.

```json
{
  "summary": {
    "lifetimeTokens": 1234567,
    "peakDailyTokens": 45678,
    "longestRunningTurnSec": 540,
    "currentStreakDays": 8,
    "longestStreakDays": 14
  },
  "dailyUsageBuckets": [
    { "startDate": "2026-06-18", "tokens": 12345 }
  ]
}
```

summary 값과 `dailyUsageBuckets`는 서비스 응답에 따라 null일 수 있으므로 renderer는 빈 값과 빈 heatmap을 안전하게 처리한다. App Server는 사용자 환경의 Codex 인증 상태를 가진 로컬 프로세스에 대한 JSON-RPC 인터페이스이므로 공개 README 이미지 요청에서 직접 호출하지 않는다.

데이터 흐름은 다음 경계로 고정한다.

1. 후속 #5의 로컬 동기화 클라이언트가 `account/usage/read` 결과를 얻는다.
2. 클라이언트가 인증된 submit API로 사용량만 전송한다.
3. 웹서비스가 최신 사용량과 GitHub owner 정보를 별도로 저장한다.
4. #6의 card service가 GitHub owner identity와 최신 사용량을 병합해 PNG를 렌더링한다.

GitHub identity 필드는 server-owned다. CLI가 이름, 사용자명, avatar 또는 임의 profile 필드를 보내더라도 card view model은 이를 읽지 않는다. 표시 이름은 GitHub `displayName`, 사용자명은 `githubLogin`, avatar는 `avatarUrl`을 사용하고, 각 값의 fallback도 server에서 결정한다.

[GitHub Camo 문서](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls)는 외부 이미지가 공개적으로 접근 가능해야 하며 변경 이미지의 재검증을 위해 원본 서버가 `Cache-Control: no-cache`를 반환하도록 안내한다. endpoint는 콘텐츠 기반 ETag와 조건부 요청을 함께 지원하되 Camo의 즉시 갱신은 보장하지 않는다.

## 범위

### 포함

- `/`의 간단한 GitHub 로그인 홈 화면
- 비로그인 상태의 `Sign in with GitHub`, 로그인 상태의 `View profile` 진입 동작
- GitHub OAuth 완료 후 소유자 전용 `/profile` 진입 흐름
- `account/usage/read` 결과와 동일한 카드 usage 입력 계약 및 validator/normalizer
- GitHub owner identity와 usage를 병합하는 server-owned card view model
- CLI identity/profile 필드를 신뢰하지 않는 allowlist 경계
- 원형 GitHub avatar, 표시 이름, `@githubLogin`, Codex mark, 26주 heatmap, 4개 통계 렌더링
- 499x306 logical canvas, 998x612 PNG 출력
- 로그인한 소유자의 private card preview endpoint
- `GET /u/:handle/card.png` 공개 PNG endpoint
- 소유자 전용 profile visibility 갱신 API와 `Publish card`/`Make private` 동작
- public visibility를 만족한 경우에만 이미지 URL과 README Markdown snippet 복사 허용
- PNG 저장과 카드 미리보기
- renderer version, GitHub owner 정보, usage snapshot 식별값, locale을 반영하는 ETag
- `Content-Type: image/png`, `Cache-Control: public, no-cache, must-revalidate`, 조건부 GET의 304
- private/missing handle의 정보 비노출 404
- endpoint, cache, identity ownership, visibility, Home/Profile UI, visual regression 테스트
- README 삽입법, 갱신 기대치, Camo 지연 및 문제 해결 문서

### 제외

- `account/usage/read`를 호출하는 App Server client 구현
- 로컬 CLI/device submit command와 npm 배포: #5
- analyzer output, local log parser, UsageSnapshot v2에서 card usage로의 변환
- CLI가 보낸 GitHub identity/profile 필드의 저장 또는 표시
- ChatGPT/OpenAI credential을 웹서비스에 저장하는 기능
- README 파일을 자동 commit/push하는 기능
- plugin/skill icon metadata 연동: #8
- 기존 Settings token/device 화면 재설계
- GitHub Camo cache를 서비스가 임의로 purge하는 기능

## 설계 방향

- `account/usage/read` 결과 shape을 카드 사용량 입력의 canonical contract로 사용한다. 이번 task에서는 analyzer 또는 기존 v1/v2 snapshot의 추가 통계와 합성하지 않는다.
- GitHub identity와 usage는 저장·검증·렌더링에서 분리한다. `buildCardViewModel({ owner, usage })`만 두 소스를 병합하고 identity는 항상 owner record를 우선한다.
- 카드 통계는 `lifetimeTokens`, `peakDailyTokens`, `currentStreakDays`, `longestStreakDays` 네 항목을 사용한다. `longestRunningTurnSec`는 usage contract에는 보존하지만 첨부 카드의 4개 통계에는 넣지 않는다.
- `/profile`은 browser session이 인증한 owner의 최신 usage를 visibility와 무관하게 읽고 private preview를 제공한다. `/u/:handle/card.png`는 owner와 latest usage가 모두 public 상태일 때만 익명 접근을 허용한다.
- 새 GitHub owner는 기존 정책대로 private가 기본이다. 공개 URL 복사 전 사용자가 명시적으로 `Publish card`를 실행해야 한다. 비공개 전환은 즉시 public card 접근을 막는다.
- Home은 마케팅 landing이 아니라 로그인과 소유자 프로필 진입을 위한 조용한 auth gateway로 만든다. 로그인 전에는 card 예시와 GitHub 로그인 command만, 로그인 후에는 owner 요약과 `View profile` command만 제공한다.
- renderer는 HTTP와 분리된 순수 모듈로 구현한다. SVG scene을 deterministic rasterizer로 PNG화하고 avatar fetch와 font asset을 주입 가능한 dependency로 둔다.
- 기본 라벨은 영문이고 `locale=ko`에서 첨부 이미지의 한국어 통계 라벨을 제공한다. Share/Profile UI는 browser 언어에 맞는 locale URL을 제안한다.
- heatmap은 26x7 고정 geometry를 사용하며 `dailyUsageBuckets`의 tokens 분포에서 레벨을 계산한다.
- ETag는 renderer version, locale, GitHub identity, latest usage 내용의 hash다. 새 usage submit 또는 GitHub 재로그인으로 owner 정보가 바뀌면 같은 URL의 ETag와 PNG가 바뀐다.
- 공개 endpoint는 `Cache-Control: public, no-cache, must-revalidate`, private preview는 `Cache-Control: private, no-store`를 사용한다.
- profile visibility mutation은 browser session과 기존 same-origin/CSRF 정책을 적용하고 임의 owner id를 요청 body에서 받지 않는다.

## 문서 위치 판단

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
|---|---|---|---|---|---|
| `docs/readme-card.md` | 공식 사용자 문서 | README 카드를 사용하는 사용자 | `docs/` | `mydocs/tech/` | 공개 endpoint, Markdown snippet, Camo 갱신 기대치는 제품 사용 계약이다. |
| `README.md` | 공식 진입 안내 | 사용자와 기여자 | 저장소 루트 | `docs/readme-card.md` 단독 | 로그인부터 카드 공유까지의 최소 흐름과 상세 문서 링크를 발견하기 쉽게 둔다. |
| `mydocs/plans/task_m100_6*.md` 및 단계/최종 보고서 | 작업 산출물 | 내부 작업자와 에이전트 | `mydocs/` | `docs/` | 승인 경계, 구현 단계, 검증 기록은 Hyper-Waterfall 작업 기록이다. |

## 예상 변경 파일

신규:

- `src/profile-card/account-usage.js`
- `src/profile-card/view-model.js`
- `src/profile-card/renderer.js`
- `src/profile-card/service.js`
- `src/profile-card/index.js`
- `src/profile-card/fixtures/sample-account-usage.js`
- `src/profile-card/__tests__/*.test.js`
- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/ShareDialog.jsx`
- `docs/readme-card.md`
- card renderer용 project-owned asset/font 파일

수정:

- `package.json`
- `package-lock.json`
- `src/App.jsx`
- `src/profile-backend/accounts.js`
- `src/profile-backend/http.js`
- `src/profile-backend/index.js`
- `src/profile-backend/snapshots.js`
- `src/profile-backend/store.js`, 필요한 경우
- `src/profile-backend/__tests__/*.test.js`
- `src/profile-runtime/dev-server.js`
- `src/profile-runtime/__tests__/dev-server.test.js`
- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/appRoutes.js`
- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/Icons.jsx`
- `src/profile-ui/__tests__/*.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `README.md`

이번 task 산출물:

- `mydocs/orders/20260711.md`
- `mydocs/plans/task_m100_6.md`
- `mydocs/plans/task_m100_6_impl.md`
- `mydocs/working/task_m100_6_stage1.md`
- `mydocs/working/task_m100_6_stage2.md`
- `mydocs/working/task_m100_6_stage3.md`
- `mydocs/working/task_m100_6_stage4.md`
- `mydocs/report/task_m100_6_report.md`

## 잠정 단계

- **Stage 1 — App Server usage 계약과 deterministic card renderer**
  - `account/usage/read` validator, GitHub identity 병합 규칙, locale, 26주 heatmap, 998x612 PNG renderer를 구현한다.
  - nullable usage, CLI identity 무시, GitHub owner 우선, PNG 규격을 unit test로 고정한다.
- **Stage 2 — owner/public card service와 cache contract**
  - owner 전용 profile/card read, visibility mutation, private preview, public PNG route, avatar fallback, ETag/Cache-Control/304를 구현한다.
  - session ownership, public/private/not-found, 새 usage/owner 변경 후 ETag 갱신을 backend/runtime test로 검증한다.
- **Stage 3 — Home 로그인과 Card Profile 공유 UX**
  - `/` Home, `/profile` owner page, OAuth redirect, publish/private control, preview, URL/Markdown copy, PNG 저장을 연결한다.
  - desktop/mobile, keyboard dialog, clipboard, private/public 상태를 component 및 Playwright로 검증한다.
- **Stage 4 — README 문서와 통합 visual QA**
  - README 카드 공식 문서와 root README 진입 안내를 추가한다.
  - 첨부 이미지와 998x612 결과, login→profile→publish→copy 흐름, headers, 전체 test/build를 검증한다.

## 검증 계획

### 단계별 검증

- Stage 1
  - `node --test src/profile-card/__tests__/*.test.js`
  - `account/usage/read` nullable field, 26x7 cell, GitHub identity 우선, PNG 998x612 확인
- Stage 2
  - `node --test src/profile-backend/__tests__/*.test.js src/profile-runtime/__tests__/*.test.js`
  - public card `Content-Type`, `Cache-Control`, ETag, `If-None-Match` 304 확인
  - private preview session 요구와 public/private 전환 즉시성 확인
- Stage 3
  - `node --test src/profile-api/__tests__/client.test.js src/profile-ui/__tests__/*.test.js`
  - `npm run test:e2e -- --grep "Home|card|Share"`
  - 390px와 1512px에서 Home/Profile overflow, modal focus/escape, copy/download 확인
- Stage 4
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
  - 첨부 `codex-profile-card.png`와 avatar/header/heatmap/stats 배치를 수동 비교

### 통합 검증

- 비로그인 `/`에서 GitHub 로그인을 시작할 수 있다.
- 로그인 완료 후 `/profile`에서 GitHub 이름, login, avatar가 적용된 카드를 볼 수 있다.
- usage 입력에 임의 identity가 있어도 카드에는 GitHub owner 정보만 표시된다.
- private 상태에서는 owner만 preview를 보고 public URL 복사는 비활성화된다.
- publish 후 고정 card URL과 README Markdown을 복사할 수 있고 익명 요청으로 PNG가 표시된다.
- 같은 usage의 조건부 요청은 304, 새 usage 또는 owner identity 변경 후 같은 URL은 새 ETag와 PNG를 반환한다.
- 비공개 전환 직후 public card endpoint는 owner/snapshot 존재 여부를 구분하지 않는 404를 반환한다.
- `git status --short`가 PR 준비 전 빈 출력이다.
- `git diff --check`가 경고 없이 통과한다.

## 리스크

- **App Server 실행 위치 오해**: 공개 endpoint는 사용자 로컬 App Server에 접근하지 않는다. 로컬 동기화는 #5 책임이다.
- **identity 오염**: CLI profile 필드가 card에 반영되면 계정 위조가 가능하다. usage allowlist와 GitHub owner-only view model로 차단한다.
- **visibility 불일치**: owner와 latest usage의 visibility가 어긋나면 private 카드가 노출될 수 있다. public read는 두 상태를 모두 확인하고 mutation 시 일관되게 갱신한다.
- **GitHub Camo 지연**: no-cache와 ETag는 재검증을 유도하지만 즉시 반영을 보장하지 않는다. 지연과 수동 purge를 문서화한다.
- **renderer/font 환경 차이**: system font에 의존하지 않고 라이선스가 명확한 font asset과 deterministic rasterizer를 사용한다.
- **원격 avatar 실패**: fetch 실패, timeout, 과도한 payload가 카드 생성을 막지 않도록 크기 제한과 generic fallback을 둔다.
- **nullable usage**: 공식 서비스가 null summary/buckets를 반환할 수 있다. 대시와 빈 heatmap으로 렌더링하고 숫자 연산 오류를 테스트한다.
- **공개 renderer abuse**: ETag 단위 memoization과 avatar 제한을 적용하고 production rate limit은 배포 단계에서 재점검한다.

## 승인 요청 사항

- CLI usage는 `account/usage/read` 결과와 일치한다고 가정하고 analyzer/v1/v2 변환은 #6에서 제외한다.
- 이름, 사용자명, avatar는 GitHub owner record만 사용하며 CLI 값으로 덮어쓸 수 없게 한다.
- `/` Home, `/profile` owner card page, 명시적 publish/private 전환을 #6 범위에 포함한다.
- 공개 카드는 `/u/:handle/card.png`, owner private preview는 session 전용 endpoint로 분리한다.
- 카드 규격은 998x612, 영문 기본과 `locale=ko`를 지원한다.
- GitHub Camo 대응은 고정 URL + no-cache + 콘텐츠 ETag로 구현하고 즉시 갱신 한계를 문서화한다.

승인된 수행계획을 기준으로 `task_m100_6_impl.md`에서 단계별 산출물, 검증 명령, 커밋 메시지를 구체화한다.
