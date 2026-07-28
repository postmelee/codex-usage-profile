# Task #44 Stage 5 보고서

GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
구현계획서: [`task_m100_44_impl.md`](../plans/task_m100_44_impl.md)
Stage: 5

## 단계 목적

public registry의 exact `codex-usage-profile@0.1.0`을 production Sites
origin에서 설치해 OAuth device login, Account Usage Contract v1 submit,
private preview, publish/unpublish, revoke/logout을 end-to-end로 검증한다.
승인된 test owner의 D1/R2·session·token·local artifact를 exact cleanup하고
사용자 문서를 실제 공개 상태로 전환한다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `README.md` | public npm `0.1.0`, provenance와 production smoke 완료 상태 명시 |
| `packages/codex-usage-profile-cli/README.md` | 공개 package와 production 검증 상태를 package 문서에 반영 |
| `docs/cli-submit.md` | #44 이전의 source/tarball 전용 안내를 현재 npm quickstart로 전환 |
| `docs/readme-card.md` | npm 공개 전 미래형 CLI 안내를 현재형으로 전환 |
| `docs/npm-release.md` | production device/submit/publish/revoke와 exact cleanup 완료 기록 |
| `mydocs/orders/20260728.md` | Stage 5 완료·보고 승인 대기로 상태 갱신 |
| production Sites saved version 7 | environment revision 13, maintenance disabled, service normal로 최종 재배포 |
| disposable Gate C owner | 승인된 plan digest와 object count 18로 D1/R2 exact cleanup |

## 본문 변경 정도 / 본문 무손실 여부

runtime source, published `0.1.0` version, canonical/recovery tag와 registry
artifact는 변경하지 않았다. 사용자 문서에서 npm 공개 전의 미래형 표현만
현재 공개·검증 상태로 바꾸고 기존 source/tarball 개발 절차, privacy
boundary와 운영 복구 절차는 보존했다.

`packages/codex-usage-profile-cli/README.md`의 Stage 5 문구는 이후 source
candidate에는 포함되지만 이미 공개된 immutable `0.1.0` tarball을
변경하지 않는다. 따라서 Stage 4에서 고정한 registry integrity가 진실
원천이며, 현재 checkout의 `verify:npm-release` digest는 문서 변경을 포함한
향후 source candidate다.

## production smoke와 cleanup

### 공개 package와 사용자 흐름

- 격리 npm cache의 `npx --yes codex-usage-profile@0.1.0 --help`가 registry
  package를 설치하고 production 기본 origin
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`를
  출력했다.
- exact package의 device login과 GitHub browser 승인이 성공했고 status는
  metadata만 출력했다.
- Account Usage Contract v1 집계만 submit했다. prompt, response, tool
  data, Codex/OpenAI/GitHub credential과 로컬 Codex session file은
  전송하지 않았다.
- submit 직후 owner profile은 private이었고 공개 JSON·PNG는 `404`,
  authenticated private preview는 정상 렌더링됐다.
- 임시 publish 뒤 공개 HTML·JSON allowlist와 영문/한국어 stable PNG의
  `GET`, `HEAD`, distinct ETag를 확인했다. 영문 conditional request는
  `304`, cache contract는 `public, no-cache, must-revalidate`였다.
- 즉시 unpublish한 뒤 공개 JSON과 stable PNG가 다시 `404`가 됐다.
- Settings에서 CLI token을 revoke한 뒤 packed CLI status가 revoked
  credential을 거부했고 logout으로 로컬 credential을 제거했다. 최종
  active token은 0건이다.

### fail-closed cleanup과 Gate C-R

- 첫 cleanup dry-run은 owner/handle/owner count는 일치했지만 사전 산정
  17과 달리 16 objects를 반환했다. 승인 조건대로 export/delete를 실행하지
  않고 operator secret을 교체해 maintenance를 disabled로 원복하고 saved
  version 7을 environment revision 11로 재배포했다.
- 대상 확인용 일회성 token을 revoke하기 위한 login/logout으로 OAuth와
  session 행 2개가 추가될 것을 산정하고 Gate C-R에서 object count 18을
  별도 승인받았다.
- Gate C-R fresh plan은 세 번 모두 owner count 1, object count 18과 같은
  digest를 반환했다. backup은 mode `0600`, owner
  `postmelee`, visibility `private`, stable state `unpublished`였고 1 owner,
  1 usage, 1 submitted device, 1 unpublished stable state의 4 objects와
  일치했다.
- 승인된 digest/count로 exact delete를 적용한 뒤 같은 owner plan은
  `not_found`였다. 공개 JSON과 PNG도 `404`였다.
- disposable backup, owner reference, 격리 HOME/XDG/product config와 npm
  cache를 영구 폐기했다. owner id, token, session id, backup payload와
  실제 usage 값은 저장소·보고서에 기록하지 않았다.
- maintenance 종료 때 operator secret을 다시 교체했다. final Sites
  environment revision 13은 `PROFILE_MAINTENANCE_MODE=disabled`,
  `PROFILE_SERVICE_MODE=normal`이며 saved version 7을 재배포했다.
- 최종 landing과 `/healthz`는 `200`, 삭제된 public profile·card와 인증
  없는 maintenance route는 `404`였다. 최근 30분 Worker error log는
  0건이었다.

## 검증 결과

실행 명령:

```bash
env npm_config_cache=<isolated-cache> \
  npx --yes codex-usage-profile@0.1.0 --help
npm test --workspace packages/codex-usage-profile-cli
npm run test:e2e
npm run verify:npm-release
npm test -- --test-concurrency=1
git diff --check
```

production 원격 확인:

```text
exact package login -> status -> submit -> private preview
publish -> public HTML/JSON -> en/ko GET/HEAD -> conditional 304
unpublish -> revoke -> revoked status rejection -> logout
plan x3 -> export -> exact delete -> not_found
maintenance disable -> saved version 7 deploy -> final 200/404 checks
```

결과:

- OK — exact npm package help와 production default origin 일치.
- OK — CLI workspace test 46/46 통과.
- OK — Playwright E2E 16/16 통과.
- OK — full test는 local sandbox의 workerd subprocess 제한을 피하기 위해
  단일 concurrency와 허용된 실행 환경에서 487개 중 481개 통과, 6개
  integration setting 미구성 skip, 실패 0건.
- OK — `npm run verify:npm-release`는 문서 변경을 포함한 현재 source
  candidate 13개 entry를 검증했다. published `0.1.0` registry integrity는
  Stage 4의 immutable artifact와 provenance를 유지한다.
- OK — production OAuth/device/submit/status/private/public/unpublish와
  token/session/local credential cleanup 완료.
- OK — Gate C-R exact D1/R2 delete와 종료 후 owner `not_found` 확인.
- OK — final environment revision 13, maintenance disabled, service normal,
  landing/health `200`, deleted public surfaces/operator route `404`.
- OK — recent Worker error event 0건.
- OK — `git diff --check` 통과.

## 잔여 위험

- published `0.1.0` tarball README는 immutable이므로 Stage 5의 현재 상태
  문구를 포함하지 않는다. 기능·보안 오류는 아니며 package 내 문구 갱신이
  필요하면 같은 version을 덮어쓰지 않고 patch version으로 처리한다.
- npm `@latest`는 미래 version을 가리킬 수 있으므로 automation은
  `0.1.0`처럼 exact version을 고정해야 한다.
- 다음 version의 tokenless staged publishing과 npm 2FA 최종 승인은 실제
  version release에서 다시 end-to-end 검증해야 한다.
- Sites beta의 가격, quota와 제품 정책은 바뀔 수 있다. 이번 Stage에서
  추가 과금·plan upgrade 요구는 관찰되지 않았지만 영구 보장은 아니다.

## 다음 단계 영향

- Stage 6은 public npm `0.1.0`, production Sites origin과 end-to-end smoke를
  release evidence로 사용해 최종 release 판정을 내린다.
- Stage 6 시작 상태는 maintenance disabled, smoke owner/session/token/D1/R2
  data 0 remaining이며 public landing과 health만 정상 제공된다.
- #45 handoff에는 exact package/version, production origin, immutable
  registry integrity, tokenless staged publishing과 exact cleanup 완료
  상태를 전달한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 Stage 6 release 판정과 #45
  handoff로 진행한다.
