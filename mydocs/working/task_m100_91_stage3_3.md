# Task #91 Stage 3.3 보고서 — first-run token 한도 오류 안내 보정

GitHub Issue: [#91](https://github.com/postmelee/codex-usage-profile/issues/91)
구현계획서: [`task_m100_91_impl.md`](../plans/task_m100_91_impl.md)
Stage: 3.3

## 단계 목적

수동 first-run에서 browser device approval까지 성공한 뒤 active CLI/API token 한도 때문에 token exchange가 HTTP 409로 거부될 때, generic stored-state conflict 대신 사용자가 바로 해결할 수 있는 안전한 안내를 제공한다. output hyperlink 제안은 복사 계약 판단이 필요한 별도 범위로 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/device-login.js` | device-login poll의 status 409·code `conflict`를 전용 token-limit CLI 오류와 actionable message로 정규화했다. |
| `packages/codex-usage-profile-cli/test/device-login.test.js` | credential 저장과 raw server message 노출 없이 정확한 code·message가 반환되는 회귀 test를 추가했다. |
| `packages/codex-usage-profile-cli/README.md` | active token 3개 한도, local logout과 server revoke 차이, 해결 절차를 추가했다. |
| `docs/cli-submit.md` | 반복 first-run의 token 누적 원인, 표시 message와 Settings revoke 절차를 문서화했다. |
| `mydocs/plans/task_m100_91_impl.md` | 승인된 Stage 3.3 범위·검증·완료 조건과 hyperlink 제외 판단을 기록했다. |
| `mydocs/report/task_m100_91_report.md` | 최종 산출물·정량 지표·검증·잔여 위험을 Stage 3.3 결과로 갱신했다. |
| `mydocs/orders/20260812.md` | Task #91 Stage 3.3 진행과 완료 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

- device-login poll에서 `ServiceClientError`의 code가 `conflict`이고 HTTP status가 409인 경우에만 새 message를 사용한다.
- Account Usage submit의 stale·same-time conflict, network·timeout·rate-limit retry, expired·invalid device login과 service-client의 일반 오류 sanitization은 변경하지 않았다.
- raw service message, token id·digest·수량과 credential은 출력하지 않는다. local credential은 오류 시 저장되지 않는다.
- Profile·Card·README 출력은 변경하지 않았다. Profile·Card cyan hyperlink는 권장하되 README Markdown 복사 무손실 때문에 별도 승인 범위로 분리했다.
- 신규 runtime dependency나 npm package entry는 추가하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/device-login.test.js
npm --workspace packages/codex-usage-profile-cli test
npm test -- --test-reporter=dot
npm run smoke:npm-package:local
npm run scan:public-release
git diff --check
```

결과:

- OK — device-login focused test 7개 통과, 실패·skip 0.
- OK — CLI package test 66개 통과, 실패·skip 0. 기존 submit conflict mapping test 포함.
- OK — root test 746개 중 740개 통과, 환경 의존 6개 skip, 실패 0. Miniflare/D1 local socket이 필요한 전체 검증은 샌드박스 밖에서 실행했다.
- OK — local npm package smoke의 6개 경계 통과, exact entry 14개, package id `codex-usage-profile@0.1.1`, packed 17,691 bytes, unpacked 60,944 bytes.
- OK — public release surface 2,454개 blob 검사, blocker 0, large blob skip 0.
- OK — `git diff --check` 통과.
- OK — 사용자의 실제 first-run에서 token 한도 도달 → Settings revoke → 새 device approval → star prompt → usage result 완료 시나리오를 확인했다.

## 잔여 위험

- backend의 public error envelope는 device token exchange의 세부 conflict 원인을 노출하지 않는다. 현재 해당 poll 경로에서 정상적으로 발생 가능한 409는 active token 한도이며 status와 code를 함께 확인해 범위를 제한했다. 극히 드문 storage unique conflict도 같은 안내로 정규화될 수 있다.
- CLI message는 Settings URL을 직접 출력하지 않는다. browser approval을 완료한 동일 서비스의 Settings에서 revoke하도록 두 공식 문서가 경로를 제공한다.
- 반복 수동 test에서 local `logout`만 수행하면 server token이 계속 누적된다. 이는 credential 삭제와 server revoke를 의도적으로 분리한 기존 보안 계약이다.

## 다음 단계 영향

- 이 보고서와 소스·문서를 한 커밋으로 묶어 기존 PR #93의 `publish/task91` head를 갱신하고 Node 20·22·24 CI를 재확인한다.
- Profile·Card cyan clickable hyperlink는 적용을 권장한다. README Markdown은 복사 산출물이므로 평문 유지가 권장되며, 작업지시자 승인 시 별도 Stage로 구현한다.

## 승인 요청

- 작업지시자의 `제안한 메세지 보완도 적용하고` 지시로 Stage 3.3 오류 안내 구현·검증·기존 PR 반영까지 승인된 것으로 기록한다.
