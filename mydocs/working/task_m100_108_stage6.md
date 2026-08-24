# Task #108 Stage 6 보고서 — dual Site runbook과 통합 검증

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 6

## 단계 목적

Stage 1–5에서 만든 canonical production과 owner-only Stage5의 실제 상태를 최종
감사하고, Local → stage5 → production 승격·일시 공개·rollback·data disposal 경계를
다음 release가 재사용할 수 있는 운영 runbook으로 확정한다. canonical hostname,
fixed README/revision share, public npm `0.1.3` 계약을 공개 문서와 package 표면에서
대조하고 전체 unit/E2E/build/Sites/npm 검증으로 Task #108의 기술 수용 기준을 닫는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/sites-operations.md` | production version 3과 Stage5 version 36 실측 기준, Local → stage5 → production 6단계 승격, remote 변경별 stop/rollback, temporary-public crawler와 #125 handoff를 확정했다. |
| `docs/production-hosting.md` | migration 1–6, exact-main provenance, 두 project/D1/R2/OAuth/secret/identity 비공유와 production deletion E2E 위험 수용을 현재 상태로 보정했다. |
| `docs/readme-card.md` | canonical production CLI를 실제 public `@latest=0.1.3`으로 보정하고 fixed README/revision share 계약을 유지했다. |
| `docs/npm-release.md` | 과거 Task #44의 Stage 6 판정과 현재 Task #108 Stage 6을 혼동하지 않도록 역사적 제목을 명확히 했다. |
| `mydocs/plans/task_m100_108_impl.md` | final safe state에서는 protected readiness를 호출하지 않는 실제 운영 경계와 #90 마케팅 전 Gate를 반영했다. |
| `mydocs/orders/20260824.md` | Stage 6 진행·완료 상태를 반영했다. |
| `mydocs/working/task_m100_108_stage6.md` | 문서 감사, live read-only audit, 전체 회귀와 최종 handoff를 통합했다. |

문서 감사 결과 변경하지 않은 공개 표면:

- `README.md` 172줄: production hostname, 기본 CLI, fixed README와 revision share가 이미 사용자 관점과 일치했다.
- `packages/codex-usage-profile-cli/README.md` 119줄: 내부 Stage5/`--server` 운영 설명 없이 public service와 `0.1.3` 사용자 계약이 일치했다.
- `docs/cli-submit.md` 329줄: production 기본 origin과 stage5/local explicit override, 선택적 star 상세 설명이 올바른 개발·상세 문서 경계에 있었다.

최종 live 기준:

| 역할 | version/source | access/environment | D1 |
|---|---|---|---|
| production | 3 / `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd` | public revision 10 / environment revision 4 | migration exact `[1,2,3,4,5,6]`, deletion operation 0 |
| stage5 | 36 / `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd` | custom owner-only revision 62 / environment revision 119 | migration exact `[1,2,3,4,5,6]`, 기존 `structured` operation 1·lease 없음 |

production artifact는 27 files, 5,437,440 bytes,
`sha256:fb262880766b9543f39c97be44909f2dc1b94a5ce024783afe360cc282740f47`다.
두 Site 모두 maintenance disabled, service normal, operator secret absent의 안전 종료
key set을 유지한다.

## 본문 변경 정도 / 본문 무손실 여부

제품 source, migration, runtime config, Site deployment/access/environment와 D1/R2 data는
수정하지 않았다. Stage 6 remote 작업은 Sites project/version/access/environment/D1의
read-only 조회, production anonymous HTTP, npm/GitHub metadata 조회뿐이다. Stage5의 기존
deletion operation과 production owner/session/token/media를 변경하지 않았다.

운영 문서는 낡은 현재값만 실측으로 교체하고 Task #84/#101/#44의 역사적 release 증적은
삭제하지 않았다. `README.md`, package README와 CLI 상세 문서는 실제 결과가 이미 같아서
불필요한 재작성과 npm 재배포를 만들지 않았다. 사용자 측 untracked
`packages/.DS_Store`도 수정·삭제·커밋하지 않는다.

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
npm view codex-usage-profile@0.1.3 --json
npm view codex-usage-profile dist-tags --json
git diff --check
git status --short
```

추가 read-only 검증:

- production/Stage5 `get_site`, `get_environment_variables`, `list_site_versions`
- production/Stage5 `read_database_overview`, `schema_migrations`,
  `account_deletion_operations`
- production root, `/healthz`, anonymous `/api/auth/me`, 닫힌 maintenance route
- Stage5 owner-only root와 `/healthz` platform gate
- Issue #108 수용 기준과 GitHub repository About/default branch

결과:

- **OK — unit**: 868 tests, 862 pass, 0 fail, 6 external Postgres 환경 의존 skip.
- **OK — E2E**: Playwright 101/101 pass. submit 전후 README Markdown 완전 동일과
  공유 링크·X·LinkedIn·Threads·Facebook·Reddit의 새 revision 갱신이 통과했다.
- **OK — production build**: Sites Worker/client production build가 성공했다.
- **OK — Sites artifact**: full-stack verifier는 client 12 files, migration 6 files,
  worker 2 files를 확인했다. production verifier는 expected binding 3개와 artifact
  6,779,605 bytes를 확인했다.
- **OK — npm artifact**: `codex-usage-profile@0.1.3`, 14 files, packed 17,237 bytes,
  integrity `sha512-+2RyWZMiGwSs2XM22f5aca0MU2+c41G7/xoaoREn0WgulqdOZXUFCcjGrk3Uyk0SrXS8faszQZE80noaYqFurA==`가
  registry와 일치하고 `latest=0.1.3`이다.
- **OK — public scan**: `ok=true`, blocker 0. 기존 review 69건은 문서화된 path/test
  fixture와 public commit metadata 분류이며 새 blocker가 아니다.
- **OK — live topology**: production/Stage5 version, exact source, access/environment와
  migration 1–6이 문서값과 일치했다. Stage5의 기존 structured operation은 불변이다.
- **OK — final safe HTTP**: production root/health `200`, anonymous auth `401`, 닫힌
  operator POST `404`. Stage5 root/health는 owner-only platform gate에서 `401`이다.
- **OK — remote mutation 0**: version/access/environment/D1 row를 바꾸는 Sites 도구,
  SNS 게시, data disposal과 credential 발급을 실행하지 않았다.

첫 unit/E2E 시도는 managed sandbox가 Miniflare의 사용자 Library log/cache와 loopback
listen을 차단해 각각 대기/`EPERM`이 발생했다. 같은 source를 필요한 권한 범위로 재실행해
위 결과를 얻었으므로 제품 회귀로 분류하지 않는다.

## 잔여 위험

- **Risk accepted — production account deletion E2E 미실행**: Stage 5에서 승인한 대로
  실제 production owner를 삭제하지 않았다. Task #122 Stage5 live 검증과 #125 handoff를
  비차단 근거로 유지하며 production 삭제 성공으로 기록하지 않는다.
- Stage5의 기존 `structured` deletion operation recovery·data disposal은 비차단 #125
  범위다. Task #108과 일반 retention에서 임의 정리하지 않는다.
- X·LinkedIn 등 외부 provider의 최초 이미지 처리 시간은 application이 보장하지 않는다.
  revision URL과 crawler metadata는 검증됐고 실제 게시물은 만들지 않았다.
- GitHub repository About homepage는 아직 Stage5를 가리키고 default branch는 `devel`이다.
  Issue #108이 #90의 repository metadata 전면 현행화를 명시적으로 제외하므로 이번
  Stage에서 변경하지 않았다. 본격적인 마케팅 시작 전 #90에서 운영 URL과 `main` 기준을
  정리해야 한다.
- `packages/.DS_Store`는 작업지시자 측 untracked 파일로 계속 제외한다.

## 다음 단계 영향

- Stage 6 뒤 남은 Task #108 절차는 `task-final-report`를 통한 최종 보고서, 오늘할일 완료,
  final commit과 `devel` 대상 PR 생성이다. 작업지시자 승인 전에는 시작하지 않는다.
- production은 public version 3, Stage5는 owner-only version 36을 유지한다. final report/PR은
  원격 Site·D1/R2·access/environment를 변경하지 않는다.
- Task #108 merge 뒤에는 `pr-merge-cleanup`으로 Issue/branch/worktree를 정리하고, #90을
  마케팅 전 공개 metadata Gate로 진행한다. #125는 production 공개와 독립된 Stage5 recovery다.

## 승인 요청

- Stage 6 runbook, live read-only audit와 전체 회귀 결과를 승인하면
  `task-final-report`로 Task #108 최종 보고서와 PR 게시 단계에 진행한다.
