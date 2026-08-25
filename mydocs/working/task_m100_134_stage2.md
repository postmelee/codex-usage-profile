# Task #134 Stage 2 완료보고서 — 전역·명령별 help와 오류 탐색성

GitHub Issue: [#134](https://github.com/postmelee/codex-usage-profile/issues/134)
구현계획서: [`task_m100_134_impl.md`](../plans/task_m100_134_impl.md)
Stage: 2

## 단계 목적

CLI의 전역 help와 `login`, `status`, `submit`, `logout`별 help를 실제 지원 option에 맞추고, unknown
command와 unknown/missing/unsupported option 오류가 사용자를 올바른 help 명령으로 안내하도록 한다.
help/version과 parser 오류가 credential, network client 또는 analyzer side effect를 만들지 않으며
기존 command·option 호환성을 유지하는 것을 테스트로 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/cli.js` | command·option 정의 기반 전역/명령별 usage 생성, parser의 command help와 invalid-input hint 추가 |
| `packages/codex-usage-profile-cli/test/cli.test.js` | 4개 command × 2개 help alias, option 노출, 무부작용, invalid input·redaction matrix 추가 |
| `mydocs/orders/20260825.md` | Stage 2 완료와 Stage 3 승인 대기 상태 기록 |
| `mydocs/working/task_m100_134_stage2.md` | Stage 2 구현·검증·잔여 위험 기록 |

소스 변경량은 `cli.js` 121줄 추가·23줄 제거, `cli.test.js` 112줄 추가다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. `login`, `status`, `submit`, `logout` command와
`--server`, `--timeout`, `--json`, `-h/--help`, `-v/--version`의 기존 실행 의미는 유지했다. Stage 1의
재인증, credential, analyzer memoization과 JSON output orchestration은 수정하지 않았다.

변경 범위는 다음과 같다.

- command 설명과 option syntax·설명을 정의 객체에 모으고 전역·명령별 usage를 같은 정의에서 생성한다.
- 빈 argv와 전역 `-h/--help`는 전역 usage, valid command 뒤 `-h/--help`는 해당 command usage를
  credential load 전에 반환한다.
- `login`은 network option, `status`·`submit`은 network option과 `--json`, `logout`은 help만
  표시한다.
- 전역 `-v/--version`과 기존 command 뒤 version 인식은 유지한다.
- unknown command는 전역 help, command의 unknown/missing/unsupported option은 해당 command help
  실행 예를 stderr에 덧붙인다.
- 비표준 `-help`는 alias로 허용하지 않고 unknown option + 표준 `--help` 안내로 처리한다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js
git diff --check
```

결과:

- OK — CLI test 25개 통과, 실패·취소·skip 0개.
- OK — `login`, `status`, `submit`, `logout`의 `-h`와 `--help` 8개 조합이 모두 exit 0이다.
- OK — command별 help가 지원하는 `--server`, `--timeout`, `--json`만 표시하며 `logout`은 network
  option을 표시하지 않는다.
- OK — 전역·명령별 help에서 credential load, client 생성과 analyzer 호출이 모두 0회다.
- OK — unknown command, `-help`, missing value, unsupported `--json`, logout network option이 exit 1을
  유지하고 전역 또는 해당 command의 실행 가능한 help 명령을 안내한다.
- OK — `cup_` prefix의 unknown option은 `[redacted]`로 출력되고 원문은 stderr에 노출되지 않는다.
- OK — 전역 version과 기존 command 뒤 version parsing 호환성을 유지했다.
- OK — 실제 bin으로 전역, `submit`, `logout` help와 `submit -help` 출력을 확인했다.
- OK — `git diff --check` 경고 없음.

분리 worktree의 test 실행에는 주 worktree에 이미 설치된 dependency directory를 임시로 참조했고,
검증 뒤 연결을 제거해 task 산출물에는 남기지 않았다.

## 잔여 위험

- 공개 README와 npm README는 아직 기존 Commands code block이므로 Stage 3에서 새 help 표면과 맞춰야
  한다.
- 웹 빈 Profile은 아직 browser approval과 submit 연속 동작을 설명하지 않으므로 Stage 3 보정이
  필요하다.
- CLI help에는 실제 고급 option인 `--server`가 표시된다. 승인된 계약대로 공개 README에서는 이를
  일반 command 표에 노출하지 않고 `docs/cli-submit.md`에서만 상세 설명한다.

## 다음 단계 영향

- Stage 3의 루트·npm README Commands 표는 `submit`, `login`, `status`, `logout`, `--help`/`-h`,
  `--version`/`-v`를 이번 Stage의 명칭과 의미에 맞춰야 한다.
- `docs/cli-submit.md`에는 command별 `<command> --help`와 비표준 `-help` 비지원, Stage 1의 file/environment
  credential 복구 경계를 기록한다.
- Profile EN/KO copy는 `submit` 하나가 필요 시 browser approval을 안내하고 제출까지 이어간다는
  기대만 설명하며 CLI option을 노출하지 않는다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 웹 빈 상태와 사용자 문서 정합성 보정으로 진행한다.
