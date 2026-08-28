# Task #39 Stage 3 보고서 — Share Studio GIF 생성·저장 UX

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 3

## 단계 목적

Stage 2의 browser Worker/controller를 desktop Share Studio에 연결했다. `PNG | GIF`
형식 선택 즉시 GIF를 생성하고 생성 중에는 카드 경계와 같은 skeleton, 진행률과
비활성 `Save GIF`를 제공한다. ready 뒤 같은 slot을 활성 download link로 바꾸고
상단 preview를 생성된 GIF Blob으로 교체하되 reduced motion에서는 static PNG를
유지한다. typed error는 별도 Retry로 복구하며 X·Reddit 수동 첨부를 안내한다.
PNG 모드는 기존 5개 SNS, GIF 모드는 X·Reddit만 노출하고 action row는 180ms 단일
전환 모션으로 일관되게 바뀐다. mobile은 기존 PNG-only DOM과 동작을 그대로 유지하고
Worker를 만들지 않으며, dialog close·Escape·source 변경 시 Worker와 object URL을
즉시 정리한다.

Stage 3 실제 저장 파일을 승인 시제품과 다시 대조하는 과정에서 초기 Stage 1의
rounded-perimeter Gaussian 번역이 웹 `BorderBeam`과 다른 폭·core·속도 분포를
만드는 문제를 확인했다. 출력 preset과 UX는 유지한 채 웹과 같은 카드 중심 conic
phase, dark/light stop profile, Ocean radial gradient와 rounded edge fade로 교정하고
승인 시제품 5개 frame의 수치 signature를 회귀 테스트로 고정했다.

후속 사용자 검수에서는 nominal 998×612·20fps 계약은 같지만 첫 frame `rgba4444`
palette와 3배 PNG의 기본 품질 축소 때문에 승인 시제품보다 선명도가 낮아 보이는
문제를 확인했다. Worker rasterize를 high-quality로 고정하고 static·edge exact RGB와
animation-wide sample을 결합한 two-pass global palette로 교정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/gif-animation.js` | constant perimeter Gaussian을 center-angle conic stop·Ocean radial gradient·rounded edge mask 합성으로 교체하고 dark/light stroke·inner·bloom profile과 seamless index phase 유지 |
| `src/profile-card/gif-encoder.js` | static base 16색·animation edge 48색 exact RGB 보존, 96 frame 균등 sample `rgb565` quantize와 two-pass global palette 구현 |
| `src/profile-card/__tests__/gif-animation.test.js`, `gif-encoder.test.js` | 승인 시제품 frame signature·seam과 exact pixel·전체/edge RMSE 품질 회귀 추가 |
| `src/profile-ui/gifExport.worker.js`, `src/profile-ui/__tests__/gifExport.test.js` | 3배 PNG를 2배 GIF base로 줄일 때 high-quality smoothing 고정·검증 |
| `src/profile-ui/ShareStudio.jsx` | desktop format radiogroup, GIF 선택 즉시 생성, 생성 중 skeleton·비활성 Save GIF, ready GIF preview·활성 저장, owner source 우선 fallback, reduced-motion static fallback, format-aware 공유 대상·row 전환, progress·error·retry, close/Escape/source cleanup과 React Strict Mode-safe controller 수명주기 연결 |
| `src/profile-ui/shareStudio.js` | GIF 진행률 format, typed error copy mapping, owner/public/selected source 우선순위, ready preview 판정과 GIF 모드 X·Reddit allowlist 추가 |
| `src/profile-ui/messages.js` | format·생성 진행률·저장·Retry·X·Reddit 첨부·6개 오류의 ko/en 제품 문구 추가 |
| `src/profile-ui/__tests__/shareStudio.test.js` | ko/en GIF copy, GIF/PNG 공유 대상 필터, owner source 우선순위, ready/reduced-motion preview 판정, bounded progress와 전체 오류 매핑 검증 추가 |
| `src/styles.css` | compact segmented control, 생성 중 card skeleton, ready preview와 180ms format row 전환, status/error/Retry, disabled action, focus·selected·hover 대비와 short/reduced-motion 스타일 추가 |
| `tests/profile-ui.spec.js` | 실제 browser Worker 자동 생성·download binary, 생성 중 skeleton·비활성 저장, ready GIF preview·PNG 복귀, owner source 사용, 180ms row 전환·child stagger 제거, GIF의 X·Reddit 제한과 PNG 5개 복원, source error·retry, in-flight cancel·중복 방지·reopen, mobile no-DOM/no-Worker와 회귀 E2E 추가 |
| `mydocs/orders/20260827.md` | Stage 3 완료와 Stage 4 승인 대기 상태 반영 |
| `mydocs/orders/20260828.md` | Stage 3 자동 생성·skeleton·owner source fallback 보정 상태 반영 |
| `mydocs/plans/task_m100_39.md`, `task_m100_39_impl.md` | GIF 선택 즉시 생성 UX와 함께 center-angle conic renderer·5-frame golden signature drift 방지 계약 반영 |
| `mydocs/working/task_m100_39_stage1.md` | 초기 perimeter 번역의 Stage 3 교정 사실, 최종 renderer·golden seam·대표 용량 결과로 정정 |
| `mydocs/working/task_m100_39_stage3.md` | Stage 3 산출물·검증·잔여 위험 기록 |

후속 품질 교정은 출력 dimension·fps·duration·palette 수·UI 계약을 변경하지 않고
encoder·Worker rasterize·회귀 검증과 관련 계획·보고 문서에만 한정했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 PNG download URL·파일명,
social intent, share link/Image URL/README/Image copy, Make private, preview handoff,
focus trap/restore와 scroll lock을 보존했다. GIF 선택은 기존 save slot 하나만
비활성/활성 `Save GIF` button/link로 교체한다. 선택 즉시 생성하고 생성 중에는 카드
경계와 같은 skeleton을 표시하며, ready 뒤에만 검증된 session Blob을 상단 preview와
`Save GIF`가 함께 사용한다. 이미 로드한 owner card source URL을 우선하므로 public
preview가 아직 materialize되지 않은 상태도 생성할 수 있다. PNG 복귀나 reduced
motion에서는 static PNG를 유지한다. format 변경 시 React가 X를 재사용해 자식
stagger가 빠져 보이던 회귀는 action row 전체를 180ms로 전환해 child mount 상태와
무관하게 제거했다.

초기 renderer는 beam 위치를 rounded perimeter의 일정 거리로 이동시켜 모든
사분면에서 거의 같은 길이의 두꺼운 파란 띠를 만들었다. 웹과 승인 시제품은 카드
중심에서 회전하는 conic gradient를 고정된 Ocean radial gradient 위에 통과시키므로
사분면마다 footprint·색·core가 달라진다. 최종 renderer는 이 layer 순서와 2배
edge fade를 그대로 모델링하며 card RGBA와 alpha는 고정한다. 승인 시제품에서 추출한
5개 frame의 changed-pixel footprint·p95 falloff·intensity-weighted 중심과 95→0
경계를 golden test로 검사해 같은 회귀가 다시 통과하지 못하게 했다.

mobile 환경에는 format selector와 GIF action을 렌더링하지 않고 controller도 만들지
않는다. GIF bytes는 현재 desktop dialog session의 Worker와 memory Blob URL에만
머물며 close·Escape·source 변경·unmount에서 terminate/revoke된다. React 개발
Strict Mode의 effect 재실행과 실제 unmount를 구분해 controller가 조기 dispose되거나
object URL이 남지 않도록 했다.

품질 교정은 첫 pass에서 정적 카드 최빈 16색과 테두리 animation 최빈 48색을 exact
RGB로 보존하고 frame별 offset·128px stride로 96 frame을 균등 sampling한다. 나머지
색은 `rgb565`로 quantize하며 두 번째 pass의 모든 frame은 같은 global palette와
결정적 nearest-color cache를 쓴다. no-dither·1-bit alpha·15MB hard cap은 유지한다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-card/__tests__/gif-binary.test.js
node --test src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/gifExport.test.js
npm run test:e2e -- --grep "Share Studio|GIF"
npm run build:production
git diff --check
```

결과:

- OK — GIF renderer·encoder·binary 단위 테스트 12개 통과, 실패·skip 없음.
- OK — 승인 시제품과 동일한 998×612 public sample로 frame 0/24/48/72/95를 비교해
  beam footprint·p95 falloff·중심이 golden 허용 범위 안이며, 95→0 변화량이 0→1
  변화량의 75~125% 안이다. 기존 일정 perimeter renderer는 이 gate를 통과하지 못한다.
- OK — 최종 교정 후보는 5,766,830 bytes로 15MB 미만이며, 승인 시제품과 위·아래 5-frame
  contact sheet 및 전체 animated loop를 시각 비교해 카드 고정·tight bounds·좁은
  core·위치별 Ocean 색 분포를 확인했다.
- OK — exact RGB pixel은 초기 73.32%에서 93.20%로 개선됐고 전체 RMSE 0.667,
  edge RMSE 0.587로 승인 시제품에 근접한 선명도를 회귀 기준으로 고정했다.
- OK — Share Studio/GIF controller 단위 테스트 27개 통과, 실패·skip 없음.
- OK — Share Studio·GIF Playwright E2E 20개 통과, 실패·skip 없음.
- OK — 실제 Chromium module Worker가 생성한 download를 binary inspector로 다시
  읽어 998×612, 96 frame, 50ms delay, repeat 0, 투명 full-frame, global palette,
  15MB 미만 계약과 `codex-usage-profile.gif` 파일명을 확인했다.
- OK — 최종 Chromium E2E의 실제 생성·download 시나리오는 29.2초로 60초 job
  timeout 안에서 완료됐다.
- OK — source fetch 실패가 사용자 오류로 표시되고 같은 카드 재시도가 실제
  Worker 생성 완료로 전환된다.
- OK — PNG 모드에는 X·Threads·LinkedIn·Facebook·Reddit 5개가 보이고, GIF
  모드에는 X·Reddit만 남으며 형식을 왕복해도 대상이 즉시 복원·제한된다.
- OK — format 변경 row는 180ms `share-studio-actions-format-in` 하나만 실행하고
  X·Reddit·저장 child는 기존 stagger animation을 재실행하지 않는다.
- OK — GIF 선택 즉시 생성이 시작되고 card skeleton·비활성 `Save GIF`가 표시되며,
  ready 뒤 상단 preview와 저장 link가 같은 Blob URL을 사용한다. PNG 복귀와
  재선택에서 static/animated preview가 즉시 전환된다.
- OK — owner card의 same-origin `/api/profile/card.png`가 생성 source로 우선되어
  public `/u/{handle}/card.png`가 없는 로컬 초기 상태에서도 GIF가 생성된다.
- OK — source fetch를 보류한 생성 중 저장 action이 disabled되고 Worker 하나만
  유지되며, Escape가 Worker를 종료하고 재열기 시 PNG 기본값으로 복귀한다.
- OK — iPhone 환경에서 format/GIF DOM과 Worker가 없고 기존 `Save PNG`가 유지된다.
- OK — 1512×982 reference layout, 1280×900 desktop, 1280×620 short desktop과
  iPhone/Android 회귀에서 horizontal overflow 없이 기존 handoff·focus·preview
  failure·social/copy/privacy 동작을 유지했다.
- OK — reduced motion에서는 GIF format action row를 전환해도 spatial keyframe이
  없으며 ready GIF Blob preview 판정도 false여서 static PNG 계약을 유지한다.
- OK — local browser에서 실제 Worker의 skeleton loading·ready 상태를 시각
  확인했고 selected와 hover가 겹칠 때 format label 대비가 낮은 문제를 발견해
  foreground token과
  selector 우선순위를 교정했다. 1280×620에서 secondary action까지 viewport 안에
  들어오며 overflow가 없음을 수치와 screenshot으로 확인했다. skeleton과 ready GIF가
  상단 tight-bound 카드 경계를 유지하고 X·Reddit·Save GIF가 한 행에 유지되는 화면도
  확인했다.
- OK — production server 63 modules, client 1,837 modules build 통과. 별도 Worker
  artifact는 26.06KB로 생성됐다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- actual encode 시간과 peak memory는 사용자 장치 성능에 따라 달라진다. 단일
  Worker·60초 timeout으로 경계를 두었지만 저사양 desktop 수동 실측은 Stage 4
  통합 QA에서 이어간다.
- animated GIF preview는 브라우저 native image 재생을 사용해 별도 pause control이
  없다. reduced motion에서는 static PNG를 강제하고 일반 사용자는 PNG format으로
  돌아가 animation을 멈출 수 있다.
- 실제 X·Reddit에 파일을 첨부하는 외부 계정 동작은 범위 밖이다. 생성 파일이 각
  서비스에서 선택 가능한지는 Stage 4 사용자 수동 확인 대상으로 남는다.
- dark/light × en/ko 전체 loop의 seam·beam motion·corner alpha 최종 수동 비교와
  전체 Node/Playwright/Sites 회귀는 Stage 4 범위다.

## 다음 단계 영향

- Stage 4는 `docs/readme-card.md`에 desktop web 선택 즉시 생성·저장, 생성 중
  skeleton·ready GIF preview와 reduced-motion static fallback, 15MB 경계,
  X·Reddit 수동 첨부, mobile/public URL/Web Share/clipboard/자동 업로드 미지원
  범위를 최소 추가한다.
- dark/light × en/ko 대표 GIF 네 개의 전체 loop, frame 95→0 seam, 고정 카드,
  transparent tight bounds와 Ocean Border Beam만 이동하는지 수동 비교한다.
- 전체 `npm test`, Playwright, production build, Sites artifact·local smoke를 실행하고
  실제 X·Reddit 게시나 production 배포는 수행하지 않는다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 공식 문서와 통합 시각 QA로
  진행한다.
