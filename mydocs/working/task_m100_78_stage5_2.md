# Task #78 Stage 5.2 보고서 — 공개 프로필 카드 인트로 모달

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 5.2

## 단계 목적

다른 사람의 공유 링크로 `/u/{handle}`에 처음 들어왔을 때 카드가 회전하며 등장하는 모달을 보여주고, 닫으면 하단 `공유된 Codex 카드` 자리로 이어지는 인계 애니메이션을 연결한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/PublicCardIntro.jsx` | 신규. 인트로 모달, 포커스 트랩, 스크롤 보정, CTA |
| `src/profile-ui/useCardHandoffMotion.js` | `introFrames`/`introDuration` 옵션 추가 |
| `src/profile-ui/PublicProfilePage.jsx` | 모달 연결, 카드 ref와 `transitionSuspended` 전달 |
| `src/profile-ui/messages.js` | ko/en 메시지 3개 |
| `src/styles.css` | 모달 배경 블러와 레이아웃 |

## 구현 내용

- 등장은 `rotateY(-360deg) → 0`에 `perspective(1400px)`와 scale을 더한 900ms 애니메이션이다. 회전은 `hover-tilt`가 자체 transform을 쓰는 요소가 아니라 바깥 래퍼에 건다.
- 모달 안의 카드는 `MarketingCardPreview`를 그대로 쓴다. hover-tilt와 BorderBeam이 함께 적용된다.
- 닫기는 Stage 5.1에서 추출한 훅의 인계 경로를 그대로 쓴다. 카드가 하단 `공유된 Codex 카드` 위치로 이동하고, 소스 카드가 드러나며 모달이 사라진다.
- 배경은 `backdrop-filter: blur(18px)`이고 닫기 시작과 함께 해제된다.
- 매 진입마다 표시한다. 비공개 소유자 미리보기에는 표시하지 않는다.

## 구현 중 고친 것 2건

- **여는 애니메이션이 회전이 아니라 FLIP으로 동작했다.** 인계 대상 카드가 화면 밖이어도 DOM에는 있어서 `resolveSourceRect`가 유효한 rect를 돌려주고, 그 결과 열기 경로가 rect 변환을 선택했다. 훅에서 `introFrames`가 있으면 rect 변환보다 우선하도록 고쳤다. 닫기는 그대로 rect 변환을 쓴다.
- **첫 프레임 `opacity: 0`을 없앴다.** 애니메이션이 진행되지 않는 환경에서 카드가 영영 보이지 않게 되는 상태가 관측됐다. 모든 프레임을 불투명으로 두어 회전만으로 등장을 표현하고, 애니메이션이 멈춰도 카드가 보이게 했다.

## 닫기 시 화면 이동

초안은 인계 대상을 `scrollIntoView`로 먼저 끌어온 뒤 인계했다. 작업지시자 요청으로 스크롤을 건드리지 않고, 카드가 자기 자리를 향해 아래로 내려가며 화면 밖으로 빠져나가는 방식으로 바꿨다. 화면은 최상단에 그대로 머문다. 실측에서 닫기 전후 `scrollY`가 0으로 유지되고 대상 카드 위치도 806으로 변하지 않았다.

## 기하 정합 수정

인계는 모션 요소의 rect를 대상 카드 rect에 매핑하므로 두 요소의 크기가 어긋나면 카드가 이상한 크기로 이동한다. 초안에서는 세 가지가 어긋나 있었다.

- 모달 다이얼로그가 `justify-items: center`라 래퍼가 콘텐츠 폭으로 줄어들어 카드가 왼쪽으로 49px 치우쳤다.
- 래퍼가 720px인데 보이는 카드는 600px이라 인계가 720에서 600으로 매핑됐다.
- `.home-card-tilt`의 `margin-top: 24px`가 래퍼 높이를 카드보다 24px 크게 만들었다.

래퍼를 카드와 정확히 같은 박스로 만들어 해결했다. 실측에서 래퍼와 카드가 600x368로 완전히 일치하고, 대상 카드와도 같은 크기다. 인계가 크기 변화 없는 순수 이동이 된다. 다이얼로그 폭도 카드에 맞춰 닫기 버튼이 카드 오른쪽 가장자리에 정렬된다.

## 검증 결과

실행 명령:

```bash
npm test
npx vite build
```

결과:

- OK. `npm test` 전체 679개 중 673 pass, 0 fail, 6 skipped
- OK. 프로덕션 번들 빌드 성공
- OK. 모달이 첫 진입에 표시되고 카드, 제목, CTA 두 개가 렌더된다
- OK. 회전 애니메이션 객체가 `rotateY(-360deg)` 첫 프레임과 900ms 지속시간으로 생성된다
- OK. 닫기 위상이 `is-closing` → `is-handoff` → DOM 제거 순으로 진행된다
- OK. 인계 후 소스 카드의 인라인 스타일이 복원되고 `data-share-transition-active`가 해제된다
- OK. 닫기 시 스크롤이 움직이지 않는다 (전후 `scrollY` 0)
- OK. 모션 래퍼와 보이는 카드가 600x368로 일치하고 대상 카드와 같은 크기다
- OK. 카드가 뷰포트 가로 중앙에 정렬된다
- OK. 닫힌 뒤 `inert`, `body.overflow`, 소스 카드 인라인 스타일이 모두 복원된다

## 검증하지 못한 것

**애니메이션이 실제로 재생되는 모습은 이 브라우저 패널에서 확인하지 못했다.** 패널의 Web Animations가 진행되지 않는다. 애니메이션 객체는 `playState: "running"`인데 `currentTime`이 0에서 움직이지 않는다. 같은 패널에서 `image.decode()`도 resolve되지 않는 것과 같은 계열의 제약으로 보인다. 위상 전환은 훅의 타이머 폴백으로 진행되므로 흐름 자체는 확인됐다.

회전이 의도한 속도와 곡선으로 보이는지는 실제 브라우저에서 확인이 필요하다.

## 잔여 위험

- 회전 애니메이션의 실제 재생 확인이 남아 있다.
- `npm run test:e2e`를 아직 실행하지 않았다. Stage 6 통합 검증에서 Share Studio 회귀와 함께 실행한다.
- 매 진입마다 모달이 뜨는 정책이라 뒤로가기와 새로고침에서도 표시된다. 승인된 결정이다.

## 다음 단계 영향

- Stage 6은 Share Studio 액션 재구성과 통합 검증이다. e2e에서 홈·`/profile` Share Studio와 이번 모달을 함께 검증한다.

## 승인 요청

- Stage 5.2 산출물과 검증 결과를 승인하면 Stage 6으로 진행한다.
