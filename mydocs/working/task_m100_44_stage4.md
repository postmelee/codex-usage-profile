# Task #44 Stage 4 보고서

GitHub Issue: [#44](https://github.com/postmelee/codex-usage-profile/issues/44)
구현계획서: [`task_m100_44_impl.md`](../plans/task_m100_44_impl.md)
Stage: 4

## 단계 목적

Gate B와 Gate B-R에서 승인된 immutable candidate를
`codex-usage-profile@0.1.0`으로 provenance와 함께 최초 공개하고, registry
artifact를 고정 검증한다. 최초 게시 뒤에는 trusted publisher의 staged
publishing으로 전환하고 임시 npm token과 GitHub secret을 폐기한다.

## 산출물

| 파일 또는 외부 산출물 | 변경 요약 |
|---|---|
| `codex-usage-profile@0.1.0` | public package, `latest`, 13개 파일과 provenance attestation |
| `codex-usage-profile-v0.1.0` | 승인 commit `3db3fc48ede439c9d62adf5d723b044f1cd6be44`을 보존하는 canonical tag |
| `codex-usage-profile-v0.1.0-recovery.1` | npm 12 verifier 호환 수정 commit `f10ad2cb1a38568371c5467dc3a25ce29df7ae8f`의 exact recovery tag |
| `scripts/verify-npm-release.mjs` | npm 11 배열과 npm 12 object-map pack 결과를 단일 candidate로 정규화 |
| `scripts/__tests__/verify-npm-release.test.js` | 정상·빈 값·복수 값·비정상 shape의 fail-closed 회귀 검증 |
| `.github/workflows/publish-npm.yml` | one-time direct publish 경로를 제거하고 exact version tag의 tokenless `npm stage publish`로 전환 |
| `scripts/scan-public-release-surface.mjs` | tokenless staged workflow 계약을 공개 표면 scanner에 반영 |
| `scripts/__tests__/scan-public-release-surface.test.js` | direct publish, token 참조와 recovery tag 재도입을 차단 |
| `docs/npm-release.md` | 실제 최초 게시, trusted publisher, staged publishing과 credential 폐기 상태 기록 |
| `mydocs/plans/task_m100_44_impl.md` | Gate B-R 실행 결과, branch preflight와 credential 폐기 증적 반영 |
| `mydocs/orders/20260728.md` | Stage 4 완료·보고 승인 대기로 상태 갱신 |

외부 설정은 npm trusted publisher를 GitHub Actions
`postmelee/codex-usage-profile`, `publish-npm.yml`, `npm-publish`로 고정하고
허용 동작을 `npm stage publish`로 제한했다. package publishing access는
2FA required, traditional token disallowed다.

## 본문 변경 정도 / 본문 무손실 여부

공개 package의 runtime source와 tarball은 Stage 3 candidate에서 변경하지
않았다. recovery commit은 package runtime이 아닌 release verifier, 회귀
test, workflow와 계획 증적을 수정했으며 registry tarball의 SHA-1, SHA-512,
파일 수와 크기가 Stage 3 candidate와 동일하다. future workflow 변경은 이후
version의 인증·승인 경로만 tokenless staged publishing으로 바꾸며 현재
`0.1.0` 동작을 변경하지 않는다.

## 검증 결과

격리된 HOME, XDG config와 npm cache에서 실행한 Stage 4 검증 명령:

```bash
npm view codex-usage-profile@0.1.0 --json
npm view codex-usage-profile dist-tags --json
npm pack codex-usage-profile@0.1.0 --json
npx --yes codex-usage-profile@0.1.0 --help
npm audit signatures
npm run verify:npm-release
git diff --check
```

결과:

- OK — registry에는 `0.1.0` 한 version이 public으로 존재하고
  `latest`가 `0.1.0`을 가리킨다.
- OK — registry `gitHead`는 recovery commit
  `f10ad2cb1a38568371c5467dc3a25ce29df7ae8f`, publish 환경은 Node
  `24.18.0`과 npm `12.0.1`이다.
- OK — tarball은 13개 파일, packed `14,221` bytes, unpacked `49,887`
  bytes다.
- OK — SHA-1은
  `a1d30872a6677e9b781e64e14f7ad9040ee92e0d`, SHA-512는
  `sha512-jvMb8nnIUpMEep8+qq7Y99MfEQsq3H8QEv5x1EL6TIeJ3kDKfC2kSNbOAQW8FnY6Gdj+KZ13khESbFgrzk2wEw==`로
  local verifier와 일치한다.
- OK — `npx` exact version의 help, bin과 production default origin
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`를
  확인했다.
- OK — `npm audit signatures`는 124개 package의 registry signature와
  53개 package의 attestation을 검증했다.
- OK — recovery publish
  [run 30352705791](https://github.com/postmelee/codex-usage-profile/actions/runs/30352705791)은
  Node 20·22·24 검증과 provenance publish가 모두 성공했다.
- OK — tokenless source 전환
  [run 30354405611](https://github.com/postmelee/codex-usage-profile/actions/runs/30354405611)은
  Node 20·22·24 검증이 성공했고 branch publish job은 의도대로 skip됐다.
- OK — SLSA provenance는 public repository, recovery tag,
  `.github/workflows/publish-npm.yml`과 recovery commit을 가리킨다.
- OK — npm 임시 granular token은 삭제 후 목록 0건, GitHub
  `npm-publish` environment secret은 삭제 후 목록 0건이다. raw token과
  secret 값은 조회하지 않았다.
- OK — `git diff --check` 통과.

## 잔여 위험

- Stage 4의 package integrity, provenance, registry 고정과 credential
  폐기에 release blocker는 없다.
- published CLI의 실제 production OAuth, usage submit, publish/revoke와
  종료 cleanup은 아직 실행하지 않았다. 이는 Gate C의 데이터 범위와
  cleanup 승인을 받은 뒤 Stage 5에서만 수행한다.
- trusted publisher의 설정과 `npm stage publish` 계약은 확인했지만 다음
  신규 version의 npm staged approval 전체 흐름은 그 version 릴리스에서
  다시 검증해야 한다.

## 다음 단계 영향

- Stage 5는 반드시 별도 Gate C 승인을 받은 뒤
  `codex-usage-profile@0.1.0`을 isolated 환경에서 설치해 production
  OAuth·submit·publish·revoke를 검증한다.
- Gate C 전송 범위는 Account Usage Contract v1 집계 필드로 제한하고
  prompt, response, tool data, Codex/OpenAI/GitHub credential과 로컬 Codex
  session file은 제외한다.
- Stage 5 종료 시 생성한 browser session, CLI token, test owner data와
  publication을 승인된 cleanup 계획대로 제거하거나 명시 승인된 홍보
  profile만 보존한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 별도 Gate C 승인 입력을 제시하고
  Stage 5로 진행한다.
