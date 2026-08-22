# Task #113 구현계획서 — Community Standards와 외부 기여·보안 신고 흐름

- 수행계획서: [`task_m100_113.md`](task_m100_113.md)
- GitHub Issue: [#113](https://github.com/postmelee/codex-usage-profile/issues/113)
- 마일스톤: M100 — v1.0 MVP
- 상태: 구현 승인 대기

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | Discussion과 private security entrypoint 구축 | Discussion 3건·pin 2건, PVR 활성화, remote ID/URL | GraphQL 중복·카테고리·본문, GitHub UI pin, PVR API |
| 2 | 공개 커뮤니티 정책과 README 기여 경로 작성 | `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `README.md` | 공식 template·링크·영문·privacy boundary |
| 3 | 외부 Issue·Pull Request intake 정비 | issue form 3개, maintainer task 안내, external PR template | YAML schema·chooser routing·내부 workflow 비회귀 |
| 4 | Community Standards 통합 검증 handoff | 전체 검증, merge 후 live gate checklist | public-release scan·remote state·허용 diff·post-merge 100% gate |

## 승인된 정책 불변식

### 공개 기여 routing

- 초기 아이디어와 사용자 질문은 GitHub Discussions를 사용한다.
- profile card customization의 자유로운 탐색은 exact Ideas Discussion 하나를 진실 원천으로 사용한다.
- 재현 가능한 bug와 구현 범위가 구체화된 feature request만 GitHub Issues로 받는다.
- 코드·문서 변경 Pull Request는 `devel`을 대상으로 한다.
- 외부 기여자에게 내부 Hyper-Waterfall 계획·단계 보고 문서를 요구하지 않는다.
- 기존 maintainer `task.yml` body와 `.github/pull_request_template.md`는 유지한다.

### 행동강령과 보안 신고 경계

- `CODE_OF_CONDUCT.md`는 GitHub API의 `contributor_covenant` 지원 template version 2.0을 기준으로 한다.
- `[INSERT CONTACT METHOD]`는 작업지시자가 승인한 `meleeisdeveloping@gmail.com`으로 교체한다.
- 행동강령 신고 주소는 공개 문서에 표시하지만 신고 내용은 private email로 받는다.
- 보안 취약점은 GitHub Private Vulnerability Reporting만 canonical 신고 경로로 사용한다.
- 보안 취약점과 행동강령 위반을 공개 Issue 또는 Discussion에 작성하도록 안내하지 않는다.
- `SECURITY.md`는 최신 공개 release만 지원하고 응답 시간·수정 기한 SLA를 약속하지 않는다.

### GitHub remote 변경 경계

- Discussion 생성 전 같은 제목의 기존 글을 전체 조회하고 하나라도 있으면 mutation을 중단한다.
- `createDiscussion`은 repository와 category node ID를 live 조회한 뒤 실행하며 hard-coded ID에 의존하지 않는다.
- GitHub GraphQL schema에는 Discussion pin mutation과 `Discussion.isPinned` 조회 필드가 없으므로 pin은 GitHub UI에서 수행하고 화면으로 검증한다.
- PVR 활성화 전 현재 `enabled`를 조회하고, 이미 활성화되어 있으면 PUT을 반복하지 않는다.
- Stage 1 원격 mutation 결과의 discussion number, node ID, category, URL과 PVR 상태를 단계 보고서에 기록한다.
- 잘못 생성된 Discussion 삭제·재생성이나 PVR 비활성화는 파괴적 보정으로 보고 별도 승인 없이 수행하지 않는다.

### Community Profile 완료 판정

- Community Profile은 default branch만 평가하므로 task branch와 PR head 상태에서 100%를 주장하지 않는다.
- PR 전에는 GitHub supported location, Markdown/YAML schema, 링크, remote state를 검증한다.
- PR merge 후 live `community/profile` API가 `health_percentage: 100`이고 `code_of_conduct`, `contributing`, `issue_template`이 non-null일 때 최종 수용 기준을 충족한다.
- GitHub cache로 갱신이 지연되면 default branch 파일과 schema를 재확인한 뒤 재조회하며, 57% 또는 null 상태에서 이슈를 닫지 않는다.

## Discussion 콘텐츠 계약

### Announcements — Welcome to Codex Usage Profile Discussions

- 프로젝트 Discussion의 목적을 한 문단으로 소개한다.
- Announcements, Ideas, Q&A, Show and tell의 역할을 설명한다.
- bug·구체화된 feature는 Issue, code·docs contribution은 CONTRIBUTING 경로로 이동한다는 흐름을 안내한다.
- security vulnerability와 private account/usage information을 공개 Discussion에 올리지 말라고 안내한다.
- 문서가 default branch에 반영되기 전 깨진 링크를 만들지 않으며, exact repository 문서 링크 추가가 필요하면 merge 후 보정 후보로 남긴다.

### Ideas — Share Your Profile Card Customization Ideas

- profile card를 useful, readable, personal하게 만드는 자유로운 아이디어를 환영한다.
- color palette, background, theme, layout, typography, stats visibility/order, badges, accessibility, localization, README/social formats를 예시로 든다.
- 제안 시 customize 대상, 개선 이유, preset/setting 기대, 선택적 sketch/screenshot/reference를 요청한다.
- 반응과 다른 제안 확장을 장려하되 모든 제안의 구현을 약속하지 않는다.
- screenshot에는 private account 또는 usage information을 포함하지 않도록 경고한다.

### Show and tell — Show Us Your Codex Usage Profile

- 공개한 card와 GitHub profile/project README 배치 사례를 공유하게 한다.
- 사용한 theme/locale/display width와 마음에 드는 점, 다른 사용자에게 줄 팁을 선택적으로 요청한다.
- 공개 card URL만 공유하고 private preview, credential, token, 개인 계정 정보는 공유하지 않도록 안내한다.
- feedback 요청은 허용하되 bug report와 security report는 각각 Issue form과 PVR로 이동시킨다.

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | `README.md` | OK | 짧은 contribution entrypoint |
| `CONTRIBUTING.md` | 저장소 루트 | `CONTRIBUTING.md` | OK | 공식 외부 기여 지침 |
| `CODE_OF_CONDUCT.md` | 저장소 루트 | `CODE_OF_CONDUCT.md` | OK | GitHub supported template 위치 |
| `SECURITY.md` | 저장소 루트 | `SECURITY.md` | OK | GitHub Security tab 인식 위치 |
| issue form과 chooser | `.github/ISSUE_TEMPLATE/` | `.github/ISSUE_TEMPLATE/*.yml` | OK | GitHub canonical 위치 |
| external PR template | `.github/PULL_REQUEST_TEMPLATE/` | `.github/PULL_REQUEST_TEMPLATE/external-contribution.md` | OK | 내부 default template과 분리 |
| Discussions | GitHub Discussions | repository Discussion 3건 | OK | 대화형 외부 진실 원천 |
| 계획·단계·최종 보고 | `mydocs/` 규정 경로 | `mydocs/plans`, `mydocs/working`, `mydocs/report` | OK | 내부 승인·검증 산출물 |

## Stage 1 — Discussion과 private security entrypoint 구축

### 산출물

저장소 밖 GitHub 상태:

- Announcements Discussion 1건
- Ideas Discussion 1건
- Show and tell Discussion 1건
- Welcome과 customization Discussion pin
- GitHub Private Vulnerability Reporting 활성화

신규:

- `mydocs/working/task_m100_113_stage1.md`

수정:

- `mydocs/orders/20260822.md`

### 변경 내용

- GraphQL로 repository ID, category ID, 현재 Discussion 전체 제목·URL을 조회한다.
- 동일 제목이 없을 때만 승인된 콘텐츠 계약으로 Discussion 3건을 생성한다.
- 각 create mutation 응답에서 number, node ID, category와 URL을 수집한다.
- GitHub UI에서 Welcome과 customization Discussion만 pin한다. Show and tell은 일반 글로 둔다.
- PVR endpoint를 GET하고 disabled일 때만 PUT으로 활성화한 뒤 다시 GET한다.
- Stage 1 단계 보고서에는 원격 변경 전후 상태와 exact URL을 기록한다.
- README와 공개 문서는 이 Stage에서 수정하지 않는다.

### 검증

```bash
gh api graphql -f query='query { repository(owner:"postmelee", name:"codex-usage-profile") { id discussionCategories(first:20) { nodes { id name slug } } discussions(first:100) { totalCount nodes { id number title url body category { name } } } } }'
gh api repos/postmelee/codex-usage-profile/private-vulnerability-reporting
git diff --check
```

수동 검증:

- GitHub Discussions 목록에서 세 글의 category와 제목이 맞는지 확인한다.
- Welcome과 customization 두 글에 pinned 표시가 있고 Show and tell에는 없는지 확인한다.
- 본문 line break, list, privacy warning이 정상 렌더링되는지 확인한다.

### 커밋

```text
Task #113 Stage 1: Discussion과 private security entrypoint 구축
```

## Stage 2 — 공개 커뮤니티 정책과 README 기여 경로 작성

### 산출물

신규:

- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `mydocs/working/task_m100_113_stage2.md`

수정:

- `README.md`
- `mydocs/orders/20260822.md`

### 변경 내용

- GitHub `codes_of_conduct/contributor_covenant` body를 기준으로 Contributor Covenant 2.0을 추가하고 enforcement contact를 `meleeisdeveloping@gmail.com`으로 교체한다.
- `CONTRIBUTING.md`는 다음 순서로 작성한다.
  - 환영 문구와 code/docs/bug/design/idea contribution 범위
  - Code of Conduct 적용
  - Q&A, customization idea, bug, concrete feature, security report routing
  - substantial work 시작 전 Issue 범위 합의
  - Node.js 20+, `npm install`, `npm run dev`, `npm test`, `npm run build`
  - fork/feature branch, focused commits, `devel` 대상 PR
  - 영문 external PR template 사용 안내
- `SECURITY.md`는 latest release 지원 표, PVR advisory URL, 보고에 필요한 affected component·impact·reproduction·mitigation 정보, coordinated disclosure 원칙을 포함한다.
- README `Development` 앞에 영문 `Contributing` 섹션을 추가하고 Stage 1 customization URL, issue chooser, CONTRIBUTING을 연결한다.
- README의 다른 release·service 문구와 #90 범위는 수정하지 않는다.

### 검증

```bash
gh api codes_of_conduct/contributor_covenant --jq '.body'
rg -n 'Our Pledge|Our Standards|Enforcement|Attribution|meleeisdeveloping@gmail.com' CODE_OF_CONDUCT.md
! rg -n 'INSERT CONTACT METHOD' CODE_OF_CONDUCT.md CONTRIBUTING.md SECURITY.md README.md
rg -n 'Share Your Profile Card Customization Ideas|issues/new/choose|CONTRIBUTING.md' README.md CONTRIBUTING.md
test -f CODE_OF_CONDUCT.md
test -f CONTRIBUTING.md
test -f SECURITY.md
git diff --check
```

수동 검증:

- Contributor Covenant template 내용과 attribution을 임의 축약하지 않았는지 확인한다.
- 행동강령 신고 email과 PVR security advisory의 역할이 섞이지 않았는지 확인한다.
- README Contributing 섹션이 `Development` 바로 앞에 있고 기존 문맥을 깨지 않는지 확인한다.
- 공개 문서가 영문이며 내부 Hyper-Waterfall 절차를 외부 기여자에게 요구하지 않는지 확인한다.

### 커밋

```text
Task #113 Stage 2: 공개 커뮤니티 정책과 기여 경로 작성
```

## Stage 3 — 외부 Issue·Pull Request intake 정비

### 산출물

신규:

- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/PULL_REQUEST_TEMPLATE/external-contribution.md`
- `mydocs/working/task_m100_113_stage3.md`

수정:

- `.github/ISSUE_TEMPLATE/task.yml`
- `mydocs/orders/20260822.md`

### 변경 내용

- bug form은 summary, affected area, version/environment, reproduction steps, expected/actual behavior, logs/screenshots, confirmation을 구조화하고 `bug` label을 설정한다.
- feature form은 problem, proposed outcome, alternatives, additional context, scope confirmation을 구조화하고 `enhancement` label을 설정한다.
- vague customization brainstorming은 feature form에서 Stage 1 Ideas Discussion으로 이동하도록 안내한다.
- chooser는 blank issue를 비활성화하고 Q&A category, exact customization Discussion, PVR advisory URL의 contact link를 제공한다.
- 기존 `task.yml`은 top-level `name`과 `description`만 maintainer 전용으로 명확히 하고 body field id, 필수 validation, title prefix는 유지한다.
- external PR template은 Summary, Related issue/discussion, Changes, Validation, Screenshots, Checklist를 영문으로 제공한다.
- `.github/pull_request_template.md`는 수정하지 않는다.

### 검증

```bash
ruby -e 'require "yaml"; Dir[".github/ISSUE_TEMPLATE/*.yml"].sort.each { |path| data = YAML.load_file(path); raise "invalid #{path}" unless data.is_a?(Hash) }'
ruby -e 'require "yaml"; %w[bug_report feature_request task].each { |name| data = YAML.load_file(".github/ISSUE_TEMPLATE/#{name}.yml"); %w[name description body].each { |key| raise "#{name}: missing #{key}" unless data[key] }; }'
rg -n 'blank_issues_enabled: false|discussions/categories/q-a|security/advisories/new' .github/ISSUE_TEMPLATE/config.yml
rg -n 'Summary|Related issue|Validation|Checklist|devel' .github/PULL_REQUEST_TEMPLATE/external-contribution.md CONTRIBUTING.md
git diff --exit-code HEAD -- .github/pull_request_template.md
git diff --check
```

수동 검증:

- GitHub issue form schema에서 checkbox·textarea·dropdown id가 중복되지 않는지 확인한다.
- public contributor가 maintainer task form을 일반 bug/feature form으로 오인하지 않는지 문구를 검토한다.
- external PR template이 내부 stage/report 링크를 요구하지 않는지 확인한다.

### 커밋

```text
Task #113 Stage 3: 외부 기여 intake template 정비
```

## Stage 4 — Community Standards 통합 검증 handoff

### 산출물

신규:

- `mydocs/working/task_m100_113_stage4.md`

수정:

- 통합 검증에서 확인된 Task #113 범위의 최소 보정 파일
- `mydocs/orders/20260822.md`

### 변경 내용

- `origin/devel...HEAD` 전체 diff를 감사해 승인된 community·작업 문서만 포함됐는지 확인한다.
- Markdown links, email, security advisory URL, Discussion exact URL과 YAML form key를 다시 검사한다.
- PVR, Discussion 3건과 category를 API로 재검증하고 pin은 GitHub UI로 재확인한다.
- `npm run scan:public-release`로 공개 tree의 private path·credential·release 정책을 검사한다.
- PR 전 Community Profile live 값은 default branch 기준 baseline임을 기록한다.
- merge 후 다음 exact gate를 최종 보고서와 PR 검증 한계에 남긴다.
  - Community Profile health 100%
  - code of conduct, contributing, issue template non-null
  - Issue chooser에서 bug/feature/maintainer form과 contact link 렌더링
  - Security tab policy와 private report button 확인
  - README Contributing 및 external PR template 링크 확인
- merge 전에는 issue close 또는 Community Standards 100% 완료를 선언하지 않는다.

### 검증

```bash
git diff --name-only origin/devel...HEAD
git diff --check origin/devel...HEAD
ruby -e 'require "yaml"; Dir[".github/ISSUE_TEMPLATE/*.yml"].sort.each { |path| YAML.load_file(path) }'
npm run scan:public-release
gh api repos/postmelee/codex-usage-profile/private-vulnerability-reporting
gh api repos/postmelee/codex-usage-profile/community/profile
gh api graphql -f query='query { repository(owner:"postmelee", name:"codex-usage-profile") { discussions(first:100) { totalCount nodes { number title url category { name } } } } }'
git status --short
```

수동 검증:

- GitHub UI에서 Discussion 두 건의 pin과 세 본문 렌더링을 확인한다.
- 공개 문서에 승인되지 않은 개인 정보, credential, private usage가 없는지 확인한다.
- #90 범위와 제품 코드·배포 파일이 diff에 포함되지 않았는지 확인한다.
- merge 후 live checklist가 PR 검증 한계와 최종 보고서에 빠짐없이 남았는지 확인한다.

### 커밋

```text
Task #113 Stage 4: Community Standards 통합 검증 handoff
```

## 검증

- 각 Stage 검증 명령은 `task-stage-report` 실행 전에 수행한다.
- remote mutation 전후 query 결과는 민감 정보 없이 단계 보고서에 요약한다.
- 실패한 검증이나 확인하지 못한 pin 상태를 완료로 처리하지 않는다.
- Stage 2의 negative `rg`는 예상되는 정책 문맥을 사람이 확인하고, 단순 문자열 존재만으로 성공·실패를 판정하지 않는다.
- GitHub UI가 필요한 pin과 merge 후 rendering은 자동 API 검증과 분리해 수동 근거를 남긴다.
- 계획과 다른 파일·Discussion category·보안 설정 변경이 필요하면 구현계획서를 먼저 보정하고 승인을 받는다.

## 커밋

- 단계 커밋은 Stage 산출물, `mydocs/working/task_m100_113_stage{N}.md`, `mydocs/orders/20260822.md` 상태 갱신을 함께 묶는다.
- 외부 GitHub 상태만 바뀌는 Stage 1도 단계 보고서와 오늘할일 변경을 commit해 추적성을 보존한다.
- 커밋 메시지는 `Task #113 Stage {N}: {핵심 내용}` 형식을 따른다.
- 단계 검증과 보고서 작성이 끝난 뒤에만 커밋하고, 작업지시자 승인 없이 다음 Stage로 넘어가지 않는다.

## 단계 의존성

- Stage 2는 Stage 1에서 생성된 exact customization Discussion URL과 PVR enabled 상태를 사용한다.
- Stage 3은 Stage 1 exact Q&A/Ideas/security URL과 Stage 2 CONTRIBUTING routing을 사용한다.
- Stage 4는 Stage 1–3의 검증·보고·승인이 모두 끝난 뒤 진행한다.
- 각 Stage 사이에 `task-stage-report` 절차로 산출물·단계 보고서·오늘할일을 commit하고 다음 단계 승인을 요청한다.
- PR merge 후 live 100% gate와 issue close·브랜치 정리는 merge 확인 절차에서 수행한다.

## 위험과 대응

- **Discussion pin API 부재**: 생성은 GraphQL로 idempotent하게 수행하고 pin은 GitHub UI에서 두 대상만 선택해 시각 검증한다.
- **원격 변경과 Git history 분리**: Stage 1 report에 before/after, node ID, URL을 남기고 이후 Stage에서 exact URL을 재사용한다.
- **Community Profile cache**: merge 전 supported location/schema를 검증하고 merge 후 API와 UI가 100%가 될 때까지 이슈를 닫지 않는다.
- **Contributor Covenant template drift**: 구현 시 live `codes_of_conduct/contributor_covenant` body를 다시 조회하고 version·attribution을 기록한다.
- **공개 email 오기입**: 승인된 `meleeisdeveloping@gmail.com`과 정확히 일치하는지 `rg`와 수동 검토를 함께 수행한다.
- **security SLA 오해**: 신고 접수·조율 원칙만 설명하고 응답·수정 시간을 약속하지 않는다.
- **외부/내부 template 충돌**: default maintainer PR template과 `task.yml` body의 diff를 제한하고 external template을 별도 경로에 둔다.
- **README 병렬 변경**: Stage 2 시작 전 `origin/devel`과 #90 상태를 다시 읽고 Contributing 섹션 외 변경을 금지한다.

## 승인 요청 사항

- 위 4개 Stage의 산출물·검증·커밋 메시지
- `meleeisdeveloping@gmail.com`을 Contributor Covenant enforcement contact로 공개하는 결정
- Discussion 생성은 GraphQL, pinning은 GitHub UI로 수행하는 자동·수동 경계
- PVR은 Stage 1에서 활성화하고 `SECURITY.md`는 Stage 2에서 canonical 신고 경로로 문서화하는 순서
- 기존 maintainer PR template 유지와 별도 external contribution template 추가
- Community Profile 100%를 merge 후 live gate로 두고 그 전에는 완료·이슈 close를 선언하지 않는 경계

승인되면 Stage 1부터 시작하고, 완료 시 `task-stage-report` 절차로 원격 상태 검증·보고·커밋 후 Stage 2 승인을 요청한다.
