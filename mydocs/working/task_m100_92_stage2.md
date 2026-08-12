# Task #92 Stage 2 완료보고서 — 모바일 공유 카드 공간 전환 보정

GitHub Issue: [#92](https://github.com/postmelee/codex-usage-profile/issues/92)
구현계획서: [`task_m100_92_impl.md`](../plans/task_m100_92_impl.md)
Stage: 2

## 단계 목적

모바일에서 공유 모달을 열고 닫을 때 출발 카드의 잘못된 사각형이 과도한 `scale()`로 이어지는 회귀를 제거한다. User-Agent가 아닌 pointer capability와 출발·도착·뷰포트 사각형의 안전성으로 전환 모드를 선택하면서 데스크톱의 안전한 FLIP과 기존 접근성 계약은 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/useCardHandoffMotion.js` | `scale`, `translate`, `target` 전환 판정 계약과 뷰포트 안전성 검사를 추가하고 열기·닫기에 동일하게 적용했다. |
| `src/profile-ui/__tests__/useCardHandoffMotion.test.js` | fine/coarse pointer, 안전·불안전 사각형, 신뢰할 수 없는 뷰포트의 순수 판정 테스트 5개를 추가했다. |
| `tests/profile-ui.spec.js` | Stage 1의 모바일 공유 known-failure 표시를 제거하고 `scale(1)`, 목표 위치 정착, 뷰포트 내부 첫 프레임을 성공 계약으로 전환했다. |
| `mydocs/working/task_m100_92_stage2.md` | Stage 2 구현·검증·잔여 위험을 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

- 공개 문서와 사용자 문구는 변경하지 않았다.
- 안전한 fine pointer 사각형은 기존 `translate + scale` FLIP과 `data-motion-origin="source"`를 유지한다.
- coarse pointer는 목표 카드 크기인 `scale(1)`을 유지한 채 출발 카드 중심에서 이동한다.
- 중심 이동도 뷰포트를 벗어나거나 뷰포트 값을 신뢰할 수 없으면 목표 위치의 짧은 투명도 전환으로 정착한다.
- 열기와 닫기가 같은 순수 판정 함수를 사용하므로 모바일 닫기에서 확대가 재발하지 않는다.
- reduced-motion, 리사이즈 시 목표 위치 정착, warm-source 이미지 재사용 동작은 변경하지 않았다.
- `ShareStudio.jsx`와 `src/styles.css`에는 추가 보정이 필요하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/useCardHandoffMotion.test.js
PROFILE_E2E_ORIGIN=http://127.0.0.1:5182 \
  npx playwright test tests/profile-ui.spec.js \
  --config=/private/tmp/task92-playwright.config.mjs \
  --grep "Task #92 mobile Share Studio|card owner can publish|Share card dialog fits|reduced motion|settles after resize" \
  --workers=1
npm run build
git diff --check
```

결과:

- OK — 순수 모션 판정 테스트 `5 passed`.
- OK — 모바일 첫 프레임은 `data-motion-mode="target"`, `data-motion-origin="target"`, `scaleX=1`, `scaleY=1`, 뷰포트 내부를 만족했다.
- OK — Playwright 대상 회귀 테스트 `10 passed`; 데스크톱 공유, 모바일 레이아웃, reduced-motion, 리사이즈 정착 계약을 함께 확인했다.
- OK — Vite 프로덕션 빌드 성공, `1828 modules transformed`.
- OK — `git diff --check` 통과.

## 잔여 위험

- 실제 iOS Safari와 모바일 Chrome에서의 체감 전환은 배포 가능한 통합본에서 작업지시자가 다시 실측해야 한다.
- 계정 메뉴 터치 이동 실패는 Stage 3 범위이며 Stage 1 known-failure 계약이 계속 보호한다.

## 다음 단계 영향

- Stage 3은 공유 모션 코드를 추가로 변경하지 않고 계정 메뉴의 `pointerdown`/`blur`/`click` 생명주기만 보정한다.
- Stage 3 회귀 검증에서 이번 Stage의 모바일 `scale(1)` 성공 계약과 데스크톱 공유 기준선을 다시 실행한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 계정 메뉴 터치 생명주기 보정으로 진행한다.
