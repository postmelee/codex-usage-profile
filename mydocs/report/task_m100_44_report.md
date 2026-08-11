# Task #44 최종 보고서 — npm package 공개와 production origin 검증

GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
마일스톤: M100

## 작업 요약

- 대상 이슈: #44
- 마일스톤: M100
- 단계 수: 6
- 작업 목적: `codex-usage-profile@0.1.0`을 검증된 provenance artifact로
  공개하고 Sites production origin의 maintainer-owned 전체 흐름을 검증해
  fresh-user QA #45에 넘긴다.

권고안 A에 따라 repository-wide MIT와 public GitHub source를 적용하고,
GitHub Actions provenance로 최초 npm version을 게시했다. 최초 bootstrap
token은 폐기했으며 future release는 trusted publisher의 tokenless staged
publishing과 maintainer 2FA 승인으로 제한했다.

published CLI로 production device login, Account Usage Contract v1 submit,
private preview, publish/unpublish, token revoke와 logout을 확인했다. 승인된
smoke owner의 session/token/D1/R2 데이터는 exact plan·digest·count로
cleanup했고 production은 maintenance disabled, service normal 상태다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `.github/workflows/publish-npm.yml` | Node 20/22/24 verification, exact version tag와 tokenless staged publishing 계약 | npm release CI와 provenance |
| `LICENSE` | repository-wide MIT 추가 | 공개 source와 기여·재사용 조건 |
| `package.json` | release verifier, local package smoke, public surface scan scripts 등록 | maintainer preflight |
| `package-lock.json` | analyzer exact dependency 계약 동기화 | 재현 가능한 install |
| `packages/codex-usage-profile-cli/package.json` | exact analyzer `0.2.0`, public source/support, provenance metadata | npm registry metadata |
| `scripts/verify-npm-release.mjs` 및 test | manifest, lock, 13-file tarball, mode, integrity와 민감정보 fail-closed 검증 | release artifact |
| `scripts/smoke-npm-package-local.mjs` 및 test | 격리 consumer install, bin/help/status/origin 경계 검증 | clean npm 사용자 |
| `scripts/scan-public-release-surface.mjs` 및 test | 모든 Git ref/blob와 commit metadata의 값 비출력 public scan | repository 공개 보안 |
| `README.md` | public npm quickstart, provenance, license와 검증 상태 반영 | 신규 사용자·기여자 |
| `packages/codex-usage-profile-cli/README.md` | package 설치, production origin, privacy와 현재 release 상태 정렬 | npm 사용자 |
| `docs/cli-submit.md` | published CLI login/submit/logout 흐름과 privacy 경계 정렬 | CLI 사용자 |
| `docs/readme-card.md` | published CLI와 stable card 순서 정렬 | profile/card 사용자 |
| `docs/npm-release.md` | 최초 publish, recovery, trusted publisher, PASS 판정과 복구 정책 | maintainer·기여자 |
| `mydocs/plans/task_m100_44*.md` | 6개 Stage, Gate A/B/C와 문서 위치·복구 계획 | task 추적 |
| `mydocs/working/task_m100_44_stage{1..6}.md` | 단계별 artifact, 검증, 승인과 외부 변경 증적 | task 추적 |
| `mydocs/orders/20260728.md` | Task #44 완료 상태와 완료 시각 기록 | 당일 작업 보드 |
| `mydocs/report/task_m100_44_report.md` | 최종 수용 기준, 잔여 위험과 #45 handoff | 장기 보고 |

CLI runtime source, Account Usage Contract field, Site application source,
saved version, D1/R2 schema와 제품 UI는 변경하지 않았다. Sites remote는
승인된 smoke와 cleanup 동안 운영 모드만 전환한 뒤 기존 saved version 7과
normal mode로 복구했다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | repository root | repository root | OK | 공개 install과 license 진입 문서 |
| `packages/codex-usage-profile-cli/README.md` | package root | package root | OK | npm tarball 사용자 문서 |
| `docs/cli-submit.md` | `docs/` | `docs/` | OK | 기존 CLI 진실 원천 유지 |
| `docs/readme-card.md` | `docs/` | `docs/` | OK | 기존 card 진실 원천 유지 |
| `docs/npm-release.md` | `docs/` | `docs/` | OK | 제품 release 운영 runbook |
| `.github/workflows/publish-npm.yml` | `.github/workflows/` | `.github/workflows/` | OK | GitHub Actions release automation |
| `mydocs/working/task_m100_44_stage{N}.md` | `mydocs/working/` | `mydocs/working/` | OK | 단계별 task 증적 |
| `mydocs/report/task_m100_44_report.md` | `mydocs/report/` | `mydocs/report/` | OK | task 최종 장기 보고 |

공식 제품·사용자·외부 통합 문서는 계획대로 root, package root와 `docs/`에
두었다. `mydocs/manual`에는 제품 문서를 추가하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| GitHub repository visibility | private | public |
| repository license | CLI package directory만 MIT | repository-wide MIT + package MIT |
| npm 공개 version | 0 (`E404`) | 1 (`codex-usage-profile@0.1.0`) |
| npm dist-tag | 없음 | `latest -> 0.1.0` |
| registry tarball | 없음 | 13 files, packed 14,221 bytes, unpacked 49,887 bytes |
| registry SHA-1 | 없음 | `a1d30872a6677e9b781e64e14f7ad9040ee92e0d` |
| release provenance | 없음 | public GitHub recovery tag·commit·workflow attestation |
| release verification matrix | 없음 | Node 20, 22, 24 |
| first-publish credential | 없음 | 임시 token 사용 후 npm/GitHub 모두 0 remaining |
| future release 인증 | 없음 | trusted publisher + `npm stage publish` + 2FA approval |
| public surface scanner | 없음 | 1,248 blobs·221 commits, blocker 0·승인 review 12 |
| 전체 Node 회귀 | 483 tests 시점에서 시작 | 487 tests, 481 pass·6 skip·0 fail |
| Playwright E2E | 기존 16개 | 16/16 pass |
| task source diff | 해당 없음 | 최종 보고 전 25 files, 4,653 insertions·17 deletions |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| public package/version/dist-tag | OK — public `0.1.0` 한 version과 `latest=0.1.0` |
| registry artifact 불변성 | OK — 13 files와 Stage 3 SHA-1/SHA-512 일치 |
| provenance source | OK — public repository, recovery tag, commit `f10ad2c…`, `publish-npm.yml`, run `30352705791` |
| clean install과 production origin | OK — exact/`@latest`의 version, bin, analyzer `0.2.0`과 production origin 일치 |
| CLI origin/credential 보호 | OK — CLI/env/stored precedence와 cross-origin credential 비전송 회귀 통과 |
| production smoke | OK — device login/status/Contract v1 submit/private preview/publish/unpublish/revoke/logout 통과 |
| privacy 경계 | OK — prompt, response, tool data, Codex/OpenAI/GitHub credential와 local session file 비전송 |
| smoke cleanup | OK — exact D1/R2 owner cleanup, token/session/local credential 제거, owner `not_found` |
| future release 인증 | OK — tokenless staged publisher 고정, first-publish token과 GitHub secret 없음 |
| public source scan | OK — blocker 0, Gate A 승인 review 12 유지 |
| package/source/support/docs | OK — public repository와 Issues, official docs, package MIT metadata 정렬 |
| Sites runtime/fallback 회귀 | OK — production/Sites artifact와 hosting matrix 통과 |
| #45 handoff | OK — exact package/origin/provenance/cleanup과 fresh-user 독립 판정 경계 게시 |
| worktree 품질 | OK — `git diff --check` 통과, 최종 보고 전 clean |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_44_stage1.md): exact package metadata,
  analyzer pin, 13-file tarball verifier와 격리 consumer smoke를 고정했다.
- [Stage 2](../working/task_m100_44_stage2.md): public history scanner,
  provenance workflow와 Gate A 공개 범위를 준비했다.
- [Stage 3](../working/task_m100_44_stage3.md): repository-wide MIT와 public
  전환, immutable candidate와 Node 20/22/24 Gate B preflight를 완료했다.
- [Stage 4](../working/task_m100_44_stage4.md): npm 12 recovery tag 경로로
  provenance `0.1.0`을 게시하고 tokenless staged publishing으로 전환했다.
- [Stage 5](../working/task_m100_44_stage5.md): published CLI production
  전체 흐름과 exact owner/token/session/D1/R2 cleanup을 완료했다.
- [Stage 6](../working/task_m100_44_stage6.md): registry/provenance/clean
  install/전체 회귀를 재확인하고 release PASS와 #45 handoff를 고정했다.

최종 통합 검증:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
npm run verify:npm-release
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

- OK — Node 487개 중 481 pass, 6 integration setting 미구성 skip, fail 0.
- OK — Playwright 16/16.
- OK — client, Cloud Run, Sites, production build와 full-stack/production
  artifact verifier.
- OK — hosting matrix와 Cloud Run fallback 독립성.
- OK — current source 13-entry package verifier와 isolated local install
  smoke. Stage 5 package README 때문에 current source digest는 immutable
  registry `0.1.0` digest와 의도적으로 구분된다.
- OK — final public scan 1,248 blobs, 221 commits, blocker 0, review 12.
- OK — Stage 6 branch CI
  [run 30363497376](https://github.com/postmelee/codex-usage-profile/actions/runs/30363497376)의
  Node 20/22/24 matrix가 모두 성공했다.

## 외부 변경과 종료 상태

- GitHub repository: public, default branch `devel`
- npm: public `codex-usage-profile@0.1.0`, `latest=0.1.0`
- canonical tag: `codex-usage-profile-v0.1.0` 보존
- publish provenance tag:
  `codex-usage-profile-v0.1.0-recovery.1`
- future publisher: trusted GitHub Actions, staged publish only
- first-publish npm token: revoked
- GitHub `npm-publish` `NPM_TOKEN`: deleted
- production Site: saved version 7, public, maintenance disabled, service normal
- smoke owner/session/token/D1/R2/local artifact: exact cleanup 완료
- #45 handoff:
  [comment 5104712499](https://github.com/postmelee/codex-usage-profile/issues/45#issuecomment-5104712499)
- #43: trigger 대기 open 상태, 무변경

## 잔여 위험과 후속 작업

### 잔여 위험

- published `0.1.0`은 immutable이라 Stage 5 이후 source README 문구를
  포함하지 않는다. 기능·보안 결함은 아니며 문서나 기능 변경은 같은 version을
  덮어쓰지 않고 patch release로 처리한다.
- future tokenless staged publishing의 npm 웹 2FA 승인까지 포함한 전체 흐름은
  다음 실제 version release에서 다시 검증해야 한다.
- Postgres와 external MinIO/S3 설정이 필요한 6개 integration test는 환경
  미구성으로 skip됐다. D1/native R2 production 경로와 Cloud Run fallback
  local contract는 통과했다.
- maintainer-owned Stage 5 smoke는 fresh third-party user의 clean machine,
  OAuth UX, backup/restore, retention과 비용 0원 장기 관찰을 대신하지 않는다.
- Sites beta 가격, quota와 정책은 변할 수 있다. 명확한 trigger 전에는 #43
  fallback resource를 만들지 않는다.

### 후속 작업 후보

- [#45](https://github.com/postmelee/codex-usage-profile/issues/45):
  fresh-user Sites production 전체 흐름 및 보안 QA. Task #44 merge 뒤 시작한다.
- [#43](https://github.com/postmelee/codex-usage-profile/issues/43):
  실제 비용·quota·정책·장애 trigger가 발생한 경우에만 Cloud Run fallback을
  평가한다.
- public repository hardening은 별도 task에서 Dependabot, dependency graph와
  branch/tag rule 필요성을 검토한다.

## 작업지시자 승인 요청

- 6개 Stage, public npm `0.1.0`, production smoke/cleanup, release PASS와
  #45 handoff 결과를 승인해 Task #44 PR을 검토·merge해 달라.
