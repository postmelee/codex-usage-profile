# Task #146 Stage 1 완료보고서 — Beam 테마 소유권 연결과 계약 고정

GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
구현계획서: [`task_m100_146_impl.md`](../plans/task_m100_146_impl.md)
Stage: 1

## 단계 목적

라이브 카드 미리보기의 `BorderBeam`과 카드 이미지 프레임이 하나의 정규화된 카드 테마를 공유하도록 테마 소유권을 연결한다. 공유 애니메이션 프리셋, 카드 기하 및 GIF 경로는 변경하지 않고 라이트 카드가 라이브러리의 라이트 테마 대비를 선택할 수 있는 최소 코드 변경과 회귀 계약을 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-marketing/MarketingLanding.jsx` | `resolvedCardTheme`을 한 번 만들고 `BorderBeam.theme`과 `CardImageFrame.cardTheme`에 동일하게 전달 |
| `src/profile-ui/__tests__/themeSurfaceContract.test.js` | Task #146 단일 테마 전달 및 기존 Beam 프리셋 전달 계약 테스트 추가 |
| `mydocs/orders/20260830.md` | Task #146 상태를 Stage 1 완료·승인 대기로 갱신 |
| `mydocs/working/task_m100_146_stage1.md` | Stage 1 구현·검증·잔여 위험 기록 |

코드 변경량은 제품 소스와 계약 테스트 기준 20줄 추가, 1줄 삭제다.

## 본문 변경 정도 / 본문 무손실 여부

문서 본문 작업은 해당 없다. 공개 API, 카드 설정 스키마, 카드 DOM 구조, 이미지 `1497×918` 크기, CSS 레이아웃과 애니메이션 프리셋 전달은 보존했다. 기존 `CardImageFrame`의 방어적 테마 정규화도 유지했다.

`motion-design` 관점에서는 기존 4.8초 ambient loop의 타이밍·강도·움직임을 바꾸지 않고, 상태에 맞는 색상 대비 선택만 연결해 모션의 시인성을 회복하도록 제한했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/themeSurfaceContract.test.js
git diff -- src/profile-card/gif-animation.js
git diff --check
git status --short
git diff --name-only
```

결과:

- OK — `themeSurfaceContract.test.js` 9개 테스트 전부 통과, 실패·취소·건너뜀 0개
- OK — Task #146 신규 계약이 `resolvedCardTheme` 선언과 `BorderBeam`·`CardImageFrame` 동일 전달을 확인
- OK — `brightness`, `colorVariant`, `duration`, `size`, `strength`가 기존 `PROFILE_CARD_BORDER_BEAM_PRESET`에서 계속 전달됨을 확인
- OK — `src/profile-card/gif-animation.js` diff 없음
- OK — 제품 변경 파일은 승인된 `MarketingLanding.jsx`, `themeSurfaceContract.test.js` 두 파일뿐
- OK — `git diff --check` 경고 없음

## 잔여 위험

- 라이브러리 내장 라이트 테마의 실제 계산 색상과 시각 대비는 Stage 2 production build 브라우저 검증이 필요하다.
- 다크·라이트 카드의 프레임 치수·곡률 동등성 및 테마 전환 handoff는 Stage 2 Playwright 회귀 검증에서 고정해야 한다.
- 내장 라이트 테마만으로 대비가 충분하지 않으면 승인된 결정 게이트에 따라 추가 소스 변경 없이 중지하고 라이트 전용 보정 승인을 요청해야 한다.

## 다음 단계 영향

- Stage 2는 `theme={resolvedCardTheme}` 결과를 실제 브라우저 계산 스타일로 확인한다.
- 다크 기존 표현과 라이트 어두운 대비 계열을 비교하고, 양쪽의 `1497×918`, `499:306`, 프레임 bounding box·곡률을 같은 뷰포트에서 측정한다.
- decoded-preview handoff와 reduced-motion 계약을 함께 회귀 검증한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 라이트·다크 시각 및 상호작용 동등성 검증으로 진행한다.
