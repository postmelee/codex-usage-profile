# Task #101 Stage 4 보고서 — Share Studio revision 공유 URL 통일

GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
구현계획서: [`task_m100_101_impl.md`](../plans/task_m100_101_impl.md)
Stage: 4

## 단계 목적

Stage 3에서 X·LinkedIn을 포함한 다섯 SNS의 revision 경로 실험 gate가 통과한 결과를 제품 흐름에
반영한다. Share Studio가 owner 설정 갱신 시각과 usage submit 시각 중 최신 값을 사용해 하나의
queryless revision URL을 만들고, 공유 링크 복사와 X·LinkedIn·Threads·Facebook·Reddit target에
동일하게 전달하도록 전환한다. README Markdown은 fixed `/api/share/{handle}` href와 query 없는
`/u/{handle}/card.png` src를 유지한다. 동시에 사용자·아키텍처·운영 문서에 두 URL의 역할과 cache
identity 계약을 기록하는 구현계획 Stage 4다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/shareStudio.js` | fixed README URL과 revision share URL을 분리하고 timestamp 누락·오류 시 share URL을 fixed route로 폴백한다. |
| `src/profile-ui/ShareStudio.jsx` | owner `updatedAt`과 usage `uploadedAt`을 입력받아 share target만 다시 계산하고 README Markdown은 fixed URL로 만든다. |
| `src/profile-ui/HomePage.jsx` | 최신 profile owner·usage timestamp를 Share Studio에 전달한다. |
| `src/profile-ui/CardProfilePage.jsx` | Profile 화면에서도 같은 timestamp data flow를 연결한다. |
| `src/profile-ui/__tests__/shareStudio.test.js` | 최신 timestamp 선택, 누락·invalid fallback과 submit 전후 README Markdown 불변을 검증한다. |
| `src/profile-ui/__tests__/cardStyleSettings.test.js` | fixed README, revision share와 선택된 card asset이 분리된 source 계약을 검증한다. |
| `tests/profile-ui.spec.js` | submit 전후 README Markdown 동일성과 공유 링크·다섯 SNS의 동시 revision 갱신을 검증한다. |
| `docs/readme-card.md` | fixed README href·src, revision 공유 링크·SNS와 비-snapshot 계약을 설명한다. |
| `docs/production-hosting.md` | revision 계산, matching·stale canonical, private·missing fallback과 validation 결과를 기록한다. |
| `docs/sites-operations.md` | application/provider 분리 smoke, X 지연, LinkedIn Inspector와 rollback 경계를 추가한다. |
| `mydocs/orders/20260813.md` | #101 상태를 Stage 4 완료·승인 대기로 갱신한다. |
| `mydocs/working/task_m100_101_stage4.md` | 구현 경계, 검증 결과, 잔여 위험과 다음 단계 영향을 기록한다. |

## 본문 변경 정도 / 본문 무손실 여부

기존 Share Studio의 README Markdown, card image URL, 저장·이미지 복사, 접근성,
animation/readiness와 private 전환 동작은 유지했다. README Markdown은 submit·카드 설정 저장 전후
fixed href와 src를 그대로 사용한다. 변경 범위는 공개 profile revision URL을 만드는 data flow와
공유 링크·다섯 SNS action에 한정했다. 유효한 timestamp가 없는 legacy profile과 malformed
timestamp에서는 이 share URL도 기존 fixed `/api/share/{handle}`로 폴백한다.

공식 문서 세 파일은 기존 구조와 운영 기준을 보존하고 revision 관련 절만 현행화했다. `README.md`,
production origin·access·saved version, DB schema와 외부 provider 상태는 변경하지 않았다. revision은
cache identity일 뿐 과거 카드 snapshot이나 DB history가 아니므로 별도 카드 버전 보존 로직도
추가하지 않았다.

## 검증 결과

구현계획서 지정 명령:

```bash
node --test \
  src/profile-shared/__tests__/public-share-url.test.js \
  src/profile-ui/__tests__/shareStudio.test.js \
  src/profile-ui/__tests__/cardImageReadiness.test.js \
  src/profile-ui/__tests__/publicProfileRoutes.test.js
npx playwright test tests/profile-ui.spec.js --grep "Share Studio|공유"
git diff --check
```

추가 회귀 명령:

```bash
npx playwright test tests/profile-ui.spec.js --grep "card owner can publish|card appearance saves"
node --test src/profile-ui/__tests__/cardStyleSettings.test.js
npm run build:production
```

결과:

- OK — 지정 Node 단위 테스트 32개 통과. 최신 revision 계산, fixed fallback, 공개 revision 착지,
  submit 전후 README Markdown 불변과 기존 image/readiness 경계를 함께 확인했다.
- OK — 지정 Playwright 테스트 16개 통과. submit 전후 README Markdown이 완전히 동일하고 공유
  링크와 X·LinkedIn·Threads·Facebook·Reddit target이 모두 새 timestamp revision으로 바뀌는
  시나리오를 포함한다.
- OK — 수정된 owner 공유와 카드 설정 저장 사용자 흐름 2개 추가 통과. 설정 저장 뒤 공유 링크는
  owner revision을 반영하지만 README Markdown은 fixed URL을 유지했다.
- OK — card settings 계약 단위 테스트 5개 통과.
- OK — production Sites full-stack build 통과. server 62 modules와 client 1,834 modules를 build하고
  artifact를 정상 finalize했다.
- OK — `git diff --check` 경고 없음.

## 잔여 위험

- revision URL은 provider cache identity를 분리하지만 외부 provider의 최초 crawler·이미지 처리
  시간을 통제하지 않는다. Stage 3 실측처럼 X나 Threads에서 수 초 지연될 수 있다.
- 이미 캐시된 fixed URL이나 과거 revision 미리보기는 즉시 삭제되지 않는다. 새 공유 링크와 SNS
  작성 흐름만 최신 revision URL을 사용하고 README Markdown은 의도적으로 fixed URL을 유지한다.
- 과거 revision 요청은 과거 이미지를 보존하지 않고 현재 revision metadata로 수렴한다. 사용자가
  과거 카드 snapshot으로 해석하지 않도록 공식 문서에 이 계약을 명시했다.
- `stage5`의 새 canonical production 전환과 테스트 전용 전환은 #101 범위가 아니며 후속 migration
  Issue에서 별도 승인과 배포 절차가 필요하다.

## 다음 단계 영향

- Stage 5에서는 전체 Node·Playwright 회귀, production build와 Sites artifact 검증을 다시 수행한다.
- Stage 5는 비배포 PR handoff 단계다. production origin·access·saved version을 바꾸거나 외부 SNS에
  게시하지 않는다.
- 전체 검증까지 통과한 뒤에만 별도 최종 보고 절차로 최종 보고서, publish branch와 `devel` 대상 PR을
  준비한다.

## 승인 요청

- Stage 4의 fixed README Markdown 보존, 공유 링크·다섯 SNS 단일 revision URL 전환, 공식 문서
  현행화와 검증 결과를 승인하면 Stage 5 전체 회귀 검증과 비배포 PR handoff로 진행한다.
