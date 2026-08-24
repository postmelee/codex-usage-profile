# Task #90 Stage 3 보고서 — 문서 navigation과 공개 tree 위생 정리

GitHub Issue: [#90](https://github.com/postmelee/codex-usage-profile/issues/90)
구현계획서: [`task_m100_90_impl.md`](../plans/task_m100_90_impl.md)
Stage: 3

## 단계 목적

Stage 2에서 사용자 중심으로 정리한 root/package README와 사용자 가이드를 유지하면서, repository의
나머지 공식 문서를 audience와 language별로 탐색할 수 있는 index를 만든다. 기여자 setup의 끊어진
release 문서 참조를 바로잡고, current tree historical 증적에 남은 개인 macOS home literal만 의미를
보존해 일반화한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/README.md` (36줄) | User guides, Contributor/integration, Maintainer operations, Internal records를 audience·language·역할별로 분리한 English 문서 index 신설 |
| `CONTRIBUTING.md` (66줄) | 제거된 root README release 명령 참조를 maintainer release 문서로 연결하고 전체 docs index 진입 링크 추가 |
| `mydocs/working/task_m100_51_stage2.md` | Sites helper 개인 절대경로 1건을 `$HOME` 기반으로 일반화 |
| `mydocs/working/task_m100_59_stage1.md` | bundled Node 개인 절대경로 3건을 `$HOME` 기반으로 일반화 |
| `mydocs/working/task_m100_59_stage2.md` | bundled Node 개인 절대경로 2건을 `$HOME` 기반으로 일반화 |
| `mydocs/working/task_m100_59_stage3.md` | bundled Node 개인 절대경로 1건을 `$HOME` 기반으로 일반화 |
| `mydocs/working/task_m100_6_stage4.md` | Downloads reference 경로 1건을 `$HOME` 기반으로 일반화 |
| `mydocs/working/task_m100_83_stage2.md` | Sites helper 개인 절대경로 1건을 `$HOME` 기반으로 일반화 |
| `mydocs/orders/20260824.md` | Task #90을 Stage 3 완료·Stage 4 승인 대기로 갱신 |
| `mydocs/working/task_m100_90_stage3.md` | 문서 navigation, path 일반화와 검증 결과 기록 |

## 본문 변경 정도 / 본문 무손실 여부

공식 제품/사용자 문서 본문과 제품 source는 변경하지 않았다. 신규 `docs/README.md`는 기존 7개 공식
문서를 삭제·이동하지 않고 다음처럼 분류한다.

- User guides — English, repository checkout 없이 사용하는 CLI와 README card 안내
- Contributor and integration guides — English, 개발 setup과 analyzer/current·legacy contract
- Maintainer operations — Korean, npm release와 production/Sites privileged operations
- Internal project records — `mydocs/`의 계획·단계 증적이며 외부 기여자 요구사항이 아님

`CONTRIBUTING.md`의 Node 20+, `npm install`, local frontend/runtime, `npm test`, `npm run build`,
`devel` 대상 PR 계약은 그대로 유지했다. root README가 더 이상 release 검증 명령을 포함하지 않으므로
해당 한 문장만 `docs/npm-release.md`와 새 docs index로 연결했다.

historical 보고서 6개는 개인 macOS home prefix만 `$HOME`으로 치환했다. 원래 명령, dependency
version, 파일 위치 역할, 검증 수치, 판정과 시점은 삭제하거나 다시 해석하지 않았다. immutable Git
history는 rewrite하지 않았다.

## 검증 결과

실행 명령:

```bash
node -e 'const fs=require("node:fs"); for (const file of ["README.md","CONTRIBUTING.md","docs/README.md","docs/cli-submit.md","docs/readme-card.md"]) { if (!fs.existsSync(file)) process.exitCode=1; }'
rg -n 'npm (install|ci)|npm run (dev|dev:runtime|test|build)' CONTRIBUTING.md package.json
rg -n 'production-hosting|sites-operations|npm-release|usage-snapshot-v2|codex-usage-analyzer' README.md
rg -n "$(printf '/Users/%s' melee)" README.md docs mydocs
npm run scan:public-release
npm run verify:npm-release
git diff --check
git status --short
```

추가로 README, CONTRIBUTING, docs index와 두 user guide의 relative link target을 검사하고 docs index의
canonical language와 7개 공식 문서 분류를 확인했다.

결과:

- OK — 필수 5개 공개 진입 문서가 모두 존재한다.
- OK — CONTRIBUTING은 Node/npm setup, frontend/runtime, test/build와 maintainer docs navigation을
  제공한다.
- OK — root README의 maintainer/integration 문서 직접 링크는 0건이며 user guide 2개와
  CONTRIBUTING만 공개 흐름에서 안내한다.
- OK — README, docs와 `mydocs/` current tree의 개인 macOS home literal은 0건이다.
- OK — docs index는 English이고 각 문서의 audience, language와 역할을 표시한다.
- OK — local Markdown link checker는 5개 진입 문서, missing 0이다.
- OK — `scan:public-release`는 `ok=true`, blocker 0, review 71, scanned blob 3,094개로 통과했다.
- OK — `verify:npm-release`는 immutable `codex-usage-profile@0.1.3`, entry 14개,
  shasum `ee1af5b754c0f113f64ac06f59e9d8bb4582fe74`로 통과했다.
- OK — `git diff --check`가 통과했고 package version, lockfile, Sites manifest와 제품 source diff는 없다.

## 잔여 위험

- public scanner의 review 71건에는 immutable Git history의 과거 개인 경로와 승인된 test fixture가
  포함된다. current tree literal 0과 별도로 판정해야 한다.
- maintainer operation 문서는 의도적으로 Korean canonical을 유지한다. 새 English index가 언어를
  명시하지만 문서 자체를 번역하는 작업은 이번 범위가 아니다.
- 새 index와 README 구조는 아직 원격 checkpoint PR과 `main`에서 render되지 않았다.

## 다음 단계 영향

- Stage 4는 Stage 1~3 전체 source diff가 문서·historical path 범위에만 있는지 다시 검증한다.
- 승인 뒤 `publish/task90 → devel` non-closing checkpoint PR을 만들고, 작업지시자 merge 후
  `devel → main` release PR을 별도 Gate로 진행한다.
- 두 PR merge 뒤 approved source가 `origin/main`에 포함되고 README/CONTRIBUTING/docs/package README
  path가 exact-match하는지 검증한다.
- GitHub `main` rendered README의 실제 카드 크기, badge, heading, code block과 링크 수동 확인은
  Stage 4에서 수행한다. GitHub metadata와 production/npm/Sites는 아직 변경하지 않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 source integration과 exact-main 공개 문서 승격으로
  진행한다.
