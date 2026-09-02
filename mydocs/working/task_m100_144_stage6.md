# Task #144 Stage 6 완료보고서 — Release provenance와 운영 handoff

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 6

## 단계 목적

Stage 5에서 공개한 exact main release의 GitHub, stage5, production, npm provenance를 읽기 전용으로
교차 대조한다. 실제 production 기준과 배포 중 확인한 public edge 수렴 조건을 공식 운영 문서에 최소
반영하고, exact main 전체 회귀를 다시 통과시켜 최종 보고서가 인계받을 기준을 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/production-hosting.md` | Task #144 production version 6, stage5 version 40, exact source·환경·migration·rollback·hosted smoke 기준으로 갱신했다. |
| `docs/sites-operations.md` | 현재 두 target의 live baseline과 terminal deployment 뒤 bounded asset/route convergence Gate를 기록했다. |
| `mydocs/working/task_m100_144_stage6.md` | release provenance, 전체 회귀, 운영 인계와 잔여 위험을 기록했다. |
| `mydocs/orders/20260902.md` | Stage 6 완료와 최종 보고서 승인 대기 상태를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, package, migration, hosting manifest, npm 릴리스 계약은 변경하지 않았다.
`docs/production-hosting.md`와 `docs/sites-operations.md`의 기존 역사·아키텍처·운영 절차는 보존하고,
Task #144에서 원격으로 관찰한 current baseline과 Stage 5에서 실제 확인한 edge convergence 조건만
추가·교체했다. `docs/npm-release.md`와 `docs/readme-card.md`는 읽기 전용 대조 대상으로 유지했다.
Stage 6에서는 GitHub, Sites, production data와 npm에 원격 mutation을 수행하지 않았다.

## Release provenance와 운영 인계

- GitHub PR #148은 `main`에 merge됐고, `origin/main`은
  `6d3e600d2d33bb7a50147075d013ddd9b945d0b1`이다. `origin/devel`과 두 branch의 tree는
  `5b3c52e384c3e057902fac5221121243393e13fe`로 정확히 같다. PR의 Node 20/22/24 check도 성공 상태다.
- stage5는 custom owner-only access revision 62, saved version 40, environment revision 131과 exact source
  `6d3e600d...`를 유지한다. migration은 `[1,2,3,4,5,6]`이다. structured·lease expired 상태의 테스트용
  account deletion operation 1건은 production blocker가 아니며, 열린 Issue #125의 별도 복구 범위로
  넘긴다. Stage 6에서 해당 operation을 변경하지 않았다.
- canonical production은 public access revision 10, saved version 6, environment revision 14와 같은 exact
  source를 유지한다. maintenance disabled, service normal, operator secret absent, migration
  `[1,2,3,4,5,6]`, account deletion operation 0건이다.
- production application rollback 후보는 saved version 5/source
  `27e8705fdc152534a4e4b726cac32f625a3c7763`, stage5 후보는 version 39/source
  `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`다. 실제 rollback은 별도 승인과 실행 시점 state 재확인
  없이는 수행하지 않는다.
- npm registry의 `latest`와 공개 version은 모두 `0.1.4`다. immutable package를 재게시하지 않았다.
- 최근 180분 Worker error-filter audit에서 stage5 event는 0건이었다. production의 25건은 모두
  info level·`outcome=ok`이고 실패 outcome, error-level, 5xx는 각각 0건이었다.
- Stage 5에서 terminal deployment 직후 이전 route가 잠시 제공된 사례를 반영해, candidate client asset과
  `/healthz`가 bounded polling으로 수렴하기 전에는 protected mutation을 보내지 않도록 공식 runbook을
  보강했다. 수렴 뒤 첫 migration이 generic `404`이면 applied migration 불변을 읽기 전용으로 확인하고
  정확히 한 번만 재시도하며, 그 밖의 경우에는 중단한다.

## 검증 결과

실행 명령:

```bash
npm ci --ignore-scripts --no-audit --no-fund
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-beam-frames.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/shareStudio.test.js
npm test -- --test-concurrency=1
node --test --test-concurrency=1 src/profile-runtime/__tests__/production-server.test.js src/profile-runtime/sites/__tests__/full-stack.test.js
npx --yes node@22 --test --test-concurrency=1 src/profile-backend/__tests__/d1-concurrency.test.js src/profile-backend/__tests__/d1-maintenance.test.js src/profile-backend/__tests__/d1-migrate.test.js src/profile-backend/__tests__/d1-rate-limiter.test.js src/profile-backend/__tests__/d1-store.test.js src/profile-runtime/sites/__tests__/maintenance.test.js
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run verify:npm-release
npm run scan:public-release
npm view codex-usage-profile dist-tags version --json
rg -n "current production|saved version|deployed source|migration|environment" docs/production-hosting.md
git diff --check
git status --short
```

결과:

- OK — exact main detached worktree에서 clean install을 완료했다.
- OK — Task #141 renderer/social focused 검증은 34/34, Task #39/#146 GIF·Share Studio focused 검증은
  54/54 통과했다. dark/light는 같은 motion·geometry 계약을 유지하고 light 전용 색 대비 golden까지
  검증됐다.
- OK — Node 회귀의 고유 test 929개는 923 pass, 6 skip, assertion failure 0건이다. Node 24 단일 runner가
  알려진 Issue #135의 real-workerd `d1-concurrency` 진입에서 정지해, non-real-workerd 875개와 지원
  Node 22 real-workerd 54개로 분리했다. sandbox loopback 제한으로 실패한 서버 test 4개는 네트워크 허용
  환경에서 해당 두 파일을 재실행해 10/10 통과했다.
- OK — Playwright 전체 E2E는 110/110 통과했다.
- OK — production build는 Worker 63 modules와 client 1,839 modules를 생성했다. Sites full-stack
  verifier는 client 15 files, Worker 2 files, migration 6개를 확인했다. production artifact verifier는
  10,901,144 bytes와 required binding 3개를 확인했다.
- OK — npm release verifier는 `codex-usage-profile@0.1.4`, 14 entries, 17,614 packed bytes,
  63,363 unpacked bytes와 기존 integrity를 재확인했다. registry `latest`와 version도 `0.1.4`다.
- OK — public release scan은 blocker 0, review 73이었다. review 항목은 기존 binary/history/test fixture
  범주이며 이번 Stage에서 신규 blocker가 생기지 않았다.
- OK — 공식 문서의 source/version/access/environment/migration·rollback 수치가 GitHub와 Sites
  read-only audit에 일치한다. 문서 diff와 whitespace 검사를 통과했고 secret 값, 개인 data, 임시 작업
  경로를 기록하지 않았다.

## 잔여 위험

- stage5의 structured·lease expired 테스트 operation 1건과 Issue #125는 아직 열려 있다. production과
  Task #144 완료 조건에는 영향을 주지 않지만, 복구·정리는 #125의 별도 승인 절차에서만 수행한다.
- Node 24 단일 runner의 real-workerd 정지는 기존 Issue #135 제약이다. 회귀 자체는 지원 Node 22 분리
  실행으로 전부 통과했으며, runner 개선은 #135 범위를 따른다.
- application rollback은 자동화하지 않았다. 필요 시 active operation, environment, migration 호환성과
  exact saved version을 다시 읽고 별도 승인을 받아야 한다.

## 다음 단계 영향

- 최종 보고서는 Task #144의 Stage 1~6, initial/replacement main 승격, stage5/production 배포와 npm
  provenance를 합쳐 작성한다.
- 최종 보고서 승인 전에는 `task-final-report`, publish branch push와 `devel` 대상 PR을 진행하지 않는다.
- 공식 운영 인계 기준은 production version 6/environment 14와 stage5 version 40/environment 131이다.

## 승인 요청

- Stage 6 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시 단계로 진행한다.
