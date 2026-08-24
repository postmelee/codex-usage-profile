# Task #113 Stage 2 완료 보고 — 공개 커뮤니티 정책과 README 기여 경로 작성

GitHub Issue: [#113](https://github.com/postmelee/codex-usage-profile/issues/113)
구현계획서: [`task_m100_113_impl.md`](../plans/task_m100_113_impl.md)
Stage: 2

## 단계 목적

GitHub Community Standards와 실제 외부 기여 흐름에 필요한 Code of Conduct, Contributing, Security Policy를 영문 공식 문서로 추가한다. README에는 코드뿐 아니라 문서, bug report, design feedback과 idea도 환영한다는 짧은 진입점을 만들고 Stage 1에서 생성한 customization Discussion과 연결한다.

행동강령 위반 신고와 보안 취약점 신고를 서로 다른 private channel로 분리한다. Contributor Covenant enforcement contact는 작업지시자가 승인한 `meleeisdeveloping@gmail.com`, security vulnerability의 canonical 경로는 활성화된 GitHub Private Vulnerability Reporting으로 고정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `CODE_OF_CONDUCT.md` | GitHub 지원 Contributor Covenant 2.0 128줄 추가, enforcement contact를 승인 email로 치환 |
| `CONTRIBUTING.md` | contribution routing, scope agreement, Node.js 20+ 개발·검증, `devel` PR, 외부 contributor 경계 64줄 추가 |
| `SECURITY.md` | 최신 production/npm 지원 범위, PVR 신고 정보, authorized testing와 coordinated disclosure 41줄 추가 |
| `README.md` | `Development` 앞에 영문 `Contributing` 섹션 8줄 추가 |
| `mydocs/orders/20260823.md` | Stage 2 완료·Stage 3 승인 대기 상태로 갱신 |
| `mydocs/working/task_m100_113_stage2.md` | 공개 문서 변경, 검증 결과, 잔여 위험과 Stage 3 handoff 기록 |

## 본문 변경 정도 / 본문 무손실 여부

- `CODE_OF_CONDUCT.md`는 live `codes_of_conduct/contributor_covenant`가 반환한 version 2.0 본문과 비교했다. `[INSERT CONTACT METHOD]`를 `[meleeisdeveloping@gmail.com](mailto:meleeisdeveloping@gmail.com)`으로 바꾼 부분 외에는 줄바꿈, 문구, attribution까지 일치한다.
- `CONTRIBUTING.md`와 `SECURITY.md`는 기존 문서가 없어 승인된 routing과 security boundary를 기준으로 신규 작성했다.
- README는 기존 164줄을 재작성하지 않고 Data and privacy와 Development 사이에 Contributing 8줄만 삽입했다. badge, production URL, Quick start, release 문구와 #90 범위는 무손실로 유지했다.
- 기존 `Development` 명령을 CONTRIBUTING에서 재사용했으며 제품 코드, API, runtime, npm package와 GitHub template은 변경하지 않았다.
- 외부 contributor에게 내부 Hyper-Waterfall 계획·단계 보고 문서를 요구하지 않는다고 명시했다.

## 검증 결과

실행 명령:

```bash
gh api codes_of_conduct/contributor_covenant --jq .body
gh api codes_of_conduct/contributor_covenant --jq .body | ruby -e 'template = STDIN.read; expected = template.sub("[INSERT CONTACT METHOD].", "[meleeisdeveloping@gmail.com](mailto:meleeisdeveloping@gmail.com)."); actual = File.read("CODE_OF_CONDUCT.md"); abort "Contributor Covenant mismatch" unless actual.chomp == expected.chomp; puts "Contributor Covenant template OK"'
rg -n 'Our Pledge|Our Standards|Enforcement Responsibilities|Enforcement Guidelines|Attribution|meleeisdeveloping@gmail.com' CODE_OF_CONDUCT.md
! rg -n 'INSERT CONTACT METHOD' CODE_OF_CONDUCT.md CONTRIBUTING.md SECURITY.md README.md
rg -n 'All contributions are welcome|Share Your Profile Card Customization Ideas|discussions/115|issues/new/choose|CONTRIBUTING.md|security/advisories/new' README.md CONTRIBUTING.md SECURITY.md
rg -n '^## (Contributing|Development|Documentation)$' README.md
node -e 'const fs=require("fs"),path=require("path");for(const file of ["README.md","CONTRIBUTING.md","SECURITY.md","CODE_OF_CONDUCT.md"]){const text=fs.readFileSync(file,"utf8");for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){const target=match[1].split("#")[0];if(!target||/^(https?:|mailto:)/.test(target))continue;const resolved=path.resolve(path.dirname(file),target);if(!fs.existsSync(resolved))throw new Error(`${file}: missing ${target}`);}}console.log("local markdown links OK")'
gh api graphql -f query='query { repository(owner:"postmelee", name:"codex-usage-profile") { discussions(first:10) { nodes { number title url } } } }'
gh api repos/postmelee/codex-usage-profile/private-vulnerability-reporting
git diff --check
```

결과:

- **OK — Contributor Covenant 무손실**: exact 비교가 `Contributor Covenant template OK`를 출력했다.
- **OK — enforcement contact**: `meleeisdeveloping@gmail.com`과 `mailto:`가 Enforcement에 존재하고 placeholder는 없다.
- **OK — 기여 routing**: README와 CONTRIBUTING이 exact Discussion #115, issue chooser와 CONTRIBUTING을 연결한다.
- **OK — security routing**: SECURITY가 `security/advisories/new`를 canonical private report 경로로 사용하고 PVR API가 `{"enabled":true}`를 반환했다.
- **OK — remote Discussion**: GraphQL이 #115와 #116의 승인된 title·URL을 반환했다.
- **OK — README 위치**: heading line은 Contributing 127, Development 135, Documentation 157 순서다.
- **OK — local links**: Markdown 상대 링크 검사에서 `local markdown links OK`를 출력했다.
- **OK — placeholder·diff**: contact placeholder가 없고 `git diff --check`가 출력 없이 exit 0으로 통과했다.

수동 검증:

- **OK — 영문 공개 문서**: README, CONTRIBUTING, SECURITY와 CODE_OF_CONDUCT가 외부 사용자 대상 영문이다.
- **OK — 신고 채널 분리**: 행동강령 위반은 email, security vulnerability는 PVR이며 공개 Issue·Discussion 신고를 금지한다.
- **OK — SLA 경계**: SECURITY는 검토·조율 원칙을 설명하지만 구체적인 응답 또는 수정 기한을 약속하지 않는다.
- **OK — #90 비간섭**: README diff는 독립된 Contributing 8줄뿐이며 release·metadata 문구를 바꾸지 않았다.

## 잔여 위험

- `CONTRIBUTING.md`가 안내하는 `.github/PULL_REQUEST_TEMPLATE/external-contribution.md`는 Stage 3 산출물이므로 아직 존재하지 않는다. Markdown link가 아니라 canonical 예정 경로를 code로 안내하며 Stage 3에서 생성·검증한다.
- Code of Conduct와 Security Policy는 task branch에만 있어 default branch merge 전에는 GitHub Community Standards와 Security tab에서 노출되지 않는다.
- Issue chooser는 아직 maintainer task form만 가지며 외부 bug/feature routing은 Stage 3에서 완성한다.
- Community Profile 100%는 Stage 3 파일과 PR merge 후에만 live 검증할 수 있다.

## 다음 단계 영향

- Stage 3 `config.yml`은 Q&A category, exact customization Discussion #115, `security/advisories/new`를 contact link로 사용한다.
- bug report는 `bug`, concrete feature request는 `enhancement` 기존 label을 사용한다.
- external PR template은 CONTRIBUTING에 고정한 `.github/PULL_REQUEST_TEMPLATE/external-contribution.md` 경로로 추가한다.
- 기존 `.github/pull_request_template.md`와 `task.yml` body field는 내부 Hyper-Waterfall workflow 보호를 위해 유지한다.
- Stage 3 완료 뒤 issue form YAML과 외부 PR template을 함께 검사해 CONTRIBUTING의 예정 경로를 실제 파일로 수렴시킨다.

## 승인 요청

- Stage 2의 Code of Conduct, Contributing, Security Policy, README 기여 진입점과 검증 결과를 승인하면 Stage 3 외부 Issue·Pull Request intake 정비로 진행한다.
