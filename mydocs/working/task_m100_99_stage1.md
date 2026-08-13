# Task #99 Stage 1 보고서 — 최근 업데이트 표시 계약 고정

GitHub Issue: [#99](https://github.com/postmelee/codex-usage-profile/issues/99)
구현계획서: [`task_m100_99_impl.md`](../plans/task_m100_99_impl.md)
Stage: 1

## 단계 목적

Home과 Profile이 같은 최근 업데이트 시각 표현을 사용할 수 있도록
`usage.uploadedAt` 기반 formatter, locale 문구, 시맨틱 `<time>` 컴포넌트의 계약을
먼저 고정한다. 이 단계에서는 Home과 Profile 화면에 컴포넌트를 연결하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/formatters.js` | 유효한 timestamp를 locale·timezone에 맞게 표시하고 `{ dateTime, label }` 또는 `null`을 반환하는 `formatLastUpdatedAt` 추가 |
| `src/profile-ui/messages.js` | 영어·한국어 `profile.lastUpdated` interpolation 문구 추가 |
| `src/profile-ui/LastUpdatedTime.jsx` | locale context와 formatter를 결합해 유효한 값만 `<time dateTime>`으로 렌더링하는 공통 컴포넌트 추가 |
| `src/profile-ui/__tests__/formatters.test.js` | 영어·한국어, 서울·UTC 시간대, invalid timestamp·timezone 계약 검증 추가 |
| `src/profile-ui/__tests__/lastUpdatedTime.test.js` | Vite SSR 환경에서 시맨틱 `<time>` markup과 invalid 비렌더링 검증 추가 |
| `mydocs/orders/20260813.md` | Task #99를 Stage 1 완료·Stage 2 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

- 기존 formatter와 화면 동작은 변경하지 않고 새로운 표시 계약만 추가했다.
- API·DB·migration·Home·Profile 연결은 수정하지 않았다.
- 브라우저와 Node ICU의 한국어 day period 출력 차이를 흡수하기 위해 한국어 결과에 남은
  `AM`·`PM`만 각각 `오전`·`오후`로 정규화한다. 이미 현지화된 출력은 변경하지 않는다.
- 무효 timestamp와 무효 `timeZone`은 예외나 위조 문구 대신 `null`과 빈 markup으로 처리한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/formatters.test.js src/profile-ui/__tests__/lastUpdatedTime.test.js
node --test src/profile-ui/__tests__/i18n.test.js
git diff --check
```

결과:

- OK — formatter·공통 컴포넌트 집중 테스트 7개 통과
- OK — locale catalog·placeholder·source message ID 회귀 테스트 10개 통과
- OK — 영어·한국어와 `Asia/Seoul`·`UTC` 결과, invalid timestamp·timezone, `<time dateTime>` 계약 확인
- OK — `git diff --check` 공백 오류 없음

## 잔여 위험

- production에서는 브라우저 현지 시간대를 사용하므로 사용자 환경별 실제 표시는 Stage 4의
  Chromium·WebKit 검증에서 확인해야 한다.
- 공통 컴포넌트는 아직 Home·Profile에 연결되지 않아 사용자 화면에는 변화가 없다.

## 다음 단계 영향

- Stage 2는 `AuthenticatedHome`의 ready usage에 `LastUpdatedTime`을 연결하고,
  loading·empty·error에서 문구가 나타나거나 잔류하지 않는지 검증한다.
- 작은 tertiary 스타일과 테마 전환 계약은 Stage 2에서 Home 문맥에 맞게 추가한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 — Home 최근 업데이트 표시로 진행한다.
