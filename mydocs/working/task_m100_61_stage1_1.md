# Task M100 #61 Stage 1.1 완료 보고서

GitHub Issue: [#61](https://github.com/postmelee/codex-usage-profile/issues/61)
구현계획서: [`task_m100_61_impl.md`](../plans/task_m100_61_impl.md)
Stage: 1.1

## 단계 목적

Stage 1 로컬 검토에서 계정 menu의 Profile·Settings·Log out icon이 임시 SVG
path로 보인다는 피드백을 반영했다. 앱 bundle의 비공개 asset을 복사하지 않고,
ChatGPT macOS 앱의 제3자 고지에도 포함된 공개 `lucide-react` icon component로
계정 menu를 정렬했다. Stage 2 layout 범위에는 진입하지 않았다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `package.json` | ISC license의 `lucide-react` runtime dependency 추가 |
| `package-lock.json` | `lucide-react@1.28.0`과 React peer dependency 기록 |
| `src/profile-ui/AccountMenu.jsx` | 직접 작성한 account SVG path 대신 `UserRound`·`Settings`·`LogOut` component 적용 |
| `tests/profile-ui.spec.js` | 세 menuitem이 의도한 Lucide component를 렌더링하는 focused assertion 추가 |
| `mydocs/plans/task_m100_61_impl.md` | 작업지시자 시각 피드백에 따른 Stage 1.1 보정 범위와 커밋 기준 기록 |
| `mydocs/orders/20260802.md` | Stage 1.1 완료·Stage 2 승인 대기 상태 기록 |
| `mydocs/working/task_m100_61_stage1_1.md` | Stage 1.1 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. menu label, 순서,
href, role, focus 이동, logout API와 error feedback은 변경하지 않았다. anonymous와
unavailable Sign in의 user icon도 같은 공개 `UserRound` component를 사용해 동일한
account 의미를 유지한다.

다른 surface의 copy/download/globe/close icon과 `CodexCheckCircleIcon`은 이번
피드백 범위 밖이므로 변경하지 않았다. `.openai/hosting.json`, auth/backend/API,
D1/R2와 production Sites 상태는 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm view lucide-react version license
npm run test:e2e -- --grep "account menu|Home stays readable"
npm run build
git diff --check
```

결과:

- OK — npm registry에서 현재 `lucide-react@1.28.0`, ISC license 확인
- OK — local ChatGPT macOS 앱의 제3자 고지에서 `lucide-react` 포함 확인
- OK — focused Playwright 2건 통과, 실패·skip 0건
- OK — Profile·Settings·Log out menuitem이 각각 Lucide `UserRound`, `Settings`,
  `LogOut` component를 렌더링하고 기존 keyboard focus 회귀 통과
- OK — Vite production client build 성공, 1,809 modules transformed
- OK — `git diff --check` 경고 없음
- OK — 기존 OAuth 설정과 복제 preview store로 `http://127.0.0.1:5177` runtime
  재시작 완료

의존성 설치 직후 기존 HMR process에서는 dependency prebundle 교체 때문에 중복
React 경고가 발생했다. runtime을 종료하고 새 dependency graph로 재시작했으며,
새 Playwright server와 production build에서는 같은 오류가 재현되지 않았다.

## 잔여 위험

- Lucide는 ChatGPT 앱에서도 고지된 공개 icon library이지만, 이 구현이 특정
  Codex/ChatGPT build의 menu SVG를 1:1 복제한다는 의미는 아니다. 공개 component
  family와 의미를 맞춘 선택이다.
- owner/public Profile과 Settings의 fullscreen canvas 및 visual heading 정렬은
  승인 대기 중인 Stage 2 범위로 남아 있다.
- `npm install` audit가 기존과 동일한 8건(낮음 1, 높음 7)을 보고했다.
  `lucide-react` 자체는 해당 경고를 추가하지 않았으며 dependency 보안 정리는
  Task #61의 UI 범위 밖이다.
- production Sites save/deploy/access와 원격 데이터 작업은 수행하지 않았다.

## 다음 단계 영향

- Stage 2는 새 account icon component와 Stage 1의 menu keyboard 계약을 유지한
  채 Profile·Settings page canvas만 정렬한다.
- 향후 다른 수제 icon을 교체하려면 해당 surface별 시각 검토와 별도 승인 범위로
  다룬다. 이번 dependency를 곧바로 전체 UI에 확장하지 않는다.

## 승인 요청

- Stage 1.1 산출물과 검증 결과를 승인하면 Stage 2 Profile·Settings page canvas
  정렬로 진행한다.
