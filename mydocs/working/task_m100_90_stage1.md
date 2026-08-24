# Task #90 Stage 1 보고서 — 공개 표면과 문서 정보구조 계약 확정

GitHub Issue: [#90](https://github.com/postmelee/codex-usage-profile/issues/90)
구현계획서: [`task_m100_90_impl.md`](../plans/task_m100_90_impl.md)
Stage: 1

## 단계 목적

공식 공개 문서를 수정하기 전에 현재 GitHub/npm/production 공개 표면을 읽기 전용으로 고정하고,
README의 정보구조·표시 크기·언어, 문서 audience, CI badge 의미, GitHub metadata의 desired/rollback
payload와 Stage 2/3 exact 변경 파일을 확정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_90_stage1.md` | 공개 표면 inventory, render/HTTP 결과와 다음 Stage 계약 기록 |
| `mydocs/plans/task_m100_90.md` | 개인 경로 audit가 계획서 자체를 오탐하지 않도록 검증 범위·표현 보정, CI badge 제거 결정 반영 |
| `mydocs/plans/task_m100_90_impl.md` | user surface와 maintainer/history scan 분리, CI workflow 의미에 맞춘 badge 계약 반영 |
| `mydocs/orders/20260824.md` | Task #90을 Stage 1 완료·Stage 2 승인 대기로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

`README.md`, package README, `CONTRIBUTING.md`, `docs/*`와 제품 source는 수정하지 않았다. GitHub
repository metadata, production Site, npm package와 Git ref에도 mutation을 수행하지 않았다.

계획서의 audit 명령만 최소 보정했다. 기존 명령은 계획서 안의 개인 경로 문자열을 스스로 탐지하고,
stage5를 정당하게 설명하는 maintainer 운영 문서까지 사용자-facing 전환 문구로 오인해 완료될 수 없는
형태였다. 보정 뒤에는 다음을 각각 판정한다.

- root/package/user guide의 공개 전·테스트 환경 문구
- root/package README의 `devel` CI badge
- 전체 current tree의 개인 macOS home literal
- immutable Git history의 review finding

## 공개 표면 inventory

### Root README와 npm README

| 항목 | Root README | package README |
|---|---:|---:|
| 길이 | 172줄 | 119줄 |
| H2 section | 13개 | 8개 |
| Markdown link | 23개 | 4개 |
| code block | 4개 | 5개 |
| 이미지 | live card 1개 + embed 예시 1개 | submit 결과 embed 예시 1개 |
| canonical language | English | English |

root README는 사용자 안내와 함께 backend 순서, endpoint availability, 개발·release 명령, user·contract·
maintainer·legacy 문서를 하나의 `Documentation` 목록에 노출한다. package README는 CLI 안전 경계와
submit 결과를 정확히 설명하지만 analyzer integration 문서를 일반 사용자 문서와 같은 우선순위로
노출한다.

npm registry의 `latest`와 `version`은 모두 `0.1.3`이다. registry README와
`packages/codex-usage-profile-cli/README.md`는 5,679 bytes 및 SHA-256
`a3b9e2e83ed64c79b2b0e22e8ed55a7b875ea80802bf04559c224abd2af1dfbd`로 exact-match했다. Stage 2의
package README source 변경은 다음 package release source일 뿐이며 `0.1.3` 재게시를 요구하지 않는다.

### GitHub rendered README

GitHub repository의 현재 default `devel` 화면을 Codex in-app browser에서 1280x720 viewport로 확인했다.

- README article 폭은 838px이고 `width="50%"` live card는 419x256.94px로 렌더됐다.
- 원본은 1497x918이고 GitHub Camo URL로 proxy되지만 outer link는 query 없는
  `https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/postmelee`를 유지했다.
- badges, 긴 서비스 설명, IMPORTANT callout 뒤에 카드가 나와 첫 사용자 가치보다 설명이 먼저 보였다.
- 카드 오른쪽 절반이 빈 공간이라 실제 예시의 시각적 우선순위가 낮았다.

Stage 2의 repository live example은 title과 한 문장 value proposition 바로 뒤로 옮기되
`width="50%"`를 유지한다. CLI가 반환하고 사용자에게 복사되는 README Markdown과 문서의 embed
예시도 같은 50% 폭 계약을 유지한다. 이번 작업은 카드 위치와 주변 정보구조만 보정한다.

### 문서 audience와 language

| 문서 | 현재 언어 | audience | root 직접 노출 결정 |
|---|---|---|---|
| `docs/cli-submit.md` | Korean 중심(329줄 중 한글 포함 175줄) | User | 유지, Stage 2에서 English canonical rewrite |
| `docs/readme-card.md` | Korean 중심(256줄 중 140줄) | User | 유지, Stage 2에서 English canonical rewrite |
| `docs/codex-usage-analyzer.md` | English | Contributor / integration | 제거, `docs/README.md`로 이동 |
| `docs/npm-release.md` | Korean 중심(325줄 중 215줄) | Maintainer operations | 제거, `docs/README.md`로 이동 |
| `docs/production-hosting.md` | Korean 중심(525줄 중 360줄) | Maintainer architecture | 제거, `docs/README.md`로 이동 |
| `docs/sites-operations.md` | Korean 중심(550줄 중 417줄) | Maintainer runbook | 제거, `docs/README.md`로 이동 |
| `docs/usage-snapshot-v2.md` | English | Legacy compatibility | 제거, `docs/README.md`로 이동 |

root README는 user guides 2개와 `CONTRIBUTING.md`만 직접 안내한다. 새 English
`docs/README.md`가 User guides, Contributor/contracts, Maintainer operations, Legacy compatibility로
나누고 각 문서의 audience와 language를 표시한다. Maintainer 문서와 `mydocs/`의 Korean canonical은
변경하지 않는다.

### Development와 CI badge

`CONTRIBUTING.md`는 Node 20+, `npm install`, `npm run dev`, `npm run dev:runtime`, `npm test`,
`npm run build`와 `devel` 대상 외부 PR 흐름을 이미 설명한다. root의 `Development`와 release 검증 명령을
제거한 뒤 Stage 3에서 release surface 검증의 진실 원천을 `CONTRIBUTING.md`와 maintainer docs로 연결한다.

`.github/workflows/publish-npm.yml`의 현재 trigger는 다음과 같다.

- push: `devel`, historical `publish/task44`, `codex-usage-profile-v*` tag
- pull request: `devel`
- `main` push/PR: 실행하지 않음

따라서 root의 `branch=devel` CI badge를 `main`으로 바꾸면 상태 근거가 없고, 그대로 두면 default
release landing과 다른 integration branch를 사용자에게 강조한다. Task #90에서는 CI badge를 제거하고
Website, npm version, MIT license badge를 유지한다. Workflow trigger 자체와 historical
`publish/task44` cleanup은 제품 문서 작업 범위 밖이므로 변경하지 않는다.

## production HTTP 검증

2026-08-24 KST에 canonical production을 HEAD/GET으로 조회했다.

| 경로 | 결과 | content / cache 핵심 |
|---|---|---|
| `/` | HEAD/GET 200 | `text/html`, GET 2,830 bytes, `public, max-age=0, must-revalidate` |
| `/api/share/postmelee` | HEAD/GET 200 | `text/html; charset=utf-8`, GET 4,606 bytes, fixed canonical URL, revisioned `og:image` |
| `/u/postmelee/card.png` | HEAD/GET 200 | `image/png`, 146,790 bytes, 1497x918, ETag 존재, `public, no-cache, must-revalidate` |
| `/favicon.ico` | HEAD/GET 200 | `image/vnd.microsoft.icon`, GET 4,314 bytes |
| `/favicon-32x32.png` | HEAD/GET 200 | `image/png`, 2,700 bytes, 32x32 |
| `/site-icon-512.png` | HEAD/GET 200 | `image/png`, 195,954 bytes, 512x512 |
| `/apple-touch-icon.png` | HEAD/GET 200 | `image/png`, 32,330 bytes, 180x180 |

공유 페이지 title은 `postmelee's Codex card · Codex Usage Profile`, canonical은 fixed
`/api/share/postmelee`, `og:image`은 `/u/postmelee/social.png?v=1787568404251`이었다. 이 결과는 README
fixed href/src와 SNS revision URL을 분리하는 기존 계약과 일치한다.

## GitHub metadata와 branch topology

### 현재/rollback과 desired payload

| 필드 | 현재 rollback 값 | Stage 5 desired 값 |
|---|---|---|
| `description` | `Turn your Codex account usage into a shareable profile and stable GitHub README card.` | `Turn Codex account usage into a private-by-default profile and a stable GitHub README card.` |
| `homepage` | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` |
| `default_branch` | `devel` | `main` |

description desired copy는 root README value proposition과 byte-for-byte 같은 문장으로 사용한다. Stage 5
preflight에서 현재 값이 rollback payload와 다르면 mutation하지 않는다.

### Source topology

- Stage 1 task HEAD: `4b9c0aac6b056ace5c15eb00e483cbd6bcfd1a94` (audit 문서 작성 전)
- `origin/devel`: `d604ff333a5158c800437bc7e0e7453a61b80af9`
- `origin/main`: `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`
- merge base: `24cf9b4002eaa5670ccd6f0113e501f7400ee4e9`
- `origin/main..origin/devel`: 16 commits
- `origin/devel..origin/main`: 5 merge commits

두 branch는 fast-forward 관계가 아니다. 현재 user-facing source diff는
`docs/{npm-release,production-hosting,readme-card,sites-operations}.md` 네 파일뿐이지만 Stage 4는
checkpoint PR merge 뒤 release PR과 exact approved path diff를 검증해야 한다.

## 공개 tree와 pre-release 표현 audit

- `PROFILE_CARD_EMBED_PLACEHOLDER`, `not yet live`, `Next deployment`는 root/package/docs current tree에
  없었다.
- user surface에서 stage5 표현은 없고 `branch=devel`은 root CI badge 한 건뿐이었다.
- 개인 macOS home literal은 아래 historical report 6개에 남아 있다.
  - `mydocs/working/task_m100_51_stage2.md`
  - `mydocs/working/task_m100_59_stage1.md`
  - `mydocs/working/task_m100_59_stage2.md`
  - `mydocs/working/task_m100_59_stage3.md`
  - `mydocs/working/task_m100_6_stage4.md`
  - `mydocs/working/task_m100_83_stage2.md`
- `npm run scan:public-release`는 `ok=true`, blocker 0, review 71, 출력된 finding 100,
  truncated finding 23으로 통과했다. review에는 immutable history와 credential test fixture가 포함되며
  current tree path 일반화와 분리해 판정한다.
- README, CONTRIBUTING과 `docs/*.md` 10개 파일의 Markdown local link target은 missing 0이었다.

## 다음 Stage의 확정 계약

### README outline

1. Title와 exact value proposition
2. fixed share href/queryless card src를 쓰는 `postmelee` live example (`width="50%"`)
3. Website/npm/license badge와 primary Website CTA
4. GitHub sign-in → `npx codex-usage-profile@latest submit` → preview/publish/share의 3단계 Quick start
5. private-by-default, stable README card, revision-aware SNS, credential 비수집의 사용자 benefit
6. `width="50%"` fixed README embed와 GitHub Camo cache expectation
7. privacy/safety 요약, CLI/card user guide와 troubleshooting
8. Contributing, maintainer support disclosure, license/trademark

backend 호출 순서, endpoint availability matrix, development/release 명령과 전체 docs 목록은 root에서
제거한다. SNS 즉시 refresh, 자동 posting 또는 OpenAI endorsement를 약속하지 않는다.

### Stage 2 exact 파일

- `README.md`
- `packages/codex-usage-profile-cli/README.md`
- `docs/cli-submit.md`
- `docs/readme-card.md`

### Stage 3 exact 파일

- 신규 `docs/README.md`
- `CONTRIBUTING.md`
- 위에 열거한 historical `mydocs/working/*.md` 6개

## 검증 결과

실행 명령:

```bash
gh api repos/postmelee/codex-usage-profile
git fetch origin
git rev-parse HEAD origin/devel origin/main
git rev-list --count origin/main..origin/devel
git rev-list --count origin/devel..origin/main
rg -n '^#|^##|https?://|<img|\]\(' README.md packages/codex-usage-profile-cli/README.md
rg -n '[가-힣]' README.md packages/codex-usage-profile-cli/README.md docs
rg -n 'PROFILE_CARD_EMBED_PLACEHOLDER|not yet live|Next deployment' README.md packages/codex-usage-profile-cli/README.md docs
rg -n "$(printf '/Users/%s' melee)" README.md docs mydocs
rg -n '^on:|branches:|pull_request:|push:' .github/workflows/publish-npm.yml
npm run scan:public-release
git diff --check
git status --short
```

추가로 npm registry README exact hash, production 7개 공개 경로 HEAD/GET, GitHub repository rendered
README의 DOM·screenshot과 local Markdown link 10개 파일을 읽기 전용으로 검증했다.

결과:

- OK — GitHub metadata, npm 0.1.3 README, production root/share/card/favicon과 branch topology를 고정했다.
- OK — root/package README는 English, user guide 2개는 Korean 중심이라는 language gap을 확인했다.
- OK — GitHub Camo outer href 보존과 50% live card의 실제 419px 표시를 확인했다.
- OK — public release scan blocker 0, local link missing 0이다.
- OK — 제품/공식 문서와 remote state mutation 0건이다.
- 보정 — 완료 불가능한 self-match scan을 user surface와 current-tree/history 검사로 분리했다.

## 잔여 위험

- GitHub Camo는 origin ETag와 별도 cache이므로 Stage 2 문서 변경 직후 카드 이미지 refresh 시간을
  보장할 수 없다.
- `origin/main`과 `origin/devel`이 diverged 상태라 Stage 4 release PR의 merge provenance와 approved
  path equality 검증이 필수다.
- package README source를 Stage 2에서 바꾸면 npm registry `0.1.3` README와 달라진다. 이는 immutable
  release 특성이며 다음 CLI release 때 반영한다.
- `publish-npm.yml`의 historical `publish/task44` push trigger는 별도 CI cleanup 후보지만 Task #90에서는
  동작 변경하지 않는다.
- immutable Git history review finding은 current tree 문서 보정으로 제거되지 않는다.

## 다음 단계 영향

- Stage 2는 위 outline, live example `width="50%"`, user surface English와 fixed README/revision SNS
  분리 계약을 그대로 사용한다.
- `width="50%"` CLI README 결과, package version, 제품 코드와 production remote는 변경하지 않는다.
- Stage 2 완료 뒤 root/package/user guides render와 npm release verifier를 함께 검증한다.

## 승인 요청

- Stage 1 산출물과 검증 결과, CI badge 제거, README outline, live example `width="50%"`, language/audience
  matrix와 desired metadata payload를 승인하면 Stage 2로 진행한다.
