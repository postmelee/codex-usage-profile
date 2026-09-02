# Task #144 Stage 5 완료보고서 — Production 통합 배포와 공개 smoke

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 5

## 단계 목적

Stage 4에서 exact main으로 고정한 production saved version 6을 기존 public access에 배포한다.
maintenance Gate에서 migration/readiness `[1,2,3,4,5,6]`을 확인하고 safe environment로 복원한 뒤,
npm CLI·인증 Profile·README card·social image/document·Share Studio GIF/PNG와 공개/비공개 복구를
production에서 비파괴 smoke한다.

## 산출물

| 항목 | 변경 요약 |
|---|---|
| production saved version 6 | exact main `6d3e600d2d33bb7a50147075d013ddd9b945d0b1`의 기존 saved version을 그대로 사용했다. |
| maintenance-on deployment | environment revision 13에서 deployment `appgdep_6a978e4957b8819195d70b66ff02e3ed`가 성공했다. |
| final safe deployment | environment revision 14에서 deployment `appgdep_6a978ed43a18819186486f39ffdaa2e1`가 성공했다. |
| production hosted smoke | migration·health·npm/CLI·Profile·dark/light media·Share Studio·visibility와 로그를 검증했다. |
| `mydocs/orders/20260902.md` | Stage 5 완료와 Stage 6 승인 대기 상태를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, migration, npm package, lockfile, hosting manifest와 공식 production 문서는 수정하지 않았다.
Task #144 branch에는 이 단계 보고서와 오늘할일만 추가한다. production에서는 승인된 saved version 6의
environment/deployment와 기존 owner profile의 비파괴 submit·card setting·visibility만 변경했으며, 최종
상태를 원래 `public + dark/en`으로 복원했다. access policy, D1 schema, account/token, 외부 SNS와
account deletion data는 변경하지 않았다.

## 배포와 안전 복원 결과

- production project: `appgprj_6a83ecc3c4c08191bda7f14d7c26c974`
- production URL: `https://codex-usage-profile.meleeisdeveloping.chatgpt.site`
- deployed saved version: 6 / `appgprj_6a83ecc3c4c08191bda7f14d7c26c974~appgver_1e97e0d13888819180a00c4233469dd1`
- source: exact main `6d3e600d2d33bb7a50147075d013ddd9b945d0b1`
- maintenance-on: environment revision 13, maintenance enabled, ephemeral operator secret present
- maintenance-off: environment revision 14, maintenance disabled, service normal, operator secret absent
- final access: public revision 10, owner 1명, group 0명, external visitor 0명
- data: migration `[1,2,3,4,5,6]`, active account deletion operation 0건
- rollback candidate: saved version 5 / source `27e8705fdc152534a4e4b726cac32f625a3c7763`

maintenance-on deployment 직후 첫 migration 요청은 배포가 terminal success인 것과 별개로 edge가 이전
client/route를 잠시 제공해 generic `404 not_found`를 반환했다. 응답 전까지 migration mutation은 없었다.
새 client asset `app-CYHDJQqV.js` 제공을 확인한 뒤 같은 승인 범위에서 정확히 한 번 재시도했고,
`newlyApplied=[]`, `appliedVersions=[1,2,3,4,5,6]`과 readiness `ready=true`를 확인했다. 이후 secret을
제거한 environment revision 14로 같은 saved version을 다시 배포했다.

## 검증 결과

실행·확인 항목:

```text
production access/version/environment/D1 preflight와 final read-only 확인
maintenance-on deploy → migrate/readiness → maintenance-off deploy
GET /healthz와 닫힌 /__ops/profile-maintenance 확인
npm view codex-usage-profile dist-tags version
npm run verify:npm-release
npx --yes codex-usage-profile@latest version/help/status/submit 경계 확인
authenticated Profile·Settings와 API token count 확인
dark/light card·social GET/HEAD/conditional GET, dimension·pixel·ETag 확인
Share document default/X/Threads/LinkedIn/Facebook/Reddit User-Agent 확인
Share Studio light GIF 생성·save action·preview frame 변화와 PNG save 확인
public → private → public API/media/share document와 원상복구 확인
production Worker logs errors-only/all 확인
git diff --check
```

결과:

- OK — maintenance-on/off 두 deployment 모두 saved version 6에서 terminal `succeeded`였다. final
  environment는 revision 14의 maintenance disabled·service normal·operator secret absent다.
- OK — migration은 순서까지 `[1,2,3,4,5,6]`, readiness는 `ready=true`, 신규 적용 0건이다. active
  account deletion operation은 배포 전후 0건이다.
- OK — final `/healthz`는 `200`, 비인증 operator route는 generic `404`다. root HTML은 새 client
  `app-CYHDJQqV.js`와 `index-BaFXZq2b.css`를 제공한다.
- OK — npm `latest`와 version은 모두 `0.1.4`다. release verifier는 14 files, 17,614 packed bytes,
  63,363 unpacked bytes, 기존 SHA-1/SHA-512 integrity를 재확인했다.
- OK — credential 없는 격리 CLI의 status는 로그인 안내와 함께 안전하게 실패했고, 기존 production
  credential의 status는 성공했다. 작업지시자의 별도 명시 승인 뒤 집계 사용량 1회 submit은
  `accepted`, non-idempotent로 완료됐다. raw credential·사용량은 기록하지 않았다.
- OK — submit 전후 visibility는 public이고 API token count는 `1/3`으로 유지됐다. 최종 브라우저
  상태는 `public + dark/en`이다.
- OK — queryless와 dark/light × en/ko card는 모두 `1497×918` RGBA, GET/HEAD `200`, conditional
  GET `304`와 expected ETag/cache contract를 통과했다. 최종 queryless는 dark/en과 동일하다.
- OK — dark/light social image는 모두 `2400×1260`이고 card geometry가 같다. dark padding은
  transparent이며 alpha bounds는 `(240,41)–(2159,1218)`이다. light surface는 `#F3F5F7`, outline은
  `#D0D7DE`, card 내부는 white로 확인됐다.
- OK — 고정/current/stale share document와 X·Threads·LinkedIn·Facebook·Reddit crawler 문서는
  `200`, invalid revision은 `404`다. Share Studio의 다섯 외부 공유 target은 같은 current revision을
  사용했고 실제 SNS 페이지를 열거나 게시하지 않았다.
- OK — light GIF는 브라우저에서 생성 완료되어 `blob:` 기반 `codex-usage-profile.gif` save action을
  제공했고, download media action이 성공했다. 0.9초 간격 preview render SHA-256이 달라 실제 animation
  frame 변화를 확인했다. PNG save는 production light URL을 사용했고 실제 파일은 `1497×918` PNG와
  server hash 일치 후 복구 가능한 휴지통으로 이동했다.
- OK — private 전환 동안 public profile/card/social GET·HEAD는 모두 `404`, fixed/revision share
  document는 개인 데이터가 없는 generic `200`이었다. 다시 public으로 전환한 뒤 dark/en 저장 성공과
  전체 media matrix를 재실행했다.
- OK — 최근 Worker log에는 의도한 auth/private/invalid-route의 `401/404`만 있었고, 전체 표본의 status는
  `200/201/304/404`, 5xx는 0건이다. credential value pattern도 발견되지 않았다.
- OK — final public share revision은 `1788318723266`이며 현재 revision `200`, stale revision `200`,
  invalid revision `404` 계약을 통과했다.

## 잔여 위험

- Sites deployment의 terminal success와 public edge route convergence 사이에 짧은 지연이 있었다. 이번에는
  신규 migration이 없어 bounded retry로 안전하게 종료됐지만, Stage 6에서 공식 운영 문서에 terminal
  success 뒤 asset/route convergence 확인과 mutation 없는 generic 404의 제한 재시도를 기록할지
  검토해야 한다.
- application rollback 후보는 saved version 5/source `27e8705...`로 유지된다. 현재 schema 1–6과
  호환되고 active deletion은 0건이지만, 실제 rollback이 필요하면 그 시점의 environment/data를 다시
  읽고 별도 승인을 받아야 한다.

## 다음 단계 영향

- Stage 6는 production saved version 6/source `6d3e600...`, final deployment
  `appgdep_6a978ed43a18819186486f39ffdaa2e1`, environment revision 14, public access revision 10과
  migration 1–6을 read-only로 교차 대조한다.
- `docs/production-hosting.md`의 current baseline과 release history를 위 실측값으로 최소 갱신한다.
- `docs/sites-operations.md`는 이번 edge convergence 관찰이 기존 runbook에 없는 실제 운영 contract
  drift인지 확인한 경우에만 수행계획서 범위에서 최소 보정한다.
- Stage 6 전체 local 회귀 전에는 production/stage5 remote mutation을 추가하지 않는다.

## 승인 요청

- Stage 5 production deployment, safe environment 복원과 비파괴 hosted smoke 결과를 승인하면 Stage 6
  release provenance와 운영 handoff로 진행한다.
