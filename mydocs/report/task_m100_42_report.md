# Task #42 최종 보고서

GitHub Issue: [#42](https://github.com/postmelee/codex-usage-profile/issues/42)
마일스톤: M100

## 작업 요약

- 대상 이슈: #42
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: 공개 card PNG를 locale별 immutable revision과 handle 기반 stable R2 publication으로 분리하고, owner publish/unpublish·future submit refresh·공개 serving·retention을 안전한 실패/재시도 계약과 함께 완성한다.

승인된 결정에 따라 `@aws-sdk/client-s3`, contract v2, 최종 PNG SHA-256 digest revision/application ETag, `PROFILE_MEDIA_MODE=external` production runtime, `TEST_S3_*` gated integration, 기본 dry-run orphan cleanup을 구현했다. Share Studio UI와 실제 Cloud Run/R2 resource provisioning 등 제외 범위는 변경하지 않았다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-media/media-store-contract.js`, `src/profile-media/s3/` | contract v2, locale revision/stable key, S3-compatible adapter, readiness와 오류 정규화 | 서버 media storage 경계 |
| `src/profile-media/publication-service.js` | owner 단위 publish/refresh/unpublish 직렬화와 cross-store 부분 실패 보상 | 공개 상태 전환과 publication 일관성 |
| `src/profile-card/service.js` | renderer source digest와 최종 PNG revision/application ETag 분리 | card cache·revision 식별 |
| `src/profile-backend/http.js`, `src/profile-backend/errors.js` | 기존 visibility endpoint orchestration, public media-only route, submit refresh와 retriable 503 | backend API와 stable image URL |
| `src/profile-runtime/` | memory/external media mode, production R2 생성·readiness·shutdown | local/production runtime 기동 |
| `packages/codex-usage-profile-cli/src/submit.js` | media refresh 실패의 안전한 exact retry 안내 | CLI submit 오류 경험 |
| `scripts/cleanup-orphan-card-media.mjs` | stable reference·최근 5개·90일 guard, dry-run/`--apply`, 삭제 직전 재확인 | R2 orphan revision 운영 |
| `src/**/__tests__`, `packages/**/test`, `scripts/__tests__` | contract, HTTP, runtime, failure, concurrency, cleanup 회귀 검증 | 자동 검증 |
| `.env.example`, `package.json`, `package-lock.json` | R2/test env, S3 client dependency, cleanup script | 설치·운영 설정 |
| `README.md`, `docs/production-hosting.md`, `docs/readme-card.md` | stable media, locale, retry, retention과 remote 검증 한계 현행화 | 사용자·기여자·운영 문서 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/orders/` | 승인 결정, 5단계 구현·검증 기록과 작업 상태 | Hyper-Waterfall 추적 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| media contract·key·locale·retention·env 정책 | `docs/production-hosting.md` 기존 절 확장 | `docs/production-hosting.md` | OK | 수행계획서의 공식 아키텍처·운영 문서 위치를 유지했다. |
| stable URL·locale·submit 갱신 계약 | `README.md`, `docs/readme-card.md` 기존 절 | `README.md`, `docs/readme-card.md` | OK | 기존 사용자 문서 진실 원천만 현행화했다. |
| S3-compatible adapter | `src/profile-media/s3/` | `src/profile-media/s3/` | OK | provider-neutral 코드 위치를 유지하고 R2 선택은 env·운영 문서로 한정했다. |
| task 산출물 | `mydocs/plans`, `mydocs/working`, `mydocs/report` | 계획서·Stage 보고서·본 최종 보고서 | OK | 승인된 Hyper-Waterfall 문서 구조와 파일명을 따랐다. |

신규 제품 문서 루트나 Share Studio 문서는 만들지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| media store contract | version 1 | version 2 |
| public publication representation | 단일 owner revision | `en`·`ko` 2개 locale revision + handle stable metadata |
| stable object 주소 | `cards/v1/owners/{ownerId}/card.png` | `cards/v2/public/{handle}/card.png` |
| 공개 PNG 데이터 경로 | structured store 조회 + on-demand render | handle 기반 media stable/immutable object 전용 조회 |
| production media mode | 미연결 | `PROFILE_MEDIA_MODE=external`만 허용, R2 readiness 후 listen |
| orphan 보존 guard | 도구 없음 | stable reference + owner·locale별 최근 5개 + 90일 이내 |
| 단계 완료 보고서 | 0개 | 5개 |
| 최종 통합 검증 | Task #42 기능 미구현 | 373 tests: 367 pass, 6 environment-gated skip, 0 fail |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 같은 revision/bytes 재시도 멱등, 다른 bytes conflict | OK — memory/S3 command contract test로 고정했다. |
| 두 locale immutable 또는 stable copy 실패 시 이전 publication 보존 | OK — PUT/HEAD/COPY failure fixture가 기존 body·metadata 보존을 확인했다. |
| 최초 publish와 public submit/exact retry가 동일 URL을 갱신 | OK — backend/CLI/runtime 통합 test가 accepted·idempotent refresh와 복구를 확인했다. |
| 같은 owner mutation 직렬화와 최종 visibility/stable 일치 | OK — publish↔publish, publish↔unpublish, refresh↔unpublish barrier test를 통과했다. |
| unpublish privacy-first ordering | OK — delete 실패는 public 유지, delete 성공 뒤 commit 실패는 PNG 404 유지 후 retry로 private 수렴한다. |
| 공개 route의 structured store·renderer 비접근 | OK — 호출 시 실패하는 spy로 R2 media-only lookup을 검증했다. |
| locale ETag, GET/HEAD/304/404 계약 | OK — `en`/`ko`/fallback과 body 없는 HEAD/304, 동일 404를 검증했다. |
| private preview on-demand·비영속 | OK — session-authenticated `private, no-store`와 media non-write를 검증했다. |
| credential·server SDK client bundle 비노출 | OK — production build 뒤 `dist`/client source scan에서 R2 secret env와 S3 client 흔적이 검출되지 않았다. |
| cleanup 보존 집합과 race guard | OK — pagination, referenced/latest/90일 보호, 삭제 직전 stable 재확인과 exact key 삭제를 검증했다. |
| 전체 회귀·build·diff | OK — 367 pass, 6 skip, 0 fail; Vite production build 및 `git diff --check` 통과. |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_42_stage1.md): media contract v2와 S3-compatible adapter, gated endpoint contract를 구현·검증했다.
- [Stage 2](../working/task_m100_42_stage2.md): owner publish/unpublish orchestration과 부분 실패 보상을 구현·검증했다.
- [Stage 3](../working/task_m100_42_stage3.md): 공개 stable route와 locale/private serving 경계를 구현·검증했다.
- [Stage 4](../working/task_m100_42_stage4.md): future submit refresh, exact retry와 production external media runtime을 구현·검증했다.
- [Stage 5](../working/task_m100_42_stage5.md): failure/concurrency matrix, retention cleanup과 공식 문서를 통합·검증했다.

최종 통합 검증 명령:

```bash
node --test src/profile-media/__tests__/s3-failure.test.js src/profile-media/__tests__/publication-concurrency.test.js
node --test scripts/__tests__/cleanup-orphan-card-media.test.js
npm run cleanup:card-media -- --help
npm test
npm run build
git diff --check
```

## 잔여 위험과 후속 작업

### 잔여 위험

- `TEST_S3_*`가 제공되지 않아 실제 R2/MinIO endpoint의 conditional PUT, copy metadata round trip과 remote 권한을 검증하지 못했다.
- `TEST_DATABASE_URL`이 제공되지 않아 기존 PostgreSQL integration 4건과 다른 owner concurrency 1건을 실행하지 못했다. 해당 항목을 포함해 전체 suite에서 6건이 명시적으로 skip됐다.
- Neon transaction과 R2 mutation은 분산 transaction이 아니다. owner row serialization, stable copy commit point, privacy-first ordering과 보상 test로 허용 상태를 고정했지만 실제 provider latency·timeout은 remote 환경에서 확인해야 한다.

### 후속 작업 후보

- #43에서 실제 Cloud Run·Neon·R2 resource와 Secret Manager를 연결하고, `TEST_S3_*` remote round trip, cold-start/readiness, cleanup schedule과 운영 retention 값을 검증·확정한다.
- #38 Share Studio UI, #44 npm package publish/production origin 등 수행계획서의 제외 범위는 각 기존 이슈에서 진행한다.

## 작업지시자 승인 요청

- 작업지시자는 2026-07-23 Stage 5 승인 뒤 최종 보고서 작성과 PR 게시 절차 진행을 승인했다.
- 생성된 PR의 변경·검증 결과를 검토한 뒤 merge 승인을 요청한다. self-merge와 이슈 close는 수행하지 않는다.
