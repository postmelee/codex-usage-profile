# Task M100 #32 구현계획서

수행계획서: [`task_m100_32.md`](task_m100_32.md)
GitHub Issue: [#32](https://github.com/postmelee/codex-usage-profile/issues/32)
마일스톤: M100

## 구현 전제

- canonical usage source는 `codex-usage-analyzer` Account Usage Contract v1이다.
- 지원 필드는 `capturedAt`, five summary metrics, source-dated daily usage buckets다.
- GitHub display name, login, avatar, handle과 visibility는 downstream owner record만 신뢰한다.
- `/profile` owner preview와 `/u/:handle/card.png` public card는 이미 `latestUsages`를 사용한다.
- `/u/:handle` HTML route만 legacy UsageSnapshot과 sample fixture에 남아 있다.
- public profile JSON과 PNG는 동일한 owner/usage/visibility eligibility를 공유해야 한다.
- private, missing, usage 없음, handle·visibility 불일치는 모두 fail-closed public not-found로 처리한다.
- legacy snapshot submit/storage/validator는 이번 task에서 삭제하지 않지만 production app route에서는 사용하지 않는다.
- plugin/skill/activity enrichment, landing/Quickstart와 production deployment는 범위 밖이다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Public Account Usage profile backend | shared eligibility, public profile service/JSON route, allowlist | card/backend unit·HTTP·security tests |
| 2 | Public route와 card 중심 UI 전환 | API client, loader, `PublicProfilePage`, App routing | client/route/UI tests, focused build |
| 3 | Legacy 경계와 공식 문서 정리 | production import 제거, compatibility 설명, README/docs | `rg`, docs contract review, full unit/build |
| 4 | Runtime·시각·보안 통합 QA | public/private/missing E2E, revision sync, desktop/mobile QA | full test/build/e2e, manual screenshots |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | Stage 3 수정 | OK | 실제 public route와 개발 경계 안내 |
| `docs/readme-card.md` | `docs/` | Stage 3 수정 | OK | public profile/card/visibility 사용자 계약 |
| `docs/usage-snapshot-v2.md` | `docs/` | Stage 3 수정 | OK | legacy compatibility 범위 명시 |
| `mydocs/plans/task_m100_32.md` | `mydocs/plans/` | 승인 완료 | OK | 수행 범위와 설계 방향 |
| `mydocs/plans/task_m100_32_impl.md` | `mydocs/plans/` | 본 문서 | OK | Stage별 구현 계약 |
| 단계·최종 보고서 | `mydocs/working`, `mydocs/report` | 각 Stage 및 최종 절차 | OK | Hyper-Waterfall 검증 기록 |

## Stage 1 — Public Account Usage profile backend

### 산출물

신규:

- `mydocs/working/task_m100_32_stage1.md`

수정:

- `src/profile-card/service.js`
- `src/profile-card/index.js`, public export가 필요한 경우
- `src/profile-card/__tests__/service.test.js`
- `src/profile-backend/http.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `src/profile-backend/__tests__/durable-store.test.js`, persistence 회귀가 필요한 경우
- `mydocs/orders/20260713.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. `profile-card` service 내부에 public profile eligibility resolver를 추가한다.
   - handle을 기존 public card와 같은 규칙으로 normalize한다.
   - owner는 `store.getOwnerByHandle(handle)`로 조회한다.
   - latest usage는 owner id로 조회해 다른 handle index의 stale record를 신뢰하지 않는다.
   - owner와 usage record가 모두 public이고 handle이 일치할 때만 결과를 반환한다.
   - private, missing, usage 없음, owner/usage handle 불일치, visibility 불일치는 동일한 not-found error다.
2. `renderPublicCard()`가 새 eligibility resolver를 사용하도록 중복 판정을 제거한다.
3. public profile read method를 추가한다.
   - 반환 내부값은 `{ owner, usageRecord, visibility }`로 owner preview와 유사하게 유지한다.
   - serializer에서만 public allowlist를 적용한다.
4. `GET /api/profiles/public/:handle` route를 추가한다.
   - 익명 접근을 허용한다.
   - response는 GitHub display name/login/avatar/handle, public visibility, captured/uploaded time, normalized `{ summary, dailyUsageBuckets }`, stable public card URL만 포함한다.
   - owner numeric id, provider user id, OAuth/session/token/device, content digest, 내부 revision은 제외한다.
5. malformed encoded handle과 unsupported path는 safe 404로 처리한다.
6. 기존 `/api/snapshots/public/:handle`, owner `/api/profile`, public card GET/HEAD/ETag는 회귀 테스트로 보존한다.

### 검증

```bash
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
node --test src/profile-backend/__tests__/durable-store.test.js
git diff --check
```

검증 관점:

- public owner + public matching usage만 profile JSON과 PNG를 조회할 수 있다.
- private, missing, usage 없음, handle/visibility mismatch가 동일한 404를 반환한다.
- JSON summary의 `null`은 그대로 유지되고 daily bucket source date가 변형되지 않는다.
- 응답에 owner id, token, credential, device, digest, private revision, local path가 없다.
- JSON URL과 card URL이 같은 canonical handle을 사용한다.
- 기존 owner profile, legacy snapshot API와 card cache/HEAD 동작이 유지된다.

### 커밋

```text
Task #32 Stage 1: public Account Usage profile backend 구현
```

## Stage 2 — Public route와 card 중심 UI 전환

### 산출물

신규:

- `src/profile-ui/PublicProfilePage.jsx`
- `src/profile-ui/publicProfileRoutes.js`
- `src/profile-ui/__tests__/publicProfileRoutes.test.js`
- `mydocs/working/task_m100_32_stage2.md`

수정:

- `src/App.jsx`
- `src/profile-api/client.js`
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/appRoutes.js`, route metadata가 필요한 경우
- `src/profile-ui/__tests__/appRoutes.test.js`
- `src/profile-ui/ProfileShell.jsx`, public page navigation 조정이 필요한 경우
- `src/styles.css`
- `tests/profile-ui.spec.js`
- `mydocs/orders/20260713.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. API client에 `getPublicProfile(handle)`을 추가한다.
   - `GET /api/profiles/public/:handle`만 호출한다.
   - response envelope의 public owner, usage, visibility, card URL을 반환한다.
   - not-found는 route loader가 unavailable state로 변환할 수 있는 기존 client error contract를 유지한다.
2. `publicProfileRoutes.js`에 production public profile state loader를 구현한다.
   - 모든 `/u/:handle`은 handle 값과 무관하게 API-backed loading으로 시작한다.
   - sample handle 자동 fixture 특례를 두지 않는다.
   - ready/loading/unavailable state에 snapshot 대신 public profile record를 담는다.
3. `App.jsx`에서 sample snapshot, legacy selector, `ProfilePage` runtime import를 제거한다.
   - `/`, `/profile`, `/settings`, `/device` route는 변경하지 않는다.
   - public route는 `PublicProfilePage`로 렌더링한다.
4. `PublicProfilePage`를 card 중심으로 구현한다.
   - ready: public card URL을 fixed 998x612 aspect ratio image로 표시한다.
   - heading과 accessible text는 GitHub display name/login을 사용한다.
   - loading/unavailable은 identity나 존재 여부를 노출하지 않는 중립 상태를 사용한다.
   - unsupported Activity insights와 Most used plugins를 렌더링하지 않는다.
5. desktop/mobile에서 page frame 내부 스크롤, card aspect ratio, text clipping과 horizontal overflow가 없도록 스타일을 추가한다.
6. E2E API mock은 Account Usage Contract v1 public response만 사용하며 fixture snapshot을 실제 사용자 데이터로 사용하지 않는다.

### 검증

```bash
node --test src/profile-api/__tests__/client.test.js
node --test src/profile-ui/__tests__/appRoutes.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js
npm run build
npm run test:e2e -- --grep "public profile"
git diff --check
```

검증 관점:

- sample handle과 임의 handle 모두 같은 public API를 조회한다.
- ready state의 card URL과 GitHub identity가 API 응답과 일치한다.
- private/missing 응답은 같은 unavailable UI가 되고 identity를 노출하지 않는다.
- null summary는 card PNG의 `—` 표현에 맡기며 별도 가짜 값을 렌더링하지 않는다.
- public route DOM에 Activity insights, Most used plugins, synthetic stats가 없다.
- Home, owner Profile, Settings, Device route regression이 없다.
- 390px mobile과 desktop에서 overflow 및 text clipping이 없다.

### 커밋

```text
Task #32 Stage 2: public profile route와 UI 전환
```

## Stage 3 — Legacy 경계와 공식 문서 정리

### 산출물

신규:

- `mydocs/working/task_m100_32_stage3.md`

수정:

- `README.md`
- `docs/readme-card.md`
- `docs/usage-snapshot-v2.md`
- `src/profile-ui/profileRoutes.js` 및 기존 test, 잔여 compatibility 설명이나 명명 조정이 필요한 경우
- `src/profile-ui/ProfilePage.jsx`와 legacy UI 파일, production에서 완전히 미사용임을 명확히 하기 위한 최소 정리만 필요한 경우
- `mydocs/orders/20260713.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. production entry graph에서 legacy snapshot public route가 제거됐는지 확인한다.
   - `App.jsx`에 `sampleProfileSnapshot`, `selectProfileViewModel`, `ProfilePage`, legacy `profileRoutes` import가 없어야 한다.
   - old modules를 삭제하지 않되 compatibility/test-only 경계로 유지한다.
2. 잔여 legacy module/test 이름이나 주석이 production route로 오해될 경우 최소 수정한다.
   - 광범위한 schema/store/API 삭제는 하지 않는다.
   - 후속 제거가 필요하면 최종 보고의 별도 후보로 남긴다.
3. README를 현재 route로 갱신한다.
   - `/u/:handle`은 latest Account Usage Contract v1 public card profile이다.
   - 기존 full-profile sample preview 안내를 제거한다.
   - analyzer version 표기는 설치된 package contract 기준으로 정리하고 불필요한 고정 minor 설명을 피한다.
4. `docs/readme-card.md`에 public HTML profile과 PNG가 같은 owner/usage/visibility를 공유함을 기록한다.
5. `docs/usage-snapshot-v2.md`에 legacy compatibility contract이며 active analyzer submit/public profile path가 아님을 명확히 한다.
6. plugin/skill/model/token breakdown을 current public profile에서 지원한다고 오해시키는 문구가 없는지 점검한다.

### 검증

```bash
rg -n "sampleProfileSnapshot|selectProfileViewModel|ProfilePage|profileRoutes" src/App.jsx
rg -n "Activity insights|Most used plugins|topInvocations|UsageSnapshot v2|/api/snapshots/public" README.md docs src/profile-ui
npm test
npm run build
git diff --check
```

검증 관점:

- 첫 `rg`는 production App entry에서 legacy import가 없는 빈 출력이어야 한다.
- 공식 문서가 Account Usage Contract v1, GitHub identity, public route와 card URL의 책임을 일관되게 설명한다.
- UsageSnapshot v2가 active analyzer output 또는 active public route로 설명되지 않는다.
- legacy API가 남아 있다는 사실과 production에서 사용하지 않는다는 사실이 구분된다.
- 문서 위치가 수행계획서의 승인된 판단과 일치한다.

### 커밋

```text
Task #32 Stage 3: legacy profile 경계와 문서 정리
```

## Stage 4 — Runtime·시각·보안 통합 QA

### 산출물

신규:

- `mydocs/working/task_m100_32_stage4.md`

수정:

- `tests/profile-ui.spec.js`
- `src/profile-runtime/__tests__/dev-server.test.js`, runtime route 회귀가 필요한 경우
- `src/profile-runtime/__tests__/host-adapter.test.js`, classification 회귀가 필요한 경우
- 통합 검증에서 발견된 최소 보강 파일
- `mydocs/orders/20260713.md` 또는 실제 진행 날짜 orders 파일

### 변경 내용

1. backend store에 owner + Account Usage Contract v1 record를 seed한 runtime 시나리오를 검증한다.
   - public `/u/:handle`
   - public `/u/:handle/card.png`
   - private 전환 후 두 public surface 차단
   - missing handle 비노출
2. submit revision 동기화를 검증한다.
   - first usage로 public profile/card 표시
   - exact retry는 card ETag 유지
   - later usage는 같은 card URL의 ETag와 image content 변경
   - public HTML은 stable card URL을 계속 사용한다.
3. Playwright desktop/mobile 시나리오를 고정한다.
   - loading → ready
   - unavailable
   - GitHub identity와 card image
   - frame 내부 scroll, horizontal overflow, clipping 없음
4. 보안 회귀를 확인한다.
   - private/missing 응답이 동일한 외부 동작을 보인다.
   - public API/DOM에 owner id, token, credential, digest, local path가 없다.
   - avatar와 card endpoint의 기존 host/content/size/cache 정책이 유지된다.
5. 실제 로컬 runtime smoke가 가능하면 로그인된 owner의 submit/publish/public profile을 시각 확인한다. credential 값과 실제 usage 수치는 보고서에 기록하지 않는다.

### 검증

```bash
npm test
npm run build
npm run test:e2e
git diff --check
```

추가 검증:

```text
GET /u/{public-handle}
GET|HEAD /u/{public-handle}/card.png
GET /api/profiles/public/{public-handle}
GET /u/{private-or-missing-handle}
```

검증 관점:

- public HTML/JSON/PNG가 같은 GitHub identity, latest usage와 stable card URL을 사용한다.
- private/missing은 identity와 usage를 공개하지 않는다.
- second changed submit 후 HTML source URL은 유지되고 PNG ETag/bytes가 변경된다.
- desktop/mobile screenshots에서 card framing, text, scroll과 overflow가 정상이다.
- full unit/build/e2e 회귀가 통과한다.

### 커밋

```text
Task #32 Stage 4: public profile 통합 QA 완료
```

## 검증 운영

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 각 Stage 소스와 `mydocs/working/task_m100_32_stage{N}.md`를 같은 커밋으로 묶는다.
- 실제 OAuth/runtime smoke는 사용자의 기존 local configuration을 사용할 수 있지만 credential이나 실제 usage 값은 출력·문서·커밋에 포함하지 않는다.
- Playwright screenshot은 구조 검사만으로 대체하지 않고 desktop/mobile을 직접 확인한다.
- 구현 중 public endpoint 이름이나 document 위치가 바뀌면 먼저 본 구현계획서를 갱신하고 승인을 받는다.

## 커밋

- Stage 1: `Task #32 Stage 1: public Account Usage profile backend 구현`
- Stage 2: `Task #32 Stage 2: public profile route와 UI 전환`
- Stage 3: `Task #32 Stage 3: legacy profile 경계와 문서 정리`
- Stage 4: `Task #32 Stage 4: public profile 통합 QA 완료`
- 최종 결과보고서는 `task-final-report` 절차에 따라 오늘할일 갱신과 함께 별도 커밋한다.

## 단계 의존성

- Stage 2는 Stage 1의 public eligibility와 JSON response allowlist가 확정된 뒤 시작한다.
- Stage 3은 Stage 2에서 production App entry가 새 public route로 전환된 뒤 시작한다.
- Stage 4는 Stage 1~3의 검증과 단계 보고가 승인된 뒤 시작한다.
- 각 Stage 완료 후 `task-stage-report` 절차로 보고서와 커밋을 만들고 다음 단계 승인 지점에서 멈춘다.

## 위험과 대응

- **public 판정 중복**: JSON과 PNG에 별도 조건을 두지 않고 card service 내부 eligibility를 공유한다.
- **legacy test 붕괴**: old schema/API를 삭제하지 않고 production App 연결만 제거한다. test-only surface가 필요하면 명시적으로 분리한다.
- **정보 노출**: public serializer exact allowlist와 private/missing 동일 404를 HTTP/security test로 고정한다.
- **stale handle index**: owner handle을 canonical source로 삼고 usage record handle 일치를 매 read마다 확인한다.
- **card/image load 실패 UX**: JSON ready 이후 image가 실패해도 layout이 무너지지 않는 fallback state와 고정 크기를 둔다.
- **frontend-only preview 변화**: implicit sample profile을 제거한다. 필요 시 별도 explicit fixture adapter를 후속 개발 도구로 다루고 production pathname에는 넣지 않는다.
- **범위 팽창**: landing, plugin/skill enrichment, legacy API 삭제, deployment는 이번 Stage에 추가하지 않는다.

## 승인 요청 사항

- 위 4개 Stage 분할과 Stage 1 구현 진입 승인
- public JSON endpoint를 `GET /api/profiles/public/:handle`로 두는 경계
- card service의 public eligibility를 JSON과 PNG가 공유하는 설계
- `/u/:handle`을 card 중심 Account Usage Contract v1 공개 페이지로 전환하는 UI 방향
- legacy snapshot module/API를 삭제하지 않고 production App route에서만 분리하는 범위
- 각 Stage 완료 후 보고서·커밋과 다음 단계 승인을 별도로 수행하는 절차
