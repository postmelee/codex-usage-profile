# Task M100 #37 Stage 3 보고서

GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
구현계획서: [`task_m100_37_impl.md`](../plans/task_m100_37_impl.md)
Stage: 3

## 단계 목적

Cloud Run 제품 경계에 필요한 structured store와 public media store 계약을 provider 중립 코드로 고정한다. Neon/R2 실제 adapter를 구현하지 않은 상태에서도 후속 구현이 지켜야 할 원자성, 멱등성, owner 격리, 공개 media 수명주기와 same-origin 보안 요구를 실행 가능한 테스트와 공식 hosting 문서로 남긴다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-backend/store-contract.js` | production structured store의 필수 method, record ownership/unique/secret 분류와 다섯 atomic operation 정의 |
| `src/profile-backend/__tests__/store-contract.test.js` | memory/file fixture의 계약 표면, device persistence, owner collision과 격리 검증 |
| `src/profile-media/media-store-contract.js` | immutable revision, stable public card key, publish/unpublish와 cache metadata 계약 및 memory fixture 구현 |
| `src/profile-media/__tests__/media-store-contract.test.js` | immutable conflict, idempotent retry, stable publish와 unpublish retention 검증 |
| `src/profile-backend/http.js` | explicit cross-origin API 거부, session mutation의 same-origin 검사와 OAuth local redirect 정규화 구현 |
| `src/profile-backend/__tests__/http.test.js` | external/protocol-relative redirect, CORS 비허용, cross-site mutation 거부와 same-origin 허용 검증 |
| `src/profile-backend/durable-store.js` | submitted device 변경을 file fixture persistence 대상에 포함 |
| `src/profile-backend/errors.js` | same-origin 거부에 사용하는 stable 403 error code 추가 |
| `docs/production-hosting.md` | Cloud Run + Neon + R2 canonical architecture, optional Sites mirror, CSRF, secret, lifecycle, rollback과 후속 구현 경계 문서화 |
| `README.md` | 공식 production hosting 문서 진입 링크 추가 |

## 본문 변경 정도 / 본문 무손실 여부

backend 계약과 보안 경계 작업이다. 제품 UI, marketing 화면과 카드 렌더링은 변경하지 않았다. 기존 CLI처럼 `Origin`을 보내지 않는 bearer 요청과 OAuth callback GET은 유지하면서, 브라우저 session mutation과 explicit cross-origin API 요청만 추가로 차단했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-backend/__tests__/store-contract.test.js src/profile-media/__tests__/media-store-contract.test.js src/profile-backend/__tests__/http.test.js
rg -n "Cloud Run|Neon|R2|Sites|OAuth|CSRF|fallback|marketing" docs/production-hosting.md
npm test
npm run build:cloud-run
git diff --check
```

결과:

- OK: backend store/media/security 집중 테스트 38개 통과
- OK: 전체 299개 테스트 통과
- OK: Cloud Run production build, 38개 module transform과 asset 생성
- OK: 공식 hosting 문서에서 architecture/provider/OAuth/CSRF/fallback 경계 검색 확인
- OK: external/protocol-relative OAuth return path와 explicit cross-origin API가 fail closed함
- OK: same-origin session mutation과 origin 없는 CLI bearer 요청의 기존 계약 유지
- OK: stable public object unpublish 이후에도 immutable revision이 보존됨
- OK: `git diff --check` 통과

전체 테스트의 local listener 검증은 제한 없는 로컬 실행 환경에서 수행했다. 제한된 sandbox에서 발생한 `127.0.0.1` listen 권한 오류는 같은 명령을 실제 실행 환경에서 재실행해 모두 통과함을 확인했다.

## 잔여 위험

- Neon schema, async adapter, transaction, migration과 multi-instance concurrency는 아직 구현되지 않았다.
- R2 SDK, bucket, object write, stable object materialization과 cache invalidation은 아직 구현되지 않았다.
- 현재 memory/file store와 memory media store는 계약 fixture이며 production durable source가 아니다.
- production `PROFILE_STORE_MODE=external`은 실제 adapter가 주입되기 전까지 의도적으로 시작을 거부한다.
- Cloud Run remote deploy, custom domain, Secret Manager, ingress와 provider 장애 주입은 검증하지 않았다.
- `Origin`이나 `Sec-Fetch-Site`를 제공하지 않는 browser-like client는 기존 session 인증에 의존한다. production reverse proxy가 관련 헤더를 제거하거나 변조하지 않는지 배포 QA가 필요하다.

## 다음 단계 영향

- Stage 4 Sites mirror는 이 문서의 marketing-only 경계를 따라 Cloud Run API, session, account loader와 provider credential을 bundle에 포함하지 않아야 한다.
- Sites CTA는 Cloud Run root로 전체 페이지 이동해야 하며 Cloud Run CORS나 cookie scope를 확대하지 않는다.
- 실제 Neon/R2 adapter는 후속 issue에서 이 단계의 executable contract와 transaction/failure injection test를 구현 기준으로 사용해야 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4로 진행한다.
