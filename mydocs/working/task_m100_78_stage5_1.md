# Task #78 Stage 5.1 보고서 — Share Studio 인계 모션 공용 훅 추출

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 5.1

## 단계 목적

`ShareStudio.jsx`에 인라인으로 들어 있던 FLIP 인계 모션을 런타임 무관 훅으로 분리한다. Stage 5.2의 인트로 모달이 같은 모션을 재사용하기 위한 선행 작업이며, 이 단계에서는 **기능을 바꾸지 않는다.**

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/useCardHandoffMotion.js` | 신규. 위상 상태기계, 열기·닫기·인계 애니메이션, rect 변환 헬퍼 |
| `src/profile-ui/ShareStudio.jsx` | 모션 코드를 훅 호출로 대체 (313줄 삭제, 15줄 추가) |

`ShareStudio.jsx`는 852줄에서 554줄로 줄었다. 다이얼로그 관심사(포커스 트랩, `inert`, body overflow, 토스트)는 그대로 남기고 모션만 분리했다.

## 훅 계약

```js
const { cardRef, phase, requestClose, requestCloseRef, settleAtTarget } =
  useCardHandoffMotion({ active, onClose, restartKey, sourceCardRef, sourceRect });
```

- `phase`: `preparing | opening | open | closing | handoff`
- `restartKey`: 값이 바뀌면 열기 애니메이션을 다시 실행한다. Share Studio는 `imageUrl`을 넘긴다
- `requestCloseRef`: 키보드 핸들러처럼 최신 참조가 필요한 곳에서 쓴다
- `settleAtTarget(reason)`: 애니메이션을 중단하고 목표 위치에 고정한다. 뷰포트 변경과 미리보기 로드 실패에서 호출된다

기존 동작을 그대로 옮겼다. 지속시간, 이징, 프레임, `prefers-reduced-motion` 분기, `data-motion-origin`/`data-motion-fallback` 속성, 소스 카드 인라인 스타일 복원까지 값과 순서를 유지했다.

## 검증 결과

실행 명령:

```bash
node --check src/profile-ui/useCardHandoffMotion.js
npx vite build
npm test
```

결과:

- OK. 훅 구문 검사 통과
- OK. 프로덕션 번들 빌드 성공
- OK. `npm test` 전체 679개 중 673 pass, 0 fail, 6 skipped
- OK. `/profile`에서 Share Studio 열기·닫기 전 과정을 브라우저로 확인했다
  - 열기: `data-motion-origin="source"`, 소스 카드 `data-share-transition-active="true"`, backdrop `is-opening`
  - 닫기: `is-open` → `is-closing` → `is-handoff` → DOM 제거
  - 인계 후 소스 카드의 인라인 스타일이 `null`로 복원되고 `data-share-transition-active`가 해제됨

## 검증하지 못한 것

홈(`/`)의 Share Studio는 이 브라우저 패널에서 확인하지 못했다. 홈 카드 전환이 `image.decode()` 완료를 기다리는데(`homeCardTransition.js`), 이 패널에서는 이미지가 완전히 로드된 뒤에도(`complete: true`, 1497x918) `decode()`가 resolve되지 않는다. 4초 타임아웃으로 재현했다. 그 결과 공유 버튼이 `카드 불러오는 중` 상태로 남아 클릭할 수 없다.

이 코드는 이번 단계에서 수정하지 않았고 `/profile` 경로에서 훅이 정상 동작하므로 환경 제약으로 판단하지만, 실제 브라우저에서 홈 공유 흐름을 한 번 확인하는 절차가 남아 있다. e2e 스위트에 해당 흐름이 있으므로(`tests/profile-ui.spec.js`) Stage 6 통합 검증에서 함께 실행한다.

## 잔여 위험

- 홈 Share Studio 실브라우저 확인이 남아 있다.
- `npm run test:e2e`를 이번 단계에서 실행하지 않았다. Stage 5.2 완료 후 5.1과 5.2를 함께 e2e로 검증한다.

## 다음 단계 영향

- Stage 5.2는 이 훅을 그대로 재사용하되, 첫 진입에는 출발 rect가 없으므로 열기 프레임만 360도 회전으로 대체한다. 닫기와 인계 경로는 훅의 것을 그대로 쓴다.
- 목적지가 뷰포트 밖일 때의 스크롤 보정은 훅이 아니라 호출 측에서 처리한다. 훅은 rect를 받는 계약만 유지한다.

## 승인 요청

- Stage 5.1 산출물과 검증 결과를 승인하면 Stage 5.2로 진행한다.
