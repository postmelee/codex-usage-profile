# Task M100 #5 Stage 2 단계 보고서

GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
구현계획서: [`task_m100_5_impl.md`](../plans/task_m100_5_impl.md)
Stage: 2

## 단계 목적

publish 가능한 `codex-usage-profile` CLI workspace를 만들고, 기존 device-code backend를 이용한 GitHub 인증, 안전한 서비스 URL 해석, credential 저장, `login/status/logout` 명령 경계를 구현한다. raw token은 승인된 device poll 응답에서 한 번만 받아 private credential file에 저장하고 argv·URL·stdout·stderr에는 노출하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/package.json` | `codex-usage-profile@0.1.0`, Node.js 20+, ESM, executable bin과 publish allowlist 정의 |
| `packages/codex-usage-profile-cli/bin/codex-usage-profile.js` | CLI executable entrypoint 추가 |
| `packages/codex-usage-profile-cli/src/cli.js` | command parser, help/version, login/status/logout, safe error와 metadata-only output 구현 |
| `packages/codex-usage-profile-cli/src/config.js` | CLI·환경·저장 origin 우선순위, HTTPS/loopback 정책, timeout 검증 구현 |
| `packages/codex-usage-profile-cli/src/credentials.js` | 플랫폼 config 경로, 환경 token 우선순위, `0700/0600`, atomic rename, symlink·unsafe permission 거부 구현 |
| `packages/codex-usage-profile-cli/src/device-login.js` | device start/poll, expiry·interval·429 backoff, browser best-effort, raw token 단일 저장 구현 |
| `packages/codex-usage-profile-cli/src/service-client.js` | timeout, redirect 거부, Bearer status, safe service error와 `Retry-After` 처리 구현 |
| `packages/codex-usage-profile-cli/src/errors.js` | CLI 오류와 exit code 경계 정의 |
| `packages/codex-usage-profile-cli/src/index.js` | 공개 CLI 모듈 export 정의 |
| `packages/codex-usage-profile-cli/test/*.test.js` | parser, config, credential, device login, service client와 출력 보안 테스트 25개 추가 |
| `package-lock.json` | 신규 local CLI workspace link 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 기존 frontend, backend API와 analyzer workspace 동작은 수정하지 않았으며 전체 회귀 테스트로 보존을 확인했다. `submit` 명령 이름과 옵션은 파싱하지만 analyzer orchestration 전까지 안전한 미지원 오류를 반환한다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/cli.test.js
node --test packages/codex-usage-profile-cli/test/config.test.js packages/codex-usage-profile-cli/test/credentials.test.js
node --test packages/codex-usage-profile-cli/test/device-login.test.js packages/codex-usage-profile-cli/test/service-client.test.js
node --test src/profile-backend/__tests__/http.test.js
npm test
npm run build
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js --help
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js status --server http://127.0.0.1:5177
git diff --check
```

결과:

- OK: CLI command 테스트 9개 통과
- OK: config·credential 테스트 8개 통과
- OK: device login·service client 테스트 8개 통과
- OK: backend HTTP 회귀 테스트 27개 통과
- OK: 전체 단위·통합 테스트 246개 통과
- OK: Vite production build 성공
- OK: 실제 bin help 출력과 비로그인 status의 stack 없는 단일 오류 출력 확인
- OK: whitespace 오류 없음

## 잔여 위험

- package 기본 production service URL은 아직 확정하지 않아 `--server` 또는 `CODEX_USAGE_PROFILE_URL`이 필요하다.
- credential은 OS keychain이 아니라 private JSON file에 저장한다. 현재 권한·symlink·atomic write 방어는 적용했지만 OS keychain 통합은 MVP 이후 별도 판단 대상이다.
- 실제 브라우저를 여는 device login과 운영 서버 인증 smoke는 Stage 5에서 검증한다.
- `submit` 실행과 analyzer 오류 mapping은 Stage 3 범위다.

## 다음 단계 영향

- Stage 3은 `service-client.js`에 Account Usage submit 메서드를 추가하고 현재 `submit_not_available` 분기를 analyzer orchestration으로 교체한다.
- 저장된 stable `deviceId`와 hostname은 Account Usage device header에만 전달해야 한다.
- environment token은 file token보다 우선하며 디스크에 저장하거나 `logout`으로 제거하지 않는다.
- file token은 저장된 service origin에 바인딩되므로 다른 origin에 전송하지 않는다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 analyzer SDK submit orchestration 구현으로 진행한다.
