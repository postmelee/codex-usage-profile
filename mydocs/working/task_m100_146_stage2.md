# Task #146 Stage 2 재개 보고서 — 라이트 전용 라이브·GIF keyline 재작업

GitHub Issue: [#146](https://github.com/postmelee/codex-usage-profile/issues/146)
구현계획서: [`task_m100_146_impl.md`](../plans/task_m100_146_impl.md)
Stage: 2 (재개)

> **2026-08-30 판정 정정:** 계산 스타일과 서로 다른 frame hash만으로 라이트 Beam의 시각 수용성을 통과 처리한 아래 최초 완료 판단은 작업지시자 실제 검수와 일치하지 않았다. 첨부 GIF와 사분면 이미지에서 효과를 식별할 수 없다는 피드백을 수용해 완료 상태를 철회하고 Stage 2를 재개한다. 아래 최초 검증 기록은 거짓 양성의 원인 추적을 위해 보존하며, 최종 Stage 2 결과로 사용하지 않는다.

## 단계 목적

Stage 1에서 연결한 카드 테마가 실제 브라우저에서 라이트 Beam의 대비를 높이는지 확인하고, 다크 표현과 카드 기하·handoff·reduced-motion 계약이 그대로 유지되는지 자동·시각 검증으로 고정한다. 최초 판단 실패 후에는 승인된 범위 확장에 따라 다크 발광형 프리셋을 보존하면서 라이트 keyline 중심 라이브·GIF 합성을 별도로 구현하고 전체 loop의 육안 식별성을 검증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `tests/profile-ui.spec.js` | 실제 렌더러 다크·라이트 카드를 사용한 Beam 대비·동일 기하·노드 안정성 회귀 테스트 추가 |
| `mydocs/orders/20260830.md` | Task #146 상태를 Stage 2 완료·승인 대기로 갱신 |
| `mydocs/working/task_m100_146_stage2.md` | Stage 2 자동·시각 검증과 다음 단계 인계 기록 |

Playwright 계약은 실제 `1497×918` 다크·라이트 PNG를 테스트 안에서 생성하고, 같은 카드 source와 Beam 노드에서 테마를 전환해 측정한다. 테스트 파일 변경량은 156줄 추가다.

## 본문 변경 정도 / 본문 무손실 여부

제품 소스와 공개 문서는 Stage 2에서 변경하지 않았다. 테스트는 카드 테마 전환 시 아래 계약을 관찰할 뿐 렌더러, GIF golden, 공유 애니메이션 프리셋이나 카드 레이아웃을 수정하지 않는다.

- 다크: 흰색 계열 Beam stroke `rgba(255, 255, 255, 0.75)`, inner shadow `rgba(255, 255, 255, 0.27)`, saturation `1.2`
- 라이트: 검정색 계열 Beam stroke `rgba(0, 0, 0, 0.55)`, inner shadow `rgba(0, 0, 0, 0.14)`, saturation `1.5`
- 공통: brightness `1.05`, 안정 상태 animation duration `4.8s, 0.6s`, strength `0.82`

`motion-design` 관점에서 모션 속도·궤적·강도를 추가하지 않고 배경에 맞는 색상 대비만 전환했다. 라이트 캡처에서 흰 카드 가장자리 위 어두운 Beam 대비가 확인되어 별도 강도 튜닝 결정 게이트에는 진입하지 않았다.

## 검증 결과

실행 명령:

```bash
npx playwright test tests/profile-ui.spec.js --grep "Task #146|Share handoff|loading and unavailable account states|card appearance"
npm run build:production
npm run verify:sites-production
git diff -- src/profile-card/gif-animation.js
git diff --check
git status --short
git diff --stat
```

결과:

- OK — Playwright 대상 회귀군 6/6 통과, 실패 0개
- OK — Task #146 신규 시나리오가 다크 흰색 계열과 라이트 검정색 계열 Beam 계산 스타일을 구분
- OK — 테마 전환 전후 같은 `data-beam` 식별자와 같은 Beam DOM 노드를 유지
- OK — 다크·라이트 모두 이미지 원본 `1497×918`, CSS `aspect-ratio: 499 / 306`
- OK — 다크·라이트 캡처 모두 `600×369`; 프레임 폭·높이·곡률은 소수 둘째 자리 허용 오차 안에서 동일
- OK — 기존 4.8초 회전, 0.82 strength, brightness 1.05 유지
- OK — 최신 draft decoded-preview handoff, Share handoff, reduced-motion 포함 대상 회귀 통과
- OK — production server/client build 완료, client 1,839 modules 변환
- OK — Sites production artifact verifier `ok: true`; artifact 7,919,206 bytes, client 14 files, worker 2 files, migration 6 files, binding 3개
- OK — 로컬 브라우저 다크 Hero의 Beam 동작과 카드 표시 확인, 콘솔 warning/error 0개
- OK — `src/profile-card/gif-animation.js` diff 없음, `git diff --check` 경고 없음

초기 신규 테스트는 라이트 이미지 준비 직후 handoff의 정상적인 0.5초 fade-out 상태를 측정해 1회 실패했다. 제품 코드는 변경하지 않고 Beam이 다시 `data-active`가 되어 0.6초 fade-in을 마친 안정 상태를 기다리도록 테스트 측정 시점을 보정한 뒤 통과했다. 첫 라이트 캡처에서 sticky header가 카드 상단을 가린 것도 카드 자체 문제와 분리해 같은 화면 중앙 위치에서 다시 캡처했다.

## 잔여 위험

- 자동 캡처는 정지 프레임이므로 전체 회전 주기의 모든 각도를 이미지 하나로 표현하지는 않는다. 계산 스타일, 4.8초 animation duration, 실제 로컬 동작 확인으로 보완했다.
- 원격 Stage5는 Task #146 브랜치에서 변경하지 않았다. 병합 후 Task #144가 새 exact-main을 승격·배포한 환경에서 최종 원격 동작을 다시 확인해야 한다.
- 라이브러리 내부 CSS 생성 구조가 향후 변경되면 핵심 계산 색상 계약 테스트를 새 공개 계약에 맞춰 갱신할 수 있다.

## 다음 단계 영향

- Stage 3에서는 전체 `npm test`, 전체 Playwright, production build·artifact verifier를 다시 실행한다.
- 최종 변경 목록에서 GIF 프리셋·golden asset, 카드·소셜 렌더러와 카드 기하가 변경되지 않았음을 확인한다.
- #146 병합 뒤 #144가 기존 exact-main 후보를 폐기하고 새 `devel` 병합 커밋부터 main 승격·Stage5 배포·원격 스모크를 다시 수행한다는 인계 내용을 확정한다.

## 재개 상태

- 최초 Stage 2 완료·Stage 3 진입 요청은 철회했다.
- 작업지시자가 2026-08-30 다크와 라이트의 효과 합성 로직을 분리하는 권장안을 승인했다.
- 개정 구현계획에 따라 라이트 live keyline, light GIF golden, Worker theme 전달과 실제 픽셀/전체 loop 검증을 같은 Stage 2에서 수행한다.
