# Task M100 #69 Stage 3.6 보고서

GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
구현계획서: [`task_m100_69_impl.md`](../plans/task_m100_69_impl.md)
Stage: 3.6

## 단계 목적

Profile heatmap 툴팁이 light theme에서도 어두운 표면으로 표시되던 불일치를 보정한다.
관찰 가능한 Codex light 화면과 같은 semantic 역할인 밝은 elevated surface, 어두운 text,
얕은 border와 floating shadow를 적용하면서 dark theme 기준선과 툴팁의 내용·layout·motion은
유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_69_impl.md` | 승인된 Stage 3.6 범위, 검증, 변경 금지 경로와 Stage 4 의존성을 기록 |
| `src/styles.css` | light tooltip background·text·border semantic token을 밝은 surface에 맞게 보정하고 dark 값 유지 |
| `tests/profile-ui.spec.js` | light/dark tooltip의 computed background·text·border 회귀 검증 추가 |
| `mydocs/working/task_m100_69_stage3_6.md` | 구현·검증·잔여 위험과 다음 단계 영향을 기록 |

## 본문 변경 정도 / 본문 무손실 여부

문서와 테스트 외 제품 변경은 tooltip semantic token 3개에 한정했다. 날짜와 토큰 수 문구,
정확 토큰 표시 전환, 위치 계산, 크기, enter animation, heatmap 데이터, owner/public card와
backend API 동작은 변경하지 않았다. dark tooltip의 기존 surface·text·border 값도 유지했다.

## 검증 결과

실행 명령:

```bash
npx playwright test tests/profile-ui.spec.js --grep "theme surfaces"
npm run build
npm run build:sites
git diff --check
git diff a55895d -- \
  .openai/hosting.json \
  package.json package-lock.json \
  packages/codex-usage-profile-cli \
  src/profile-backend src/profile-runtime src/profile-media \
  src/profile-card public
```

결과:

- OK — Playwright theme surface 3건 통과. light tooltip은 white surface, `#303030` text,
  12% black border로 계산되고 dark tooltip은 기존 `#3f4042` surface, `#f2f2f2` text,
  14% white border를 유지했다.
- OK — 제품 Vite build 통과(1,821 modules transformed).
- OK — Sites client build 통과(27 modules transformed).
- OK — `git diff --check` 경고 없음.
- OK — Stage 3.5 기준 변경 금지 경로에 diff 없음. `.openai/hosting.json`, package·lockfile,
  CLI, backend/runtime/media, card renderer와 public asset을 변경하지 않았다.

## 잔여 위험

- Codex의 비공개 내부 design token과 동일하다고 단정하지 않고 관찰 가능한 light surface의
  semantic 역할을 재현했다. 이후 상위 제품의 시각 기준이 변경되면 별도 재검토가 필요하다.
- 이 Stage는 production 배포를 수행하지 않는다.

## 다음 단계 영향

- Stage 4 전체 route 회귀에서 light/dark tooltip computed style을 포함한 현행 E2E를 다시 실행한다.
- 공개 카드 자동 theme, 영속 customization과 light/dark R2 객체는 후속 Issue #74 범위를 유지한다.

## 승인 요청

- Stage 3.6 산출물과 검증 결과를 승인하면 Stage 4 전체 회귀와 Sites artifact 검증으로 진행한다.
