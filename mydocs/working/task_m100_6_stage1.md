# Task M100 #6 Stage 1 보고서

GitHub Issue: [#6](https://github.com/postmelee/codex-usage-profile/issues/6)
구현계획서: [`task_m100_6_impl.md`](../plans/task_m100_6_impl.md)
Stage: 1

## 단계 목적

Codex App Server `account/usage/read` 응답을 엄격하게 검증하고 GitHub OAuth owner 정보와 결합해, 플랫폼과 요청 시점에 영향받지 않는 998x612 PNG 카드를 생성하는 기반을 구현했다. CLI 입력에서는 이름, 사용자명, 아바타를 허용하지 않고 GitHub owner record만 카드 identity의 원천으로 사용한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/account-usage.js` | 공식 usage 응답의 exact-key, nullable, 날짜, non-negative integer 검증과 정규화 |
| `src/profile-card/heatmap.js` | 최신 주를 오른쪽에 배치하는 26주 x 7일 heatmap과 4단계 blue scale 생성 |
| `src/profile-card/view-model.js` | GitHub owner identity 병합, 영문/한국어 라벨과 token/streak 표시값 구성 |
| `src/profile-card/renderer.js` | 499x306 logical scene을 2배율 998x612 PNG로 렌더링하고 번들 폰트, 고정 좌표, 텍스트 축소/말줄임 적용 |
| `src/profile-card/index.js` | card module public export 구성 |
| `src/profile-card/fixtures/sample-account-usage.js` | 기준 카드의 통계와 heatmap을 재현하는 공식 usage shape fixture |
| `src/profile-card/__tests__/*.test.js` | usage 계약, owner 우선순위, heatmap, 다국어 포맷, PNG 크기와 핵심 픽셀 검증 14건 |
| `package.json`, `package-lock.json` | MIT canvas renderer와 OFL-1.1 Noto Sans KR 번들 폰트 의존성 추가 |
| `mydocs/plans/task_m100_6.md`, `mydocs/plans/task_m100_6_impl.md` | 재구성 심볼을 제외하고 Codex 제품명 텍스트만 사용하는 승인 변경 반영 |

## 본문 변경 정도 / 본문 무손실 여부

기존 API와 UI 동작은 변경하지 않았다. 신규 `src/profile-card` 경계와 런타임 의존성만 추가했으며, owner/public endpoint와 기존 profile snapshot 연동은 Stage 2 이후로 남겼다.

OpenAI Design Guidelines가 이름, 로고, 아이콘과 디자인 요소를 OpenAI의 Marks로 정의하고 승인되지 않은 변형을 제한하므로, 첨부 PNG를 보고 재구성했던 Codex 심볼은 제거했다. 우측에는 이 카드가 측정하는 제품을 나타내는 `Codex` 텍스트만 유지하며 Stage 4 사용자 문서에 비공식 프로젝트 고지를 추가한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/*.test.js
npm run build
git diff --check
```

결과:

- OK: profile-card 단위 테스트 14건 전체 통과
- OK: PNG signature, 998x612 크기, 투명 모서리, 배경, heatmap level, divider, 52x52 avatar와 text-only Codex label 픽셀 확인
- OK: 긴 display name과 번역 라벨이 고정 영역 밖으로 넘치지 않도록 축소 또는 말줄임 처리
- OK: Vite 8.0.16 production build 성공, 45 modules transformed
- OK: `git diff --check` 경고 없음
- OK: 기준 PNG와 수동 비교 시 카드 크기, radius, avatar, 26x7 heatmap, four-stat 배치와 색상 일치 확인

## 잔여 위험

- 기준 PNG의 Codex 심볼은 브랜드 지침상 재구성하지 않기 위해 의도적으로 제외했으므로 기준 이미지와 해당 영역이 다르다.
- 기준 PNG는 macOS system typography로 보이지만 서버와 CI의 결과를 고정하기 위해 OFL 번들 폰트를 사용했다. 이에 따라 일부 glyph 폭과 anti-aliasing은 수 px 차이가 날 수 있다.
- avatar URL fetch, timeout, content-type 및 byte limit은 Stage 2의 service 경계에서 구현한다.

## 다음 단계 영향

- Stage 2는 `buildCardViewModel`과 `renderProfileCardPng`를 owner/private preview 및 public card endpoint에서 호출한다.
- ETag 입력에는 renderer version, locale, GitHub owner identity와 정규화된 usage를 포함해야 한다.
- CLI payload는 이 단계의 strict `account/usage/read` 계약을 그대로 사용하며 GitHub identity를 포함하면 거부한다.
- 공개 endpoint와 UI에서도 공식 심볼을 새로 추가하지 않고 `Codex` 제품명 텍스트와 비공식 프로젝트 고지를 유지한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 owner/public card service와 cache contract 구현으로 진행한다.
