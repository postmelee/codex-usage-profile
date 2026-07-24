# Task #49 Stage 6 보고서 — Sites MVP architecture 판정과 handoff

GitHub Issue: [#49](https://github.com/postmelee/codex-usage-profile/issues/49)
구현계획서: [`task_m100_49_impl.md`](../plans/task_m100_49_impl.md)
Stage: 6

## 단계 목적

Stage 1~5의 local/hosted 증적을 decision matrix에 대조해 Sites + D1 + native R2가 개인·비상업·추가 비용 0원의 M100 MVP canonical target으로 적합한지 최종 판정한다. PASS이면 공식 architecture 문서를 갱신하되 현재 Stage 5 test deployment를 production으로 선언하지 않고, 기존 Cloud Run + Neon + S3-compatible R2 구현을 tested fallback으로 보존한다.

작업지시자는 managed remote R2에 fault-injection seam을 추가하지 않고 local failure/concurrency suite와 hosted 정상·경쟁 결과를 근거로 해당 공백을 수용하는 권고안을 승인했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/production-hosting.md` | M100 canonical target을 Sites + D1 + native R2로 전환하고 Cloud Run + Neon + S3-compatible R2를 fallback으로 보존 |
| `docs/production-hosting.md` | contract v2 D1 named atomic operation, media contract v3/tombstone, Worker renderer와 Sites runtime binding 반영 |
| `docs/production-hosting.md` | 현재 계정의 증분 비용 0원 관찰 범위, stop/fallback 조건과 승인된 R2 위험 수용 기록 |
| `docs/production-hosting.md` | production cutover 전 data/OAuth/domain/access/backup/monitoring 조건과 별도 migration handoff 기록 |
| `mydocs/report/task_m100_49_report.md` | 6개 Stage 결과, 정량 비교, 수용 기준과 잔여 위험을 통합한 최종 보고서 |
| `mydocs/orders/20260724.md` | Task #49 완료 시각과 PASS 요약 |

Stage 6는 architecture·handoff 문서만 변경했다. Site source, runtime environment, D1/R2 data, OAuth app, access와 deployment를 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

`docs/production-hosting.md`의 기존 Cloud Run, Neon/Postgres, S3-compatible R2 설정·migration·readiness·rollback 정보는 fallback 절로 보존했다. 삭제된 핵심 의미는 “Sites는 sample-only marketing mirror”라는 이전 canonical 결정이며, Stage 5 실제 hosted PASS와 충돌하므로 새 결정으로 교체했다.

현재 source의 `build:cloud-run`, sample-only `build:sites`와 full-stack `build:sites-fullstack`을 모두 유지한다. canonical build 정리와 production cutover는 후속 migration task 범위이므로 이번 문서 변경만으로 배포 또는 사용자 traffic을 전환하지 않는다.

## 판정 결과

| 수용 기준 | 결과 | 근거 |
|---|---|---|
| 현재 계정의 증분 비용 0원 | PASS | Gate A/B에서 별도 결제·plan upgrade 없이 Site/D1/R2 linkage, migration, deployment와 public smoke 완료 |
| GitHub OAuth/session/logout | PASS | 실제 code exchange, owner identity, secure session, logout과 이후 401 |
| packed CLI login/submit | PASS | device approve/exchange, Contract v1 submit, token revoke |
| D1 원자성/rate limit | PASS | real-workerd named operation과 hosted duplicate submit/exchange |
| native R2 serving/publication | PASS | hosted GET/HEAD/304/404, publish/unpublish와 경쟁 |
| Worker renderer | PASS | hosted private/public PNG, local 결정성·locale·시각 승인 |
| secret/private-data 경계 | PASS | response/header/client asset와 짧은 error log scan |
| beta limit stop/fallback | PASS | owner-only/maintenance 전환과 Cloud Run fallback 조건 문서화 |
| remote provider fault injection | 위험 수용 | local failure/concurrency suite 통과, hosted 정상·경쟁 통과; remote seam 미추가를 작업지시자 승인 |

최종 판정은 **PASS**다. 이는 architecture 적합성 판정이며 현재 Stage 5 test resource의 production 승인이나 공개 전환이 아니다.

## 검증 결과

구현계획서 Stage 6 명령:

```bash
npm test
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:sites-fullstack
npm run verify:sites-fullstack
npm run smoke:hosting-matrix
git diff --check
git status --short
```

결과:

- OK — `npm test`: 436개 중 430 pass, 6 env-gated skip, 0 fail
- OK — Playwright E2E: 15/15
- OK — product, Cloud Run, sample-only Sites와 full-stack Sites build
- OK — hosted artifact verifier
  - client 7 files, Worker 1 file, migration 2개
  - Worker raw 3,823,944 bytes, compressed 2,129,753 bytes
- OK — hosting matrix
  - current Cloud Run product surface와 sample-only Sites mirror가 독립적으로 동작
  - Sites mirror 종료 뒤 Cloud Run health 유지
- OK — `git diff --check`
- OK — GitHub Issue #43, #46, #49는 모두 open이며 Stage 6에서 상태를 변경하지 않음
- OK — Site owner-only, profile private, test session/token revoked 상태 유지

## 잔여 위험

- Sites beta의 account별 numeric quota와 장기 가격은 보장되지 않는다. 비용 0원 판정은 현재 계정/현재 시점 관찰이다.
- managed remote R2 provider failure는 직접 주입하지 않았다. local failure/concurrency suite와 hosted 정상·경쟁 결과를 근거로 승인된 위험으로 수용했다.
- Stage 5 test D1/R2에 owner record, 승인된 집계 usage와 immutable media가 남아 있다. owner-only/private/404지만 production cutover 전 재사용·분리·cleanup 결정이 필요하다.
- production OAuth app/custom domain, D1/R2 export·backup/restore, retention/account deletion, monitoring/alerting과 abuse 운영 값은 후속 migration 범위다.
- current source의 canonical entry 정리는 아직 수행하지 않았다. 공식 target과 current deployed production이 같다고 오해하지 않도록 migration Gate를 유지해야 한다.

## 다음 단계 영향

- 별도 migration issue에서 canonical build 정리, production OAuth/domain/data/access, backup/monitoring과 public cutover를 수행한다.
- #43은 삭제하지 않고 Cloud Run fallback deployment 범위로 유지·재검토한다.
- #46의 marketing-only remote publication은 canonical full-stack migration과 중복되지 않도록 유지·대체·close를 별도 결정한다.
- Stage 5 Site/D1/R2/test OAuth app의 material 삭제 또는 production 재사용은 별도 승인 없이는 수행하지 않는다.

## 승인 요청

- Stage 6 PASS 판정, 공식 architecture 갱신과 최종 보고서를 승인하면 `publish/task49`로 게시하고 `devel` 대상 PR을 생성한다.
- 이 승인은 production 공개 전환, test resource 삭제 또는 #43/#46 상태 변경 승인이 아니다.
