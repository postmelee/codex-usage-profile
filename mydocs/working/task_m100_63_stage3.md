# Task M100 #63 Stage 3 완료 보고서

GitHub Issue: [#63](https://github.com/postmelee/codex-usage-profile/issues/63)
구현계획서: [`task_m100_63_impl.md`](../plans/task_m100_63_impl.md)
Stage: 3

## 단계 목적

application migration manifest와 Sites full-stack artifact의 packaged SQL을
exact 비교해 count literal drift를 제거하고, production artifact의 독립
allowlist와 CLI/UI canonical production origin이 별도 검토 없이 달라지지
않도록 회귀 계약을 추가했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/verify-sites-fullstack-artifact.mjs` | pure D1 manifest에서 ordered filename 목록을 파생하고 packaged SQL의 missing/unexpected/duplicate/order drift를 구분해 거부 |
| `scripts/__tests__/verify-sites-fullstack-artifact.test.js` | exact 정상 경로와 migration 누락·추가·이름·중복·순서 drift 회귀 추가 |
| `scripts/__tests__/verify-sites-production-artifact.test.js` | 미검토 future migration 거부와 production allowlist의 manifest 비의존성 검증 추가 |
| `src/profile-ui/__tests__/production-origin-contract.test.js` | CLI/UI 상수의 exact equality, 현재 production origin과 canonical HTTPS origin 형태 고정 |
| `mydocs/orders/20260801.md` | Stage 3 완료와 Stage 4 승인 대기 상태 기록 |
| `mydocs/working/task_m100_63_stage3.md` | Stage 3 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

full-stack verifier는 기존 `migrationFiles.length !== 3` 검사 대신
`D1_MIGRATION_MANIFEST`의 `db/migrations/` 상대 filename 순서를 사용한다.
packaged `.openai/drizzle`의 SQL 파일은 manifest와 exact match해야 하며,
누락, unexpected filename, 중복과 정렬 순서 drift는 서로 다른 안정적
오류로 fail-closed한다.

production verifier의 기존 `EXPECTED_MIGRATIONS`와 본문은 수정하지 않았다.
테스트는 production verifier가 application manifest를 import하지 않는지
확인하고 미검토 `0004_future.sql`이 포함된 후보 전체 검증이 실패하는지
확인한다. 따라서 application/full-stack 파생 경로와 production security
review gate는 결합되지 않는다.

CLI `DEFAULT_SERVICE_ORIGIN`과 UI
`DEVICE_APPROVAL_PRODUCTION_ORIGIN`의 실제 값, OAuth callback, runtime package
dependency, `.openai/hosting.json`, migration SQL과 local production smoke는
변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  scripts/__tests__/verify-sites-fullstack-artifact.test.js \
  scripts/__tests__/verify-sites-production-artifact.test.js \
  src/profile-ui/__tests__/production-origin-contract.test.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git diff origin/devel -- \
  packages/codex-usage-profile-cli/src/config.js \
  src/profile-ui/deviceApproval.js
```

결과:

- OK — 집중 테스트 18건 통과, 실패·skip 0건
- OK — full-stack artifact는 manifest migration 3개 exact 정상 경로를
  허용하고 누락·추가·filename drift·중복·순서 drift를 각각 거부
- OK — production 검증은 미검토 future migration을 거부하고 독립 exact
  allowlist 3개를 manifest import 없이 유지
- OK — CLI/UI production origin이
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`로 exact
  일치하고 credential/path/query/fragment 없는 canonical HTTPS origin
- OK — production build 성공, server 48개·client 42개 module transform
- OK — full-stack artifact 검증:
  `clientFileCount=7`, `migrationFileCount=3`, `workerFileCount=2`,
  `workerCompressedBytes=2146839`
- OK — production artifact 검증:
  `artifactBytes=5496371`, `expectedBindingCount=3`,
  `migrationFileCount=3`
- OK — `git diff --check` 경고 없음
- OK — CLI/UI production origin source diff 빈 출력

미실행 또는 skip으로 처리한 검증은 없다.

## 잔여 위험

- Stage 3은 focused artifact/origin contract와 production build까지만
  검증했다. root 전체 test/build와 local production Worker smoke는 Stage
  4에서 Stage 1~3 변경을 함께 재검증해야 한다.
- 실제 owner-only Sites candidate와 원격 D1 readiness는 실행하지 않았다.
  Task #63 승인 범위에는 remote save/deploy/access/environment 및 D1/R2
  mutation이 포함되지 않는다.
- production migration allowlist는 의도적으로 application manifest와
  독립이므로 신규 migration마다 별도 production review와 allowlist 갱신이
  필요하다.

## 다음 단계 영향

- Stage 4는 root 전체 테스트, standard/production build, 두 artifact
  verifier와 local production smoke를 실행한다.
- Stage 1 manifest, Stage 2 protected readiness, Stage 3 artifact/origin
  계약을 함께 검증하고 보호 파일 diff가 비어 있는지 다시 확인한다.
- remote Sites/D1/R2 상태는 변경하지 않으며 외부 배포 검증은 별도 Gate로
  남긴다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 통합 검증과 문서 정합성
  확인으로 진행한다.
