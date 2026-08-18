# Task #101 Stage 3 보고서 — 승인된 Sites 실험 배포와 플랫폼 gate

GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
구현계획서: [`task_m100_101_impl.md`](../plans/task_m100_101_impl.md)
Stage: 3

## 단계 목적

Stage 1·2에서 구현한 queryless revision share URL을 승인된 공개 validation site에 exact artifact로
배포하고, application metadata와 X·LinkedIn provider cache identity를 분리해 실측한다. X와
LinkedIn이 새 revision B를 최신 카드로 인식하는지 확인하고 Threads·Facebook·Reddit 회귀까지
통과해야 Stage 4의 Share Studio 단일 revision URL 전환을 허용하는 구현계획 Stage 3이다.

## 산출물

| 파일·대상 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_101_stage3.md` | exact 배포 경계, A/B application 응답, 다섯 SNS 작성 화면 실측과 gate 판정을 기록했다. |
| `mydocs/orders/20260813.md` | #101 비고를 Stage 3 완료·플랫폼 gate 통과·승인 대기로 갱신했다. |
| `codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | 승인된 task101 candidate를 saved version 33으로 배포했다. public access와 environment는 유지했다. |

제품 소스와 공식 문서는 이 Stage에서 수정하지 않았다.

## 배포 경계와 결과

| 항목 | 승인 기준 | 실제 결과 |
|---|---|---|
| validation target | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | 일치 |
| Sites project | `appgprj_6a62f58721788191a7cd82f37320f244` | 일치 |
| exact source | `53a7132630dcb6f43459880d79730e10e2b59d6e` | saved version 33 source로 일치 |
| deployment | 승인된 target에만 배포 | `appgdep_6a83b0c37c108191bcab0a1cf0514515`, 성공 |
| access | public, access revision 59 유지 | 변경 없음 |
| environment | environment revision 89 유지 | key·secret·값 변경 없음 |
| rollback | saved version 32, source `6cf2bab664e5a1f0b1e6051cc35887721c307e99` | 기준 유지, rollback 미실행 |

새 canonical production site, 다른 Sites project, 사용자 저장소 `main`, #84 파일·브랜치는 변경하지
않았다. Stage 3 실측에 필요한 카드 설정 저장만 수행했고 계정·세션·CLI token이나 기존 데이터를
삭제하지 않았다.

## A/B application 증거

공개 profile `postmelee`에서 dark 카드를 기준 A로 두고, 2026-08-18 약 10:11 KST에 카드 설정을
light로 저장해 기준 B를 만들었다.

| 기준 | revision | URL | 의미 |
|---|---:|---|---|
| A | `1786620697005` | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/api/share/postmelee/r/1786620697005` | 카드 저장 전 identity |
| B | `1787015512285` | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/api/share/postmelee/r/1787015512285` | light 카드 저장 후 최신 identity |

revision B 문서와 이미지 결과:

- 문서 `GET`은 `200`이며 final URL, `canonical`, `og:url`이 모두 revision B URL과 일치했다.
- `og:image`, `og:image:secure_url`, `twitter:image`는 모두
  `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/postmelee/social.png?v=1787015512285`
  를 사용했다.
- B 이미지는 `200`, `image/png`, 220,229 bytes였고 ETag는
  `"Cg96xH3OucCL2M0oPsDeUO3TwA-975uPxX9uxpMCYKo"`였다.
- 문서 `HEAD`는 `GET`과 같은 `200`·HTML header를 제공하고 body는 비어 있었다.
- 문서 cache-control은 `public, max-age=0, s-maxage=60, must-revalidate`, 이미지 cache-control은
  `public, no-cache, must-revalidate`였다.
- stale A 요청은 redirect 없이 `200`을 반환하되 `canonical`·`og:url`·이미지 token을 현재 B로
  수렴시켜 구현 계약과 일치했다.
- X, LinkedIn, Meta/Threads, Reddit crawler User-Agent 요청은 모두 `200`을 반환하고 같은 B
  canonical·image token을 제공했다.

## 플랫폼 작성 화면 실측

실제 게시를 완료하지 않고 각 provider의 새 작성 화면에서 revision B 미리보기만 확인했다.

| 플랫폼 | 사용한 대상 | 관찰 결과 | gate |
|---|---|---|---|
| X | 제품 코드와 같은 `intent/tweet?text={문구+revision B URL}` 형식 | 새 작성 화면에서 약 11초 안에 최신 light 카드 표시 | 통과 |
| LinkedIn | `feed/?shareActive=true&text={문구}&shareUrl={revision B URL}` | 새 작성 화면에서 최신 light 카드 즉시 표시 | 통과 |
| Threads | `threads.net/intent/post?text={문구}&url={revision B URL}` | Firefox 로그인 세션에서 초기 처리 뒤 약 10초 안에 최신 light 카드 표시 | 통과 |
| Facebook | `facebook.com/sharer/sharer.php?u={revision B URL}` | Firefox 로그인 세션에서 최신 light 카드 표시 | 통과 |
| Reddit | `reddit.com/submit?title={문구}&url={revision B URL}` | Firefox 로그인 세션에서 새 작성 화면에 최신 light 카드 표시 | 통과 |

X에서는 비교용으로 제품이 사용하지 않는 `intent/post?url={revision B URL}` 형식도 열었고 이
형식은 미리보기를 표시하지 않았다. 제품 target과 query 구조가 다른 진단 대조군이므로 gate 실패로
계산하지 않았다. 동일 revision B를 제품 코드의 `text` payload 안에 넣은 실제 target에서는 최신
이미지가 표시됐다.

LinkedIn은 새 작성 화면에서 revision B가 기존 fixed URL의 오래된 dark cache identity와 구분되는
light 카드를 표시했으므로 구현계획의 `작성 창 또는 Post Inspector` 통과 조건을 충족했다. 별도 Post
Inspector 강제 재수집은 gate 판정에 필요하지 않아 실행하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

제품 소스, `README.md`, 사용자·아키텍처·운영 공식 문서는 변경하지 않았다. Share Studio와 기존 SNS
버튼도 계속 fixed `/api/share/{handle}`를 사용하므로 Stage 3 배포만으로 사용자가 복사하는 URL은
바뀌지 않는다.

배포된 application artifact는 exact task101 source와 일치한다. validation profile의 카드 설정은
실험을 위해 dark에서 light로 저장했고 실측 종료 후에도 light 상태로 남겨 두었다. 외부 SNS 게시물,
초안 저장, provider 설정 변경은 수행하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run build:production
npm run verify:sites-fullstack
git diff --check
```

결과:

- OK — `npm run build:production` 통과. Vite server 62 modules, client 1,834 modules를 build하고
  Sites full-stack artifact를 정상 finalize했다.
- OK — `npm run verify:sites-fullstack` 통과. client files 8개, migrations 5개, worker files 2개,
  worker raw 4,012,893 bytes, compressed 2,168,229 bytes이며 `ok: true`였다.
- OK — `git diff --check` 경고 없음.
- OK — exact source `53a7132630dcb6f43459880d79730e10e2b59d6e`의 saved version 33 배포가
  성공했고 access revision 59·environment revision 89가 유지됐다.
- OK — revision B application metadata와 image token이 일치하고 X·LinkedIn gate 및
  Threads·Facebook·Reddit 회귀가 모두 통과했다.

## 잔여 위험

- provider crawler와 이미지 처리 지연은 외부 상태이므로 즉시 표시 시간을 보장할 수 없다. 이번
  관찰에서는 X 약 11초, Threads 약 10초가 필요했고 재검증 시 달라질 수 있다.
- revision 경로는 cache identity이지 과거 카드 snapshot이 아니다. stale revision도 현재 B metadata로
  수렴하므로 Stage 4 공식 문서에서 이 계약을 명시해야 한다.
- `stage5`는 saved version 33과 light 테스트 카드 상태로 남아 있다. 새 canonical production origin과
  stage5의 장기 테스트 전용 전환, 테스트 계정·데이터 폐기는 #101 성공 뒤 신규 migration Issue에서
  별도 승인받아야 한다.
- 기존 fixed URL의 provider cache는 그대로 남을 수 있다. Stage 4는 fixed URL cache 자체를
  purge하려 하지 않고 모든 새 공유 target을 같은 revision URL로 전환한다.

## 다음 단계 영향

- X와 LinkedIn gate가 모두 통과했으므로 Stage 3 보고서 승인 뒤 Stage 4 진입 조건을 충족한다.
- Stage 4에서는 링크 복사와 X·LinkedIn·Threads·Facebook·Reddit target이 모두 profile timestamp에서
  계산한 동일 revision URL을 사용하게 하고, invalid timestamp만 fixed URL로 fallback한다.
- 카드 설정 저장·submit 뒤 UI가 갱신된 timestamp를 받은 다음 새 revision URL을 계산하는지 단위·E2E로
  검증해야 한다.
- 승인된 `docs/readme-card.md`, `docs/production-hosting.md`, `docs/sites-operations.md`만 현행화하고
  `README.md`, production origin·access·saved version, DB schema는 수정하지 않는다.

## 승인 요청

- Stage 3 exact 배포 경계, application A/B 증거, X·LinkedIn gate와 Threads·Facebook·Reddit 회귀
  결과를 승인하면 Stage 4 Share Studio 단일 revision URL 전환과 공식 문서 현행화를 시작한다.
