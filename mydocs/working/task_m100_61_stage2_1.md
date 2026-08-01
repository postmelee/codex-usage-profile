# Task M100 #61 Stage 2.1 완료 보고서

GitHub Issue: [#61](https://github.com/postmelee/codex-usage-profile/issues/61)
구현계획서: [`task_m100_61_impl.md`](../plans/task_m100_61_impl.md)
Stage: 2.1

## 단계 목적

Stage 2 로컬 시각 검토에서 확인한 page 계층과 owner Profile empty state의
행동 안내 부족을 보정했다. 공통 header 아래 main canvas는 Home과 같은 검정
배경으로 통일하고 Settings panel은 기존 surface로 분리했다. 사용량이 없는
Profile에는 카드 생성에 필요한 submit command, 복사 CTA, setup guide와
privacy 안내를 제공했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/CardProfilePage.jsx` | empty state에 submit 목적·command·복사 CTA·setup guide·privacy 안내와 복사 결과 live status 추가 |
| `src/styles.css` | owner/public Profile과 Settings canvas를 `#0d0d0d`로 정렬하고 Settings panel surface 및 desktop/mobile empty state 레이아웃 추가 |
| `tests/profile-ui.spec.js` | empty state 안내·clipboard·guide link·privacy와 Settings canvas/panel 색상 회귀 검증 추가 |
| `mydocs/plans/task_m100_61_impl.md` | 작업지시자의 로컬 시각 피드백과 Stage 2.1 보정 경계 기록 |
| `mydocs/orders/20260802.md` | Stage 2.1 완료·Stage 3 승인 대기 상태 기록 |
| `mydocs/working/task_m100_61_stage2_1.md` | Stage 2.1 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. submit command는
landing Quickstart가 사용하는 `HOME_SUBMIT_COMMAND`를 재사용해 사용자 실행
계약을 중복 정의하지 않았다. owner Profile의 usage 판정, Share 비활성 조건,
preview URL, visibility mutation과 API request/response shape는 변경하지 않았다.

public Profile에는 배경색만 적용했으며 public payload와 stable card URL은
변경하지 않았다. `.openai/hosting.json`, backend/API, OAuth/session, D1/R2와
card renderer도 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run test:e2e -- --grep "Profile and Settings canvases"
npm run test:e2e -- --grep "Profile|profile|Settings|app surfaces|Share Studio"
npm run build
git diff --check
git diff -- .openai/hosting.json
```

결과:

- OK — Stage 2.1 focused Playwright 5건 통과, 실패·skip 0건
- OK — Stage 2 전체 회귀 Playwright 42건 통과, 실패·skip 0건
- OK — owner Profile empty state의 설명, submit command, clipboard CTA,
  `/#quickstart` link, 복사 완료 live status와 privacy 안내 확인
- OK — Settings canvas `rgb(13, 13, 13)`, panel
  `rgb(23, 23, 23)`의 시각 계층 계약 확인
- OK — 390×844에서 Profile/Settings 단일 `h1`, sticky header와 horizontal
  overflow 부재 유지
- OK — Vite production client build 성공, 1,809 modules transformed
- OK — `git diff --check` 경고 없음
- OK — `.openai/hosting.json` diff 빈 출력; Sites linkage 무변경
- OK — 실행 중인 `http://127.0.0.1:5177`에 HMR 반영, Vite error 없음

## 잔여 위험

- Device Approve는 아직 기존 독립 shell을 사용한다. 공통 header와 fullscreen
  canvas 통합은 Stage 3 범위다.
- 현재 로컬 인증 owner가 usage를 보유하면 새 empty state 대신 실제 card가
  표시된다. empty state의 상태·responsive 동작은 mocked browser test로
  검증했으며 실제 빈 계정의 최종 사용자 시각 확인은 남아 있다.
- production Sites save/deploy/access와 원격 데이터 작업은 수행하지 않았다.

## 다음 단계 영향

- Stage 3는 `#0d0d0d` page canvas와 `#171717` 작업 panel의 계층을 Device
  Approve에도 재사용하되 approval form의 집중 작업 card는 유지한다.
- submit command와 empty state는 Stage 3의 device approval intent나 token
  exchange 계약에 영향을 주지 않는다.
- Stage 2.1의 canvas와 empty state assertion은 Stage 4 통합 회귀에 포함한다.

## 승인 요청

- Stage 2.1 산출물과 검증 결과를 승인하면 Stage 3 Device Approve 공통 shell
  통합으로 진행한다.
