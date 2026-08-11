# Task M100 #2 Stage 3 완료 보고서

GitHub Issue: [#2](https://github.com/postmelee/codex-usage-profile/issues/2)
구현계획서: [`task_m100_2_impl.md`](../plans/task_m100_2_impl.md)
Stage: 3

## 단계 목적

Stage 3의 목적은 Stage 1-2에서 고정한 snapshot 계약 위에 전체 Codex Profile 화면과 공유 카드가 공통으로 사용할 selector를 추가하는 것이다. UI formatting이나 heatmap level 계산은 후속 #3/#6에서 처리하고, 이번 단계는 필요한 raw source data와 안정적인 key/label/value view model을 제공하는 범위로 제한했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-snapshot/selectors.js` | Profile/Card view model selector, 5개 profile stat, 4개 card stat, 26주 card usage source selector 구현 |
| `src/profile-snapshot/__tests__/selectors.test.js` | header, profile stats, card stats, token activity, 26주 card usage source, invocation sorting, full/card view model fixture coverage 테스트 추가 |
| `src/profile-snapshot/index.js` | selector public export 추가 |
| `src/profile-snapshot/types.d.ts` | selector return type과 option declaration 추가 |
| `mydocs/orders/20260608.md` | Stage 3 완료 보고 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

기존 schema와 normalizer 동작은 보존했다. Stage 3는 snapshot을 변환하거나 저장하지 않고, 이미 검증된 snapshot에서 downstream renderer가 사용할 값을 선택하는 pure selector만 추가했다.

## 검증 결과

실행 명령:

```bash
npm test
git diff --check
```

결과:

- OK: `npm test` 통과
  - Node 내장 `node --test`
  - tests 17
  - pass 17
  - fail 0
- OK: `git diff --check` 통과

## 잔여 위험

- 공유 카드 selector는 26주 window source data를 제공하지만 Codex 앱과 동일한 level 계산은 아직 구현하지 않았다. level 계산과 Canvas renderer는 #6에서 구현해야 한다.
- 전체 Profile chart의 daily/weekly/cumulative level 계산도 #3 UI task 범위로 남아 있다.
- selector label은 현재 English literal로 고정했다. i18n이나 display formatting은 UI task에서 조정할 수 있다.

## 다음 단계 영향

- #3 Profile UI는 `selectProfileViewModel` 또는 하위 selector를 사용해 header, 5개 stat, activity insights, most used invocations, daily usage source를 받을 수 있다.
- #6 README card endpoint는 `selectShareCardViewModel`을 사용해 header, 4개 stat, 26주 usage source를 받을 수 있다.
- Stage 4 내부 계약 문서에는 selector별 책임 경계와 후속 issue 사용 지점을 명시해야 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4로 진행한다.
