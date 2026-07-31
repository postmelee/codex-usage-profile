# Task M100 #59 Stage 4.2 완료보고서

GitHub Issue: [#59](https://github.com/postmelee/codex-usage-profile/issues/59)
구현계획서: [`task_m100_59_impl.md`](../plans/task_m100_59_impl.md)
Stage: 4.2

## 단계 목적

PR #62 review에서 확인된 두 방어 경계를 Task #59의 기존 제품 계약을
바꾸지 않고 보정한다.

- `login` intent 안내가 예상하지 못한 origin 때문에 render 단계에서
  중단되지 않도록 command 없는 terminal 안내로 fallback한다.
- approving/success의 polite live region과 error의 assertive alert를
  형제 영역으로 분리해 중첩 announcement 가능성을 없앤다.

D1 migration 배포 순서, migration manifest 중복과 canonical Sites origin
중복은 제품 운영·유지보수 범위이므로 이 Stage에 섞지 않고 후속 이슈로
분리한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/deviceApproval.js` | 잘못된 current origin의 login guidance를 command 없는 일반 완료 안내로 fallback |
| `src/profile-ui/DeviceApprovalPage.jsx` | polite live region과 error alert를 형제 영역으로 분리 |
| `src/profile-ui/__tests__/deviceApproval.test.js` | `null`, `javascript:` origin의 render-safe fallback 검증 |
| `tests/profile-ui.spec.js` | assertive alert가 polite live region 안에 중첩되지 않는지 검증 |
| `mydocs/plans/task_m100_59_impl.md` | 승인된 Stage 4.2 범위·검증·커밋 계획 반영 |
| `mydocs/orders/20260731.md` | Task #59를 Stage 4.2 완료로 갱신 |
| `mydocs/working/task_m100_59_stage4_2.md` | review 보정과 검증 결과 기록 |
| `mydocs/report/task_m100_59_report.md` | 최종 범위·검증·후속 작업을 최신 HEAD 기준으로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

정상 production origin과 loopback origin의 submit command는 변경하지
않았다. `buildDeviceSubmitCommand`를 직접 호출할 때의 strict input
validation도 유지하고, component가 사용하는 guidance 생성 경로에서만
잘못된 origin을 일반 완료 안내로 낮춘다. 따라서 URL 또는 command
injection을 허용하지 않으면서 승인 완료 화면 전체가 사라지는 경우를
막는다.

device approval state machine, backend/API 응답, token exchange,
retry/terminal error 분류, input/button terminal lock, clipboard와
navigation/storage 부작용 금지 계약은 변경하지 않았다. 오류 문구의
`role="alert"`도 유지하고 polite 영역 밖으로만 이동했다.

`.openai/hosting.json`, runtime/storage, D1/R2 schema와 production deploy
문서는 변경하지 않았다.

## 검증 결과

계획된 집중 검증:

```bash
node --test src/profile-ui/__tests__/deviceApproval.test.js
npm run build
npm run test:e2e -- --grep "device approval"
git diff --check
git diff 44cace0 -- .openai/hosting.json
```

결과:

- OK — device approval helper unit: 5 tests, 5 pass, 0 fail.
- OK — standard Vite build: 42 modules transformed.
- OK — focused Playwright: 4 tests, 4 pass, 0 fail.
- OK — invalid origin에서 command를 만들지 않고 일반 terminal 복귀 안내를
  반환하며 strict command helper 검증은 유지한다.
- OK — retryable error alert가 polite live region의 descendant가 아니다.
- OK — `git diff --check` 경고 없음.
- OK — Stage 4.1 commit 기준 `.openai/hosting.json` diff 없음.

최종 보고서 정합성을 위해 전체 회귀도 다시 실행했다.

- OK — `npm test`: 517 tests, 511 pass, 6 skip, 0 fail.
- OK — `npm run build:production`: Worker 47 modules, client 42 modules.
- OK — `npm run verify:sites-production`: artifact 5,492,169 bytes,
  client 7 files, Worker 2 files, D1 migrations 3, expected bindings 3,
  Worker raw 3,902,742 bytes, compressed 2,145,666 bytes.
- OK — `npm run test:e2e`: 36 tests, 36 pass, 0 fail.

검증 명령을 확인하는 과정에서 존재하지 않는
`verify:production-artifact` script를 한 번 호출해 npm이 script 없음으로
종료했다. 저장소의 실제 script인 `verify:sites-production`을 즉시
실행했고 artifact verifier가 성공했다. 제품 assertion 실패는 없었다.

## 잔여 위험

- 잘못된 origin은 command를 숨기므로 사용자는 terminal에서 현재 process의
  결과를 확인해야 한다. 이는 검증되지 않은 origin을 command에 포함하는
  것보다 안전한 fail-closed 동작이다.
- live region 구조는 DOM/E2E assertion으로 검증했다. 실제 screen reader의
  브라우저별 발화 순서는 자동화 테스트가 완전히 대체하지 않는다.
- PostgreSQL과 S3 endpoint 환경 의존 skip은 Stage 4 최종 검증과 동일하다.
  이 Stage의 UI 변경과 직접 관련되지는 않는다.

## 다음 단계 영향

- Task #59 제품 보정은 완료됐다. 최종 보고서와 PR #62 본문을 최신
  commit/검증 결과로 갱신한다.
- D1 migration-before-worker 배포 순서, migration manifest drift 방지와
  canonical Sites origin 중복은 별도 후속 이슈 초안을 만들고 작업지시자
  승인 뒤 등록한다.

## 승인 요청

- 작업지시자가 2026-07-31 같은 스레드에서 PR #62 review 보정 진행을
  승인했다. 이 보고서와 소스·계획·오늘할일·최종 보고서를 같은 Stage 4.2
  commit에 묶어 `publish/task59` PR을 갱신한다.
