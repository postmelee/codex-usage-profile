# Task M100 #55 최종 보고서

GitHub Issue: [#55](https://github.com/postmelee/codex-usage-profile/issues/55)
마일스톤: M100

## 작업 요약

- 대상 이슈: #55
- 마일스톤: M100
- 단계 수: 4개 Stage와 승인된 보완 2개(Stage 3.1, 3.2)
- 작업 목적: session과 owner card image가 준비되는 동안 이전 identity가
  노출되지 않는 card-accurate skeleton을 제공하고, decode 완료 뒤에만
  Home card를 안정적으로 교체한다.

anonymous landing은 same-origin `postmelee` stable public card를 우선
사용하고 실패하면 정적 sample로 수렴한다. authenticated owner preview는
profile과 image preload/decode가 모두 완료된 current generation만 DOM에
반영한다. loading 중에는 실제 499:306 card hierarchy에 맞춘 opaque
skeleton이 이전 pixel을 완전히 가린다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-marketing/marketing-config.js` | 운영자 handle, locale-aware stable card URL과 strict validation 추가 | anonymous marketing source |
| `src/profile-ui/homeCardTransition.js` | visible/pending/generation 상태, fallback/reset과 abort-safe preload/decode 구현 | Home card source 전환 |
| `src/profile-ui/HomePage.jsx` | session/profile 상태를 전환 계약과 연결하고 action ready gate와 logout reset 적용 | authenticated Home |
| `src/profile-marketing/MarketingLanding.jsx` | card status, opaque skeleton, loading status와 card-accurate header/heatmap/stats 추가 | landing card UI·접근성 |
| `src/styles.css` | neutral skeleton, single shimmer, 240ms crossfade와 reduced-motion 정적 표현 구현 | desktop/mobile motion·layout |
| `src/profile-marketing/__tests__/*` | 운영자 config와 Sites artifact 계약 검증 | configuration 회귀 |
| `src/profile-ui/__tests__/homeCardTransition.test.js` | stale generation, fallback, logout, decode/abort와 storage 미접근 검증 | 전환 상태 단위 계약 |
| `tests/profile-ui.spec.js` | slow session/image, failure/logout, skeleton geometry, storage와 전체 UI 시나리오 추가 | Home/public profile/Share Studio E2E |
| `mydocs/plans/task_m100_55*.md` | 승인 범위, 단계·문서 위치·검증 계약 기록 | 내부 작업 계획 |
| `mydocs/working/task_m100_55_stage*.md` | Stage 1~4 및 보완 단계 결과 기록 | 단계별 검증 증적 |

backend API, CLI contract, renderer, stable card endpoint, Share Studio
동작, `.openai/hosting.json`, production Site state와 D1/R2 data는 변경하지
않았다.

## 문서 위치 검증

공식 제품/사용자/API/아키텍처 문서는 변경하지 않았다. 이번 변경은 기존
landing loading 표현과 내부 source 전환 구현이므로 수행계획서에서 승인된
task 산출물 위치만 사용했다.

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_55*.md` | OK | 승인 범위와 보완 Stage를 같은 task 계획에 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_55_stage*.md` | OK | 각 단계 검증과 잔여 위험 기록 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_55_report.md` | OK | PR 전 전체 수용 기준 기록 |
| 공식 제품 문서 | 변경 없음 | 변경 없음 | OK | public API·운영 계약 불변 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| Home image 전환 | auth/profile 응답에 따라 같은 image source를 즉시 교체 | visible/pending과 generation을 분리하고 preload/decode된 current source만 1회 반영 |
| loading privacy | 이전 card pixel이 남을 수 있음 | `#181818` opaque skeleton과 logout 즉시 owner source reset |
| skeleton 구조 | card-accurate loading 구조 없음 | neutral avatar 1개, identity placeholder 2개, 고정 `Codex`, 26×7 cell 182개, stat 4개 |
| motion 접근성 | card 전환 전용 reduced-motion 계약 없음 | single shimmer와 240ms opacity, reduced-motion에서 shimmer/crossfade/tilt 제거 |
| 브라우저 E2E | Task 시작 기준 23건 | Marketing/Home/public profile/Share Studio 33건 통과 |
| 구현 diff | 해당 없음 | 최종 보고서 전 19 files, `+3050/-48`; source/test 9 files, task 문서 10 files |
| 공개 검사 | 기존 승인 baseline | blocker 0, 기존 review 12 유지 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| anonymous operator stable card와 unavailable fallback | OK — same-origin locale URL을 사용하고 404/503/decode failure는 정적 sample 또는 neutral unavailable로 수렴 |
| slow session/profile/image 중 이전 identity 비노출 | OK — owner source는 ready 전 DOM에 없고 opaque skeleton이 card 전체를 덮음 |
| decoded owner preview 단일 교체 | OK — current generation만 commit하며 DOM source commit 1회를 E2E로 확인 |
| stale request와 logout fail-close | OK — logout 뒤 늦은 owner image 완료를 무시하고 operator state로 복원 |
| action·접근성 상태 | OK — loading 중 action disabled, `aria-busy`와 polite status 제공 후 ready에서 해제 |
| card-accurate skeleton | OK — renderer 비율의 avatar/header, 182 cells, 4 stats와 고정 `Codex` geometry 확인 |
| desktop/mobile layout 불변 | OK — loading/ready card와 Quickstart 위치 오차 1px 이하, horizontal overflow 없음 |
| reduced-motion | OK — shimmer/crossfade/tilt 제거와 static skeleton 확인 |
| browser storage privacy | OK — local/session storage에 owner id, private preview URL과 avatar identity 부재 |
| Home/public profile/Share Studio 회귀 | OK — 전체 Playwright E2E 33건 통과 |
| unit·integration·security | OK — 504건 중 498건 통과, 실패 0, 환경 의존 6건 skip |
| production Sites artifact | OK — client 7 files, Worker 2 files, migrations 2개, bindings 3개와 HTTP routes 35개 검증 |
| public release surface | OK — blocker 0, 기존 허용 review 12 |
| hosting linkage 불변 | OK — `origin/devel` 대비 `.openai/hosting.json` byte diff 없음 |
| production mutation 제외 | OK — Site version/deploy/access/environment와 D1/R2 data 변경 없음 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_55_stage1.md): 운영자 config와 immutable
  transition state 계약, 관련 unit 18건 통과.
- [Stage 2](../working/task_m100_55_stage2.md): preload/decode, generation,
  failure/logout와 storage privacy를 Home에 연결하고 전체 unit/E2E 통과.
- [Stage 3](../working/task_m100_55_stage3.md): opaque skeleton,
  accessibility, Corporate motion과 reduced-motion 검증.
- [Stage 3.1](../working/task_m100_55_stage3_1.md): 26×7 heatmap과 4개
  stats를 실제 card hierarchy에 정렬.
- [Stage 3.2](../working/task_m100_55_stage3_2.md): neutral avatar,
  identity placeholder와 고정 `Codex` header 정렬.
- [Stage 4](../working/task_m100_55_stage4.md): 전체 test/build/E2E,
  production artifact, public scanner와 hosting manifest 검증.

## 잔여 위험과 후속 작업

### 잔여 위험

- 이번 task는 production Sites deploy를 제외했으므로 hosted runtime에서
  변경 화면을 확인하려면 PR merge 뒤 별도 배포 승인이 필요하다.
- `TEST_DATABASE_URL`과 gated S3 설정이 없어 외부 Postgres/S3 test 6건은
  skip됐다. 이번 변경은 해당 adapter나 계약을 수정하지 않는다.
- 운영자 stable card가 private/unpublished 또는 일시 unavailable이면
  설계대로 정적 sample을 표시하며 사용자 기능은 중단하지 않는다.

### 후속 작업 후보

- PR merge 뒤 production Sites 배포 후보를 생성하고 실제 hosted
  anonymous/authenticated loading 전환을 smoke 검증한다.
- Postgres/S3 fallback trigger가 발생하는 경우에만 gated integration
  환경에서 별도 검증한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 바탕으로 게시된 PR의 review와
  merge 승인을 요청한다.
