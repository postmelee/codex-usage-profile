# Task M100 #6 Stage 4 보고서

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
구현계획서: [`task_m100_6_impl.md`](../plans/task_m100_6_impl.md)
Stage: 4

## 단계 목적

GitHub 로그인부터 owner card 게시와 README 공유까지의 사용자 계약을 문서화하고, 실제 OAuth session과 임시 canonical usage를 사용해 통합 흐름을 smoke했다. 첨부 reference, 실제 GitHub identity output, desktop/mobile UI를 비교한 뒤 전체 회귀 검증을 완료했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/readme-card.md` | 로그인→submit→publish→Share 흐름, URL/locale, ETag 자동 갱신, GitHub Camo, identity/usage 책임과 상표 고지 문서화 |
| `README.md` | MVP README 카드 진입 절차, Markdown 예시, 공식 App Server usage 계약, 상세 문서 링크와 비공식 프로젝트 고지 추가 |
| `tests/profile-ui.spec.js` | 인증된 Home에서 GitHub avatar/name/login과 `/profile` 진입을 검증하는 Playwright 회귀 추가 |

## 본문 변경 정도 / 본문 무손실 여부

README의 기존 개발, UsageSnapshot, analyzer, runtime, security 본문은 삭제하거나 재작성하지 않았다. 상단 프로젝트 설명과 카드 사용 섹션을 현재 구현에 맞게 갱신하고, 기존 Development 설명에 `/`, `/profile` route를 추가했다. 상세 운영 설명은 계획서에서 선택한 `docs/readme-card.md`에 분리했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
npm run test:e2e -- --grep "Home|card|Share"
npm run test:e2e
git diff --check
file /Users/melee/Downloads/codex-profile-card.png public/assets/codex-card-sample.png
```

결과:

- OK: 전체 Node 테스트 209건 통과
- OK: Vite 8.0.16 production build 성공, 49 modules transformed
- OK: Home/Card/Share Playwright 4건 통과
- OK: 인증 Home 보강을 포함한 전체 Playwright 10건 통과
- OK: reference와 project sample이 모두 998x612 RGBA PNG임을 확인
- OK: reference 대비 outer radius/background, avatar/name/login baseline, 26x7 heatmap과 latest 오른쪽 배치, 4 stats divider/label alignment를 직접 확인
- OK: 사용자 결정에 따라 reference의 logo graphic은 제외하고 `Codex` 설명 텍스트만 유지함을 확인
- OK: Stage 3 Playwright screenshot으로 desktop Home/Share와 390px mobile Share에서 clipping, 중첩, 문서 가로 overflow가 없음을 재확인
- OK: 실제 GitHub OAuth callback이 `/profile`로 복귀하고 `Taegyu Lee`, `@postmelee`, GitHub avatar를 로드함을 확인
- OK: 원본 store의 임시 복사본에 canonical usage를 저장해 private 998x612 preview, publish 후 Public 상태, 한국어 image URL과 README Markdown 생성을 확인
- OK: 실제 account usage가 없을 때 `/profile`이 `No usage submitted yet` 상태를 표시함을 확인
- OK: `git diff --check` 경고 없음
- MISS: 공개 PNG를 별도 Chrome 탭에서 여는 동작과 이어지는 private 재전환은 브라우저의 localhost 보호 정책이 차단해 우회하지 않았다. 공개 GET/HEAD, 200/304/404, private 전환 차단은 profile-card/backend 자동 테스트와 Playwright visibility 회귀로 검증했다.

## 잔여 위험

- 실제 CLI가 `account/usage/read` 결과를 latest card usage로 제출하는 연결은 #5 범위다. 이번 smoke는 동일 canonical result fixture를 임시 store에 직접 저장했다.
- GitHub Camo의 실제 production 갱신 시간은 배포 origin에서 확인해야 한다. `no-cache` 재검증과 드문 `PURGE` 절차는 GitHub 공식 문서 기준으로 기록했다.
- localhost 보호 정책 때문에 실제 공개 URL 새 탭 smoke 일부를 수행하지 못했다. 배포 QA에서는 HTTPS public origin으로 다시 확인해야 한다.

## 다음 단계 영향

- 구현계획서의 Stage 1~4가 모두 완료되었다. 다음 절차는 최종 결과 보고서 작성, 전체 변경 검토, `publish/task6` push와 `devel` 대상 PR 생성이다.
- 최종 보고서에는 #5가 제공해야 할 canonical usage submit 연결과 production Camo QA를 후속 의존성으로 명시한다.
- 실제 OAuth smoke에는 원본 store가 아닌 `/private/tmp/task6-smoke-store.json`을 사용했으므로 사용자 로컬 profile 데이터는 변경하지 않았다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Task #6 최종 보고와 PR 게시 절차로 진행한다.
