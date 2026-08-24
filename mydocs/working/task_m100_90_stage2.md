# Task #90 Stage 2 보고서 — 사용자 중심 README와 공개 가이드 보정

GitHub Issue: [#90](https://github.com/postmelee/codex-usage-profile/issues/90)
구현계획서: [`task_m100_90_impl.md`](../plans/task_m100_90_impl.md)
Stage: 2

## 단계 목적

공개 저장소와 npm package의 첫 진입 문서를 공식 공개 사용자 관점으로 재구성하고, CLI 제출과
README 카드 가이드를 영어 canonical 문서로 정리한다. 제품 동작과 고정 README URL/revision 공유 URL
계약은 바꾸지 않으면서 신규 사용자가 로그인, 제출, 비공개 미리보기, 공개와 공유 흐름을 바로 이해할
수 있게 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` (109줄) | title과 value proposition 바로 아래에 `width="50%"` 실제 카드를 배치하고, 3단계 Quick start·사용자 benefit·고정 README embed·privacy/help 중심으로 재구성 |
| `packages/codex-usage-profile-cli/README.md` (96줄) | npm 사용자를 위한 설치 없는 submit 흐름, 명령·출력·credential/automation 경계와 세 개의 사용자 문서 링크로 축약 |
| `docs/cli-submit.md` (207줄) | device approval, submit/status/logout, 선택적 star prompt, 전송/비전송 데이터, credential, automation, 오류 복구를 영어 사용자 가이드로 재작성 |
| `docs/readme-card.md` (148줄) | publish/embed, `width="50%"`, fixed/revision URL 역할, theme/locale, ETag/Camo, privacy/error와 troubleshooting을 영어 사용자 가이드로 재작성 |
| `mydocs/orders/20260824.md` | Task #90을 Stage 2 완료·Stage 3 승인 대기로 갱신 |
| `mydocs/working/task_m100_90_stage2.md` | 변경 범위, 계약 보존, 검증 결과와 다음 Stage 조건 기록 |

## 본문 변경 정도 / 본문 무손실 여부

네 공개 문서는 문장 단위 보정보다 큰 정보구조 재작성을 수행했다. root README는 172줄에서 109줄,
package README는 119줄에서 96줄, CLI 가이드는 329줄에서 207줄, 카드 가이드는 256줄에서 148줄로
축약했다. backend 순서, release/Stage 이력, operator 상세, 테스트 origin과 일반 사용자에게 필요 없는
통합 문서 목록을 공개 진입면에서 제거했다.

다음 사용자·안전 계약은 유지하거나 더 명확하게 설명했다.

- 일반 submit 명령은 `npx codex-usage-profile@latest submit`이며 custom origin을 요구하지 않는다.
- README Markdown은 fixed `/api/share/{handle}` href와 queryless `/u/{handle}/card.png` src,
  `width="50%"`를 유지한다.
- submit이나 카드 설정 저장 전후 README Markdown은 동일하고, 복사 공유 링크와 X·LinkedIn·Threads·
  Facebook·Reddit target만 `/api/share/{handle}/r/{revision}`의 새 revision으로 바뀐다.
- profile은 private by default이고 publish 뒤에만 공개된다. private와 missing card는 동일하게 `404`다.
- OpenAI/Codex password, API/access/refresh token, `auth.json`, prompt, response와 session file은
  업로드하지 않는다.
- local credential 권한, environment token 우선순위, 활성 token 한도, non-interactive 출력,
  `media_unavailable`/`Retry-After` 복구 경계를 유지했다.
- origin PNG의 ETag 갱신과 GitHub Camo cache는 별개이며 SNS 즉시 갱신을 보장하지 않는다.
- 선택적 GitHub star prompt를 거절해도 submit에 영향이 없고 CI/non-interactive에서는 생략된다는
  사용자 문장과 상세 동작을 분리해 배치했다.

제품 코드, CLI 동작, package version/lockfile, Sites manifest, production/npm/GitHub remote state는
변경하지 않았다. package README source는 다음 npm release의 입력이며 이미 게시된 immutable `0.1.3`
artifact를 다시 게시하지 않는다.

## 검증 결과

실행 명령:

```bash
rg -n 'stage5|Task #[0-9]+|saved version|--server|candidate|unpublished|Next deployment|not yet live' README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md docs/readme-card.md
rg -n '[가-힣]' README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md docs/readme-card.md
rg -n 'npx codex-usage-profile@latest submit' README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md
rg -n '/api/share/\{handle\}|/u/\{handle\}/card\.png|/r/\{revision\}' README.md docs/readme-card.md
npm run verify:npm-release
npm run scan:public-release
git diff --check
git status --short
```

추가로 네 문서의 relative link target을 local link checker로 검사하고, root README를 GitHub Markdown
API의 `mode=gfm`, repository context로 렌더해 구조와 카드 속성을 검사했다.

결과:

- OK — 공개 전/테스트 표현, `--server`, Task/Stage 이력 표현은 user surface에서 0건이다.
- OK — 네 공개 문서의 한국어는 0건이며 영어 canonical language로 일치한다.
- OK — 세 문서에 `npx codex-usage-profile@latest submit`이 존재한다.
- OK — fixed README href/src, `width="50%"`, revision 공유 URL과 5개 SNS target 계약이 일치한다.
- OK — local Markdown link checker는 4개 파일, missing 0이다.
- OK — GitHub 공식 GFM render는 9,557 bytes, H1 1개, H2 9개, code block 3개, image 4개이며
  fixed `postmelee` share href와 `width="50%"` card를 인식했다.
- OK — `verify:npm-release`는 `codex-usage-profile@0.1.3`, entry 14개,
  shasum `ee1af5b754c0f113f64ac06f59e9d8bb4582fe74`로 통과했다.
- OK — `scan:public-release`는 `ok=true`, blocker 0, review 71, scanned blob 3,088개로 통과했다.
- OK — `git diff --check`가 통과했고 문서·보고서 외 제품 source 변경은 없다.

로컬 미게시 branch의 실제 GitHub repository screenshot은 만들지 않았다. in-app browser가 보안 정책상
local/data URL을 표시하지 않아 우회하지 않았고, 공식 GFM renderer의 HTML 구조로 현재 문서를 검증했다.
실제 repository 화면의 desktop screenshot과 링크 수동 확인은 source가 원격 branch와 `main`에 반영되는
Stage 4에서 수행한다.

## 잔여 위험

- repository package README source와 npm registry의 immutable `0.1.3` README는 다음 package release까지
  다르다. 현재 package 재게시 사유는 아니다.
- GitHub Camo는 origin ETag와 독립적으로 지연될 수 있어 문서로 즉시 refresh를 보장하지 않는다.
- 미게시 source의 GitHub repository 실제 화면 확인은 Stage 4 checkpoint/release PR 뒤에 남아 있다.
- public scan의 review 71건은 immutable Git history와 별도 Stage 3 current-tree 위생 항목을 포함한다.

## 다음 단계 영향

- Stage 3은 사용자 문서 본문을 다시 확장하지 않고 `docs/README.md`와 `CONTRIBUTING.md`에서 User,
  Contributor/contracts, Maintainer operations, Legacy compatibility navigation을 분리한다.
- Stage 1에서 확정한 historical 보고서 6개의 개인 macOS home literal만 의미를 보존해 일반화한다.
- root README는 두 user guide와 CONTRIBUTING만 직접 노출하고 maintainer/legacy 문서는 docs index에서만
  안내한다.
- 제품 코드, npm package version과 production remote는 계속 변경하지 않는다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 문서 navigation과 공개 tree 위생 정리로 진행한다.
