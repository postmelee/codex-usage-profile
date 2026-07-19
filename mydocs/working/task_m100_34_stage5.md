# Task M100 #34 Stage 5 보고서

GitHub Issue: [#34](https://github.com/postmelee/codex-usage-profile/issues/34)
구현계획서: [`task_m100_34_impl.md`](../plans/task_m100_34_impl.md)
Stage: 5

## 단계 목적

Stage 4 이후 승인된 Landing 발견성 개선안을 반영했다. `/`만 app frame에서 분리해 전체 viewport와 document scroll을 사용하도록 재구성하고, 실제 공유 카드와 상태별 primary action을 Hero의 중심에 배치했다. 기존 `/profile` frame과 설정·device·public profile 책임은 유지하면서 Quickstart 시작점을 첫 화면에서 찾기 쉽게 만들고, card의 고해상도 출력과 절제된 motion을 추가했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_34_impl.md` | 승인된 Stage 5 범위, 검증 기준과 커밋 계획 추가 |
| `package.json`, `package-lock.json` | card outline과 desktop pointer motion을 위한 `border-beam`, `hover-tilt` 의존성 추가 |
| `public/assets/codex-card-sample.png`, `public/assets/postmelee-avatar.png` | Hero sample card와 avatar 원본을 고해상도 자산으로 교체 |
| `src/profile-card/renderer.js` | 공유 PNG 출력을 3배 scale인 1497×918로 상향하고 avatar draw 품질 보강 |
| `src/profile-card/__tests__/renderer.test.js` | 고해상도 PNG 크기와 avatar source 계약 검증 |
| `src/profile-ui/ProfileShell.jsx` | Home 전용 fullscreen shell과 기존 framed surface 분리 |
| `src/profile-ui/AccountMenu.jsx` | MVP account menu를 Settings와 Log out으로 제한 |
| `src/profile-ui/HomePage.jsx` | 전체화면 Hero, owner card 상태 조회, Publish/Share 동작, card Beam·tilt·glare 구현 |
| `src/profile-ui/HomeQuickstart.jsx` | Profile 의존 문구를 card review 중심으로 정리하고 Hero 직후 흐름 보강 |
| `src/profile-ui/ShareDialog.jsx` | Home에서 재사용할 privacy action과 고해상도 preview 입력 지원 |
| `src/profile-ui/homeOnboarding.js`, `src/profile-ui/__tests__/homeOnboarding.test.js` | MVP card review 단계 문구와 순서 계약 갱신 |
| `src/styles.css` | fullscreen topbar, Hero/Card/Quickstart 반응형, motion·reduced-motion·pointer 제약 추가 |
| `tests/profile-ui.spec.js` | Home 상태별 CTA, document scroll, motion fallback, Share와 1497px card 회귀 검증 |
| `mydocs/orders/20260719.md` | Task #34 Stage 5 완료 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

공식 사용자 문서는 변경하지 않았다. UI는 Home에 한정해 전체화면으로 전환했고, `/profile`, `/settings`, `/device`, `/u/:handle` route와 backend 계약은 보존했다. 기존 Share dialog를 재사용하고 owner visibility API를 그대로 호출하므로 공개 URL과 README Markdown 계약도 유지한다.

공유 PNG는 승인된 시각 보강에 따라 기존 998×612에서 1497×918로 해상도만 높였다. 카드의 499:306 비율, 콘텐츠 배치, stable URL과 locale query 계약은 바꾸지 않았다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
npm run test:e2e -- --grep "Home"
npm run test:e2e
git diff --check
```

결과:

- OK — Node test 272개 통과, 실패·skip 없음.
- OK — Vite production build 완료. `hover-tilt`는 desktop 조건에서만 불러오는 45.64 kB async chunk로 분리되고 main bundle은 300.87 kB다.
- OK — Home 집중 Playwright 9개 통과. anonymous/authenticated/unavailable/no-usage/public 상태, document scroll, mobile keyboard와 Share dialog를 검증했다.
- OK — 전체 Playwright 13개 통과. Home 9개와 public profile 4개에서 기존 route와 1497px 공유 카드 회귀를 확인했다.
- OK — `git diff --check` 출력 없음.

수동·시각 검증:

- OK — 1280×900, 1280×620과 mobile viewport에서 Home이 frame 내부 scroll을 만들지 않고 Hero 다음 Quickstart 신호를 노출한다.
- OK — card 크기, Hero heading, compact topbar, GitHub avatar crop과 card/background 대비를 실제 browser에서 반복 점검하고 작업지시자 확인을 받았다.
- OK — desktop fine pointer에서 Beam, 낮은 강도의 tilt·scale·glare가 동작하고, mobile·coarse pointer·reduced-motion에서는 정적 card를 유지한다.
- OK — account menu에는 Settings와 Log out만 남고 Home과 header의 owner profile 진입점은 제거됐다.
- OK — private usage는 Publish card, public usage는 Share, usage 미제출은 disabled 안내로 분기된다.

## 잔여 위험

- npm package와 production service가 배포되기 전에는 Landing의 canonical command를 공개 endpoint에서 실행할 수 없다.
- desktop motion은 async chunk로 분리했지만 최초 fine-pointer 진입 시 네트워크 상태에 따라 정적 card가 먼저 보일 수 있다. 정보와 primary action에는 영향이 없다.
- GitHub README는 동일 image URL의 갱신을 캐시할 수 있으므로 submit 직후 반영 시점이 GitHub 정책에 좌우된다.
- heatmap cell별 token tooltip은 별도 후속 이슈 [#35](https://github.com/postmelee/codex-usage-profile/issues/35)로 분리했다.

## 다음 단계 영향

- Stage 1~5의 구현과 검증이 완료됐으므로 다음 절차는 최종 보고서 작성과 PR 게시다.
- package publish와 production deployment는 별도 release 작업으로 유지한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 Task #34 최종 보고서 작성과 PR 게시 절차로 진행한다.
