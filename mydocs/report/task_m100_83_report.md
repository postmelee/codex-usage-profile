# Task #83 최종 보고서 — Sites production artifact와 owner-only 릴리스 후보 검증

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
마일스톤: M100

## 작업 요약

- 대상 이슈: #83
- 마일스톤: M100
- 단계 수: 단계 보고서 15개, 원격 진단·보정 하위 단계를 포함한 실행 단위 21개
- 작업 목적: Task #74·#78 누적 후보를 안전한 production artifact로 만들고, D1
  migration `1..5`, OAuth·CLI·카드·공유·캐시·SNS 계약을 실제 Sites에서 확인한 뒤
  공개 전환 직전의 owner-only 후보로 고정한다.

착수 시 `dist/server/.vite/manifest.json`에는 빌드 머신의 절대 경로가 남아
`verify:sites-production`이 실패했다. build-time 소비가 끝난 exact metadata만 제거하는
finalizer를 추가해 verifier를 완화하지 않고 차단 사유를 해소했다. 이어서 기존 Sites
project와 D1/R2 linkage를 재사용해 migration readiness를 `1..2`에서 exact
`[1,2,3,4,5]`로 맞추고 owner-only 기능 smoke를 통과했다.

실제 Sites front door에서 root query와 extension 없는 `/u/{handle}`이 동적 HTML을
전달하지 않는다는 점, legacy publication의 social object가 없을 수 있다는 점을 Gate B로
확인했다. 공유 문서는 Worker 전달이 확인된 `/api/share/{handle}`로 고정하고, coherent
personalized social object가 없을 때 packaged sample로 닫히게 했다. 제한 public smoke에서
private/missing 비노출, README 4변형, canonical OG/Twitter, social GET/HEAD/304와
publish/unpublish revision 신선도를 확인한 뒤 즉시 custom owner-only로 복원했다.

후속 실제 브라우저 확인에서 카드 이미지 준비 전 motion, avatar 일시 실패 고착, surface별
중복 fetch/decode, 공유 handoff 깜빡임, profile loading/Skeleton geometry와 reveal 위치
불일치를 발견했다. Stage 4.1~4.6에서 공통 readiness·bounded tab-memory resource cache,
avatar fail-soft, source bitmap handoff, 요소별 Skeleton과 같은 자리의 동시 opacity reveal로
보정했다. Stage 4.6 exact source는 saved version 23으로 owner-only 배포됐고 hosted
smoke를 통과했다.

PR #85 리뷰에서 동일 `displaySrc` lease 재획득 누수와 hosted migration SQL/spec drift
보호선 부재를 추가로 확인했다. Stage 4.7에서 cleanup을 lease identity에 결합하고 실제
React hook A→null→A 회귀를 추가했으며, migration 3~5 실제 SQL fragment와 hosted
reconciliation specification을 함께 검증하고 stage code를 manifest에서 파생했다. 이
보정은 local 전체 검증과 CI 대상이며 saved version 23을 재배포하지 않는다.

## 변경 파일 목록과 영향 범위

주요 경로를 기능 단위로 묶었다.

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `scripts/finalize-sites-fullstack-artifact.mjs`, `package.json` | 전체 Vite build 뒤 consumed manifest만 제거하는 production finalizer 연결 | production build·Sites archive |
| `scripts/__tests__/finalize-sites-fullstack-artifact.test.js`, artifact verifier tests | runtime 파일 보존, symlink 거부, verifier 독립성 고정 | build security boundary |
| `src/profile-backend/d1/migration-runner.js`, `src/profile-backend/http.js` | hosted schema reconciliation, exact migration operator, owner profile canonical URL | D1 readiness·OAuth/CLI metadata |
| `src/profile-runtime/sites/` | maintenance 진단 경계, Worker share document·media·observability 연결 | Sites Worker·D1/R2 |
| `src/profile-runtime/open-graph.js`, `public-profile-document.js`, `public-profile-resolver.js` | `/api/share/{handle}` canonical OG/Twitter와 packaged social fallback | SNS crawler·공개 HTML |
| `src/profile-card/` | GitHub avatar transient retry·성공 bytes만 cache, Worker redirect fail-closed | server card renderer |
| `src/profile-ui/cardImageReadiness.js`, `cardShare.js`, `shareStudio.js` | generation-safe image readiness, lease identity cleanup과 owner-scoped bounded decoded resource reuse | 홈·profile·공유 화면 |
| `src/profile-ui/PublicCardIntro.jsx`, `ShareStudio.jsx`, `useCardHandoffMotion.js` | ready 뒤 motion, source bitmap handoff와 중복 crossfade 제거 | 공유 modal·direct share |
| `src/profile-ui/ProfileLoadingSkeleton.jsx`, `CardProfilePage.jsx`, `PublicProfilePage.jsx`, `src/styles.css` | profile 구조형 Skeleton, ready geometry 정합과 transform-free 동시 reveal | owner/public profile UX |
| `src/profile-ui/appRoutes.js`, `AccountMenu.jsx`, `DeviceApprovalPage.jsx` | Sites canonical owner route `/?view=profile` | 메뉴·OAuth·CTA |
| `tests/profile-ui.spec.js`, 관련 `__tests__`와 hook fixture | migration SQL/spec drift, route, cache, lease lifecycle, readiness, motion, Skeleton, reduced-motion 회귀 고정 | Node·Playwright 검증 |
| `README.md`, `docs/*.md` | 실제 Sites 경로, owner-only 기준선, CLI·공유·운영 계약 현행화 | 사용자·운영 문서 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | Gate 승인, 단계 결과, exact provenance와 #84 handoff 기록 | 작업 추적 |

전체 branch diff는 89파일, +9,025/-441줄이다. 원격 진단·수용 검증과 15개 단계
보고서를 포함하며, 제품 동작은 위 기능 경계에 한정했다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | 저장소 루트 | OK | 공개 진입 문서의 후보 상태만 기존 위치에서 갱신 |
| `docs/sites-operations.md` | `docs/` | `docs/` | OK | saved version/access/environment와 Gate 절차의 운영 진실 원천 |
| `docs/production-hosting.md` | `docs/` | `docs/` | OK | migration·artifact·cache·current candidate 상태만 기존 아키텍처 문서에 반영 |
| `docs/readme-card.md` | `docs/` | `docs/` | OK | 공유 URL·카드 후보와 #84 전 owner-only 상태를 기존 사용자 문서에 반영 |
| `docs/cli-submit.md` | `docs/` | `docs/` | OK | CLI가 생성하는 canonical owner profile URL만 기존 문서에서 갱신 |
| 단계 증적 | `mydocs/working/` | `mydocs/working/` | OK | 14개 단계 보고서에 bounded count·SHA·상태만 기록 |
| 최종 handoff | `mydocs/report/` | `mydocs/report/task_m100_83_report.md` | OK | #84 선행조건과 exact source를 한 문서에 고정 |

새 공식 문서 루트는 만들지 않았다. credential, raw identity·usage, 원격 payload와 로컬
분석 경로는 제품·작업 문서에 기록하지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| production artifact verifier | 절대 로컬 경로로 실패 | artifact 6,230,513 bytes, bindings 3, migration 5, `ok: true` |
| D1 readiness | migration `1..2` | exact `[1,2,3,4,5]` |
| canonical Sites share document | root query는 정적 HTML, `/u/{handle}`은 `/`로 `307` | Worker 전달 `/api/share/{handle}` + exact OG/Twitter |
| legacy social object 부재 | HTML이 `404` image를 선언할 수 있음 | coherent personalized image 또는 2400x1260 packaged fallback |
| 카드 준비 상태 | profile/share별 raw image와 준비 전 motion | `load`·`decode` generation gate, last-ready 보존, ready 뒤 motion |
| 동일 tab 카드 재사용 | component별 Blob/fetch/decode | owner-scoped TTL/LRU resource cache와 in-flight dedupe |
| profile reveal | 6px 이동, `0/40/80/120ms` stagger | transform `none`, 전 영역 delay `0s`, 동시 360ms opacity |
| 전체 Node 검증 | Stage 2: 696개 중 690 pass, 6 skip | 727개 중 721 pass, 6 skip, fail 0 |
| Playwright E2E | Stage 2: 64/64 | 75/75 |
| card image lease lifecycle | 동일 display source 재획득 뒤 한 lease 미회수 | A→null→A, clear·unmount 뒤 object URL 정확히 1회 회수 |
| hosted migration drift guard | 수동 column spec과 SQL이 독립 | migration 3~5 실제 SQL fragment reconciliation과 manifest 기반 stage code 검증 |
| owner-only saved version / 최종 local candidate | version 8 Gate A 기준 후보 | version 23은 Stage 4.6 source 유지, Stage 4.7은 local·CI 검증 뒤 #84에서 exact `main` 재검증 |
| 최종 Site access | owner-only | custom owner-only revision 56 유지 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| verifier를 완화하지 않고 production artifact의 절대 경로·credential·secret 제거 | OK — consumed manifest만 post-build 제거하고 독립 full-stack/production verifier 통과 |
| deployed source, artifact와 saved version provenance 일치 | OK — version 23 source가 Stage 4.6 exact SHA와 일치, archive 29파일·6,256,640 bytes; Stage 4.7은 원격 미배포로 별도 local candidate로 명시 |
| D1 migration `1..5` exact readiness와 safe operator | OK — hosted reconciliation·apply·재실행 경계 검증, maintenance disabled/operator route 404 baseline |
| owner-only OAuth/session/logout과 CLI login/submit/revoke | OK — protected hosted 시나리오와 disposable cleanup 통과 |
| private preview, settings, publish/unpublish와 README 4변형 | OK — owner-only·Gate B 시나리오 통과 |
| private/missing profile·media가 존재 여부를 구분하지 않음 | OK — JSON/media 404와 동일 fallback HTML 경계 확인 |
| canonical OG/Twitter와 social image GET/HEAD/304 | OK — `/api/share/{handle}`과 personalized/fallback media 계약 확인 |
| cache/revision 판단 | OK — shared-cache HIT·stale `Age` 증거 없음, application revision·ETag 즉시 갱신; source 변경 비차단 판정 |
| Gate B 뒤 owner-only·private·revoked·disposable baseline 복원 | OK — custom revision 56, owner 외 user/group 0, public/disposable 상태 정리 |
| owner profile Sites route | OK — `/?view=profile` 메뉴·OAuth 복귀·CTA와 legacy Node/dev `/profile` 병존 |
| 카드 image readiness와 stale completion 차단 | OK — delayed/error/source change·last-ready·reduced-motion 회귀 통과 |
| avatar 복구성과 동일 tab resource reuse | OK — bounded retry, failure 비캐시, owner 격리, sequential/concurrent dedupe 통과 |
| 동일 source lease lifecycle | OK — 기존 dependency에서 회귀 테스트 실패를 재현하고 lease identity 보정 뒤 clear·unmount disposal 통과 |
| hosted migration SQL/spec 정합 | OK — migration 3~5 실제 SQL fragment metadata-only reconciliation과 manifest 첫/마지막 bounded code 통과 |
| 공유 modal handoff 연속성 | OK — source bitmap 첫 frame 유지, warm target 중복 fade·Skeleton 깜빡임 제거 |
| profile Skeleton/ready geometry와 동시 reveal | OK — 주요 box 2px 허용 오차, 네 영역 delay `0s`, transform `none`, opacity `1` |
| 최종 owner-only hosted 후보 | OK — version 23 deployment `succeeded`, owner profile·share document/card smoke 통과 |

최종 통합 검증은 다음 결과로 종료했다.

```text
Node: 727 tests / 721 pass / 6 environment-condition skip / 0 fail
Playwright: 75 / 75 pass
production build: server 60 modules / client 1,828 modules
full-stack verifier: client 8 / worker 2 / migration 5 / ok true
production verifier: artifact 6,230,696 bytes / bindings 3 / migration 5 / ok true
git diff --check: clean
```

환경 설정이 없는 Postgres/S3 integration 6개만 skip됐다. canonical Sites 경로인 real-workerd
D1/R2, Worker full-stack과 실제 hosted smoke는 수행했다. Stage 4.7 Playwright는 프로젝트
revision의 Chromium과 same-origin hook fixture를 사용했고 production source·assertion은
변경하지 않았다.

### 단계별 검증 결과

- Stage 1 — [`task_m100_83_stage1.md`](../working/task_m100_83_stage1.md): consumed Vite manifest finalizer와 독립 verifier 22건
- Stage 2 — [`task_m100_83_stage2.md`](../working/task_m100_83_stage2.md): exact local candidate, 전체 검증과 Sites archive preflight
- Stage 3·3.1~3.6 — [`task_m100_83_stage3.md`](../working/task_m100_83_stage3.md): Gate A, hosted D1 migration operator·readiness와 owner-only 기능 smoke
- Stage 3.7 — [`task_m100_83_stage3_7.md`](../working/task_m100_83_stage3_7.md): root-query compatibility 가설 검증과 fallback
- Stage 3.8 — [`task_m100_83_stage3_8.md`](../working/task_m100_83_stage3_8.md): Worker 전달 `/api/share/{handle}` canonical 문서
- Stage 3.9 — [`task_m100_83_stage3_9.md`](../working/task_m100_83_stage3_9.md): social object authority와 packaged fallback
- Stage 3.10 — [`task_m100_83_stage3_10.md`](../working/task_m100_83_stage3_10.md): Sites canonical owner profile 경로
- Stage 4 — [`task_m100_83_stage4.md`](../working/task_m100_83_stage4.md): Gate B cache·revision·SNS 실측과 owner-only 원복
- Stage 4.1 — [`task_m100_83_stage4_1.md`](../working/task_m100_83_stage4_1.md): 공통 card readiness·Skeleton·motion gate
- Stage 4.2 — [`task_m100_83_stage4_2.md`](../working/task_m100_83_stage4_2.md): avatar transient recovery와 decoded resource cache
- Stage 4.3 — [`task_m100_83_stage4_3.md`](../working/task_m100_83_stage4_3.md): Workerd avatar redirect와 source-image handoff
- Stage 4.4 — [`task_m100_83_stage4_4.md`](../working/task_m100_83_stage4_4.md): warm target 연속성·공통 profile Skeleton
- Stage 4.5 — [`task_m100_83_stage4_5.md`](../working/task_m100_83_stage4_5.md): Skeleton/ready geometry와 content reveal 정합
- Stage 4.6 — [`task_m100_83_stage4_6.md`](../working/task_m100_83_stage4_6.md): 공간 이동·stagger 제거, version 23 owner-only smoke
- Stage 4.7 — [`task_m100_83_stage4_7.md`](../working/task_m100_83_stage4_7.md): lease lifecycle과 migration SQL/spec drift guard

## 잔여 위험과 후속 작업

### 잔여 위험

- 현재 Site는 의도적으로 owner-only다. 일반 사용자는 #84 Gate C 전에는 접근할 수 없다.
- 외부 SNS scraper의 장기 cache, 투명 PNG 합성 색과 재수집 시점은 provider가 결정한다.
  application revision·ETag는 정상이며 이를 제어하기 위한 추측성 cache 변경은 하지 않았다.
- Sites front door는 root query initial metadata와 extension 없는 `/u/{handle}` Worker 전달을
  보장하지 않는다. 공개 공유 URL은 `/api/share/{handle}`을 유지해야 한다.
- managed production D1/R2 fault injection은 수행하지 않았다. local real-workerd failure·
  concurrency suite와 hosted 정상 경로를 근거로 수용한 기존 위험이다.
- Postgres/S3 fallback integration 6개는 외부 endpoint가 없는 환경이라 skip됐다. fallback
  제거를 의미하지 않으며 architecture 문서의 전환 조건은 유지한다.
- owner-only saved version 23은 Stage 4.6 exact source다. Stage 4.7은 local·CI candidate로만
  검증했으므로 #84에서 merge된 exact `main` source의 owner-only build·artifact·smoke를
  새 release provenance로 고정해야 한다.

### 후속 작업 후보

- [#84](https://github.com/postmelee/codex-usage-profile/issues/84) — Task #83 PR merge·cleanup 뒤
  `devel → main` 릴리스 승격, Stage 4.7이 포함된 exact `main` 후보 재검증, Gate C 영구
  public 전환과 X·Threads·카카오톡 최종 실측을 수행한다. 시작 전에 `/api/share/{handle}`
  실제 공유 경로와 social coherence 검증 기준으로 issue 본문을 보정한다.
- avatar failure backoff와 retry 설정 의미는 별도 운영 hardening 이슈 후보로 묶는다.
- sliding TTL, state updater side effect와 decode timeout은 card image resource lifecycle
  hardening 이슈 후보로 묶는다. R2/social fallback 정책은 Gate C 또는 production에서
  실제 provider degradation 증거가 확인될 때 이슈화한다.

## 작업지시자 승인 요청

- 작업지시자가 PR #85 리뷰 차단 항목을 Stage 4.7에서 보정하고 CI 통과 뒤 직접 merge할 수
  있게 진행하라고 지시했다. 이 승인을 근거로 단계·최종 보고서와 오늘할일을 정정하고
  기존 `publish/task83` PR head를 갱신한다.
- PR은 `devel` 대상 ready 상태를 유지하며 self-merge하지 않는다. 모든 required CI 통과를
  확인한 뒤 작업지시자에게 직접 merge를 요청한다. merge 뒤 `pr-merge-cleanup`으로 #83과
  branch/worktree 부산물을 정리한 다음 #84를 시작한다.
