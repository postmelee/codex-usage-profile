# Task #113 Stage 4 완료 보고 — Community Standards 통합 검증 handoff

GitHub Issue: [#113](https://github.com/postmelee/codex-usage-profile/issues/113)
구현계획서: [`task_m100_113_impl.md`](../plans/task_m100_113_impl.md)
Stage: 4

## 단계 목적

Stage 1~3에서 구축한 Discussion, 공개 커뮤니티 정책, 외부 Issue·Pull Request intake와 private security reporting 경로를 하나의 흐름으로 통합 검증한다. PR 전에는 task branch의 schema·link·공개 surface와 GitHub remote state를 확인하고, default branch merge 후에만 Community Standards 100%를 판정할 수 있도록 live gate를 명확히 남긴다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/orders/20260823.md` | Stage 4 완료·최종 보고와 PR 승인 대기 상태로 갱신 |
| `mydocs/working/task_m100_113_stage4.md` | 전체 허용 diff, schema·link·public scan, remote/UI 기준선과 merge 후 live gate 기록 |

통합 검증에서 Task #113 공개 문서·template의 추가 보정은 필요하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

- Stage 4는 Stage 1~3 산출물의 내용을 다시 쓰지 않고 검증과 handoff만 수행했다.
- `origin/devel...HEAD`에는 승인된 community 파일과 Task #113 작업 문서만 있다. `build/`, `docs/`, `scripts/`, `src/`, `package.json`, `package-lock.json`, 기존 `.github/pull_request_template.md`의 Task #113 변경은 없다.
- 기존 maintainer issue form은 top-level name·description 외 body가 유지되고, 기존 default PR template도 유지된다.
- 공개 행동강령 신고 이메일은 승인된 `meleeisdeveloping@gmail.com` 한 곳에만 있으며, security report는 PVR URL만 사용한다.

## 검증 결과

실행 명령:

```bash
git fetch origin devel
git rev-list --left-right --count origin/devel...HEAD
git diff --name-status origin/devel...HEAD
git diff --check origin/devel...HEAD
ruby -e 'require "yaml"; Dir[".github/ISSUE_TEMPLATE/*.yml"].sort.each { |path| YAML.load_file(path) }'
npm run scan:public-release
gh api repos/postmelee/codex-usage-profile/private-vulnerability-reporting
gh api repos/postmelee/codex-usage-profile/community/profile
gh api graphql -f query='query { repository(owner:"postmelee", name:"codex-usage-profile") { discussions(first:100) { totalCount nodes { number title url body category { name slug } } } } }'
gh api repos/postmelee/codex-usage-profile/labels --paginate
ruby -ropen3 -e 'body,status=Open3.capture2("gh","api","codes_of_conduct/contributor_covenant","--jq",".body"); raise unless status.success?; expected=body.sub("[INSERT CONTACT METHOD]","[meleeisdeveloping@gmail.com](mailto:meleeisdeveloping@gmail.com)"); raise unless File.read("CODE_OF_CONDUCT.md") == expected'
git diff --exit-code origin/devel...HEAD -- build docs scripts src package.json package-lock.json .github/pull_request_template.md
git merge-tree "$(git merge-base origin/devel HEAD)" origin/devel HEAD
git status --short
```

결과:

- **OK — 최신 remote 기준선**: `origin/devel`을 `caf04f8`까지 fetch했다. Task #108 merge로 현재 branch는 `origin/devel`보다 5 commit 앞, 2 commit 뒤이며, merge-tree에는 conflict marker가 없다. 진행 중 branch를 임의 rebase하지 않는 저장소 정책에 따라 동기화 mutation은 수행하지 않았다.
- **OK — 허용 diff**: 보고서 작성 전 16개 변경 경로, Stage 4 보고서를 포함한 최종 working tree 17개 경로가 각각 승인 목록과 정확히 일치했다. 제품 코드·배포 설정과 Task #90 범위는 포함되지 않았다.
- **OK — diff·YAML**: `git diff --check origin/devel...HEAD`가 출력 없이 통과했고, bug·feature·maintainer form과 chooser config 네 YAML이 모두 parse됐다.
- **OK — 공개 링크**: 공개 Markdown의 local link 16개가 모두 존재한다. README·CONTRIBUTING은 exact Discussion #115와 issue chooser를, SECURITY와 chooser는 PVR advisory URL을 사용한다.
- **OK — 신고 역할 분리**: 행동강령 email은 `CODE_OF_CONDUCT.md`에만 있고 SECURITY·Issue·PR template에는 없다. 반대로 PVR URL은 행동강령에 없고 security 경로에만 있다.
- **OK — Contributor Covenant**: GitHub `contributor_covenant` 지원 template body에서 contact placeholder만 승인된 mailto link로 교체한 내용과 byte 단위로 일치한다.
- **OK — public release scan**: `ok: true`, `blockerCount: 0`, `reviewCount: 69`로 통과했다. review 항목은 기존 repository refs·test fixture·공개 commit metadata 항목이며 Task #113 blocker는 없다.
- **OK — PVR**: API 응답은 `{"enabled":true}`다.
- **OK — Discussion API**: 전체 Discussion은 정확히 3건이며 #114 Announcements, #115 Ideas, #116 Show and tell의 number·title·category·URL·본문이 Stage 1 계약과 일치한다.
- **OK — Discussion UI**: Pinned Discussions에는 #114와 #115만 표시된다. #114~#116 페이지에서 제목, 목록과 privacy/security warning 핵심 문구가 모두 렌더링된다.
- **OK — live label**: remote에 `bug`, `enhancement` label이 모두 존재한다.
- **BASELINE — Community Profile**: default branch는 `devel`이며 현재 API는 `health_percentage: 57`, `code_of_conduct: null`, `contributing: null`, `issue_template: null`이다. task branch가 merge되기 전의 정상 baseline이므로 100% 완료로 판정하지 않는다.

수동 검증:

- **OK — 공개 정보 경계**: Task #113 공개 산출물에는 승인된 contact email 외 credential, private profile preview 또는 private usage data가 없다.
- **OK — 내부 workflow 비회귀**: 외부 contributor 안내는 내부 Hyper-Waterfall 계획서·단계 보고서를 요구하지 않으며 maintainer 기본 PR 흐름을 교체하지 않는다.
- **OK — GitHub UI**: pin 2건과 Discussion 3건의 Markdown heading, ordered/unordered list, warning 문구를 직접 확인했다.

## 잔여 위험

- Community Profile과 Issue chooser는 default branch만 읽으므로 PR merge 전에는 100%, 새 form rendering 또는 `SECURITY.md` 인식을 live로 확인할 수 없다.
- 최신 `origin/devel`에 Task #108 merge 2 commit이 추가됐다. 현재 merge-tree는 clean하지만 PR 게시 전에 remote가 다시 변경되면 mergeability와 CI를 재확인해야 한다.
- GitHub의 Community Profile cache가 merge 직후 지연될 수 있다. 파일과 schema를 먼저 확인하고 API가 100%가 될 때까지 #113을 닫지 않는다.

## 다음 단계 영향

- 최종 보고와 PR에는 다음 항목을 merge 후 live gate로 그대로 포함한다.
  1. `community/profile` API의 `health_percentage: 100`
  2. `code_of_conduct`, `contributing`, `issue_template` non-null
  3. Issue chooser의 bug·feature·maintainer form과 Q&A·Ideas·PVR contact link 렌더링
  4. Security tab의 policy와 private vulnerability report button 확인
  5. default branch README Contributing 링크와 external PR template 링크 확인
- 위 gate 전에는 Community Standards 100% 완료를 선언하거나 #113을 닫지 않는다.
- 최종 보고·PR 게시 직전 최신 `origin/devel`과 mergeability를 다시 조회하고, 실제 충돌이 생기면 rebase 또는 merge 방식은 작업지시자 승인 후 결정한다.

## 승인 요청

- Stage 4 통합 검증과 merge 후 live gate handoff를 승인하면 최종 보고서 작성과 `devel` 대상 Open PR 게시 단계로 진행한다.
