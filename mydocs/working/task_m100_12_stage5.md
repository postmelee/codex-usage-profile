# Task M100 #12 Stage 5 보고서

GitHub Issue: [#12](https://github.com/postmelee/codex-usage-profile/issues/12)
구현계획서: [`task_m100_12_impl.md`](../plans/task_m100_12_impl.md)
Stage: 5

## 단계 목적

Stage 5의 목적은 #12 Stage 1-4 산출물이 통합 상태에서 동작하는지 전체 검증하고, 보안 scan과 MVP 후속 이슈 handoff를 정리하는 것이다. 이 단계는 새 기능을 추가하지 않고 #12의 runtime contract를 후속 #13, #14, #5, #15, #6이 이어받을 수 있는 상태인지 확인한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_12_stage5.md` | 전체 검증, 보안 scan, #5/#6/#13/#14/#15 handoff 정리 |
| `mydocs/orders/20260611.md` | #12 Stage 5 완료 및 최종 보고 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

문서 변경만 수행했다. 소스와 README는 Stage 4에서 검증된 상태를 유지했다. Stage 5는 runtime contract와 보안 검증 결과를 기록하는 단계이며 제품 코드 동작을 변경하지 않는다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
rg -n --glob '!src/**/__tests__/**' --glob '!mydocs/working/**' --glob '!mydocs/plans/**' "(^|[^A-Za-z0-9])(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src README.md mydocs
git diff --check
git status --short
```

결과:

- OK: 전체 `npm test` 102개 통과.
- OK: `npm run build` 통과.
- OK: `git diff --check` 통과.
- OK: credential-like 문자열 scan은 source/README/mydocs 대상에서 매칭 없음. `rg`는 no-match 종료코드 1을 반환했다.
- OK: 작업 전 `git status --short`에는 범위 밖 untracked 항목만 남아 있었고, Stage 5 산출물 외 소스 변경은 없다.

## Handoff — #13 직접 로그인 host adapter

- #12는 framework-neutral `createProfileBackendHttpHandler()`를 제공한다.
- #13은 같은 origin 또는 `/api/*` proxy로 이 handler를 mount해야 한다.
- GitHub OAuth code exchange client는 host adapter에서 `githubClient`로 주입한다.
- 필요한 설정은 README에 정리된 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `PUBLIC_BASE_URL`, `PROFILE_STORE_FILE`, `SESSION_SECURE_COOKIES`다.
- 직접 로그인 smoke test 기준은 `/api/auth/github/login` -> GitHub authorize -> `/api/auth/github/callback` -> `Set-Cookie` -> `/api/auth/me` owner/session 확인이다.

## Handoff — #14 로그인 계정 UI와 Settings shell

- Stage 4 client는 `getCurrentAccount()`, `logout()`, `buildGitHubLoginUrl()`을 제공한다.
- 현재 `ProfileShell`은 `data-auth-status`와 hidden status text만 연결되어 있다.
- #14는 Share 옆 avatar/account button, settings link, logout action, settings shell route를 구현하면 된다.
- 실제 authenticated 상태 검증은 #13 완료 후 직접 로그인 세션으로 진행하는 것이 적절하다.

## Handoff — #5 CLI npx submit

- CLI login 시작: `POST /api/cli/login/start`
  - 입력: optional `label`, `redirectUri`
  - 출력: `browserUrl`, `challenge`
- 브라우저 승인: `GET /api/auth/github/login?cli_login_challenge={challenge.id}`
  - OAuth state에 challenge id가 묶인다.
  - callback 성공 시 로그인 session owner로 challenge가 approve된다.
- CLI token 교환: `POST /api/cli/login/exchange`
  - 입력: `challengeId`, optional `label`
  - 출력: raw `token`은 이 응답에서만 1회 반환된다.
  - 저장소에는 token digest와 metadata만 남는다.
- snapshot submit: `POST /api/snapshots/submit`
  - 인증: `Authorization: Bearer {cliToken}`
  - payload는 snapshot wrapper이며 credential-like field/value는 reject된다.

## Handoff — #15 API token 및 device 관리

- #12 token service는 raw token 1회 발급과 digest 저장 contract를 이미 가진다.
- #15는 authenticated token list/create/revoke route와 settings UI를 추가하면 된다.
- device 관리 model은 아직 없다. CLI submit payload 또는 token metadata와 연결되는 device id/name/last submit timestamp 설계가 필요하다.
- token revoke 이후 submit 실패, raw token 미저장, device rename authorization을 테스트해야 한다.

## Handoff — #6 README 카드 PNG endpoint

- public profile lookup contract는 `GET /api/snapshots/public/:handle`이다.
- visibility가 `private`이거나 snapshot이 없으면 동일하게 404 `not_found`를 반환한다.
- 카드 endpoint는 public snapshot만 읽고, 같은 README 이미지 URL이 최신 snapshot 기반 이미지를 반환하도록 cache strategy를 정해야 한다.
- Share UI는 README용 fixed image URL과 Markdown snippet을 생성하면 된다.

## 잔여 위험

- 직접 GitHub login은 #13 host adapter 전까지 manual smoke test가 불가능하다.
- production DB, backup, rate limit, CSRF review, npm publish, deployment secret management는 후속 이슈/배포 단계에서 확정해야 한다.
- #14 settings shell과 #15 token/device 관리는 UI와 authenticated backend route가 추가로 필요하다.
- #6 이미지 endpoint는 cache invalidation과 GitHub README 캐시 동작을 별도로 검증해야 한다.

## 다음 단계 영향

- #12의 단계 구현은 완료됐으며, 다음 절차는 최종 보고서 작성과 PR 게시다.
- M100 진행 순서상 #12 merge 후 #13을 먼저 진행하는 것이 직접 로그인 검증 경로를 가장 빨리 연다.
- #14는 #13 이후 실제 로그인 session으로 확인하고, #5/#15/#6은 M100 마일스톤 설명에 기록된 순서대로 진행한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 #12 최종 보고서 작성과 PR 게시 절차로 진행한다.
