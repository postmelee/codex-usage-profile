# Task #96 Stage 4 보고서 — 통합 검증과 비배포 handoff

GitHub Issue: [#96](https://github.com/postmelee/codex-usage-profile/issues/96)
구현계획서: [`task_m100_96_impl.md`](../plans/task_m100_96_impl.md)
Stage: 4

## 단계 목적

semantic text 전환과 site/card Skeleton palette 분리가 기존 Home·Profile·Settings·Share Studio·Sites
runtime 계약을 깨지 않았는지 전체 회귀와 production artifact로 검증한다. 실제 배포 없이 작업지시자가
로컬·실기기 확인 뒤 merge할 수 있는 PR handoff 상태를 만든다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_96_stage4.md` | 전체 회귀·artifact·route smoke와 배포 미수행 감사 기록 |
| `mydocs/orders/20260812.md` | Stage 4 완료와 최종 보고 진행 상태 기록 |

## 검증 결과

### Node 전체 회귀

```bash
npm test -- --test-concurrency=1
```

- 총 738건
- 통과 732건
- 환경 조건부 skip 6건
- 실패 0건
- TODO 0건

skip은 외부 Postgres·S3 테스트 환경 변수가 없는 경우의 기존 조건부 항목이다.

### Chromium 전체 UI 회귀

```bash
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --workers=1
```

- 통과 84/84
- 실패 0건
- Home/share mobile geometry, owner/public Profile loading/reveal, settings draft, reduced motion 포함

### WebKit Task #96 회귀

```bash
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --config=/private/tmp/task96.playwright.config.mjs --browser=webkit --grep "Task #96" --workers=1
```

- 통과 6/6
- site/card theme 교차 palette, owner draft, 일반/reduced text transition 포함

### production Sites artifact

```bash
npm run build:production
npm run verify:sites-fullstack
```

- production full-stack build 통과
- client 8 files
- Worker 2 files
- migration 5 files
- hosted linkage와 client/server 경계 검증 통과

### 로컬 full-stack route smoke

```bash
npm run smoke:sites-fullstack:local
```

- routes 50/50
- cold card render 136.13ms
- warm card render 67.53ms
- publish render 383.35ms
- public PNG 84,958 bytes

### 정적 검사

```bash
git diff --check
```

- 경고 없음.

### PR 보정 검증 (2026-08-13)

PR 게시 뒤 모바일 성능 측정에서 universal theme transition과 ready 상태에서도 남아 있는 card
Skeleton 비용을 확인해 #96 범위 안에서 보정했다. 카드 BorderBeam과 기존 화면 밖 정지 로직은
의도한 효과이므로 변경하지 않았다.

| 지표 | 보정 전 | 보정 후 |
|---|---:|---:|
| Home theme swap 활성 animation | 353 | 83 |
| Profile theme swap 활성 animation | 1,154 | 494 |
| Profile heatmap cell animation | 364 | 364 |
| ready card 비활성 Skeleton | 203 elements + shimmer 1 | 240ms 뒤 DOM 제거 + shimmer 0 |

heatmap transition 제거 뒤 실제 브라우저에서 palette가 먼저 snap하는 회귀가 확인되어 해당 예외만
철회했다. Profile 전체 활성 animation은 494개로 기존 1,154개 대비 약 57.2% 감소 상태를 유지한다.

```bash
node --test src/profile-ui/__tests__/*.test.js src/profile-marketing/__tests__/*.test.js
PROFILE_E2E_ORIGIN=http://127.0.0.1:5196 npx playwright test tests/profile-ui.spec.js --grep "Task #96|removes shimmer and crossfade" --config playwright.task96.config.js
npm run build:sites
git diff --check
```

- frontend Node 119/119 통과
- Task #96 + reduced-motion E2E 7/7 통과
- Task #96 WebKit E2E 6/6 통과
- Home card·Share Studio·Profile card readiness 관련 시나리오 13개 모두 최종 통과
- Sites 정적 build와 diff 검사 통과

## 배포 감사

- Sites hosting/deploy 명령을 실행하지 않았다.
- production/stage URL의 외부 상태를 변경하지 않았다.
- GitHub PR 게시 뒤에도 작업지시자의 로컬·모바일 확인과 merge 요청 전까지 배포하지 않는다.

## 잔여 위험 및 수동 Gate

- 자동 WebKit은 통과했지만 실제 iOS Safari·Chrome의 compositor와 화면 밝기 체감은 작업지시자의 로컬
  서버 및 실기기 Gate로 최종 확인한다.
- #95와 #96은 각각 독립된 `devel` 대상 PR이므로 둘 다 merge된 뒤 한 번에 배포하는 흐름을 유지한다.

## 다음 단계 영향

- 최종 보고서를 작성하고 `publish/task96`에 push한 뒤 ready PR을 생성한다.
- PR 생성으로 작업을 멈추며 실제 배포는 수행하지 않는다.

## 승인 상태

- 작업지시자가 #96 PR 생성까지 승인했으므로 최종 보고와 PR 게시를 계속한다.
