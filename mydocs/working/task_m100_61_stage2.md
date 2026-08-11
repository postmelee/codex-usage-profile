# Task M100 #61 Stage 2 완료 보고서

GitHub Issue: [#61](https://github.com/postmelee/codex-usage-profile/issues/61)
구현계획서: [`task_m100_61_impl.md`](../plans/task_m100_61_impl.md)
Stage: 2

## 단계 목적

owner Profile, public Profile과 Settings에서 앱 전체를 별도 창처럼 감싸던
frame을 제거하고, Stage 1의 공통 header 아래에서 document가 스크롤되는
fullscreen canvas로 정렬했다. 각 화면의 상태별 실제 제목을 단일 `h1`으로
올리고 기존 card, visibility, Share와 Settings mutation 동작은 보존했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/CardProfilePage.jsx` | owner Profile에 fullscreen shell 적용, ready/loading/empty/error 제목을 실제 단일 `h1`으로 전환 |
| `src/profile-ui/PublicProfilePage.jsx` | canonical·legacy public Profile의 ready/loading/unavailable 제목을 실제 단일 `h1`으로 전환하고 fullscreen shell 적용 |
| `src/profile-ui/SettingsPage.jsx` | page `h1`을 `Settings`로 고정하고 `GitHub account`·`API Tokens`·`Devices`를 `h2` section으로 정리 |
| `src/styles.css` | 세 화면의 document canvas, sticky header 높이 변수, content width·spacing과 mobile horizontal inset 정렬 |
| `tests/profile-ui.spec.js` | fullscreen/document scroll, 상태별 단일 `h1`, mobile overflow, Share inert/focus와 token/device mutation 회귀 검증 |
| `mydocs/orders/20260802.md` | Stage 2 완료·Stage 3 승인 대기 상태 기록 |
| `mydocs/working/task_m100_61_stage2.md` | Stage 2 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. owner Profile의
preview URL, public/private visibility label과 publish/unpublish mutation,
public stable card URL 및 최소 payload, Settings account/token/device request와
response shape를 변경하지 않았다. Share Studio의 open/close, source preview,
inert 복원과 focus return도 유지했다.

`ProfileShell`의 기존 fullscreen contract를 재사용했으며 새 shell이나
navigation 체계를 만들지 않았다. production route가 import하지 않는
`ProfilePage.jsx`는 변경 필요가 없어 계획의 조건부 범위에서 제외했다.
`.openai/hosting.json`, backend/API, OAuth/session, D1/R2와 card renderer는
변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run test:e2e -- --grep "Profile|profile|Settings|app surfaces|Share Studio"
npm run build
git diff --check
git diff origin/devel -- .openai/hosting.json
```

결과:

- OK — 구현계획서의 focused Playwright 42건 통과, 실패·skip 0건
- OK — owner Profile ready/loading/empty/error와 public Profile
  ready/loading/unavailable에서 visible `h1`이 정확히 1개
- OK — Settings authenticated/anonymous에서 page `h1`은 `Settings`, 내부
  `GitHub account`·`API Tokens`·`Devices`는 `h2`
- OK — Settings token create와 device rename 대표 mutation이 각각 request
  1회 및 갱신 UI로 완료
- OK — 1280×900, 1280×620, 390×844에서 sticky header가 page heading을
  가리지 않고 horizontal overflow 없음
- OK — 세 화면의 shell overflow는 `visible`, 짧은 viewport는 document가
  스크롤되고 내부 `.profile-shell` scroll은 0으로 유지
- OK — owner Profile Share Studio open 시 app frame inert, close 시 inert 해제와
  trigger focus 복원
- OK — Vite production client build 성공, 1,809 modules transformed
- OK — `git diff --check` 경고 없음
- OK — `.openai/hosting.json` diff 빈 출력; Sites linkage 무변경
- OK — 실행 중인 `http://127.0.0.1:5177` runtime에 HMR 반영, console error 없음

## 잔여 위험

- Device Approve는 아직 기존 독립 shell을 사용한다. 공통 header와 fullscreen
  canvas 통합은 승인 대기 중인 Stage 3 범위다.
- owner/public Profile과 Settings의 브라우저 자동 검증은 완료했지만 작업지시자의
  Stage 2 로컬 시각 확인은 아직 남아 있다.
- production Sites save/deploy/access와 원격 데이터 작업은 수행하지 않았다.

## 다음 단계 영향

- Stage 3는 이번 단계에서 확정한 fullscreen shell, sticky header 높이와
  document scroll contract를 Device Approve에 재사용한다.
- Device Approve의 challenge/OAuth return/approval 상태와 no-auto-redirect 계약은
  layout 변경과 분리해 보존해야 한다.
- Stage 2의 Profile·Settings heading hierarchy와 mutation test는 Stage 4 통합
  회귀에 그대로 포함한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 Device Approve 공통 shell
  통합으로 진행한다.
