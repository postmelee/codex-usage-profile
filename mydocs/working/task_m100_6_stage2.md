# Task M100 #6 Stage 2 보고서

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
구현계획서: [`task_m100_6_impl.md`](../plans/task_m100_6_impl.md)
Stage: 2

## 단계 목적

Stage 1의 canonical `account/usage/read` 결과와 deterministic PNG renderer를 owner session API 및 공개 README 이미지 endpoint에 연결했다. owner와 latest usage가 모두 public인 경우에만 익명 이미지를 반환하고, 같은 URL에서 콘텐츠 기반 ETag로 최신 이미지를 재검증하는 cache contract를 구현했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/service.js` | owner/usage 병합 조회, visibility 동기화, strong ETag, PNG/avatar LRU cache, GitHub avatar fetch 정책 구현 |
| `src/profile-card/__tests__/service.test.js` | private/public 경계, ETag/304, locale·identity·usage 갱신, cache, avatar fallback 검증 7건 |
| `src/profile-card/index.js` | card service와 정책 상수 public export 추가 |
| `src/profile-backend/store.js` | 기존 latest snapshot과 분리된 `latestUsages` 저장·owner/handle 조회·export/hydrate 추가 |
| `src/profile-backend/durable-store.js` | `saveLatestUsage` 변경을 durable file에 즉시 반영 |
| `src/profile-backend/accounts.js` | session에서 결정한 owner id를 사용하는 visibility 갱신 경계 추가 |
| `src/profile-backend/http.js` | `GET|PATCH /api/profile`, private preview, public `GET|HEAD /u/:handle/card.png`와 cache headers 연결 |
| `src/profile-runtime/host-adapter.js`, `src/profile-runtime/dev-server.js` | API prefix 밖의 card PNG 경로만 backend로 전달하고 기존 `/u/:handle` SPA route 유지 |
| `src/profile-backend/__tests__/*.test.js` | latest usage clone/index/persistence, owner-only mutation, profile/PNG HTTP 계약 회귀 보강 |
| `src/profile-runtime/__tests__/*.test.js` | public card backend route와 Node response header/body 전달 검증 보강 |

## 본문 변경 정도 / 본문 무손실 여부

기존 `UsageSnapshot v2`의 `/api/snapshots/submit` 및 `/api/snapshots/public/:handle` 계약과 저장 컬렉션은 변경하지 않았다. 새 카드 경계는 별도 `latestUsages` 컬렉션을 사용하므로 기존 Profile UI와 snapshot client 동작을 보존한다.

CLI submit command와 `account/usage/read` 호출은 계획대로 #5 범위에 남겼다. 이번 Stage는 test fixture가 canonical usage를 직접 저장해 endpoint와 cache contract를 검증한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-backend/__tests__/*.test.js
node --test src/profile-runtime/__tests__/*.test.js
npm test
npm run build
git diff --check
```

결과:

- OK: card service 테스트 7건 전체 통과
- OK: profile backend 테스트 102건 전체 통과
- OK: profile runtime 테스트 20건 전체 통과
- OK: 전체 Node 테스트 204건 통과, 기존 analyzer/snapshot/Profile UI 회귀 없음
- OK: Vite 8.0.16 production build 성공, 45 modules transformed
- OK: `git diff --check` 경고 없음
- OK: HTTP 테스트에서 public PNG의 `Content-Type: image/png`, `Cache-Control: public, no-cache, must-revalidate`, strong ETag와 304를 확인
- OK: HEAD 응답은 GET과 같은 ETag/cache headers를 유지하고 body가 비어 있음을 확인
- OK: private/missing/visibility mismatch가 모두 `Card not found` 404로 수렴함을 확인
- MISS: 임시 Node 서버 listen은 성공했지만 별도 sandbox의 `curl -I` localhost 접근 승인이 도구 사용 한도로 거절되어 실제 socket 요청은 실행하지 못했다. 서버는 즉시 종료했으며 동일 경로와 header는 backend/runtime 자동 테스트로 검증했다.

## 잔여 위험

- 실제 CLI가 canonical usage를 `latestUsages`에 저장하는 submit API 연결은 계획대로 후속 #5에서 구현해야 한다.
- 실제 GitHub avatar 네트워크 smoke는 수행하지 않았다. HTTPS `avatars.githubusercontent.com` allowlist, redirect 차단, 3초 timeout, content-type, 2 MiB limit 및 fallback은 주입 fetch 테스트로 검증했다.
- PNG와 avatar cache는 process-local 최대 32개 LRU다. 다중 instance 배포에서는 각 instance가 독립적으로 렌더링하지만 ETag 결과는 동일하다.
- 실제 socket `curl -I` smoke는 도구 승인 가능 시 Stage 4 통합 QA에서 다시 수행한다.

## 다음 단계 영향

- Stage 3은 `GET /api/profile`의 owner/usage/visibility/publicCardUrl을 사용해 `/profile` 상태를 구성한다.
- publish/private control은 body가 정확히 `{ "visibility": "public" | "private" }`인 `PATCH /api/profile`만 호출해야 한다.
- private preview는 `/api/profile/card.png`, 공개 공유 URL은 `/u/:handle/card.png`를 사용한다.
- locale별 공유 URL은 `?locale=ko` 또는 기본 영문을 사용하며 locale 변경은 별도 ETag를 생성한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 Home 로그인과 Card Profile 공유 UX 구현으로 진행한다.
