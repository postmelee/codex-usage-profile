# Task M100 #13 Stage 4 보고서

GitHub Issue: [#13](https://github.com/postmelee/codex-usage-profile/issues/13)
구현계획서: [`task_m100_13_impl.md`](../plans/task_m100_13_impl.md)
Stage: 4

## 단계 목적

Stage 4의 목적은 #13에서 만든 local runtime 경계를 전체 테스트/빌드/시크릿 스캔으로 다시 확인하고, 후속 이슈가 이어받을 URL, endpoint, 검증 한계를 정리하는 것이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_13_stage4.md` | 통합 검증 결과와 후속 이슈 handoff 정리 |
| `mydocs/orders/20260611.md` | #13 Stage 4 완료 상태 반영 |

## 통합 검증 결과

실행 명령:

```bash
npm test
npm run build
rg -n --glob '!src/**/__tests__/**' --glob '!mydocs/working/**' --glob '!mydocs/plans/**' "(^|[^A-Za-z0-9])(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|GITHUB_CLIENT_SECRET=[^<\\s]{8,}|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src README.md mydocs .env.example
git diff --check
```

결과:

- OK: 전체 테스트 122개 통과.
- OK: production build 통과.
- OK: secret scan 매칭 없음. `rg` exit 1은 매칭 없음에 따른 정상 결과로 확인했다.
- OK: `git diff --check` 통과.

## Runtime smoke 재확인

Stage 3에서 확인한 local runtime smoke 경로는 Stage 4에서도 유효하다.

```bash
PORT=5174 PUBLIC_BASE_URL=http://127.0.0.1:5174 GITHUB_CLIENT_ID=github_client_smoke npm run dev:runtime
```

확인된 동작:

- `GET /api/auth/me`: 비로그인 상태에서 401 반환.
- `GET /api/auth/github/login?redirect_to=/u/meleeisdeveloping`: GitHub authorization URL로 302 redirect 반환.
- `GET /u/meleeisdeveloping`: Vite frontend HTML 200 반환.
- in-app browser에서 profile 화면 렌더링 확인.

## 후속 이슈 handoff

### #14 Account/settings UI

- local runtime 실행 명령은 `npm run dev:runtime`을 사용한다.
- 로그인 상태 조회는 `GET /api/auth/me`를 사용한다.
- 로그아웃은 `POST /api/auth/logout`을 사용한다.
- settings/account UI는 아직 없으므로 #14에서 route와 화면 shell을 추가한다.
- 실제 GitHub callback/session smoke는 GitHub OAuth App의 callback URL을 `{PUBLIC_BASE_URL}/api/auth/github/callback`으로 등록한 뒤 수행한다.

### #5 CLI submit flow

- CLI login start endpoint는 `POST /api/cli/login/start`다.
- 브라우저 승인 URL은 start 응답의 `browserUrl`을 같은 origin으로 열면 된다.
- CLI token 수령은 `POST /api/cli/login/exchange`다.
- snapshot submit은 `POST /api/snapshots/submit`에 `Authorization: Bearer ...`로 보낸다.
- local runtime이 같은 origin API를 제공하므로 CLI smoke는 `http://127.0.0.1:{PORT}` 기준으로 진행할 수 있다.

### #15 API token/device management

- 현재 backend는 CLI token 발급/검증/취소 service 경계를 갖고 있다.
- device rename/revoke 같은 management UI/API는 아직 없다.
- #15에서는 token metadata와 device label을 노출/수정하는 route 설계가 필요하다.

### #6 Share image/card endpoint

- public snapshot 조회는 `GET /api/snapshots/public/:handle` 경로를 사용한다.
- share image endpoint는 host adapter의 `/api/*` routing 안에 추가하면 된다.
- 이미지 생성 결과는 README에 삽입할 stable URL을 반환해야 하며, cache 갱신 정책은 #6에서 결정한다.

## 남은 한계

- 실제 GitHub OAuth App credential을 사용한 end-to-end login은 아직 수동 검증하지 않았다.
- production 배포용 static serving, rate limiting, CSRF 검토, production DB/secret manager 선택은 이 이슈 범위 밖이다.
- local runtime은 개발용 Vite middleware를 사용한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 #13 최종 보고서 작성 및 PR 게시 절차로 진행한다.
