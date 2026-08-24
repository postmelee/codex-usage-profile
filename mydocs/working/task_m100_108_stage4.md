# Task #108 Stage 4 보고서 — production cutover와 CLI 0.1.3 release 검증

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 4

## 단계 목적

canonical production Site를 exact approved `main` source로 private 배포한 뒤 public으로
전환하고, production 기본 origin을 담은 CLI patch를 trusted publisher와 maintainer 2FA로
공개한다. 공개 뒤 사용자 README·Device Approval·favicon 보정을 exact main version 2와
immutable `codex-usage-profile@0.1.3`에 반영하고, 실제 clean login/status/submit과
fixed README/revision share 계약을 production에서 검증한다.

## 산출물

| 파일 또는 원격 산출물 | 변경 요약 |
|---|---|
| production Site version 2 | source `fae45095ddfe24a3fb03c4ec91a6e2a20900e005`, public access revision 10, environment revision 2로 배포했다. |
| `codex-usage-profile@0.1.3` | exact main annotated tag, trusted publisher stage, maintainer 2FA와 SLSA provenance를 거쳐 `latest`로 공개했다. |
| `docs/npm-release.md` | `0.1.3` source, workflow, integrity, provenance와 clean production smoke 실측 결과를 추가했다. |
| `mydocs/plans/task_m100_108_impl.md` | 제거한 maintenance secret을 재생성하지 않는 final safe baseline 검증으로 보정했다. |
| `mydocs/orders/20260824.md` | Stage 4 완료와 Stage 5 승인 대기 상태를 기록했다. |
| `mydocs/working/task_m100_108_stage4.md` | deployment, npm, application contract와 잔여 위험을 기록했다. |

원격 production 결과:

- project: `appgprj_6a83ecc3c4c08191bda7f14d7c26c974`
- saved version: 2, 26 files, content hash
  `sha256:4135edcfbe1323a74bdd103296e141c957989dd3ef7a60d3477a186558f15ebe`
- deployment: `appgdep_6a8bb8b985c081919a80247f5496ca67`, `succeeded`
- canonical origin: `https://codex-usage-profile.meleeisdeveloping.chatgpt.site`
- exact source tree: `e55d36ea9326d39f0012a0487c6031dd483fbed8`

## 본문 변경 정도 / 본문 무손실 여부

Stage 4.1~4.3의 제품 source, 공개 README와 Site icon은 PR #112 merge commit
`fae45095ddfe24a3fb03c4ec91a6e2a20900e005`에 고정됐다. `local/task108`의 Stage 4.3 tree와
exact main tree는 byte-for-byte 동일하며, 본 보고 단계에서는 제품 코드와 사용자 README를
다시 수정하지 않았다. `docs/npm-release.md`는 후보 설명을 실제 immutable release 결과로
최소 보정했다.

실제 production submit 전후 README Markdown은 byte 단위로 완전히 같았다. href는 고정
`/api/share/postmelee`, img src는 query 없는 `/u/postmelee/card.png`를 유지했다. 공유 링크와
다섯 SNS target만 revision `1787236335891`에서 `1787542559516`으로 바뀌었다.

## 검증 결과

실행 명령:

```bash
npm ci
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
node -e 'Promise.all([fetch("https://codex-usage-profile.meleeisdeveloping.chatgpt.site/healthz").then((response) => { if (response.status !== 200) throw new Error("health"); }), fetch("https://codex-usage-profile.meleeisdeveloping.chatgpt.site/__ops/profile-maintenance", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((response) => { if (response.status !== 404) throw new Error("maintenance boundary"); })]).catch(() => process.exit(1))'
npm view codex-usage-profile@0.1.3 --json
npm view codex-usage-profile dist-tags --json
gh run list --workflow publish-npm.yml
git diff --check
git status --short
```

Sites read-only 검증:

- `get_site`, `get_site_version`, `get_deployment_status`
- `get_environment_variables`, `read_database_overview`
- `get_site_worker_logs`

결과:

- **OK — 전체 회귀**: local listener가 필요한 D1 concurrency를 포함한 Node test는
  836 pass, 6 skip, 0 fail이다. Playwright E2E는 101 pass이며 submit 전후 README 고정과
  공유 링크·다섯 SNS target revision 갱신을 포함한다.
- **OK — production build/artifact**: full-stack build 뒤 12 client files, 5 migrations,
  production project와 `DB`·`PROFILE_MEDIA`·`ASSETS` 3 binding이 검증됐다.
  production artifact는 6,757,336 bytes다.
- **OK — public release surface**: 2,977 blobs, blocker 0이다. 기존 review 69건과
  synthetic credential/binary info만 남았다.
- **OK — exact deployment**: Site는 active, version 2/source `fae45095...`, deployment
  `succeeded`, public access revision 10, environment revision 2다. anonymous landing,
  health와 favicon 4종은 200이고 unauthenticated `/api/auth/me`는 401이다.
- **OK — runtime resources**: D1 binding은 exact `DB`이고 schema migration을 포함한 12개
  application table이 누락·절단 없이 관찰됐다. R2 logical binding은 `PROFILE_MEDIA`이며
  owner profile/card와 revision social image가 200으로 로드됐다. physical provider ID는
  추정하거나 기록하지 않았다.
- **OK — maintenance final safe baseline**: service는 normal, maintenance mode는 disabled,
  maintenance token key는 absent다. health는 200, 무인증 maintenance POST는 generic 404다.
  private Gate에서 제거한 secret을 final 검증을 위해 재생성하지 않았다.
- **OK — production identity/CLI**: owner OAuth/session과 profile이 정상이고 clean
  `npx codex-usage-profile@latest` login/status가 production 기본 origin으로 연결됐다.
  Device Approval은 `npx codex-usage-profile@latest submit`만 안내했다.
- **OK — submit/share contract**: production submit은 `accepted`, non-idempotent였고
  `capturedAt=2026-08-24T03:35:45.228Z`, `uploadedAt=2026-08-24T03:35:46.261Z`다.
  README는 submit 응답과 후속 status 모두 이전 값과 완전히 같고, X·Threads·LinkedIn·
  Facebook·Reddit target은 모두 새 revision을 사용했다. 새 share route와 OG/X image는 200,
  `summary_large_image`와 같은 revision을 제공했다. 외부 게시물은 만들지 않았다.
- **OK — disposable credential cleanup**: 검증용 device-login token은 Settings에서 폐기했고
  API는 이후 status를 410으로 거부했다. 격리된 local credential은 logout 뒤
  `No credential found`로 확인했으며 Settings token count는 0/3이다.
- **OK — npm release**: local verifier는 `0.1.3`, 14 entries, packed 17,237 bytes,
  exact integrity와 shasum으로 통과했다. registry `latest=0.1.3`, `gitHead=fae45095...`,
  SLSA provenance가 일치하고 Actions run
  [`32601426789`](https://github.com/postmelee/codex-usage-profile/actions/runs/32601426789)은
  Node 20/22/24 verify와 staged publish를 성공했다.
- **OK — bounded logs**: 최근 error-only 항목은 검증에서 의도한 auth 401,
  hidden maintenance 404와 revoked token 410뿐이다. 대응 Worker invocation outcome은 ok이고
  5xx, credential, request body 또는 provider exception 노출은 없다.

## 잔여 위험

- `npm ci` audit는 기존 dependency graph에서 1 low, 8 high를 보고했다. 자동 `audit fix`나
  major 변경은 이 Stage에서 수행하지 않았으며 별도 dependency 검토가 필요하다.
- X·LinkedIn을 포함한 provider cache refresh 시간은 application 계약으로 보장할 수 없다.
  이번 Stage는 새 revision target과 OG/X image 응답을 검증했으며 실제 게시물은 만들지 않았다.
- stage5는 아직 public validation 상태와 기존 synthetic/test state를 유지한다. owner-only 전환과
  data disposal은 Stage 5 Gate D/E 승인 전에는 수행하지 않는다.
- `packages/.DS_Store`는 작업지시자 측 추적되지 않은 파일로 판단해 수정·삭제·커밋하지 않는다.

## 다음 단계 영향

- Stage 5는 production version 2와 npm `latest=0.1.3`을 read-only baseline으로 먼저 재확인한다.
- Gate D 승인 뒤에만 stage5를 owner-only로 바꾸고 exact approved main을 stage5 target
  materialization으로 배포한다. canonical tracked manifest를 stage5 값으로 바꾸지 않는다.
- Gate E는 production 비공유, exact cleanup plan/export/digest/count를 제시하고 별도 승인을
  받은 뒤에만 기존 stage5 test data를 삭제한다.
- production은 public·service normal·maintenance disabled 상태를 유지한다.

## 승인 요청

- Stage 4의 production cutover, CLI `0.1.3` release, fixed README/revision share와 credential
  cleanup 결과를 승인하면 Stage 5 Gate D read-only 입력 준비로 진행한다.
