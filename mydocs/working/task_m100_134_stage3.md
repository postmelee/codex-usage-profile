# Task #134 Stage 3 완료보고서 — 웹 빈 상태와 사용자 문서 정합성

GitHub Issue: [#134](https://github.com/postmelee/codex-usage-profile/issues/134)
구현계획서: [`task_m100_134_impl.md`](../plans/task_m100_134_impl.md)
Stage: 3

## 단계 목적

Profile에 제출된 사용량이 없는 사용자가 `submit` 한 명령으로 필요 시 browser approval을 거쳐 제출을
완료할 수 있다는 실제 CLI 동작을 이해하도록 영어·한국어 빈 상태 문구를 보정한다. 기기 승인 화면은
승인 성공 뒤 불필요해진 setup guide를 숨겨 완료 안내의 후속 탐색 링크와 위계를 분리한다. 루트 README와
npm README의 Commands를 사용자 중심 표로 통일하고, 상세 CLI 가이드에는 Stage 1 재인증과 Stage 2
help 계약을 정확히 기록한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/DeviceApprovalPage.jsx` | 승인 전 setup guide 유지, 승인 성공 뒤 조건부 숨김 |
| `src/profile-ui/messages.js` | 영어·한국어 첫 카드 제목과 one-command browser approval/submit 설명 보정 |
| `tests/profile-ui.spec.js` | 영어 exact copy, runtime 한국어 전환, 승인 전/후 setup guide와 기존 empty-state geometry 회귀 검증 |
| `README.md` | Quick start 재인증 설명과 6행 사용자 중심 Commands 표 추가 |
| `packages/codex-usage-profile-cli/README.md` | npm Quick start와 루트 README와 같은 Commands 표·순서로 정합화 |
| `docs/cli-submit.md` | command별 help, 고급 option, file/environment credential 복구와 JSON 채널 상세화 |
| `mydocs/orders/20260825.md` | Stage 3 완료와 Stage 4 승인 대기 상태 기록 |
| `mydocs/working/task_m100_134_stage3.md` | Stage 3 구현·검증·잔여 위험 기록 |

초기 Stage 3 변경량은 `README.md` 9줄 추가·11줄 제거, npm README 10줄 추가·9줄 제거,
`docs/cli-submit.md` 32줄 추가·5줄 제거, `messages.js` 4줄 추가·4줄 제거,
`profile-ui.spec.js` 23줄 추가·2줄 제거다. 승인 뒤 UI 위계 보정에서는 `DeviceApprovalPage.jsx`에
조건부 렌더링을 추가하고 `profile-ui.spec.js`에 영어·한국어 승인 전/후 assertion 3개를 추가했다.

## 본문 변경 정도 / 본문 무손실 여부

공식 문서는 기존 Quick start, requirements, privacy, stable README URL, social revision, star prompt와
troubleshooting 구조를 보존하고 이번 task의 Commands·재인증·help 부분만 국소 수정했다.

- 루트·npm README는 코드 블록 Commands를 같은 순서의 `Command | What it does` 표로 바꿨다.
- 공개 표에는 `submit`, `login`, `status`, `logout`, `-h/--help`, `-v/--version`만 두고 `--server`,
  `CODEX_USAGE_PROFILE_URL`과 credential 저장 세부를 추가하지 않았다.
- 상세 `docs/cli-submit.md`에만 `--server`, timeout/JSON, command help, `-help` 비지원, file 401/410
  자동 재승인 1회, environment token unset과 JSON stderr/stdout 분리를 기록했다.
- Profile은 message catalog의 제목·설명만 바꿨다. 기기 승인 화면의 setup guide는 승인 전에는 유지하고
  승인 성공 뒤에만 숨긴다. command box, copy feedback, privacy, loading/error state, CSS, responsive
  geometry와 social preview metadata는 변경하지 않았다.
- README card의 queryless fixed URL과 social revision URL 계약은 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js
npx playwright test tests/profile-ui.spec.js --grep "owner Profile loading, empty, and error states keep one visual heading|locale"
rg -n "codex-usage-profile@latest (submit|login|status|logout)|--help|--version" README.md packages/codex-usage-profile-cli/README.md docs/cli-submit.md
git diff --check
```

결과:

- OK — CLI test 25개 통과, 실패·취소·skip 0개.
- OK — Profile/locale Playwright E2E 11개 통과, 실패·skip 0개.
- OK — 영어 empty state가 `Create your first Codex card`와 browser approval/submit 연속 동작을
  표시한다.
- OK — runtime 한국어 전환 뒤 `첫 Codex 카드를 만들어 보세요`, 한국어 설명과 같은 submit command를
  표시한다.
- OK — 영어·한국어 기기 승인 화면에서 setup guide가 승인 전 노출되고 승인 성공 뒤 제거된다.
- OK — 승인 성공 안내의 `Home`·`Profile` 링크와 submit intent 안내는 그대로 유지된다.
- OK — heading 1개, command copy, setup guide, privacy, desktop 72px/mobile 48px offset과 horizontal
  overflow 부재가 유지됐다.
- OK — 루트·npm README의 command 명칭·순서와 help/version alias가 일치한다.
- OK — 공개 README 두 곳에는 `--server`와 `CODEX_USAGE_PROFILE_URL`이 없고 상세 가이드에만 존재한다.
- OK — 상세 가이드가 file/environment 401/410, 동일 captured document 1회 재시도와 JSON output channel을
  Stage 1 구현과 동일하게 설명한다.
- OK — `git diff --check` 경고 없음.

Playwright 최초 실행은 sandbox가 local test server의 `127.0.0.1:5315` bind를 허용하지 않아 source test
전에 중단됐다. 승인된 local test server 권한으로 같은 명령을 다시 실행해 11개 모두 통과했으며,
remote Site나 production 환경은 변경하지 않았다. 분리 worktree dependency 연결도 검증 뒤 제거했다.

## 잔여 위험

- 실제 npm pack 산출물에 변경된 package README와 help가 포함되는지는 Stage 4 package smoke에서
  검증한다.
- 전체 Profile/Home/Settings/Share Studio E2E와 Sites artifact build·verifier는 Stage 4에 남아 있다.
- 운영 사이트와 npm package는 이번 Stage에서 배포하지 않았다. 최종 보고 뒤 별도 release gate가
  필요하다.
- `--server`는 실제 CLI help와 상세 가이드에는 남지만 일반 사용자의 공개 Commands 표에는 의도적으로
  노출하지 않는다.

## 다음 단계 영향

- Stage 4는 제품 source와 공식 문서를 더 수정하지 않고 전체 Node test, 전체 Playwright,
  local npm package smoke, Sites full-stack build·verifier를 수행한다.
- package smoke에서 packed CLI의 global/command help와 npm README 포함 여부를 확인한다.
- 제외 path 검사로 backend, credential schema, package version과 hosting manifest 무변경을 확인한다.
- Sites capability path를 유지하되 task 제외 범위에 따라 remote deploy·hosting mutation은 수행하지
  않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 package·Sites 통합 회귀와 release 인계 검증으로
  진행한다.
