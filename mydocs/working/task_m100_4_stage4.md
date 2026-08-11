# Task M100 #4 Stage 4 보고서

GitHub Issue: [#4](https://github.com/postmelee/codex-usage-profile/issues/4)  
구현계획서: [`task_m100_4_impl.md`](../plans/task_m100_4_impl.md)  
Stage: 4

## 단계 목적

Stage 1-3에서 만든 account, CLI login, token, snapshot submit service를 Node `Request`/`Response` 스타일 HTTP handler로 조합한다. route response는 `{ ok: true, data }` 또는 `{ ok: false, error }` envelope로 통일하고, private snapshot은 public endpoint에서 not found와 같은 응답으로 숨긴다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/http.js` | HTTP route handler, JSON body parser, bearer token parser, success/error response helper, safe serializer 추가 |
| `src/profile-backend/__tests__/http.test.js` | GitHub callback, CLI login start/approve/exchange, bearer submit, public/private 조회, malformed JSON, missing auth, unsupported route 테스트 추가 |
| `src/profile-backend/auth.js` | GitHub raw payload와 이미 정규화된 identity payload를 모두 account upsert에 넘길 수 있도록 normalize 보강 |
| `src/profile-backend/index.js` | HTTP handler와 parser/response helper export 추가 |
| `mydocs/orders/20260610.md` | #4 진행 상태를 Stage 4 검증 완료 기준으로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

backend HTTP adapter 신규 추가가 중심이다. 기존 snapshot schema, UI, Stage 1-3 domain service 동작은 유지했다. HTTP response serializer는 CLI `tokenDigest`와 내부 raw credential 값을 응답에 포함하지 않도록 제한했고, exchange endpoint에서만 raw CLI token을 반환한다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

결과:

- OK: `npm test` 통과. `node --test` 기준 69개 테스트 전체 pass, fail 0.
- OK: `git diff --check` 통과. whitespace error 없음.

## 잔여 위험

- `/api/cli/login/approve`는 현재 domain-level HTTP contract라 `ownerId`를 body로 받는다. 실제 웹 로그인 세션, CSRF state, cookie 검증은 배포 adapter 또는 후속 auth integration task에서 붙여야 한다.
- GitHub OAuth token exchange는 fake 가능한 `githubClient` seam으로만 연결했다. 실제 OpenAI/GitHub OAuth client 설정과 secret 관리는 이번 task 범위 밖이다.
- HTTP handler는 listen/server bootstrap을 포함하지 않는다. Stage 5는 frontend client 경계만 만들고, 실제 배포 server 선택은 후속 task에서 결정해야 한다.

## 다음 단계 영향

- Stage 5 frontend/API client는 `GET /api/snapshots/public/:handle`과 `POST /api/snapshots/submit` response envelope를 기준으로 client adapter를 작성하면 된다.
- README PNG renderer 또는 GitHub README 자동 갱신 기능은 후속 task에서 public JSON endpoint 또는 renderer endpoint를 사용해 연결한다.
- private snapshot 조회는 public endpoint에서 404/not found로 다뤄야 하며, UI/client에서도 이를 “공개 snapshot 없음” 상태로 처리해야 한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 — Web integration 경계와 최종 검증으로 진행한다.

