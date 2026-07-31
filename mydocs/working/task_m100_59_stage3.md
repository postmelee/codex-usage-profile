# Task M100 #59 Stage 3 완료보고서

GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
구현계획서: [`task_m100_59_impl.md`](../plans/task_m100_59_impl.md)
Stage: 3

## 단계 목적

device 승인 화면을 request가 끝나면 사라지는 일회성 메시지가 아니라
component lifetime 동안 유지되는 terminal success 상태로 전환한다.
승인 응답의 `approved`와 `exchanged`를 모두 성공으로 처리하고, Stage 1의
`submit | login | null` intent에 따라 사용자가 terminal에서 이어서 할
행동을 명확하게 안내한다.

빠른 중복 입력, retryable/terminal error, clipboard 실패, keyboard,
mobile과 reduced-motion을 하나의 상태 모델로 다룬다. 브라우저는 자동
redirect, 자동 clipboard, command 실행과 storage write를 하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/deviceApproval.js` | terminal status, intent, 오류 분류, 안내와 안전한 submit command pure helper |
| `src/profile-ui/__tests__/deviceApproval.test.js` | status/intent/error와 production/local origin command 단위 검증 |
| `src/profile-api/client.js` | device authorize 4필드 allowlist 응답 소비 |
| `src/profile-api/__tests__/client.test.js` | 새 authorize 응답 shape와 session request 계약 검증 |
| `src/profile-ui/DeviceApprovalPage.jsx` | in-flight guard, terminal UI, manual retry/copy, live/error semantics와 same-origin links |
| `src/styles.css` | 고정 feedback 공간, success/button/command UI, 240ms transition과 reduced-motion/mobile 규칙 |
| `tests/profile-ui.spec.js` | desktop/mobile, keyboard, double click, 오류, intent 3종, clipboard, storage/navigation focused E2E |
| `mydocs/orders/20260731.md` | Stage 3 완료보고 승인 대기로 상태 갱신 |
| `mydocs/working/task_m100_59_stage3.md` | Stage 3 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 기존 GitHub
로그인 링크와 user code 입력 방식, session 기반 승인 호출을 보존했다.
Home, profile, settings, Share Studio, Account Usage와 card media 코드는
변경하지 않았다.

승인 중에는 ref와 disabled state가 함께 중복 request를 막고, 성공 후에는
input과 `Approved` button을 비활성화한다. retryable 범위는 status `0`,
`429`, `5xx`로 제한하며 그 밖의 오류는 code가 바뀔 때까지 button을
잠근다.

`login` intent의 command는 고정 npm command와 `location.origin`만
사용한다. canonical production origin에서는 기본 command를, 다른
origin에서는 query/hash를 제거한 `--server <origin>`을 표시한다.
`submit`은 현재 CLI process가 계속된다고 안내하고, `null`은 특정 command
없이 terminal 복귀만 안내한다.

success motion은 Corporate easing `cubic-bezier(0.2, 0, 0, 1)`의 240ms
작은 content transition 하나로 제한했다. feedback 공간을 미리 확보하고
reduced-motion에서는 animation과 transform을 모두 제거한다.

## 검증 결과

실행 명령:

```bash
/Users/melee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test \
  src/profile-api/__tests__/client.test.js \
  src/profile-ui/__tests__/deviceApproval.test.js

node_modules/.bin/npm run build

node_modules/.bin/npm run test:e2e -- --grep "device approval"

git diff --check
```

결과:

- OK — API client/pure helper suite: 23 tests, 23 pass, 0 fail.
- OK — Vite production build: 42 modules transformed, build 완료.
- OK — focused Playwright: 4 tests, 4 pass, 0 fail.
- OK — desktop에서 동기 double click이 authorize request 1건만 만들고
  `aria-busy`, disabled input/button와 check icon+`Approved`로 수렴함을
  확인.
- OK — mobile keyboard 승인, local `--server http://127.0.0.1:5173`
  command, clipboard 실패/재시도 성공과 horizontal overflow 부재 확인.
- OK — reduced-motion에서 success animation `none` 확인.
- OK — `submit`, `login`, `null` intent와 `approved`/`exchanged` terminal
  status를 모두 검증.
- OK — `503` manual retry는 같은 code로 성공하고 `400` terminal error는
  button을 잠그며 input 변경 후 idle로 복구됨을 확인.
- OK — 승인 후 URL 불변, relative Home/Profile link, local/session storage
  write 부재와 command의 user code/query/hash 부재 확인.
- OK — `git diff --check` 경고 없음.
- 초기 작업 shell에는 `npm`과 Playwright Chromium이 없어 bundled package
  runner용 ignored wrapper와 Chromium v1234를 검증 환경에 준비했다.
  repository dependency와 lockfile에는 변경이 없다.

## 잔여 위험

- focused Playwright는 authorize API를 응답 shape별로 mock했다. Stage 2가
  backend 서비스/HTTP/D1 경계를 별도로 검증했지만 실제 GitHub OAuth부터
  브라우저 승인과 CLI poll까지의 전체 process는 Stage 4 통합 회귀에서
  다시 확인해야 한다.
- production Sites artifact와 실제 배포 UI는 아직 검증하지 않았다. 이
  task의 승인 범위대로 Stage 3에서는 production deploy를 수행하지 않았다.
- 자동 Home redirect는 의도적으로 추가하지 않았다. terminal 상태는
  사용자 선택인 Home/Profile link 또는 terminal 복귀 전까지 유지된다.

## 다음 단계 영향

- Stage 4는 `docs/cli-submit.md`와 package README에 세 intent의 승인 후
  행동, local `--server`, 무자동 redirect/clipboard/command 실행 경계를
  기록해야 한다.
- root test, standard/production build, Sites artifact verifier와 전체
  Playwright로 Stage 1~3 및 #55/Home/profile/settings 회귀를 확인해야 한다.
- `.openai/hosting.json`, account usage, renderer/card media와
  R2/publication source diff가 비어 있어야 하며 production deploy와
  database migration은 계속 제외한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 — 공식 CLI 문서와 전체
  통합 회귀·Sites artifact 검증으로 진행한다.
