# Task M100 #32 Stage 2 완료 보고

GitHub Issue: [#32](https://github.com/postmelee/codex-usage-profile/issues/32)
구현계획서: [`task_m100_32_impl.md`](../plans/task_m100_32_impl.md)
Stage: 2

## 단계 목적

production `/u/:handle`을 sample snapshot과 legacy public snapshot API에서 분리하고, Stage 1의 Account Usage 공개 프로필 API와 stable PNG card URL을 사용하는 card 중심 공개 화면으로 전환한다. private, missing, malformed, API failure는 identity를 노출하지 않는 동일한 unavailable UI로 처리한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-api/client.js` | `GET /api/profiles/public/:handle` client와 404 `null` 계약 추가 |
| `src/profile-api/__tests__/client.test.js` | 공개 Account Usage profile 정상·not-found client 검증 추가 |
| `src/profile-ui/publicProfileRoutes.js` | 모든 `/u/:handle`을 API loading으로 시작하고 ready/unavailable로 변환하는 loader 추가 |
| `src/profile-ui/__tests__/publicProfileRoutes.test.js` | sample 특례 없음, malformed path, 정상 조회, private/missing/failure 비노출 상태 검증 추가 |
| `src/profile-ui/PublicProfilePage.jsx` | GitHub identity와 stable PNG만 표시하는 ready 화면, 중립 loading/unavailable 화면 추가 |
| `src/App.jsx` | production public route에서 sample snapshot, legacy selector와 full-profile page import 제거 |
| `src/styles.css` | desktop/mobile card aspect ratio, heading wrapping, frame 내부 여백과 overflow 제약 추가 |
| `tests/profile-ui.spec.js` | legacy heatmap E2E를 공개 API loading/ready/unavailable, desktop/mobile card 검증으로 교체 |
| `mydocs/orders/20260715.md` | 당일 Task #32 Stage 2 진행 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

production public HTML route만 card 중심 화면으로 교체했다. Home, owner `/profile`, Settings, device approval, share dialog, 공개 PNG endpoint와 backend 계약은 변경하지 않았다. legacy full-profile 컴포넌트와 snapshot client/module은 호환성을 위해 삭제하지 않았으며 production `App.jsx`에서만 참조를 제거했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-api/__tests__/client.test.js
node --test src/profile-ui/__tests__/appRoutes.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js
npm run build
npm run test:e2e -- --grep "public profile"
npm test
npm run test:e2e
git diff --check
```

결과:

- PASS: API client 18건과 app/public route 집중 테스트 6건 통과
- PASS: 모든 `/u/:handle`이 sample handle 특례 없이 public API loading 상태 사용
- PASS: private, missing, malformed, invalid response와 request failure가 identity 없는 unavailable 상태 사용
- PASS: production build 성공, 31 modules transformed
- PASS: 공개 프로필 Playwright 4건 통과
- PASS: 전체 Node 테스트 269건 통과
- PASS: 전체 Playwright 9건 통과, Home·owner Profile·Settings·Share 회귀 없음
- PASS: 1280x900 desktop과 390x844 mobile에서 998x612 card 비율, frame 내부 배치와 가로 overflow 없음
- PASS: production public DOM에 Activity insights, Most used plugins, Token activity 미표시
- PASS: `git diff --check` 오류 없음

## 잔여 위험

- legacy public snapshot client, route module과 full-profile UI 파일은 compatibility 경계로 남아 있다. Stage 3에서 공식 문서와 production 경계를 명확히 해야 한다.
- runtime의 실제 store, public JSON과 PNG를 함께 사용하는 통합 시나리오 및 visibility 전환 후 차단 검증은 Stage 4 범위다.

## 다음 단계 영향

- Stage 3은 production `App.jsx`의 현재 public route를 기준으로 README와 `docs/readme-card.md`를 갱신한다.
- `docs/usage-snapshot-v2.md`는 active analyzer submit/public profile 경로가 아닌 legacy compatibility 계약으로 설명해야 한다.
- legacy 모듈의 광범위한 삭제는 이번 task 범위가 아니며, 오해를 만드는 import·설명만 최소 정리한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 legacy 경계와 공식 문서 정리로 진행한다.
