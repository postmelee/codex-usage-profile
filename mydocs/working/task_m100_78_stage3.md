# Task #78 Stage 3 보고서 — 런타임별 문서 핸들러 연결과 owner-only 차단

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 3

## 단계 목적

Stage 1이 만든 문서 핸들러를 Workers, Node 프로덕션, dev 세 런타임에 연결한다. 런타임별로 다른 것은 `loadIndexHtml`뿐이고 태그 생성과 주입은 공통 모듈을 공유한다. 공개를 닫은 `owner-only` 모드에서 프로필 문서와 소셜 이미지가 노출되지 않게 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/public-profile-resolver.js` | 신규. store에서 `{ handle, cardLocale, uploadedAt }`만 읽는 단일 조회 |
| `src/profile-runtime/sites/worker.js` | ASSETS 로더와 D1 store로 문서 핸들러 조립 |
| `src/profile-runtime/sites/backend.js` | owner-only 차단 목록에 프로필 문서와 소셜 이미지 추가 |
| `src/profile-runtime/production-server.js` | 빌드 산출물 index.html 로더로 조립, 요청 파이프라인에 편입 |
| `src/profile-runtime/dev-server.js` | vite `transformIndexHtml` 로더로 조립, 미들웨어보다 먼저 처리 |
| `src/profile-runtime/__tests__/public-profile-resolver.test.js` | 신규. 조회 4개 테스트 |
| `src/profile-runtime/sites/__tests__/backend.test.js` | owner-only 차단 단언 추가 |

`host-adapter.js`와 `static-assets.js`는 이번에도 수정하지 않았다.

## 조회 비용

`createStorePublicProfileResolver`는 owner 1건과 최신 usage 1건만 읽고 카드 렌더나 미디어 조회를 하지 않는다. 공개 여부와 handle 일치를 확인한 뒤 문서 생성에 필요한 세 필드만 반환한다. 공개 카드 PNG가 R2만 조회하는 계약과 달리 이 경로는 D1을 타므로, 반환 형태로 조회 범위를 강제했다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

dev 런타임 실측 (`http://127.0.0.1:5174`):

```bash
curl -sA "Twitterbot/1.0" ".../u/postmelee?locale=ko"
curl -sA "Twitterbot/1.0" ".../u/ghost"
curl -s -D - -o /dev/null ".../u/postmelee"
diff <(curl -s ".../u/postmelee") <(curl -s ".../u/ghost")
```

결과:

- OK. `npm test` 전체 679개 중 673 pass, 0 fail, 6 skipped
- OK. `git diff --check` 경고 없음
- OK. 공개 프로필에 `og:title`, `og:description`, `og:image`(2400x1260), `twitter:card=summary_large_image`, `og:locale=ko_KR`, canonical이 모두 주입됨
- OK. `?locale=en`이면 문구와 `og:locale`만 영문으로 바뀌고 이미지 URL은 동일
- OK. 미존재 handle은 사이트 기본 태그와 운영자 소셜 이미지로 폴백
- OK. 비공개 handle과 미존재 handle의 응답이 바이트 단위로 동일. handle 존재 여부가 새지 않음
- OK. 응답 헤더 `cache-control: public, max-age=0, s-maxage=60, must-revalidate`, `content-type: text/html; charset=utf-8`, `x-content-type-options: nosniff`
- OK. `id="root"`가 그대로 남아 SPA 렌더가 유지됨
- OK. owner-only 모드에서 `/u/{handle}`과 `/u/{handle}/social.png`가 404, normal 모드에서는 통과

## 잔여 위험

- Workers와 Node 프로덕션 경로는 단위 테스트와 조립 코드로만 확인했다. 실제 응답 대조는 빌드 산출물이 필요하므로 Stage 6 통합 검증에서 수행한다. 태그 문자열 생성과 주입은 세 런타임이 같은 모듈을 쓰므로 차이는 자산 로딩에만 남는다.
- Worker 소셜 렌더의 실제 resvg 출력은 여전히 미확인이다. Stage 6 대상이다.
- `s-maxage=60`은 트래픽 근거가 없는 초기값이다.

## 다음 단계 영향

- Stage 4는 `PublicProfilePage`의 카드를 `MarketingCardPreview`로 교체하고 비공개 소유자 안내를 추가한다. 이번 단계에서 문서 응답이 SPA를 그대로 반환하므로 프런트엔드 변경과 충돌하지 않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4로 진행한다.
