# Task #84 Stage 5 보고서 — Gate C 이력 종료와 migration handoff

GitHub Issue: [#84](https://github.com/postmelee/codex-usage-profile/issues/84)
구현계획서: [`task_m100_84_impl.md`](../plans/task_m100_84_impl.md)
Stage: 5

## 단계 목적

Task #84 Stage 1~4의 exact-main release와 Gate C public cutover를 당시 유효한
production 이력으로 종료한다. 이후 병합된 #100·#101 계약과 현재 stage5 live
state를 read-only로 대조하고, fixed README Markdown과 revision share target을
보존한 운영 문서를 새 canonical production migration의 입력으로 넘긴다.

이번 Stage는 Sites saved version 저장·배포, access/environment 변경, D1/R2·계정·
session 삭제를 수행하지 않는 종료 audit다. live drift를 version 24 기준으로
원복하지 않는다.

## 산출물

| 파일·대상 | 변경 요약 |
|---|---|
| `docs/sites-operations.md` | Task #84 version 24 Gate C와 현재 version 33 validation 기준을 시간 순서로 분리하고 migration 승인 경계를 기록했다. |
| `docs/production-hosting.md` | exact-main release provenance, 후속 validation source drift와 새 hostname·project·storage·OAuth·CLI origin handoff를 구분했다. |
| `docs/readme-card.md` | fixed README href/src와 공유 링크·다섯 SNS의 revision target 계약을 현재 공개 validation 상태와 함께 보존했다. |
| `mydocs/working/task_m100_84_stage5.md` | read-only live snapshot, 전체 회귀, remote mutation 0건과 다음 단계 경계를 기록했다. |
| `mydocs/orders/20260818.md` | #84를 Stage 5 완료·최종 보고 승인 대기로 갱신했다. |
| stage5 Sites project | site·version·access·environment·health와 D1 migration metadata만 read-only로 확인했다. |

`README.md`, 제품 source, migration, test/build script는 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

공식 문서의 version 23 owner-only와 #84 공개 대기 문구만 현재 이력에 맞게
현행화했다. Task #83의 legacy/Gate B 증적, Task #84 version 24 Gate C 증적과 Task
#101 version 33 provider 검증을 삭제하거나 한 시점의 값으로 합치지 않았다.

README Markdown은 계속 fixed `/api/share/{handle}` href와 query 없는
`/u/{handle}/card.png` src를 사용한다. submit이나 카드 설정 저장으로 바뀌는 것은
**공유 링크 복사**와 X·LinkedIn·Threads·Facebook·Reddit target의
`/api/share/{handle}/r/{revision}`뿐이다. Stage 4의 fixed share provider 실측은
역사적 evidence로 남기고 현재 제품 계약으로 되돌리지 않았다.

Stage 4에서 만든 disposable CLI credential은 같은 Stage에서 token revoke와 local
logout을 완료했고 credential file 0개를 확인했다. Stage 5에서는 이 증적만
재확인했으며 actual owner, #101 validation data, owner/usage/token/session row와 R2
object를 읽거나 삭제하지 않았다. D1은 readiness 확인을 위해 비식별
`schema_migrations` version row만 조회했다.

## 검증 결과

실행 명령·read-only 절차:

```bash
git fetch origin --prune
git rev-parse HEAD origin/devel origin/main
git rev-list --left-right --count origin/devel...HEAD
gh issue view 84 --json state,title,url
curl --output /dev/null --write-out ... /healthz
curl --output /dev/null --write-out ... /__ops/profile-maintenance
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git status --short --branch
git diff --check
git diff --name-only origin/devel...HEAD
```

Sites connector로 site, version history, environment key metadata, D1 database
overview와 `schema_migrations` 5개 row를 read-only로 조회했다. secret 값과
identity·owner·usage·session payload는 출력하거나 기록하지 않았다.

결과:

- **OK — branch와 Issue**: Issue #84는 `OPEN`이다. `local/task84` HEAD
  `3a515194d10dcb562f1f1e9d87e2bdbf4f9f96d1`은 `origin/devel`
  `c62e5359d1f920b65c7a93191a121cbfc7863e64`를 포함하며 `0 behind / 8 ahead`다.
  `origin/main`은 Task #84 release source
  `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`다.
- **OK — live validation snapshot**: project와 live URL은 기존 linkage와
  일치했다. 현재 saved version은 33, source는
  `53a7132630dcb6f43459880d79730e10e2b59d6e`, archive는 22 files,
  5,171,200 bytes다. access는 public revision 59, external visitor 0명이다.
  environment는 revision 89와 9개 key 구성을 유지하고 maintenance `disabled`,
  service `normal`, operator secret absent다.
- **OK — health와 readiness**: `/healthz`는 `200 application/json`, 닫힌 operator
  route는 generic `404`였다. D1 `DB` overview는 12 tables를 bounded하게 반환했고
  `schema_migrations`는 누락·추가 없이 exact `[1,2,3,4,5]`였다. 다른 table row는
  조회하지 않았다.
- **OK — 시간축 분리**: Task #84 Gate C의 version 24/source
  `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`, access revision 57,
  environment revision 87과 #101/live의 version 33/access 59/environment 89를
  release → validation 순서로 분리했다. version 24 archive 22 files,
  5,140,480 bytes와 content hash 증적도 version history에 유지됐다.
- **OK — 전체 Node**: 825 tests, 819 pass, 6 environment-conditional skip,
  0 fail, 약 20.2초. `TEST_DATABASE_URL`이 필요한 PostgreSQL 6개만 계획대로
  skip됐다.
- **OK — 전체 E2E**: Playwright 101개가 약 1.6분에 모두 통과했다. submit 전후
  README Markdown 완전 동일과 공유 링크·다섯 SNS target revision 동시 갱신
  시나리오를 포함한다.
- **OK — production build**: Vite server 62 modules와 client 1,834 modules를
  build하고 Sites artifact를 정상 finalize했다.
- **OK — artifact**: full-stack verifier는 client 8 files, migrations 5 files,
  worker 2 files, raw 4,012,467 bytes, compressed 2,168,373 bytes로 `ok: true`였다.
  production verifier는 artifact 5,152,090 bytes, expected bindings 3개와 같은
  구성을 독립 확인해 `ok: true`였다.
- **OK — 검증 환경 정리**: worktree와 root checkout의 lockfile exact-match를
  확인한 뒤 같은 dependency를 임시 link해 회귀를 실행했다. link는 검증 직후
  제거했고 제품 source나 dependency manifest를 변경하지 않았다.
- **OK — remote mutation 0건**: site version 저장·배포, access/environment update,
  database/media/account/session mutation, SNS 게시와 cache purge를 수행하지 않았다.

## 잔여 위험

- 현재 stage5 Site description에는 과거 owner-only nonproduction 문구가 남아 있지만
  실제 live access는 public revision 59다. read-only Stage에서 metadata를 변경하지
  않았으며 새 migration에서 역할과 설명을 함께 정렬해야 한다.
- 현재 stage5는 공개 validation origin이고 테스트 계정·데이터가 남아 있다. 새
  `codex-usage-profile` production hostname, stage5 테스트 전환, project·D1·R2 보존
  또는 폐기, OAuth callback과 CLI 기본 origin은 별도 migration Issue의 승인·rollback
  계획 없이 변경하지 않는다.
- 외부 provider의 crawler/image 처리 지연은 통제할 수 없다. revision URL은 cache
  identity를 분리하지만 즉시 표시 SLA나 과거 revision snapshot을 제공하지 않는다.
- PostgreSQL fallback 통합 테스트 6개는 `TEST_DATABASE_URL`이 없는 환경에서
  계획대로 skip됐다. Sites D1 경로와 production artifact 검증은 통과했다.

## 다음 단계 영향

- Stage 5 승인 뒤에만 `task-final-report`로
  `mydocs/report/task_m100_84_report.md`, 오늘할일 완료, 최종 commit,
  `publish/task84` push와 `devel` 대상 PR을 준비한다.
- Task #84 PR은 release/cutover 이력과 운영 문서만 전달하며 Sites를 다시 배포하지
  않는다.
- 새 canonical production migration은 Task #84에 흡수하지 않는다. 별도 Issue에서
  current version 33 validation baseline, version 32 rollback, fixed README/revision
  share 계약과 data disposal 승인 경계를 입력으로 사용한다.

## 승인 요청

- Stage 5 read-only live audit, 전체 회귀, Gate C 역사 정리와 migration handoff를
  승인하면 최종 보고·PR 게시 절차로 진행한다.
