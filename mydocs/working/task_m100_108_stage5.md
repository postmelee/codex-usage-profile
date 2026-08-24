# Task #108 Stage 5 보고서 — production exact-main parity와 공개 전 smoke

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 5

## 단계 목적

Task #122에서 검증한 exact `main`을 Stage5 owner-only 상태에 고정하고, canonical production을
같은 source와 D1 migration 1–6으로 맞춘다. production의 최종 안전 환경을 복구한 뒤 OAuth,
공개 profile/card/share, npm CLI 기본 origin submit, 고정 README/revision 공유와 다섯 SNS
preview까지 공개 전 사용자 흐름을 검증한다. Stage5 live recovery·data disposal은 #125로
분리하고 두 환경의 데이터와 자격증명을 공유하지 않는다.

## 산출물

| 파일 또는 원격 산출물 | 변경 요약 |
|---|---|
| production Site version 3 | exact `main` source와 migration 1–6을 포함한 27-file archive를 기존 public access에 배포했다. |
| production D1 | additive migration 6을 한 번 적용해 `account_deletion_operations` schema를 추가했다. |
| production environment revision 4 | maintenance disabled, service normal, operator token absent의 final safe 상태로 복구했다. |
| `mydocs/plans/task_m100_108_impl.md` | Task #122/#125 handoff, Gate F0/F1/F2와 production deletion risk acceptance를 기록했다. |
| `mydocs/working/task_m100_108_stage5_3.md` | Gate F0 exact-main artifact와 production/Stage5 read-only baseline을 기록했다. |
| `mydocs/working/task_m100_108_stage5_4.md` | Gate F1 production 배포·migration 6·안전 복구를 기록했다. |
| `mydocs/working/task_m100_108_stage5_5.md` | Gate F2 OAuth·CLI·README/revision share·SNS preview와 credential cleanup을 기록했다. |
| `mydocs/orders/20260824.md` | Stage 5 완료와 Stage 6 승인 대기 상태를 기록했다. |
| `mydocs/working/task_m100_108_stage5.md` | Stage 5 전체 결과, risk acceptance와 다음 단계 경계를 통합했다. |

production 최종 상태:

- saved version 3, public access revision 10
- source `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`
- content hash `sha256:fb262880766b9543f39c97be44909f2dc1b94a5ce024783afe360cc282740f47`
- 27 files, 5,437,440 bytes
- environment revision 4
- migration exact `[1,2,3,4,5,6]`

Stage5 최종 상태:

- saved version 36, owner-only/custom access revision 62
- source `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`
- environment revision 119
- migration exact `[1,2,3,4,5,6]`
- 기존 deletion operation 1건은 `structured`, lease 없음으로 불변

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 공개 사용자 문서는 Stage 5에서 수정하지 않았다. exact `main` source를 production
target artifact로 다시 패키징해 배포했고, production D1에는 additive migration 6만 적용했다.
Gate F2에서는 집계 사용량 제출 1건과 OAuth session 재발급만 발생했다. 계정·usage·card·R2
object는 삭제하지 않았고 외부 SNS 게시물도 만들지 않았다.

검증 credential은 요청별 header·Sites secret 또는 repository 밖 mode `0600` 임시 CLI 설정으로만
사용했다. 값을 URL, Git config, repository, 출력 보고서에 저장하지 않았다. 검증 뒤 operator
secret은 environment에서 제거했고 CLI token은 server revoke와 local logout으로 정리했다.
사용자 측 `packages/.DS_Store`는 수정·삭제·커밋하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile.meleeisdeveloping.chatgpt.site
npm view codex-usage-profile@0.1.3 version dist.integrity dist.tarball --json
npm view codex-usage-profile dist-tags --json
npm run scan:public-release
git diff --check
git status --short
```

Sites read-only 검증:

- production/Stage5 `get_site`, `get_environment_variables`, `list_site_versions`
- production/Stage5 `read_database_overview`, `schema_migrations`
- production `account_deletion_operations`, `cli_tokens`
- Stage5 `account_deletion_operations`

결과:

- **OK — exact-main parity**: production version 3과 Stage5 version 36은 모두 exact source
  `dfc80d0b...`다. production은 public, Stage5는 owner-only/custom 상태를 유지한다.
- **OK — production migration**: Gate F1의 authenticated readiness와 migrate에서 pending 6만
  적용됐고 expected/applied가 exact 1–6으로 일치했다. 최종 DB read에서도 migration 1–6과
  13개 application table, `account_deletion_operations` 존재를 확인했다.
- **OK — final safe environment**: production revision 4와 Stage5 revision 119는 maintenance
  disabled, service normal, operator token key absent다. operator token 제거 뒤 readiness CLI를
  무인증으로 재실행하면 의도대로 `maintenance_token_missing`이며, root와 `/healthz`는 200,
  anonymous `/api/auth/me`는 401, 무인증 maintenance POST는 generic 404다.
- **OK — OAuth/session**: production에서 owner session 로딩, logout, 로그인 필요 상태와 GitHub
  OAuth 재로그인을 확인했다.
- **OK — public npm CLI**: `latest=0.1.3`이며 별도 `--server` 없는 격리 환경 login/status/submit이
  production 기본 origin에서 성공했다. submit은 `accepted`, non-idempotent였고
  `capturedAt=2026-08-24T10:39:11.820Z`다.
- **OK — fixed README**: submit 전후 README Markdown은 완전히 동일하며 href는 stable
  `/api/share/postmelee`, img src는 stable `/u/postmelee/card.png`를 유지했다.
- **OK — revision share**: 공유 revision은 `1787546241667`에서 `1787567964615`로 변경됐고
  X·LinkedIn·Threads·Facebook·Reddit target이 모두 새 revision을 사용했다.
- **OK — SNS preview boundary**: X·LinkedIn·Meta crawler User-Agent가 새 share route에서 HTML
  200과 같은 revision의 `og:url`, `og:image`, `twitter:image`, `summary_large_image`를 받았다.
  revision social PNG와 stable README share/card route도 200이다. 외부 글은 게시하지 않았다.
- **OK — credential cleanup**: 검증용 API token은 server에서 폐기했고 UI active count는 0/3,
  D1 token row는 revoked다. 격리된 local credential과 임시 디렉터리도 삭제했다.
- **OK — build/artifact/release scan**: production build, fullstack/production artifact verifier가
  성공했다. artifact는 client 12 files, migration 6 files, expected binding 3개를 포함한다.
  public release scan은 `ok=true`, blocker 0이다.
- **OK — Stage5 mutation 0**: version 36, access revision 62, environment revision 119,
  migration 1–6과 기존 structured operation·lease 없음이 Gate F0와 같다.

## 잔여 위험

- **Risk accepted — production account deletion E2E 미실행**: disposable production owner와
  repository 밖 export·exact plan digest/count가 없어 기존 공개 `@postmelee`를 삭제하지 않았다.
  작업지시자는 2026-08-24 Task #122의 Stage5 live deletion/recovery 검증과 #125 handoff를
  근거로 이 항목을 공개 차단 조건에서 제외했다. production 삭제 성공을 수행·추정한 것으로
  기록하지 않으며, disposable identity가 생기면 별도 파괴적 승인 절차를 다시 적용한다.
- Stage5 기존 deletion operation의 live recovery·data disposal은 비차단 #125 범위다.
- X·LinkedIn을 포함한 외부 provider cache refresh 시간은 application이 보장하지 않는다.
  이번 Stage는 새 revision target과 crawler metadata까지만 검증했다.
- `npm ci` audit의 기존 dependency 위험은 본 Stage 범위에서 자동 수정하지 않았다.
- `packages/.DS_Store`는 작업지시자 측 추적되지 않은 파일로 계속 제외한다.

## 다음 단계 영향

- Stage 6은 Stage 1–5 보고서와 실제 production/Stage5 상태를 대조해 운영 runbook, 배포 승격·
  rollback·temporary-public·#125 handoff 문서를 최종 정리한다.
- production은 public version 3·environment revision 4·migration 1–6을 유지하고 추가 배포나
  계정/D1/R2 mutation을 만들지 않는다.
- Stage5는 owner-only version 36을 유지하며 #125 외 작업에서 live recovery나 data disposal을
  수행하지 않는다.
- GitHub 공개 표면과 마케팅 시작 판단은 Stage 6 검증·보고 뒤 확정한다.

## 승인 요청

- Stage 5의 production exact-main parity, migration 1–6, 비파괴 전체 사용자 흐름과 명시적
  deletion risk acceptance를 승인하면 Stage 6 문서·runbook 최종 정리로 진행한다.

