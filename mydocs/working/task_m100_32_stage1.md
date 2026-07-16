# Task M100 #32 Stage 1 완료 보고

GitHub Issue: [#32](https://github.com/postmelee/codex-usage-profile/issues/32)
구현계획서: [`task_m100_32_impl.md`](../plans/task_m100_32_impl.md)
Stage: 1

## 단계 목적

Account Usage Contract v1 기반 공개 프로필 JSON과 PNG 카드가 같은 owner, latest usage, visibility 조건을 사용하도록 공개 조회 경계를 통합한다. 익명 공개 JSON은 GitHub 표시 정보와 카드에 필요한 사용량만 반환하고 저장소 내부 메타데이터는 노출하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/service.js` | 공개 handle 정규화, owner-linked latest usage 조회, visibility·handle 일치 검증을 공유하는 public profile resolver 추가 |
| `src/profile-card/__tests__/service.test.js` | public JSON/PNG 공통 fail-closed 조건, 정상 공개 조회, handle 불일치 회귀 검증 추가 |
| `src/profile-backend/http.js` | 익명 `GET /api/profiles/public/:handle`, Account Usage 정규화, 공개 응답 allowlist, `no-store` 정책 추가 |
| `src/profile-backend/__tests__/http.test.js` | 공개 응답 계약과 private/missing/malformed/no-usage/mismatch 404 검증 추가 |
| `src/profile-backend/__tests__/security.test.js` | owner·usage 저장 메타데이터와 로컬 경로가 공개 응답에 포함되지 않는지 검증 추가 |

## 본문 변경 정도 / 본문 무손실 여부

신규 공개 JSON endpoint와 내부 service method만 추가했다. 기존 owner `/api/profile`, legacy public snapshot endpoint, public PNG GET/HEAD, ETag와 cache revalidation 동작은 변경하지 않았다. PNG renderer와 Account Usage 저장 계약도 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/service.test.js
node --test src/profile-backend/__tests__/http.test.js src/profile-backend/__tests__/security.test.js
node --test src/profile-backend/__tests__/durable-store.test.js
npm test
git diff --check
```

결과:

- PASS: profile-card service 9건 통과
- PASS: backend HTTP·security 집중 테스트 39건 통과
- PASS: durable store 회귀 테스트 4건 통과
- PASS: 전체 Node 테스트 263건 통과
- PASS: private, missing, usage 없음, malformed handle, visibility·handle 불일치가 동일한 404 응답 사용
- PASS: 공개 응답은 GitHub display name/login/avatar/handle, captured/uploaded time, 정규화된 summary·daily buckets, visibility, stable card URL만 포함
- PASS: owner id, provider user id, token/device, digest, revision, local path 비노출
- PASS: `git diff --check` 오류 없음

## 잔여 위험

- 신규 endpoint는 아직 production `/u/:handle` UI에서 사용하지 않는다. Stage 2에서 API client와 public route를 전환해야 한다.
- legacy snapshot public endpoint는 호환성을 위해 유지된다. production 경계와 문서 정리는 Stage 3 범위다.

## 다음 단계 영향

- Stage 2는 `GET /api/profiles/public/:handle`의 allowlist 응답만 사용해야 한다.
- public route의 ready/loading/unavailable 상태는 private과 missing을 구분하지 않아야 한다.
- ready 화면은 응답의 `publicCardUrl`을 사용하며 legacy snapshot fixture와 unsupported plugin/skill 필드를 사용하지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 public route와 card 중심 UI 전환으로 진행한다.
