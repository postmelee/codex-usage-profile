# Task #92 Stage 3 완료보고서 — 계정 메뉴 터치 활성화 순서 보정

GitHub Issue: [#92](https://github.com/postmelee/codex-usage-profile/issues/92)
구현계획서: [`task_m100_92_impl.md`](../plans/task_m100_92_impl.md)
Stage: 3

## 단계 목적

모바일 브라우저에서 계정 메뉴 항목을 터치할 때 `relatedTarget = null`인 blur가 링크·버튼 활성화보다 먼저 메뉴를 언마운트해 이동 또는 로그아웃이 취소되는 회귀를 제거한다. 터치 보정과 함께 기존 키보드 메뉴 접근성 및 외부 dismiss 책임을 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/AccountMenu.jsx` | blur 닫힘 판정을 다음 animation frame으로 지연하고 내부 focus/pointer/click, 외부 dismiss, Escape, effect 정리에서 예약 검사를 취소한다. |
| `tests/profile-ui.spec.js` | Stage 1 known-failure를 성공 계약으로 전환하고 모바일 null-blur 터치에서 Profile·Settings 이동과 Log out 단일 요청을 검증한다. |
| `mydocs/working/task_m100_92_stage3.md` | Stage 3 구현·검증·잔여 위험을 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

- 공개 문서, 사용자 문구, 경로 계약은 변경하지 않았다.
- Profile과 Settings는 기존 anchor 기본 활성화를 유지하며 click이 성립한 뒤 메뉴 상태만 닫는다.
- Log out은 기존 비동기 중복 방지, 성공 시 익명 상태 전환, 실패 오류 표시를 유지한다.
- 외부 pointer down과 Escape는 기존처럼 즉시 메뉴를 닫고, Escape는 trigger 포커스를 복원한다.
- 메뉴 내부 포커스 이동과 pointer 활성화는 예약된 focus-out 검사를 취소해 stale close를 방지한다.
- 실제 포커스가 다음 프레임에도 메뉴 밖이면 메뉴를 닫으므로 Tab 포커스 이탈 계약을 유지한다.

## 검증 결과

실행 명령:

```bash
PROFILE_E2E_ORIGIN=http://127.0.0.1:5182 \
  npx playwright test tests/profile-ui.spec.js \
  --config=/private/tmp/task92-playwright.config.mjs \
  --grep "Task #92 mobile account menu|account menu exposes Profile|device approval common header" \
  --workers=1
npm run build
git diff --check
```

결과:

- OK — 집중 Playwright 테스트 `3 passed`.
- OK — 모바일 touch capability에서 null-blur 후 Profile과 Settings가 각각 canonical query 경로로 이동했다.
- OK — 같은 터치 순서의 Log out 요청은 정확히 한 번 실행되고 익명 UI로 전환됐다.
- OK — 키보드 첫 항목 포커스, Arrow/Home/End, Escape 복귀, Tab 이탈, 외부 pointer dismiss를 유지했다.
- OK — 공통 device approval 헤더의 계정 메뉴와 로그아웃 상태 정합성을 유지했다.
- OK — Vite 프로덕션 빌드 성공, `1828 modules transformed`.
- OK — `git diff --check` 통과.

## 잔여 위험

- 실제 iOS Safari와 모바일 Chrome에서의 터치 이벤트 순서는 Stage 4 배포 가능한 통합본으로 작업지시자가 다시 실측해야 한다.
- Task #92 전체 unit/E2E, Sites 프로덕션 빌드·산출물, 가능하면 Playwright WebKit 검증은 Stage 4 범위다.

## 다음 단계 영향

- Stage 4에서 Stage 2 공유 모션과 Stage 3 계정 메뉴 보정을 함께 통합 검증한다.
- 실제 기기 체크리스트는 홈 Share 열기·닫기와 Profile·Settings·Log out을 모두 포함해야 한다.
- 실제 기기 실측이 끝나기 전에는 Task #84 Stage 5와 마케팅 재개 판단을 보류한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 통합 검증과 실제 기기 실측 인계로 진행한다.
