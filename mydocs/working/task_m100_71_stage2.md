# Task M100 #71 Stage 2 보고서 — 숫자 축약 formatter 통합

GitHub Issue: [#71](https://github.com/postmelee/codex-usage-profile/issues/71)
구현계획서: [`task_m100_71_impl.md`](../plans/task_m100_71_impl.md)
Stage: 2

## 단계 목적

Profile 통계와 heatmap compact tooltip이 Stage 1에서 확정한 Codex locale-native
compact number 계약을 공유하게 한다. exact token count와 heatmap 데이터·집계·강도
동작은 보존한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/heatmap.js` | 영어·한국어 단위를 수동 선택하던 `formatTokenCount`를 공용 `formatCompactNumber` 위임으로 교체하고 중복 formatter를 제거했다. |
| `src/profile-ui/__tests__/formatters.test.js` | 영어·한국어·fallback locale의 compact 단위와 단위 직전 반올림 승격 matrix를 추가했다. |
| `src/profile-ui/__tests__/heatmap.test.js` | heatmap이 공용 formatter 결과를 사용하고 exact localized integer 및 입력 validation을 보존하는지 추가 검증했다. |
| `mydocs/working/task_m100_71_stage2.md` | Stage 2 변경·검증·잔여 위험과 다음 단계 경계를 기록했다. |

구현계획서에서 수정 예상한 `src/profile-ui/formatters.js`는 기존 구현이 이미 확정된
`Intl.NumberFormat` 계약과 일치해 수정하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

공개 API signature와 화면 구조는 변경하지 않았다. `formatTokenCount(value, locale)`의
validation은 그대로 유지하고 내부 단위 계산만 공용 formatter에 위임했다. exact tooltip은
계속 `formatLocalizedNumber`로 원본 정수를 표시하며 daily/weekly/cumulative bucket,
heatmap level과 locale date 문구는 손대지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/formatters.test.js \
  src/profile-ui/__tests__/heatmap.test.js
git diff --check
```

결과:

- OK — 12 tests, 12 pass, 0 fail.
- OK — 영어 `999,999 → 1M`, `999,999,999 → 1B`와 한국어
  `1,000 → 1천`, `99,999,999 → 1억`, `999,999,999,999 → 1조`를 확인했다.
- OK — 지원하지 않는 locale은 영어 compact 계약으로 fallback한다.
- OK — compact tooltip과 함께 `999,999`, `99,999,999` exact integer가 반올림 없이
  지역화되어 남는다.
- OK — 음수와 비정수 token validation, heatmap range·mode·level 기존 test가 통과했다.
- OK — `git diff --check`가 통과했다.

## 잔여 위험

- compact 결과는 JavaScript runtime의 ICU locale data에 의존한다. 프로젝트의 지원
  runtime과 production build에서 동일 contract를 사용하며, 경계 matrix test가 향후
  runtime 변경으로 인한 drift를 감지한다.
- #72·#73 범위는 아직 구현하지 않았으며 이번 단계 source와 결합되지 않았다.

## 다음 단계 영향

- Stage 3는 숫자 formatter를 추가 변경하지 않고 #72 Marketing config와 landing consumer만
  대상으로 한다.
- 기존 `createMarketingConfig({ copy })` 입력은 유지하면서 explicit `copyOverrides`를
  additive하게 추가하고 quickstart step을 id-only record로 정리한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3의 #72 Marketing copy source 계약
  정리로 진행한다.
