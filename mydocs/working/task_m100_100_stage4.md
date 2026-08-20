# Task #100 Stage 4 보고서 — Share Studio 고정 README URL 전환

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
구현계획서: [`task_m100_100_impl.md`](../plans/task_m100_100_impl.md)
Stage: 4

## 단계 목적

Share Studio가 하나의 선택 URL을 모든 동작에 재사용하던 구조를 canonical copy URL과 selected asset
URL로 분리한다. README Markdown과 이미지 URL 복사는 설정 query가 없는 고정 `publicCardUrl`을
사용하고, 미리보기·다운로드·PNG clipboard는 저장된 theme·locale의 explicit asset을 계속 사용하도록
Home과 owner Profile 전달 경계를 전환한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/cardShare.js` | 안전한 absolute HTTP(S) canonical URL만 허용하고 query·fragment를 제거하는 helper 추가 |
| `src/profile-ui/shareStudio.js` | canonical copy URL과 selected asset URL을 분리하고 selected URL을 canonical fallback으로 승격하지 않는 resolver 추가 |
| `src/profile-ui/ShareStudio.jsx` | README·이미지 URL 복사는 canonical, preview·download·PNG clipboard는 selected asset을 소비하도록 분리 |
| `src/profile-ui/CardProfilePage.jsx` | `publicCardUrl`과 `selectedPublicCardUrl`을 Share Studio에 별도 전달 |
| `src/profile-ui/HomePage.jsx` | Home Share Studio에도 canonical/selected URL을 별도 전달 |
| `src/profile-ui/__tests__/cardShare.test.js` | absolute/queryless canonical 정규화와 unsafe·relative URL 거절 검증 |
| `src/profile-ui/__tests__/shareStudio.test.js` | canonical/selected 분리, stale selector 제거와 selected-to-canonical fallback 금지 검증 |
| `src/profile-ui/__tests__/cardStyleSettings.test.js` | Home·Profile prop wiring과 Share Studio 소비 경계 회귀 검증 |
| `src/profile-api/__tests__/client.test.js` | 설정 응답의 queryless `publicCardUrl`과 explicit `selectedPublicCardUrl` 동시 보존 검증 |
| `tests/profile-ui.spec.js` | locale·설정 변경 뒤 canonical copy 불변과 selected preview·download·PNG clipboard E2E 검증 |
| `mydocs/orders/20260813.md` | Stage 4 완료와 Stage 5 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. locale별 Markdown alt text, toast와 Share Studio
표시 문구는 변경하지 않았다. 공개 profile 표시 surface도 수정하지 않았다.

Share Studio는 `publicCardUrl`이 안전한 absolute HTTP(S) URL일 때만 열린다. canonical URL에 남아 있는
`theme`, `locale`, `v` 또는 다른 query와 fragment는 복사 전에 모두 제거한다. canonical URL이 없거나
unsafe이면 explicit `selectedPublicCardUrl`을 README 링크로 대체하지 않아 기존 disabled/error 경계를
유지한다.

`selectedPublicCardUrl`은 현재 저장 theme·locale로 다시 정규화해 preview, download와 PNG clipboard에
사용한다. selected URL이 없거나 unsafe이면 안전한 canonical URL에서 현재 explicit 선택을 생성하지만,
이 asset URL은 복사 문자열로 역승격하지 않는다. profile API의 `publicCardUrl`,
`selectedPublicCardUrl`, `publicCardUrls`, `publicCardVariantUrls` shape는 변경하지 않았다.

## 검증 결과

구현계획서 Stage 4 명령:

```bash
node --test src/profile-ui/__tests__/cardShare.test.js src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/cardStyleSettings.test.js src/profile-api/__tests__/client.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|card appearance" --workers=1
git diff --check
```

결과:

- OK — UI helper·source contract·API client 39 tests, 39 pass, 0 fail, 0 skip.
- OK — Share Studio·card appearance Playwright 17 tests, 17 pass, 0 fail.
- OK — 한국어·영어 설정과 theme·locale 변경 뒤 이미지 URL·README Markdown clipboard 값에
  `theme`, `locale` query가 없고 동일 queryless URL임을 검증했다.
- OK — preview source와 Save PNG href는 explicit selected URL을 유지하고 PNG clipboard가 동일 explicit
  asset을 추가 fetch하는 것을 검증했다.
- OK — selected URL 누락·unsafe 상태에서도 canonical URL을 복사 진실 원천으로 유지하고 canonical
  누락 시 selected fallback을 금지하는 unit regression을 검증했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- README와 운영 문서의 예시·설명은 아직 기존 selector URL을 포함할 수 있다. Stage 5에서 사용자·운영
  문서를 queryless canonical 계약으로 통일해야 한다.
- 이번 단계는 선택 UI와 로컬 브라우저 회귀를 검증했으며 전체 Node/Playwright, production Sites build,
  artifact verifier와 실제 production 배포는 수행하지 않았다.

## 다음 단계 영향

- Stage 5는 README와 `docs/readme-card.md`, production·Sites 운영 문서에 같은 queryless URL의 bytes가
  설정·사용량 변경 후 자동 갱신된다는 계약을 기록한다.
- 전체 Node/Playwright, production Sites build·artifact 검증과 local full-stack smoke에서 canonical
  copy, explicit 호환 URL, social publication id와 cleanup dry-run을 통합 확인한다.
- 실제 배포는 수행하지 않고 Task #84가 #100 merge 뒤 최신 `devel`에서 queryless canonical URL로
  Gate C를 재검증할 handoff를 남긴다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 통합 검증과 문서·#84 handoff로 진행한다.
