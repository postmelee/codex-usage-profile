# Task #134 Stage 4 완료보고서 — package·Sites 통합 회귀와 release 인계

GitHub Issue: [#134](https://github.com/postmelee/codex-usage-profile/issues/134)
구현계획서: [`task_m100_134_impl.md`](../plans/task_m100_134_impl.md)
Stage: 4

## 단계 목적

Stage 1~3.1의 CLI 재인증, help, Profile 온보딩과 기기 승인 완료 링크 위계가 package·backend·renderer,
전체 브라우저 흐름과 Sites full-stack artifact를 회귀시키지 않는지 확인한다. 로컬 npm 후보가 실제
소비자 설치 환경에서 동작하는지 검증하고, 승인 범위 밖의 API·credential schema·version·hosting
설정이 변경되지 않았음을 고정해 최종 release 보고 단계에 인계한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/orders/20260825.md` | Stage 4 완료와 최종 보고 승인 대기 상태 기록 |
| `mydocs/working/task_m100_134_stage4.md` | 전체 회귀·package smoke·Sites artifact와 release 제외 범위 보고 |

제품 source와 공식 사용자 문서는 Stage 4에서 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

검증·내부 보고 단계이므로 제품 및 공식 문서 본문은 무손실이다. 빌드 전에 분리 worktree 자체
`node_modules`를 lockfile로 설치했으며 이 경로와 `dist/`는 ignore 대상이다. 미리보기용 절대경로
dependency symlink가 포함된 최초 Sites artifact는 verifier가 로컬 경로를 탐지해 거부했고, symlink를
제거한 뒤 정상 설치·재빌드하여 통과했다. repository source, lockfile과 hosting manifest는 바뀌지 않았다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
node --test --test-concurrency=1 {D1 6개 파일을 제외한 110개 test 파일}
npx --yes node@22 --test --test-concurrency=1 {real-workerd D1 6개 test 파일}
npm run test:e2e
npm run smoke:npm-package:local
npm run build:sites-fullstack
npm run verify:sites-fullstack
git diff --exit-code origin/devel...HEAD -- src/profile-backend packages/codex-usage-profile-cli/src/credentials.js packages/codex-usage-profile-cli/package.json .openai/hosting.json
git diff --check
git status --short
```

결과:

- OK — 전체 Node 계약 876건을 모두 판정했다. Node 24 비-D1 110개 파일은 840건 중 834 pass,
  환경 조건부 6 skip, fail/cancel 0이고, Node 22 real-workerd D1 6개 파일은 36/36 pass다.
- NOTE — 계획된 단일 `npm test`는 로컬 Node 24에서 기존에 보고된 real-workerd D1 장시간 정지를
  재현했다. 중복 실행을 제거한 단일 프로세스에서도 같아 중단했고, D1 파일군을 지원 대상 Node 22에서
  실행해 누락 없이 보완했다. Node 22에서 취소되는 media timeout 계약은 Node 24 비-D1 전체 실행에서
  정상 통과했다.
- OK — 전체 Playwright E2E 103/103 통과. Home, Profile, Settings, Share Studio, locale, responsive,
  motion과 승인 전 setup guide 노출·승인 후 제거 계약을 확인했다.
- OK — local npm package smoke 6개 경계를 통과했다. `codex-usage-profile@0.1.3`, packed entry 14개,
  packed 17,614 bytes이며 설치된 global/command help, credential-free status와 origin guard를 확인했다.
- OK — Sites full-stack build가 server 63 modules, client 1,834 modules를 변환했다. verifier는 hosted
  mode, client 12개 파일, Worker 2개 파일과 migration 6개를 승인했다.
- OK — 제외 경로 task diff 0, `git diff --check` 경고 0, 보고서 작성 전 working tree clean이다.

## 잔여 위험

- 로컬 Node 24의 real-workerd D1 장시간 정지는 기존 환경 호환 문제로 남는다. 이번 task가 변경한
  코드의 실패가 아니며 같은 D1 6개 파일은 Node 22에서 전부 통과했다.
- npm publish와 production deploy는 구현계획 범위에서 제외되어 실행하지 않았다. 최종 PR 이후
  별도 release gate에서 package version·배포 source를 다시 승인해야 한다.

## 다음 단계 영향

- 최종 보고 단계는 Stage 1~4 수용 기준, Stage 3.1 보정과 런타임 분리 전체 검증 결과를 종합한다.
- `task-final-report` 절차로 최종 보고서, 오늘할일 완료, 최종 커밋과 `publish/task134` PR을 준비한다.
- 최종 보고 승인 전에는 publish branch push, PR 생성, npm publish와 production deploy를 수행하지 않는다.

## 승인 요청

- Stage 4 산출물과 전체 검증 결과를 승인하면 최종 보고서 작성 및 PR 게시 단계로 진행한다.
