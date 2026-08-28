# Task #137 Stage 6 보고서 — release provenance와 운영 handoff

GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
구현계획서: [`task_m100_137_impl.md`](../plans/task_m100_137_impl.md)
Stage: 6

## 단계 목적

exact main, npm registry와 provenance, Stage5·production의 saved source와 최종 운영 상태를 읽기 전용으로
다시 교차 대조한다. 공식 운영 문서의 현재값을 실측 결과로 닫고 package·Node·E2E·Sites artifact 전체
회귀와 제품 tree 무변경을 확인해 최종 handoff 근거를 만든다.

## 산출물

| 파일·항목 | 변경 요약 |
|---|---|
| `docs/npm-release.md` | npm `0.1.4`와 production version 5의 완료 상태, migration·smoke·최종 audit를 기록했다. |
| `docs/production-hosting.md` | dual-Site 현재표를 production version 5/environment 8, Stage5 version 38/environment 121로 정합화했다. |
| `mydocs/report/task_m100_137_report.md` | 6개 Stage의 변경·검증·위험을 통합한 최종 보고서를 작성했다. |
| `mydocs/orders/20260825.md` | Task #137을 완료로 전환했다. |

`docs/sites-operations.md`의 운영 계약 drift는 없어 수정하지 않았다. 제품 source, package artifact,
workflow, manifest, migration과 원격 Site는 이 Stage에서 변경하지 않았다.

## read-only provenance 교차 대조

| 대상 | 확인 결과 |
|---|---|
| Git source | `origin/main`과 annotated tag `codex-usage-profile-v0.1.4`의 peeled commit이 모두 `27e8705fdc152534a4e4b726cac32f625a3c7763`이다. |
| npm | public `codex-usage-profile@0.1.4`, `latest=0.1.4`, exact analyzer `0.4.1`, 14 files와 Stage 1 SHA-1/SHA-512가 일치한다. |
| Actions provenance | run `32864371385`의 Node 20·22·24와 staged publish가 성공했고 tag·head SHA가 exact main과 일치한다. |
| Stage5 | saved version 38, source exact main, 27 files/5,437,440 bytes, custom owner-only access revision 62, environment 121 disabled/normal/token absent다. |
| production | saved version 5, source exact main, 27 files/5,437,440 bytes, public access revision 10, environment 8 disabled/normal/token absent다. |
| migration | 두 Site의 `schema_migrations`가 모두 순서까지 `[1,2,3,4,5,6]`이며 migration 6 operation table이 존재한다. |

## 검증 결과

실행·확인 항목:

```text
origin/main·annotated tag·npm registry·Actions run read-only 대조
Stage5·production access/version/environment/D1 read-only 대조
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
npm test --workspace packages/codex-usage-profile-cli
Node 24 비-D1 전체 *.test.js
Node 22 real-workerd D1 6개 파일
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
production health/operator/card/share read-only 표본
git diff --check 및 변경 path guard
```

- OK — public release scan은 blocker 0, 기존 immutable history review 71건으로 통과했다.
- OK — npm verifier와 격리 install smoke는 14 files, packed 17,614 bytes, unpacked 63,363 bytes,
  SHA-1 `5bf1d4918ab362d7a33a2fcb04c48df356535ed3`, SHA-512
  `sha512-uYnMSdVTUm+srtIAWlCiLVk9TpRInGb3LTfn6R82uZXoSUMuHA6uEpd+jRtT/T1zmA7U+iyEKCaFjMcc7zRxsg==`와
  6개 실행 경계를 재확인했다. CLI workspace는 78/78 pass다.
- OK — Node 24 비-D1은 840건 중 834 pass·환경 조건부 6 skip, Node 22 real-workerd D1은 36/36
  pass다. 합계 876건에서 fail/cancel은 0이다.
- OK — Playwright E2E 103/103이 통과했다. stale credential 재승인, 미제출 Home과 기기 승인 완료
  다음 행동, fixed README 불변·revision share target 갱신 계약을 포함한다.
- OK — production build는 server 63 modules, client 1,834 modules를 변환했다. full-stack verifier는
  client 12 files, Worker 2 files와 migration 6개를 확인했고 production verifier는 5,410,130-byte
  artifact를 승인했다.
- OK — production read-only 표본은 `/healthz` 200, 닫힌 operator 404, private card 404와 generic
  fallback share document 200이다. 원격 mutation과 사용자 데이터 write는 없었다.
- OK — Stage 6 diff는 공식 문서·보고서·오늘할일뿐이다. 제품 source, package manifest/artifact,
  workflow, hosting manifest와 migration diff는 0이고 secret/raw data/local path를 추가하지 않았다.

최초 sandbox 실행에서 registry install과 loopback listen이 차단됐고 Node 목록에 Playwright spec이
포함된 명령 오류가 있었으나, Stage 1과 같은 `*.test.js` 분리와 network/loopback 허용 환경에서 위 최종
결과를 다시 판정했다. 제품 실패로 집계하지 않는다.

## 잔여 위험

- 로그인된 완전 신규 production owner의 미제출 Home은 사용자 데이터를 지우지 않고 local E2E로
  판정했다. production owner 기반 stale credential와 same-process submit은 Stage 5에서 통과했다.
- Node 24 real-workerd D1 장시간 정지 #135는 별도 호환성 이슈다. 지원 Node 22 D1 36건과 Node 24
  비-D1 전체 계약으로 이번 release를 판정했다.
- production application rollback 후보는 version 4다. additive migration 6의 active operation이 있으면
  기존 application으로 임의 rollback하지 않는다.

## 다음 단계 영향

- npm `0.1.4`와 production version 5는 사용자 공개 상태이며 추가 release mutation은 필요하지 않다.
- 최종 PR은 문서·보고서만 `devel`에 통합한다. PR merge 뒤 Issue #137과 작업 branch/worktree를 정리한다.
