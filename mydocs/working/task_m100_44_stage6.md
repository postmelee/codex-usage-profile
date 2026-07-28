# Task #44 Stage 6 보고서

GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
구현계획서: [`task_m100_44_impl.md`](../plans/task_m100_44_impl.md)
Stage: 6

## 단계 목적

public npm `codex-usage-profile@0.1.0`의 registry artifact, provenance,
clean install, production origin과 전체 회귀 상태를 최종 재확인한다.
Task #44의 release 판정을 고정하고, maintainer-owned smoke와 fresh-user
whole-flow의 경계를 분리해 production QA Issue #45에 넘긴다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `docs/npm-release.md` | npm `0.1.0` PASS 판정, registry/provenance, clean install, license와 patch/deprecation 정책 기록 |
| `mydocs/orders/20260728.md` | Stage 6 완료·보고 승인 대기로 상태 갱신 |
| `mydocs/working/task_m100_44_stage6.md` | Stage 6 검증, 잔여 위험과 최종 보고 진입 조건 기록 |
| [Issue #45 handoff comment](https://github.com/postmelee/codex-usage-profile/issues/45#issuecomment-5104712499) | exact package, production origin, provenance, Stage 5 cleanup과 독립 fresh-user QA 범위 전달 |

## 본문 변경 정도 / 본문 무손실 여부

runtime source, npm registry version·dist-tag·artifact, Git tag, GitHub
workflow, Sites version/environment/access와 production data는 변경하지
않았다. 기존 npm 운영 절차를 보존하고 `docs/npm-release.md`에 검증된
Stage 6 판정과 handoff 경계만 추가했다.

현재 source candidate는 Stage 5 package README 문구를 포함하므로
immutable registry `0.1.0` tarball과 digest가 다르다. 이는 같은 version을
재게시할 후보가 아니며, 다음 변경은 patch version 정책을 따른다.

## registry와 public repository 판정

- package access는 `public`, versions는 `0.1.0` 하나, `latest=0.1.0`이다.
- registry artifact는 13 files, unpacked 49,887 bytes, SHA-1
  `a1d30872a6677e9b781e64e14f7ad9040ee92e0d`, SHA-512
  `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==`
  로 Stage 4 결과와 일치한다.
- exact `0.1.0`과 `@latest` install은 version `0.1.0`, executable
  `codex-usage-profile`, production 기본 origin과 exact analyzer
  `0.2.0`을 동일하게 제공한다.
- 두 installed package의 registry signature와 attestation이 모두
  검증됐다. CLI attestation subject는
  `pkg:npm/codex-usage-profile@0.1.0`, source는 public
  `postmelee/codex-usage-profile`, recovery tag
  `codex-usage-profile-v0.1.0-recovery.1`, commit
  `f10ad2cb1a38568371c5467dc3a25ce29df7ae8f`, workflow
  `.github/workflows/publish-npm.yml`, successful run
  [`30352705791`](https://github.com/postmelee/codex-usage-profile/actions/runs/30352705791)이다.
- package homepage, repository, issues/support와 README의 공식 문서 링크는
  public GitHub repository와 default branch `devel`을 가리킨다.
- package tarball은 MIT `LICENSE`와 `license: MIT` metadata를 포함한다.
  repository-wide MIT root `LICENSE`는 `publish/task44`에 있으므로 GitHub
  default branch의 `licenseInfo`는 Task #44 PR merge 전까지 `null`이다.
  따라서 repository 전체 license 표시 완료는 PR merge에 의존한다.
- GitHub `npm-publish` environment의 secret 목록은 비어 있다.
  first-publish token은 폐기됐고 tokenless staged publishing 전환 run
  [`30354405611`](https://github.com/postmelee/codex-usage-profile/actions/runs/30354405611)도
  성공 상태다.
- public release scan은 1,245 blobs와 220 commit metadata를 검사해
  blocker 0, Gate A 승인 review 12를 유지했다.

## production과 handoff 상태

- Sites project는 active/public, latest saved version 7이고 production
  origin은
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`다.
- environment revision 13은 `PROFILE_MAINTENANCE_MODE=disabled`,
  `PROFILE_SERVICE_MODE=normal`이다.
- landing과 `/healthz`는 `200`, Stage 5에서 exact cleanup한
  `postmelee` public JSON과 card는 `404`다.
- Issue #45는 open이며 #51 public cutover와 #44 npm publish를 선행조건으로
  유지한다. handoff comment에 package/version, production origin,
  provenance, maintainer smoke, token/session/D1/R2 cleanup과 Stage 6
  regression을 기록했다.
- Issue #43은 open fallback trigger 대기 상태를 유지했고 내용과 상태를
  변경하지 않았다.

## 검증 결과

실행 명령:

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
npm view codex-usage-profile@0.1.0 --json
npm view codex-usage-profile dist-tags --json
npm access get status codex-usage-profile --json
npm audit signatures
git diff --check
```

추가 검증:

```text
empty HOME/XDG/npm cache
  -> exact 0.1.0 install/version/bin/help
  -> @latest install/version/bin
  -> analyzer 0.2.0 version/resolved/integrity
  -> registry signature/attestation subject/source/workflow
public GitHub repository/default branch/package links/license
Sites saved version/access/environment + landing/health/private 404
Issue #43/#45 state and #45 handoff boundary
```

결과:

- OK — Node test 487개 중 481개 통과, 6개 integration setting 미구성
  skip, 실패 0건.
- OK — Playwright E2E 16/16 통과.
- OK — 기본, Cloud Run, Sites와 production build 통과.
- OK — full-stack와 production Sites artifact verifier 통과. production
  artifact 5,400,662 bytes, client files 7, expected bindings 3이다.
- OK — hosting matrix에서 Cloud Run canonical app, sample-only Sites
  mirror와 fallback 독립성 통과.
- OK — current source candidate verifier와 local package smoke는 13 entries를
  검증했다. 이 digest는 Stage 5 문서를 포함하므로 registry `0.1.0`
  immutable digest와 구분했다.
- OK — registry exact/`@latest` clean install version/bin/origin과 analyzer
  exact dependency 일치.
- OK — package/analyzer registry signature와 attestation 각각 2건 검증.
- OK — public repository/package/support/docs link와 package MIT license
  일치. repository root MIT 표시는 Task #44 merge 조건으로 기록.
- OK — public release scan blocker 0, 기존 승인 review 12.
- OK — final Sites normal mode와 public/private HTTP 경계 유지.
- OK — #45 handoff comment 게시, #43 상태 무변경.
- OK — `git diff --check` 통과.

## 잔여 위험

- GitHub default branch `devel`에는 Task #44의 root `LICENSE`, final release
  문서와 Stage 5 사용자 문구가 아직 없다. Task #44 PR merge 전에는
  repository-wide MIT 표시와 최신 문서가 완결되지 않으므로 #45 시작 조건을
  merge 이후로 유지한다.
- published `0.1.0` tarball README는 immutable이라 Stage 5의 현재 상태
  문구를 포함하지 않는다. 기능·보안 오류는 아니며 문구 또는 기능 변경은
  patch version으로 처리한다.
- maintainer-owned smoke는 fresh-user OAuth, clean machine UX, backup/restore,
  retention과 비용 0원 장기 관찰을 대신하지 않는다. 이 판정은 #45의 독립
  release gate다.
- Sites beta의 quota, 가격과 정책은 변할 수 있다. trigger가 확인되기 전
  #43 Cloud Run fallback은 시작하지 않는다.

## 다음 단계 영향

- Stage 6은 Task #44의 마지막 구현 단계다.
- Stage 6 승인 뒤에만 `task-final-report`로 최종 보고서, 오늘할일 완료,
  `publish/task44` push와 `devel` 대상 PR 게시 절차를 진행한다.
- Task #44 merge 뒤 #45는 handoff comment의 immutable npm evidence를
  사용하되 fresh-user whole-flow를 독립적으로 다시 검증한다.

## 승인 요청

- Stage 6 release PASS 판정, 문서와 #45 handoff를 승인하면 Task #44 최종
  보고와 PR 게시 단계로 진행한다.
