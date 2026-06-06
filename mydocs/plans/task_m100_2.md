# Task M100 #2 수행계획서

GitHub Issue: [#2](https://github.com/postmelee/codex-usage-profile/issues/2)
마일스톤: M100

## 목적

최신 Codex Profile 화면과 공유 카드 기능을 웹서비스에서 재현하기 위한 공통 profile snapshot 계약을 정의한다. 이 계약은 이후 웹 프로필 UI, pairing API, 로컬 CLI push, README PNG endpoint가 같은 데이터 구조를 공유하도록 만드는 기반이다.

이번 task의 핵심 결과는 "서버에 저장해도 되는 정제된 Codex 활동 데이터"와 "절대 저장하거나 업로드하지 않는 인증/토큰 데이터"를 코드와 테스트로 분리하는 것이다. OpenAI/ChatGPT access token, refresh token, `~/.codex/auth.json` 원문, raw credential은 웹서비스 payload와 저장소 모델에 포함하지 않는 방향을 고정한다.

## 배경

기존 #1은 이전 버전 Codex 화면 기준의 단일 MVP 계획이었다. 이번 세션에서 목표가 최신 Codex Profile 화면, Codex 공유 카드 이미지, CLI push + pairing API 구조로 재정의되면서 #1은 닫고 #2-#6으로 분리했다.

추출된 Codex 앱 분석 결과, Profile 데이터는 내부적으로 `/wham/profiles/me` 응답을 `displayName`, `username`, `imageUrl`, `summary`, `dailyUsage`, `activityInsights` 형태로 변환한다. 공유 카드는 DOM 캡처가 아니라 499x306 logical canvas를 2x PNG로 직접 그린다. 따라서 먼저 이 변환 결과를 우리 서비스의 안정적인 snapshot schema로 고정해야 이후 구현이 흔들리지 않는다.

참고 근거:

- `codex-extracted/webview/assets/profile-queries-Ccuj1gLs.js`
- `codex-extracted/webview/assets/profile-DFD9l1SG.js`
- OpenAI Codex 인증 문서: https://developers.openai.com/codex/auth
- GitHub README 이미지 캐시 문서: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls

## 범위

### 포함

- versioned profile snapshot schema 정의
- snapshot TypeScript type 및 runtime validator 도입
- Codex profile 변환 결과와 snapshot 필드 매핑
- 서버 저장 허용 필드 allowlist와 token-like field denylist 정책
- sample snapshot fixture 작성
- README 카드와 전체 프로필 화면이 사용할 데이터 selector 또는 최소 유틸리티 정의
- schema, normalizer, 보안 경계 단위 테스트
- 추출 코드 분석 결과를 내부 기술 노트로 정리

### 제외

- 실제 pairing API와 snapshot 저장 backend 구현
- 실제 로컬 CLI push 구현
- 전체 Codex Profile 화면 UI 구현
- README PNG endpoint 구현
- OpenAI 계정을 웹사이트 로그인 provider로 사용하는 기능
- GitHub README 파일을 자동 commit으로 수정하는 기능

## 설계 방향

- repository root에 아직 제품 코드 scaffold가 없으므로, 기존 구조가 없다면 최소 TypeScript 기반 패키지 구성을 이번 task에서 만든다.
- snapshot은 `schemaVersion`을 필수로 두고, 이후 breaking change가 생기면 migration 또는 version branching으로 대응한다.
- raw Codex 응답 전체를 서버에 저장하지 않는다. normalizer는 raw input에서 allowlist 필드만 추출해 snapshot을 만든다.
- 보안 경계는 "검증으로 허용된 snapshot만 upload/store 가능"하도록 validator와 테스트에 반영한다.
- avatar/pet 같은 asset은 raw credential이나 private local path를 저장하지 않고, 이후 issue에서 asset upload/cache 정책을 붙일 수 있도록 `assetRef` 또는 nullable metadata 형태로 둔다.
- activity chart 계산은 #3 UI 작업에서 확장할 수 있게 daily usage와 summary 데이터를 보존하되, UI 렌더링 자체는 이번 task에서 구현하지 않는다.
- Codex 추출 파일은 분석 입력 자료로만 사용한다. 해당 untracked 폴더를 task 산출물로 추가하거나 수정하지 않는다.

## 문서 위치 판단

이번 task는 외부 사용자용 공식 API 문서를 만들지 않는다. snapshot 계약은 아직 내부 구현 계약이며, 이후 public API로 공개할지 여부는 pairing/API task 또는 별도 문서 task에서 판단한다.

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
|---|---|---|---|---|---|
| `mydocs/tech/task_m100_2_snapshot_contract.md` | 기술 조사/내부 계약 기록 | 내부 작업자/에이전트 | `mydocs/tech/` | `docs/` 또는 `specs/` | 현재는 public API 계약이 아니라 #3-#6 구현을 정렬하기 위한 내부 근거이므로 공식 문서 루트로 승격하지 않는다. |
| source schema/test files | 제품 코드 | 개발자/에이전트 | repository source tree | `mydocs/` | 실행되는 계약과 검증은 코드로 유지해야 하며, `mydocs/`는 산출물/분석 기록 위치다. |

## 예상 변경 파일

신규:

- `package.json`
- `tsconfig.json`
- `src/profile-snapshot/types.ts`
- `src/profile-snapshot/schema.ts`
- `src/profile-snapshot/normalize.ts`
- `src/profile-snapshot/selectors.ts`
- `src/profile-snapshot/fixtures/sample-snapshot.ts`
- `src/profile-snapshot/__tests__/schema.test.ts`
- `src/profile-snapshot/__tests__/normalize.test.ts`
- `mydocs/tech/task_m100_2_snapshot_contract.md`

수정:

- 기존 제품 코드 scaffold가 발견될 경우 위 신규 파일 경로는 기존 패턴에 맞게 조정한다.

이번 task 산출물:

- `mydocs/orders/20260607.md`
- `mydocs/plans/task_m100_2.md`
- `mydocs/plans/task_m100_2_impl.md`
- `mydocs/working/task_m100_2_stage{N}.md`
- `mydocs/report/task_m100_2_report.md`

## 잠정 단계

- **Stage 1 — 구현 기반과 snapshot schema 초안**
  - repository root의 코드 scaffold 여부를 확인하고, 필요한 최소 TypeScript/test 구성을 만든다.
  - profile snapshot type과 runtime validator를 정의한다.
  - sample snapshot fixture를 만든다.
  - schema validation 테스트를 추가한다.

- **Stage 2 — Codex raw data 정규화와 보안 allowlist**
  - 추출 코드 기준 raw profile 변환 매핑을 정리한다.
  - raw input에서 허용 필드만 snapshot으로 변환하는 normalizer를 구현한다.
  - access token, refresh token, `auth.json`, credential 유사 필드가 snapshot에 남지 않도록 테스트한다.

- **Stage 3 — 화면/카드 공통 selector와 fixture 완성**
  - 전체 Profile 화면에 필요한 summary/activity/plugins selector를 정의한다.
  - 공유 카드에 필요한 4개 stat과 26주 usage input을 꺼낼 수 있는 selector를 정의한다.
  - README card와 profile UI가 같은 fixture를 사용할 수 있는지 검증한다.

- **Stage 4 — 내부 계약 문서와 최종 검증**
  - `mydocs/tech/task_m100_2_snapshot_contract.md`에 schema, 매핑, 보안 경계, 후속 issue 의존성을 정리한다.
  - 금지 필드 grep, unit test, diff check를 수행한다.
  - 단계 보고서와 최종 보고서에서 후속 #3-#6 작업에 넘길 계약을 명확히 남긴다.

## 검증 계획

### 단계별 검증

- Stage 1
  - package/test command가 있으면 schema validation 테스트 실행
  - package/test command가 새로 생기면 해당 명령으로 fixture validation 확인
- Stage 2
  - normalizer 단위 테스트
  - token-like field 거부 또는 제거 테스트
  - `rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src mydocs`
- Stage 3
  - selector 단위 테스트
  - sample snapshot이 전체 Profile 화면과 공유 카드 요구 필드를 모두 제공하는지 테스트
- Stage 4
  - `git diff --check`
  - 최종 test command
  - `git status --short`에서 task 산출물 외 미정리 변경이 없는지 확인

### 통합 검증

- sample snapshot이 schema validation을 통과한다.
- token 유사 필드가 snapshot 저장 대상에서 제외되거나 validation에서 거부된다.
- daily/weekly/cumulative heatmap 계산에 필요한 최소 데이터가 snapshot에 포함된다.
- Codex 공유 카드 생성에 필요한 display name, username, avatar, pet, usage cells, 4개 stats 필드가 표현 가능하다.
- 전체 프로필 화면의 5개 stat, activity insights, most used plugins가 표현 가능하다.
- `git status --short`가 PR 준비 전 빈 출력이다. 단, 작업 전부터 존재한 untracked `codex-extracted/`는 이번 task 산출물로 취급하지 않는다.
- `git diff --check`가 경고 없이 통과한다.

## 리스크

- **제품 코드 scaffold 부재**: 저장소 root에 아직 앱/패키지 구조가 없으므로 #2에서 최소 TypeScript 기반을 만들 가능성이 있다. 기존 구조가 발견되면 그 구조를 우선한다.
- **Codex 내부 API 불안정성**: `/wham/profiles/me`는 추출 코드 기준 내부 API이므로, raw 응답 전체에 의존하지 않고 정제된 snapshot 계약으로 고립한다.
- **토큰 누출 위험**: CLI와 backend가 붙기 전부터 allowlist/denylist와 테스트를 둬 credential이 snapshot에 들어갈 여지를 줄인다.
- **후속 issue 의존성**: #3-#6은 이 task의 schema에 의존하므로, breaking change 가능성을 `schemaVersion`과 내부 기술 노트에 명시한다.

## 승인 요청 사항

- #2 범위를 snapshot schema, normalizer, fixture, selector, 보안 경계, 내부 기술 노트로 한정하는 것을 승인해 달라.
- OpenAI 계정 웹 로그인, pairing API, CLI push, Profile UI, README PNG endpoint는 각각 #4, #5, #3, #6에서 구현하는 제외 범위를 승인해 달라.
- 공식 사용자 문서 루트는 이번 task에서 만들지 않고, snapshot 계약 근거는 `mydocs/tech/`에 내부 기술 노트로 남기는 문서 위치 판단을 승인해 달라.

승인되면 `task_m100_2_impl.md`에서 단계별 산출물, 검증 명령, 커밋 메시지를 구체화한다.
