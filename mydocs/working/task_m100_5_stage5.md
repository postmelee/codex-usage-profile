# Task M100 #5 Stage 5 단계 보고서

GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
구현계획서: [`task_m100_5_impl.md`](../plans/task_m100_5_impl.md)
Stage: 5

## 단계 목적

실제 npm tarball과 임시 runtime을 사용해 `device login -> GitHub approval -> analyzer -> Account Usage submit -> owner Profile -> publish -> stable README card` 흐름을 source checkout 의존 없이 검증한다. credential 권한, raw token 비노출, revoke/logout, ETag 갱신을 확인하고 수동 QA에서 발견된 terminal verification URL의 발견 가능성을 최소 보강한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/src/device-login.js` | 지원 interactive terminal에서 verification URL만 cyan OSC 8 hyperlink로 출력하고 plain fallback 제공 |
| `packages/codex-usage-profile-cli/src/cli.js` | `submit --json` 자동 login에는 hyperlink control sequence를 비활성화하고 env/TTY 조건 전달 |
| `packages/codex-usage-profile-cli/test/device-login.test.js` | iTerm TTY, unsupported/piped fallback, ANSI 비활성화 검증 추가 |
| `packages/codex-usage-profile-cli/test/cli.test.js` | JSON submit의 auto-login이 hyperlink를 비활성화하는 orchestration 회귀 테스트 추가 |
| `packages/codex-usage-profile-cli/README.md` | clickable cyan verification URL과 plain fallback 동작 문서화 |
| `docs/cli-submit.md` | browser approval terminal UX와 JSON·pipe 안전 경계 문서화 |
| `mydocs/orders/20260713.md` | Task #5 Stage 5 완료와 최종 절차 승인 대기 반영 |

## 본문 변경 정도 / 본문 무손실 여부

Stage 1~4의 Account Usage, 인증, credential, submit 및 package 계약은 변경하지 않았다. terminal 출력은 지원 신호가 있는 interactive TTY의 verification URL에만 cyan foreground와 OSC 8을 적용한다. `Open` label 뒤와 다른 출력은 기본색으로 복원하며 JSON, pipe, `TERM=dumb`, unsupported terminal은 기존 plain URL을 그대로 유지한다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
npm run test:e2e
npm_config_cache=/private/tmp/cup-stage5.a0mNv0/npm-cache npm pack --dry-run --workspace packages/codex-usage-profile-cli --json
git diff --check
```

결과:

- OK: 전체 단위·통합 테스트 258개 통과
- OK: Playwright UI E2E 11개 통과
- OK: Vite production build 성공
- OK: dry-run tarball 13개 파일, 13,801 bytes이며 package allowlist만 포함
- OK: tracked `.env`·`.env.local` 없음. `.env.example`만 의도적으로 추적
- OK: package runtime source에서 GitHub/OpenAI/private-key secret pattern 미검출
- OK: whitespace 오류 없음

Packed CLI 실제 smoke 결과:

- OK: clean temporary prefix에 tarball과 registry `codex-usage-analyzer@0.2.0` 설치
- OK: `--help`, `--version`, `login`, `status`, `submit`, `logout` 실행
- OK: 실제 GitHub OAuth owner와 browser session으로 device login 승인
- OK: credential directory `0700`, file `0600`, service origin binding 확인
- OK: backend token record에는 digest와 metadata만 저장되고 raw token pattern 없음
- OK: 실제 analyzer가 Account Usage Contract v1을 반환하고 downstream submit accepted
- OK: CLI 성공·상태 출력에 raw token, usage 전체 값, owner id, private revision 없음
- OK: private preview `998x612`, `private, no-store`; 공개 전 stable URL `404`
- OK: publish 후 stable URL `200 image/png`, `public, no-cache, must-revalidate`; ETag revalidation `304`
- OK: 두 번째 changed submit 후 같은 URL의 ETag 변경
- OK: submitted device 1건 기록, revoked token의 status/submit 거부, logout 후 credential file 제거
- OK: 사용자가 iTerm2에서 packed CLI submit 성공과 URL-only cyan underline/click 동작을 직접 확인

실제 account usage 값, raw analyzer document, GitHub account id, session id와 credential 값은 로그·보고서에 기록하지 않았다.

## 잔여 위험

- 현재 upstream analyzer는 일부 일반 terminal PATH에서 설치된 Codex 실행 파일을 발견하지 못할 수 있다. 이번 smoke는 확인된 application resource 경로를 PATH에 추가해 검증했으며 upstream에서 탐색 보강을 진행 중이다.
- npm registry publish, package provenance/2FA와 production service default URL은 release 단계에서 확정해야 한다.
- production은 process-local limiter 대신 shared rate limiter, durable database 동시성 정책, backup/retention, account deletion과 secret management가 필요하다.
- GitHub image proxy는 origin ETag 변경 후에도 README 표시 갱신이 지연될 수 있다.
- 메인 `/`의 로그인 후 Quickstart와 copyable CLI command는 후속 UI issue 범위다.

## 다음 단계 영향

- 최종 보고서는 Stage 1~5 구현과 production handoff를 통합하고 npm publish·production 배포를 완료로 오해시키지 않아야 한다.
- upstream Codex discovery가 수정되면 downstream CLI 코드 변경 없이 dependency update와 packed smoke를 다시 수행한다.
- release 전에 실제 production origin을 package default와 문서 예시에 반영하고 npm publish artifact를 provenance 기준으로 검증한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 Task #5 최종 보고서 작성과 PR 게시 절차로 진행한다.
