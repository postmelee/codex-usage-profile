# Task M100 #6 구현계획서

수행계획서: [`task_m100_6.md`](task_m100_6.md)
GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
마일스톤: M100

## 구현 전제

- CLI가 전달하는 사용량은 Codex App Server `account/usage/read` 결과와 의미 및 필드가 일치한다.
- card service는 analyzer, local logs, UsageSnapshot v2를 읽지 않는다.
- `displayName`, `githubLogin`, `avatarUrl`은 GitHub OAuth owner record에서만 읽는다.
- 새 owner의 기본 visibility는 private다.
- `/profile`은 session owner 전용이고 `/u/:handle/card.png`는 public visibility일 때만 익명 접근 가능하다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | App Server usage 계약과 card renderer | usage validator, owner merge, 26주 heatmap, 998x612 PNG | profile-card unit tests, PNG dimension inspection |
| 2 | owner/public card service와 cache | owner profile API, visibility, private/public image routes, ETag/304 | backend/runtime tests, header smoke |
| 3 | Home과 Card Profile 공유 UX | `/`, `/profile`, OAuth redirect, publish, preview/copy/download | client/UI tests, Playwright desktop/mobile |
| 4 | 문서와 통합 visual QA | README 문서, full regression, reference comparison | `npm test`, build, e2e, manual visual QA |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `docs/readme-card.md` | `docs/` | Stage 4 신규 | OK | 사용자-facing 카드 URL과 Camo 안내 |
| `README.md` | 저장소 루트 | Stage 4 수정 | OK | 로그인/공유 최소 진입 안내 |
| `mydocs/plans/task_m100_6.md` | `mydocs/plans/` | 갱신 완료 | OK | 승인된 수행 범위 |
| `mydocs/plans/task_m100_6_impl.md` | `mydocs/plans/` | 본 문서 | OK | 단계별 구현 계약 |
| 단계/최종 보고서 | `mydocs/working`, `mydocs/report` | 각 Stage 및 최종 단계 | OK | Hyper-Waterfall 기록 |

## Stage 1 — App Server usage 계약과 deterministic card renderer

### 산출물

신규:

- `src/profile-card/account-usage.js`
- `src/profile-card/view-model.js`
- `src/profile-card/heatmap.js`
- `src/profile-card/renderer.js`
- `src/profile-card/index.js`
- `src/profile-card/fixtures/sample-account-usage.js`
- `src/profile-card/__tests__/account-usage.test.js`
- `src/profile-card/__tests__/view-model.test.js`
- `src/profile-card/__tests__/heatmap.test.js`
- `src/profile-card/__tests__/renderer.test.js`
- deterministic renderer용 font/brand asset과 해당 라이선스 파일
- `mydocs/working/task_m100_6_stage1.md`

수정:

- `package.json`
- `package-lock.json`
- `mydocs/orders/20260711.md`

### 변경 내용

1. `account/usage/read` result validator를 추가한다.
   - top-level allowlist: `summary`, `dailyUsageBuckets`
   - summary allowlist: `lifetimeTokens`, `peakDailyTokens`, `longestRunningTurnSec`, `currentStreakDays`, `longestStreakDays`
   - bucket allowlist: `startDate`, `tokens`
   - summary 각 값과 `dailyUsageBuckets`는 null 허용
   - 숫자는 null 또는 non-negative integer, 날짜는 `YYYY-MM-DD`
   - identity/profile/credential-like field는 입력 계약에서 거부
2. `buildCardViewModel({ owner, usage, locale })`를 구현한다.
   - name: `owner.displayName || owner.githubLogin || owner.handle`
   - username: `owner.githubLogin || owner.handle`
   - avatar: `owner.avatarUrl`
   - usage는 four stats와 daily buckets만 mapping
   - usage 객체에 임의 profile 필드가 있어도 owner identity가 결과를 결정
3. 26주 heatmap을 26 columns x 7 rows로 정규화한다.
   - 현재 날짜는 최신 bucket 또는 주입된 `todayIso`를 사용
   - missing day는 0 token
   - non-zero 분포를 기반으로 4단계 blue scale 계산
4. 499x306 logical scene을 SVG로 구성하고 2x PNG로 rasterize한다.
   - rounded black card, 50x50 avatar, GitHub text block, Codex mark
   - 26x7 heatmap
   - lifetime/peak/current streak/longest streak 4 stats
   - 기본 영문, `ko` 라벨 지원
5. system font가 아닌 project-owned font를 renderer에 주입해 CI와 production 결과를 고정한다.
6. renderer dependency는 Node 20과 macOS/Linux prebuilt 지원, deterministic output, license를 확인한 뒤 최소 1개만 추가한다.

### 검증

```bash
node --test src/profile-card/__tests__/*.test.js
npm run build
git diff --check
```

검증 관점:

- 공식 result shape과 nullable response가 통과한다.
- unknown identity/credential field는 거부된다.
- GitHub owner 정보가 usage 내부의 임의 이름/avatar보다 항상 우선한다.
- heatmap은 182 cells이며 최신 날짜가 오른쪽에 위치한다.
- PNG signature와 IHDR가 998x612를 나타낸다.
- 영문/한국어 label은 각각 renderer input에 반영되고 ETag 후보 입력이 달라진다.

### 커밋

```text
Task #6 Stage 1: App Server usage card renderer 구현
```

## Stage 2 — owner/public card service와 cache contract

### 산출물

신규:

- `src/profile-card/service.js`
- `src/profile-card/__tests__/service.test.js`
- `mydocs/working/task_m100_6_stage2.md`

수정:

- `src/profile-backend/accounts.js`
- `src/profile-backend/snapshots.js`
- `src/profile-backend/http.js`
- `src/profile-backend/index.js`
- `src/profile-backend/store.js`, 필요한 경우
- `src/profile-backend/__tests__/accounts.test.js`
- `src/profile-backend/__tests__/snapshots.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-runtime/dev-server.js`
- `src/profile-runtime/host-adapter.js`
- `src/profile-runtime/__tests__/dev-server.test.js`
- `src/profile-runtime/__tests__/host-adapter.test.js`
- `mydocs/orders/20260711.md`

### 변경 내용

1. card service가 owner id/handle로 owner와 latest usage를 함께 조회하도록 한다.
2. 소유자 전용 read 경계를 추가한다.
   - `GET /api/profile`: session owner, latest usage, visibility, public card URL metadata
   - `GET /api/profile/card.png`: session owner의 private/public preview
3. visibility mutation을 추가한다.
   - `PATCH /api/profile` body `{ "visibility": "public" | "private" }`
   - owner id는 session에서만 결정
   - owner와 latest usage record의 visibility를 일관되게 갱신
   - private 전환 후 public lookup/card가 즉시 404
4. 공개 image route를 API prefix 밖의 runtime route로 추가한다.
   - `GET|HEAD /u/:handle/card.png`
   - owner와 latest usage가 모두 public일 때만 200
   - private/missing은 동일한 404 응답
5. avatar loader를 구현한다.
   - HTTPS GitHub avatar만 허용하거나 injected fetch policy 적용
   - timeout, content-type, byte limit
   - 실패 시 generic avatar fallback
6. public cache contract를 구현한다.
   - `Content-Type: image/png`
   - `Cache-Control: public, no-cache, must-revalidate`
   - strong ETag: renderer version + locale + owner identity + usage hash
   - `If-None-Match` 일치 시 304
   - owner preview는 `Cache-Control: private, no-store`
7. 같은 ETag의 PNG/avatar 결과를 process memory에서 제한적으로 memoize한다.

### 검증

```bash
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-backend/__tests__/*.test.js
node --test src/profile-runtime/__tests__/*.test.js
git diff --check
```

수동 header smoke:

```bash
curl -I http://127.0.0.1:5173/u/meleeisdeveloping/card.png
```

검증 관점:

- session 없는 owner API/preview는 401이다.
- owner만 자신의 visibility를 변경한다.
- private/missing public route는 존재 여부를 구분하지 않는다.
- publish 후 익명 public PNG, private 전환 후 404가 된다.
- 같은 ETag는 304, usage/GitHub identity/locale 변경은 새 ETag다.
- HEAD는 GET과 같은 headers를 반환하되 body가 없다.
- avatar 실패에서도 유효한 998x612 PNG를 반환한다.

### 커밋

```text
Task #6 Stage 2: public card endpoint와 cache contract 구현
```

## Stage 3 — Home 로그인과 Card Profile 공유 UX

### 산출물

신규:

- `src/profile-ui/HomePage.jsx`
- `src/profile-ui/CardProfilePage.jsx`
- `src/profile-ui/ShareDialog.jsx`
- UI helper가 필요하면 해당 module/test
- `mydocs/working/task_m100_6_stage3.md`

수정:

- `src/App.jsx`
- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/appRoutes.js`
- `src/profile-ui/ProfileShell.jsx`
- `src/profile-ui/Icons.jsx`
- `src/profile-ui/accountUi.js`, 필요한 경우
- `src/profile-ui/__tests__/appRoutes.test.js`
- `src/profile-ui/__tests__/accountUi.test.js`
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260711.md`

### 변경 내용

1. route를 명확히 분리한다.
   - `/`: Home
   - `/profile`: authenticated owner card page
   - `/u/:handle`: 기존 public Profile UI 유지
   - `/device`, `/settings`: 기존 동작 유지
2. Home은 실제 auth gateway로 구현한다.
   - anonymous: sample card preview, `Sign in with GitHub`
   - authenticated: GitHub avatar/name/login, `View profile`
   - GitHub login은 `redirect_to=/profile`
3. `/profile`은 auth loading/anonymous/error/ready 상태를 제공한다.
   - anonymous는 GitHub 로그인 action
   - ready는 owner private preview image와 usage 상태
   - usage 없음은 submit 필요 상태를 표시하되 UI 사용 설명을 장황하게 노출하지 않는다.
4. Publish/Make private control을 추가한다.
   - mutation 중 중복 요청 방지
   - 성공 후 auth/profile state와 card preview cache-buster 갱신
5. public 상태에서 Share dialog를 제공한다.
   - card preview
   - image URL copy
   - README Markdown copy
   - PNG save/download
   - browser locale에 따라 `?locale=ko` 선택
6. private 상태에서는 public link copy를 비활성화하고 Publish action을 명확히 제공한다.
7. dialog 접근성을 구현한다.
   - focus 이동/복귀
   - Escape/close button
   - overlay click policy
   - copy status live region
8. desktop/mobile에서 fixed card aspect ratio를 유지하고 text clipping/문서 overflow를 방지한다.

### 검증

```bash
node --test src/profile-api/__tests__/client.test.js
node --test src/profile-ui/__tests__/*.test.js
npm run build
npm run test:e2e -- --grep "Home|card|Share"
git diff --check
```

검증 관점:

- `/`가 더 이상 sample full Profile을 렌더링하지 않는다.
- anonymous login URL은 `/profile`로 돌아온다.
- authenticated Home과 `/profile`에 GitHub owner 정보가 나타난다.
- private preview는 보이지만 public link copy는 차단된다.
- publish 후 URL/Markdown copy와 PNG save가 활성화된다.
- README snippet은 `![Codex usage profile](https://host/u/handle/card.png)` 형식이다.
- dialog keyboard interaction과 mobile clipping이 없다.
- 기존 `/u/meleeisdeveloping`, `/settings`, `/device` regression이 없다.

### 커밋

```text
Task #6 Stage 3: Home과 card share profile UX 구현
```

## Stage 4 — README 문서와 통합 visual QA

### 산출물

신규:

- `docs/readme-card.md`
- `mydocs/working/task_m100_6_stage4.md`

수정:

- `README.md`
- visual QA에서 필요한 최소 보강 파일
- `mydocs/orders/20260711.md`

### 변경 내용

1. `docs/readme-card.md`에 다음을 기록한다.
   - GitHub login → `/profile` → publish → snippet copy 흐름
   - public card URL/locale 형태
   - submit 후 같은 URL이 새 ETag/PNG를 반환하는 원리
   - GitHub Camo 지연, no-cache, 드문 purge 절차
   - private profile은 README에서 표시되지 않음
   - GitHub identity와 CLI usage의 책임 분리
2. README에 최소 로그인/공유 예시와 공식 문서 링크를 추가한다.
3. 로컬 runtime에서 실제 OAuth session으로 owner profile/card 흐름을 smoke한다.
4. 첨부 reference와 output을 998x612로 비교한다.
   - outer radius/background
   - avatar/name/login baseline
   - Codex mark alignment
   - heatmap 26x7 geometry와 latest 오른쪽 배치
   - 4 stats divider/label alignment
5. desktop/mobile Home/Profile/Share screenshots를 확인한다.
6. full regression과 build를 실행한다.

### 검증

```bash
npm test
npm run build
npm run test:e2e
git diff --check
```

수동 시나리오:

```text
http://127.0.0.1:{port}/
```

- GitHub login
- `/profile` owner identity 확인
- private preview 확인
- publish
- image URL/README snippet copy
- public card 새 탭 표시
- private 전환 후 public card 차단

### 커밋

```text
Task #6 Stage 4: README card 통합 QA와 문서화
```

## 검증 운영

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- renderer visual 결과는 구조 테스트만으로 닫지 않고 reference image와 실제 PNG를 직접 비교한다.
- 실제 GitHub OAuth smoke에는 사용자의 기존 로컬 `.env`를 사용하되 credential 값을 출력하거나 문서/커밋에 포함하지 않는다.
- GitHub Camo 원격 검증은 public deployment URL이 없으면 로컬 header/README contract까지 확인하고 한계를 보고서에 남긴다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.

## 단계 의존성

- Stage 2는 Stage 1의 canonical usage/card renderer가 고정된 뒤 진행한다.
- Stage 3는 Stage 2의 owner/profile/visibility/public URL API가 고정된 뒤 진행한다.
- Stage 4는 Stage 1~3 검증과 단계 보고가 완료된 뒤 진행한다.
- 후속 #5는 Stage 1의 usage validator와 Stage 2의 storage/submit 경계를 사용해 실제 CLI submit을 연결한다.

## 위험과 대응

- **submit contract 미완성**: #6은 `account/usage/read` 결과를 canonical card input으로 고정하지만 CLI command 자체는 구현하지 않는다. Stage 2 test fixture로 persisted usage를 검증하고 #5에 API 연결 기준을 넘긴다.
- **기존 public Profile regression**: `/u/:handle`의 full Profile UI는 유지하고 `/profile`을 owner card page로 별도 분리한다.
- **private preview cache**: public ETag cache와 섞이지 않도록 owner preview는 `private, no-store`와 별도 route를 사용한다.
- **visibility race**: public read 시 owner와 usage visibility를 매번 확인하고 process cache key에도 visibility를 포함한다.
- **dependency portability**: renderer dependency를 선택할 때 Node 20, macOS/Linux, license, CI install을 Stage 1에서 검증한다.
- **avatar privacy/SSRF**: owner avatar URL만 허용하고 arbitrary CLI URL은 읽지 않는다. fetch host/content/size 제한을 service에서 적용한다.

## 승인 요청 사항

- 위 4개 Stage 분할과 Stage 1 구현 진입 승인을 요청한다.
- Stage 1에서는 CLI command 없이 `account/usage/read` result contract, GitHub identity merge, renderer까지만 구현한다.
- 각 Stage 완료 후 `task-stage-report` 절차로 보고서와 commit을 만든 뒤 다음 승인 지점에서 멈춘다.
