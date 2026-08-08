# Task #81 Stage 2 완료 보고서 — 공개 사용자·운영 문서 계약 정합화

GitHub Issue: [#81](https://github.com/postmelee/codex-usage-profile/issues/81)
구현계획서: [`task_m100_81_impl.md`](../plans/task_m100_81_impl.md)
Stage: 2

## 단계 목적

README에서 구분한 current production과 next deployment 상태를 공개 사용자·운영 문서의 URL, 이미지 크기, 배포 smoke 계약에도 동일하게 적용한다. 현재 saved version 7의 `/?profile={handle}` HTML과 stable README card는 유지하고, Task #74·#78 누적 후보의 `/u/{handle}` canonical share/OG 문서, `social.png`, theme·Share Studio는 production smoke 전 기능으로 명시한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/readme-card.md` | 998x612를 1497x918로 정정하고 current production 사용자 흐름과 다음 후보 Share Studio·canonical share·2400x1260 social preview를 분리. `/?profile={handle}`은 현재/compatibility, `/u/{handle}`은 다음 배포 canonical로 정리 |
| `docs/sites-operations.md` | saved version 7 baseline을 유지하면서 Task #74·#78 누적 후보의 owner-only/public smoke에 OG/canonical, social GET/HEAD/304, private/missing fail-closed 검증과 cutover 승격 조건 추가 |
| `docs/production-hosting.md` | Task #74 단독 후보를 Task #74·#78 누적 후보로 보정하고 contract v3 projection·`/u/{handle}` document·social media의 local/PR 검증과 production 미배포 상태 명시. npm 공개 버전을 0.1.1로 현행화 |
| `mydocs/working/task_m100_81_stage2.md` | Stage 2 변경, 감사 결과, 잔여 위험과 Stage 3 인계 기록 |

## 본문 변경 정도 / 본문 무손실 여부

세 문서의 기존 기술 계약과 운영 순서를 유지하면서 배포 상태 표현을 필요한 문단에 추가·재구성했다.

- `docs/readme-card.md`: 180줄에서 199줄. 기존 사용자 흐름을 current production 5단계와 다음 배포 후보 공유 흐름으로 분리했다. stable README URL, submit/API, cache, GitHub Camo, 데이터·인증·상표 본문은 보존했다.
- `docs/sites-operations.md`: 285줄에서 301줄. readiness, maintenance, OAuth, export/restore, retention, rollback 순서는 그대로 두고 candidate/public smoke와 cutover 조건만 보강했다.
- `docs/production-hosting.md`: 377줄에서 396줄. current production 표의 version/source/access/environment와 fallback·security·retention 본문을 변경하지 않고 누적 후보 상태와 social route 검증 경계만 보강했다.

제품 code, test, workflow, package manifest와 보호 문서 `docs/cli-submit.md`, `packages/codex-usage-profile-cli/README.md`는 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
rg -n '998x612|1497x918|2400x1260|\?profile=|/u/\{handle\}|card\.png|social\.png|canonical|production link|current production' README.md docs packages/codex-usage-profile-cli/README.md
git diff --name-only HEAD^ -- README.md docs packages src .github package.json package-lock.json
git diff --name-only -- src .github package.json package-lock.json packages/codex-usage-profile-cli/README.md docs/cli-submit.md
git show HEAD:docs/production-hosting.md | sed -n '24,34p'
sed -n '24,34p' docs/production-hosting.md
ruby -e 'missing=[]; ARGV.each do |file|; File.read(file).scan(/\[[^\]]*\]\(([^)]+)\)/).flatten.each do |target|; next if target =~ %r{\A(?:https?://|mailto:|#)}; path=target.split("#",2).first.split("?",2).first; missing << target unless File.exist?(File.expand_path(path, File.dirname(file))); end; end; exit 1 unless missing.empty?' docs/readme-card.md docs/sites-operations.md docs/production-hosting.md
git diff --check
```

결과:

- OK — 공개 문서 전체에서 `998x612`는 0건이며 README PNG는 1497x918, social preview는 2400x1260으로 분리됐다.
- OK — `/?profile={handle}` occurrence는 모두 saved version 7 current baseline 또는 후보 배포 뒤 SPA compatibility 역할로 명시됐다. `/u/{handle}`은 smoke 통과 전 next deployment이며 이후 canonical share link로 승격하는 조건과 함께 기록됐다.
- OK — `/u/{handle}/card.png`는 current stable README image, `/u/{handle}/social.png`는 next deployment social image로 분류됐다.
- OK — `docs/production-hosting.md` current production 표의 saved version `7`, source `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`, access `public, revision 14`, environment `revision 9`가 작업 전과 exact-match다.
- OK — 수정한 Markdown의 모든 상대 link target이 존재한다.
- OK — Stage 2 working diff는 세 승인 문서에 한정된다. `HEAD^` 비교에서 보이는 `README.md`는 이전 Stage 1 커밋이며, 이번 Stage의 제품 code, test, workflow, package manifest와 보호 문서 diff는 비어 있다.
- OK — `git diff --check`가 통과했다.

## 잔여 위험

- Task #74·#78 누적 후보는 local·PR 검증만 완료했으며 실제 Sites owner-only/public smoke 전이다. 문서는 배포 절차와 승격 조건을 정의했지만 production 상태를 변경하지 않았다.
- 실제 `/u/{handle}` canonical link와 README 상단 embed marker 활성화는 Task #81 이후 별도 배포 Issue와 smoke 승인이 필요하다.

## 다음 단계 영향

- Stage 3에서 GitHub repository description을 `Turn your Codex account usage into a shareable profile and stable GitHub README card.`, homepage를 canonical production origin으로 적용한다.
- metadata 적용 전후 exact 값을 확인하고 partial failure 시 기존 빈 값으로 복원한다.
- 통합 검증에서 production `/healthz` 200과 `/u/postmelee`의 현재 307 → `/` baseline, npm 0.1.1, CI passing, README placeholder 유지 여부를 다시 확인한다.
- Stage 3에서도 Sites 배포, D1/R2 mutation, card embed 활성화는 수행하지 않는다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 GitHub 공개 메타데이터 적용과 통합 검증으로 진행한다.
