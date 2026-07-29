# Task M100 #38 Stage 1 완료 보고

GitHub Issue: [#38](https://github.com/postmelee/codex-usage-profile/issues/38)
구현계획서: [`task_m100_38_impl.md`](../plans/task_m100_38_impl.md)
Stage: 1

## 단계 목적

공유 대상을 안전하게 구성하는 계약과 locale copy를 먼저 고정하고, 기존
`ShareDialog`를 첨부 이미지의 전체 화면 구도를 수용할 수 있는 accessible
`ShareStudio` 골격으로 교체했다. Stage 1에서는 source card geometry
animation을 시작하지 않고, 공유 기능과 modal lifecycle의 무손실을 우선했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/shareStudio.js` | 한국어/영어 copy, canonical public profile URL, X·LinkedIn·Reddit 공유 target builder를 추가했다. |
| `src/profile-ui/ShareStudio.jsx` | body portal 기반 전체 화면 Studio, primary/secondary action, focus trap/restore, Escape/backdrop close, app inert와 scroll lock을 구현했다. |
| `src/profile-ui/ShareDialog.jsx` | 기존 dialog 구현을 제거하고 `ShareStudio`로 대체했다. |
| `src/profile-ui/HomePage.jsx` | Home의 공유 흐름에 origin, public owner handle, visibility mutation을 연결했다. |
| `src/profile-ui/CardProfilePage.jsx` | 카드 전용 페이지의 기존 공유 dialog 호출을 새 Studio로 교체했다. |
| `src/profile-ui/Icons.jsx` | X, LinkedIn, Reddit용 local inline SVG path를 추가했다. |
| `src/styles.css` | 전체 화면 dim/blur, 중앙 카드, 4개 원형 primary action, 보조 copy 영역과 mobile layout을 추가했다. |
| `src/profile-ui/__tests__/shareStudio.test.js` | locale fallback, public URL 정규화, provider allowlist와 fail-closed 동작을 검증했다. |
| `tests/profile-ui.spec.js` | provider href, focus/inert/restore, copy/download/privacy, desktop/mobile layout 검증을 갱신했다. |
| `mydocs/orders/20260729.md` | Stage 1 완료와 Stage 2 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 Image URL 복사,
README Markdown 복사, PNG 저장, Home의 비공개 전환 동작은 유지했다.
공유 대상에는 private preview나 credential 성격의 값을 넣지 않고 공개 프로필
URL만 전달한다. 기존 Home·카드 전용 페이지의 Share 진입점도 모두 보존했다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-ui/__tests__/cardShare.test.js \
  src/profile-ui/__tests__/shareStudio.test.js
npm run build
npm run test:e2e -- --grep "Share"
git diff --check
```

결과:

- OK — Node 단위 테스트 7개 통과, 실패 0개.
- OK — Vite production build 성공, 39 modules transformed.
- OK — Share 관련 Playwright E2E 11개 통과, 실패 0개.
- OK — `git diff --check` 출력 없음.
- OK — 1280×900 desktop과 390×844 mobile 캡처를 확인했으며 전체 화면
  dim/blur, 중앙 제목·카드, 4개 원형 action, 보조 copy 영역의 계층과
  overflow 무발생을 확인했다.

## 잔여 위험

- source card가 Studio 중앙으로 이동하는 FLIP motion은 계획대로 Stage 2에
  남아 있다.
- 첨부 이미지와의 desktop 간격·크기·overlay 농도 세부 보정은 Stage 2의
  visual regression 과정에서 확정한다.
- 외부 provider의 compose endpoint 동작은 provider 정책 변경의 영향을 받을 수
  있어, 현재는 HTTPS allowlist와 공개 URL query 계약으로 경계를 고정했다.

## 다음 단계 영향

- Stage 2는 이 Stage의 portal/focus/inert 골격을 유지하면서 source card bounds를
  전달하고 shared-card FLIP, staged overlay/title/action reveal을 추가해야 한다.
- 현재 desktop/mobile 캡처를 Stage 2 시각 비교의 baseline으로 사용할 수 있다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
