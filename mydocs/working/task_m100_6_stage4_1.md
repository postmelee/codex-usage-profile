# Task M100 #6 Stage 4.1 완료 보고

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
구현계획서: [`task_m100_6_impl.md`](../plans/task_m100_6_impl.md)
Stage: 4.1

## 단계 목적

작업지시자의 실제 로컬 QA에서 확인된 viewport frame overflow, Settings 이동 경로 부재, Home 카드와 로그인 계정 avatar 불일치, 카드와 surface의 낮은 대비를 보정한다.

## 원인

- `.app-frame`이 `min-height`만 사용해 긴 Home/Profile/Settings 콘텐츠가 viewport 아래로 프레임을 확장했다.
- 공통 topbar에는 Share와 account menu만 있어 Settings에서 Home 또는 owner Profile로 직접 이동할 수 없었다.
- 로그인 후에도 Home은 정적 `codex-card-sample.png`를 표시했고 하단 계정 identity만 실제 GitHub 정보를 사용했다. 따라서 큰 카드 avatar와 하단 작은 avatar가 서로 다른 원본처럼 보였다.
- 카드 배경 `#181818`과 app surface `#171717`의 차이가 작고 PNG 외곽이 투명해 카드 경계가 거의 보이지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/HomePage.jsx` | 인증 상태에서는 locale-aware owner preview PNG를 사용하고 usage/image 실패 시에만 sample로 fallback |
| `src/profile-ui/ProfileShell.jsx` | 현재 페이지를 제외한 Home/Profile 공통 navigation 추가 |
| `src/styles.css` | viewport 고정 frame, shell 내부 scroll, sticky topbar, navigation과 alpha-aware card outline/shadow 추가 |
| `tests/profile-ui.spec.js` | 실제 owner preview URL, 620px Home/Profile/Settings frame·scroll, Settings navigation 회귀 추가 |

## 본문 변경 정도 / 본문 무손실 여부

card renderer와 public/private endpoint 계약은 변경하지 않았다. 실제 GitHub avatar를 이미 올바르게 렌더링하는 owner preview를 Home에 연결했고, anonymous 또는 usage 없는 Home의 sample fallback은 유지했다. Settings token/device 기능과 기존 full Profile heatmap 동작도 보존했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
npm run test:e2e -- --grep "Home|card|Share"
npm run test:e2e
git diff --check
```

결과:

- PASS: 전체 Node 테스트 209건 통과
- PASS: Vite production build 성공, 49 modules transformed
- PASS: Stage 4.1 핵심 Playwright 5건 통과
- PASS: 전체 Playwright 11건 통과
- PASS: 620px viewport에서 Home/Profile/Settings frame 하단이 viewport 내부에 있고 `.profile-shell`의 `overflow-y: auto`, `scrollHeight > clientHeight`, 실제 `scrollTop` 이동 확인
- PASS: Settings topbar에서 Home과 Profile link 확인
- PASS: 인증 Home 이미지가 `/api/profile/card.png?locale=en`을 요청하고 998x612 PNG를 표시함을 확인
- PASS: desktop Home/Share와 mobile Share에서 카드 outline/shadow가 alpha 외곽을 따라 표시되고 clipping이나 가로 overflow가 없음을 확인
- PASS: `git diff --check` 경고 없음

## 잔여 위험

- owner usage가 없거나 private preview 요청이 실패하면 Home은 의도적으로 sample card로 fallback한다. 실제 사용량 제출 연결 전에는 새 계정에서 sample이 보일 수 있다.
- `100dvh`는 최신 브라우저 기준이다. 지원 대상에 구형 브라우저가 추가되면 `100vh` fallback을 별도 검토한다.

## 다음 단계 영향

- Stage 1~4 및 Stage 4.1 사용자 QA 보정이 완료되었다. 다음 절차는 최종 보고서 작성과 PR 게시다.
- 실행 중인 `http://127.0.0.1:5177` runtime은 HMR로 변경을 반영하므로 작업지시자가 즉시 재검증할 수 있다.

## 승인 요청

- Stage 4.1 산출물과 검증 결과를 승인하면 Task #6 최종 보고와 PR 게시 절차로 진행한다.
