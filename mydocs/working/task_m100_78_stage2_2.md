# Task #78 Stage 2.2 보고서 — 단일 social.png 발행과 공개 라우트

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 2.2

## 단계 목적

Stage 2.1이 만든 소셜 렌더 출력을 저장, 발행, 공개 라우트에 연결한다. 소셜 이미지는 handle당 하나만 유지하고 소유자가 저장한 `cardLocale`과 `cardStyle.theme`을 반영한다. OG 폴백 이미지도 운영자 핸들의 소셜 이미지로 연결한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-media/media-store-contract.js` | 소셜 stable key, 레코드 정규화, memory 어댑터 구현, 선택적 capability 판별 |
| `src/profile-media/r2-binding/store.js` | 소셜 객체 get/put/delete와 메타데이터 검증 |
| `src/profile-media/s3/store.js` | 동일 |
| `src/profile-media/publication-service.js` | 발행 경로에 소셜 쓰기 편입, unpublish에서 삭제 |
| `src/profile-media/maintenance-contract.js` | 소셜 key 판별 추가 |
| `src/profile-media/index.js` | 신규 export |
| `src/profile-card/service-core.js` | `renderOwnerSocialCard`, locale 변경 감지 |
| `src/profile-backend/http.js` | `GET\|HEAD /u/{handle}/social.png`, 렌더러·locale 전달 |
| `src/profile-runtime/host-adapter.js` | `isPublicSocialCardRoutePath` 추가 |
| `src/profile-runtime/runtime-backend.js` | Node 소셜 렌더러 주입 |
| `src/profile-runtime/open-graph.js` | 폴백 이미지 지원 |
| `src/profile-runtime/public-profile-document.js` | 운영자 핸들 기본값 연결 |
| `scripts/cleanup-orphan-card-media.mjs` | 소셜 key를 sweep 대상에서 보호 |
| 테스트 4개 파일 | 계약, 어댑터, 발행, 폴백 |

## 계획 대비 변경 3건

- **계약 필수 메서드로 만들지 않았다.** 소셜 메서드를 `PROFILE_MEDIA_STORE_METHODS`에 넣자 테스트 18개가 깨졌다. `assertProfileMediaStoreContract`가 모든 store에 구현을 강제하기 때문이다. `supportsProfileMediaSocialCard()`로 선택적 capability를 판별하도록 바꿔 기존 계약을 유지했다. 이 저장소가 선택적 훅을 다루는 기존 방식과 같다.
- **`host-adapter.js`를 수정했다.** Stage 1에서 건드리지 않기로 한 파일이지만, 그 제약은 HTML 라우트 승격을 막기 위한 것이었다. `social.png`는 `card.png`와 같은 미디어 라우트이므로 백엔드로 보내야 하며, 등록하지 않으면 Worker의 `looksLikeStaticAsset`이 확장자를 보고 정적 자산으로 오인해 404가 난다.
- **로케일 변경도 미디어 준비를 트리거하도록 바꿨다.** 아래 "동작 변경" 참조.

## 동작 변경 1건

`updateCardSettings`는 `cardStyle` 변경만 보고 미디어 준비 여부를 판단했다. 카드 4변형은 로케일과 무관하므로 기존에는 옳은 동작이었다. 그러나 소셜 이미지는 저장된 로케일 하나만 반영하므로, 로케일만 바뀌어도 재생성이 필요하다. `localeChanged`를 판단에 추가했다.

이 때문에 `src/profile-backend/__tests__/http.test.js`의 "로케일만 바꾸면 미디어 준비를 하지 않는다" 단언이 더 이상 유효하지 않아, 준비가 1회 더 실행되고 새 로케일이 전달되는지 확인하도록 바꾸고 이유를 주석으로 남겼다.

## 설계 판단 2건

- **발행이 idempotent로 조기 반환되는 경로에도 소셜을 쓴다.** 카드 publication은 항상 4변형을 만들어 설정을 바꿔도 내용이 같으므로 `publicationMatches`로 조기 반환된다. 소셜 쓰기를 이 경로에 넣지 않으면 설정 저장이 소셜에 반영되지 않는다.
- **공개 라우트가 publication 존재를 먼저 확인한다.** 소셜 객체를 직접 읽지 않고 dark authority를 메타데이터로 먼저 조회한다. unpublish 부분 실패로 소셜 객체가 남더라도 노출되지 않는다. 기존 light stable 정합성 검사와 같은 방침이다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

로컬 서버 실측 (`http://127.0.0.1:5174`):

```bash
curl -s -o /dev/null -w "%{http_code}" .../u/postmelee/social.png
curl -X PATCH .../api/profile -d '{"visibility":"public"}'
curl -X PATCH .../api/profile/card-settings -d '{"cardStyle":{...light},"cardLocale":"en"}'
curl -X PATCH .../api/profile -d '{"visibility":"private"}'
```

결과:

- OK. `npm test` 전체 675개 중 669 pass, 0 fail, 6 skipped
- OK. `git diff --check` 경고 없음
- OK. 발행 전 `social.png` 404
- OK. 발행 후 200, `image/png`, 81878 bytes, ETag와 `public, no-cache, must-revalidate`
- OK. `If-None-Match` 재검증 304
- OK. HEAD 200에 본문 0 bytes
- OK. 카드 설정을 light/en으로 저장하자 같은 URL이 새 ETag와 82142 bytes로 갱신. 육안으로 light 테마와 영문 라벨 확인
- OK. unpublish 후 404
- OK. `card.png`는 146588 bytes로 무변경

## 잔여 위험

- Worker 소셜 출력의 실제 resvg 렌더 결과는 아직 확인하지 못했다. Wasm 자산이 필요하므로 Stage 3 또는 Stage 6의 통합 검증에서 확인한다. Node 출력과 SVG 구조는 검증했다.
- 운영자 프로필이 비공개가 되면 폴백 이미지가 404가 된다. 홈 placeholder가 같은 취약점을 이미 공유하지만 외부 미리보기라 더 눈에 띈다.
- 투명 여백의 플랫폼 합성 색은 여전히 통제할 수 없다. Stage 6 실측 대상이다.

## 다음 단계 영향

- Stage 3은 `/u/{handle}` HTML에 문서 핸들러를 연결한다. `og:image`가 가리키는 `social.png` 경로는 이제 실제로 응답한다.
- 소셜 렌더러 주입은 Node가 명시적 옵션, Worker는 `renderPng.renderSocial` 자동 감지다. Stage 3에서 Sites 경로를 확인할 때 이 감지가 동작하는지 함께 본다.

## 승인 요청

- Stage 2.2 산출물과 검증 결과를 승인하면 Stage 3으로 진행한다.
