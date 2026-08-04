# Task M100 #69 Stage 3.5 보고서

GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
구현계획서: [`task_m100_69_impl.md`](../plans/task_m100_69_impl.md)
Stage: 3.5

## 단계 목적

Stage 1~3에서 확정한 `resolvedTheme`를 로그인한 owner의 on-demand 카드 미리보기에 연결했다.
native와 Worker 카드 renderer가 동일한 semantic palette로 light/dark PNG를 만들고, Home·Profile·
Share Studio의 private preview가 현재 화면 theme를 따르도록 했다. 공개 stable card와 R2 object는
기존 queryless dark 계약을 유지했다. 영속 카드 customization과 light/dark R2 이중 객체는 별도
Issue [#74](https://github.com/postmelee/codex-usage-profile/issues/74)로 분리했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_69_impl.md` | 승인된 Stage 3.5와 #74 분리, private/public 경계·검증·커밋 계약 반영 |
| `src/profile-card/theme.js` | dark 기준선과 관찰 가능한 Codex light semantic 역할을 담은 공유 card palette·정규화 추가 |
| `src/profile-card/heatmap.js`, `view-model.js` | 사용량 level은 보존하면서 선택 theme의 5단계 색과 normalized theme를 view model에 반영 |
| `src/profile-card/renderer.js`, `worker-renderer.js` | 배경·text·divider·avatar fallback·heatmap을 공유 palette로 선택 |
| `src/profile-card/service-core.js`, `index.js` | owner theme 전달·private cache 분리·public dark 고정과 theme API export 추가 |
| `src/profile-backend/http.js` | owner-only `/api/profile/card.png`의 `theme` query 전달 추가 |
| `src/profile-api/client.js` | `light|dark`만 허용하는 owner preview URL query 생성 추가 |
| `src/profile-ui/HomePage.jsx`, `CardProfilePage.jsx` | Home·Profile·Share Studio private preview에 현재 `resolvedTheme` 전달 |
| `src/profile-card/__tests__/*.test.js` | native/Worker palette, heatmap level, digest/cache, public dark 호환 검증 추가 |
| `src/profile-api/__tests__/client.test.js`, `src/profile-backend/__tests__/http.test.js` | URL validation, private light/dark 분리, invalid fallback, public ETag 불변 검증 추가 |
| `tests/profile-ui.spec.js` | Home·Profile·Share Studio preview의 light/dark URL 전환 E2E 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 항목은 해당 없음이다. 카드 레이아웃, typography, 통계와
heatmap level 계산, locale, avatar fetch, ETag와 public media serving은 유지했다. dark palette는
기존 renderer literal과 동일하며 dark source digest에는 새 discriminator를 넣지 않아 호환성을
보존했다. light palette는 공개적으로 관찰 가능한 Codex light card의 역할을 참고한 고유
semantic mapping이며 내부 source·비공개 design token·제품 고유 asset을 복사하지 않았다.

공개 `/u/{handle}/card.png`, `publicCardUrl`, Share/README 복사 값, R2 stable object key와
publish/unpublish 경로는 변경하지 않았다. D1/R2 migration, cleanup/retention, CLI, package·lockfile,
`.openai/hosting.json`, static asset도 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-card/__tests__/*.test.js \
  src/profile-api/__tests__/client.test.js \
  src/profile-backend/__tests__/http.test.js
npx playwright test tests/profile-ui.spec.js --grep "themed card preview"
npm run build
npm run build:sites
git diff --check
git diff -- \
  .openai/hosting.json package.json package-lock.json \
  packages/codex-usage-profile-cli \
  src/profile-backend/migrations src/profile-media src/profile-publication public
```

결과:

- OK — card·API client·backend HTTP 지정 테스트 `97 passed, 0 failed`.
- OK — native PNG의 light background·empty heatmap·divider pixel과 Worker SVG의 동일 semantic
  palette를 검증했다.
- OK — 동일 owner/revision의 private light와 dark source digest·PNG가 분리되고 같은 theme
  재요청은 cache를 재사용했다.
- OK — theme 미지정·알 수 없는 값은 기존 dark body/digest로 fallback했다.
- OK — public render에 light 요청을 전달해도 service는 dark를 선택하고, public media route의
  `?theme=light` ETag는 queryless public ETag와 동일했다.
- OK — owner preview URL은 `theme=light|dark`만 허용하고 `system`을 거부했다.
- OK — Home·Profile·Share Studio private preview의 resolved light/dark 전환 Playwright
  `1 passed, 0 failed`; 공개 복사 URL에는 theme query를 추가하지 않았다.
- OK — product build `1821 modules transformed`, Sites client build `27 modules transformed`.
- OK — `git diff --check`; hosting manifest, package·lockfile, CLI, migration, media/publication,
  static asset 제한 경로 diff 없음.

## 잔여 위험

- light palette는 현재 관찰 가능한 Codex light card의 semantic 역할을 맞춘 값이며 비공개 내부
  design token과의 byte-level 동일성을 보장하지 않는다.
- 현재 theme는 기기 로컬 appearance를 private preview에만 반영한다. public stable card의
  light/dark 선택 저장, D1 preference, R2 이중 object와 public query URL은 #74에서 처리한다.
- production Sites 배포와 hosted light/dark 수동 검증은 승인 범위에서 제외했다.

## 다음 단계 영향

- Stage 4는 Home·owner Profile·Share Studio private preview를 light/dark에서 순회하고 전체
  Node·Playwright·product/Sites production artifact 회귀를 수행한다.
- Stage 4에서 공개 card URL, R2 object와 public dark 호환 경계가 유지되는지 제한 diff와
  public media 테스트로 다시 확인한다.
- #74 구현은 #69 완료·병합 이후 별도 task-start와 계획 승인 절차로 진행한다.

## 승인 요청

- Stage 3.5 산출물과 검증 결과를 승인하면 Stage 4 전체 route·Sites artifact 회귀 검증으로
  진행한다.
