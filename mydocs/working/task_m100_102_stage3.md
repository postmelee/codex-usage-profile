# Task #102 Stage 3 보고서 — 모바일 공유 문서와 전체 회귀 검증

GitHub Issue: [#102](https://github.com/postmelee/codex-usage-profile/issues/102)
구현계획서: [`task_m100_102_impl.md`](../plans/task_m100_102_impl.md)
Stage: 3

## 단계 목적

Share Studio의 desktop/mobile action 차이와 자동 게시 비보장 경계를 공식 사용자
문서에 최소 반영한다. 전체 Node·Playwright·build 회귀를 실행해 모바일 target,
provider URL, 기존 profile·card handoff·copy/download·privacy 동작이 함께 유지되는
exact candidate를 확정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/readme-card.md` | desktop 5 SNS+Save, 모바일 X·Threads·Reddit+Save, Facebook·LinkedIn 모바일 제외 사유와 공유 링크 fallback 현행화 |
| `tests/profile-ui.spec.js` | X `/intent/tweet` 통합 assertion과 Task #96 same-origin preview resource key의 stale assertion 정정 |
| `playwright.config.js` | 기존 `PROFILE_E2E_ORIGIN`을 page fixture와 Vite webServer가 함께 사용하도록 연결하고 HTTP `127.0.0.1` explicit port로 제한 |
| `mydocs/orders/20260813.md` | Stage 3 완료와 최종 보고·owner-only 실기기 배포 승인 대기 상태 반영 |
| `mydocs/working/task_m100_102_stage3.md` | Stage 3 문서·검증·잔여 위험과 #101 handoff 기록 |

## 본문 변경 정도 / 본문 무손실 여부

`docs/readme-card.md`는 기존 “검증된 릴리스 후보의 공유 흐름” 여섯 항목 중 공유
대상과 provider 경계가 바뀐 2~6번만 최소 수정했다. production baseline, #84 Gate,
공개 URL·cache·CLI·보안 계약과 나머지 본문은 재작성하지 않았다. `README.md`,
`docs/production-hosting.md`, `docs/sites-operations.md`, hosting manifest와 제품 source는
Stage 3에서 수정하지 않았다.

전체 Playwright 최초 실행은 5173 포트에서 다른 worktree의 기존 Vite 서버를
`reuseExistingServer`로 재사용해 Task #102 이전 X `/intent/post` 모듈을 읽었다. 해당
서버를 종료하지 않고 기존 `PROFILE_E2E_ORIGIN` 환경값을 config의 base URL과 webServer에
같이 적용해 5192 전용 loopback 포트에서 격리했다. 함께 발견된 Task #96 이후 상대
preview resource key의 stale 절대 URL assertion도 현재 unit·resource 계약에 맞췄다.

worktree의 초기 `node_modules`에는 font/Wasm 자산이 없어 카드 ETag 테스트가 실패했다.
lockfile 기준 `npm ci`로 로컬 ignored dependency만 복구했고 package manifest와 lockfile은
변경되지 않았다. 이후 해당 파일 6/6과 전체 Node suite가 통과했다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5192 npm run test:e2e
npm run build
git diff --check
```

결과:

- OK — 전체 Node 779개: 773 pass, 6 skip, 0 fail. skip은 `TEST_DATABASE_URL`이
  없는 Postgres 전용 fixture이며 D1·Sites·Share Studio 계약은 모두 통과했다.
- OK — 전체 Playwright 96/96 통과. iPhone 390px·Android 320px 모바일 4개 한 줄,
  좁은 desktop 6개, Share open/close·card handoff·focus·copy/download·privacy와
  Profile/Settings/Public profile 회귀를 포함한다.
- OK — X 통합 target은 `/intent/tweet`, 모바일 접근성 트리에는 X·Threads·Reddit·Save만
  있고 LinkedIn·Facebook은 없으며 desktop에는 여섯 primary action이 유지된다.
- OK — Vite production build, 1831 modules transformed. HTML·CSS·JS asset 생성 완료.
- OK — package manifest, lockfile와 `.openai/hosting.json` 변경 없음.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Playwright는 mobile UA·touch·viewport·DOM/layout을 검증하지만 설치된 iOS SNS 앱의
  실제 composer handoff는 검증하지 않는다. owner-only Sites candidate 배포 뒤
  작업지시자가 실기기에서 X·Threads·Reddit·Save를 직접 눌러야 목표가 완료된다.
- owner-only candidate 배포는 canonical Sites project의 saved version/deployment를
  변경하는 remote operation이다. exact source, 현재 owner-only access, rollback version과
  environment key 존재 여부를 read-only로 재확인하고 별도 Gate 승인 뒤에만 수행한다.
- 외부 provider 앱 버전·로그인 상태가 바뀌면 handoff 결과도 달라질 수 있다.

## 다음 단계 영향

- Stage 1~3을 승인하면 `task-final-report` 절차로 최종 보고서, 최종 커밋,
  `publish/task102` push와 `devel` 대상 PR을 준비한다.
- 모바일 실기기 검증은 public access 전환 없이 현재 custom owner-only policy를 유지한
  Sites candidate에서 수행한다. 새 Site·D1·R2를 만들거나 production public access를
  변경하지 않는다.
- #101 Stage 4는 #102 병합 후 최신 `devel`을 반영하고 mobile target filter, X path,
  Threads raw spacing과 one-row layout을 보존해야 한다.

## 승인 요청

- Stage 3 산출물과 전체 검증 결과를 승인하면 최종 보고·PR 준비와 owner-only Sites
  candidate 배포 Gate 확인으로 진행한다.
