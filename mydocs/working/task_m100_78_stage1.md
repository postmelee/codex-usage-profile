# Task #78 Stage 1 보고서 — Open Graph 태그 계약과 공개 프로필 문서 핸들러

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 1

## 단계 목적

`/u/{handle}` HTML에 handle별 Open Graph 메타데이터를 붙이기 위한 순수 계약을 고정한다. 태그 값, 폴백 규칙, 리비전 토큰, 문구 로케일 결정, HTML 주입을 런타임과 무관한 모듈로 분리하고, 런타임 연결은 Stage 3으로 넘긴다.

구현계획서의 Stage 1에 해당한다. 라우팅 경계는 바꾸지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-runtime/open-graph.js` | 신규. 태그 문서 생성, head 렌더, HTML 주입, 리비전 토큰, 로케일 결정 |
| `src/profile-runtime/public-profile-document.js` | 신규. `/u/{handle}` 판별과 조회·로딩·주입 조합 핸들러 |
| `src/profile-runtime/__tests__/open-graph.test.js` | 신규. 태그 계약 13개 테스트 |
| `src/profile-runtime/__tests__/public-profile-document.test.js` | 신규. 핸들러 동작 13개 테스트 |

기존 파일 수정 없음. `host-adapter.js`와 `static-assets.js`는 변경하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 원문 보존은 해당 없음. 기존 API와 동작은 보존했다. 새 모듈은 어떤 기존 모듈도 import하지 않고, 어떤 기존 모듈도 새 모듈을 import하지 않는다. 따라서 이번 Stage만으로는 런타임 동작이 바뀌지 않는다.

## 고정한 계약

- `og:type` = `website`, `og:title` = `{handle}'s Codex card`
- `og:description`은 서비스 설명 고정 문구. ko는 `Codex Usage Profile에서 내 사용량 카드를 만들고 공유하세요.`, en은 `Create and share your Codex usage card on Codex Usage Profile.`
- `og:url`과 canonical은 쿼리 없는 `/u/{handle}`
- `og:image` = `/u/{handle}/social.png?v={uploadedAt 초 단위 epoch}`. 1200x630, `og:image:type`, `og:image:alt` 포함
- `twitter:card` = `summary_large_image`와 `twitter:title|description|image|image:alt`
- 문구 로케일은 요청 `?locale` 우선, 없으면 소유자 `cardLocale`, 둘 다 없으면 `en`. 이미지 URL은 로케일에 영향받지 않는다
- 속성값은 `&`, `<`, `>`, `"`를 이스케이프한다
- HTML 응답 캐시는 `public, max-age=0, s-maxage=60, must-revalidate`

## 설계 판단 3건

- **폴백에 이미지를 넣지 않는다.** 비공개와 미존재 handle은 `og:image` 없이 `twitter:card=summary`로 내린다. 현재 사이트에 1200x630 기본 이미지가 없고, 1497x918 샘플 카드를 쓰면 이번 task가 고치려는 잘림이 폴백에서 재현된다. 두 경우의 렌더 결과가 바이트 단위로 동일한지 테스트로 고정했다.
- **`vary` 헤더를 넣지 않았다.** 응답은 경로와 `?locale` 쿼리에만 의존하고 두 값 모두 캐시 키에 기본 포함된다. 의미 없는 `vary`는 캐시 적중률만 떨어뜨린다. 대신 핸들이 다르면 문서가 달라지는지를 테스트로 고정했다.
- **보안 헤더를 자체 상수로 두었다.** `static-assets.js`의 `STATIC_SECURITY_HEADERS`는 export되지 않고 해당 파일은 이번 범위에서 수정하지 않기로 했다. 같은 세 헤더를 새 모듈에 별도 상수로 정의했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-runtime/__tests__/open-graph.test.js
node --test src/profile-runtime/__tests__/public-profile-document.test.js
npm test
git status --short
git diff --check
```

결과:

- OK. `open-graph.test.js` 13개 통과
- OK. `public-profile-document.test.js` 13개 통과
- OK. `npm test` 전체 633개 중 627 pass, 0 fail, 6 skipped. skip은 기존과 동일
- OK. `git status --short`에 신규 4개 파일만 나타나고 `host-adapter.js`, `static-assets.js`는 변경되지 않음
- OK. `git diff --check` 경고 없음

## 잔여 위험

- 폴백에 이미지가 없어 비공개·미존재 링크는 미리보기에 이미지가 표시되지 않는다. 의도한 동작이지만 마케팅 관점에서 기본 이미지를 원하면 1200x630 자산을 별도로 만들어야 한다.
- `s-maxage=60` 값은 아직 실제 트래픽 근거가 없는 초기값이다. Stage 3에서 D1 부하를 보고 조정할 수 있다.

## 다음 단계 영향

- Stage 2는 `og:image`가 가리키는 `/u/{handle}/social.png?v=` 경로를 실제로 제공해야 한다. `v`는 무시 가능한 캐시 버스터로 취급한다.
- Stage 3은 `loadIndexHtml`과 `resolveProfile`을 런타임별로 주입한다. `resolveProfile`은 `{ handle, cardLocale, uploadedAt }`만 반환하면 되고, 이 형태가 단일 인덱스 조회 제약을 그대로 표현한다.
- 핸들러는 매칭되지 않거나 주입에 실패하면 `null`을 반환한다. 호출 측은 `null`일 때 기존 경로로 넘겨야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
