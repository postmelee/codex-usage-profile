# Task #78 최종 보고서 — 소셜 공유 OG 메타데이터와 PublicProfilePage 카드 인트로

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
마일스톤: M100

## 작업 요약

- 대상 이슈: #78
- 마일스톤: M100
- 단계 수: 7 (Stage 2와 Stage 5는 하위 단계로 분할해 실제 9개 단위)
- 작업 목적: 카드를 SNS에 붙였을 때 링크 미리보기가 뜨도록 `/u/{handle}`에 Open Graph 메타데이터와 전용 소셜 이미지를 제공하고, 공유 링크로 유입된 방문자가 카드를 먼저 보게 하는 인트로를 붙인다.

착수 시점에는 링크 공유 경로 자체가 없었다. Share Studio의 소셜 intent는 문구만 전달하고 URL을 넣지 않았으며, 사용자는 `PNG URL 복사`로 이미지 주소를 받아 직접 붙여넣어야 했다. X와 카카오톡에서 미리보기가 나오지 않은 원인이다.

PR #80 게시 뒤 코드 리뷰에서 정합성·캐시·조회 비용 4건을 확인했다. 리뷰 내용을 PR 코멘트로 먼저 등록한 뒤 Stage 7에서 다음을 보정했다.

- 카드 설정 owner CAS가 성공한 요청만 stable `social.png`를 storage ETag 조건부 commit
- owner `updatedAt`과 usage `uploadedAt` 중 최신 밀리초를 `og:image?v=`에 반영
- social conditional GET의 ETag metadata-first 비교와 304 body 미조회
- structured store contract v3의 public summary projection과 D1/Postgres 단일 JOIN

## 변경 파일 목록과 영향 범위

주요 항목만 적는다.

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-runtime/open-graph.js` | 신규. OG 태그 계약, 문서 주입, 공개 URL·소셜 이미지 URL 생성 | 세 런타임 공용 |
| `src/profile-runtime/public-profile-document.js` | 신규. `/u/{handle}` HTML 핸들러. 미대상이면 `null`을 돌려 호출부가 폴스루 | dev·Node·Workers |
| `src/profile-runtime/public-profile-resolver.js` | public summary projection 1회로 `cardLocale`, `handle`, owner·usage 최신 리비전 조회 | D1 hot path |
| `src/profile-runtime/host-adapter.js` | `isPublicSocialCardRoutePath` 추가와 백엔드 라우트 등록 | 라우팅 경계 — 아래 편차 항목 참조 |
| `src/profile-card/social-canvas.js` | 신규. 1200x630 논리 배치, 2배 출력 | 두 렌더러 공용 |
| `src/profile-card/renderer.js` | `renderProfileSocialCardPng` 추가, `drawCard` 추출 | Node 렌더러 |
| `src/profile-card/worker-renderer.js` | `createWorkerProfileSocialCardSvg` 추가 | Workers 렌더러 |
| `src/profile-media/media-store-contract.js` | `social` 미디어 키, storage ETag, 조건부 read/write capability | 세 스토어 어댑터 |
| `src/profile-media/publication-service.js` | 발행·refresh 편입과 설정 CAS 이후 social 조건부 commit | 발행 파이프라인 |
| `src/profile-backend/store-contract.js`, store adapter 4종 | contract v3 public summary projection. D1/Postgres 단일 JOIN | structured store |
| `src/profile-backend/http.js` | `GET\|HEAD /u/{handle}/social.png`, metadata-first 304 | 공개 라우트 |
| `src/profile-ui/PublicProfilePage.jsx` | 카드 크기·효과를 `/profile`과 통일, 비공개 소유자 미리보기, unavailable 화면 | 공개 프로필 |
| `src/profile-ui/useCardHandoffMotion.js` | 신규. Share Studio에서 FLIP 인계 모션 추출 (852→554행) | Share Studio·인트로 공용 |
| `src/profile-ui/PublicCardIntro.jsx` | 신규. 회전 등장 모달과 인계 | 공개 프로필 |
| `src/profile-ui/ShareStudio.jsx` | 액션 재배치, 소셜 버튼 직접 연결, 안내 패널 연결 해제 | 홈·`/profile` |
| `src/profile-ui/shareStudio.js` | 공유 URL을 `/u/{handle}`로, intent에 링크 전달, 대상 5곳 | 공유 계약 |
| `src/profile-ui/SiteFooter.jsx` | 신규. 전 화면 공통 Footer | 전역 |
| `src/profile-ui/ThemeToggle.jsx` | 신규. 헤더 테마 전환 스위치 | 전역 |
| `docs/readme-card.md` | 공유 흐름과 링크 미리보기 절 갱신 | 사용자 문서 |
| `docs/production-hosting.md` | contract v3, D1 projection, social conditional I/O 현행화 | 운영 문서 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/readme-card.md` | `docs/` | `docs/` | OK | 기존 사용자 문서 갱신. 신규 공식 문서 루트를 만들지 않았다 |
| `docs/production-hosting.md` | `docs/` | `docs/` | OK | 기존 structured/media 운영 계약의 해당 절만 현행화 |
| 작업 문서 | `mydocs/plans`, `mydocs/working`, `mydocs/report` | 동일 | OK | 계획서 2개, 단계 보고서 9개, 최종 보고서 1개 |

제품·운영 문서는 기존 `docs/readme-card.md`, `docs/production-hosting.md`의 관련 절만 갱신했으며 신규 공식 문서 루트 선택은 발생하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| `/u/{handle}` OG 태그 | 없음 | `og:*` 10개, `twitter:*` 5개 |
| 공유 가능한 링크 | 없음 (이미지 URL만) | `https://{origin}/u/{handle}` |
| 소셜 intent의 URL 파라미터 | 전달 안 함 | X·Threads·LinkedIn·Facebook·Reddit 5곳에 전달 |
| 소셜 공유 대상 | 3곳 | 5곳 |
| handle당 미디어 객체 | 4 (locale 2 × theme 2) | 5 (`social.png` 1개 추가) |
| 소셜 이미지 출력 | 없음 | 2400x1260 (1200x630 논리 @2x) |
| `ShareStudio.jsx` | 852행 | 554행 (모션 훅 352행 분리) |
| 단위 테스트 | 592 pass | 685 pass |
| e2e | 60 pass | 64 pass |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| `/u/{handle}` HTML에 handle별 OG·Twitter 태그 | OK — dev 응답 실측. `og:title`은 `postmelee's Codex card`, `twitter:card`는 `summary_large_image` |
| `/u/{handle}/social.png` 200, 카드가 잘리지 않고 안전 여백과 함께 중앙 배치 | OK — `status=200`, `image/png`, 204929 bytes, 2400x1260. **크기는 편차 있음, 아래 참조** |
| 소셜 이미지는 handle당 하나, 설정 저장 시 같은 URL 갱신, unpublish 시 404 | OK — `cards/v2/public/{handle}/social.png` 단일 키. owner CAS 실패 시 이전 ETag/body 유지, 동시 저장 승자만 PUT |
| 설정 변경과 사용량 갱신이 `og:image` 리비전에 반영 | OK — owner·usage 최신 시각의 밀리초 token. 같은 초 1ms 차이 회귀 포함 |
| social 304에서 object body 미조회 | OK — R2/S3 HEAD 1회, GET 0회와 HTTP 304 빈 body 단언 |
| OG 문서 structured read 1회 | OK — contract v3 projection. D1/Postgres JOIN statement 1회 단언, real-workerd D1 통과 |
| `/u/{handle}/card.png` URL과 응답 유지 | OK — `status=200`, `image/png`. 기존 키 계약 무변경 |
| 비공개·미존재가 프로필 존재를 드러내지 않고 기본 OG로 폴백 | OK — 두 미존재 handle HTML `cmp` 일치, 공개 JSON 404 응답 일치. 비공개↔미존재 대조는 Stage 3·4와 e2e `public profile uses one identity-free unavailable state`에서 확인 |
| 비공개 소유자에게 공개 전환 안내와 CTA, 전환 후 인트로 | OK — Stage 4. 실제 공개 화면 미리보기 + 상단 고정 배너 |
| 방문자에게 비공개와 미존재가 동일 화면, 공개 API 응답 동일 | OK — 위와 동일 근거 |
| 세 런타임 OG 태그 동일 | 부분 OK — dev 실측 완료. Workers·Node 프로덕션은 공통 모듈 단위 테스트로만 확인. **배포 후 대조 필요** |
| `owner-only`에서 `/u/{handle}` HTML 차단 | OK — Stage 3 |
| `host-adapter.js`와 `static-assets.js` 무변경 | **편차** — `static-assets.js`는 무변경. `host-adapter.js`는 8줄 추가. 아래 참조 |
| `PublicProfilePage` 카드가 `/profile`과 동일한 600x368과 효과 | OK — Stage 5.2 실측 |
| 진입 시 모달 표시, 닫으면 하단 카드로 인계 | OK — Stage 5.2 |
| `prefers-reduced-motion`에서 회전 생략 | OK — `introDuration`이 140ms로 축소 |
| Share Studio에서 공유 링크가 1차 액션, intent에 링크 전달 | OK — Stage 6 |
| 홈·`/profile` Share Studio 회귀 없음 | OK — e2e 64건 통과 |

### 통합 검증 명령

```bash
npm test          # 691개 중 685 pass, 0 fail, 6 skipped
npm run test:e2e  # 64 pass, 0 fail (50.8s)
npm run build     # 성공
git diff --check  # 경고 없음
```

e2e가 5건 실패한 실행이 한 번 있었으나 코드 결함이 아니었다. 그 실행은 8.4분, 재실행은 50.7초에 전건 통과했다. 브라우저 패널이 같은 dev 서버를 점유한 상태의 포트 경합이었다.

### 계획 대비 편차 2건

두 건 모두 승인된 변경이지만 Issue 본문의 수용 기준 문구는 갱신하지 않았으므로 문자 그대로는 MISS다.

**`host-adapter.js` 수정.** 계획서는 이 파일을 건드리지 않기로 했다. 그 제약의 목적은 `/u/{handle}` **HTML** 라우트를 백엔드로 승격하지 않는 것이었다. Sites 백엔드 핸들러는 `environment.ASSETS`를 받지 않아 라우트를 승격하면 index.html을 읽지 못하고 404가 난다. 이 제약은 지켰다 — HTML은 승격하지 않고 런타임별 문서 핸들러 합성으로 처리했다.

반면 `social.png`는 `card.png`와 같은 미디어 라우트다. 등록하지 않으면 Worker의 `looksLikeStaticAsset`이 확장자를 보고 정적 자산으로 오인해 404를 낸다. `isPublicSocialCardRoutePath`를 추가해 `card.png`와 같은 취급을 받게 했다. Stage 2.2 보고서에 판단 근거를 남기고 진행했다.

**소셜 이미지 출력이 2400x1260.** 수용 기준은 1200x630이다. 논리 배치는 1200x630 그대로이고 출력만 2배다. 작업지시자가 `card.png` 대비 해상도 저하, 특히 프로필 이미지 열화를 지적해 `SOCIAL_OUTPUT_SCALE = 2`를 적용했다. `og:image:width`/`height`도 2400/1260으로 선언한다. 플랫폼은 선언 크기와 실제 픽셀이 일치하면 되고 1.91:1 비율은 유지되므로 미리보기 동작에는 영향이 없다.

### 단계별 검증 결과

- Stage 1 — [`task_m100_78_stage1.md`](../working/task_m100_78_stage1.md): OG 태그 계약과 문서 핸들러. 신규 4파일, 기존 파일 무변경
- Stage 2.1 — [`task_m100_78_stage2_1.md`](../working/task_m100_78_stage2_1.md): 1200x630 캔버스와 두 렌더러. 여백 투명 처리
- Stage 2.2 — [`task_m100_78_stage2_2.md`](../working/task_m100_78_stage2_2.md): 단일 `social.png` 발행과 공개 라우트, 세 스토어 어댑터
- Stage 3 — [`task_m100_78_stage3.md`](../working/task_m100_78_stage3.md): 런타임별 문서 핸들러 연결과 `owner-only` 차단
- Stage 4 — [`task_m100_78_stage4.md`](../working/task_m100_78_stage4.md): 공개 카드 컴포넌트 통일, 비공개 소유자 미리보기, unavailable 화면
- Stage 5.1 — [`task_m100_78_stage5_1.md`](../working/task_m100_78_stage5_1.md): 인계 모션 훅 추출. 기능 변경 없음
- Stage 5.2 — [`task_m100_78_stage5_2.md`](../working/task_m100_78_stage5_2.md): 인트로 모달, 기하 정합 3건 수정, 감속 곡선
- Stage 6 — [`task_m100_78_stage6.md`](../working/task_m100_78_stage6.md): Share Studio 재구성, 헤더·테마 전환·Footer, 통합 검증
- Stage 7 — [`task_m100_78_stage7.md`](../working/task_m100_78_stage7.md): 설정/media 정합성, OG 리비전, social 304, 단일 JOIN projection 보정

## 잔여 위험과 후속 작업

### 잔여 위험

- **배포 후에만 확인 가능한 항목이 남아 있다.** Workers와 Node 프로덕션 런타임의 실제 OG 응답 대조, Worker resvg 소셜 렌더 출력, 투명 여백의 플랫폼 합성 색이다. 공통 모듈은 단위 테스트로 덮여 있지만 런타임 실응답은 미확인이다.
- **실플랫폼 미리보기 미확인.** X, Threads, 카카오톡의 실제 카드 표시는 배포 후 확인해야 한다. 카카오톡은 OG 캐시가 남아 있어 캐시 초기화 도구 실행이 필요하다.
- **회전 애니메이션의 실제 재생을 확인하지 못했다.** 검증에 쓴 브라우저 패널은 Web Animations를 진행시키지 못한다(`playState`가 `running`인데 `currentTime`이 0에서 정지). 애니메이션 객체 생성과 위상 전환은 확인했으나 의도한 속도·곡선으로 보이는지는 실브라우저 확인이 남아 있다.
- **인트로 모달이 매 진입마다 뜬다.** 뒤로가기와 새로고침에서도 표시된다. 승인된 결정이다.
- **`ShareInstructions`가 연결되지 않은 채 남아 있다.** 카카오톡처럼 URL 미리보기가 통하지 않는 표면에 대비한 보존이다. 사용되지 않는 코드이므로 정적 분석에서 dead code로 잡힐 수 있다.
- **owner CAS 성공 뒤 provider 장애 가능성.** social conditional commit 시 외부 media provider가 지속적으로 unavailable이면 owner 설정은 commit됐지만 API는 generic media unavailable을 반환한다. ETag 경합은 bounded retry로 수렴하며, provider 장애는 기존 refresh/repair 절차가 필요하다.

### 후속 작업 후보

- [#79](https://github.com/postmelee/codex-usage-profile/issues/79) — 인트로 모달 카드 뒤 Heatmap 셰이더 후광. 이번 task에서 만든 모달이 시각적으로 밋밋하다는 피드백에서 출발했다. 런타임 의존성 추가와 라이선스·번들·폴백 검증이 필요해 분리했다.
- Footer의 GitHub 링크가 헤더 GitHub 링크와 목적지가 같아 한 화면에 두 번 나온다. 정리 여부를 검토할 수 있다.
- 소셜 이미지를 locale·theme별로 확장할 여지는 계획서에 남겨 뒀다. 현재는 저장된 설정 기준 단일 이미지다.

## 작업지시자 승인 요청

- Stage 7 최종 보고서와 검증 결과를 PR #80 보정 커밋에 포함한다.
- 새 CI 통과 뒤 리뷰 코멘트와 분리된 보정 내용 코멘트를 등록한다.
