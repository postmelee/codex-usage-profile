# Task M100 #13 Stage 2 보고서

GitHub Issue: [#13](https://github.com/postmelee/codex-usage-profile/issues/13)
구현계획서: [`task_m100_13_impl.md`](../plans/task_m100_13_impl.md)
Stage: 2

## 단계 목적

Stage 2의 목적은 local runtime server에 연결하기 전 GitHub OAuth client와 환경 변수 설정 경계를 분리해 테스트 가능한 형태로 만드는 것이다. 실제 브라우저 login/callback 연결은 Stage 3에서 수행하고, 이 단계는 secret을 저장하지 않는 token exchange/user lookup module과 local env 문서화를 완료한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/github-oauth-client.js` | GitHub authorization code token 교환, authenticated user 조회, GitHub error wrapper 추가 |
| `src/profile-runtime/config.js` | runtime env loader, `PUBLIC_BASE_URL` 정규화, OAuth credential 필수 여부 검증, boolean env parser 추가 |
| `src/profile-runtime/__tests__/github-oauth-client.test.js` | token exchange/user lookup request shape, error 처리, secret 비노출, 입력 검증 테스트 추가 |
| `src/profile-runtime/__tests__/config.test.js` | 기본값, env 정규화, credential 필수 검증, boolean/public URL 검증 테스트 추가 |
| `.env.example` | local runtime에 필요한 env placeholder 추가 |
| `.gitignore` | `.env`, `.env.*`, `.data/` ignore 및 `.env.example` 허용 추가 |
| `README.md` | local OAuth App callback URL, `.env` 사용, access token discard 정책 문서화 |
| `mydocs/plans/task_m100_13_impl.md` | Stage 2 secret scan 범위를 신규 runtime 산출물 중심으로 보정 |
| `mydocs/working/task_m100_13_stage2.md` | Stage 2 완료 보고서 |

## 본문 변경 정도 / 본문 무손실 여부

기존 backend/frontend 동작은 변경하지 않았다. 새 module은 아직 dev server나 backend runtime에 연결하지 않았고, Stage 3에서 host adapter와 backend handler 생성 시 주입할 수 있는 경계만 추가했다. README에는 로컬 secret을 저장소에 기록하지 않는 방식과 callback URL만 보강했다.

## 보안 확인

- GitHub access token은 `getAuthenticatedUser()` 호출 인자로만 사용하고, 이 module은 token을 파일이나 store에 저장하지 않는다.
- `.env`와 `.env.*`는 git ignore 대상이며 `.env.example`에는 placeholder만 둔다.
- GitHub token exchange error message는 client secret을 포함하지 않는지 테스트했다.
- secret scan은 기존 테스트 픽스처의 의도적 가짜 토큰 오탐을 피하기 위해 이번 Stage 산출 범위인 `README.md`, `.env.example`, `src/profile-runtime`에 대해 실행했다.

## 검증 결과

실행 명령:

```bash
npm test -- src/profile-runtime/__tests__/github-oauth-client.test.js src/profile-runtime/__tests__/config.test.js
rg -n "(gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|GITHUB_CLIENT_SECRET=.*[A-Za-z0-9]{8,})" README.md .env.example src/profile-runtime
git diff --check
```

결과:

- OK: GitHub OAuth client/config 테스트 10개 통과.
- OK: token exchange/user lookup request shape 검증 통과.
- OK: GitHub error가 client secret을 노출하지 않음.
- OK: `.env.example`과 README, 신규 runtime source 범위에서 실제 token-like 값 매칭 없음. `rg` exit 1은 매칭 없음에 따른 정상 결과로 확인했다.
- OK: `git diff --check` 통과.

## 잔여 위험

- 실제 GitHub OAuth App credential을 사용한 브라우저 login/callback smoke test는 아직 수행하지 않았다.
- local dev server entry와 `/api/*` routing 연결은 Stage 3 범위다.
- `.env` loader는 값을 읽고 정규화하지만, 아직 backend handler 생성부에 주입되지 않았다.

## 다음 단계 영향

- Stage 3은 `loadProfileRuntimeConfig()`로 env를 읽고 `createGitHubOAuthClient()`를 backend runtime에 주입한다.
- Stage 3 local runtime은 GitHub OAuth App callback URL을 `{PUBLIC_BASE_URL}/api/auth/github/callback`으로 맞추면 된다.
- #14 settings/account UI와 #5 CLI submit flow는 Stage 3에서 같은 origin runtime이 동작한 뒤 실제 smoke path를 이어받는다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 local dev server 통합과 browser smoke path 구현으로 진행한다.
