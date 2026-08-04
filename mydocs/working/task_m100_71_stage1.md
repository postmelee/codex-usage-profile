# Task M100 #71 Stage 1 보고서 — 공통 계약 특성화와 구현계획

GitHub Issue: [#71](https://github.com/postmelee/codex-usage-profile/issues/71)
연결 Issue: [#72](https://github.com/postmelee/codex-usage-profile/issues/72), [#73](https://github.com/postmelee/codex-usage-profile/issues/73)
구현계획서: [`task_m100_71_impl.md`](../plans/task_m100_71_impl.md)
Stage: 1

## 단계 목적

설치된 Codex 앱의 compact number 동작과 저장소의 중복 formatter 차이를 읽기
전용으로 특성화하고, #71·#72·#73을 한 PR에서 순차 처리할 파일·검증·커밋 경계를
구현계획서에 고정한다. 이 단계에서는 제품 source를 수정하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/plans/task_m100_71_impl.md` | 앱 version·재사용 경계, 영어·한국어·fallback compact matrix, 세 이슈의 구현 계약과 Stage 2~5 검증을 확정했다. |
| `mydocs/working/task_m100_71_stage1.md` | Stage 1 조사·검증 결과와 다음 단계 승인 경계를 기록했다. |

## 특성화 결론

- 참조 artifact는 ChatGPT/Codex 앱 `26.727.51351`, bundled CLI
  `0.146.0-alpha.9.2`다.
- production bundle은 minified 상태여서 Profile 전용 함수를 안전하게 분리해 재사용할
  수 없다. 앱 source를 복사하지 않고 관찰 가능한 locale-native compact 동작을
  `Intl.NumberFormat` 계약으로 재현한다.
- 현재 공용 Intl formatter와 heatmap 수동 formatter의 차이가 다음처럼 확인됐다.
  - 영어 `999,999`: `1M` 대 `1000K`
  - 영어 `999,999,999`: `1B` 대 `1000M`
  - 한국어 `1,000`: `1천` 대 `1,000`
  - 한국어 `99,999,999`: `1억` 대 `10000만`
  - 한국어 `999,999,999,999`: `1조` 대 `10000억`
- Stage 2는 공용 `formatCompactNumber`에 heatmap compact tooltip을 위임하고 exact
  localized integer 경로는 그대로 유지한다.
- Stage 3는 Marketing caller가 명시한 key만 담는 immutable `copyOverrides`를 추가해
  문자열 값 동등성 sentinel을 제거한다.
- Stage 4는 platform 전용 formatter에서 locale message를 한 번만 보간하고 Profile
  Share 버튼에 `common.shareProfile` 접근성 이름을 추가한다.

## 본문 변경 정도 / 본문 무손실 여부

제품 source·공개 API·사용자 문서 본문은 변경하지 않았다. 승인된 수행계획서도
재작성하지 않고, 구현계획서와 단계 보고서만 신규 작성했다. #74, production 배포,
backend/API, CLI와 card renderer 제외 범위는 그대로다.

## 검증 결과

실행 명령:

```bash
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
  /Applications/ChatGPT.app/Contents/Info.plist
/Applications/ChatGPT.app/Contents/Resources/codex --version
node --input-type=module -e '<영어·한국어·fallback compact 경계 matrix script>'
rg -n 'formatCompactNumber|formatTokenCount|DEFAULT_MARKETING_COPY|resolveMarketingCopy|formatCopy|platform: "\{platform\}"|common\.share' \
  src/profile-ui src/profile-marketing tests/profile-ui.spec.js
git diff --check
```

결과:

- OK — 설치 앱 `26.727.51351`과 CLI `0.146.0-alpha.9.2`를 확인했다.
- OK — `999`, `1,000`, `1,500`, 단위 직전 반올림값, `1M`, `100M`, `1B`,
  `1T`의 영어·한국어·fallback 결과와 현 수동 formatter 차이를 재현했다.
- OK — #71 중복 formatter, #72 값 동등성 sentinel, #73 placeholder 자기 치환·수동
  `.replace`와 Share 접근성 consumer 위치를 모두 확인했다.
- OK — `git diff --check`가 통과했다.

## 잔여 위험

- 설치 앱 production bundle의 Profile 전용 내부 함수는 minified artifact에서 안정적으로
  분리하지 못했다. 내부 구현 동일성을 주장하지 않고 version·공개 UI 관찰·Intl runtime
  경계값의 동작 동등성만 수용 기준으로 삼는다.
- Stage 3의 additive `copyOverrides`가 Sites config serialization이나 기존 identity test에
  영향을 줄 수 있으므로 config·Sites·onboarding focused test를 함께 변경해야 한다.
- Stage 4의 platform message key 분리 시 locale catalog parity를 깨뜨릴 수 있으므로 i18n
  unit과 세 platform의 실제 결과를 같은 단계에서 검증해야 한다.

## 다음 단계 영향

- Stage 2는 구현계획서의 compact matrix를 table-driven test로 먼저 고정한 뒤 heatmap의
  수동 unit formatter를 공용 helper 위임으로 교체한다.
- exact tooltip, heatmap bucket·level·mode, Profile 통계 소비자는 변경하지 않는다.
- Stage 2 완료·승인 전에는 #72 또는 #73 source를 수정하지 않는다.

## 승인 요청

- Stage 1 산출물과 compact 경계 matrix, #71·#72·#73 구현 계약을 승인하면 Stage 2
  숫자 축약 formatter 통합으로 진행한다.
