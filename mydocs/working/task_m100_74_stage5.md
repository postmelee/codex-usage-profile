# Task #74 Stage 5 완료 보고서

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
구현계획서: [`task_m100_74_impl.md`](../plans/task_m100_74_impl.md)
Stage: 5

## 단계 목적

저장된 카드 테마와 언어가 Share Studio 미리보기, 이미지 복사·다운로드, URL 및
README Markdown 복사, 공개 프로필 카드에 동일하게 반영되도록 선택 URL 계약을
통합했다. 기존 query 없는 dark 카드 URL은 그대로 유지하고, light/dark와 en/ko
조합은 서로 독립적으로 정규화해 대표 URL 하나만 교체해도 새 제출 없이 공유 결과가
바뀌도록 했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/cardShare.js` | 테마·언어 query 독립 정규화, legacy queryless 보존, 비 HTTP(S) URL 거부 |
| `src/profile-ui/ShareStudio.jsx` | 미리보기·이미지 복사·다운로드·URL·README가 동일한 선택 URL을 사용하도록 통합 |
| `src/profile-ui/CardProfilePage.jsx` | 저장된 카드 테마를 Share Studio에 전달 |
| `src/profile-ui/HomePage.jsx` | 홈 Share Studio도 저장된 테마와 언어 기반 URL을 사용하도록 정렬 |
| `src/profile-ui/PublicProfilePage.jsx` | `selectedPublicCardUrl` 우선 렌더링과 legacy 응답 fallback 추가 |
| `src/profile-ui/publicProfileRoutes.js` | 공개 카드 URL의 상대 경로 또는 HTTP(S) allowlist 검증 추가 |
| `src/profile-ui/__tests__/cardShare.test.js` | 테마·언어 조합, query 순서, legacy URL, unsafe scheme 회귀 검증 |
| `src/profile-ui/__tests__/cardStyleSettings.test.js` | Share Studio 테마 전달 소스 계약 갱신 |
| `src/profile-ui/__tests__/publicProfileRoutes.test.js` | malformed·unsafe 공개/선택 URL fail-closed 검증 추가 |
| `src/profile-backend/__tests__/http.test.js` | dark/light × en/ko 변형의 응답 URL·ETag 분리 검증 추가 |
| `tests/profile-ui.spec.js` | 선택 URL 미리보기, 저장 후 공유, 공개 프로필 URL, fallback E2E 보강 |
| `mydocs/working/task_m100_74_stage5.md` | Stage 5 범위·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

공유 URL 선택과 UI 소비 경로만 변경했다. D1/PostgreSQL schema, publication service
v4의 네 PNG 생성 계약, R2 object key, 사용량 제출 payload, 공개/비공개 전환 계약은
변경하지 않았다. 기존 `publicCardUrl`은 계속 query 없는 dark 카드 URL로 동작하며,
새 `selectedPublicCardUrl`이 없는 이전 API 응답도 기존 URL과 UI locale로 동작한다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/cardShare.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/publicProfileRoutes.test.js \
  src/profile-backend/__tests__/http.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|theme URL|README|public card"
npm run build:sites
git diff --check
```

결과:

- OK — Node 58건 전부 통과, 실패·skip 0건. 공개 API, URL 정규화, Share Studio 및 malformed URL 계약 포함.
- OK — Playwright 10건 전부 통과. 선택 테마 URL, Share Studio fallback, README/URL 복사와 공개 카드 흐름 포함.
- OK — Sites production build 성공, 27 modules transformed.
- OK — `git diff --check` 통과.

## 잔여 위험

- 실제 Sites production과 R2 네 변형 object를 연결한 원격 smoke는 Stage 6 배포 준비에서 수행해야 한다.
- X·LinkedIn·Reddit compose 창은 프로필 링크와 문구를 여는 기존 계약을 유지한다. 플랫폼에 붙여 넣을 PNG 복사 동작은 선택 URL에서 이미지를 가져온다.
- 이번 단계에서는 원격 Sites 설정, R2 object, D1 데이터와 공개 범위를 변경하지 않았다.

## 다음 단계 영향

- Stage 6은 전체 회귀 검증, README·운영 문서 정합성, 실제 배포 후보의 네 PNG URL/ETag와 legacy queryless smoke를 확인해야 한다.
- 선택 URL이 unsafe scheme이거나 malformed이면 공개 프로필을 사용할 수 없음으로 처리하는 fail-closed 계약을 유지해야 한다.
- 원격 배포와 공개 전환은 별도 승인을 받기 전까지 수행하지 않는다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 Stage 6 통합 검증·문서·배포 준비로 진행한다.
