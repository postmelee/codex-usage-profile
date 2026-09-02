# Task #144 Stage 1 완료보고서 — exact candidate와 Local certification

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 1

## 단계 목적

PR #140, #142, #143을 포함하는 승인된 `devel` 후보
`aaf997720f296265c8b306840f0eb8af67b08dfb`가 추가 merge 없이 유지되는지 고정하고,
원격 상태를 바꾸지 않은 채 exact detached source에서 Task #141 light/dark social geometry와
Task #39 browser GIF를 포함한 전체 release 계약을 검증했다.

이 Stage는 `devel → main` release PR, Sites source push·version save·deployment와 npm mutation을
수행하지 않는 Local certification Gate다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_144_stage1.md` | candidate provenance, 전체 local 검증, target archive dry-run과 잔여 위험 기록 |
| `mydocs/orders/20260828.md` | #144를 Stage 1 완료·Stage 2 승인 대기 상태로 갱신 |

제품 source, package, migration, hosting manifest와 공식 제품 문서는 변경하지 않았다. build output,
dependency와 target archive는 추적 파일에 추가하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

코드·제품 문서 본문 변경은 없다. 승인된 candidate를 그대로 검증했으며 다음 경계를 확인했다.

- `origin/main`: `27e8705fdc152534a4e4b726cac32f625a3c7763`
- `origin/devel`: `aaf997720f296265c8b306840f0eb8af67b08dfb`
- first-parent merge는 PR #140, #142, #143 세 개로 승인 범위와 일치
- `db/migrations/`, `.openai/hosting.json`, `.openai/hosting-targets.json`, CLI package version의
  `main...devel` 변경 없음
- public npm은 `latest=0.1.4`, versions `0.1.0`~`0.1.4`, Git tag
  `codex-usage-profile-v0.1.4` 유지

## 검증 결과

실행 명령:

```bash
git fetch origin
git rev-parse origin/main origin/devel
git log --first-parent --reverse --oneline origin/main..origin/devel
git diff --check origin/main...origin/devel
git diff --name-status origin/main...origin/devel -- db/migrations .openai/hosting.json .openai/hosting-targets.json packages/codex-usage-profile-cli/package.json
npm ci --ignore-scripts --no-audit --no-fund
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/shareStudio.test.js
npm test -- --test-concurrency=1
node --test --test-concurrency=1 {Node 24 비-D1 115개 파일}
npx --yes node@22 --test --test-concurrency=1 {real-workerd D1 6개 파일}
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
npm run package:sites-target -- --target production --archive {temporary_archive} --source-sha aaf997720f296265c8b306840f0eb8af67b08dfb --package-helper {sites_package_helper} --expected-project-id appgprj_6a83ecc3c4c08191bda7f14d7c26c974
npm run package:sites-target -- --target stage5 --archive {temporary_archive} --source-sha aaf997720f296265c8b306840f0eb8af67b08dfb --package-helper {sites_package_helper} --expected-project-id appgprj_6a62f58721788191a7cd82f37320f244
npm view codex-usage-profile dist-tags versions --json
git status --short
```

결과:

- OK — candidate SHA, first-parent merge 세 개와 승인 범위가 정확히 일치했다. `git diff --check`와
  migration/hosting/package guard가 빈 출력으로 통과했다.
- OK — clean install은 lockfile 변경 없이 128 packages를 설치했다.
- OK — Task #141 focused renderer는 34/34 통과했다. social 2400×1260, light neutral surface·outline,
  dark transparent padding, shared geometry와 standalone card alpha 무회귀를 확인했다.
- OK — Task #39 focused GIF·Share Studio는 43/43 통과했다. 96 phases, golden seam, 20fps loop,
  global palette, representative 15MB 한도, Worker progress/error/transfer와 dark/light·en/ko를 확인했다.
- OK — 로컬 Node 24의 전체 명령은 알려진 #135와 같은 real-workerd 정지로
  `d1-concurrency.test.js` 진입 뒤 중단했다. D1 6개를 제외한 115개 파일은 고유 881 tests 중
  875 pass, 환경 조건부 6 skip, assertion fail 0이다. sandbox loopback `EPERM` 네 건은 로컬 포트가
  허용된 동일 Node 24 재실행에서 관련 두 파일 10/10이 통과했다.
- OK — 지원 범위 Node 22의 real-workerd D1 6개 파일은 36/36 통과했다. concurrency,
  maintenance, migration exact set, rate limiting과 store contract를 모두 판정했다.
- OK — Playwright Chromium E2E 109/109가 통과했다. GIF 생성·download·retry·cancel·mobile exclusion,
  light/dark card 설정, Share Studio, Profile과 기존 사용자 흐름을 포함한다.
- OK — production build는 Worker 63 modules와 client 1,839 modules를 변환했다.
- OK — full-stack verifier는 client 14 files, Worker 2 files와 migration 6개를 확인했다.
  production verifier는 project/binding과 7,919,190-byte artifact를 승인했다.
- OK — npm verifier는 기존 `codex-usage-profile@0.1.4` 14-entry tarball의 packed 17,614 bytes,
  unpacked 63,363 bytes와 기존 integrity·shasum 일치를 확인했다.
- OK — public release scan은 14 refs, 3,328 blobs에서 blocker 0이다. review 72건 중 새 large blob은
  PR #143에서 승인·검증한 bounded GIF golden asset이며 나머지는 기존 이력·합성 fixture 분류다.
- OK — production target archive는 source `aaf9977...`, production project/origin, 5,569,845 bytes,
  SHA-256 `cf713163602b8f90c2b158db51e701274bffcb01629d1f96be9c1147590b5c02`로 materialize됐다.
- OK — stage5 target archive는 같은 source, 별도 stage5 project/origin, 5,569,835 bytes,
  SHA-256 `ba41d668b1553d368d08250cc4c24f575e89f29faffec00cd1dff632cb21e39e`로 materialize됐다.
  두 target의 project/origin은 분리되고 migration 1..6과 product source는 동일하다.
- OK — npm registry/tag는 기존 `0.1.4` 상태를 유지하며 Sites/npm/GitHub release 원격 mutation은 0건이다.

## 잔여 위험

- Node 24 real-workerd D1 runner 정지 #135는 이번 배포 task의 수정 범위가 아니다. Node 24 비-D1
  875 pass·6 skip과 지원 Node 22 D1 36/36으로 release 계약을 판정했으며 release PR CI 상태도
  Stage 2에서 별도로 확인해야 한다.
- Stage 1 archive는 approved `devel` candidate의 local dry-run이다. Stage 2 exact main merge 뒤
  Stage 3~4에서 새 exact main SHA로 target별 archive를 다시 만들어야 한다.
- public scan의 expected binary golden은 blocker가 아니지만 artifact 크기와 browser GIF memory 경계는
  Stage 3/5 smoke에서 계속 확인한다.
- 외부 crawler cache와 composer 배경은 Local certification 대상이 아니다. Stage 5에서도 application
  pixel/metadata와 provider UI 결과를 분리해 판단해야 한다.

## 다음 단계 영향

- Stage 2는 candidate가 여전히 `origin/devel`과 같은지 재확인한 뒤 `devel → main` release PR을 만든다.
- release PR에는 PR #140/#142/#143, Stage 1 검증, npm 재게시 없음과 Sites mutation 0건을 기록한다.
- required checks와 review가 통과한 경우에만 merge commit으로 병합하고 candidate와 `origin/main` tree를
  exact 비교한다.
- Stage 2에서는 Sites source push/save/deploy와 npm mutation을 실행하지 않는다.

## 승인 요청

- Stage 1 candidate provenance, Local certification, Node 24/22 분리 검증과 target archive dry-run 결과를
  승인하면 Stage 2 `devel → main` exact release PR 생성·검증·merge로 진행한다.
