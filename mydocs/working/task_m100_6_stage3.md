# Task M100 #6 Stage 3 보고서

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
구현계획서: [`task_m100_6_impl.md`](../plans/task_m100_6_impl.md)
Stage: 3

## 단계 목적

Stage 2의 owner profile API와 공개 카드 endpoint를 실제 사용자 흐름에 연결했다. `/`을 GitHub 로그인 진입점으로, `/profile`을 소유자 카드 관리 화면으로 분리하고, 공개 전환 후 이미지 URL·README Markdown·PNG를 공유하는 데스크톱/모바일 UX를 구현했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/HomePage.jsx` | 익명 sample card와 GitHub 로그인, 인증 사용자 identity와 owner profile 진입 구현 |
| `src/profile-ui/CardProfilePage.jsx` | 인증/사용량 상태, private preview, publish/private 전환, 공유 진입 구현 |
| `src/profile-ui/ShareDialog.jsx` | URL·README 복사, PNG 저장, live status, focus trap·복귀, Escape·overlay close 구현 |
| `src/profile-ui/cardShare.js` | browser locale, 공개 카드 URL, README snippet, owner login URL helper 구현 |
| `src/App.jsx`, `src/profile-ui/appRoutes.js` | Home, owner profile, 기존 public profile route 분리 |
| `src/profile-api/client.js` | owner profile read/update와 locale-aware preview URL client 추가 |
| `src/profile-ui/ProfileShell.jsx`, `src/profile-ui/Icons.jsx` | Share action 상태와 공유 UI icon 연결 |
| `src/styles.css` | 499:306 고정 비율, desktop/mobile Home/Profile/Share 레이아웃과 접근성 상태 추가 |
| `public/assets/codex-card-sample.png` | 동일 renderer로 생성한 998x612 영문 Home sample card 추가 |
| `src/profile-api/__tests__/client.test.js`, `src/profile-ui/__tests__/*.test.js` | client, route, locale/Markdown helper 단위 검증 추가 |
| `tests/profile-ui.spec.js` | Home 로그인, 공개 전환, clipboard, download, focus, mobile overflow E2E 추가 |

## 본문 변경 정도 / 본문 무손실 여부

기존 `/u/:handle` full Profile UI, `/settings`, `/device` route와 기존 snapshot 조회 계약은 유지했다. 새 `/`와 `/profile`만 명시적으로 분기하며, 카드 UI는 Stage 2의 owner/public endpoint를 client 경계로 호출한다. 카드 PNG 자체는 Stage 1 renderer 결과를 그대로 사용하고 브라우저에서 재구성하지 않는다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-api/__tests__/client.test.js
node --test src/profile-ui/__tests__/*.test.js
npm test
npm run build
npm run test:e2e -- --grep "Home|card|Share"
npm run test:e2e
git diff --check
```

결과:

- OK: client/route/share helper 단위 테스트 21건 통과
- OK: 전체 Node 테스트 209건 통과
- OK: Vite 8.0.16 production build 성공, 49 modules transformed
- OK: Stage 3 Playwright 3건 통과
- OK: 기존 full Profile 반응형 회귀를 포함한 Playwright 9건 통과
- OK: 익명 로그인 URL이 `redirect_to=/profile`을 사용하고 sample PNG natural size가 998x612임을 확인
- OK: private 상태에서 Share 비활성화, publish 후 URL·README clipboard와 PNG download 활성화를 확인
- OK: modal 최초/순환/복귀 focus, Escape close, desktop·390px mobile 고정 비율과 문서 overflow 없음 확인
- OK: Playwright desktop Home/Share 및 mobile Share screenshot을 직접 확인해 text clipping과 요소 중첩이 없음을 확인
- OK: `git diff --check` 경고 없음

## 잔여 위험

- 실제 GitHub OAuth session과 실제 public card endpoint를 함께 사용하는 통합 smoke는 Stage 4에서 수행한다.
- GitHub README의 Camo cache 갱신 지연과 locale URL 사용법은 Stage 4 사용자 문서에 명시해야 한다.
- 현재 지원 locale은 renderer 계약과 같은 `en`, `ko`다. 후속 locale 추가 시 renderer copy와 share locale resolver를 함께 확장해야 한다.

## 다음 단계 영향

- Stage 4는 `/` → GitHub login → `/profile` → publish → Share의 실제 runtime 흐름을 검증한다.
- `docs/readme-card.md`와 README에는 기본 공개 URL과 한국어 `?locale=ko`, 동일 URL ETag 재검증, private 404, GitHub Camo 특성을 기록한다.
- reference 비교에는 브라우저 preview가 아니라 endpoint가 반환한 998x612 PNG를 사용한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 README 문서와 통합 visual QA로 진행한다.
