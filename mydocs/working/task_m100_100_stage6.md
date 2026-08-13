# Task #100 Stage 6 완료 보고서 — README 임베드 크기와 공유 링크 보정

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
구현계획서: [`task_m100_100_impl.md`](../plans/task_m100_100_impl.md)
Stage: 6

## 단계 목적

query 없는 canonical card URL의 자동 갱신 계약은 유지하면서 GitHub README에
복사되는 기본 표현을 사용자가 크기를 조절할 수 있는 HTML image로 바꾼다. 카드를
클릭했을 때 GitHub Camo 원본이 아니라 `/api/share/{handle}` 공개 공유 페이지로
이동하도록 UI, account usage API와 CLI의 `readmeMarkdown` 결과를 통일한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/readme-embed.js` | absolute HTTP(S) URL 검증과 HTML attribute escape를 적용한 공통 README 임베드 생성기 추가 |
| `src/profile-card/__tests__/readme-embed.test.js` | 기본 폭·공유 anchor·escape·unsafe URL fail-close 계약 검증 |
| `src/profile-ui/cardShare.js`, `src/profile-ui/ShareStudio.jsx` | canonical card URL과 public share URL을 조합해 50% HTML 임베드를 복사 |
| `src/profile-backend/http.js` | account usage 응답의 기존 `readmeMarkdown` field를 공통 생성기로 통일 |
| `packages/codex-usage-profile-cli/` 테스트·README | CLI plain-text 출력의 새 HTML 임베드 계약과 사용자 설명 반영 |
| `src/profile-ui/__tests__/`, `src/profile-backend/__tests__/`, `tests/profile-ui.spec.js` | UI·API·clipboard exact output과 기존 preview/download 분리 회귀 보강 |
| `README.md`, `docs/readme-card.md`, `docs/cli-submit.md` | 기본 `width`, 공유 페이지 클릭, queryless `src`, Camo 동작과 예시 갱신 |
| `mydocs/plans/task_m100_100_impl.md`, `mydocs/orders/20260813.md` | 승인된 Stage 6 범위·문서 위치·검증·진행 상태 기록 |
| `mydocs/working/task_m100_100_stage6.md` | Stage 6 구현·검증·production 게시 전 handoff 기록 |

## 본문 변경 정도 / 본문 무손실 여부

README 임베드 문자열의 표현만 Markdown image에서 GitHub-compatible HTML
`<a><img></a>`로 바꿨다. `imageUrl`, `profileUrl`, `readmeMarkdown` field shape,
query 없는 `/u/{handle}/card.png`, explicit preview/download/PNG clipboard,
publication·ETag·cache 계약은 변경하지 않았다. 문서는 기존 자동 갱신과 Camo
본문을 유지하면서 새 복사 예시와 `width` 조절·클릭 대상 설명만 필요한 위치에
추가·교체했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/readme-embed.test.js src/profile-ui/__tests__/cardShare.test.js src/profile-ui/__tests__/cardStyleSettings.test.js src/profile-backend/__tests__/http.test.js packages/codex-usage-profile-cli/test/output.test.js packages/codex-usage-profile-cli/test/cli.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|card appearance" --workers=1
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
git diff --check
git status --short
```

결과:

- OK — README 임베드·UI·backend·CLI 대상 Node test 85건 전부 통과.
- OK — Share Studio와 card appearance 대상 Playwright 18건 전부 통과. clipboard는
  `<a href=".../api/share/postmelee"><img width="50%" src=".../u/postmelee/card.png" ... /></a>`
  exact string을 반환하고 이미지 URL은 query 없이 유지됐다.
- OK — 전체 Node test 803건 중 797건 통과, 실패 0, 환경 조건 skip 6건.
- OK — 전체 Playwright E2E 100건 전부 통과.
- OK — production Sites build가 server/client artifact를 생성하고 full-stack
  verifier가 client 8개, Worker 2개, migration 5개를 승인했다.
- OK — production verifier가 artifact 5,145,201 bytes, required binding 3개,
  migration 5개와 Worker 크기 제한을 승인했다.
- OK — local full-stack smoke가 62개 route, canonical update 2회, 85,362-byte
  public PNG와 cold/publish/warm render를 검증했다.
- OK — GitHub Markdown render API가 `width="50%"`와 바깥 `/api/share/postmelee`
  anchor를 보존했다. image `src`는 Camo로 변환됐지만 `data-canonical-src`는 query
  없는 stable card URL로 유지됐다.
- OK — Sites version 32가 exact Stage 6 commit
  `6cf2bab664e5a1f0b1e6051cc35887721c307e99`로 production 게시됐다.
- OK — production queryless card는 `200 image/png`, 143,666 bytes,
  `Cache-Control: public, no-cache, must-revalidate`, ETag
  `"u-FSOdmkTILngkqFbrERjiggFNnA30FSXp0zinckP9s"`를 반환했다.
- OK — production `/api/share/postmelee`는 `200 text/html`과 handle별 canonical,
  Open Graph, Twitter metadata를 반환했다.
- OK — production Share Studio를 새로고침한 뒤 실제 clipboard가 기본 폭 50%,
  `/api/share/postmelee` anchor, query 없는 `/u/postmelee/card.png` source의 exact
  HTML 임베드를 반환했다. 이미지 URL 복사는 기존 queryless URL을 유지했다.
- OK — 최초 확인에서 GitHub Camo ICN edge는 이전 dark/ko PNG를 `HIT`, age 2,483으로
  반환했다. 작업지시자 승인 뒤 정확한 Camo URL 한 건만 purge했고, 직후 `MISS`,
  age 0으로 현재 light/en PNG를 다시 가져왔다. 원본과 Camo의 byte length는 모두
  143,666, SHA-256은 모두
  `bbe15239d9a44c82e7824a856eb1118e282014d9c0df41525e9d338a77243fdb`로 일치했다.
- OK — `git diff --check` 통과. 검증용 dependency 연결을 원래 worktree 상태로
  복원했으며 단계 산출물 외 변경은 없다.

## 잔여 위험

- GitHub Camo의 실제 재검증 시점은 GitHub가 관리한다. 새 HTML은 바깥 anchor를
  서비스 공유 페이지로 고정하지만 이후 대표 이미지가 다시 바뀔 때 Camo 갱신이
  지연될 가능성 자체를 제거하지 않는다. purge는 상시 제품 흐름이 아니라 실제
  지연이 장시간 지속될 때만 사용하는 운영 예외다.

## 다음 단계 영향

- Stage 6 production 게시와 smoke가 완료됐다. Task #100 최종 보고서와 PR 게시
  승인 단계로 진행한다.

## 승인 요청

- Stage 6 산출물과 production 검증 결과를 승인하면 최종 보고서·PR 게시 단계로
  진행한다.
