# Task M100 #35 Stage 5 보고서

GitHub Issue: [#35](https://github.com/postmelee/codex-usage-profile/issues/35)
구현계획서: [`task_m100_35_impl.md`](../plans/task_m100_35_impl.md)
Stage: 5

## 단계 목적

작업지시자의 Profile 화면 확인에서 발견된 tooltip 정보 밀도와 owner card 표현 차이를
보정했다. 정확한 raw token은 명시적 설정에서만 표시하고, `Your Codex card`는 Home의
공용 card renderer와 Share Studio 전환을 그대로 재사용하도록 정리한 뒤 전체 browser·
Sites artifact 회귀를 검증했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_35_impl.md` | 승인된 exact token 설정과 Home card parity 보정 범위·검증 기준 반영 |
| `src/profile-ui/heatmap.js` | compact tooltip과 exact tooltip을 동일 target에서 생성하는 pure contract 추가 |
| `src/profile-ui/TokenActivityChart.jsx` | 기본 OFF `Show exact token count` checkbox, tooltip·ARIA label 전환, stale tooltip 제거 추가 |
| `src/profile-ui/CardProfilePage.jsx` | Home의 `MarketingCardPreview`, identity/action 계층, source-origin Share Studio와 make-private 흐름 재사용 |
| `src/styles.css` | exact token 설정을 heatmap 우측 아래에 배치하고 obsolete owner preview 전용 스타일 제거 |
| `src/profile-ui/__tests__/heatmap.test.js` | compact/exact formatter 계약 회귀 추가 |
| `tests/profile-ui.spec.js` | checkbox 기본값·전환, 600px tilt/beam/glare, card-origin Share Studio, owner/public tooltip 회귀 추가 |

## 상호작용·접근성 결과

- checkbox는 owner/public 공유 `TokenActivityChart`에서 기본 OFF이고 browser·원격
  storage에 저장하지 않는다.
- OFF tooltip과 heatmap cell의 접근성 이름은 locale compact token을 사용하고, ON일
  때만 grouping된 반올림하지 않은 raw token을 괄호로 함께 표시한다.
- checkbox 변경 시 활성 tooltip을 즉시 닫아 이전 정보 밀도의 tooltip이 남지 않는다.
- owner card는 Home과 동일한 600px 최대 크기, BorderBeam, hover tilt, glare, shadow와
  reduced-motion 분기를 공용 component에서 상속한다.
- public owner card의 단일 action은 `Share`이고, dialog는 source card rect에서 전환하며
  닫힌 뒤 해당 button으로 focus를 복귀한다. private owner card는 `Publish card`를
  유지하고 make-private는 Share Studio 안에서 처리한다.

## 본문 변경 정도 / 본문 무손실 여부

Account Usage Contract, backend, D1/R2, CLI, package, hosting manifest, static asset과 card
renderer pixel은 변경하지 않았다. owner visibility mutation과 preview revision 갱신,
Share Studio의 public URL·make-private 계약은 보존했다. public Profile은 기존과 동일하게
공개 API payload만 사용한다.

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
git diff origin/devel -- .openai/hosting.json src/profile-backend src/profile-runtime/sites packages package.json package-lock.json public/assets
git status --short
```

결과:

- OK — 단위·통합 테스트 540건 중 534건 통과, 설정 의존 6건 skip, 실패 0건
- OK — 전체 Playwright E2E 46건 통과
- OK — 일반 Vite build 1,816 modules transformed
- OK — Sites fullstack production build 성공
- OK — fullstack/production artifact verifier 모두 `ok: true`
- OK — `git diff --check` 오류 없음
- OK — 제한 경로 diff 빈 출력
- OK — 변경 파일은 승인된 Stage 5 계획·Profile UI·스타일·테스트·보고서 범위로 한정

## 잔여 위험

- PostgreSQL과 S3 외부 endpoint 검증은 `TEST_DATABASE_URL`, `TEST_S3_*`가 없어 기존
  정책대로 skip됐다. 이번 변경은 해당 경로를 수정하지 않았고 D1·Sites local Worker
  계약을 포함한 나머지 전체 테스트는 통과했다.
- 이번 단계는 local 구현과 artifact 검증만 수행했다. production 배포, 원격 data,
  environment/access mutation은 수행하지 않았다.

## 다음 단계 영향

- 구현 Stage는 모두 완료됐다. 다음 단계는 최종 보고서에서 Issue #35의 최종 수용
  기준과 전체 잔여 위험을 정리하고 `publish/task35` PR을 게시하는 것이다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 최종 보고서·PR 게시 단계로 진행한다.
