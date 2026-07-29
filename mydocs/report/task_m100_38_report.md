# Task #38 최종 보고서 — Share Studio 오버레이 및 PNG 공유 흐름

GitHub Issue: [#38](https://github.com/postmelee/codex-usage-profile/issues/38)
마일스톤: M100

## 작업 요약

- 대상 이슈: #38
- 마일스톤: M100
- 단계 수: 4 (Stage 2 피드백 보정 7회, Stage 3 피드백 보정 3회 포함)
- 작업 목적: 정적 Share dialog를 현재 카드에서 자연스럽게 이어지는
  responsive·accessible Share Studio로 교체하고 PNG 중심 공유 흐름을
  완성한다.

기존 Share dialog를 portal 기반 Share Studio로 교체했다. Share를 선택하면
현재 랜딩 카드의 실제 geometry를 시작점으로 snapshot하고, dim·backdrop
blur 위의 중앙 PNG preview로 이동한다. 종료할 때는 card가 원래 위치로
돌아간 뒤 source를 handoff해 반짝임과 layout jump를 방지한다. viewport
resize, source detach, preview failure와 reduced-motion에서는 bounded
fallback으로 target layout에 정착하거나 opacity-only로 종료한다.

Share Studio는 stable Image URL과 README Markdown 복사, PNG 저장,
X·LinkedIn·Reddit 공유 안내와 비공개 전환을 제공한다. social action은
공식 logo를 사용하고 PNG를 clipboard에 복사한 뒤 allowlisted browser
composer를 여는 3단계 안내를 표시한다. 이미지 자동 업로드나 게시,
provider API/OAuth 연동은 수행하지 않는다. Studio는 명시적인 X와 Escape로
닫고 backdrop click은 무시하며, focus trap/restore, inert와 scroll lock을
정확히 복구한다.

desktop, wide desktop, 390×844 mobile, 1280×620 short viewport와
reduced-motion을 별도 수용 기준으로 고정했다. 작업지시자 피드백으로
안내 panel reveal/close와 상단 choreography timing, 3번 안내 가시성,
mobile compact action 간격·text 밀도·동일 행 간격을 반복 보정했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-ui/ShareStudio.jsx` | portal dialog, shared-card open/close/handoff, social 안내, copy/download/private action, focus/inert/scroll·failure fallback 구현 | Home·owner card 공유 UX |
| `src/profile-ui/shareStudio.js` | 영어·한국어 copy, canonical public profile URL과 allowlisted X/LinkedIn/Reddit composer 계약 | 공유 문구·외부 navigation 경계 |
| `src/profile-ui/BrandLogo.jsx` | X, LinkedIn, Reddit 공식 형태의 inline SVG path | primary social action |
| `src/profile-ui/ShareDialog.jsx` | 기존 정적 dialog 제거 | legacy share UI 제거 |
| `src/profile-ui/HomePage.jsx`, `CardProfilePage.jsx`, `ProfileShell.jsx` | source card ref/geometry, Share Studio 연동과 trigger state 전달 | Home·owner profile |
| `src/profile-marketing/MarketingLanding.jsx`, `Icons.jsx` | card ref/transition suspend와 공통 icon 보강 | landing card·UI icon |
| `src/styles.css` | desktop/wide/mobile/short/reduced layout, dim/blur, card/action/panel/toast animation과 accessibility state | 전체 Share Studio visual/motion |
| `src/profile-ui/__tests__/shareStudio.test.js` | locale copy, profile URL, provider origin/path/query allowlist 회귀 | 공유 계약 단위 테스트 |
| `tests/profile-ui.spec.js` | open/close, copy/download/social/private, responsive, motion, failure와 focus 회귀 및 timing-safe close capture | browser E2E·시각 증적 |
| `docs/readme-card.md` | 실제 Share Studio, PNG 저장, composer와 직접 이미지 붙여넣기 경계 반영 | 공식 사용자 문서 |
| `mydocs/plans/task_m100_38.md`, `task_m100_38_impl.md` | 범위·4개 Stage·문서 위치·motion/responsive 수용 기준 | task 추적 |
| `mydocs/working/task_m100_38_stage{1..4}.md` | 단계별 구현, 피드백 보정, 검증과 잔여 위험 | task 증적 |
| `mydocs/orders/20260729.md` | #45 완료 상태를 보존하면서 #38 완료 상태 반영 | 당일 작업 보드 |
| `mydocs/report/task_m100_38_report.md` | 전체 수용 결과와 후속 작업 기록 | 장기 보고 |

backend, Account Usage Contract, renderer, stable public PNG endpoint, D1/R2
schema와 production Site는 변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `docs/readme-card.md` | 기존 공식 `docs/` 사용자 문서 | `docs/readme-card.md` | OK | stable URL/README/PNG 진실 원천의 Share 흐름만 최소 수정 |
| `mydocs/plans/task_m100_38.md` | `mydocs/plans/` | `mydocs/plans/` | OK | 범위·문서 위치 판단과 승인 기록 |
| `mydocs/plans/task_m100_38_impl.md` | `mydocs/plans/` | `mydocs/plans/` | OK | Stage별 구현·검증 계약 |
| `mydocs/working/task_m100_38_stage{1..4}.md` | `mydocs/working/` | `mydocs/working/` | OK | 단계별 검증 증적 |
| `mydocs/report/task_m100_38_report.md` | `mydocs/report/` | `mydocs/report/` | OK | task 최종 장기 보고 |

별도 Share Studio 공식 문서나 디자인 사양서를 만들지 않았고,
`mydocs/manual`에 제품 UX를 복제하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| Share surface | 정적 `ShareDialog` | shared-card motion을 사용하는 `ShareStudio` |
| primary action | PNG 저장 중심 | X·LinkedIn·Reddit·PNG 저장 4개 |
| secondary action | Image URL, README | Image URL, README, 비공개 전환 |
| social 안내 | 없음 | 이미지 복사→composer 열기→직접 붙여넣기 3단계 |
| close 계약 | backdrop/Escape/close | backdrop 무시, X/Escape 전용 |
| responsive 기준 | 일반 dialog | 1512×982, 1280×900, 390×844, 1280×620 |
| motion 접근성 | 일반 dialog transition | normal FLIP/handoff와 reduced opacity-only |
| 전체 Node 회귀 | #45 기준 482 pass·6 skip | 486 pass·6 skip·0 fail |
| Playwright E2E | #45 기준 16/16 | 23/23 |
| task source diff | 해당 없음 | 최종 보고 전 20 files, 3,968 insertions·260 deletions |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| shared-card open/close | OK — source geometry→target preview→source handoff가 layout jump와 flash 없이 완료 |
| PNG/URL/README | OK — stable locale URL, README copy, PNG download와 clipboard failure fallback 검증 |
| social composer | OK — X/LinkedIn/Reddit 공식 logo, PNG copy와 3단계 안내, allowlisted origin/path/query 검증 |
| 외부 전송 경계 | OK — provider API/OAuth·자동 게시 없음, private preview/credential/query 비전송 |
| close·focus | OK — X/Escape만 close, backdrop 무시, focus trap/restore와 inert/body overflow 복구 |
| desktop/wide composition | OK — title/card/action/close 중심축, card 499:306 비율과 hierarchy 유지 |
| mobile | OK — 390×844 compact 4열, 44px touch target, horizontal overflow·clip 없음 |
| short viewport | OK — 1280×620에서 title/card/action/secondary/close가 viewport 안에 유지 |
| 안내 panel | OK — open/close choreography, 3번 text 가시성, mobile 32px 행과 44px 중심 간격 |
| reduced-motion | OK — spatial keyframe/transition과 backdrop blur 제거, 기능·focus 동일 |
| failure fallback | OK — resize, detached source, preview·clipboard failure에도 download/link/close 유지 |
| public/private 계약 | OK — stable card URL과 private/unpublished anonymous `404` 무변경 |
| 제품 회귀 | OK — Marketing, Home, device, owner/public profile과 document/app scroll 회귀 통과 |
| production artifact | OK — full-stack/production artifact verifier와 credential/local-path scan 통과 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_38_stage1.md): share helper와 provider
  allowlist, accessible portal dialog, focus/inert/scroll 경계를 구현했다.
- [Stage 2](../working/task_m100_38_stage2.md): source→target FLIP,
  close handoff와 desktop reference composition을 구현하고 안내 panel,
  icon, close timing을 2.1~2.7 피드백으로 보정했다.
- [Stage 3](../working/task_m100_38_stage3.md): mobile/short/reduced,
  resize·preview·clipboard failure와 focus 회귀를 고정하고 3.1~3.3에서
  mobile action/panel 밀도와 행 간격을 보정했다.
- [Stage 4](../working/task_m100_38_stage4.md): 전체 Node/E2E/build,
  Sites production artifact, provider 보안 경계와 시각 QA를 완료하고 공식
  README 카드 문서를 실제 흐름에 맞췄다.

최종 통합 검증:

```bash
npm test -- --test-concurrency=1
npm run build
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run test:e2e
npm run test:e2e -- --grep "Korean third instruction" --repeat-each=3
git diff --check
```

- OK — Node 492개 중 486 pass, 환경 의존 integration 6 skip, fail 0.
- OK — 기본 client build 40 modules, Sites server 47 modules와 client
  40 modules build.
- OK — full-stack artifact hosted mode, client 7 files, worker 2 files,
  migration 2 files.
- OK — production artifact 5,459,290 bytes, binding 3개,
  worker raw 3,901,236 bytes, gzip 2,145,397 bytes.
- OK — Playwright 전체 23/23.
- OK — close fallback 중 이미 제거된 panel을 기다리지 않는 timing 보정 후
  한국어 3단계 안내 E2E 3/3 반복 통과.
- OK — `git diff --check` 통과.
- OK — 1280×900, 1512×982, 390×844, 1280×620 및 reduced-motion
  screenshot을 직접 비교했다.

## 잔여 위험과 후속 작업

### 잔여 위험

- PostgreSQL과 외부 S3 endpoint가 필요한 6개 integration test는 환경변수가
  없어 skip됐다. 동일 계약의 memory/file/D1/R2 local test와 Sites
  full-stack Worker smoke는 통과했다.
- 외부 provider의 로그인 상태, 작성 UI, popup 정책과 실제 게시 성공은
  제어 범위 밖이다. 제품은 이미지 복사와 allowlisted composer 진입까지만
  보장한다.
- 브라우저별 PNG Clipboard API와 permission 차이가 있어 실패 시 PNG 저장
  fallback을 유지한다.
- production 배포와 실제 production origin Share Studio smoke는 범위 밖이라
  수행하지 않았다.

### 후속 작업 후보

- [#55](https://github.com/postmelee/codex-usage-profile/issues/55)에서
  서비스 운영자의 stable public card를 anonymous 랜딩 예시로 사용하고,
  session/profile/image 준비 중 기존 card 유지·loading veil·crossfade와
  logout/reduced-motion fallback을 별도 구현한다.
- Animated GIF와 Web Share API는 기존
  [#39](https://github.com/postmelee/codex-usage-profile/issues/39) 범위로
  유지한다.

## 작업지시자 승인 요청

- 4개 Stage와 10회 피드백 보정, 전체 수용 기준과 잔여 위험을 검토하고
  Task #38 PR의 merge 여부를 승인해 달라.
