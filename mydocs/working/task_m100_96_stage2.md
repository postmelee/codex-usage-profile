# Task #96 Stage 2 보고서 — semantic text theme transition 보정

GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
구현계획서: [`task_m100_96_impl.md`](../plans/task_m100_96_impl.md)
Stage: 2

## 단계 목적

테마 전환 애니메이션이 끝난 뒤 primary text가 뒤늦게 깜빡이며 바뀌는 현상을 제거한다. Stage 1에서
확정한 Home·Profile·Device primary text가 상위 요소의 지연된 상속에 기대지 않고
`--text-primary`를 직접 소유하도록 보정하고, 일반 모션과 reduced motion 동작을 양 브라우저 엔진에서
검증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/styles.css` | audit 대상 primary text selector에 `color: var(--text-primary)` 직접 부여 |
| `src/profile-ui/__tests__/themeSurfaceContract.test.js` | selector 묶음도 정확히 검사하는 source 계약과 정상 assertion 전환 |
| `tests/profile-ui.spec.js` | 일반 모션 중간색·최종색 안정성과 reduced motion 즉시 전환 회귀 검증 추가 |
| `mydocs/working/task_m100_96_stage2.md` | Stage 2 변경·검증·잔여 범위 기록 |
| `mydocs/orders/20260812.md` | Stage 2 완료와 Stage 3 진행 상태 기록 |

## 구현 결과

다음 text surface가 모두 `--text-primary`를 직접 참조한다.

- Home account identity, Quickstart heading, Quickstart step heading
- Device heading
- Profile display name, loading/error/empty stage heading

Playwright 검증은 dark에서 light로 전환할 때 각 대상의 중간 computed color가 시작색·종료색과
다르고, `data-theme-animating` 제거 뒤에도 최종색이 유지되는지 확인한다. reduced motion에서는 animation
attribute와 transition window 없이 즉시 최종색이 적용되는지 별도로 확인한다.

## 본문 변경 정도 / 본문 무손실 여부

문구·레이아웃·라우팅·API·storage 계약은 변경하지 않았다. CSS color ownership과 이를 고정하는 테스트만
수정했으며, Stage 1에서 범위 밖으로 분류한 status·link·action·card 내부 text는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test --test-name-pattern="primary headings" src/profile-ui/__tests__/themeSurfaceContract.test.js
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --grep "Task #96 semantic|Task #96 reduced" --workers=1
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --browser=webkit --grep "Task #96 semantic|Task #96 reduced" --workers=1
git diff --check
```

결과:

- OK — Node primary heading semantic token 계약 1건 통과.
- OK — Chromium 일반 모션·reduced motion 2건 통과.
- OK — WebKit 일반 모션·reduced motion 2건 통과.
- OK — 일반 모션은 같은 transition window 안에서 중간색을 거쳐 최종색에 안정적으로 도달했다.
- OK — reduced motion은 transition 없이 즉시 최종색에 도달했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- page Skeleton과 card Skeleton은 여전히 같은 dark card placeholder·sheen token을 사용한다.
- light card URL을 사용하는 화면도 loading frame에는 card theme context가 전달되지 않는다.

## 다음 단계 영향

- Stage 3에서 site theme를 따르는 page Skeleton token과 card theme를 따르는 card Skeleton token을
  분리한다.
- Home·owner/public Profile·public intro·Share Studio·settings preview에 명시적인 card theme context를
  전달하고 light/dark 조합을 회귀 검증한다.

## 승인 상태

- 작업지시자가 #96 PR 생성까지 승인했으므로 Stage 2 결과를 기준으로 Stage 3를 계속한다.
