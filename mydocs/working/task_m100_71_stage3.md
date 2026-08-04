# Task M100 #71 Stage 3 보고서 — Marketing copy source 계약 명시화

GitHub Issue: [#71](https://github.com/postmelee/codex-usage-profile/issues/71)
연결 Issue: [#72](https://github.com/postmelee/codex-usage-profile/issues/72)
구현계획서: [`task_m100_71_impl.md`](../plans/task_m100_71_impl.md)
Stage: 3

## 단계 목적

Marketing landing의 기본 문구와 caller가 명시한 custom 문구를 값 비교 없이 구분한다.
Quickstart step에는 실제 소비되는 식별자만 남기고 화면 문구는 locale catalog를 단일 진실
원천으로 사용한다. 기존 sample-only·canonical CTA·API 요청 없음 계약은 보존한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-marketing/marketing-config.js` | 완성된 `copy`와 별도로 명시된 key만 담는 immutable `copyOverrides` 및 `resolveMarketingCopy`를 추가하고 Quickstart step을 id-only frozen record로 정리했다. |
| `src/profile-marketing/MarketingLanding.jsx` | 기본 영어값과의 문자열 동등성 비교를 제거하고, 명시 override가 없을 때 현재 locale catalog를 사용하는 per-key resolver로 교체했다. |
| `src/profile-marketing/__tests__/marketing-config.test.js` | 기본·부분·전 key·기본 영어값과 동일한 명시 override·invalid copy 계약을 고정했다. |
| `src/profile-marketing/__tests__/sites-config.test.js` | Sites 기본 config가 빈 immutable override map을 사용하는지 확인했다. |
| `src/profile-ui/__tests__/homeOnboarding.test.js` | Home onboarding의 공유 Quickstart step이 `id`만 보존하는지 검증했다. |
| `mydocs/working/task_m100_71_stage3.md` | Stage 3 변경·검증·잔여 위험과 다음 단계 경계를 기록했다. |

구현계획서에서 수정 예상한 `src/profile-ui/homeOnboarding.js`는 Marketing 상수를 그대로
재수출하므로 source 변경 없이 id-only 계약을 반영한다. 기존 E2E가 locale 및 sample-only
수용 기준을 이미 직접 검증해 `tests/profile-ui.spec.js`도 수정하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

공개 입력 `createMarketingConfig({ copy })`와 완성된 `config.copy`는 유지했다. additive한
`copyOverrides`는 caller가 실제로 제공한 known key만 보존하며, 누락·`null`·`undefined`
값은 기존처럼 기본 문구 경로로 처리한다. 알 수 없는 key를 무시하는 기존 동작과 문자열
정규화·validation도 유지했다.

Marketing landing은 명시 override가 있으면 그 값을, 없으면 현재 locale catalog 값을
사용한다. 따라서 custom 값이 기본 영어 문자열과 우연히 같아도 명시 override로 보존되며,
한국어 locale에서 누락된 key가 영어 기본값으로 굳는 회귀를 막는다. Quickstart의 id,
표시 순서, CTA destination, sample-only 카드와 API 요청 없음 동작은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-marketing/__tests__/marketing-config.test.js \
  src/profile-marketing/__tests__/sites-config.test.js \
  src/profile-ui/__tests__/homeOnboarding.test.js
npx playwright test tests/profile-ui.spec.js --grep 'marketing|sample-only'
git diff --check
```

결과:

- OK — unit 17 tests, 17 pass, 0 fail.
- OK — 기본 config의 `copyOverrides`가 비어 있고 frozen 상태임을 확인했다.
- OK — partial·전 key custom과 기본 영어값과 동일한 명시 custom을 값 비교 없이 구분한다.
- OK — 누락 key가 현재 localized value로 fallback하고 invalid whitespace·array 입력을 거부한다.
- OK — Quickstart 5개 step이 frozen id-only record이며 표시 순서를 유지한다.
- OK — Playwright 3 tests, 3 pass. 한국어 Marketing locale, sample-only/API 요청 없음,
  공유 visual metrics를 확인했다.
- OK — `git diff --check`가 통과했다.

## 잔여 위험

- `copyOverrides`는 normalized config에 추가된 additive property다. config 생성 경로는 모두
  factory를 사용하며 기본·Sites config test가 이를 고정한다. 외부 입력 signature와
  `config.copy` 소비 계약은 바뀌지 않았다.
- 알 수 없는 copy key를 무시하고 nullish known key를 누락으로 처리하는 기존 호환 동작은
  유지했다. 지원 key 확장 시 `DEFAULT_MARKETING_COPY`와 locale catalog parity를 함께
  갱신해야 한다.
- #73 Share Studio 보간·접근성 범위는 아직 구현하지 않았으며 이번 단계와 결합하지 않았다.

## 다음 단계 영향

- Stage 4는 Marketing 계약을 추가 변경하지 않고 #73 Share Studio의 platform 보간을 단일
  helper로 통합한다.
- Profile topbar Share의 보이는 문구는 유지하면서 영어·한국어 catalog에 문맥이 분명한
  접근성 이름을 추가하고 locale·target·접근성 회귀를 검증한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4의 #73 Share Studio 보간·접근성 정리로
  진행한다.
