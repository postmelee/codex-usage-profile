# Task #113 Stage 3 완료 보고 — 외부 Issue·Pull Request intake 정비

GitHub Issue: [#113](https://github.com/postmelee/codex-usage-profile/issues/113)
구현계획서: [`task_m100_113_impl.md`](../plans/task_m100_113_impl.md)
Stage: 3

## 단계 목적

외부 사용자가 재현 가능한 bug와 구체화된 feature request를 영문 form으로 제출하고, 질문·초기 customization idea·security vulnerability는 각각 Q&A, exact Ideas Discussion, Private Vulnerability Reporting으로 이동하게 한다. 외부 Pull Request에는 간결한 영문 template을 제공하면서 기존 maintainer Hyper-Waterfall issue/PR 입력 계약은 보존한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `.github/ISSUE_TEMPLATE/bug_report.yml` | bug summary, area, version, environment, reproduction, expected/actual, sanitized evidence와 privacy confirmation 105줄 추가 |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | concrete problem·outcome·proposal·alternatives와 open-ended idea routing 64줄 추가 |
| `.github/ISSUE_TEMPLATE/config.yml` | blank issue 비활성화, Q&A·Discussion #115·PVR contact link 11줄 추가 |
| `.github/ISSUE_TEMPLATE/task.yml` | top-level name과 description만 maintainer 전용으로 명확화, 기존 body 무변경 |
| `.github/PULL_REQUEST_TEMPLATE/external-contribution.md` | Summary, related context, changes, validation, screenshots, external contributor checklist 38줄 추가 |
| `mydocs/orders/20260823.md` | Stage 3 완료·Stage 4 승인 대기 상태로 갱신 |
| `mydocs/working/task_m100_113_stage3.md` | form·template 변경, 검증, 잔여 위험과 Stage 4 handoff 기록 |

## 본문 변경 정도 / 본문 무손실 여부

- 기존 `.github/ISSUE_TEMPLATE/task.yml`은 `name: Maintainer Task`, maintainer-only description으로 top-level 두 줄만 바꿨다. `title: "Task: "`와 `body` 이하 field id, labels, placeholders, validation은 HEAD와 byte 단위로 동일하다.
- 기존 `.github/pull_request_template.md`는 수정하지 않았다. 내부 task-final-report와 Hyper-Waterfall PR workflow는 기존 구조를 계속 사용한다.
- bug·feature forms, chooser config와 external PR template은 기존 파일이 없어 신규 작성했다.
- `CONTRIBUTING.md`에서 예정 경로로 안내한 `.github/PULL_REQUEST_TEMPLATE/external-contribution.md`가 실제 파일로 수렴했다.
- 외부 PR template은 내부 수행·구현계획서나 Stage report 작성을 요구하지 않는다.

## 검증 결과

실행 명령:

```bash
ruby -e 'require "yaml"; Dir[".github/ISSUE_TEMPLATE/*.yml"].sort.each { |path| data = YAML.load_file(path); raise "invalid #{path}" unless data.is_a?(Hash) }; puts "YAML parse OK"'
ruby -e 'require "yaml"; allowed=%w[markdown textarea dropdown input checkboxes]; %w[bug_report feature_request task].each { |name| data=YAML.load_file(".github/ISSUE_TEMPLATE/#{name}.yml"); %w[name description body].each { |key| raise "#{name}: missing #{key}" unless data[key] }; raise "#{name}: body" unless data["body"].is_a?(Array); data["body"].each { |item| raise "#{name}: invalid type" unless allowed.include?(item["type"]); raise "#{name}: missing id" if item["type"] != "markdown" && !item["id"] }; ids=data["body"].map { |item| item["id"] }.compact; raise "#{name}: duplicate id" unless ids.uniq == ids }; puts "issue form keys, types, and ids OK"'
ruby -e 'require "yaml"; data=YAML.load_file(".github/ISSUE_TEMPLATE/config.yml"); raise unless data["blank_issues_enabled"] == false; links=data.fetch("contact_links"); raise unless links.size == 3 && links.all? { |item| %w[name url about].all? { |key| item[key] } }; puts "chooser config OK"'
ruby -e 'require "yaml"; expected_labels={"bug_report"=>"bug","feature_request"=>"enhancement"}; expected_labels.each { |name,label| data=YAML.load_file(".github/ISSUE_TEMPLATE/#{name}.yml"); raise "#{name}: label" unless data["labels"] == [label]; data["body"].each { |item| attrs=item["attributes"] || {}; if item["type"] != "markdown"; raise "#{name}: label missing" unless attrs["label"]; end; if item["type"] == "checkboxes"; options=attrs["options"]; raise "#{name}: checkbox options" unless options.is_a?(Array) && options.all? { |option| option["label"] && option["required"] == true }; end } }; puts "issue form schema OK"'
ruby -ropen3 -e 'before,status=Open3.capture2("git","show","HEAD:.github/ISSUE_TEMPLATE/task.yml"); raise unless status.success?; after=File.read(".github/ISSUE_TEMPLATE/task.yml"); raise "task body changed" unless before.lines.drop(3) == after.lines.drop(3); puts "maintainer task body unchanged"'
rg -n 'blank_issues_enabled: false|discussions/categories/q-a|discussions/115|security/advisories/new' .github/ISSUE_TEMPLATE/config.yml .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml
rg -n 'Summary|Related issue|Validation|Checklist|devel|Private Vulnerability Reporting' .github/PULL_REQUEST_TEMPLATE/external-contribution.md CONTRIBUTING.md
! rg -n '[ \t]+$' .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml .github/ISSUE_TEMPLATE/config.yml .github/PULL_REQUEST_TEMPLATE/external-contribution.md
git diff --exit-code HEAD -- .github/pull_request_template.md
gh api repos/postmelee/codex-usage-profile/labels --paginate --jq '[.[] | select(.name == "bug" or .name == "enhancement") | .name] | sort'
gh api graphql -f query='query { repository(owner:"postmelee", name:"codex-usage-profile") { discussions(first:10) { nodes { number title url category { slug } } } } }'
gh api repos/postmelee/codex-usage-profile/private-vulnerability-reporting
git diff --check
```

결과:

- **OK — YAML parse**: 네 ISSUE_TEMPLATE YAML 파일이 Hash로 parse됐다.
- **OK — form key·type·ID**: bug, feature, maintainer form에 `name`, `description`, `body`가 있고 허용 type만 사용하며 non-markdown field ID가 모두 고유하다.
- **OK — checkbox·label**: 모든 confirmation option이 required이고 bug/feature label은 각각 live 기존 label `bug`, `enhancement`와 일치한다.
- **OK — chooser**: blank issue는 `false`이며 Q&A, Discussion #115, PVR의 name·URL·about 세 contact link가 있다.
- **OK — remote route**: GraphQL은 #115를 `ideas` category의 exact title·URL로 반환하고 PVR API는 `{"enabled":true}`를 반환했다.
- **OK — maintainer issue form**: `maintainer task body unchanged`를 출력했고 실제 diff도 첫 두 줄만 포함했다.
- **OK — maintainer PR template**: `git diff --exit-code HEAD -- .github/pull_request_template.md`가 출력 없이 exit 0으로 통과했다.
- **OK — external PR template**: Summary, related issue/discussion, Validation, Screenshots, Checklist와 `devel` target·security 경계가 존재한다.
- **OK — whitespace·diff**: 신규 template에 trailing whitespace가 없고 `git diff --check`가 출력 없이 exit 0으로 통과했다.

검증 과정에서 최초 key 검사 명령은 시스템 Ruby가 `filter_map`을 지원하지 않아 실행 호환성 오류가 났다. 동일 검사를 지원되는 `map.compact`로 바꿔 통과했으며 YAML 또는 form 내용 실패는 아니었다.

수동 검증:

- **OK — bug/feature 분리**: bug form은 재현·expected/actual 중심, feature form은 problem·desired outcome·proposal 중심이다.
- **OK — exploratory idea routing**: feature form은 open-ended customization idea를 Discussion #115로 보낸다.
- **OK — privacy boundary**: bug form과 external PR checklist가 credential, private usage와 security disclosure를 금지한다.
- **OK — 내부 workflow 비회귀**: maintainer task body와 default PR template을 보존하고 외부용 template을 별도 경로에 추가했다.

## 잔여 위험

- GitHub Issue chooser는 default branch의 `.github/ISSUE_TEMPLATE/`만 읽으므로 PR merge 전에는 새 forms와 contact link를 live UI에서 검증할 수 없다.
- Community Profile의 Issue templates 항목도 merge 전에는 기존 null 상태일 수 있다.
- external PR template은 복수 template 디렉터리에 있으므로 외부 기여자가 CONTRIBUTING의 안내를 따라 선택해야 한다. default maintainer template을 자동 교체하지 않는다.
- Ruby YAML 검증은 schema의 구조·필수 key를 검사하지만 GitHub 자체 렌더러와 완전히 동일하지 않다. merge 후 chooser UI를 최종 확인한다.

## 다음 단계 영향

- Stage 4는 `origin/devel...HEAD` 허용 diff, 모든 Markdown/YAML link, public release scan, PVR·Discussion remote state를 통합 검증한다.
- default branch 미반영으로 확인할 수 없는 Issue chooser rendering, Community Profile 100%, Security tab policy는 PR 검증 한계와 merge 후 live gate에 명시한다.
- merge 후 bug, feature, maintainer 세 form과 Q&A·Ideas·PVR 세 contact link가 Issue chooser에 표시되는지 확인한다.
- `community/profile` API의 code of conduct, contributing, issue template non-null과 health 100%를 확인하기 전에는 #113을 닫지 않는다.

## 승인 요청

- Stage 3 외부 issue forms, chooser routing, maintainer 안내, external PR template과 검증 결과를 승인하면 Stage 4 Community Standards 통합 검증 handoff로 진행한다.
