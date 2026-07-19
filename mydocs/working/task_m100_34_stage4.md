# Task M100 #34 Stage 4 보고서

GitHub Issue: [#34](https://github.com/postmelee/codex-usage-profile/issues/34)
구현계획서: [`task_m100_34_impl.md`](../plans/task_m100_34_impl.md)
Stage: 4

## 단계 목적

실제 local runtime과 GitHub OAuth 세션에서 anonymous login 진입, Home 복귀, 인증 사용자 Quickstart, command 복사, Profile과 Settings 이동을 smoke 검증했다. desktop/mobile visual, landing DOM allowlist, browser console과 공식 CLI 문서 일관성을 함께 점검하고 보안 조건을 E2E 회귀로 고정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `tests/profile-ui.spec.js` | 인증 Home DOM에서 내부 owner id, token digest, device secret, storage path와 raw token prefix가 노출되지 않는 회귀 검증 추가 |
| `mydocs/orders/20260719.md` | Stage 4 완료와 최종 보고 승인 대기 상태 기록 |

`docs/cli-submit.md`와 `README.md`는 현재 계약이 정확해 수정하지 않았다. 기본 사용자 명령은 `npx codex-usage-profile@latest submit`이고, `--yes`는 정확한 version을 고정한 unattended automation 예시에만 남아 있다.

## 본문 변경 정도 / 본문 무손실 여부

제품 문구, landing component와 공식 CLI 문서 본문은 변경하지 않았다. Stage 4의 소스 변경은 인증 Home DOM의 내부 값 비노출을 검증하는 E2E assertion에 한정하며 기존 Home, Profile, Settings와 public card 동작을 보존한다.

## 실제 runtime 검증

검증 환경:

- local runtime: `http://127.0.0.1:5177`
- browser: Firefox의 기존 GitHub 로그인 세션
- OAuth 시작 위치: `/`

결과:

- OK — anonymous Home의 GitHub login이 OAuth provider로 이동하고 callback 후 `/`로 복귀했다.
- OK — 인증 Home에서 GitHub avatar, `Taegyu Lee`, `@postmelee`, `View profile`과 account menu가 표시됐다.
- OK — Quickstart가 `npx codex-usage-profile@latest submit`을 표시하고 `Copy submit command` 실행 후 `Command copied.` 상태를 노출했다.
- OK — 상단 `Profile` 링크가 `/profile`로 이동했다.
- OK — account menu의 `Settings`가 `/settings`로 이동하고 GitHub 동기화 identity를 유지했다.
- OK — 새 임시 runtime store에는 usage, API token과 device가 없으므로 Profile의 `No usage submitted yet`, Settings의 `0 / 3`, `No API tokens yet.`, `No devices yet.`가 표시됐다.

실제 CLI submit은 본 Stage에서 반복하지 않았다. package와 production service 배포는 계획 범위 밖이며, local device login과 submit 계약은 기존 CLI 통합 검증 대상이다. 따라서 새 임시 store의 usage 미존재는 landing 결함이 아니라 submit 전 상태다.

## 시각·접근성·보안 점검

- OK — 1280x900 desktop에서 card가 첫 화면의 중심 신호이고 header, identity, card와 Quickstart 시작 부분이 같은 frame에 표시됐다.
- OK — 390x844 mobile에서 document horizontal overflow 없이 card와 command surface가 viewport 안에 유지되고 frame 내부 scroll로 단계 목록에 접근 가능했다.
- OK — card/background contrast, outline과 shadow가 유지되고 중첩 card 또는 incoherent overlap이 없었다.
- OK — 실제 anonymous landing console에 warning/error가 없었다.
- OK — 실제 landing DOM에서 `tokenDigest`, `deviceSecret`, `ownerId`, `storagePath`, raw token prefix를 발견하지 않았다.
- OK — 인증 Home E2E가 같은 내부 값의 DOM 비노출을 회귀로 고정한다.
- OK — anonymous 상태는 실행 command와 GitHub owner identity를 노출하지 않는다.

## 문서·명령 일관성

검색 명령:

```bash
rg -n -- "npx codex-usage-profile@latest submit|--yes|-y" src/profile-ui tests/profile-ui.spec.js docs/cli-submit.md README.md
rg -n "credential|tokenDigest|deviceSecret|ownerId|storagePath" src/profile-ui tests/profile-ui.spec.js
```

결과:

- OK — landing, unit/E2E와 사용자 문서의 기본 명령이 `npx codex-usage-profile@latest submit`으로 일치한다.
- OK — `--yes`는 `@latest` 기본 명령에 포함되지 않고, exact version automation 예시에만 존재한다.
- OK — device 승인 → usage submit → profile 확인 → publish → README 복사 순서가 landing과 `docs/cli-submit.md`에서 일치한다.
- OK — credential 관련 문자열은 회귀 test의 denylist와 보안 검증 문맥에만 나타나며 landing 제품 코드에는 나타나지 않는다.

## 자동 검증 결과

실행 명령:

```bash
npm test
npm run build
npm run test:e2e
git diff --check
```

결과:

- OK — Node test 272개 통과, 실패·skip 없음.
- OK — Vite production build 완료, 33개 module transform 성공.
- OK — Playwright E2E 12개 통과, 실패·skip 없음.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- npm package와 production service가 배포되기 전에는 landing의 canonical command를 공개 production endpoint에 연결해 검증할 수 없다.
- 실제 submit 직후 새 local store에서 Profile/card usage가 갱신되는 end-to-end 검증은 CLI 배포·서비스 endpoint가 준비된 release QA에서 다시 수행해야 한다.
- 다국어 번역 문자열 자체는 범위 밖이며, 현재는 wrap 가능한 layout과 고정 card renderer 회귀로만 대비한다.

## 다음 단계 영향

- Stage 1~4 구현과 검증이 모두 끝났으므로 다음 절차는 최종 보고서 작성과 PR 게시다.
- package/service 배포 선행조건은 landing 기능 결함과 분리해 최종 보고서의 잔여 위험으로 유지한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Task #34 최종 보고서 작성과 PR 게시 절차로 진행한다.
