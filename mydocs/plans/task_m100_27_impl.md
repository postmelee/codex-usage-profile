# Task M100 #27 구현계획서

수행계획서: [`task_m100_27.md`](task_m100_27.md)
GitHub Issue: [#27](https://github.com/postmelee/codex-usage-profile/issues/27)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Token limit backend policy | active token 최대 3개 제한, limit error, backend tests | `npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js` |
| 2 | Settings token limit UI | token limit metadata/copy, create disabled/error UX, client/UI tests | `npm test -- src/profile-api/__tests__/client.test.js` + `npm run build` |
| 3 | SameSite/CSRF hardening review | session cookie/settings mutation 보안 점검, 필요한 최소 조치, security tests | `npm test -- src/profile-backend/__tests__/session.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js` |
| 4 | Integration QA and final report | full regression, runtime smoke, 최종 보고서, PR prep | `npm test`, `npm run build`, `git diff --check` |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `mydocs/plans/task_m100_27.md` | `mydocs/plans/` | 작성 완료 | OK | 수행계획서 |
| `mydocs/orders/20260617.md` | `mydocs/orders/` | 갱신 완료 | OK | 오늘할일 |
| `mydocs/plans/task_m100_27_impl.md` | `mydocs/plans/` | 본 문서 | OK | 구현계획서 |
| 공식 사용자/API 문서 | 해당 없음 | 해당 없음 | OK | 이번 task는 내부 정책과 테스트로 고정 |

## Stage 1 — Token limit backend policy

### 산출물

신규:

- `mydocs/working/task_m100_27_stage1.md`

수정:

- `src/profile-backend/tokens.js`
- `src/profile-backend/http.js`
- `src/profile-backend/__tests__/tokens.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `mydocs/orders/20260617.md`

### 변경 내용

- active token 최대 개수 상수를 backend에 추가한다.
  - 기본값: owner당 active token 3개
  - active token 정의: `revokedAt`이 없는 token
- `createCliTokenService.issueCliToken` 또는 settings token route의 생성 경로에 active token 제한을 적용한다.
- 제한 초과 시 기존 error 체계에 맞춰 `conflict` 계열 response를 반환한다.
- revoked token은 active 제한 수에서 제외한다.
- device-code login token 발급 경로가 같은 정책을 공유할지 판단한다.
  - 같은 CLI token pool을 사용하므로 동일 제한을 기본으로 검토한다.
  - CLI login 흐름과 settings 직접 생성 흐름이 서로 다른 UX를 만들면 단계 보고서에 근거를 남긴다.
- token name 중복은 보안 이슈가 아니므로 이번 task에서는 허용한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/tokens.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
git diff --check
```

검증 관점:

- active token 3개 상태에서 추가 생성은 실패한다.
- revoked token이 있으면 새 token 생성이 가능하다.
- 기존 list/create/revoke, raw token 1회 반환, digest 미노출 검증은 유지된다.
- owner별 제한이 서로 격리된다.

### 커밋

```text
Task #27 Stage 1: token limit backend policy 구현
```

## Stage 2 — Settings token limit UI

### 산출물

신규:

- 필요한 경우 `src/profile-ui/__tests__/settingsUi.test.js`
- `mydocs/working/task_m100_27_stage2.md`

수정:

- `src/profile-api/client.js`, 필요한 경우
- `src/profile-api/__tests__/client.test.js`
- `src/profile-ui/SettingsPage.jsx`
- `src/styles.css`
- `mydocs/orders/20260617.md`

### 변경 내용

- Settings API Tokens panel이 active token 제한 상태를 표시하게 한다.
- active token이 3개 이상이면 create action을 비활성화하거나 명확한 제한 메시지를 표시한다.
- backend limit error가 돌아올 때도 사용자가 이해할 수 있는 error copy를 표시한다.
- create 요청 중 `submitting` 상태에서 반복 클릭으로 중복 token이 생성되지 않는지 확인하고, 필요하면 버튼 disabled 조건을 보강한다.
- token revoke 후 token list state가 갱신되면서 create action이 다시 가능해지는지 확인한다.

### 검증

```bash
npm test -- src/profile-api/__tests__/client.test.js
npm run build
git diff --check
```

추가 UI helper test를 만들면 해당 test를 함께 실행한다.

검증 관점:

- active token 3개 도달 시 제한 상태가 표시된다.
- 제한 상태에서 create action이 우회되지 않는다.
- revoke 후 create 가능 상태로 돌아온다.
- 기존 one-time raw token reveal/copy UX가 유지된다.

### 커밋

```text
Task #27 Stage 2: settings token limit UI 구현
```

## Stage 3 — SameSite/CSRF hardening review

### 산출물

신규:

- `mydocs/working/task_m100_27_stage3.md`

수정:

- `src/profile-backend/session.js`, 필요한 경우
- `src/profile-backend/http.js`, 필요한 경우
- `src/profile-backend/__tests__/session.test.js`
- `src/profile-backend/__tests__/http.test.js`
- `src/profile-backend/__tests__/security.test.js`
- `mydocs/orders/20260617.md`

### 변경 내용

- session cookie serializer의 `SameSite`, `HttpOnly`, `Secure`, `Path`, expiry 설정을 점검한다.
- settings mutation route가 browser session cookie를 쓰는 경계를 확인한다.
- MVP 최소 조치로 충분한지 판단한다.
  - SameSite가 명시되지 않았거나 local/prod 정책이 애매하면 명시적 SameSite 정책을 추가한다.
  - full CSRF token 도입이 필요하다고 판단되면 이번 task에서 무리하게 확장하지 않고 후속 이슈 후보로 기록한다.
- GET route가 mutation을 수행하지 않는지 확인한다.
- token create/revoke, device authorize/rename, logout 같은 mutation route의 보안 경계를 테스트로 고정한다.

### 검증

```bash
npm test -- src/profile-backend/__tests__/session.test.js src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
git diff --check
```

검증 관점:

- session cookie 보안 속성이 기대값으로 serializing된다.
- settings mutation route는 session cookie가 없으면 실패한다.
- bearer token만으로 settings mutation을 수행할 수 없다.
- 점검 결과와 후속 판단이 단계 보고서에 기록된다.

### 커밋

```text
Task #27 Stage 3: SameSite CSRF hardening 검토
```

## Stage 4 — Integration QA and final report

### 산출물

신규:

- `mydocs/working/task_m100_27_stage4.md`
- `mydocs/report/task_m100_27_report.md`

수정:

- `mydocs/orders/20260617.md`
- 필요한 최종 보강 파일

### 변경 내용

- 전체 테스트와 build를 실행한다.
- 가능한 경우 로컬 GitHub 로그인 상태에서 token 3개 제한, revoke 후 재생성, create 반복 클릭 방지를 수동 smoke로 확인한다.
- active token 제한, SameSite/CSRF 점검 결과, 후속 위험을 최종 보고서에 정리한다.
- PR 본문에 필요한 검증 결과를 정리한다.

### 검증

```bash
npm test
npm run build
git diff --check
```

수동 검증:

```text
http://127.0.0.1:{port}/settings
```

- active token 3개까지 생성
- 4번째 생성 거부 또는 disabled 상태 확인
- revoke 후 새 token 생성 가능 확인

### 커밋

```text
Task #27 Stage 4: token limit 통합 QA와 최종 보고
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 로컬 smoke가 실제 OAuth session이나 기존 `.data` 상태 때문에 불안정하면 memory-store 테스트를 진실 원천으로 두고, 수동 검증 한계를 단계 보고서에 적는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_27_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 `Task #27 Stage {N}: {핵심 내용 요약}` 형식을 따른다.

## 단계 의존성

- Stage 2는 Stage 1의 backend 제한 contract가 고정된 뒤 진행한다.
- Stage 3은 Stage 1~2 token mutation 경계를 확인한 뒤 진행한다.
- Stage 4는 Stage 1~3 검증과 보고서가 완료된 뒤 진행한다.

## 위험과 대응

- **device-code login과 settings 직접 생성의 정책 차이**: 같은 CLI token pool을 쓰므로 동일 active limit 적용을 기본으로 검토한다. UX 차이가 필요한 경우 Stage 1 보고서에 근거를 남기고 구현계획서를 갱신한다.
- **limit metadata contract 확장**: API response에 limit metadata를 추가할지 UI 계산으로 충분한지 Stage 2에서 결정한다. 불필요한 API surface 확장은 피한다.
- **CSRF 범위 확장**: full CSRF token 도입은 별도 설계가 필요할 수 있다. SameSite/session cookie 최소 조치로 충분하지 않으면 후속 이슈로 분리한다.
- **로컬 smoke data 오염**: `.data`에 남은 token 때문에 수동 검증 결과가 헷갈릴 수 있다. 테스트는 memory store로 고정하고, 수동 검증 시 필요한 경우 별도 store file을 사용한다.

## 승인 요청 사항

- 수행계획서 승인에 따라 위 Stage 분할과 Stage 1 구현 진입을 승인받은 것으로 보고 진행한다.

수행계획서 승인에 따라 위 Stage 분할과 Stage 1 구현 진입을 승인받은 것으로 보고 진행한다.
