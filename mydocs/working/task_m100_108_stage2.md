# Task #108 Stage 2 보고서 — Gate A1 project 생성과 canonical source 구현

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 2

## 단계 목적

canonical production Site를 owner-only·undeployed 상태로 한 번만 생성하고, production과
stage5를 같은 source에서 안전하게 패키징할 수 있는 nonsecret target registry와 fail-closed
materializer를 구현한다. 동시에 CLI/UI 기본 origin을 canonical production으로 전환한
`codex-usage-profile@0.1.2` 후보를 만들되, stage5는 명시적 `--server` override로만 남긴다.
README Markdown의 fixed URL 계약과 공유 링크·다섯 SNS target의 revision 계약은 그대로 보존한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `.openai/hosting.json` | canonical production project와 `DB`·`PROFILE_MEDIA` logical binding을 기록했다. |
| `.openai/hosting-targets.json` | production·stage5의 서로 다른 project/origin과 동일한 logical binding을 기록한 nonsecret registry를 추가했다. |
| `scripts/materialize-sites-target.mjs` | clean exact source SHA, canonical manifest, target identity, repository 밖 archive를 검증하고 임시 packaging root에서 공식 Sites helper를 호출하는 materializer를 추가했다. |
| `scripts/__tests__/materialize-sites-target.test.js` | 두 target 패키징, canonical manifest 무변경, project/origin drift, dirty source와 repository 내부 archive 거부를 검증했다. |
| `scripts/verify-sites-production-artifact.mjs`와 test | 예상 project ID를 선택적으로 강제해 다른 target artifact를 거부하도록 보강했다. |
| `package.json` | `package:sites-target` 실행 진입점을 추가했다. |
| `packages/codex-usage-profile-cli/package.json`, `src/cli.js`, `src/config.js`, test | CLI 후보를 `0.1.2`로 올리고 기본 service origin을 canonical production으로 변경했다. |
| `package-lock.json`, `scripts/verify-npm-release.mjs`, `scripts/smoke-npm-package-local.mjs`와 test | lock, local pack, 설치 smoke와 release verifier를 `0.1.2`/canonical origin 계약에 맞췄다. |
| `src/profile-ui/deviceApproval.js`, `src/profile-ui/__tests__/production-origin-contract.test.js` | production에서는 기본 submit 명령, stage5에서는 명시적 `--server` 명령을 사용하도록 고정했다. |
| `README.md`, `packages/codex-usage-profile-cli/README.md`, `docs/cli-submit.md` | canonical production 기본 origin과 아직 publish 전인 `0.1.2` 후보 사용 경계를 반영했다. |
| `docs/readme-card.md` | README fixed href/src와 revision share 경계를 canonical origin 기준으로 보정했다. |
| `docs/sites-operations.md`, `docs/production-hosting.md` | dual-target registry, 외부 packaging, Gate A1 owner-only baseline과 환경별 data/OAuth 비공유 runbook을 추가했다. |
| `mydocs/working/task_m100_108_stage2.md` | Gate A1 원격 결과, 구현·검증, 잔여 Gate와 Stage 3 handoff를 기록했다. |
| `mydocs/orders/20260818.md` | #108을 Stage 2 완료·Stage 3 승인 대기로 갱신했다. |

`docs/npm-release.md`는 아직 실제 npm publish 결과가 없으므로 구현계획대로 수정하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

기존 Account Usage, 카드 렌더링, 인증, 저장소와 공개 프로필 API는 변경하지 않았다. hostname,
CLI patch 후보, Sites target packaging과 운영 문서만 최소 범위에서 수정했다.

- README Markdown은 계속 `href=/api/share/{handle}`와 query 없는
  `src=/u/{handle}/card.png`를 사용한다.
- submit 또는 카드 설정 저장 전후 README Markdown은 byte 단위로 동일하다.
- 같은 동작 뒤 공유 링크와 X·LinkedIn·Threads·Facebook·Reddit target만 새 timestamp
  revision 경로로 변경된다.
- production은 CLI/UI 기본 origin이고 stage5는 explicit `--server` override다.
- tracked canonical manifest는 production 값만 유지하며 stage5 패키징 때문에 바꾸지 않는다.
- production·stage5는 project/origin만 registry에서 분리하고 logical binding 이름만 공유한다.
  D1/R2 physical resource, OAuth, session, CLI token과 사용자 data의 공유를 가정하지 않는다.

## 검증 결과

실행 명령:

```bash
node --test \
  packages/codex-usage-profile-cli/test/config.test.js \
  packages/codex-usage-profile-cli/test/cli.test.js \
  src/profile-ui/__tests__/deviceApproval.test.js \
  src/profile-ui/__tests__/production-origin-contract.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  scripts/__tests__/materialize-sites-target.test.js \
  scripts/__tests__/smoke-npm-package-local.test.js \
  scripts/__tests__/verify-npm-release.test.js
npx playwright test tests/profile-ui.spec.js
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
git status --short
```

Sites read-only postcheck:

- `get_site`
- `list_site_versions`
- `get_environment_variables`

결과:

- **OK — Gate A1 one-shot create**: `title=Codex Usage Profile`,
  `slug=codex-usage-profile`, `description=Canonical production Site for Codex Usage Profile.`로
  `create_site`를 정확히 한 번 호출했다. 생성 응답 wrapper의 결과 위치를 잘못 해석해 즉시 ID를
  꺼내지 못했지만, 호출을 재시도하지 않고 read-only `list_sites`의 exact slug 결과로 생성 성공을
  회수했다. canonical production project는
  `appgprj_6a83ecc3c4c08191bda7f14d7c26c974`다. 반환 source credential은 사용·저장·출력하지 않았다.
- **OK — owner-only undeployed baseline**: project는 active, current role owner, access mode custom,
  access revision 1이다. allowed user는 owner 1명뿐이고 editor/group/external visitor는 0명이다.
  latest version은 0, saved version 목록은 0개, live/preview URL은 없으며 Sites auth client만 존재한다.
- **OK — environment 무변경**: production environment revision은 0이고 key는 0개다. source push,
  save/deploy, access/environment/OAuth 변경과 D1/R2 조회·생성, stage5/data 변경은 수행하지 않았다.
- **OK — target identity guard**: registry는 production과 stage5의 project/origin 중복을 거부한다.
  materializer는 canonical manifest가 production target과 다르거나 source가 dirty/HEAD 불일치이거나
  archive가 repository 내부이면 패키징을 시작하지 않는다. role-specific manifest는 repository 밖
  임시 root와 staged `dist`에만 기록되고 canonical manifest는 그대로 남는다.
- **OK — focused Node contract**: 55 pass, 0 fail. production 기본 origin, stage5 explicit override,
  README 완전 동일과 공유 링크·다섯 SNS revision 변경을 모두 포함한다.
- **OK — focused/전체 E2E**: `tests/profile-ui.spec.js` 101 pass, 0 fail을 두 차례 확인했다.
  Share Studio의 submit 전후 README fixed 계약과 다섯 SNS target revision 갱신 E2E가 통과했다.
- **OK — 전체 Node 회귀**: 830 tests 중 824 pass, 6 skip, 0 fail이다. 분리 worktree의 불완전한
  `node_modules` 때문에 최초 카드 폰트 테스트가 실패한 것은 lockfile 기준 `npm ci --offline`으로
  의존성을 복구했고, Miniflare local port가 필요한 전체 실행은 허용된 로컬 환경에서 재실행해
  최종 통과했다. source 수정은 필요하지 않았다.
- **OK — production build**: client 8 files, migration `0001..0005`, worker 2 files,
  compressed 2,168,367 bytes, raw 4,012,461 bytes다.
- **OK — production artifact**: 총 5,152,077 bytes이며 production project,
  `DB`·`PROFILE_MEDIA`, migration 5개와 hosted linkage 검증을 통과했다.
- **OK — npm candidate**: `codex-usage-profile@0.1.2`, 14 entries, packed 18,465 bytes,
  unpacked 63,839 bytes다. local isolated install smoke는 6 checks를 통과했고 package integrity와
  shasum은 verifier 결과와 일치했다.
- **OK — public surface scan**: blocker 0이다. review finding은 기존 historical 문서·fixture와
  공개 commit metadata 범주이며 Task #108의 새 credential/secret 노출은 없다.
- **OK — working tree checks**: `git diff --check`는 오류가 없고 단계 산출물만 변경됐다.

## 잔여 위험

- production D1/R2는 아직 attach·provision되지 않았다. connector가 physical ID를 노출하지
  않으므로 exact-main Stage 4 Gate A2에서 empty baseline, migration과 stage5 교차 영향 부재로
  application-level 분리를 검증해야 한다.
- production GitHub OAuth application/secret, maintenance/session secret과 runtime environment는
  아직 만들거나 설정하지 않았다. stage5 값을 복사하지 않고 Stage 4 승인 Gate에서 새로 구성한다.
- canonical project에는 source/version/deployment가 없다. Stage 3 exact-main release와 Stage 4
  private save/deploy가 끝날 때까지 canonical public URL은 서비스되지 않는다.
- official package helper를 사용하는 clean exact-commit archive 생성은 Stage 4 detached main
  packaging 때 materializer의 실제 preflight로 최종 증명한다. Stage 2에서는 helper 호출 경계와
  manifest 조립을 unit test, 기존 artifact verifier와 production build로 검증했다.
- npm `0.1.2`는 후보일 뿐 publish/tag되지 않았다. production public smoke와 Gate C 전에는
  `@latest`가 계속 `0.1.1`이므로 stage5 기존 경로를 닫지 않는다.

## 다음 단계 영향

- Stage 3는 이 Stage 2 commit을 `devel`에 합치는 non-closing checkpoint PR을 만들고, 작업지시자
  merge 뒤 `devel → main` release PR로 exact source tree를 확정한다.
- checkpoint와 release PR은 Issue #108을 close하지 않는다. PR별 merge는 작업지시자가 직접
  승인·수행하며, merge 전까지 Sites·npm 원격 mutation은 없다.
- Stage 4는 merged exact `main`의 detached clean worktree에서 build·target materialize·package한
  artifact만 production project에 save/private deploy한다.
- production D1/R2 attach, migration, environment/OAuth, private smoke, public access, npm publish는
  모두 Stage 4의 개별 Gate 승인 대상이다.
- stage5는 production `@latest` E2E가 끝날 때까지 기존 public 상태를 유지하며 Stage 5 전에는
  owner-only test 전환이나 data cleanup을 수행하지 않는다.

## 승인 요청

- Stage 2 산출물, Gate A1 결과와 검증을 승인하면 Stage 3의 non-closing checkpoint integration과
  exact-main release 절차로 진행한다.
