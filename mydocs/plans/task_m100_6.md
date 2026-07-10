# Task M100 #6 수행계획서

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
마일스톤: M100

## 목적

공개 프로필의 최신 사용량과 GitHub 계정 정보를 첨부 기준 이미지와 같은 Codex 공유 카드로 렌더링하는 PNG endpoint를 제공한다. 기본 카드 규격은 499x306 logical canvas를 2배로 출력한 998x612 PNG이며, 사용자는 GitHub README에 고정 URL을 한 번 삽입한 뒤 같은 URL에서 최신 공개 snapshot 기반 이미지를 받을 수 있어야 한다.

웹 Profile 페이지의 Share 동작에서는 카드 미리보기, 공개 이미지 URL, README Markdown snippet, 이미지 저장 동작을 제공한다. README 소스 자체를 다시 수정하지 않아도 snapshot 변경 후 endpoint의 ETag가 바뀌고 GitHub Camo가 원본을 재검증할 수 있는 구조를 만든다.

## 배경

Issue #6은 README 카드 endpoint와 Share UI를 M100의 공유 경계로 정의한다. 현재 저장소에는 최신 공개 snapshot 조회 API, GitHub owner 정보, share card selector, Profile 상단 Share 버튼이 있으나 실제 PNG renderer, 이미지 route, 캐시 정책, Share dialog는 없다.

2026년 7월 공식 [Codex App Server 문서](https://developers.openai.com/codex/app-server)는 `account/usage/read`로 누적 토큰, 최대 일일 토큰, 최장 작업, 현재·최장 연속 기록, 일별 사용량을 읽을 수 있다고 명시한다. 다만 App Server는 사용자의 Codex 인증 상태를 가진 로컬 프로세스와 JSON-RPC transport로 통신하는 인터페이스다. 공개 README 이미지 요청은 사용자의 로컬 App Server에 접근할 수 없으므로 카드 endpoint가 이 메서드를 직접 호출하지 않는다.

따라서 데이터 흐름은 다음 경계로 고정한다.

1. 후속 #5의 로컬 동기화 클라이언트가 App Server에서 사용량을 읽는다.
2. 클라이언트가 이 서비스의 인증된 submit API로 정제된 snapshot을 전송한다.
3. #6의 공개 카드 endpoint는 저장된 최신 공개 snapshot과 GitHub owner 정보를 병합해 익명 요청에 PNG를 반환한다.

이 결정으로 기존 analyzer는 카드에 필요한 공식 집계값을 다시 계산할 필요가 없어진다. 그러나 자동 갱신을 위해 사용자 환경에서 App Server 결과를 웹서비스로 전달하는 얇은 CLI 또는 동등한 로컬 동기화 클라이언트는 여전히 필요하다. ChatGPT 인증 토큰을 웹서비스에 보관하거나 공개 이미지 요청 시 App Server 인증을 시작하는 구조는 채택하지 않는다.

[GitHub Camo 문서](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls)는 외부 이미지가 공개적으로 접근 가능해야 하며, 변경 이미지의 재검증을 위해 원본 서버가 `Cache-Control: no-cache`를 반환하도록 안내한다. endpoint는 콘텐츠 기반 ETag와 조건부 요청을 함께 지원하되, Camo의 갱신이 즉시 보장되지는 않으며 드문 경우 Camo URL purge가 필요할 수 있음을 사용자 문서에 명시한다.

## 범위

### 포함

- `GET /u/:handle/card.png` 공개 PNG endpoint
- 499x306 logical canvas, 998x612 PNG 출력과 첨부 이미지 기준 레이아웃
- 원형 GitHub avatar, 표시 이름, GitHub login, Codex mark, 26주 heatmap, 4개 통계 렌더링
- 최신 공개 snapshot과 GitHub owner 필드의 명시적 병합 정책
- snapshot schema v1 및 UsageSnapshot v2에서 카드용 공통 view model로 변환할 수 있는 adapter 경계
- renderer version, owner 변경 시각, snapshot 식별값, locale을 반영하는 ETag
- `Content-Type: image/png`, `Cache-Control: public, no-cache, must-revalidate`, 조건부 GET의 `304 Not Modified`
- private profile, snapshot 없음, 잘못된 handle에 대한 정보 비노출 404 처리
- Profile Share dialog의 카드 미리보기, URL/Markdown 복사, PNG 저장
- endpoint 단위 테스트, HTTP 캐시 테스트, UI interaction 테스트, 998x612 visual regression 기준
- GitHub README 삽입법, 갱신 기대치, Camo 지연 및 문제 해결 문서

### 제외

- `account/usage/read`를 호출하는 App Server client 구현
- 로컬 CLI/device submit 구현과 npm 배포: #5
- ChatGPT/OpenAI 로그인 또는 토큰을 웹서비스에 저장하는 기능
- README 파일을 자동 commit/push하는 기능
- 사용량 snapshot 수집 정확도와 local log parser 구현
- plugin/skill icon metadata 연동: #8
- 프로필 전체 UI 또는 Settings 재설계
- GitHub Camo cache를 서비스가 임의로 purge하는 기능

## 설계 방향

- 카드 route는 인증 없는 public GET으로 유지하고, public visibility를 통과한 최신 snapshot만 사용한다.
- backend card service가 `owner + latestSnapshot`을 카드 전용 view model로 병합한다. 표시 이름과 avatar, GitHub login은 owner record를 우선하고 사용량은 snapshot만 신뢰한다.
- renderer는 HTTP와 분리된 순수 모듈로 구현한다. SVG scene을 deterministic rasterizer로 998x612 PNG로 변환하고, avatar fetch와 font asset 주입은 테스트 가능한 dependency로 둔다.
- 카드의 기본 문구는 영문으로 두고 `locale=ko`를 지원해 첨부 이미지의 한국어 통계 라벨을 재현한다. locale은 ETag 입력에 포함하며 Share UI는 현재 브라우저 언어에 맞는 URL을 제안한다.
- heatmap은 기존 26주 selector/level 계산 규칙을 재사용하되 카드 규격에 맞는 고정 26x7 geometry를 사용한다.
- ETag는 렌더링 입력과 renderer version의 hash로 계산한다. snapshot submit 후 `uploadedAt` 또는 snapshot 내용이 바뀌면 같은 URL의 ETag와 PNG가 함께 바뀐다.
- GitHub 권고에 따라 `Cache-Control: public, no-cache, must-revalidate`를 사용한다. 브라우저와 Camo가 stale 응답을 재사용하지 않고 ETag로 재검증하도록 하며, service-side PNG memoization은 ETag 단위로만 허용한다.
- Share dialog는 중첩 card UI를 만들지 않고 기존 Profile shell 위 modal로 제공한다. 아이콘 버튼은 기존 `Icon` 구성요소를 재사용하고 copy/download 상태를 접근 가능한 live text로 알린다.

## 문서 위치 판단

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
|---|---|---|---|---|---|
| `docs/readme-card.md` | 공식 사용자 문서 | README 카드를 사용하는 사용자 | `docs/` | `mydocs/tech/` | 공개 endpoint, Markdown snippet, Camo 갱신 기대치는 제품 사용 계약이므로 내부 작업 기록이 아닌 공식 문서에 둔다. |
| `README.md` | 공식 진입 안내 | 사용자와 기여자 | 저장소 루트 | `docs/readme-card.md` 단독 | 복사 가능한 최소 예시와 상세 문서 링크를 발견하기 쉬운 위치에 둔다. |
| `mydocs/plans/task_m100_6*.md` 및 단계/최종 보고서 | 작업 산출물 | 내부 작업자와 에이전트 | `mydocs/` | `docs/` | 승인 경계, 구현 단계, 검증 기록은 제품 문서가 아니라 Hyper-Waterfall 작업 기록이다. |

## 예상 변경 파일

신규:

- `src/profile-card/index.js`
- `src/profile-card/view-model.js`
- `src/profile-card/renderer.js`
- `src/profile-card/__tests__/view-model.test.js`
- `src/profile-card/__tests__/renderer.test.js`
- `src/profile-ui/ShareDialog.jsx`
- `docs/readme-card.md`
- 카드 renderer가 요구하는 프로젝트 소유 asset/font 파일

수정:

- `package.json`
- `package-lock.json`
- `src/profile-backend/http.js`
- `src/profile-backend/index.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-runtime/dev-server.js`
- `src/profile-runtime/__tests__/dev-server.test.js`
- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/ProfilePage.jsx`
- `src/profile-ui/Icons.jsx`
- `src/styles.css`
- `src/profile-ui/__tests__/accountUi.test.js`
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

- **Stage 1 — 카드 데이터 계약과 deterministic renderer**
  - owner/snapshot 병합 view model, locale label, 26주 heatmap geometry, 998x612 PNG renderer를 구현한다.
  - 고정 fixture의 출력 크기, PNG signature, 핵심 텍스트/색상 입력, v1/v2 mapping을 검증한다.
- **Stage 2 — 공개 PNG endpoint와 캐시 재검증**
  - public card service와 `/u/:handle/card.png` route, avatar loading/fallback, ETag/Cache-Control/304를 구현한다.
  - public/private/not-found, HEAD/GET, snapshot 변경 후 ETag 변경을 HTTP 테스트로 검증한다.
- **Stage 3 — Share dialog와 README snippet UX**
  - Share 버튼에 modal, 카드 preview, URL/Markdown copy, PNG 저장 동작을 연결한다.
  - desktop/mobile 접근성, focus/escape, clipboard fallback, text overflow를 component 및 Playwright로 검증한다.
- **Stage 4 — Camo 문서화와 통합 visual QA**
  - README 카드 사용 문서와 루트 README 진입 예시를 추가한다.
  - 첨부 기준 이미지와 998x612 결과를 비교하고, endpoint header, 동일 URL의 ETag 전환, 전체 test/build를 검증한다.

## 검증 계획

### 단계별 검증

- Stage 1
  - `node --test src/profile-card/__tests__/*.test.js`
  - 생성 PNG가 998x612, RGBA PNG이며 카드 view model의 26x7 cell과 4개 통계를 반영하는지 확인
- Stage 2
  - `node --test src/profile-backend/__tests__/http.test.js src/profile-runtime/__tests__/dev-server.test.js`
  - `curl -I http://127.0.0.1:{port}/u/{handle}/card.png`로 `Content-Type`, `Cache-Control`, `ETag` 확인
  - `If-None-Match` 요청의 304와 snapshot 변경 후 새 ETag/PNG 확인
- Stage 3
  - `node --test src/profile-api/__tests__/client.test.js src/profile-ui/__tests__/*.test.js`
  - `npm run test:e2e -- --grep "Share"`
  - 390px와 1512px viewport에서 modal clipping, keyboard close, 복사/저장 동작 확인
- Stage 4
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
  - 첨부 `codex-profile-card.png`와 결과물의 998x612 frame, avatar/header, heatmap, 통계 정렬을 수동 비교

### 통합 검증

- README의 고정 카드 URL이 인증 없이 최신 public snapshot PNG를 반환한다.
- 동일 snapshot의 조건부 요청은 304를 반환하고, 새 snapshot 저장 후 같은 URL은 새로운 ETag와 이미지 본문을 반환한다.
- private/missing profile은 owner 또는 snapshot 존재 여부를 구분하지 않는 404를 반환한다.
- Share dialog에서 복사한 Markdown이 GitHub README 문법으로 유효하다.
- GitHub README 수동 렌더링에서 이미지가 표시되고, Camo 지연 및 purge 조건 문서가 실제 동작과 일치한다.
- `git status --short`가 PR 준비 전 빈 출력이다.
- `git diff --check`가 경고 없이 통과한다.

## 리스크

- **App Server의 실행 위치 오해**: 공개 image endpoint가 사용자의 로컬 App Server에 직접 접근할 수 없다. #6은 저장 snapshot renderer로 제한하고 로컬 동기화는 #5로 넘긴다.
- **ChatGPT 인증 정보 취급**: 서버 주기 수집을 위해 ChatGPT credential을 보관하면 보안 범위가 크게 늘어난다. 이번 task와 M100 기본 구조에서는 이를 금지한다.
- **GitHub Camo 지연**: `no-cache`와 ETag는 재검증을 유도하지만 GitHub의 즉시 갱신을 보장하지 않는다. 사용자 문서에 지연과 수동 purge를 명시한다.
- **renderer/font 환경 차이**: system font 의존은 production과 CI에서 결과가 달라질 수 있다. 라이선스가 명확한 font asset과 deterministic rasterizer를 사용한다.
- **원격 avatar 실패**: GitHub avatar fetch 실패가 전체 카드 실패로 이어지지 않도록 generic fallback을 렌더링하고 짧은 timeout/크기 제한을 둔다.
- **snapshot schema 전환**: 현재 submit path는 v1을 사용하고 후속 #5는 v2를 연결할 예정이다. renderer 앞에 v1/v2 adapter를 두어 HTTP/PNG 계약을 유지한다.
- **비용과 abuse**: 공개 동적 PNG 생성은 반복 요청 비용이 있다. ETag 단위 memoization, asset 크기 제한, production rate limit handoff를 적용한다.

## 승인 요청 사항

- 공개 카드 endpoint는 App Server를 직접 호출하지 않고 저장된 최신 공개 snapshot만 렌더링한다.
- App Server `account/usage/read` 연동은 #5의 로컬 동기화 클라이언트로 넘기며, analyzer는 공식 집계값이 부족할 때의 보조 데이터 수집기로만 남긴다.
- 카드 규격은 첨부 이미지와 동일한 998x612 출력으로 고정하고, 영문 기본값과 `locale=ko`를 제공한다.
- GitHub Camo 대응은 고정 URL + `Cache-Control: no-cache` + 콘텐츠 ETag로 구현하며 즉시 갱신을 보장하지 않는다는 한계를 문서화한다.
- 제품 사용 문서는 `docs/readme-card.md`와 루트 `README.md`에 둔다.

승인되면 `task_m100_6_impl.md`에서 단계별 산출물, 검증 명령, 커밋 메시지를 구체화한다.
