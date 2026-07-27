# Task #51 Stage 6 단계 보고서

GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)
구현계획서: [`task_m100_51_impl.md`](../plans/task_m100_51_impl.md)
Stage: 6

## 단계 목적

Gate C 승인 범위에서 기존 Sites production candidate를 최종 public access로
전환한다. anonymous landing, production GitHub OAuth, clean packed CLI,
private-by-default profile, publish/unpublish stable card와 cleanup을 실제
production origin에서 검증한다. 공식 문서, GitHub Issue #43~#46과 M100
release 순서를 실제 Sites canonical architecture에 맞춘다.

## 산출물

| 파일·원격 상태 | 변경 요약 |
|---|---|
| `README.md` | 실제 production origin, npm #44 경계, Sites 공개 profile/card와 운영 상태 반영 |
| `docs/production-hosting.md` | 최종 cutover 상태, version/source provenance, retention·backup·비용 stop과 후속 작업 확정 |
| `docs/sites-operations.md` | production baseline, public↔owner-only 원복, 월별 retention과 backup 폐기 조건 확정 |
| `docs/cli-submit.md` | CLI 기본 production origin, npm 공개 전·후 사용 경계와 production 보안 정책 반영 |
| `docs/readme-card.md` | canonical HTML `/?profile={handle}`와 stable PNG URL 확정 |
| `packages/codex-usage-profile-cli/README.md` | package 기본 origin과 #44 이전 tarball 경계 반영 |
| `mydocs/orders/20260724.md` | #51을 Stage 6 Gate C 진행 상태로 갱신 |
| GitHub #43 | Cloud Run을 실제 가격·quota·정책·장애 trigger 이후 시작하는 비차단 fallback으로 재범위화 |
| GitHub #44 | #51 이후 npm publish와 exact Sites origin 사용자 검증으로 재범위화 |
| GitHub #45 | #51·#44 이후 Sites OAuth/CLI/D1/R2/card 전체 흐름과 보안 QA로 재범위화 |
| GitHub #46 | canonical full-stack Site와 중복된 marketing mirror를 `not planned`로 종료 |
| GitHub M100 | #49 → #51 → #44 → #45 release gate와 #43 fallback을 기준으로 설명 갱신 |
| Sites access | public revision 14 |
| Sites deployment | saved version 7/source `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`, environment revision 9 |

## 본문 변경 정도 / 본문 무손실 여부

- deployable source와 runtime contract는 변경하지 않았다.
- README와 공식 문서는 placeholder·candidate 표현을 실제 public production
  상태로 필요한 범위만 재작성했다. Account Usage, D1/R2, security, cache와
  Cloud Run fallback 계약은 보존했다.
- repository HEAD와 deployed source의 차이는 문서·단계 보고서뿐이다. 검증된
  saved version 7을 유지했고 새 version을 만들지 않았다.
- credential, maintenance secret, backup payload/path, 개인 owner 식별자와
  실제 집계 값은 source·문서·보고서에 기록하지 않았다.

## Gate C 원격 결과

### 최종 Site

- origin: `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`
- title: `Codex Usage Profile`
- access: public revision 14
- saved version: 7
- deployed source: `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`
- environment: revision 9
- service: `normal`
- maintenance: `disabled`
- owner-only rollback: owner 1명, 추가 user/workspace/tenant group 0개의 직전
  custom policy

Gate C access·environment·deployment 과정에서 추가 plan, 결제수단 등록,
자동 초과 과금 또는 비용 승인을 요구하지 않았다. 이는 현재 계정과 현재 Sites
beta에서 이번 작업 중 관찰한 결과이며 향후 가격·quota의 보장은 아니다.

### anonymous, OAuth와 clean CLI

- anonymous landing과 root-query public HTML은 `200`이었다.
- `/healthz`는 binding을 generic `ok`로만 표시하며 `200`이었다.
- session 없는 `/api/auth/me`는 `401`, missing/private profile·card와
  maintenance route는 같은 generic `404`였다.
- production GitHub OAuth callback 뒤 secure browser session과 owner identity가
  정상 로드됐다.
- 검토한 `codex-usage-profile@0.1.0` tarball을 격리된 XDG config/npm cache에서
  실행해 device approve와 Account Usage Contract v1 submit을 완료했다.
- 이전 승인과 같은 집계 필드만 전송했다. prompt, response, Codex/OpenAI
  credential, GitHub OAuth credential과 local session file은 전송하지 않았다.
- 성공 출력은 capture time, profile/card URL과 README Markdown만 포함했고
  usage 값, raw token, owner id와 private revision은 출력하지 않았다.

### private, publish/unpublish와 cleanup

- submit 직후 profile은 private였고 public JSON과 두 locale card는 `404`였다.
- publish 뒤 public JSON/HTML, `en`/`ko` PNG와 HEAD는 `200`이었다.
- stable card는 `public, no-cache, must-revalidate`와 quoted application ETag를
  반환했고 같은 ETag의 `If-None-Match`는 `304`였다.
- canonical public HTML `/?profile=postmelee`는 API-backed identity와 card를
  표시했다.
- unpublish 뒤 public JSON과 `en`/`ko` card가 다시 `404`였다.
- final smoke owner 1건과 연관 object 12건을 exact digest/count guard로
  삭제했다. 이후 browser session은 anonymous, CLI status는 인증 거부,
  local credential은 logout으로 제거됐다.
- 90일/recent 5 retention dry-run 후보는 0건이었다.
- Gate C 임시 tarball, npm cache와 로그아웃 credential 디렉터리 2개는 영구
  삭제했다. repository 밖 원본 durable backup은 변경하지 않았다.

### 환경 원복과 관찰

- cleanup 구간에만 maintenance를 enable하고 새 secret을 사용했다.
- cleanup 뒤 maintenance secret을 다시 회전하고 `disabled`로 바꿔 saved
  version 7을 environment revision 9로 재배포했다.
- final landing/health는 `200`, 삭제한 profile JSON/card와 maintenance
  route는 `404`였다.
- 최근 30분 error log event는 0건이었다. log 응답에 Authorization, cookie,
  OAuth/device code, owner id, usage 값과 secret key 이름이 없음을 확인했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
npm run build
npm run build:cloud-run
npm run build:sites
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:hosting-matrix
npm pack --dry-run --workspace packages/codex-usage-profile-cli
git diff --check
```

결과:

- `npm test`: OK — 477 total, 471 pass, 6 skip, 0 fail
- `npm run test:e2e`: OK — 16/16
- `npm run build`: OK
- `npm run build:cloud-run`: OK
- `npm run build:sites`: OK
- `npm run build:production`: OK
- `npm run verify:sites-fullstack`: OK — client 7, migration 2, worker 2
- `npm run verify:sites-production`: OK — 5,400,732 bytes, expected binding 3
- `npm run smoke:hosting-matrix`: OK
- `npm pack --dry-run --workspace packages/codex-usage-profile-cli`: OK —
  13 files, package 14.2 kB
- `git diff --check`: OK
- 사용자 전역 npm cache의 기존 권한 오류는 제품 오류가 아니며 전역 상태를
  수정하지 않고 작업 전용 임시 cache로 pack을 재검증한 뒤 삭제했다.

## 잔여 위험

- Sites beta의 가격·quota·정책은 바뀔 수 있다. 추가 비용이나 contract
  blocker가 나타나면 `quota-stop`/owner-only/maintenance 순서로 닫고 #43
  fallback을 별도 승인한다.
- 기존 Site slug에 `stage5`가 남지만 검증된 project/D1/R2/version history를
  보존하기 위한 opaque URL 식별자다. 기능상 test 상태를 뜻하지 않는다.
- Sites 앞단은 extension 없는 `/u/{handle}` HTML deep link를 `/`로 보낸다.
  공식 HTML link는 `/?profile={handle}`, README image는
  `/u/{handle}/card.png`로 고정했다.
- owner에 귀속되지 않은 기존 만료 device challenge 2건은 profile, usage 또는
  교환 token이 없고 아직 90일 cleanup 후보가 아니다. 월별 dry-run에서
  threshold 도달 뒤 별도 apply 승인을 받는다.
- 원본 durable backup은 민감한 repository 밖 운영 자산이다. 2026-08-26과
  #45 완료 중 더 늦은 시점까지 `0600`으로 보존하고, 두 조건 뒤 별도 영구
  삭제 승인을 받는다.
- npm package는 아직 공개되지 않았다. 사용자 설치 경로는 #44 완료 전까지
  source checkout 또는 검토한 local tarball로 제한된다.
- self-service account deletion UI는 없으며 현재는 exact guarded operator
  절차를 사용한다.

## 다음 단계 영향

- Stage 6은 Task #51의 마지막 구현 단계다.
- 단계 보고 승인 뒤 `task-final-report` 절차로 최종 보고서, 오늘할일 완료,
  최종 커밋/push와 `devel` 대상 PR을 준비한다.
- Task #51 merge 뒤 다음 release gate는 #44 npm package publish이며, 그 뒤
  #45 Sites production 전체 흐름과 보안 QA를 진행한다.

## 승인 요청

- Stage 6 public cutover, 공식 문서·roadmap 변경과 검증 결과를 검토해 달라.
- 승인되면 최종 보고서와 PR 게시 단계로 진행한다.
