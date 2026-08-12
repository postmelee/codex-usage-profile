# Task #95 Stage 3 보고서 — Home 복귀와 카드 lifecycle 회귀 보강

GitHub Issue: [#95](https://github.com/postmelee/codex-usage-profile/issues/95)
구현계획서: [`task_m100_95_impl.md`](../plans/task_m100_95_impl.md)
Stage: 3

## 단계 목적

Stage 2 단일 reveal 모델이 최초 direct Home뿐 아니라 Profile 상단 브랜드 링크의 full navigation,
cold/warm 연속 reload와 logout stale completion에서도 유지되는지 같은 상태 이력 assertion으로
고정한다. product source를 추가 확장하지 않고 navigation·resource lifecycle 회귀 증거를 보강한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `tests/profile-ui.spec.js` | Task #95 상태 관찰 helper 추출, Profile→Home full navigation과 연속 reload 단조 reveal 회귀 추가 |
| `mydocs/working/task_m100_95_stage3.md` | navigation·lifecycle 검증과 잔여 merge Gate 기록 |
| `mydocs/orders/20260812.md` | #95 Stage 3 완료와 Stage 4 통합 검증 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

Stage 3에서는 제품 소스와 공개 문서를 변경하지 않았다. 기존 `ProfileShell` 브랜드 링크의 `/`
full navigation 의미를 그대로 실제 테스트 경로로 사용했고 SPA router나 auth callback 모사를
추가하지 않았다. 관찰 helper는 page init마다 identity-free status·kind·busy 이력만 초기화한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/homeCardTransition.test.js src/profile-ui/__tests__/homeCardTarget.test.js src/profile-ui/__tests__/cardImageReadiness.test.js
npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task95.playwright.config.mjs --grep "Task #95|Home card transition ignores a stale owner image|card readiness releases reacquired same-source leases" --workers=1
npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task95.playwright.config.mjs --browser=webkit --grep "Task #95" --workers=1
git diff --check
```

결과:

- OK — transition·target·resource lifecycle Node 테스트 22/22 통과.
- OK — Chromium 5/5 통과: direct authenticated mount, Profile→Home full navigation, cold/warm
  reload 2회, logout stale owner, same-source lease reacquire.
- OK — WebKit Task #95 3/3 통과: direct mount, Profile 복귀, cold/warm reload 모두 상태 이력이
  `loading → ready(owner)`이며 intermediate `ready(operator)`가 없다.
- OK — owner image DOM commit과 resource lease 기존 assertion을 유지했고 stale owner URL·identity가
  logout 뒤 재등장하지 않았다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- 실제 모바일 Safari·Chrome paint 결과는 작업지시자 요청에 따라 두 PR 게시 뒤 merge 전 로컬·
  모바일 Gate로 남는다. 자동 WebKit과 device viewport가 실제 브라우저 UI까지 대체하지 않는다.
- 전체 Playwright·production build·Sites artifact와 local full-stack smoke는 Stage 4에서 실행해야 한다.

## 다음 단계 영향

- Stage 4는 source 변경 없이 전체 Node·Playwright, production Sites build·artifact verifier·local smoke를
  실행하고 실제 배포 없는 로컬 확인 절차를 작성한다.
- PR 본문은 실제 모바일 확인 전 merge하지 않는 Gate와 #96 순차 PR 진행을 명시한다.

## 승인 요청

- 작업지시자가 #95·#96 모두 PR 생성까지 진행하도록 승인했으므로 Stage 3 결과를 기준으로
  Stage 4 통합 검증을 계속한다.
