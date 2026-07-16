# Task M100 #32 Stage 3 완료 보고

GitHub Issue: [#32](https://github.com/postmelee/codex-usage-profile/issues/32)
구현계획서: [`task_m100_32_impl.md`](../plans/task_m100_32_impl.md)
Stage: 3

## 단계 목적

production `/u/:handle`이 Account Usage Contract v1 공개 카드 프로필임을 공식 문서에 반영하고, UsageSnapshot v2와 관련 전체 프로필 모듈은 legacy compatibility 경계에만 남아 있음을 명확히 한다. current analyzer와 공개 화면이 제공하지 않는 model, token breakdown, skill/plugin 기능을 현행 제품 기능으로 오해할 수 있는 설명을 제거한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` | analyzer 고정 minor 표현 제거, `/u/{handle}` public Account Usage route와 stable PNG 안내, UsageSnapshot v2 production 미사용 경계 명시 |
| `docs/readme-card.md` | HTML/JSON/PNG의 owner·latest usage·visibility·handle 공통 조건과 current contract 지원 필드 기록 |
| `docs/usage-snapshot-v2.md` | snapshot API와 compatibility-only module 전용 legacy 계약으로 재정의하고 current profile 미지원 필드 경고 추가 |
| `docs/codex-usage-analyzer.md` | 설치 dependency 기준 설명과 production public route의 legacy v2 미사용 경계 정리 |
| `docs/cli-submit.md` | 고정 analyzer minor 대신 CLI에 설치된 dependency와 Account Usage Contract v1 경계로 정리 |
| `mydocs/orders/20260715.md` | 당일 Task #32 Stage 3 완료 상태 기록 |

## 본문 변경 정도 / 본문 무손실 여부

제품 코드와 legacy schema shape, validator, snapshot API, compatibility UI module은 변경하지 않았다. 승인된 공식 문서 위치에서 active Account Usage path와 legacy UsageSnapshot v2 path의 책임만 수정했으며, 실제 CLI dependency 선언 `^0.2.0`은 재현 가능한 설치 계약이므로 유지했다.

## 검증 결과

실행 명령:

```bash
rg -n 'sampleProfileSnapshot|selectProfileViewModel|from "\./profile-ui/ProfilePage\.jsx"|from "\./profile-ui/profileRoutes\.js"' src/App.jsx
rg -n 'Activity insights|Most used plugins|topInvocations|existing full-profile preview|older full-profile preview|codex-usage-analyzer@0\.2\.x' README.md docs src/profile-ui
rg -n 'publicProfileRoutes|PublicProfilePage|/api/profiles/public|/u/\{handle\}/card\.png|Account Usage Contract v1' src/App.jsx src/profile-ui README.md docs/readme-card.md docs/usage-snapshot-v2.md
npm test
npm run build
git diff --check
```

결과:

- PASS: production `App.jsx`에서 sample snapshot, legacy selector, `ProfilePage`, legacy `profileRoutes` import 검색 결과 없음
- PASS: 낡은 full-profile preview와 analyzer 고정 minor 설명이 공식 문서에 남지 않음
- PASS: `Activity insights`, `Most used plugins`, `topInvocations` 검색 결과는 production에서 미사용인 compatibility module과 legacy v2 migration table에만 존재
- PASS: README와 공식 문서가 `/u/:handle`, `/api/profiles/public/:handle`, `/u/:handle/card.png`의 Account Usage Contract v1 경계를 일관되게 설명
- PASS: 전체 Node 테스트 269건 통과
- PASS: production build 성공, 31 modules transformed
- PASS: `git diff --check` 오류 없음

## 잔여 위험

- legacy snapshot API, validator와 전체 프로필 UI module은 compatibility 목적으로 저장소에 남아 있다. 별도 제거 결정 전에는 current production entry와 다시 연결하지 않아야 한다.
- public HTML/JSON/PNG가 실제 runtime store와 visibility 변경에서 같은 결과를 내는지, changed submit 후 stable URL의 ETag와 bytes가 함께 갱신되는지는 Stage 4 통합 QA가 필요하다.

## 다음 단계 영향

- Stage 4는 문서에 확정한 동일 eligibility 계약을 runtime public HTML, JSON과 PNG에서 함께 검증한다.
- desktop/mobile 시각 QA와 public/private/missing 보안 회귀를 수행하고, 실제 credential 또는 usage 원문은 보고서에 기록하지 않는다.
- 통합 QA에서 발견되는 변경은 현재 Account Usage public route의 최소 보강으로 제한한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 Runtime·시각·보안 통합 QA로 진행한다.
