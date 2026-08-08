# Task #78 Stage 7 보고서 — PR 리뷰 정합성·캐시·조회 비용 보정

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 7

## 단계 목적

PR #80 리뷰에서 확인한 4건을 보정한다. 카드 설정 저장과 stable social 이미지의 정합성을 owner CAS 경계에 맞추고, theme·locale 변경도 Open Graph 이미지 리비전에 반영한다. social 304 재검증은 object body를 읽지 않게 하며, 공개 프로필 문서의 structured read를 실제 단일 JOIN projection으로 만든다.

리뷰 내용은 구현 전에 PR 코멘트 `5225668744`로 등록했다. 작업지시자가 같은 스레드에서 리뷰 코멘트 등록 후 보정과 보정 코멘트 등록까지 명시적으로 지시했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/service-core.js` | owner 설정 CAS 성공 뒤 media preparation의 `commit` 실행 |
| `src/profile-media/publication-service.js` | social 렌더 준비와 stable 조건부 commit 분리, 최신 owner·usage revision 확인과 bounded conflict retry |
| `src/profile-media/media-store-contract.js` | memory social storage ETag, 조건부 read/write 계약 |
| `src/profile-media/r2-binding/store.js` | R2 HEAD 기반 304와 `onlyIf` 조건부 stable PUT |
| `src/profile-media/s3/store.js` | S3 HEAD 기반 304와 `If-Match`/`If-None-Match` 조건부 PUT |
| `src/profile-backend/http.js` | `If-None-Match`를 store로 전달하고 authority/social publication 일치 검사 |
| `src/profile-backend/store-contract.js` | public summary projection을 필수로 한 structured store contract v3 |
| memory/D1/Postgres store | `getPublicProfileSummaryByHandle` 구현. D1/Postgres는 owner/latest usage 단일 JOIN |
| `src/profile-runtime/public-profile-resolver.js` | projection 1회 호출과 owner·usage 최신 revision 선택 |
| `src/profile-runtime/open-graph.js` | 밀리초 정밀도 `og:image?v=` 토큰 |
| 관련 `__tests__` | CAS 실패·동시 저장, 조건부 body 미조회, 밀리초 리비전, 단일 JOIN 회귀 |
| `docs/production-hosting.md` | contract v3, single projection, social conditional read/write 운영 계약 |
| Task #78 계획·최종 보고 문서 | PR 리뷰 Stage 7과 보정 결과 현행화 |

## 본문 변경 정도 / 본문 무손실 여부

공개 API 경로와 JSON 응답, `/u/{handle}/card.png`, `/u/{handle}/social.png` URL은 유지했다. `social.png`의 application ETag와 body도 같은 렌더 결과를 사용한다. 변경된 동작은 다음 네 경계에 한정한다.

1. 카드 설정 저장 전에는 social bytes만 준비하고 stable object는 쓰지 않는다. owner CAS 성공 요청만 준비 시점 storage ETag를 조건으로 commit한다.
2. `og:image?v=` 토큰은 사용량만이 아니라 owner 설정 리비전도 반영하며 초가 아닌 밀리초 정밀도를 쓴다.
3. 조건부 social GET은 metadata의 application ETag가 일치하면 body 없이 304를 반환한다.
4. 공개 문서 resolver는 두 store read 대신 public summary projection 하나만 호출한다.

기존 사용자 문서 `docs/readme-card.md`와 UI 본문은 수정하지 않았다. 운영 문서는 contract version과 실제 hot path만 필요한 범위에서 갱신했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
npm run build
git diff --check
```

결과:

- OK — `npm test`: 691개 중 685 pass, 0 fail, 6 skipped. real-workerd D1 projection과 production server 포함
- OK — `npm run test:e2e`: 64 pass, 0 fail (50.8s)
- OK — `npm run build`: Vite production build 성공. CSS 70.00 kB, main JS 409.48 kB
- OK — `git diff --check`: 경고 없음
- OK — owner 설정 CAS 강제 실패 뒤 owner locale과 social ETag/body 모두 이전 값 유지
- OK — 같은 설정의 동시 저장 2건 중 1건만 성공하고 social PUT도 1회만 실행
- OK — memory/R2/S3 conditional hit가 body 없이 `notModified` 반환. R2/S3 fixture는 HEAD 1회와 GET 0회 단언
- OK — HTTP `/social.png` revalidation이 store에 `ifNoneMatch`를 전달하고 304 body가 비어 있음
- OK — D1/Postgres projection unit fixture가 JOIN statement 1회만 실행. real-workerd D1 round-trip도 통과
- OK — 같은 초의 1ms 설정 revision 차이에서 `og:image` URL 변경

## 잔여 위험

- 환경 설정이 없는 Postgres·외부 S3 endpoint 통합 테스트는 기존 정책대로 skip됐다. 같은 SQL/command 경계는 provider-neutral unit fixture와 전체 adapter contract test로 검증했다.
- owner CAS 성공 뒤 외부 media provider가 지속적으로 unavailable이면 API는 generic media unavailable을 반환하지만 owner 설정은 이미 commit된 상태다. 일시적 ETag 경합은 최신 owner 확인과 bounded retry로 수렴하며, provider 장애는 기존 refresh/repair 운영 절차가 필요하다.
- 실제 플랫폼의 미리보기 캐시는 배포 후 재수집과 카카오 캐시 초기화가 필요하다.

## 다음 단계 영향

- Stage 구현은 종료됐다. 이 보고서와 소스·문서를 한 커밋으로 묶어 `publish/task78`에 push하고 새 GitHub Actions를 확인한다.
- 새 CI 결과와 커밋 SHA를 PR #80의 별도 보정 코멘트에 남긴다.

## 승인 요청

- 작업지시자가 요청한 Stage 7 보정 범위와 검증을 완료했다. 같은 지시에 따라 PR push·CI 확인·보정 코멘트 등록으로 이어간다.
