# Task M100 #34 Stage 1 보고서

GitHub Issue: [#34](https://github.com/postmelee/codex-usage-profile/issues/34)
구현계획서: [`task_m100_34_impl.md`](../plans/task_m100_34_impl.md)
Stage: 1

## 단계 목적

Landing UI를 확장하기 전에 canonical submit 명령과 Quickstart 순서를 순수 UI contract로 고정하고, Home에서 시작한 GitHub OAuth가 owner profile이 아닌 `/`로 복귀하도록 변경했다. 기존 `/profile` 로그인 복귀와 Home card/authenticated CTA는 유지했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/homeOnboarding.js` | 자동 설치 승인 flag와 secret이 없는 canonical command, 5단계 immutable Quickstart contract 추가 |
| `src/profile-ui/__tests__/homeOnboarding.test.js` | command 안전성, 단계 순서와 불변성 검증 추가 |
| `src/profile-ui/HomePage.jsx` | owner profile 전용 helper 대신 route-aware account login helper 사용 |
| `src/App.jsx` | Home에 현재 location을 명시적으로 전달 |
| `src/profile-ui/__tests__/accountUi.test.js` | `/` GitHub OAuth redirect encoding 회귀 검증 추가 |
| `tests/profile-ui.spec.js` | anonymous Home login의 `/` 복귀 intent E2E 기대값 반영 |
| `mydocs/orders/20260717.md` | Stage 1 완료와 다음 Stage 승인 대기 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 card preview 선택, locale 처리, authenticated identity, `View profile`, Profile/Settings route-aware login과 owner profile 전용 login helper 동작은 변경하지 않았다. Home anonymous login의 복귀 route만 `/profile`에서 `/`로 의도적으로 변경했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/homeOnboarding.test.js src/profile-ui/__tests__/accountUi.test.js src/profile-ui/__tests__/cardShare.test.js
npm run test:e2e -- --grep "Home shows the sample card"
git diff --check
```

결과:

- OK — Node test 10개 통과, 실패·skip 없음.
- OK — focused Playwright E2E 1개 통과. Home sample card와 anonymous GitHub login `/` 복귀 href를 browser에서 확인했다.
- OK — `git diff --check` 출력 없음.
- OK — `buildProfileLoginHref()`의 `/profile` 복귀 단위 테스트가 함께 통과했다.

## 잔여 위험

- canonical command와 Quickstart contract는 아직 화면에 렌더링하지 않는다. Stage 2에서 session-aware landing과 copy interaction에 연결해야 한다.
- npm package와 production service availability는 이번 Stage에서 변경하거나 검증하지 않았다.
- Home에 전달하는 location은 최초 page load 기준이다. 현재 app은 client-side navigation을 사용하지 않으므로 동작에 영향이 없으며, routing 방식이 바뀌면 재검토해야 한다.

## 다음 단계 영향

- Stage 2는 `HOME_SUBMIT_COMMAND`와 `HOME_QUICKSTART_STEPS`를 단일 진실 원천으로 사용한다.
- anonymous Home은 흐름 개요와 GitHub sign-in을, authenticated Home은 command와 owner action을 렌더링한다.
- Stage 2 visual 변경에서도 Home login href의 `redirect_to=%2F`와 기존 Profile/Settings 복귀 계약을 유지한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 session-aware landing과 Quickstart UI 구현으로 진행한다.
