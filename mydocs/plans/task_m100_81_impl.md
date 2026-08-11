# Task #81 구현계획서 — 사용자 중심 README와 공개 문서·GitHub 메타데이터 정합화

수행계획서: [`task_m100_81.md`](task_m100_81.md)
GitHub Issue: [#81](https://github.com/postmelee/codex-usage-profile/issues/81)
마일스톤: M100

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 사용자 중심 README 재구성 | `README.md` | 배지 target·상태, placeholder 비렌더링, Support·Quick start·상대 링크 검증 |
| 2 | 공개 사용자·운영 문서 계약 정합화 | `docs/readme-card.md`, `docs/sites-operations.md`, `docs/production-hosting.md` | URL 역할·이미지 크기·배포 전후 상태 감사, 상대 링크 검증 |
| 3 | GitHub 공개 메타데이터 적용과 통합 검증 | GitHub description/homepage, `mydocs/working/task_m100_81_stage3.md` | metadata exact-match, production 비변경, 전체 문서·배지·링크 검증 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | `README.md` (Stage 1) | OK | 사용자·마케팅 기본 공개 진입점 |
| `docs/readme-card.md` | `docs/` | `docs/readme-card.md` (Stage 2) | OK | 카드·공유·cache 사용자 계약의 기존 진실 원천 |
| `docs/sites-operations.md` | `docs/` | `docs/sites-operations.md` (Stage 2) | OK | 제품별 Sites 배포·smoke·rollback 운영 문서 |
| `docs/production-hosting.md` | `docs/` | `docs/production-hosting.md` (Stage 2) | OK | current production baseline과 다음 후보 구분의 진실 원천 |
| GitHub description/homepage | GitHub repository metadata | GitHub repository metadata (Stage 3) | OK | 파일 밖 공개 검색·공유 표면이며 stage 보고서에 전후 exact 값을 기록 |
| Task #81 내부 산출물 | `mydocs/plans`, `mydocs/working`, `mydocs/report` | 같은 경로 | OK | Issue별 승인·검증 기록이며 공식 사용자 문서가 아님 |

신규 공식 문서 루트와 `mydocs/manual` 제품 문서는 만들지 않는다.

## Stage 1 — 사용자 중심 README 재구성

### 산출물

신규:

- `mydocs/working/task_m100_81_stage1.md` (Stage 1 완료 시 `task-stage-report`로 작성)

수정:

- `README.md`

### 변경 내용

- README를 다음 정보 위계로 재구성한다.
  1. 제목과 Website/npm/CI/MIT 배지
  2. 한 문장 가치 제안과 현재 production origin 안내
  3. 다음 production 배포 뒤 실제 카드로 교체할 HTML comment placeholder
  4. Codex for Open Source Support와 maintainer 대상 비보증 고지
  5. GitHub 로그인 → `submit` → private preview → publish → 공유 링크/README Markdown Quick start
  6. README 카드와 소셜 공유 링크의 역할
  7. 데이터·privacy·security 경계
  8. Requirements, CLI reference, 문서, 개발·운영 링크
  9. License와 Trademark Notice
- 상단 배지는 다음 exact Markdown을 기준으로 한다.
  - Website: `https://img.shields.io/badge/Website-Open-0969da` → canonical production origin
  - npm: `https://img.shields.io/npm/v/codex-usage-profile` → npm package
  - CI: `https://img.shields.io/github/actions/workflow/status/postmelee/codex-usage-profile/publish-npm.yml?branch=devel&label=CI` → GitHub Actions workflow
  - License: `https://img.shields.io/badge/License-MIT-yellow.svg` → `LICENSE`
- Website 배지는 uptime을 주장하지 않는 정적 클릭 배지로 유지한다. dynamic health badge는 넣지 않는다.
- 카드 placeholder는 아래 marker를 HTML comment 안에 둔다. Markdown image를 활성화하지 않는다.
  - `<PRODUCTION_CARD_URL>`
  - `<PRODUCTION_PROFILE_URL>`
  - 후속 production 배포와 `/u/{handle}` smoke가 통과한 뒤 교체한다는 주석
- Support 섹션은 공식 프로그램 링크와 다음 두 문장을 사용한다.
  - `Maintained with support from OpenAI’s Codex for Open Source program.`
  - `Support is provided to the maintainer and does not imply endorsement.`
- 기존 `codex-usage-profile@0.1.1`, canonical origin, analyzer의 공식 `account/usage/read` 경계, private-by-default, stable README URL, MIT/Trademark Notice 사실은 유지한다.
- README 카드 크기는 실제 output 1497x918, 소셜 미리보기는 2400x1260으로 적는다. 998x612 표현은 제거한다.
- `/u/{handle}`은 아직 production에 배포되지 않은 다음 후보임을 명시하고, 현재 production에서 작동한다고 오인되는 CTA나 실제 embed는 만들지 않는다.
- Cloud Run POC, 긴 runtime setting 표, 세부 API 설명은 삭제하지 않고 관련 공식 문서 링크 중심으로 축약한다. 유지해야 할 핵심 development command는 하단에 둔다.

### 검증

```bash
npm view codex-usage-profile version dist-tags --json
curl -fsSL 'https://img.shields.io/github/actions/workflow/status/postmelee/codex-usage-profile/publish-npm.yml?branch=devel&label=CI'
curl -fsSI 'https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site'
curl -fsSI 'https://www.npmjs.com/package/codex-usage-profile'
curl -fsSI 'https://developers.openai.com/community/codex-for-oss'
rg -n 'Website|npm package|CI|License: MIT|PRODUCTION_CARD_URL|PRODUCTION_PROFILE_URL|Codex for Open Source|does not imply endorsement|1497x918|2400x1260|998x612' README.md
git diff --check
```

- npm latest가 `0.1.1`인지 확인한다.
- CI badge SVG의 접근성 label이 `CI: passing`인지 확인한다.
- placeholder marker가 HTML comment 안에 있고 활성 Markdown image URL이 아님을 확인한다.
- README의 모든 상대 Markdown link를 추출해 대상 파일이 존재하는지 확인한다.
- 기존 Trademark Notice가 남아 있고 Support 문구와 충돌하지 않는지 확인한다.
- Stage 1 diff는 `README.md`와 Stage 1 보고서에 한정한다.

### 커밋

```text
Task #81 Stage 1: 사용자 중심 README와 공개 진입점 구성
```

## Stage 2 — 공개 사용자·운영 문서 계약 정합화

### 산출물

신규:

- `mydocs/working/task_m100_81_stage2.md` (Stage 2 완료 시 `task-stage-report`로 작성)

수정:

- `docs/readme-card.md`
- `docs/sites-operations.md`
- `docs/production-hosting.md`

보호 대상(감사만 수행하고 Task #81에서 수정하지 않음):

- `docs/cli-submit.md`
- `packages/codex-usage-profile-cli/README.md`
- 제품 code, test, workflow와 package manifest 전체

### 변경 내용

- `docs/readme-card.md`
  - 998x612 소개를 실제 1497x918 README PNG로 정정한다.
  - `/u/{handle}`을 다음 배포의 canonical 공유·OG HTML, `/u/{handle}/card.png`를 README 이미지, `/u/{handle}/social.png`를 2400x1260 소셜 미리보기로 구분한다.
  - `/?profile={handle}`은 SPA 호환 진입점으로만 남기거나, canonical 표기에서 제거한다. 유지 시 legacy/compatibility 역할을 명시한다.
  - 현재 production에는 새 `/u/{handle}` 문서 handler가 아직 배포되지 않았다는 전환 주석을 둔다.
- `docs/sites-operations.md`
  - 문서 상단의 current production HTML 경로는 saved version 7 baseline으로 명시하고, 다음 deploy candidate의 canonical share/OG 문서는 `/u/{handle}`임을 분리한다.
  - owner-only candidate smoke에 `/u/{handle}` HTML의 OG/canonical, `/u/{handle}/social.png`의 GET/HEAD/304와 private/missing fail-closed 검증을 추가한다.
  - public smoke와 cutover에서 extension 없는 `/u/{handle}` deep link를 금지한 문장을 제거하고, 배포 후보 검증 통과 후 production share link로 승격하는 조건으로 교체한다.
  - 기존 rollback, maintenance, readiness, OAuth와 data safety 순서는 변경하지 않는다.
- `docs/production-hosting.md`
  - current production table의 saved version 7, deployed source `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`, access/environment 값은 변경하지 않는다.
  - Task #74 단독 deploy candidate 표현을 현재 `devel`의 Task #74·#78 누적 후보로 보정한다.
  - Task #78의 `/u/{handle}` OG document, social image와 contract v3 projection은 local/PR 검증 상태이며 production smoke 전이라는 점을 명시한다.
  - 실제 배포 성공, migration 적용 또는 production version 증가를 기록하지 않는다.
- 저장소 전체 공개 문서에서 다음 표현을 감사한다.
  - `998x612`, `1497x918`, `2400x1260`
  - `/?profile={handle}`, `/u/{handle}`
  - `/card.png`, `/social.png`
  - `canonical`, `production link`, `current production`
- 감사 결과에서 범위 밖 문서에 기능 오류가 없으면 수정하지 않는다. 새 범위가 필요하면 구현계획서를 먼저 보정하고 승인을 받는다.

### 검증

```bash
rg -n '998x612|1497x918|2400x1260|\?profile=|/u/\{handle\}|card\.png|social\.png|canonical|production link|current production' README.md docs packages/codex-usage-profile-cli/README.md
git diff --name-only HEAD^ -- README.md docs packages src .github package.json package-lock.json
git diff --check
```

- 모든 `/?profile={handle}` occurrence가 current baseline 또는 compatibility로 명시되고 canonical share link와 충돌하지 않는지 수동 분류한다.
- 수정한 Markdown의 모든 상대 link target이 존재하는지 확인한다.
- `docs/production-hosting.md` current table의 exact source/version이 Stage 시작 전과 동일한지 비교한다.
- 제품 code, test, workflow와 package manifest diff가 비어 있는지 확인한다.
- Stage 2 diff는 세 공식 문서와 Stage 2 보고서에 한정한다.

### 커밋

```text
Task #81 Stage 2: 공유 링크와 Sites 운영 문서 정합화
```

## Stage 3 — GitHub 공개 메타데이터 적용과 통합 검증

### 산출물

외부 상태 변경:

- `postmelee/codex-usage-profile` GitHub repository description
- `postmelee/codex-usage-profile` GitHub repository homepage

신규:

- `mydocs/working/task_m100_81_stage3.md` (Stage 3 완료 시 `task-stage-report`로 작성)

### 변경 내용

- 변경 직전 `gh repo view`로 description/homepage의 이전 값이 각각 빈 문자열인지 확인하고 Stage 3 보고서에는 secret 없는 전후 exact 값만 기록한다.
- GitHub repository metadata를 다음 값으로 한 번 적용한다.
  - description: `Turn your Codex account usage into a shareable profile and stable GitHub README card.`
  - homepage: `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`
- 적용 직후 exact 값을 다시 조회한다. 하나라도 다르면 Stage 3 완료로 처리하지 않고 기존 빈 값으로 복원한 뒤 원인을 보고한다.
- README·공개 문서·badge·relative link 검증을 통합 재실행한다.
- production `/healthz`와 `/u/postmelee`를 redirect follow 없이 읽기 전용 확인한다. health 200과 현재 `/u/postmelee` 307→`/` baseline이 유지돼야 하며, 이 task에서 배포나 D1/R2 mutation을 수행하지 않는다.
- 실제 카드 embed marker는 그대로 남아 있어야 한다. GitHub homepage 설정은 live landing 링크만 제공하며 새 `/u/{handle}` 지원을 주장하지 않는다.

### 검증

```bash
gh repo view postmelee/codex-usage-profile --json description,homepageUrl
curl -fsSI 'https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/healthz'
curl -sS -o /dev/null -D - -A 'Twitterbot/1.0' 'https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/postmelee'
npm view codex-usage-profile version dist-tags --json
curl -fsSL 'https://img.shields.io/github/actions/workflow/status/postmelee/codex-usage-profile/publish-npm.yml?branch=devel&label=CI'
rg -n 'PRODUCTION_CARD_URL|PRODUCTION_PROFILE_URL|Codex for Open Source|does not imply endorsement|1497x918|2400x1260|998x612' README.md docs
git status --short
git diff --check
```

- `gh repo view` 결과가 승인된 description/homepage와 exact-match인지 확인한다.
- production health는 200, `/u/postmelee`는 현재 baseline인 307과 `Location: /`인지 확인한다.
- README와 수정한 공식 문서의 relative link target을 다시 확인한다.
- CI badge가 passing이며 npm latest가 `0.1.1`인지 확인한다.
- `README.md`, 세 공식 문서와 Task #81 산출물 외 tracked diff가 없는지 확인한다.

### 커밋

```text
Task #81 Stage 3: GitHub 공개 메타데이터 적용과 통합 검증
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행한다.
- 외부 네트워크 검증은 status, label, 공개 metadata처럼 secret이 없는 결과만 보고서에 기록한다.
- 실패한 검증은 단계 완료로 처리하지 않는다.
- 계획 변경이 필요하면 구현계획서를 먼저 갱신하고 작업지시자 승인을 받는다.
- 문서 위치가 수행계획서 판단과 달라지거나 protected file 수정이 필요하면 구현 전에 계획서를 갱신하고 승인을 받는다.
- Stage 3 metadata write는 Stage 1·2 완료보고서 승인 뒤에만 실행한다.

## 커밋

- 단계 커밋은 단계 산출물과 `mydocs/working/task_m100_81_stage{N}.md`를 함께 묶는다.
- 커밋 메시지는 다음 exact 값을 사용한다.
  - `Task #81 Stage 1: 사용자 중심 README와 공개 진입점 구성`
  - `Task #81 Stage 2: 공유 링크와 Sites 운영 문서 정합화`
  - `Task #81 Stage 3: GitHub 공개 메타데이터 적용과 통합 검증`
- 구현계획서 자체는 구현 시작 전 `Task #81: 구현 계획서 작성`으로 별도 커밋한다.

## 단계 의존성

- Stage 1은 이 구현계획서 승인 뒤에만 시작한다.
- Stage 2는 Stage 1 산출물·검증·완료보고서 승인 후 진행한다.
- Stage 3은 Stage 2 산출물·검증·완료보고서 승인 후 진행한다.
- 실제 Sites 배포와 카드 placeholder 교체는 Task #81 완료·merge 후 별도 Issue와 수행계획 승인을 받아 진행한다.

## 위험과 대응

- **production 미배포 기능 과장**: README CTA와 official docs에서 현재 baseline과 다음 후보를 분리하고 실제 embed는 comment placeholder로 유지한다.
- **badge noise 또는 false status**: 4개로 제한하고 Website는 static link, CI만 실제 workflow status를 사용한다.
- **OpenAI endorsement 오인**: Support를 badge로 만들지 않고 maintainer support와 non-endorsement를 같은 section에 둔다.
- **current baseline 훼손**: production architecture table의 exact version/source를 보호하고 Stage 2 전후 비교한다.
- **GitHub metadata rollback 공백**: 기존 빈 값을 사전 확인하고 partial failure 시 두 값을 모두 빈 값으로 복원한다.
- **external write 선행**: metadata mutation은 두 문서 Stage 승인이 끝난 Stage 3에서만 수행한다.
- **범위 확장**: protected file에서 문제가 발견되면 무단 수정하지 않고 계획 변경 승인을 요청한다.

## 승인 요청 사항

- 3개 Stage 분할과 각 Stage의 문서·외부 상태 산출물
- Stage 1의 사용자 중심 README 정보 위계, 상단 4개 badge exact URL과 comment placeholder 방식
- Stage 2의 세 공식 문서 수정 범위와 code/package/workflow protected boundary
- Stage 3에서 승인된 GitHub description/homepage를 적용하고 partial failure 시 기존 빈 값으로 복원하는 절차
- 각 Stage 검증 명령과 exact 커밋 메시지
- Stage마다 `task-stage-report` 완료보고서 승인 후 다음 Stage로 진행하는 의존성
