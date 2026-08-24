# Task #90 Stage 5 보고서 — GitHub metadata cutover와 최종 공개 검증

GitHub Issue: [#90](https://github.com/postmelee/codex-usage-profile/issues/90)
구현계획서: [`task_m100_90_impl.md`](../plans/task_m100_90_impl.md)
Stage: 5

## 단계 목적

Stage 4에서 승인된 `main` 공개 문서를 GitHub 저장소의 실제 기본 진입면으로 전환한다.
작업지시자의 2026-08-24 보정 지시에 따라 repository description은 현재 관찰값을 그대로
보존하고, homepage와 default branch 두 필드만 canonical production과 `main`으로
원자적으로 변경한다. 변경 직후 GitHub 공개 화면, npm 패키지, production Site와 공개
문서 정합성을 다시 검증한다.

## 산출물

| 파일/원격 상태 | 변경 요약 |
|---|---|
| GitHub repository metadata | homepage를 canonical production으로, default branch를 `main`으로 변경 |
| `mydocs/plans/task_m100_90_impl.md` | 원격 preflight에서 확인한 실제 description 보존 기준값 기록 |
| `mydocs/orders/20260824.md` | Stage 5 완료와 최종 보고 승인 대기 상태 반영 |
| `mydocs/working/task_m100_90_stage5.md` | metadata 전환과 최종 공개 검증 결과 기록 |

원격 metadata의 exact 전환 결과:

| 필드 | 변경 전 | 변경 후 |
|---|---|---|
| `description` | `Turn your Codex account usage into a shareable rich link previews and stable GitHub README card.` | 동일, PATCH와 rollback payload에서 모두 제외 |
| `homepage` | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site` |
| `default_branch` | `devel` | `main` |

homepage와 default branch는 한 번의 GitHub API PATCH로 함께 변경했다. 응답과 후속 GET에서
두 desired 값과 변경 전 description의 exact 보존을 확인했다. 부분 반영이나 검증 실패가 없어
준비한 두 필드 rollback은 실행하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

README, npm README, 공개 사용자 문서, 제품 소스와 production Site는 변경하지 않았다.
GitHub 기본 진입면이 이미 승인된 `origin/main` merge commit
`4d1252f9988f39bdbe07f148c93ce4e9d620e35a`를 가리키도록 metadata만 전환했다.
description도 작업지시자 요청대로 한 글자도 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
gh api repos/postmelee/codex-usage-profile --jq '{description,homepage,default_branch}'
git ls-remote origin refs/heads/main refs/heads/devel
npm view codex-usage-profile dist-tags version --json
curl -sS -o /dev/null -w '%{http_code} %{content_type}' \
  https://codex-usage-profile.meleeisdeveloping.chatgpt.site/
curl -sS -o /dev/null -w '%{http_code} %{content_type}' \
  https://codex-usage-profile.meleeisdeveloping.chatgpt.site/healthz
curl -sS -o /dev/null -w '%{http_code} %{content_type}' \
  https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/postmelee
curl -sS -D - -o /dev/null \
  https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/postmelee/card.png
curl -sS -o /dev/null -w '%{http_code} %{content_type}' \
  https://codex-usage-profile.meleeisdeveloping.chatgpt.site/__ops/profile-maintenance
npm run verify:npm-release
npm run scan:public-release
rg -n 'codex-usage-profile-stage5|PROFILE_CARD_EMBED_PLACEHOLDER|not yet live|Next deployment' \
  README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md docs/readme-card.md
rg -n 'branch=devel' README.md packages/codex-usage-profile-cli/README.md
rg -n "$(printf '/Users/%s' melee)" README.md docs mydocs
git diff --check
git status --short
```

결과:

- OK — GitHub metadata는 `default_branch=main`, production homepage이며 description은 preflight
  관찰값과 완전히 동일하다.
- OK — `origin/main=4d1252f9988f39bdbe07f148c93ce4e9d620e35a`,
  `origin/devel=346ecc02ff7dfb8ac89ef2393265931c5d69e741`로 승인한 release/checkpoint를 유지한다.
- OK — 실제 GitHub repository 루트는 `main branch`, latest commit `4d1252f`, production About
  링크를 표시한다. README는 H1 `Codex Usage Profile`, production CTA, queryless 카드 링크와
  `width="50%"` embed 계약을 그대로 렌더링한다.
- OK — npm registry의 `latest`와 `version`은 모두 `0.1.3`이다.
- OK — production landing `200 text/html`, health `200 application/json`, share HTML
  `200 text/html`, 카드 `200 image/png`과 ETag, 닫힌 operator route `404`를 확인했다.
- OK — Sites는 active/public, saved version 3, access revision 10, environment revision 4,
  live URL production을 유지한다. 환경 값은 변경하거나 노출하지 않았다.
- OK — `npm run verify:npm-release`는 `codex-usage-profile@0.1.3`, entry 14,
  integrity 검증 성공이다.
- OK — `npm run scan:public-release`는 blocker 0, review 71로 승인 기준과 동일하다.
- OK — stage5/placeholder/전환기 표현, `branch=devel`, 공개 tree 개인 절대 경로 검사는
  대상 파일에서 0건이다.
- OK — `git diff --check` 통과. 단계 보고서 작성 전에는 plan baseline 보정 파일만 변경
  상태였으며 공개 제품 파일 drift는 없었다.

## 잔여 위험

- GitHub와 외부 SNS/CDN의 캐시는 각 서비스 정책에 따라 갱신 지연이 생길 수 있다. 이번
  전환의 source, metadata, production origin에는 drift가 없다.
- repository description은 작업지시자 요청에 따라 현재 문구를 그대로 유지했다. 이후 문구
  변경이 필요하면 별도 승인 범위에서 다룬다.

## 다음 단계 영향

- Stage 1~5 결과를 묶은 최종 보고서를 작성하고 `publish/task90` PR로 남은 계획/보고서
  커밋을 `devel`에 반영한다.
- Task #90의 최종 PR merge가 확인되기 전에는 Issue close, branch/worktree 정리를 수행하지
  않는다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시 단계로 진행한다.
