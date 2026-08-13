# Task #102 Stage 1 보고서 — 모바일 대상과 provider URL 순수 계약 고정

GitHub Issue: [#102](https://github.com/postmelee/codex-usage-profile/issues/102)
구현계획서: [`task_m100_102_impl.md`](../plans/task_m100_102_impl.md)
Stage: 1

## 단계 목적

viewport와 무관한 모바일 공유 환경 판별 계약을 만들고, 모바일·데스크톱의 SNS
target 목록을 순수 함수 수준에서 분리한다. X 작성 URL을 공식 Web Intent 경로로
바꾸고 Threads의 영어·한국어 공유 문구 공백이 앱에서 `+`로 표시되지 않도록 raw
query 직렬화를 보정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/shareStudio.js` | UA-CH 우선·UA/iPadOS fallback 모바일 판별 helper, mobile target 필터, X `/intent/tweet`, Threads 전용 `%20` 직렬화 추가 |
| `src/profile-ui/__tests__/shareStudio.test.js` | navigator matrix, mobile/desktop target 목록, X path, Threads 영어·한국어 raw space와 실제 plus 보존 회귀 추가 |
| `mydocs/orders/20260813.md` | Stage 1 완료와 Stage 2 승인 대기 상태 반영 |
| `mydocs/working/task_m100_102_stage1.md` | Stage 1 구현·검증·잔여 위험 기록 |

제품 소스와 테스트는 합계 165줄을 추가하고 6줄을 교체했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. `buildShareTargets()`는 모바일
option을 생략하거나 `false`로 전달한 기존 caller에 다섯 SNS target을 그대로
반환한다. LinkedIn·Facebook·Reddit query, 유효하지 않은 profile URL 거부와
Share Studio copy 계약은 유지했다. 모바일 option이 `true`일 때만 LinkedIn과
Facebook을 결과에서 제거한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js
git diff --check
```

결과:

- OK — Share Studio 단위 테스트 9/9 통과, 실패·skip 없음.
- OK — `userAgentData.mobile`의 boolean `true`와 `false` 우선, iPhone·iPod·iPad·Android
  UA fallback, MacIntel 다중 touch iPadOS, 일반 Mac·touch Windows·부분/null 입력을
  table-driven test로 확인했다.
- OK — desktop 기본 target 5개, mobile target `X · Threads · Reddit` 3개를 확인했다.
- OK — X path는 `/intent/tweet`이고 기존 `text`, `url` query allowlist를 유지했다.
- OK — Threads 영어·한국어 `text`는 raw URL에서 `%20`을 사용하고 form space `+`가
  없으며, profile URL의 실제 `+`는 `%2B`로 보존된 뒤 원문으로 round-trip한다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- Stage 1은 순수 helper 계약만 고정했다. 실제 `navigator` 입력 연결, 모바일 DOM에서
  LinkedIn·Facebook 제거, 네 액션 한 줄 배치와 44px hit target은 Stage 2에서 검증한다.
- 외부 provider가 Web Intent나 앱 handoff 동작을 바꿀 수 있다. 이번 단계는 현재 공식
  X path와 관찰된 Threads query 직렬화 경계까지만 보장한다.

## 다음 단계 영향

- `ShareStudio.jsx`는 최초 render에서 `isMobileShareEnvironment(navigator)` 결과를
  계산해 `buildShareTargets({ mobile })`에 전달해야 한다.
- 모바일 target이 세 SNS로 줄어 Save를 포함한 primary action은 네 개가 된다.
  `styles.css`의 360px 이하 두 열 override를 보정하고 iPhone·Android·좁은 desktop
  Playwright context에서 DOM 수, 한 줄 배치, hit target과 overflow를 실측해야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
