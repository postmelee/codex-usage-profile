# Task #78 Stage 4 보고서 — 공개 카드 컴포넌트 통일과 비공개 소유자 안내

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 4

## 단계 목적

`PublicProfilePage`의 카드를 `/profile`과 같은 컴포넌트로 통일해 크기와 효과를 맞춘다. 비공개 상태의 소유자가 자기 링크를 열었을 때 막다른 화면 대신 공개 전환 안내를 보여준다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/PublicProfilePage.jsx` | raw `<img>`를 `MarketingCardPreview`로 교체, 비공개 소유자 안내와 공개 전환 CTA 추가 |
| `src/profile-ui/publicProfileRoutes.js` | unavailable 상태에 요청 handle 보존 |
| `src/profile-ui/messages.js` | ko/en 메시지 3개 추가 |
| `src/App.jsx` | `handle` 전달 |
| `src/styles.css` | `.public-profile-card` 제거, `.is-private-owner` 레이아웃 추가 |
| `src/profile-ui/__tests__/publicProfileRoutes.test.js` | unavailable handle 단언 갱신 |

## 동작 변경 1건

`loadPublicProfileRoute`가 unavailable 상태에서 handle을 `null`로 버렸다. 소유자가 자기 링크를 열었는지 판단하려면 요청 handle이 필요하므로 보존하도록 바꿨다. handle은 URL에서 온 값이라 서버가 새로 알려주는 정보가 없고, 노출 경로도 늘지 않는다. 관련 테스트 단언을 갱신하고 이유를 주석으로 남겼다.

## 소유자 판별 방식

`authState`의 세션 owner handle과 경로 handle을 클라이언트에서 비교한다. `/api/profiles/public/{handle}` 응답은 그대로 두었다. 서버 응답을 소유자 여부로 분기하면 비공개와 미존재를 구분할 수 있게 되어 handle 열거 오라클이 된다.

공개 전환은 자동이 아니라 명시적 버튼이며 기존 `client.updateProfileVisibility("public")`를 재사용한다. 성공하면 `authState`를 갱신하고 페이지를 다시 불러 공개 화면으로 전환한다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

브라우저 실측 (1440x900):

- OK. `npm test` 전체 679개 중 673 pass, 0 fail, 6 skipped
- OK. `git diff --check` 경고 없음
- OK. `/u/postmelee` 카드 실측 600x368. `/profile`과 동일하다
- OK. `HOVER-TILT` 요소와 `data-tilt-enabled="true"`, BorderBeam(`.home-card-beam`) 적용됨
- OK. `data-card-source="true"` 훅 확보. Stage 5 인계 모션이 쓸 수 있다
- OK. 비공개 전환 후 소유자에게 "카드가 아직 비공개입니다" 안내와 `카드 공개` 버튼 노출
- OK. 버튼 실행 시 공개로 전환되고, 재조회 후 카드 화면으로 바뀌며 `social.png`가 200을 반환
- OK. 비공개 상태에서 문서 title이 사이트 기본값으로 폴백. 공개 후 `postmelee's Codex card`로 복귀

첫 로드에서 `hover-tilt` 웹 컴포넌트가 비동기 import 중이면 잠시 `div`로 렌더된 뒤 교체된다. `/profile`도 같은 동작이며 기존 구현 그대로다.

## 잔여 위험

- 공개 전환 CTA는 브라우저 자동화의 합성 클릭으로는 React 핸들러가 실행되지 않았고, 프로그래매틱 클릭으로 전 과정을 확인했다. 히트 테스트상 좌표는 버튼 중앙이고 API 경로도 정상이므로 자동화 도구 쪽 문제로 판단하지만, 실제 브라우저에서 한 번 더 눌러보는 확인이 남아 있다.
- 비공개 소유자 안내는 세션 조회가 끝난 뒤에만 나타난다. 인증 상태가 `loading`인 동안에는 기존 로딩 화면이 보인다.

## 다음 단계 영향

- Stage 5는 이 카드에서 인트로 모달로 이어지는 인계 모션을 붙인다. `MarketingCardPreview`가 이미 `data-card-source`와 `data-share-transition-active`를 노출하므로 추가 훅이 필요 없다.
- 비공개 소유자는 카드가 없으므로 모달 대상이 아니다. Stage 5에서 `status === "ready"`일 때만 모달을 띄운다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5로 진행한다.
