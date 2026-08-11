# Task M100 #4 Stage 5 보고서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
구현계획서: [`task_m100_4_impl.md`](../plans/task_m100_4_impl.md)  
Stage: 5

## 단계 목적

Stage 4에서 확정한 public JSON endpoint와 snapshot submit endpoint를 frontend/client 경계로 연결하고, CLI submit/public lookup이 생기는 만큼 보안·개인정보 고지를 README에 최소 범위로 남긴다. 기존 #3 sample preview UX는 유지하면서 unknown `/u/:handle`만 API-backed lookup 경로로 분리한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-api/client.js` | public snapshot 조회, snapshot submit, API envelope/error 처리 client 추가 |
| `src/profile-api/__tests__/client.test.js` | public lookup, 404 null 처리, bearer submit, API error, input validation, URL builder 테스트 추가 |
| `src/profile-ui/profileRoutes.js` | sample preview route와 API-backed route를 `source`로 분리하고 async public snapshot loader 추가 |
| `src/profile-ui/__tests__/profileRoutes.test.js` | sample preview 유지, API-backed loading/ready/unavailable route 테스트 추가 |
| `src/App.jsx` | sample route는 즉시 렌더링하고 API-backed route만 client lookup을 수행하도록 연결 |
| `README.md` | 프로젝트 개요, 개발 명령, CLI submit/public lookup Security and Privacy note 신규 작성 |
| `mydocs/plans/task_m100_4_impl.md` | Stage 5 README 보안 고지 포함과 secret grep 명령 보정 |
| `mydocs/orders/20260610.md` | #4 진행 상태를 Stage 5 검증 완료 기준으로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

frontend/API client 경계와 README 신규 작성 중심이다. 기존 profile UI 컴포넌트, snapshot schema, backend domain/API contract는 변경하지 않았다. `/u/meleeisdeveloping`과 `/`의 sample preview는 기존처럼 fixture로 즉시 ready 상태를 유지하고, sample handle이 아닌 `/u/:handle`만 public API client를 통해 조회한다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
rg -n --glob '!src/**/__tests__/**' --glob '!mydocs/working/**' --glob '!mydocs/plans/**' "(^|[^A-Za-z0-9])(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src README.md mydocs
npm run test:e2e
git diff --check
```

결과:

- OK: `npm test` 통과. `node --test` 기준 79개 테스트 전체 pass, fail 0.
- OK: `npm run build` 통과. Vite production build 완료.
- OK: secret grep 통과. `src`, `README.md`, `mydocs`의 비테스트/비계획/비보고서 범위에서 secret-like match 없음.
- OK: `npm run test:e2e` 통과. Playwright 6개 테스트 pass. 최초 sandbox 실행은 dev server listen 권한(`EPERM 127.0.0.1:5173`)으로 실패했고, 승인된 권한 상승 재실행에서 통과했다.
- OK: `git diff --check` 통과. whitespace error 없음.

## 잔여 위험

- README는 최소 보안 고지만 담았다. 실제 CLI 사용법, GitHub README 이미지 자동 갱신, API 레퍼런스, 배포 보안 체크리스트는 후속 docs/deploy task에서 별도 문서화가 필요하다.
- frontend client는 `/api/snapshots/public/:handle`과 `/api/snapshots/submit` contract에 맞춘 경계다. 실제 production auth/session, CSRF, rate limit, storage는 아직 배포 adapter 밖의 후속 작업이다.
- public route는 API 장애 또는 404를 모두 unavailable UI로 접는다. 사용자에게 더 자세한 오류 상태를 보여줄지는 후속 UX 작업에서 결정한다.

## 다음 단계 영향

- #4 구현 단계는 Stage 5까지 완료됐다. 다음 절차는 최종 보고서와 PR 게시를 위한 `task-final-report` 단계다.
- 후속 README/card renderer는 `src/profile-api/client.js` 또는 Stage 4 public JSON endpoint를 기반으로 연결하면 된다.
- CLI 패키지 작업은 Stage 4/5 contract에 맞춰 `login -> exchange -> submit` 흐름을 구현하면 된다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 #4 최종 보고서 작성 및 PR 게시 절차로 진행한다.

